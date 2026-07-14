create table if not exists public.role_permissions (
  role text not null,
  item_id text not null,
  enabled boolean not null default true,
  primary key (role, item_id)
);

alter table public.role_permissions enable row level security;

create policy "role_permissions_select_authenticated"
  on public.role_permissions for select
  to authenticated
  using (true);

create policy "role_permissions_write_superadmin"
  on public.role_permissions for all
  to authenticated
  using (exists (select 1 from public.user_profiles where id = auth.uid() and role = 'superadmin'))
  with check (exists (select 1 from public.user_profiles where id = auth.uid() and role = 'superadmin'));

insert into public.role_permissions (role, item_id, enabled) values
  ('manager', 'ocupacion', true),
  ('manager', 'instructores', true),
  ('manager', 'valoraciones', true),
  ('manager', 'miembros', false),
  ('manager', 'retencion', true),
  ('manager', 'laserr', true),
  ('manager', 'ocupacion-promedio', false),
  ('manager', 'usuarios', false),
  ('manager', 'informes', false),
  ('manager', 'ajustes', false),
  ('admin', 'ocupacion', true),
  ('admin', 'instructores', true),
  ('admin', 'valoraciones', true),
  ('admin', 'miembros', true),
  ('admin', 'retencion', true),
  ('admin', 'laserr', true),
  ('admin', 'ocupacion-promedio', true),
  ('admin', 'usuarios', true),
  ('admin', 'informes', true),
  ('admin', 'ajustes', true),
  ('superadmin', 'ocupacion', true),
  ('superadmin', 'instructores', true),
  ('superadmin', 'valoraciones', true),
  ('superadmin', 'miembros', true),
  ('superadmin', 'retencion', true),
  ('superadmin', 'laserr', true),
  ('superadmin', 'ocupacion-promedio', true),
  ('superadmin', 'usuarios', true),
  ('superadmin', 'informes', true),
  ('superadmin', 'ajustes', true)
on conflict (role, item_id) do nothing;
