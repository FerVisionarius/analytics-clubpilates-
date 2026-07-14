create or replace function public._debug_get_policies(tbl text)
returns table(policyname text, cmd text, qual text, with_check text)
language sql
security definer
set search_path = public
as $$
  select polname, polcmd::text,
    pg_get_expr(polqual, polrelid),
    pg_get_expr(polwithcheck, polrelid)
  from pg_policy
  join pg_class on pg_class.oid = pg_policy.polrelid
  where pg_class.relname = tbl;
$$;
