insert into public.role_permissions (role, item_id, enabled) values
  ('manager', 'crm', false),
  ('admin', 'crm', true),
  ('superadmin', 'crm', true)
on conflict (role, item_id) do nothing;
