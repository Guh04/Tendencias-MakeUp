-- Operacoes de negocio atomicas (RPC). ADMIN e PDV usam exatamente estas funcoes.

-- ---------------------------------------------------------------------------
-- Internas (nao expostas ao navegador)
-- ---------------------------------------------------------------------------
create function public._audit(p_action text, p_entity text, p_entity_id text, p_details jsonb default '{}'::jsonb)
returns void language sql security definer set search_path = public as $$
  insert into public.audit_logs (user_id, action, entity, entity_id, details)
  values (auth.uid(), p_action, p_entity, p_entity_id, coalesce(p_details, '{}'::jsonb))
$$;

-- Aplica variacao de estoque com trava de linha e registra a movimentacao.
create function public._apply_stock(
  p_product uuid, p_delta integer, p_type public.stock_move_type, p_origin public.stock_origin,
  p_ref_type text, p_ref_id uuid, p_reason text, p_allow_negative boolean default false
) returns integer language plpgsql security definer set search_path = public as $$
declare v_stock integer; v_name text; v_new integer;
begin
  select stock, name into v_stock, v_name from public.products where id = p_product for update;
  if not found then
    raise exception 'Produto não encontrado.' using errcode = 'P0002';
  end if;
  v_new := v_stock + p_delta;
  if v_new < 0 and not p_allow_negative then
    raise exception 'Estoque insuficiente para "%": disponível %, solicitado %.', v_name, v_stock, -p_delta
      using detail = 'INSUFFICIENT_STOCK';
  end if;
  perform set_config('app.stock_write', '1', true);
  update public.products set stock = v_new where id = p_product;
  perform set_config('app.stock_write', '0', true);
  insert into public.stock_movements (product_id, type, qty, stock_after, origin, ref_type, ref_id, reason, created_by)
  values (p_product, p_type, p_delta, v_new, p_origin, p_ref_type, p_ref_id, p_reason, auth.uid());
  return v_new;
end $$;

create function public._require_staff() returns void
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_staff() then
    raise exception 'Acesso negado.' using errcode = '42501';
  end if;
end $$;

create function public._origin(p_origin text) returns public.stock_origin
language plpgsql immutable as $$
begin
  if p_origin not in ('admin', 'pdv', 'ecommerce') then
    raise exception 'Origem inválida: %.', p_origin;
  end if;
  return p_origin::public.stock_origin;
end $$;

-- ---------------------------------------------------------------------------
-- Produtos e estoque
-- ---------------------------------------------------------------------------
create function public.create_product(
  p_name text, p_barcode text, p_category text, p_cost_cents integer, p_price_cents integer,
  p_stock integer default 0, p_description text default '', p_image_url text default null,
  p_brand text default '', p_sku text default null, p_min_stock integer default null,
  p_supplier_id uuid default null, p_origin text default 'pdv'
) returns public.products language plpgsql security definer set search_path = public as $$
declare
  v_barcode text := nullif(trim(coalesce(p_barcode, '')), '');
  v_sku text := nullif(trim(coalesce(p_sku, '')), '');
  v_dup text; v_row public.products; v_origin public.stock_origin;
