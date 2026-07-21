-- No existía policy de UPDATE para que un admin/superadmin edite el perfil
-- de otro usuario (rol, branch_ids...). Solo estaba "Users can update own
-- profile" (id = auth.uid()), por lo que editar a otro usuario desde el
-- panel no daba error pero tampoco actualizaba ninguna fila.
create policy "user_profiles_admin_update"
  on public.user_profiles for update
  to authenticated
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
