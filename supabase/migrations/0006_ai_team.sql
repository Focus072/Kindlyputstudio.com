-- AI Team for /admin/ai-team on kindlyputstudio.com (Supabase project kindly-put-rooms).
-- Run once in the Supabase SQL editor (or with `supabase db push`). Safe to run twice.
-- From the AI Team package (Focus072/KindlyPut-Claude-Marketing-Team-, commit 9e4bb86),
-- where it is named 20261106000000_ai_team.sql.
--
-- Additive only. Creates five new ai_team_* tables in the public schema so the
-- website's existing server-only Supabase client can reach them. No existing
-- table is altered. They reference:
--   calendar_clients(id)  the existing list of client businesses
--   admin_users(id)       the existing studio logins (G and Mohhamed)
--
-- Row level security is ON with no policies: browsers (anon/authenticated
-- keys) can't read or write anything. Only the server, using the service
-- role through requireAdmin()-protected routes, can.

-- Brand guidelines / approved client context. Only status = 'approved' rows
-- are given to the specialists.
create table if not exists public.ai_team_brand_guidelines (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null constraint ai_team_brand_guidelines_client_id_fkey references public.calendar_clients(id) on delete cascade,
  title text not null,
  body text not null,
  status text not null default 'draft' check (status in ('draft', 'approved', 'archived')),
  updated_by uuid constraint ai_team_brand_guidelines_updated_by_fkey references public.admin_users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists ai_team_brand_guidelines_client_idx on public.ai_team_brand_guidelines(client_id);

-- Optional grouping inside a client; handoffs are shared within a campaign.
create table if not exists public.ai_team_campaigns (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null constraint ai_team_campaigns_client_id_fkey references public.calendar_clients(id) on delete cascade,
  name text not null,
  goal text not null default '',
  status text not null default 'active' check (status in ('active', 'in_review', 'done', 'archived')),
  created_by uuid constraint ai_team_campaigns_created_by_fkey references public.admin_users(id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists ai_team_campaigns_client_idx on public.ai_team_campaigns(client_id);

-- One conversation = one client + one specialist (+ optional campaign).
-- Specialist instructions live in code (src/lib/ai-team/specialists.ts), never here.
create table if not exists public.ai_team_conversations (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null constraint ai_team_conversations_client_id_fkey references public.calendar_clients(id) on delete cascade,
  campaign_id uuid constraint ai_team_conversations_campaign_id_fkey references public.ai_team_campaigns(id) on delete set null,
  specialist_id text not null check (specialist_id in ('maya', 'jules', 'theo', 'nova', 'remy')),
  title text not null default 'New conversation',
  created_by uuid constraint ai_team_conversations_created_by_fkey references public.admin_users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists ai_team_conversations_client_specialist_idx
  on public.ai_team_conversations(client_id, specialist_id, updated_at desc);

-- Messages are shared by both team members; author_id records who sent each one.
create table if not exists public.ai_team_messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null constraint ai_team_messages_conversation_id_fkey references public.ai_team_conversations(id) on delete cascade,
  role text not null check (role in ('user', 'assistant')),
  content text not null,
  author_id uuid constraint ai_team_messages_author_id_fkey references public.admin_users(id) on delete set null,
  model text,
  input_tokens integer,
  output_tokens integer,
  stop_reason text, -- the reply's stop reason; on a team member's message, 'refusal' means Claude declined it and it's left out of later turns
  created_at timestamptz not null default now()
);
create index if not exists ai_team_messages_conversation_idx on public.ai_team_messages(conversation_id, created_at);

-- Handoffs between stages = the "approved briefs". Only status = 'approved'
-- rows reach later specialists, and only within the same client and campaign.
create table if not exists public.ai_team_handoffs (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null constraint ai_team_handoffs_client_id_fkey references public.calendar_clients(id) on delete cascade,
  campaign_id uuid constraint ai_team_handoffs_campaign_id_fkey references public.ai_team_campaigns(id) on delete set null,
  from_specialist text not null check (from_specialist in ('maya', 'jules', 'theo', 'nova', 'remy')),
  -- Any specialist or human review. Work can also go back to an earlier stage (the chat page offers every specialist).
  to_stage text not null check (to_stage in ('maya', 'jules', 'theo', 'nova', 'remy', 'review')),
  title text not null,
  content text not null,
  status text not null default 'draft' check (status in ('draft', 'approved', 'changes_requested', 'archived')),
  source_message_id uuid constraint ai_team_handoffs_source_message_id_fkey references public.ai_team_messages(id) on delete set null,
  created_by uuid constraint ai_team_handoffs_created_by_fkey references public.admin_users(id) on delete set null,
  approved_by uuid constraint ai_team_handoffs_approved_by_fkey references public.admin_users(id) on delete set null,
  approved_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists ai_team_handoffs_client_idx on public.ai_team_handoffs(client_id, created_at desc);

alter table public.ai_team_brand_guidelines enable row level security;
alter table public.ai_team_campaigns enable row level security;
alter table public.ai_team_conversations enable row level security;
alter table public.ai_team_messages enable row level security;
alter table public.ai_team_handoffs enable row level security;

-- Only the server's secret key (service_role) gets table access, as in every
-- other migration here. Needed when "Automatically expose new tables" is off.
grant select, insert, update, delete
  on public.ai_team_brand_guidelines, public.ai_team_campaigns, public.ai_team_conversations,
     public.ai_team_messages, public.ai_team_handoffs
  to service_role;
