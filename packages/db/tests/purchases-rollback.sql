-- Teste da entrada de mercadoria. Roda numa transacao que SEMPRE desfaz tudo (ver phase6-rollback.sql).
do $$
declare
  v_admin uuid := gen_random_uuid();
  v_op uuid := gen_random_uuid();
  v_log text := '';
  v_fail int := 0;
  pa public.products; pb public.products; pur public.purchases;
  err text; n int; c int; s int;
begin
  insert into auth.users (id, instance_id, aud, role, email, raw_app_meta_data, raw_user_meta_data)
  values (v_admin, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'qa-pu-admin@example.com', '{"role":"admin"}', '{"full_name":"PU Admin"}'),
         (v_op,    '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'qa-pu-op@example.com',    '{"role":"operator"}', '{"full_name":"PU Op"}');
  set local role authenticated;

  perform set_config('request.jwt.claims', json_build_object('sub', v_admin, 'role', 'authenticated')::text, true);
  pa := public.create_product(p_name => 'QA Batom A', p_barcode => '', p_category => 'Outros', p_cost_cents => 1000, p_price_cents => 3000, p_stock => 2, p_origin => 'admin');
  pb := public.create_product(p_name => 'QA Base B', p_barcode => '', p_category => 'Outros', p_cost_cents => 500, p_price_cents => 2000, p_stock => 0, p_origin => 'admin');

  -- operador nao registra entrada
  perform set_config('request.jwt.claims', json_build_object('sub', v_op, 'role', 'authenticated')::text, true);
  begin
    perform public.receive_goods(null, 'x', jsonb_build_array(jsonb_build_object('product_id', pa.id, 'qty', 1, 'unit_cost_cents', 100)));
    err := null;
  exception when others then err := sqlerrm; end;
  v_log := v_log || format('[%s] operador nao registra entrada (%s)' || E'\n', case when err is not null then 'ok' else 'FALHA' end, coalesce(err, 'sem erro'));
  if err is null then v_fail := v_fail + 1; end if;

  -- administrador registra 2 itens com despesa
  perform set_config('request.jwt.claims', json_build_object('sub', v_admin, 'role', 'authenticated')::text, true);
  pur := public.receive_goods(null, 'nota 123', jsonb_build_array(
    jsonb_build_object('product_id', pa.id, 'qty', 10, 'unit_cost_cents', 1500),
    jsonb_build_object('product_id', pb.id, 'qty', 5, 'unit_cost_cents', 800)), true);
  select stock into s from public.products where id = pa.id;
  select cost_cents into c from public.product_costs where product_id = pa.id;
  v_log := v_log || format('[%s] item A: estoque %s (esperado 12), custo %s (esperado 1500)' || E'\n', case when s = 12 and c = 1500 then 'ok' else 'FALHA' end, s, c);
  if not (s = 12 and c = 1500) then v_fail := v_fail + 1; end if;
  select stock into s from public.products where id = pb.id;
  select cost_cents into c from public.product_costs where product_id = pb.id;
  v_log := v_log || format('[%s] item B: estoque %s (esperado 5), custo %s (esperado 800)' || E'\n', case when s = 5 and c = 800 then 'ok' else 'FALHA' end, s, c);
  if not (s = 5 and c = 800) then v_fail := v_fail + 1; end if;
  v_log := v_log || format('[%s] total da compra %s (esperado 19000)' || E'\n', case when pur.total_cents = 19000 and pur.expense_registered then 'ok' else 'FALHA' end, pur.total_cents);
  if not (pur.total_cents = 19000 and pur.expense_registered) then v_fail := v_fail + 1; end if;
  select count(*) into n from public.stock_movements where ref_type = 'compra' and ref_id = pur.id and type = 'entrada';
  v_log := v_log || format('[%s] movimentacoes de estoque da compra: %s (esperado 2)' || E'\n', case when n = 2 then 'ok' else 'FALHA' end, n);
  if n <> 2 then v_fail := v_fail + 1; end if;
  select count(*) into n from public.transactions where amount_cents = 19000 and category = 'Compra de mercadoria';
  v_log := v_log || format('[%s] despesa lancada no financeiro: %s (esperado 1)' || E'\n', case when n = 1 then 'ok' else 'FALHA' end, n);
  if n <> 1 then v_fail := v_fail + 1; end if;
  select count(*) into n from public.purchase_items where purchase_id = pur.id and prev_cost_cents in (1000, 500);
  v_log := v_log || format('[%s] itens guardam o custo anterior: %s (esperado 2)' || E'\n', case when n = 2 then 'ok' else 'FALHA' end, n);
  if n <> 2 then v_fail := v_fail + 1; end if;

  -- produto repetido: falha e nada muda (atomico)
  begin
    perform public.receive_goods(null, '', jsonb_build_array(
      jsonb_build_object('product_id', pa.id, 'qty', 3, 'unit_cost_cents', 100),
      jsonb_build_object('product_id', pa.id, 'qty', 3, 'unit_cost_cents', 100)));
    err := null;
  exception when others then err := sqlerrm; end;
  v_log := v_log || format('[%s] produto repetido recusado (%s)' || E'\n', case when err is not null then 'ok' else 'FALHA' end, coalesce(err, 'sem erro'));
  if err is null then v_fail := v_fail + 1; end if;

  -- quantidade zero e lista vazia
  begin
    perform public.receive_goods(null, '', jsonb_build_array(jsonb_build_object('product_id', pa.id, 'qty', 0, 'unit_cost_cents', 100)));
    err := null;
  exception when others then err := sqlerrm; end;
  v_log := v_log || format('[%s] quantidade zero recusada (%s)' || E'\n', case when err is not null then 'ok' else 'FALHA' end, coalesce(err, 'sem erro'));
  if err is null then v_fail := v_fail + 1; end if;
  begin
    perform public.receive_goods(null, '', '[]'::jsonb);
    err := null;
  exception when others then err := sqlerrm; end;
  v_log := v_log || format('[%s] lista vazia recusada (%s)' || E'\n', case when err is not null then 'ok' else 'FALHA' end, coalesce(err, 'sem erro'));
  if err is null then v_fail := v_fail + 1; end if;

  select stock into s from public.products where id = pa.id;
  v_log := v_log || format('[%s] estoque de A continua 12 apos as falhas (%s)' || E'\n', case when s = 12 then 'ok' else 'FALHA' end, s);
  if s <> 12 then v_fail := v_fail + 1; end if;

  -- registro imutavel
  begin
    update public.purchases set note = 'alterada' where id = pur.id;
    err := null;
  exception when others then err := sqlerrm; end;
  v_log := v_log || format('[%s] compra nao pode ser alterada (%s)' || E'\n', case when err is not null then 'ok' else 'FALHA' end, coalesce(err, 'sem erro'));
  if err is null then v_fail := v_fail + 1; end if;

  -- operador nao enxerga compras
  perform set_config('request.jwt.claims', json_build_object('sub', v_op, 'role', 'authenticated')::text, true);
  select count(*) into n from public.purchases;
  v_log := v_log || format('[%s] operador enxerga %s compras (esperado 0)' || E'\n', case when n = 0 then 'ok' else 'FALHA' end, n);
  if n <> 0 then v_fail := v_fail + 1; end if;

  raise exception using message = 'RESULTADO: ' || v_fail || ' falha(s)' || E'\n' || v_log;
end $$;
