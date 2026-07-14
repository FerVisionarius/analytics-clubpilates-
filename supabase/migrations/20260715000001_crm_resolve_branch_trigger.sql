create or replace function crm.resolve_branch_from_payload()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  centro text;
begin
  if new.branch_id is null then
    centro := new.raw_payload->'retell_llm_dynamic_variables'->>'centro';
    if centro is not null and centro <> '' then
      -- Coincidencia exacta con o sin el prefijo "Club Pilates"
      select b.branch_id into new.branch_id
      from public.branches b
      where lower(b.name) = lower('Club Pilates ' || centro)
         or lower(b.name) = lower(centro)
      limit 1;

      -- Fallback parcial, solo si hay exactamente una coincidencia
      if new.branch_id is null then
        select min(b.branch_id) into new.branch_id
        from public.branches b
        where b.name ilike '%' || centro || '%'
        having count(*) = 1;
      end if;
    end if;
  end if;
  return new;
end
$$;

drop trigger if exists trg_resolve_branch on crm.retell_calls;
create trigger trg_resolve_branch
before insert or update on crm.retell_calls
for each row execute function crm.resolve_branch_from_payload();
