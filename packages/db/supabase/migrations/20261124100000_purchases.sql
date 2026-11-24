-- Entrada de mercadoria (compra de fornecedor): varios produtos de uma vez, atualizando estoque e custo.
-- Somente administrador. Registros sao imutaveis (historico de compras).

create table public.purchases (
  id uuid primary key default gen_random_uuid(),
  number bigint generated always as identity,
  supplier_id uuid references public.suppliers(id) on delete set null,
  note text not null default '',
  total_cents integer not null check (total_cents >= 0),
  expense_registered boolean not null default false,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now()
);
create unique index purchases_number_key on public.purchases (number);

create table public.purchase_items (
  id uuid primary key default gen_random_uuid(),
  purchase_id uuid not null references public.purchases(id) on delete restrict,
  product_id uuid not null references public.products(id) on delete restrict,
  name text not null,
  qty integer not null check (qty > 0),
  unit_cost_cents integer not null check (unit_cost_cents >= 0),
  prev_cost_cents integer not null default 0
);
create index purchase_items_purchase_idx on public.purchase_items (purchase_id);

do $$
declare t text;
begin
  foreach t in array array['purchases', 'purchase_items']
  loop
    execute format('alter table public.%I enable row level security', t);
    execute format('create policy %I on public.%I for select to authenticated using (public.is_admin())', t || '_admin_select', t);
    execute format('create trigger %I before delete on public.%I for each row execute function public.forbid_delete()', t || '_no_delete', t);
    execute format('create trigger %I before update on public.%I for each row execute function public.forbid_update()', t || '_no_update', t);
  end loop;
end $$;

revoke all on public.purchases, public.purchase_items from anon;
revoke insert, update, delete on public.purchases, public.purchase_items from authenticated;
grant select on public.purchases, public.purchase_items to authenticated;
grant all on public.purchases, public.purchase_items to service_role;

create function public.receive_goods(
  p_supplier_id uuid, p_note text, p_items jsonb, p_register_expense boolean default false
) returns public.purchases language plpgsql security definer set search_path = public as $$
declare
  v_purchase public.purchases;
  v_item jsonb;
  v_pid uuid; v_qty integer; v_cost integer; v_prev integer; v_name text;
  v_total bigint := 0;
  v_seen uuid[] := '{}';
  v_supplier text;
begin
  if not public.is_admin() then
    raise exception 'Somente administrador pode registrar entrada de mercadoria.' using errcode = '42501';
  end if;
  if p_items is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'Informe ao menos um produto.';
  end if;
  if p_supplier_id is not null then
    select name into v_supplier from public.suppliers where id = p_supplier_id;
    if not found then raise exception 'Fornecedor não encontrado.'; end if;
  end if;

  select coalesce(sum(x.qty::bigint * x.unit_cost_cents), 0) into v_total
    from jsonb_to_recordset(p_items) as x(product_id uuid, qty integer, unit_cost_cents integer)
    where x.qty > 0 and x.unit_cost_cents >= 0;
  if v_total > 2000000000 then raise exception 'Valor total muito alto.'; end if;

  insert into public.purchases (supplier_id, note, total_cents, expense_registered, created_by)
  values (p_supplier_id, coalesce(trim(p_note), ''), v_total, coalesce(p_register_expense, false) and v_total > 0, auth.uid())
  returning * into v_purchase;

  for v_item in select * from jsonb_array_elements(p_items) loop
    v_pid := (v_item ->> 'product_id')::uuid;
    v_qty := (v_item ->> 'qty')::integer;
    v_cost := (v_item ->> 'unit_cost_cents')::integer;
    if v_pid is null or v_qty is null or v_qty <= 0 then raise exception 'Quantidade inválida.'; end if;
    if v_cost is null or v_cost < 0 then raise exception 'Custo unitário inválido.'; end if;
    if v_pid = any (v_seen) then raise exception 'Produto repetido na lista.'; end if;
    v_seen := v_seen || v_pid;

    select name into v_name from public.products where id = v_pid;
    if not found then raise exception 'Produto não encontrado.'; end if;
    select coalesce((select cost_cents from public.product_costs where product_id = v_pid), 0) into v_prev;

    perform public._apply_stock(v_pid, v_qty, 'entrada', 'admin', 'compra', v_purchase.id,
                                'Entrada de mercadoria nº ' || v_purchase.number, false);
    insert into public.product_costs (product_id, cost_cents) values (v_pid, v_cost)
      on conflict (product_id) do update set cost_cents = excluded.cost_cents;
    insert into public.purchase_items (purchase_id, product_id, name, qty, unit_cost_cents, prev_cost_cents)
      values (v_purchase.id, v_pid, v_name, v_qty, v_cost, v_prev);
  end loop;

  if p_register_expense and v_total > 0 then
    insert into public.transactions (occurred_on, type, category, description, amount_cents, created_by)
    values (current_date, 'saida', 'Compra de mercadoria',
            'Compra nº ' || v_purchase.number || coalesce(' - ' || v_supplier, ''), v_total, auth.uid());
  end if;

  perform public._audit('entrada_mercadoria', 'purchases', v_purchase.id::text,
    jsonb_build_object('numero', v_purchase.number, 'itens', jsonb_array_length(p_items),
                       'total_cents', v_total, 'fornecedor', v_supplier, 'despesa_lancada', p_register_expense));
  return v_purchase;
end $$;

revoke execute on function public.receive_goods(uuid, text, jsonb, boolean) from public, anon;
grant execute on function public.receive_goods(uuid, text, jsonb, boolean) to authenticated;
