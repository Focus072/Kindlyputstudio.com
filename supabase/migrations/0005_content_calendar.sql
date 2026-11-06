-- Content calendar: one color per client, posts pulled from Buffer, plus
-- posts added by hand (ideas, drafts, things scheduled outside Buffer).
-- Only the server (service_role) reads or writes these tables.

create table if not exists public.calendar_clients (
  id          uuid primary key default gen_random_uuid(),
  name        text not null check (char_length(name) between 1 and 60),
  color       text not null check (color ~ '^#[0-9a-fA-F]{6}$'),
  created_at  timestamptz not null default now()
);

create table if not exists public.calendar_posts (
  id            uuid primary key default gen_random_uuid(),
  client_id     uuid references public.calendar_clients(id) on delete set null,
  scheduled_at  timestamptz not null,
  platform      text not null default 'instagram' check (char_length(platform) <= 30),
  caption       text check (char_length(caption) <= 5000),
  notes         text check (char_length(notes) <= 2000),
  status        text not null default 'scheduled' check (status in ('idea', 'draft', 'scheduled', 'posted')),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index if not exists calendar_posts_when_idx on public.calendar_posts(scheduled_at);

-- Buffer channels we have seen, and which client each one belongs to.
create table if not exists public.buffer_channels (
  id               text primary key,
  organization_id  text not null,
  name             text not null,
  service          text not null,
  avatar           text,
  client_id        uuid references public.calendar_clients(id) on delete set null,
  updated_at       timestamptz not null default now()
);

-- Small key/value store for settings such as the Buffer API key.
create table if not exists public.app_settings (
  key         text primary key,
  value       text not null,
  updated_at  timestamptz not null default now()
);

alter table public.calendar_clients enable row level security;
alter table public.calendar_posts   enable row level security;
alter table public.buffer_channels  enable row level security;
alter table public.app_settings     enable row level security;

grant select, insert, update, delete
  on public.calendar_clients, public.calendar_posts, public.buffer_channels, public.app_settings
  to service_role;
