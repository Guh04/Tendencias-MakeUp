-- Teste do estorno de movimentacao de caixa. Roda numa transacao que SEMPRE desfaz tudo (ver phase6-rollback.sql).
do $$
declare
  v_admin uuid := gen_random_uuid();
  v_op uuid := gen_random_uuid();
  v_log text := '';
  v_fail int := 0;
  ses public.cash_sessions; mv public.cash_movements; rev public.cash_movements; smry jsonb; err text; v_exp int;
begin
  insert into auth.users (id, instance_id, aud, role, email, raw_app_meta_data, raw_user_meta_data)
  values (v_admin, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'qa-rv-admin@example.com', '{"role":"admin"}', '{"full_name":"RV Admin"}'),
         (v_op,    '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'qa-rv-op@example.com',    '{"role":"operator"}', '{"full_name":"RV Op"}');
  set local role authenticated;

  -- operador abre caixa e lanca uma sangria por engano
  perform set_config('request.jwt.claims', json_build_object('sub', v_op, 'role', 'authenticated')::text, true);
  ses := public.open_cash_session(10000, '');
  mv := public.add_cash_movement('sangria', 3000, 'lancada por engano');
  smry := public.cash_session_summary(ses.id);
  v_log := v_log || format('[%s] antes: esperado %s (100 - 30 = 7000 centavos)' || E'\n', case when (smry->>'expected_cash_cents')::int = 7000 then 'ok' else 'FALHA' end, smry->>'expected_cash_cents');
  if (smry->>'expected_cash_cents')::int <> 7000 then v_fail := v_fail + 1; end if;

  -- operador nao pode estornar
  begin
    perform public.reverse_cash_movement(mv.id, 'engano');
    err := null;
  exception when others then err := sqlerrm; end;
  v_log := v_log || format('[%s] operador nao estorna (%s)' || E'\n', case when err is not null then 'ok' else 'FALHA' end, coalesce(err, 'sem erro'));
  if err is null then v_fail := v_fail + 1; end if;

  -- administrador estorna: volta ao valor original
  perform set_config('request.jwt.claims', json_build_object('sub', v_admin, 'role', 'authenticated')::text, true);
  rev := public.reverse_cash_movement(mv.id, 'lancada por engano');
  perform set_config('request.jwt.claims', json_build_object('sub', v_op, 'role', 'authenticated')::text, true);
  smry := public.cash_session_summary(ses.id);
  v_exp := (smry->>'expected_cash_cents')::int;
  v_log := v_log || format('[%s] apos estorno: esperado %s (10000), lancamento inverso = %s, ligado ao original = %s' || E'\n',
    case when v_exp = 10000 and rev.type = 'suprimento' and rev.reverses_id = mv.id then 'ok' else 'FALHA' end, v_exp, rev.type, rev.reverses_id = mv.id);
  if not (v_exp = 10000 and rev.type = 'suprimento' and rev.reverses_id = mv.id) then v_fail := v_fail + 1; end if;

  -- nao estorna duas vezes, nem estorna um estorno
  perform set_config('request.jwt.claims', json_build_object('sub', v_admin, 'role', 'authenticated')::text, true);
  begin
    perform public.reverse_cash_movement(mv.id, 'de novo');
    err := null;
  exception when others then err := sqlerrm; end;
  v_log := v_log || format('[%s] estorno duplicado e recusado (%s)' || E'\n', case when err is not null then 'ok' else 'FALHA' end, coalesce(err, 'sem erro'));
  if err is null then v_fail := v_fail + 1; end if;
  begin
    perform public.reverse_cash_movement(rev.id, 'estorno do estorno');
    err := null;
  exception when others then err := sqlerrm; end;
  v_log := v_log || format('[%s] estornar um estorno e recusado (%s)' || E'\n', case when err is not null then 'ok' else 'FALHA' end, coalesce(err, 'sem erro'));
  if err is null then v_fail := v_fail + 1; end if;

  -- caixa fechado: nao estorna
  perform set_config('request.jwt.claims', json_build_object('sub', v_op, 'role', 'authenticated')::text, true);
  mv := public.add_cash_movement('suprimento', 500, 'reforco');
  perform public.close_cash_session(ses.id, 10500, '');
  perform set_config('request.jwt.claims', json_build_object('sub', v_admin, 'role', 'authenticated')::text, true);
  begin
    perform public.reverse_cash_movement(mv.id, 'tarde demais');
    err := null;
  exception when others then err := sqlerrm; end;
  v_log := v_log || format('[%s] caixa fechado nao permite estorno (%s)' || E'\n', case when err is not null then 'ok' else 'FALHA' end, coalesce(err, 'sem erro'));
  if err is null then v_fail := v_fail + 1; end if;

  raise exception using message = 'RESULTADO: ' || v_fail || ' falha(s)' || E'\n' || v_log;
end $$;
