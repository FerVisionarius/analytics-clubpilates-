create or replace function public._debug_get_function_source(fn_name text)
returns text
language sql
security definer
set search_path = public
as $$
  select pg_get_functiondef(oid) from pg_proc where proname = fn_name limit 1;
$$;
