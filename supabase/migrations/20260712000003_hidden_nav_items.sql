alter table public.user_profiles
  add column if not exists hidden_nav_items text[] not null default '{}';

create or replace function public.get_my_profile()
 returns json
 language sql
 security definer
as $function$
  SELECT json_build_object(
    'id', id,
    'email', email,
    'full_name', full_name,
    'role', role,
    'branch_ids', branch_ids,
    'status', status,
    'hidden_nav_items', hidden_nav_items
  )
  FROM public.user_profiles
  WHERE id = auth.uid();
$function$;

drop function if exists public._debug_get_function_source(text);
drop function if exists public._debug_get_policies(text);
