create or replace function crm.ensure_agent_exists()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.agent_id is not null then
    insert into crm.retell_agents (agent_id, name)
    values (new.agent_id, coalesce(nullif(new.raw_payload->>'agent_name', ''), new.agent_id))
    on conflict (agent_id) do nothing;
  end if;
  return new;
end
$$;

drop trigger if exists trg_ensure_agent on crm.retell_calls;
create trigger trg_ensure_agent
before insert or update on crm.retell_calls
for each row execute function crm.ensure_agent_exists();
