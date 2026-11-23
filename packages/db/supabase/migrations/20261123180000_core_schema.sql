-- Tendencias MakeUp: schema central compartilhado por ADMIN e PDV.
-- Valores monetarios em centavos (integer). Nada de operacao financeira e apagado.

-- ---------------------------------------------------------------------------
-- Privilegios padrao: nada executavel/legivel por padrao
-- ---------------------------------------------------------------------------
alter default privileges in schema public revoke execute on functions from public, anon, authenticated;
alter default privileges in schema public revoke all on tables from anon;

-- ---------------------------------------------------------------------------
-- Tipos
-- ---------------------------------------------------------------------------
create type public.user_role as enum ('admin', 'operator');
create type public.sale_channel as enum ('presencial', 'ecommerce');
create type public.sale_status as enum ('pendente', 'paga', 'cancelada', 'devolvida_parcial', 'devolvida');
create type public.payment_method as enum ('dinheiro', 'pix', 'credito', 'debito');
create type public.stock_move_type as enum ('entrada', 'saida', 'ajuste', 'venda', 'cancelamento', 'devolucao');
create type public.stock_origin as enum ('admin', 'pdv', 'ecommerce', 'sistema');
create type public.cash_status as enum ('aberto', 'fechado');
create type public.cash_move_type as enum ('suprimento', 'sangria', 'devolucao');
create type public.tx_type as enum ('entrada', 'saida');

-- ---------------------------------------------------------------------------
-- Usuarios e configuracoes
-- ---------------------------------------------------------------------------
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null,
  role public.user_role not null default 'operator',
  active boolean not null default true,
  can_cancel_sales boolean not null default false,
  can_refund boolean not null default false,
  can_override_stock boolean not null default false,
  created_at timestamptz not null default now()
);

create table public.settings (
  id boolean primary key default true check (id),
  store_name text not null default 'Tendencias MakeUp',
  logo_url text,
  phone text not null default '',
  email text not null default '',
  address text not null default '',
  cnpj text not null default '',
  owner text not null default '',
  instagram text not null default '',
  default_min_stock integer not null default 5 check (default_min_stock >= 0),
  default_payment public.payment_method not null default 'pix',
  low_stock_alerts boolean not null default true,
  max_operator_discount_pct numeric(5,2) not null default 10 check (max_operator_discount_pct between 0 and 100),
  updated_at timestamptz not null default now()
);
insert into public.settings (id) values (true);

-- ---------------------------------------------------------------------------
-- Cadastros
-- ---------------------------------------------------------------------------
create table public.suppliers (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(trim(name)) >= 2),
  contact text not null default '',
  phone text not null default '',
  email text not null default '',
  notes text not null default '',
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.clients (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(trim(name)) >= 2),
  phone text not null default '',
  email text not null default '',
  created_at timestamptz not null default now()
);

create sequence public.product_sku_seq;
create sequence public.internal_barcode_seq;

