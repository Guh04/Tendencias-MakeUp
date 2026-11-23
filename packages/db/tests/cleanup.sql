-- Remove os dados criados por tests/integration.mjs (usuarios qa-*@example.com e todos os dados operacionais).
-- ATENCAO: TRUNCATE apaga TODAS as vendas, produtos, caixas e logs. Use somente enquanto o banco for de teste.
truncate table
  public.return_items, public.returns, public.sale_payments, public.sale_item_costs, public.sale_items,
  public.cash_movements, public.sales, public.cash_sessions, public.stock_movements,
  public.product_costs, public.products, public.audit_logs
restart identity cascade;

delete from auth.users where email like 'qa-%@example.com';
