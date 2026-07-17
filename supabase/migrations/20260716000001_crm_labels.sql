create table crm.labels (
  id uuid primary key default gen_random_uuid(),
  name text unique not null,
  color text not null default '#71c4ef',
  created_at timestamptz not null default now()
);

create table crm.contact_labels (
  contact_id uuid not null references crm.contacts(id) on delete cascade,
  label_id uuid not null references crm.labels(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (contact_id, label_id)
);

alter table crm.labels enable row level security;
alter table crm.contact_labels enable row level security;

create policy "authenticated_full_access_labels"
on crm.labels for all to authenticated using (true) with check (true);

create policy "authenticated_full_access_contact_labels"
on crm.contact_labels for all to authenticated using (true) with check (true);
