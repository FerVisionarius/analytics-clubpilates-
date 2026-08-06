-- Agentes del panel de Desarrollo (dinámicos: se pueden crear desde el panel).
-- El id (slug) es la clave usada en dev_conversations.agent y dev_prompt_versions.agent.
create table if not exists public.dev_agents (
  id text primary key,
  name text not null,
  created_at timestamptz not null default now(),
  created_by uuid references public.user_profiles(id)
);

alter table public.dev_agents enable row level security;

create policy "dev_agents_select" on public.dev_agents
  for select to authenticated using (true);

create policy "dev_agents_insert" on public.dev_agents
  for insert to authenticated
  with check (
    exists (select 1 from public.user_profiles up where up.id = auth.uid() and up.role = 'superadmin')
    or exists (select 1 from public.user_tool_access ta where ta.user_id = auth.uid() and ta.tool_id = 'desarrollo' and ta.enabled)
  );

-- Agentes iniciales (conservan las claves ya usadas).
insert into public.dev_agents (id, name) values
  ('ventas', 'Venta clubes abiertos'),
  ('preventa', 'Preventa')
on conflict (id) do nothing;