begin
  perform public._require_staff();
  v_origin := public._origin(p_origin);
  if length(trim(coalesce(p_name, ''))) < 2 then raise exception 'Informe o nome do produto.'; end if;
  if p_price_cents is null or p_price_cents <= 0 then raise exception 'O preço de venda deve ser maior que zero.'; end if;
  if p_cost_cents is null or p_cost_cents < 0 then raise exception 'Preço de custo inválido.'; end if;
  if coalesce(p_stock, 0) < 0 then raise exception 'O estoque inicial não pode ser negativo.'; end if;

  if v_barcode is not null then
    select name into v_dup from public.products where barcode = v_barcode;
    if found then
      raise exception 'Já existe um produto com este código de barras: %.', v_dup using errcode = '23505';
    end if;
  end if;
  if v_sku is not null then
    select name into v_dup from public.products where lower(sku) = lower(v_sku);
    if found then
      raise exception 'Já existe um produto com este SKU: %.', v_dup using errcode = '23505';
    end if;
  end if;

  insert into public.products (sku, barcode, name, category, brand, description, price_cents, stock, min_stock,
                               supplier_id, image_url, created_by)
  values (coalesce(v_sku, ''), v_barcode, trim(p_name), coalesce(nullif(trim(p_category), ''), 'Outros'),
          coalesce(p_brand, ''), coalesce(p_description, ''), p_price_cents, 0,
          coalesce(p_min_stock, (select default_min_stock from public.settings)),
          p_supplier_id, p_image_url, auth.uid())
  returning * into v_row;

  insert into public.product_costs (product_id, cost_cents) values (v_row.id, p_cost_cents);

  if coalesce(p_stock, 0) > 0 then
    perform public._apply_stock(v_row.id, p_stock, 'entrada', v_origin, 'product', v_row.id, 'Estoque inicial');
    select * into v_row from public.products where id = v_row.id;
  end if;

  perform public._audit('produto_criado', 'products', v_row.id::text,
    jsonb_build_object('nome', v_row.name, 'barcode', v_row.barcode, 'estoque_inicial', coalesce(p_stock, 0), 'origem', p_origin));
  return v_row;
end $$;

-- Entrada, saida ou ajuste manual (somente administrador).
create function public.adjust_stock(
  p_product_id uuid, p_delta integer, p_reason text default null,
  p_type public.stock_move_type default 'ajuste', p_origin text default 'admin'
) returns integer language plpgsql security definer set search_path = public as $$
declare v_new integer;
begin
  if not public.is_admin() then raise exception 'Somente administrador pode ajustar o estoque.' using errcode = '42501'; end if;
  if p_type not in ('entrada', 'saida', 'ajuste') then raise exception 'Tipo de movimentação inválido.'; end if;
  if p_delta is null or p_delta = 0 then raise exception 'Informe uma quantidade diferente de zero.'; end if;
  if p_type = 'entrada' and p_delta < 0 then raise exception 'Entrada deve ter quantidade positiva.'; end if;
  if p_type = 'saida' and p_delta > 0 then raise exception 'Saída deve ter quantidade negativa.'; end if;
  if p_type = 'ajuste' and length(trim(coalesce(p_reason, ''))) < 3 then
    raise exception 'Informe o motivo do ajuste.';
  end if;
  v_new := public._apply_stock(p_product_id, p_delta, p_type, public._origin(p_origin), 'manual', null, p_reason, false);
  perform public._audit('estoque_' || p_type::text, 'products', p_product_id::text,
    jsonb_build_object('variacao', p_delta, 'estoque_apos', v_new, 'motivo', p_reason));
  return v_new;
end $$;

-- ---------------------------------------------------------------------------
-- Caixa
-- ---------------------------------------------------------------------------
create function public.open_cash_session(p_opening_cents integer, p_notes text default '')
returns public.cash_sessions language plpgsql security definer set search_path = public as $$
declare v_row public.cash_sessions;
begin
  perform public._require_staff();
  if p_opening_cents is null or p_opening_cents < 0 then raise exception 'Valor inicial inválido.'; end if;
  if exists (select 1 from public.cash_sessions where opened_by = auth.uid() and status = 'aberto') then
    raise exception 'Você já possui um caixa aberto.';
  end if;
  insert into public.cash_sessions (opened_by, opening_cents, opening_notes)
  values (auth.uid(), p_opening_cents, coalesce(p_notes, ''))
  returning * into v_row;
  perform public._audit('caixa_aberto', 'cash_sessions', v_row.id::text,
    jsonb_build_object('numero', v_row.number, 'fundo_de_caixa_cents', p_opening_cents));
  return v_row;
end $$;

