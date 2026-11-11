-- Share links: open a room without creating an account. Additive only.
-- Each link is a long random token. The studio can make several per room
-- (one per person), set them to expire, make them view only, and revoke them.

create table if not exists public.room_share_links (
  id              uuid primary key default gen_random_uuid(),
  room_id         uuid not null references public.rooms(id) on delete cascade,
  token           text not null unique check (char_length(token) between 20 and 100),
  label           text check (label is null or char_length(label) <= 80),
  can_review      boolean not null default true,
  expires_at      timestamptz,
  revoked_at      timestamptz,
  open_count      int not null default 0,
  last_opened_at  timestamptz,
  created_at      timestamptz not null default now()
);
create index if not exists room_share_links_room_idx on public.room_share_links(room_id, created_at desc);

alter table public.room_share_links enable row level security;
grant select, insert, update, delete on public.room_share_links to service_role;
