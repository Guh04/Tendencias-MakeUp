-- Permissoes de tabela para usuarios logados. O RLS decide QUAIS linhas cada um ve/altera;
-- aqui so concedemos o tipo de operacao. Tabelas operacionais sao somente leitura (escrita via RPC).

grant select, insert, update, delete on
  public.suppliers, public.clients, public.products, public.product_costs, public.transactions, public.profiles
to authenticated;

grant select, update on public.settings to authenticated;

grant select on
  public.stock_movements, public.cash_sessions, public.cash_movements, public.sales, public.sale_items,
  public.sale_item_costs, public.sale_payments, public.returns, public.return_items, public.audit_logs
to authenticated;

-- Garante o mesmo para a chave de servico (usada apenas em servidor).
grant all on all tables in schema public to service_role;
grant all on all sequences in schema public to service_role;
grant execute on all functions in schema public to service_role;