create function public.add_cash_movement(p_type public.cash_move_type, p_amount_cents integer, p_reason text)
returns public.cash_movements language plpgsql security definer set search_path = public as $$
declare v_session uuid; v_row public.cash_movements;
begin
  perform public._require_staff();
  if p_type not in ('suprimento', 'sangria') then raise exception 'Tipo de movimentação de caixa inválido.'; end if;
  if p_amount_cents is null or p_amount_cents <= 0 then raise exception 'Informe um valor maior que zero.'; end if;
  if length(trim(coalesce(p_reason, ''))) < 3 then raise exception 'Informe o motivo.'; end if;
  select id into v_session from public.cash_sessions where opened_by = auth.uid() and status = 'aberto';
  if v_session is null then raise exception 'Abra o caixa antes de registrar movimentações.'; end if;
  insert into public.cash_movements (session_id, type, amount_cents, reason, created_by)
  values (v_session, p_type, p_amount_cents, trim(p_reason), auth.uid())
  returning * into v_row;
  perform public._audit('caixa_' || p_type::text, 'cash_movements', v_row.id::text,
    jsonb_build_object('valor_cents', p_amount_cents, 'motivo', p_reason));
  return v_row;
end $$;

create function public.cash_session_summary(p_session_id uuid) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  s public.cash_sessions;
  v_cash int; v_pix int; v_debit int; v_credit int; v_count int; v_total int;
  v_sup int; v_san int; v_ret_cash int; v_pending int; v_cancel_n int; v_cancel_total int;
  v_ret_total int; v_expected int;
begin
  select * into s from public.cash_sessions where id = p_session_id;
  if not found then raise exception 'Caixa não encontrado.'; end if;
  if s.opened_by <> auth.uid() and not public.is_admin() then
    raise exception 'Acesso negado.' using errcode = '42501';
  end if;

  select coalesce(sum(sp.amount_cents) filter (where sp.method = 'dinheiro'), 0),
         coalesce(sum(sp.amount_cents) filter (where sp.method = 'pix'), 0),
         coalesce(sum(sp.amount_cents) filter (where sp.method = 'debito'), 0),
         coalesce(sum(sp.amount_cents) filter (where sp.method = 'credito'), 0)
    into v_cash, v_pix, v_debit, v_credit
  from public.sale_payments sp join public.sales sl on sl.id = sp.sale_id
  where sl.session_id = s.id and sl.status in ('paga', 'devolvida_parcial', 'devolvida');

  select count(*), coalesce(sum(total_cents), 0) into v_count, v_total
  from public.sales where session_id = s.id and status in ('paga', 'devolvida_parcial', 'devolvida');

  select count(*) into v_pending from public.sales where session_id = s.id and status = 'pendente';
  select count(*), coalesce(sum(total_cents), 0) into v_cancel_n, v_cancel_total
  from public.sales where session_id = s.id and status = 'cancelada';

  select coalesce(sum(amount_cents) filter (where type = 'suprimento'), 0),
         coalesce(sum(amount_cents) filter (where type = 'sangria'), 0)
    into v_sup, v_san
  from public.cash_movements where session_id = s.id;

  -- devolucoes em dinheiro de vendas que nao foram canceladas depois
  select coalesce(sum(cm.amount_cents), 0) into v_ret_cash
  from public.cash_movements cm left join public.sales sl on sl.id = cm.sale_id
  where cm.session_id = s.id and cm.type = 'devolucao' and (sl.id is null or sl.status <> 'cancelada');

  select coalesce(sum(refund_cents), 0) into v_ret_total from public.returns where session_id = s.id;

  v_expected := s.opening_cents + v_cash + v_sup - v_san - v_ret_cash;

  return jsonb_build_object(
    'session_id', s.id, 'number', s.number, 'status', s.status,
    'opening_cents', s.opening_cents,
    'sales_count', v_count, 'sales_total_cents', v_total,
    'cash_cents', v_cash, 'pix_cents', v_pix, 'debit_cents', v_debit, 'credit_cents', v_credit,
    'supplies_cents', v_sup, 'withdrawals_cents', v_san,
    'cash_refunds_cents', v_ret_cash, 'refunds_total_cents', v_ret_total,
    'pending_sales', v_pending, 'cancelled_count', v_cancel_n, 'cancelled_total_cents', v_cancel_total,
    'expected_cash_cents', v_expected);
