-- Calendar v2: Buffer accounts sync themselves onto the site. Additive only.
-- New columns describe each Buffer channel's health, posting slots and
-- Pinterest boards. removed_at marks channels Buffer no longer returns
-- (kept so old posts still show their client).

alter table public.buffer_channels
  add column if not exists is_disconnected  boolean not null default false,
  add column if not exists is_locked        boolean not null default false,
  add column if not exists is_paused        boolean not null default false,
  add column if not exists external_link    text,
  add column if not exists timezone         text,
  add column if not exists posting_schedule jsonb,
  add column if not exists boards           jsonb,
  add column if not exists removed_at       timestamptz,
  add column if not exists created_at       timestamptz not null default now();
