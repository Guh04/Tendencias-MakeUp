-- Teste de caixa/devolucao/fechamento DENTRO de uma transacao que SEMPRE desfaz tudo (ROLLBACK forcado).
-- O resultado vem na mensagem de erro final: "RESULTADO: ..." (isso e esperado e prova o rollback).
-- Uso: supabase db query --remote --yes -f tests/phase6-rollback.sql   (nao deixa dados no banco)
do $$
declare
  v_admin uuid := gen_random_uuid();
  v_op uuid := gen_random_uuid();
  v_log text := '';
  v_fail int := 0;
  p public.products; s1 public.sales; s2 public.sales; ses public.cash_sessions; smry jsonb; closed public.cash_sessions;
  it uuid; rt public.returns; err text;

begin
  -- usuarios de teste (o gatilho cria os perfis)
  insert into auth.users (id, instance_id, aud, role, email, raw_app_meta_data, raw_user_meta_data)
  values (v_admin, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'qa-rb-admin@example.com', '{"role":"admin"}', '{"full_name":"RB Admin"}'),
         (v_op,    '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'qa-rb-op@example.com',    '{"role":"operator"}', '{"full_name":"RB Operador"}');
  update public.profiles set can_refund = true where id = v_op;   -- operador pode devolver, nao cancelar

  set local role authenticated;

  -- 1) admin cria produto
  perform set_config('request.jwt.claims', json_build_object('sub', v_admin, 'role', 'authenticated')::text, true);
  p := public.create_product('RB Produto', '', 'Batons', 2000, 5000, 10, '', null, 'RB', null, 2, null, 'admin');
  v_log := v_log || format('[%s] produto criado com estoque 10' || E'\n', case when p.stock = 10 then 'ok' else 'FALHA' end);
  if p.stock <> 10 then v_fail := v_fail + 1; end if;

  -- 2) operador abre caixa e faz sangria/suprimento
  perform set_config('request.jwt.claims', json_build_object('sub', v_op, 'role', 'authenticated')::text, true);
  ses := public.open_cash_session(10000, 'teste');
  perform public.add_cash_movement('suprimento', 3000, 'reforco de troco');
  perform public.add_cash_movement('sangria', 1000, 'deposito');
  begin
    perform public.add_cash_movement('sangria', 500, '');
    err := null;
  exception when others then err := sqlerrm; end;
  v_log := v_log || format('[%s] sangria sem motivo e recusada (%s)' || E'\n', case when err is not null then 'ok' else 'FALHA' end, coalesce(err, 'sem erro'));
  if err is null then v_fail := v_fail + 1; end if;

  -- 3) duas vendas: dinheiro (com troco) e pix
  s1 := public.checkout_sale(jsonb_build_array(jsonb_build_object('product_id', p.id, 'qty', 2)),
                             '[{"method":"dinheiro","amount_cents":10000,"received_cents":12000}]'::jsonb, 0, null, 'presencial', true, 'pdv', false);
  s2 := public.checkout_sale(jsonb_build_array(jsonb_build_object('product_id', p.id, 'qty', 1)),
                             '[{"method":"pix","amount_cents":5000}]'::jsonb, 0, null, 'presencial', true, 'pdv', false);

  -- 4) devolucao de 1 unidade da venda em dinheiro, reembolso em dinheiro (operador com permissao)
  select id into it from public.sale_items where sale_id = s1.id;
  rt := public.register_return(s1.id, jsonb_build_array(jsonb_build_object('sale_item_id', it, 'qty', 1, 'restock', true)), 'cliente desistiu', 'dinheiro');
  v_log := v_log || format('[%s] devolucao em dinheiro = R$ 50,00 (%s)' || E'\n', case when rt.refund_cents = 5000 then 'ok' else 'FALHA' end, rt.refund_cents);
  if rt.refund_cents <> 5000 then v_fail := v_fail + 1; end if;

  -- 5) operador sem permissao nao cancela
  begin
    perform public.cancel_sale(s2.id, 'teste');
    err := null;
  exception when others then err := sqlerrm; end;
  v_log := v_log || format('[%s] operador sem permissao nao cancela (%s)' || E'\n', case when err is not null then 'ok' else 'FALHA' end, coalesce(err, 'sem erro'));
  if err is null then v_fail := v_fail + 1; end if;

  -- 6) resumo: esperado = 10000 + 10000(dinheiro) + 3000 - 1000 - 5000 = 17000
  smry := public.cash_session_summary(ses.id);
  v_log := v_log || format('[%s] dinheiro esperado = 17000 (%s) | dinheiro %s | pix %s | suprimento %s | sangria %s | devolucao em dinheiro %s' || E'\n',
    case when (smry->>'expected_cash_cents')::int = 17000 then 'ok' else 'FALHA' end,
    smry->>'expected_cash_cents', smry->>'cash_cents', smry->>'pix_cents', smry->>'supplies_cents', smry->>'withdrawals_cents', smry->>'cash_refunds_cents');
  if (smry->>'expected_cash_cents')::int <> 17000 then v_fail := v_fail + 1; end if;

  -- 7) fechamento: contado 16500 -> diferenca -500; duplicado recusado
  closed := public.close_cash_session(ses.id, 16500, 'faltou troco');
  v_log := v_log || format('[%s] fechamento: status %s, diferenca %s' || E'\n', case when closed.status = 'fechado' and closed.difference_cents = -500 then 'ok' else 'FALHA' end, closed.status, closed.difference_cents);
  if not (closed.status = 'fechado' and closed.difference_cents = -500) then v_fail := v_fail + 1; end if;
  begin
    perform public.close_cash_session(ses.id, 0, '');
    err := null;
  exception when others then err := sqlerrm; end;
  v_log := v_log || format('[%s] fechar de novo e recusado (%s)' || E'\n', case when err is not null then 'ok' else 'FALHA' end, coalesce(err, 'sem erro'));
  if err is null then v_fail := v_fail + 1; end if;

  -- 8) depois de fechar, nao vende sem abrir outro caixa
  begin
    perform public.checkout_sale(jsonb_build_array(jsonb_build_object('product_id', p.id, 'qty', 1)),
                                 '[{"method":"pix","amount_cents":5000}]'::jsonb, 0, null, 'presencial', true, 'pdv', false);
    err := null;
  exception when others then err := sqlerrm; end;
  v_log := v_log || format('[%s] sem caixa aberto nao vende (%s)' || E'\n', case when err is not null then 'ok' else 'FALHA' end, coalesce(err, 'sem erro'));
  if err is null then v_fail := v_fail + 1; end if;

  -- 9) estoque: 10 - 2 - 1 + 1 (devolvido) = 8
  perform set_config('request.jwt.claims', json_build_object('sub', v_admin, 'role', 'authenticated')::text, true);
  select * into p from public.products where id = p.id;
  v_log := v_log || format('[%s] estoque final = 8 (%s)' || E'\n', case when p.stock = 8 then 'ok' else 'FALHA' end, p.stock);
  if p.stock <> 8 then v_fail := v_fail + 1; end if;

  -- forca rollback total e devolve o relatorio na mensagem
  raise exception 'RESULTADO: % falha(s)' || E'\n%', v_fail, v_log;
end $$;
