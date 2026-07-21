-- La policy original comparaba el id del usuario contra branch_ids (nunca coincide),
-- por lo que managers no veían ningún centro. Debe comparar el branch_id de la fila.
drop policy if exists "branches_authenticated" on public.branches;

create policy "branches_authenticated"
  on public.branches for select
  to authenticated
  using (
    exists (
      select 1 from public.user_profiles up
      where up.id = auth.uid()
      and (
        up.role = any (array['admin', 'superadmin'])
        or branches.branch_id = any (up.branch_ids)
      )
    )
  );