end $$;

create function public.close_cash_session(p_session_id uuid, p_counted_cents integer, p_notes text default '')
returns public.cash_sessions language plpgsql security definer set search_path = public as $$
declare s public.cash_sessions; v_sum jsonb; v_expected int;
begin
  perform public._require_staff();
  if p_counted_cents is null or p_counted_cents < 0 then raise exception 'Informe o dinheiro contado.'; end if;
  select * into s from public.cash_sessions where id = p_session_id for update;
  if not found then raise exception 'Caixa não encontrado.'; end if;
  if s.opened_by <> auth.uid() and not public.is_admin() then
    raise exception 'Acesso negado.' using errcode = '42501';
  end if;
  if s.status <> 'aberto' then raise exception 'Este caixa já foi fechado.'; end if;

  v_sum := public.cash_session_summary(s.id);
  if (v_sum->>'pending_sales')::int > 0 then
    raise exception 'Existem % venda(s) pendente(s). Conclua ou cancele antes de fechar o caixa.', v_sum->>'pending_sales';
  end if;
  v_expected := (v_sum->>'expected_cash_cents')::int;

  update public.cash_sessions
     set status = 'fechado', closed_by = auth.uid(), closed_at = now(),
         expected_cash_cents = v_expected, counted_cash_cents = p_counted_cents,
         difference_cents = p_counted_cents - v_expected, closing_notes = coalesce(p_notes, ''),
         summary = v_sum
   where id = s.id returning * into s;

  perform public._audit('caixa_fechado', 'cash_sessions', s.id::text,
    jsonb_build_object('numero', s.number, 'esperado_cents', v_expected, 'contado_cents', p_counted_cents,
                       'diferenca_cents', s.difference_cents));
  return s;
end $$;

-- ---------------------------------------------------------------------------
-- Vendas
-- ---------------------------------------------------------------------------
-- Cria a venda PENDENTE (nao baixa estoque, nao conta no faturamento).
create function public.create_sale(
  p_items jsonb, p_discount_cents integer default 0, p_client_id uuid default null,
  p_channel public.sale_channel default 'presencial', p_require_session boolean default true,
  p_origin text default 'pdv'
) returns public.sales language plpgsql security definer set search_path = public as $$
declare
  v_session uuid; v_sub integer := 0; v_disc integer := coalesce(p_discount_cents, 0);
  r record; p public.products; v_sale public.sales; v_item uuid; v_max numeric; v_origin public.stock_origin;
begin
  perform public._require_staff();
  v_origin := public._origin(p_origin);
  if p_items is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'Adicione ao menos um produto ao carrinho.';
  end if;

  select id into v_session from public.cash_sessions where opened_by = auth.uid() and status = 'aberto';
  if v_session is null and (p_require_session or not public.is_admin()) then
    raise exception 'Abra o caixa antes de realizar vendas.';
  end if;

  for r in select (e->>'product_id')::uuid as pid, sum((e->>'qty')::int) as qty
           from jsonb_array_elements(p_items) e group by 1 order by 1
  loop
    if r.qty < 1 then raise exception 'Quantidade inválida.'; end if;
    select * into p from public.products where id = r.pid and active;
    if not found then raise exception 'Produto inexistente ou inativo no carrinho.'; end if;
    v_sub := v_sub + p.price_cents * r.qty;
  end loop;

  if v_disc < 0 then raise exception 'O desconto não pode ser negativo.'; end if;
  if v_disc > v_sub then raise exception 'O desconto não pode ser maior que o subtotal.'; end if;
  if not public.is_admin() then
    select max_operator_discount_pct into v_max from public.settings;
    if v_disc * 100 > v_sub * v_max then
      raise exception 'Desconto acima do limite do operador (% %%). Peça a um administrador.', v_max;
    end if;
  end if;

  insert into public.sales (channel, origin, status, session_id, operator_id, client_id,
                            subtotal_cents, discount_cents, total_cents)
  values (p_channel, v_origin, 'pendente', v_session, auth.uid(), p_client_id, v_sub, v_disc, v_sub - v_disc)
  returning * into v_sale;

  for r in select (e->>'product_id')::uuid as pid, sum((e->>'qty')::int) as qty
           from jsonb_array_elements(p_items) e group by 1 order by 1
  loop
    select * into p from public.products where id = r.pid;
    insert into public.sale_items (sale_id, product_id, name, sku, barcode, qty, unit_price_cents)
    values (v_sale.id, p.id, p.name, p.sku, p.barcode, r.qty, p.price_cents)
    returning id into v_item;
    insert into public.sale_item_costs (sale_item_id, unit_cost_cents)
    values (v_item, coalesce((select cost_cents from public.product_costs where product_id = p.id), 0));
  end loop;

  return v_sale;