create table public.products (
  id uuid primary key default gen_random_uuid(),
  sku text not null,
  barcode text,
  name text not null check (length(trim(name)) >= 2),
  category text not null default 'Outros',
  brand text not null default '',
  description text not null default '',
  price_cents integer not null check (price_cents > 0),
  stock integer not null default 0,
  min_stock integer not null default 5 check (min_stock >= 0),
  supplier_id uuid references public.suppliers(id) on delete set null,
  image_url text,
  active boolean not null default true,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index products_sku_key on public.products (lower(sku));
create unique index products_barcode_key on public.products (barcode) where barcode is not null;
create index products_name_idx on public.products (lower(name));

-- Custo e informacao financeira restrita: so administrador enxerga.
create table public.product_costs (
  product_id uuid primary key references public.products(id) on delete cascade,
  cost_cents integer not null default 0 check (cost_cents >= 0)
);

create table public.stock_movements (
  id bigint generated always as identity primary key,
  product_id uuid not null references public.products(id) on delete restrict,
  type public.stock_move_type not null,
  qty integer not null check (qty <> 0),
  stock_after integer not null,
  origin public.stock_origin not null,
  ref_type text,
  ref_id uuid,
  reason text,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now()
);
create index stock_movements_product_idx on public.stock_movements (product_id, created_at desc);

-- ---------------------------------------------------------------------------
-- Caixa
-- ---------------------------------------------------------------------------
create table public.cash_sessions (
  id uuid primary key default gen_random_uuid(),
  number bigint generated always as identity,
  opened_by uuid not null references public.profiles(id),
  opened_at timestamptz not null default now(),
  opening_cents integer not null check (opening_cents >= 0),
  opening_notes text not null default '',
  status public.cash_status not null default 'aberto',
  closed_by uuid references public.profiles(id),
  closed_at timestamptz,
  expected_cash_cents integer,
  counted_cash_cents integer,
  difference_cents integer,
  closing_notes text,
  summary jsonb
);
create unique index cash_sessions_one_open_per_user on public.cash_sessions (opened_by) where status = 'aberto';

create table public.cash_movements (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.cash_sessions(id),
  type public.cash_move_type not null,
  amount_cents integer not null check (amount_cents > 0),
  reason text not null,
  sale_id uuid,
  created_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now()
);
create index cash_movements_session_idx on public.cash_movements (session_id);

-- ---------------------------------------------------------------------------
-- Vendas
-- ---------------------------------------------------------------------------
create table public.sales (
  id uuid primary key default gen_random_uuid(),
  number bigint generated always as identity,
  channel public.sale_channel not null default 'presencial',
  origin public.stock_origin not null default 'pdv',
  status public.sale_status not null default 'pendente',
  session_id uuid references public.cash_sessions(id),
  operator_id uuid not null references public.profiles(id),
  client_id uuid references public.clients(id) on delete set null,
  subtotal_cents integer not null check (subtotal_cents > 0),
  discount_cents integer not null default 0 check (discount_cents >= 0),
  total_cents integer not null check (total_cents >= 0),
  created_at timestamptz not null default now(),
  paid_at timestamptz,
  cancelled_at timestamptz,
  cancelled_by uuid references public.profiles(id),
  cancel_reason text,
  constraint sales_total_ok check (total_cents = subtotal_cents - discount_cents and discount_cents <= subtotal_cents)
);
create index sales_created_idx on public.sales (created_at desc);
create index sales_session_idx on public.sales (session_id);
create index sales_status_idx on public.sales (status);
create index sales_operator_idx on public.sales (operator_id);

alter table public.cash_movements
  add constraint cash_movements_sale_fk foreign key (sale_id) references public.sales(id);

create table public.sale_items (
  id uuid primary key default gen_random_uuid(),
  sale_id uuid not null references public.sales(id),
  product_id uuid not null references public.products(id) on delete restrict,
  name text not null,
  sku text not null,
  barcode text,
  qty integer not null check (qty > 0),
  unit_price_cents integer not null check (unit_price_cents > 0),
  returned_qty integer not null default 0,
  constraint sale_items_returned_ok check (returned_qty between 0 and qty)
);
create index sale_items_sale_idx on public.sale_items (sale_id);
create index sale_items_product_idx on public.sale_items (product_id);

-- Custo do item no momento da venda (restrito ao administrador).
create table public.sale_item_costs (
  sale_item_id uuid primary key references public.sale_items(id),
  unit_cost_cents integer not null default 0 check (unit_cost_cents >= 0)
);

create table public.sale_payments (
  id uuid primary key default gen_random_uuid(),
  sale_id uuid not null references public.sales(id),
  method public.payment_method not null,
  amount_cents integer not null check (amount_cents > 0),   -- valor aplicado a venda
  received_cents integer not null check (received_cents >= amount_cents),
  change_cents integer not null default 0 check (change_cents >= 0),
  created_at timestamptz not null default now()
);
create index sale_payments_sale_idx on public.sale_payments (sale_id);

create table public.returns (
  id uuid primary key default gen_random_uuid(),
  sale_id uuid not null references public.sales(id),
  session_id uuid references public.cash_sessions(id),
  reason text not null,
  refund_method public.payment_method not null,
  refund_cents integer not null check (refund_cents >= 0),
  created_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now()
);
create index returns_sale_idx on public.returns (sale_id);

create table public.return_items (
  id uuid primary key default gen_random_uuid(),
  return_id uuid not null references public.returns(id),
  sale_item_id uuid not null references public.sale_items(id),
  qty integer not null check (qty > 0),
  restock boolean not null default true
);

-- Lancamentos financeiros manuais (despesas, aportes). Vendas entram automaticamente.
create table public.transactions (
  id uuid primary key default gen_random_uuid(),
  occurred_on date not null default current_date,
  type public.tx_type not null,
  category text not null,
  description text not null check (length(trim(description)) >= 3),
  amount_cents integer not null check (amount_cents > 0),
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now()
);

create table public.audit_logs (
  id bigint generated always as identity primary key,
  user_id uuid,
  action text not null,
  entity text not null,
  entity_id text,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index audit_logs_created_idx on public.audit_logs (created_at desc);

-- ---------------------------------------------------------------------------
-- Funcoes auxiliares de permissao (usadas pelas politicas RLS)
-- ---------------------------------------------------------------------------
create function public.is_staff() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles where id = auth.uid() and active)
$$;

create function public.is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((select role = 'admin' from public.profiles where id = auth.uid() and active), false)
$$;

-- p_perm: 'cancel' | 'refund' | 'override_stock'. Administrador tem todas.
create function public.has_perm(p_perm text) returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((
    select role = 'admin' or case p_perm
      when 'cancel' then can_cancel_sales
      when 'refund' then can_refund
      when 'override_stock' then can_override_stock
      else false end
    from public.profiles where id = auth.uid() and active
  ), false)
$$;

grant execute on function public.is_staff(), public.is_admin(), public.has_perm(text) to authenticated;

-- ---------------------------------------------------------------------------
-- Gatilhos de integridade
-- ---------------------------------------------------------------------------
-- Novo usuario do Auth -> perfil. O papel vem de app_metadata (so o servidor define).
-- Cadastro espontaneo (sem app_metadata.role) nasce INATIVO e sem acesso.
create function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, full_name, role, active)
  values (
    new.id,
    coalesce(nullif(new.raw_user_meta_data->>'full_name', ''), split_part(coalesce(new.email, 'usuario'), '@', 1)),
    coalesce((new.raw_app_meta_data->>'role')::public.user_role, 'operator'),
    (new.raw_app_meta_data ? 'role')
  );
  return new;
