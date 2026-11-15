-- Client profiles: turn each calendar client into a full client record
-- (contacts, business details, socials, package, dates, brand notes) plus a
-- running notes log. Additive only: new nullable/defaulted columns and one
-- new table. Only the server (service_role) reads or writes these tables.

alter table public.calendar_clients
  add column if not exists status         text not null default 'active',
  add column if not exists industry       text,
  add column if not exists email          text,
  add column if not exists phone          text,
  add column if not exists website        text,
  add column if not exists address        text,
  add column if not exists socials        jsonb not null default '{}'::jsonb,
  add column if not exists contacts       jsonb not null default '[]'::jsonb,
  add column if not exists package        text,
  add column if not exists monthly_rate   numeric(10,2),
  add column if not exists billing_notes  text,
  add column if not exists client_since   date,
  add column if not exists renews_on      date,
  add column if not exists dates          jsonb not null default '[]'::jsonb,
  add column if not exists brand_notes    text,
  add column if not exists drive_url      text,
  add column if not exists notes          text,
  add column if not exists updated_at     timestamptz not null default now();

do $$ begin
  alter table public.calendar_clients
    add constraint calendar_clients_status_check check (status in ('active', 'prospect', 'paused', 'past'));
exception when duplicate_object then null; end $$;

create table if not exists public.client_notes (
  id          uuid primary key default gen_random_uuid(),
  client_id   uuid not null references public.calendar_clients(id) on delete cascade,
  body        text not null check (char_length(body) between 1 and 4000),
  author      text,
  created_at  timestamptz not null default now()
);
create index if not exists client_notes_client_idx on public.client_notes(client_id, created_at desc);

alter table public.client_notes enable row level security;
grant select, insert, update, delete on public.client_notes to service_role;
