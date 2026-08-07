-- Valores de las variables ({{$json...}}) detectadas en el prompt de cada agente.
-- Compartidos por agente; editables por quien tenga acceso al panel.
create table if not exists public.dev_agent_variables (
  agent text primary key,
  values jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.dev_agent_variables enable row level security;

create policy "dev_agent_variables_select" on public.dev_agent_variables
  for select to authenticated using (true);

create policy "dev_agent_variables_write" on public.dev_agent_variables
  for all to authenticated
  using (
    exists (select 1 from public.user_profiles up where up.id = auth.uid() and up.role = 'superadmin')
    or exists (select 1 from public.user_tool_access ta where ta.user_id = auth.uid() and ta.tool_id = 'desarrollo' and ta.enabled)
  )
  with check (
    exists (select 1 from public.user_profiles up where up.id = auth.uid() and up.role = 'superadmin')
    or exists (select 1 from public.user_tool_access ta where ta.user_id = auth.uid() and ta.tool_id = 'desarrollo' and ta.enabled)
  );
