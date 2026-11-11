-- Client calendar: each calendar client can get a private share link
-- (no account needed) that shows their upcoming and past posts, plus a
-- shared Ideas board the studio and the client both add to. Additive only.
-- Only the server (service_role) reads or writes these tables.

alter table public.calendar_clients
  add column if not exists share_token      text unique,
  add column if not exists share_created_at timestamptz,
  add column if not exists share_viewed_at  timestamptz;

create table if not exists public.calendar_ideas (
  id            uuid primary key default gen_random_uuid(),
  client_id     uuid not null references public.calendar_clients(id) on delete cascade,
  title         text not null check (char_length(title) between 1 and 140),
  body          text check (char_length(body) <= 4000),
  link          text check (char_length(link) <= 600),
  platform      text check (char_length(platform) <= 30),
  target_date   date,
  status        text not null default 'new' check (status in ('new', 'planned', 'scheduled', 'done', 'archived')),
  author_name   text check (char_length(author_name) <= 80),
  author_role   text not null default 'studio' check (author_role in ('studio', 'client')),
  post_id       uuid references public.calendar_posts(id) on delete set null,
  scheduled_at  timestamptz,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index if not exists calendar_ideas_client_idx on public.calendar_ideas(client_id, status, created_at desc);

-- Comments on an idea, or on a post the client sees on their calendar
-- (post_key is a calendar_posts id or "buffer-<id>").
create table if not exists public.calendar_comments (
  id           uuid primary key default gen_random_uuid(),
  client_id    uuid not null references public.calendar_clients(id) on delete cascade,
  idea_id      uuid references public.calendar_ideas(id) on delete cascade,
  post_key     text check (char_length(post_key) <= 120),
  body         text not null check (char_length(body) between 1 and 2000),
  author_name  text check (char_length(author_name) <= 80),
  author_role  text not null default 'client' check (author_role in ('studio', 'client')),
  created_at   timestamptz not null default now(),
  check (idea_id is not null or post_key is not null)
);
create index if not exists calendar_comments_idea_idx on public.calendar_comments(idea_id, created_at);
create index if not exists calendar_comments_post_idx on public.calendar_comments(client_id, post_key, created_at);

alter table public.calendar_ideas    enable row level security;
alter table public.calendar_comments enable row level security;

grant select, insert, update, delete on public.calendar_ideas, public.calendar_comments to service_role;
