-- Accesos a herramientas por usuario (además del control por rol).
-- Empieza con la herramienta 'desarrollo' (developer.clubpilatesia.es), pero
-- es genérica para futuras webs internas.
create table if not exists public.user_tool_access (
  id bigint generated always as identity primary key,
  user_id uuid not null references public.user_profiles(id) on delete cascade,
  tool_id text not null,
  enabled boolean not null default true,
  created_at timestamptz not null default now(),
  unique (user_id, tool_id)
);

alter table public.user_tool_access enable row level security;

-- El usuario ve su propio acceso; admin/superadmin ven todos.
create policy "user_tool_access_select" on public.user_tool_access
  for select to authenticated
  using (
    user_id = auth.uid()
    or exists (
      select 1 from public.user_profiles up
      where up.id = auth.uid() and up.role in ('admin', 'superadmin')
    )
  );

-- Solo admin/superadmin gestionan los accesos.
create policy "user_tool_access_write" on public.user_tool_access
  for all to authenticated
  using (
    exists (
      select 1 from public.user_profiles up
      where up.id = auth.uid() and up.role in ('admin', 'superadmin')
    )
  )
  with check (
    exists (
      select 1 from public.user_profiles up
      where up.id = auth.uid() and up.role in ('admin', 'superadmin')
    )
  );
