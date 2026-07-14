grant usage on schema crm to authenticated, service_role;

grant select, insert, update, delete on all tables in schema crm to authenticated, service_role;

alter default privileges in schema crm
  grant select, insert, update, delete on tables to authenticated, service_role;
