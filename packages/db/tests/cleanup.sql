-- Remove os dados criados pelos testes (usuarios qa-*@example.com e dados operacionais).
-- ATENCAO: TRUNCATE apaga TODAS as vendas, produtos, caixas, clientes, fornecedores, lancamentos e logs.
-- Use somente enquanto o banco contiver apenas dados de teste. Nao apaga usuarios reais nem as configuracoes.
truncate table
  public.return_items, public.returns, public.sale_payments, public.sale_item_costs, public.sale_items,
  public.cash_movements, public.sales, public.cash_sessions, public.stock_movements,
  public.product_costs, public.products, public.audit_logs,
  public.clients, public.suppliers, public.transactions
restart identity cascade;

delete from auth.users where email like 'qa-%@example.com';
