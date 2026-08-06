-- Ajustes globales clave/valor (p. ej. el webhook del panel de Desarrollo).
-- Lectura para cualquier usuario autenticado; escritura solo superadmin.
create table if not exists public.app_settings (
  key text primary key,
  value text,
  updated_at timestamptz not null default now()
);

alter table public.app_settings enable row level security;

create policy "app_settings_select" on public.app_settings
  for select to authenticated
  using (true);

create policy "app_settings_write" on public.app_settings
  for all to authenticated
  using (
    exists (
      select 1 from public.user_profiles up
      where up.id = auth.uid() and up.role = 'superadmin'
    )
  )
  with check (
    exists (
      select 1 from public.user_profiles up
      where up.id = auth.uid() and up.role = 'superadmin'
    )
  );
