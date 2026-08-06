-- Panel de Desarrollo: prompts por agente (compartidos, editables por quien
-- tenga acceso al panel) y conversaciones guardadas por usuario y agente.

-- Condición reutilizable: tener acceso al panel de desarrollo.
-- (superadmin siempre, o acceso explícito en user_tool_access)

create table if not exists public.dev_agent_prompts (
  agent text primary key,
  prompt text,
  updated_at timestamptz not null default now()
);

alter table public.dev_agent_prompts enable row level security;

create policy "dev_agent_prompts_select" on public.dev_agent_prompts
  for select to authenticated using (true);

create policy "dev_agent_prompts_write" on public.dev_agent_prompts
  for all to authenticated
  using (
    exists (select 1 from public.user_profiles up where up.id = auth.uid() and up.role = 'superadmin')
    or exists (select 1 from public.user_tool_access ta where ta.user_id = auth.uid() and ta.tool_id = 'desarrollo' and ta.enabled)
  )
  with check (
    exists (select 1 from public.user_profiles up where up.id = auth.uid() and up.role = 'superadmin')
    or exists (select 1 from public.user_tool_access ta where ta.user_id = auth.uid() and ta.tool_id = 'desarrollo' and ta.enabled)
  );

create table if not exists public.dev_conversations (
  user_id uuid not null references public.user_profiles(id) on delete cascade,
  agent text not null,
  messages jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now(),
  primary key (user_id, agent)
);

alter table public.dev_conversations enable row level security;

-- Cada usuario gestiona solo sus propias conversaciones.
create policy "dev_conversations_own" on public.dev_conversations
  for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());
