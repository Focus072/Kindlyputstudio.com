-- Review upgrades: guest lists, feedback rounds, versions, timestamped notes,
-- sets and captions, download controls, pay link, rate limits, studio settings.
-- Every change is additive, so it is safe to run before the new code ships.

-- Rooms --------------------------------------------------------------------
alter table public.rooms
  add column if not exists access_mode text not null default 'link'
    check (access_mode in ('link', 'invited')),
  add column if not exists layout text not null default 'grid'
    check (layout in ('grid', 'natural')),
  add column if not exists downloads text not null default 'on'
    check (downloads in ('on', 'approved', 'off')),
  add column if not exists watermark boolean not null default false,
  add column if not exists payment_url text check (payment_url is null or char_length(payment_url) <= 500),
  add column if not exists payment_status text not null default 'none'
    check (payment_status in ('none', 'due', 'paid')),
  add column if not exists intro text check (intro is null or char_length(intro) <= 600),
  add column if not exists feedback_sent_at timestamptz;

-- Guest list: when access_mode = 'invited', only these emails can open the room.
create table if not exists public.room_invites (
  room_id     uuid not null references public.rooms(id) on delete cascade,
  email       text not null check (char_length(email) between 3 and 160),
  created_at  timestamptz not null default now(),
  primary key (room_id, email)
);

-- Someone signed in with the link but is not on the guest list.
create table if not exists public.access_requests (
  id          uuid primary key default gen_random_uuid(),
  room_id     uuid not null references public.rooms(id) on delete cascade,
  client_id   uuid references public.clients(id) on delete cascade,
  email       text,
  name        text,
  status      text not null default 'pending' check (status in ('pending', 'approved', 'denied')),
  created_at  timestamptz not null default now(),
  unique (room_id, client_id)
);

-- Files: captions, versions -------------------------------------------------
alter table public.files
  add column if not exists caption text check (caption is null or char_length(caption) <= 500),
  add column if not exists version int not null default 1,
  add column if not exists replaced_by uuid references public.files(id) on delete set null;
create index if not exists files_replaced_idx on public.files(replaced_by);

-- Comments: point in a video, in seconds ------------------------------------
alter table public.comments add column if not exists timecode numeric;

-- Activity: feedback rounds and access requests -----------------------------
alter table public.activity drop constraint if exists activity_type_check;
alter table public.activity add constraint activity_type_check
  check (type in ('view', 'approve', 'decline', 'reset', 'comment', 'download', 'submit', 'access_request'));

-- Studio: when each admin last read the activity feed ------------------------
alter table public.admin_users add column if not exists activity_seen_at timestamptz;

-- Studio settings edited from the admin -------------------------------------
alter table public.settings
  add column if not exists delivered_by text,
  add column if not exists powered_by_label text,
  add column if not exists contact_email text;

-- Simple rate limits (login, sign-up form, comments) -------------------------
create table if not exists public.rate_events (
  id          bigint generated always as identity primary key,
  key         text not null,
  created_at  timestamptz not null default now()
);
create index if not exists rate_events_key_idx on public.rate_events(key, created_at desc);

alter table public.room_invites    enable row level security;
alter table public.access_requests enable row level security;
alter table public.rate_events     enable row level security;
grant select, insert, update, delete on public.room_invites, public.access_requests, public.rate_events to service_role;
grant usage, select on all sequences in schema public to service_role;
