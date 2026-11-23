-- register_return() grava o valor do reembolso depois de somar os itens.
-- Usuarios logados nao tem UPDATE em returns (so SELECT), entao a protecao continua valendo.
drop trigger if exists returns_no_update on public.returns;
