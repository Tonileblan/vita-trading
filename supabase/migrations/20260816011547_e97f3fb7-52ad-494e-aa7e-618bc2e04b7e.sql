alter table public.accounts add column if not exists broker text;
comment on column public.accounts.broker is 'Broker usado en cuentas personales (type=personal). NULL para cuentas de fondeo.';