-- Client accounts: clients sign up (email or Google) through Supabase Auth.
-- Each account can open many rooms; we remember which rooms each client has.

create table if not exists public.clients (
  id            uuid primary key references auth.users(id) on delete cascade,
  email         text,
  full_name     text,
  avatar_url    text,
  provider      text,
  created_at    timestamptz not null default now(),
  last_seen_at  timestamptz
);

create table if not exists public.room_clients (
  room_id          uuid not null references public.rooms(id) on delete cascade,
  client_id        uuid not null references public.clients(id) on delete cascade,
  first_opened_at  timestamptz not null default now(),
  last_opened_at   timestamptz not null default now(),
  primary key (room_id, client_id)
);
create index if not exists room_clients_client_idx on public.room_clients(client_id, last_opened_at desc);

alter table public.comments add column if not exists client_id uuid references public.clients(id) on delete set null;
alter table public.activity add column if not exists client_id uuid references public.clients(id) on delete set null;
alter table public.files    add column if not exists reviewed_by_client uuid references public.clients(id) on delete set null;

alter table public.clients      enable row level security;
alter table public.room_clients enable row level security;

grant select, insert, update, delete on public.clients, public.room_clients to service_role;
