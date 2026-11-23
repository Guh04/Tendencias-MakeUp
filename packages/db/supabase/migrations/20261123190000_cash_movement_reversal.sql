-- Estorno de sangria/suprimento lancados por engano.
-- Movimentacoes nunca sao apagadas: o estorno cria um lancamento inverso, ligado ao original.

alter table public.cash_movements
  add column reverses_id uuid references public.cash_movements(id);

-- Um lancamento so pode ser estornado uma vez.
create unique index cash_movements_reversal_once on public.cash_movements (reverses_id) where reverses_id is not null;

create function public.reverse_cash_movement(p_movement_id uuid, p_reason text)
returns public.cash_movements language plpgsql security definer set search_path = public as $$
declare m public.cash_movements; s public.cash_sessions; v_row public.cash_movements;
begin
  if not public.is_admin() then
    raise exception 'Somente administrador pode estornar movimentações de caixa.' using errcode = '42501';
  end if;
  if length(trim(coalesce(p_reason, ''))) < 3 then raise exception 'Informe o motivo do estorno.'; end if;

  select * into m from public.cash_movements where id = p_movement_id for update;
  if not found then raise exception 'Movimentação não encontrada.'; end if;
  if m.type not in ('suprimento', 'sangria') then
    raise exception 'Somente sangria e suprimento podem ser estornados.';
  end if;
  if m.reverses_id is not null then raise exception 'Este lançamento já é um estorno.'; end if;
  if exists (select 1 from public.cash_movements where reverses_id = m.id) then
    raise exception 'Esta movimentação já foi estornada.';
  end if;

  select * into s from public.cash_sessions where id = m.session_id;
  if s.status <> 'aberto' then
    raise exception 'O caixa desta movimentação já foi fechado. Não é possível estornar.';
  end if;

  insert into public.cash_movements (session_id, type, amount_cents, reason, created_by, reverses_id)
  values (m.session_id,
          case m.type when 'sangria' then 'suprimento' else 'sangria' end::public.cash_move_type,
          m.amount_cents, 'Estorno: ' || trim(p_reason), auth.uid(), m.id)
  returning * into v_row;

  perform public._audit('caixa_movimentacao_estornada', 'cash_movements', m.id::text,
    jsonb_build_object('tipo_original', m.type, 'valor_cents', m.amount_cents, 'motivo', p_reason, 'caixa', s.number));
  return v_row;
end $$;

revoke execute on function public.reverse_cash_movement(uuid, text) from public, anon;
grant execute on function public.reverse_cash_movement(uuid, text) to authenticated;