end $$;

-- Confirma o pagamento: valida estoque com trava, baixa estoque e conclui a venda.
create function public.finalize_sale(
  p_sale_id uuid, p_payments jsonb, p_allow_oversell boolean default false
) returns public.sales language plpgsql security definer set search_path = public as $$
declare
  v_sale public.sales; pay record; it record; v_paid integer := 0; v_rc integer; v_origin public.stock_origin;
begin
  perform public._require_staff();
  select * into v_sale from public.sales where id = p_sale_id for update;
  if not found then raise exception 'Venda não encontrada.'; end if;
  if v_sale.operator_id <> auth.uid() and not public.is_admin() then
    raise exception 'Acesso negado.' using errcode = '42501';
  end if;
  if v_sale.status <> 'pendente' then raise exception 'Esta venda não está pendente.'; end if;
  if p_allow_oversell and not public.has_perm('override_stock') then
    raise exception 'Sem autorização para vender acima do estoque.' using errcode = '42501';
  end if;
  if p_payments is null or jsonb_typeof(p_payments) <> 'array' or jsonb_array_length(p_payments) = 0 then
    raise exception 'Informe a forma de pagamento.';
  end if;

  for pay in select (e->>'method')::public.payment_method as m, (e->>'amount_cents')::int as a,
                    nullif(e->>'received_cents', '')::int as rc
             from jsonb_array_elements(p_payments) e
  loop
    if pay.a is null or pay.a <= 0 then raise exception 'Valor de pagamento inválido.'; end if;
    v_rc := coalesce(pay.rc, pay.a);
    if pay.m = 'dinheiro' and v_rc < pay.a then
      raise exception 'O valor recebido em dinheiro é menor que o valor a pagar.';
    end if;
    v_paid := v_paid + pay.a;
  end loop;
  if v_paid <> v_sale.total_cents then
    raise exception 'A soma dos pagamentos (R$ %) difere do total da venda (R$ %).',
      to_char(v_paid / 100.0, 'FM999990.00'), to_char(v_sale.total_cents / 100.0, 'FM999990.00');
  end if;

  v_origin := case v_sale.origin when 'ecommerce' then 'ecommerce' else v_sale.origin end;
  for it in select product_id, sum(qty)::int as q from public.sale_items where sale_id = v_sale.id
            group by product_id order by product_id
  loop
    perform public._apply_stock(it.product_id, -it.q, 'venda', v_origin, 'sale', v_sale.id,
                                'Venda #' || v_sale.number, p_allow_oversell);
  end loop;

  for pay in select (e->>'method')::public.payment_method as m, (e->>'amount_cents')::int as a,
                    nullif(e->>'received_cents', '')::int as rc
             from jsonb_array_elements(p_payments) e
  loop
    if pay.m = 'dinheiro' then v_rc := coalesce(pay.rc, pay.a); else v_rc := pay.a; end if;
    insert into public.sale_payments (sale_id, method, amount_cents, received_cents, change_cents)
    values (v_sale.id, pay.m, pay.a, v_rc, v_rc - pay.a);
  end loop;

  update public.sales set status = 'paga', paid_at = now() where id = v_sale.id returning * into v_sale;
  perform public._audit('venda_paga', 'sales', v_sale.id::text,
    jsonb_build_object('numero', v_sale.number, 'total_cents', v_sale.total_cents, 'canal', v_sale.channel,
                       'venda_acima_do_estoque', p_allow_oversell));
  return v_sale;
