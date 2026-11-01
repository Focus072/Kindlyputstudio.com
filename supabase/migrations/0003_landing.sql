-- Landing page: rooms can be featured in the public "Recent work" showcase,
-- and the "Start a project" form saves leads for the admin.

alter table public.rooms add column if not exists showcase boolean not null default true;

create table if not exists public.leads (
  id          uuid primary key default gen_random_uuid(),
  name        text not null check (char_length(name) between 1 and 80),
  business    text check (char_length(business) <= 120),
  email       text not null check (char_length(email) between 3 and 160),
  phone       text check (char_length(phone) <= 40),
  service     text check (char_length(service) <= 60),
  message     text check (char_length(message) <= 2000),
  status      text not null default 'new' check (status in ('new', 'contacted', 'won', 'closed')),
  created_at  timestamptz not null default now()
);
create index if not exists leads_created_idx on public.leads(created_at desc);

alter table public.leads enable row level security;
grant select, insert, update, delete on public.leads to service_role;
