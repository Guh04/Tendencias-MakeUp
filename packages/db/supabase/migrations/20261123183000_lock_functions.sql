-- Fecha o acesso a funcoes e tabelas para visitantes (anon) e expoe so a API de negocio.

revoke execute on all functions in schema public from public, anon, authenticated;
revoke all on all tables in schema public from anon;
revoke all on all sequences in schema public from anon;

alter default privileges for role postgres in schema public revoke execute on functions from public, anon, authenticated;

-- Auxiliares usadas pelas politicas RLS
grant execute on function public.is_staff(), public.is_admin(), public.has_perm(text) to authenticated;

-- API de negocio (cada funcao valida o papel do usuario)
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
