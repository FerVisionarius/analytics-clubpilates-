-- Versionado del prompt por agente. Cada "Guardar" inserta una versión nueva
-- (V1, V2, V3...). n8n lee la última (o la que se elija) por agente.
create table if not exists public.dev_prompt_versions (
  id bigint generated always as identity primary key,
  agent text not null,
  version int not null,
  prompt text not null default '',
  created_at timestamptz not null default now(),
  created_by uuid references public.user_profiles(id),
  unique (agent, version)
);

alter table public.dev_prompt_versions enable row level security;

create policy "dev_prompt_versions_select" on public.dev_prompt_versions
  for select to authenticated using (true);

-- Solo quien tiene acceso al panel (superadmin o acceso explícito) crea versiones.
create policy "dev_prompt_versions_insert" on public.dev_prompt_versions
  for insert to authenticated
  with check (
    exists (select 1 from public.user_profiles up where up.id = auth.uid() and up.role = 'superadmin')
    or exists (select 1 from public.user_tool_access ta where ta.user_id = auth.uid() and ta.tool_id = 'desarrollo' and ta.enabled)
  );

-- Índice para leer rápido la última versión de cada agente.
create index if not exists dev_prompt_versions_agent_version_idx
  on public.dev_prompt_versions (agent, version desc);
