alter table crm.retell_calls
  add column if not exists branch_id text;

create index if not exists idx_retell_calls_branch on crm.retell_calls(branch_id);

drop policy if exists "authenticated_read_calls" on crm.retell_calls;

create policy "branch_scoped_calls"
on crm.retell_calls for select to authenticated
using (
  exists (
    select 1 from public.user_profiles up
    where up.id = auth.uid()
    and (up.role in ('admin', 'superadmin') or crm.retell_calls.branch_id = any(up.branch_ids))
  )
);