end $$;

-- Cria e paga numa unica transacao (usado pelo PDV e pela tela de vendas do ADMIN).
create function public.checkout_sale(
  p_items jsonb, p_payments jsonb, p_discount_cents integer default 0, p_client_id uuid default null,
  p_channel public.sale_channel default 'presencial', p_require_session boolean default true,
  p_origin text default 'pdv', p_allow_oversell boolean default false
) returns public.sales language plpgsql security definer set search_path = public as $$
declare v_sale public.sales;
begin
  v_sale := public.create_sale(p_items, p_discount_cents, p_client_id, p_channel, p_require_session, p_origin);
  return public.finalize_sale(v_sale.id, p_payments, p_allow_oversell);
end $$;

-- Cancela (nunca apaga). Venda paga devolve o estoque restante.
create function public.cancel_sale(p_sale_id uuid, p_reason text)
returns public.sales language plpgsql security definer set search_path = public as $$
declare v_sale public.sales; it record;
begin
  perform public._require_staff();
  if not public.has_perm('cancel') then
    raise exception 'Você não tem permissão para cancelar vendas.' using errcode = '42501';
  end if;
  if length(trim(coalesce(p_reason, ''))) < 3 then raise exception 'Informe o motivo do cancelamento.'; end if;
  select * into v_sale from public.sales where id = p_sale_id for update;
  if not found then raise exception 'Venda não encontrada.'; end if;
  if v_sale.status = 'cancelada' then raise exception 'Esta venda já foi cancelada.'; end if;
  if v_sale.status = 'devolvida' then raise exception 'Esta venda já foi totalmente devolvida.'; end if;

  if v_sale.status in ('paga', 'devolvida_parcial') then
    for it in select product_id, sum(qty - returned_qty)::int as q from public.sale_items
              where sale_id = v_sale.id group by product_id having sum(qty - returned_qty) > 0 order by product_id
    loop
      perform public._apply_stock(it.product_id, it.q, 'cancelamento', v_sale.origin, 'sale', v_sale.id,
                                  'Cancelamento da venda #' || v_sale.number, true);
    end loop;
  end if;

  update public.sales
     set status = 'cancelada', cancelled_at = now(), cancelled_by = auth.uid(), cancel_reason = trim(p_reason)
   where id = v_sale.id returning * into v_sale;
  perform public._audit('venda_cancelada', 'sales', v_sale.id::text,
    jsonb_build_object('numero', v_sale.number, 'total_cents', v_sale.total_cents, 'motivo', p_reason));
  return v_sale;
end $$;

-- Devolucao total ou parcial. p_items: [{sale_item_id, qty, restock}]
create function public.register_return(
  p_sale_id uuid, p_items jsonb, p_reason text, p_refund_method public.payment_method default 'dinheiro'
) returns public.returns language plpgsql security definer set search_path = public as $$
declare
  v_sale public.sales; v_ret public.returns; r record; v_item public.sale_items;
  v_refund integer := 0; v_session uuid; v_all boolean; v_prev integer;
