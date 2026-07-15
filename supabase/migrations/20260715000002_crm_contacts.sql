create table crm.contacts (
  id uuid primary key default gen_random_uuid(),
  branch_id text not null references public.branches(branch_id),
  first_name text,
  last_name text,
  phone text,
  email text,
  custom_attributes jsonb not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_contacts_branch on crm.contacts(branch_id);
create index idx_contacts_phone on crm.contacts(phone);

create table crm.custom_field_definitions (
  id uuid primary key default gen_random_uuid(),
  key text unique not null,
  label text not null,
  field_type text not null check (field_type in ('text', 'number', 'list')),
  options jsonb,
  created_at timestamptz not null default now()
);

alter table crm.contacts enable row level security;
alter table crm.custom_field_definitions enable row level security;

create policy "authenticated_full_access_contacts"
on crm.contacts for all to authenticated using (true) with check (true);

create policy "authenticated_full_access_custom_fields"
on crm.custom_field_definitions for all to authenticated using (true) with check (true);

create or replace function crm.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end
$$;

create trigger trg_contacts_updated_at
before update on crm.contacts
for each row execute function crm.set_updated_at();
