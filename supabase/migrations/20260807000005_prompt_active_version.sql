-- Versión activa del prompt por agente (la que usa n8n; no tiene por qué ser la
-- última creada) + permitir borrar versiones.
alter table public.dev_agents
  add column if not exists active_version int;

-- Permitir borrar versiones a quien tenga acceso al panel.
create policy "dev_prompt_versions_delete" on public.dev_prompt_versions
  for delete to authenticated
  using (
    exists (select 1 from public.user_profiles up where up.id = auth.uid() and up.role = 'superadmin')
    or exists (select 1 from public.user_tool_access ta where ta.user_id = auth.uid() and ta.tool_id = 'desarrollo' and ta.enabled)
  );

-- Permitir actualizar dev_agents (para fijar la versión activa) a quien tenga acceso.
create policy "dev_agents_update" on public.dev_agents
  for update to authenticated
  using (
    exists (select 1 from public.user_profiles up where up.id = auth.uid() and up.role = 'superadmin')
    or exists (select 1 from public.user_tool_access ta where ta.user_id = auth.uid() and ta.tool_id = 'desarrollo' and ta.enabled)
  )
  with check (
    exists (select 1 from public.user_profiles up where up.id = auth.uid() and up.role = 'superadmin')
    or exists (select 1 from public.user_tool_access ta where ta.user_id = auth.uid() and ta.tool_id = 'desarrollo' and ta.enabled)
  );