begin
  perform public._require_staff();
  if not public.has_perm('refund') then
    raise exception 'Você não tem permissão para registrar devoluções.' using errcode = '42501';
  end if;
  if length(trim(coalesce(p_reason, ''))) < 3 then raise exception 'Informe o motivo da devolução.'; end if;
  if p_items is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'Selecione ao menos um item para devolver.';
  end if;
  select * into v_sale from public.sales where id = p_sale_id for update;
  if not found then raise exception 'Venda não encontrada.'; end if;
  if v_sale.status not in ('paga', 'devolvida_parcial') then
    raise exception 'Só é possível devolver itens de vendas pagas.';
  end if;

  select id into v_session from public.cash_sessions where opened_by = auth.uid() and status = 'aberto';
  if p_refund_method = 'dinheiro' and v_session is null then
    raise exception 'Abra o caixa para devolver dinheiro ao cliente.';
  end if;

  insert into public.returns (sale_id, session_id, reason, refund_method, refund_cents, created_by)
  values (v_sale.id, v_session, trim(p_reason), p_refund_method, 0, auth.uid())
  returning * into v_ret;

  for r in select (e->>'sale_item_id')::uuid as iid, (e->>'qty')::int as qty,
                  coalesce((e->>'restock')::boolean, true) as restock
           from jsonb_array_elements(p_items) e
  loop
    select * into v_item from public.sale_items where id = r.iid and sale_id = v_sale.id for update;
    if not found then raise exception 'Item não pertence a esta venda.'; end if;
    if r.qty is null or r.qty < 1 or r.qty > v_item.qty - v_item.returned_qty then
      raise exception 'Quantidade a devolver inválida para "%".', v_item.name;
    end if;
    update public.sale_items set returned_qty = returned_qty + r.qty where id = v_item.id;
    insert into public.return_items (return_id, sale_item_id, qty, restock) values (v_ret.id, v_item.id, r.qty, r.restock);
    v_refund := v_refund + round(r.qty * v_item.unit_price_cents::numeric * v_sale.total_cents / v_sale.subtotal_cents)::int;
    if r.restock then
      perform public._apply_stock(v_item.product_id, r.qty, 'devolucao', v_sale.origin, 'return', v_ret.id,
                                  'Devolução da venda #' || v_sale.number, true);
    end if;
  end loop;

  select not exists (select 1 from public.sale_items where sale_id = v_sale.id and returned_qty < qty) into v_all;
  if v_all then
    select coalesce(sum(refund_cents), 0) into v_prev from public.returns where sale_id = v_sale.id and id <> v_ret.id;
    v_refund := v_sale.total_cents - v_prev;
  end if;

  update public.returns set refund_cents = v_refund where id = v_ret.id returning * into v_ret;
  update public.sales set status = case when v_all then 'devolvida'::public.sale_status
                                        else 'devolvida_parcial'::public.sale_status end
   where id = v_sale.id;

  if p_refund_method = 'dinheiro' and v_refund > 0 then
    insert into public.cash_movements (session_id, type, amount_cents, reason, sale_id, created_by)
    values (v_session, 'devolucao', v_refund, 'Devolução da venda #' || v_sale.number, v_sale.id, auth.uid());
  end if;

  perform public._audit('devolucao_registrada', 'returns', v_ret.id::text,
    jsonb_build_object('venda', v_sale.number, 'reembolso_cents', v_refund, 'motivo', p_reason,
                       'forma', p_refund_method));
  return v_ret;
end $$;

-- ---------------------------------------------------------------------------
-- Permissoes de execucao (somente usuarios autenticados; cada funcao valida o papel)
-- ---------------------------------------------------------------------------
grant execute on function
  public.create_product(text, text, text, integer, integer, integer, text, text, text, text, integer, uuid, text),
  public.adjust_stock(uuid, integer, text, public.stock_move_type, text),
  public.open_cash_session(integer, text),
  public.add_cash_movement(public.cash_move_type, integer, text),
  public.cash_session_summary(uuid),
  public.close_cash_session(uuid, integer, text),
  public.create_sale(jsonb, integer, uuid, public.sale_channel, boolean, text),
  public.finalize_sale(uuid, jsonb, boolean),
  public.checkout_sale(jsonb, jsonb, integer, uuid, public.sale_channel, boolean, text, boolean),
  public.cancel_sale(uuid, text),
  public.register_return(uuid, jsonb, text, public.payment_method)
to authenticated;