end $$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Codigo interno (EAN-13 com prefixo 2) e SKU automaticos.
create function public.ean13_with_check(p12 text) returns text
language plpgsql immutable as $$
declare s int := 0; i int;
begin
  for i in 1..12 loop
    s := s + substr(p12, i, 1)::int * case when i % 2 = 1 then 1 else 3 end;
  end loop;
  return p12 || ((10 - s % 10) % 10)::text;
end $$;

create function public.products_defaults() returns trigger
language plpgsql as $$
begin
  if new.barcode is not null and trim(new.barcode) = '' then new.barcode := null; end if;
  if new.barcode is null then
    new.barcode := public.ean13_with_check('2' || lpad(nextval('public.internal_barcode_seq')::text, 11, '0'));
  end if;
  if new.sku is null or trim(new.sku) = '' then
    new.sku := 'P' || lpad(nextval('public.product_sku_seq')::text, 5, '0');
  end if;
  return new;
end $$;

create trigger products_defaults_trg
  before insert on public.products
  for each row execute function public.products_defaults();

-- O estoque so muda por operacoes registradas (venda, ajuste, devolucao...).
create function public.products_guard() returns trigger
language plpgsql as $$
begin
  if new.stock is distinct from old.stock
     and coalesce(current_setting('app.stock_write', true), '0') <> '1' then
    raise exception 'O estoque só pode ser alterado por operações de estoque (venda, ajuste ou devolução).';
  end if;
  new.updated_at := now();
  return new;
end $$;

create trigger products_guard_trg
  before update on public.products
  for each row execute function public.products_guard();

create function public.products_audit() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.price_cents is distinct from old.price_cents
     or new.active is distinct from old.active
     or new.name is distinct from old.name then
    insert into public.audit_logs (user_id, action, entity, entity_id, details)
    values (auth.uid(), 'produto_alterado', 'products', new.id::text,
      jsonb_build_object('nome', new.name, 'preco_antes', old.price_cents, 'preco_depois', new.price_cents,
                         'ativo_antes', old.active, 'ativo_depois', new.active));
  end if;
  return new;
end $$;

create trigger products_audit_trg
  after update on public.products
  for each row execute function public.products_audit();

