-- Kindly Put delivery rooms: Phase 1 schema
-- Run this once in the Supabase SQL editor (or with `supabase db push`).

create extension if not exists pgcrypto;

-- Rooms --------------------------------------------------------------------
create table if not exists public.rooms (
  id            uuid primary key default gen_random_uuid(),
  slug          text not null unique,
  title         text not null,
  client_name   text not null,
  delivered_by  text not null default 'Kindly Put Studio',
  hero_file_id  uuid,
  theme_preset  text not null default 'studio',
  accent_color  text,
  status        text not null default 'live' check (status in ('draft', 'live', 'archived')),
  expires_at    timestamptz,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

-- Files --------------------------------------------------------------------
create table if not exists public.files (
  id             uuid primary key default gen_random_uuid(),
  room_id        uuid not null references public.rooms(id) on delete cascade,
  kind           text not null check (kind in ('image', 'video')),
  file_name      text not null,
  mime_type      text not null,
  original_path  text not null,
  preview_path   text,
  thumb_path     text,
  poster_path    text,
  width          int,
  height         int,
  duration       numeric,
  size_bytes     bigint,
  sort_order     int not null default 0,
  category       text,
  review_status  text not null default 'pending' check (review_status in ('pending', 'approved', 'changes')),
  reviewed_by    text,
  reviewed_at    timestamptz,
  created_at     timestamptz not null default now()
);
create index if not exists files_room_idx on public.files(room_id, sort_order);

alter table public.rooms
  drop constraint if exists rooms_hero_file_fk,
  add constraint rooms_hero_file_fk foreign key (hero_file_id)
    references public.files(id) on delete set null;

-- Comments -----------------------------------------------------------------
create table if not exists public.comments (
  id           uuid primary key default gen_random_uuid(),
  room_id      uuid not null references public.rooms(id) on delete cascade,
  file_id      uuid not null references public.files(id) on delete cascade,
  author_name  text not null,
  body         text not null check (char_length(body) between 1 and 2000),
  from_agency  boolean not null default false,
  created_at   timestamptz not null default now()
);
create index if not exists comments_file_idx on public.comments(file_id, created_at);

-- Activity (views, approvals, comments, downloads) -------------------------
create table if not exists public.activity (
  id          uuid primary key default gen_random_uuid(),
  room_id     uuid not null references public.rooms(id) on delete cascade,
  file_id     uuid references public.files(id) on delete set null,
  type        text not null check (type in ('view', 'approve', 'decline', 'reset', 'comment', 'download')),
  actor_name  text,
  viewer_id   text,
  created_at  timestamptz not null default now()
);
create index if not exists activity_room_idx on public.activity(room_id, created_at desc);

-- Brand settings (one row, edited from the admin in Phase 2) ---------------
create table if not exists public.settings (
  id            int primary key default 1 check (id = 1),
  agency_name   text not null default 'Kindly Put Studio',
  logo_path     text,
  brand_colors  jsonb not null default '{}'::jsonb,
  default_theme text not null default 'studio',
  updated_at    timestamptz not null default now()
);
insert into public.settings (id) values (1) on conflict do nothing;

-- Admin accounts (studio team) -------------------------------------------
-- Passwords are stored as scrypt hashes, never in plain text.
-- Add a teammate with: node scripts/hash-password.mjs "their-password"
-- then insert the printed hash (see README).
create table if not exists public.admin_users (
  id             uuid primary key default gen_random_uuid(),
  username       text not null,
  display_name   text not null,
  password_hash  text not null,
  role           text not null default 'super_admin' check (role in ('super_admin', 'admin')),
  created_at     timestamptz not null default now(),
  last_login_at  timestamptz
);
create unique index if not exists admin_users_username_idx on public.admin_users (lower(username));

-- Security -----------------------------------------------------------------
-- Row level security is on with no public policies: browsers can never read
-- or write these tables directly. The Next.js server uses the secret key and
-- checks the room slug (client) or the admin session (you) on every request.
alter table public.rooms    enable row level security;
alter table public.files    enable row level security;
alter table public.comments enable row level security;
alter table public.activity enable row level security;
alter table public.settings enable row level security;
alter table public.admin_users enable row level security;

-- Only the server's secret key (service_role) gets table access. Projects
-- created with "Automatically expose new tables" off need this grant.
grant usage on schema public to service_role;
grant select, insert, update, delete on all tables in schema public to service_role;
grant usage, select on all sequences in schema public to service_role;
alter default privileges in schema public grant select, insert, update, delete on tables to service_role;
alter default privileges in schema public grant usage, select on sequences to service_role;

-- Storage ------------------------------------------------------------------
-- previews: web-sized photos, thumbnails, and video posters (public, CDN cached,
--           random file names). originals: full-resolution files (private,
--           served only through short-lived signed links).
insert into storage.buckets (id, name, public)
values ('previews', 'previews', true), ('originals', 'originals', false)
on conflict (id) do nothing;
