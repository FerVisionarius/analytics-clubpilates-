-- Control de intentos de login por cuenta. Solo lo tocan las edge functions
-- (service_role); RLS activo sin políticas => ningún acceso desde el cliente.
create table if not exists public.login_lockouts (
  email text primary key,
  attempts int not null default 0,
  locked boolean not null default false,
  updated_at timestamptz not null default now()
);

alter table public.login_lockouts enable row level security;