-- Registros financeiros e historicos nunca sao apagados.
create function public.forbid_delete() returns trigger
language plpgsql as $$
begin
  raise exception 'Registro de "%" não pode ser apagado (use cancelamento/arquivamento).', tg_table_name;
end $$;

create function public.forbid_update() returns trigger
language plpgsql as $$
begin
  raise exception 'Registro de "%" é imutável.', tg_table_name;
end $$;

do $$
declare t text;
begin
  foreach t in array array['sales','sale_items','sale_item_costs','sale_payments','returns','return_items',
                           'stock_movements','audit_logs','cash_sessions','cash_movements']
  loop
    execute format('create trigger %I before delete on public.%I for each row execute function public.forbid_delete()',
                   t || '_no_delete', t);
  end loop;
  foreach t in array array['stock_movements','audit_logs','cash_movements','sale_payments','return_items','returns']
  loop
    execute format('create trigger %I before update on public.%I for each row execute function public.forbid_update()',
                   t || '_no_update', t);
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array['profiles','settings','suppliers','clients','products','product_costs','stock_movements',
    'cash_sessions','cash_movements','sales','sale_items','sale_item_costs','sale_payments','returns','return_items',
    'transactions','audit_logs']
  loop
    execute format('alter table public.%I enable row level security', t);
  end loop;
end $$;

-- Escrita em tabelas operacionais so por funcoes (RPC): remove DML direto do papel authenticated.
revoke insert, update, delete on
  public.stock_movements, public.cash_sessions, public.cash_movements, public.sales, public.sale_items,
  public.sale_item_costs, public.sale_payments, public.returns, public.return_items, public.audit_logs
  from authenticated;

-- profiles
create policy profiles_select on public.profiles for select to authenticated
  using (id = auth.uid() or public.is_admin());
create policy profiles_admin_write on public.profiles for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- settings
create policy settings_select on public.settings for select to authenticated using (public.is_staff());
create policy settings_update on public.settings for update to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- suppliers (somente administrador)
create policy suppliers_admin on public.suppliers for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- clients
create policy clients_select on public.clients for select to authenticated using (public.is_staff());
create policy clients_insert on public.clients for insert to authenticated with check (public.is_staff());
create policy clients_update on public.clients for update to authenticated
  using (public.is_admin()) with check (public.is_admin());
create policy clients_delete on public.clients for delete to authenticated using (public.is_admin());

-- products: equipe ve ativos; administrador ve todos e edita. Insercao do PDV via create_product().
create policy products_select on public.products for select to authenticated
  using (public.is_staff() and (active or public.is_admin()));
create policy products_admin_insert on public.products for insert to authenticated with check (public.is_admin());
create policy products_admin_update on public.products for update to authenticated
  using (public.is_admin()) with check (public.is_admin());
create policy products_admin_delete on public.products for delete to authenticated using (public.is_admin());

create policy product_costs_admin on public.product_costs for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

create policy stock_movements_admin on public.stock_movements for select to authenticated using (public.is_admin());

-- caixa
create policy cash_sessions_select on public.cash_sessions for select to authenticated
  using (opened_by = auth.uid() or public.is_admin());
create policy cash_movements_select on public.cash_movements for select to authenticated
  using (public.is_admin() or exists (select 1 from public.cash_sessions s where s.id = session_id and s.opened_by = auth.uid()));

-- vendas: operador ve as proprias; administrador ve todas
create policy sales_select on public.sales for select to authenticated
  using (operator_id = auth.uid() or public.is_admin());
create policy sale_items_select on public.sale_items for select to authenticated
  using (exists (select 1 from public.sales s where s.id = sale_id));
create policy sale_payments_select on public.sale_payments for select to authenticated
  using (exists (select 1 from public.sales s where s.id = sale_id));
create policy returns_select on public.returns for select to authenticated
  using (exists (select 1 from public.sales s where s.id = sale_id));
create policy return_items_select on public.return_items for select to authenticated
  using (exists (select 1 from public.returns r where r.id = return_id));
create policy sale_item_costs_admin on public.sale_item_costs for select to authenticated using (public.is_admin());

-- financeiro e logs: so administrador
create policy transactions_admin on public.transactions for all to authenticated
  using (public.is_admin()) with check (public.is_admin());
create policy audit_logs_admin on public.audit_logs for select to authenticated using (public.is_admin());
