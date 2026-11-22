-- Founders AI OS database setup.
-- Run this whole file once on a new, empty Supabase project: SQL Editor, paste, Run. Or use the Supabase CLI:
-- supabase link --project-ref <your-project-ref>, then supabase db push. SETUP.md step 2 walks through both.
-- It creates every table, function, policy and storage bucket the app needs. The first person who signs up
-- becomes the admin; everyone after that waits for the admin to approve them on the Access screen.
-- It runs as one transaction: if any statement fails, nothing is saved and you can run the file again.
begin;
create schema if not exists private;
create extension if not exists pgcrypto with schema extensions;
create extension if not exists "uuid-ossp" with schema extensions;
set check_function_bodies = off;
set search_path = public, extensions;


create sequence if not exists public.recording_chunks_id_seq;
create sequence if not exists public.chat_messages_id_seq;

create table if not exists private.affiliate_hooks (workspace_id uuid not null,
  token text not null,
  settings jsonb default '{}'::jsonb not null,
  created_at timestamp with time zone default now() not null,
  rotated_at timestamp with time zone);

create table if not exists private.app_config (key text not null,
  value text not null);

create table if not exists private.custom_connection_secrets (connection_id uuid not null,
  ciphertext text not null);

create table if not exists private.funnel_assets (build_id uuid not null,
  name text not null,
  mime text not null,
  data text not null,
  created_at timestamp with time zone default now() not null);

create table if not exists private.graphic_assets (workspace_id uuid not null,
  name text not null,
  set_id uuid,
  mime text not null,
  data text not null,
  created_at timestamp with time zone default now() not null);

create table if not exists private.inbox_secrets (account_id uuid not null,
  ciphertext text not null,
  hook_hash text);

create table if not exists private.recurring_leases (run_id uuid not null,
  token uuid not null);

create table if not exists private.workspace_secrets (workspace_id uuid not null,
  provider text not null,
  ciphertext text not null,
  updated_at timestamp with time zone default now() not null,
  hook_hash text);

create table if not exists public.affiliate_events (id uuid default gen_random_uuid() not null,
  workspace_id uuid not null,
  event_key text not null,
  kind text not null,
  email text,
  name text,
  plan text,
  amount numeric,
  sub_id text,
  contact_id text,
  tags text[] default '{}'::text[] not null,
  status text default 'ok'::text not null,
  note text,
  raw jsonb,
  created_at timestamp with time zone default now() not null);

create table if not exists public.agent_proposals (id uuid not null,
  workspace_id uuid not null,
  actor_id uuid not null,
  data jsonb not null,
  digest text not null,
  status text default 'pending'::text not null,
  result_id uuid,
  created_at timestamp with time zone default now() not null);

create table if not exists public.agent_runs (id uuid not null,
  workspace_id uuid not null,
  task_id uuid not null,
  agent_id uuid,
  trigger text not null,
  scheduled_for timestamp with time zone not null,
  status text not null,
  snapshot jsonb not null,
  output jsonb,
  model text,
  error text,
  attempt integer default 0 not null,
  lease_until timestamp with time zone,
  created_at timestamp with time zone default now() not null,
  started_at timestamp with time zone,
  finished_at timestamp with time zone);

create table if not exists public.brain_chunks (id bigint generated always as identity not null,
  doc_id uuid not null,
  workspace_id uuid not null,
  idx integer not null,
  heading text,
  body text not null,
  tsv tsvector generated always as (to_tsvector('english'::regconfig, ((COALESCE(heading, ''::text) || ' '::text) || body))) stored);

create table if not exists public.brain_docs (id uuid default gen_random_uuid() not null,
  workspace_id uuid not null,
  title text not null,
  kind text not null,
  source text,
  category text default 'other'::text not null,
  chars integer default 0 not null,
  words integer default 0 not null,
  summary text,
  status text default 'ready'::text not null,
  error text,
  storage_path text,
  url text,
  meta jsonb default '{}'::jsonb not null,
  created_by uuid default auth.uid(),
  created_at timestamp with time zone default now() not null,
  updated_at timestamp with time zone default now() not null);

create table if not exists public.brain_facts (id uuid default gen_random_uuid() not null,
  workspace_id uuid not null,
  category text not null,
  statement text not null,
  status text default 'proposed'::text not null,
  source text default 'you'::text not null,
  evidence text,
  doc_title text,
  weight smallint default 2 not null,
  approved_at timestamp with time zone,
  created_by uuid default auth.uid(),
  created_at timestamp with time zone default now() not null,
  updated_at timestamp with time zone default now() not null);

create table if not exists public.brain_profile (workspace_id uuid not null,
  profile jsonb default '{}'::jsonb not null,
  method text default 'rules'::text not null,
  doc_count integer default 0 not null,
  studied_at timestamp with time zone default now() not null);

create table if not exists public.brand_dna (workspace_id uuid not null,
  version integer default 1 not null,
  body text default ''::text not null,
  hash text,
  counts jsonb default '{}'::jsonb not null,
  built_at timestamp with time zone default now() not null,
  checked_at timestamp with time zone default now() not null);

create table if not exists public.chat_messages (id bigint default nextval('chat_messages_id_seq'::regclass) not null,
  thread_id uuid not null,
  workspace_id uuid not null,
  role text not null,
  body text not null,
  sources jsonb default '[]'::jsonb not null,
  model text,
  created_at timestamp with time zone default now() not null,
  room jsonb,
  program_proposal uuid,
  agent_proposal jsonb);

create table if not exists public.chat_threads (id uuid default gen_random_uuid() not null,
  workspace_id uuid not null,
  title text default 'New chat'::text not null,
  created_by uuid default auth.uid(),
  created_at timestamp with time zone default now() not null,
  updated_at timestamp with time zone default now() not null,
  agent text);

create table if not exists public.coach_chunks (id bigint generated always as identity not null,
  source_id uuid not null,
  idx integer not null,
  at_s integer,
  body text not null,
  tsv tsvector generated always as (to_tsvector('english'::regconfig, body)) stored);

create table if not exists public.coach_playbook (id uuid default gen_random_uuid() not null,
  workspace_id uuid not null,
  topic text default 'General'::text not null,
  question text not null,
  keywords text default ''::text not null,
  answer text default ''::text not null,
  sources text[] default '{}'::text[] not null,
  status text default 'draft'::text not null,
  "position" integer default 0 not null,
  updated_by uuid default auth.uid(),
  updated_at timestamp with time zone default now() not null,
  approved_at timestamp with time zone,
  tsv tsvector generated always as (((setweight(to_tsvector('english'::regconfig, question), 'A'::"char") || setweight(to_tsvector('english'::regconfig, keywords), 'A'::"char")) || setweight(to_tsvector('english'::regconfig, answer), 'C'::"char"))) stored);

create table if not exists public.coach_sources (id uuid default gen_random_uuid() not null,
  kind text not null,
  ref text not null,
  workspace_id uuid not null,
  title text not null,
  url text,
  enabled boolean default true not null,
  chars integer default 0 not null,
  removed integer default 0 not null,
  published_by uuid default auth.uid(),
  published_at timestamp with time zone default now() not null);

create table if not exists public.coach_usage (user_id uuid not null,
  hour timestamp with time zone not null,
  n integer default 0 not null);

create table if not exists public.content_funnel (id uuid default gen_random_uuid() not null,
  workspace_id uuid not null,
  kind text not null,
  strategy_id uuid,
  name text,
  summary text default ''::text not null,
  url text default ''::text not null,
  leads_to uuid,
  plan jsonb,
  "position" double precision default 0 not null,
  created_by uuid default auth.uid(),
  created_at timestamp with time zone default now() not null,
  updated_at timestamp with time zone default now() not null);

create table if not exists public.content_items (id uuid default gen_random_uuid() not null,
  workspace_id uuid not null,
  title text not null,
  stage text default 'approved'::text not null,
  channel text default 'youtube'::text not null,
  format text,
  publish_at date,
  "position" double precision default 0 not null,
  meta jsonb default '{}'::jsonb not null,
  created_by uuid default auth.uid(),
  created_at timestamp with time zone default now() not null,
  updated_at timestamp with time zone default now() not null);

create table if not exists public.content_learning_config (workspace_id uuid not null,
  enabled boolean default true not null,
  muted_keys text[] default '{}'::text[] not null,
  since_at timestamp with time zone default '1970-01-01 00:00:00+00'::timestamp with time zone not null,
  updated_at timestamp with time zone default now() not null);

create table if not exists public.content_learning_events (id uuid default gen_random_uuid() not null,
  sequence bigint generated always as identity not null,
  workspace_id uuid not null,
  subject_key text not null,
  content_id uuid,
  kind text not null,
  channel text not null,
  format text,
  title text not null,
  reason text default ''::text not null,
  before_text jsonb default '{}'::jsonb not null,
  after_text jsonb default '{}'::jsonb not null,
  origin text not null,
  created_by uuid,
  created_at timestamp with time zone default clock_timestamp() not null);

create table if not exists public.content_learning_metrics (workspace_id uuid not null,
  source_key text not null,
  observed_day date not null,
  observed_at timestamp with time zone not null,
  content_id uuid,
  source text not null,
  payload jsonb not null);

create table if not exists public.creator_posts (id uuid default gen_random_uuid() not null,
  workspace_id uuid not null,
  creator_id uuid not null,
  platform text not null,
  format text not null,
  ext_id text not null,
  url text,
  thumb text,
  title text,
  views bigint,
  likes bigint,
  comments bigint,
  duration_s integer,
  posted_at timestamp with time zone,
  picked boolean default false not null,
  updated_at timestamp with time zone default now() not null,
  body text,
  shares bigint);

create table if not exists public.creators (id uuid default gen_random_uuid() not null,
  workspace_id uuid not null,
  name text not null,
  ig_handle text,
  yt_url text,
  ig_followers bigint,
  yt_subscribers bigint,
  ig_synced_at timestamp with time zone,
  yt_synced_at timestamp with time zone,
  created_by uuid default auth.uid(),
  created_at timestamp with time zone default now() not null,
  x_handle text,
  li_url text,
  fb_url text,
  news_url text,
  news_kind text,
  x_followers bigint,
  x_synced_at timestamp with time zone,
  li_synced_at timestamp with time zone,
  fb_synced_at timestamp with time zone,
  news_synced_at timestamp with time zone);

create table if not exists public.custom_connection_runs (id uuid not null,
  workspace_id uuid not null,
  connection_id uuid not null,
  actor_id uuid not null,
  label text not null,
  digest text not null,
  status text not null,
  result jsonb,
  started_at timestamp with time zone default now() not null,
  finished_at timestamp with time zone);

create table if not exists public.custom_connections (id uuid not null,
  workspace_id uuid not null,
  name text not null,
  kind text not null,
  enabled boolean default true not null,
  revision integer default 1 not null,
  meta jsonb default '{}'::jsonb not null,
  created_at timestamp with time zone default now() not null,
  updated_at timestamp with time zone default now() not null);

create table if not exists public.dna_items (id uuid default gen_random_uuid() not null,
  workspace_id uuid not null,
  kind text not null,
  source text default 'you'::text not null,
  ext_id text default (gen_random_uuid())::text not null,
  name text not null,
  price numeric,
  currency text,
  price_note text,
  summary text,
  url text,
  steps integer,
  included boolean default true not null,
  user_set boolean default false not null,
  ext_updated_at timestamp with time zone,
  synced_at timestamp with time zone,
  created_at timestamp with time zone default now() not null,
  updated_at timestamp with time zone default now() not null);

create table if not exists public.email_sets (id uuid default gen_random_uuid() not null,
  workspace_id uuid not null,
  sequence text not null,
  title text default 'Emails'::text not null,
  item_name text,
  context text default ''::text not null,
  emails jsonb default '[]'::jsonb not null,
  by text,
  created_by uuid default auth.uid(),
  created_at timestamp with time zone default now() not null,
  updated_at timestamp with time zone default now() not null);

create table if not exists public.founder_agents (id uuid not null,
  workspace_id uuid not null,
  name text not null,
  role text not null,
  instructions text not null,
  model text default ''::text not null,
  enabled boolean default true not null,
  archived boolean default false not null,
  revision integer default 1 not null,
  created_by uuid,
  created_at timestamp with time zone default now() not null,
  updated_at timestamp with time zone default now() not null);

create table if not exists public.founder_strategy (id uuid not null,
  workspace_id uuid not null,
  kind text not null,
  name text not null,
  lifecycle text not null,
  summary text default ''::text not null,
  price numeric,
  currency text default 'USD'::text not null,
  price_note text default ''::text not null,
  url text default ''::text not null,
  steps integer,
  linked_offer_id uuid,
  inventory_id uuid,
  details jsonb default '{}'::jsonb not null,
  stream text generated always as ((details ->> 'stream'::text)) stored,
  revision integer default 1 not null,
  created_by uuid,
  created_at timestamp with time zone default now() not null,
  updated_at timestamp with time zone default now() not null);

create table if not exists public.funnel_builds (id uuid default gen_random_uuid() not null,
  workspace_id uuid not null,
  created_by uuid,
  title text not null,
  offer_ref text,
  status text default 'queued'::text not null,
  step text default 'research'::text not null,
  steps jsonb default '{}'::jsonb not null,
  answers jsonb default '{}'::jsonb not null,
  research jsonb,
  offer jsonb,
  copy jsonb,
  emails jsonb,
  handoff jsonb,
  brand jsonb,
  visuals jsonb,
  design jsonb,
  assets jsonb default '{}'::jsonb not null,
  links jsonb default '{}'::jsonb not null,
  html text,
  qa jsonb,
  version integer default 0 not null,
  versions jsonb default '[]'::jsonb not null,
  revisions jsonb default '[]'::jsonb not null,
  repo jsonb,
  deploy jsonb,
  preview_key text default encode(gen_random_bytes(18), 'hex'::text) not null,
  error text,
  lease_until timestamp with time zone,
  created_at timestamp with time zone default now() not null,
  updated_at timestamp with time zone default now() not null,
  engine text default 'os'::text not null,
  draft text);

create table if not exists public.graphic_kits (workspace_id uuid not null,
  palette jsonb default '{}'::jsonb not null,
  fonts jsonb default '{}'::jsonb not null,
  style text,
  handle text,
  logo text,
  photos jsonb default '[]'::jsonb not null,
  asset_key text default encode(gen_random_bytes(18), 'hex'::text) not null,
  updated_at timestamp with time zone default now() not null,
  palettes jsonb default '[]'::jsonb not null,
  font_sets jsonb default '[]'::jsonb not null,
  custom_fonts jsonb default '[]'::jsonb not null);

create table if not exists public.graphic_sets (id uuid default gen_random_uuid() not null,
  workspace_id uuid not null,
  created_by uuid,
  title text not null,
  format text not null,
  aspect text default '4:5'::text not null,
  model text,
  input jsonb default '{}'::jsonb not null,
  plan jsonb,
  slides jsonb default '[]'::jsonb not null,
  copy jsonb,
  status text default 'queued'::text not null,
  step text default 'plan'::text not null,
  error text,
  lease_until timestamp with time zone,
  created_at timestamp with time zone default now() not null,
  updated_at timestamp with time zone default now() not null);

create table if not exists public.grok_tasks (id uuid default gen_random_uuid() not null,
  workspace_id uuid not null,
  created_by uuid default auth.uid(),
  agent text default 'automations'::text not null,
  title text not null,
  instruction text not null,
  status text default 'draft'::text not null,
  summary text,
  links jsonb default '[]'::jsonb not null,
  updates jsonb default '[]'::jsonb not null,
  send_error text,
  sent_at timestamp with time zone,
  created_at timestamp with time zone default now() not null,
  updated_at timestamp with time zone default now() not null);

create table if not exists public.inbox_accounts (id uuid default gen_random_uuid() not null,
  workspace_id uuid not null,
  kind text not null,
  label text not null,
  address text not null,
  status text default 'connected'::text not null,
  meta jsonb default '{}'::jsonb not null,
  last_sync_at timestamp with time zone,
  last_error text,
  created_at timestamp with time zone default now() not null);

create table if not exists public.inbox_messages (id uuid default gen_random_uuid() not null,
  workspace_id uuid not null,
  thread_id uuid not null,
  ext_id text not null,
  dir text not null,
  author text,
  body text,
  sent_at timestamp with time zone default now() not null,
  meta jsonb default '{}'::jsonb not null);

create table if not exists public.inbox_people (id uuid default gen_random_uuid() not null,
  workspace_id uuid not null,
  name text default 'Unknown'::text not null,
  emails text[] default '{}'::text[] not null,
  phones text[] default '{}'::text[] not null,
  handles jsonb default '{}'::jsonb not null,
  hl_contact_id text,
  hl_opportunity_id text,
  stage_id uuid,
  stream text,
  value numeric,
  notes text,
  updated_at timestamp with time zone default now() not null,
  created_at timestamp with time zone default now() not null);

create table if not exists public.inbox_stages (id uuid default gen_random_uuid() not null,
  workspace_id uuid not null,
  name text not null,
  "position" integer default 0 not null,
  hl_pipeline_id text,
  hl_stage_id text,
  created_at timestamp with time zone default now() not null);

create table if not exists public.inbox_threads (id uuid default gen_random_uuid() not null,
  workspace_id uuid not null,
  source text not null,
  account_id uuid,
  channel text default 'email'::text not null,
  ext_id text not null,
  person_id uuid,
  subject text,
  snippet text,
  last_at timestamp with time zone default now() not null,
  last_dir text,
  unread integer default 0 not null,
  status text default 'open'::text not null,
  priority text default 'normal'::text not null,
  intent text,
  summary text,
  draft text,
  hl_contact_id text,
  meta jsonb default '{}'::jsonb not null,
  created_at timestamp with time zone default now() not null);

create table if not exists public.mcp_changes (id uuid default gen_random_uuid() not null,
  workspace_id uuid not null,
  section text not null,
  row_id text not null,
  op text not null,
  before jsonb,
  after jsonb,
  client text,
  undone_at timestamp with time zone,
  at timestamp with time zone default now() not null);

create table if not exists public.mcp_tokens (id uuid default gen_random_uuid() not null,
  workspace_id uuid not null,
  user_id uuid default auth.uid() not null,
  name text not null,
  token_hash text not null,
  prefix text not null,
  calls integer default 0 not null,
  last_used_at timestamp with time zone,
  last_client text,
  revoked_at timestamp with time zone,
  created_at timestamp with time zone default now() not null,
  scope text default 'write'::text not null);

create table if not exists public.memory_items (id uuid default gen_random_uuid() not null,
  workspace_id uuid not null,
  kind text not null,
  text text not null,
  meta jsonb default '{}'::jsonb not null,
  due date,
  status text default 'open'::text not null,
  created_by uuid default auth.uid(),
  created_at timestamp with time zone default now() not null,
  updated_at timestamp with time zone default now() not null);

create table if not exists public.morning_briefs (id uuid default gen_random_uuid() not null,
  workspace_id uuid not null,
  day date not null,
  status text default 'generating'::text not null,
  revision integer default 0 not null,
  lease uuid,
  started_at timestamp with time zone default now() not null,
  generated_at timestamp with time zone,
  context_hash text,
  dna_version integer,
  by text,
  error text);

create table if not exists public.morning_suggestions (id uuid default gen_random_uuid() not null,
  workspace_id uuid not null,
  brief_id uuid not null,
  revision integer not null,
  kind text not null,
  title text not null,
  summary text default ''::text not null,
  why text default ''::text not null,
  payload jsonb default '{}'::jsonb not null,
  evidence jsonb default '[]'::jsonb not null,
  content_id uuid,
  state text default 'suggested'::text not null,
  destination_id uuid,
  "position" integer default 0 not null,
  created_at timestamp with time zone default now() not null,
  moved_at timestamp with time zone);

create table if not exists public.os_drafts (id uuid default gen_random_uuid() not null,
  workspace_id uuid not null,
  kind text not null,
  title text not null,
  body text not null,
  stream text,
  action text,
  source text default 'app'::text not null,
  status text default 'waiting'::text not null,
  created_by uuid,
  created_at timestamp with time zone default now() not null,
  decided_at timestamp with time zone,
  meta jsonb default '{}'::jsonb not null);

create table if not exists public.profiles (id uuid not null,
  full_name text default ''::text not null,
  email text not null,
  onboarded boolean default false not null,
  created_at timestamp with time zone default now() not null,
  updated_at timestamp with time zone default now() not null,
  current_workspace uuid,
  nav_layout jsonb,
  theme text);

create table if not exists public.program_materials (id uuid default gen_random_uuid() not null,
  workspace_id uuid not null,
  program_id uuid,
  title text not null,
  filename text,
  mime text,
  size bigint default 0 not null,
  storage_path text,
  url text,
  body text default ''::text not null,
  notes text default ''::text not null,
  read_state text default 'attachment'::text not null,
  chars integer default 0 not null,
  revision integer default 1 not null,
  created_by uuid default auth.uid() not null,
  created_at timestamp with time zone default now() not null,
  updated_at timestamp with time zone default now() not null,
  removal_pending boolean default false not null);

create table if not exists public.program_proposals (id uuid not null,
  workspace_id uuid not null,
  target_id uuid,
  expected_revision integer default 0 not null,
  data jsonb not null,
  changes jsonb default '[]'::jsonb not null,
  answer text default ''::text not null,
  digest text not null,
  status text default 'pending'::text not null,
  result_id uuid,
  created_by uuid default auth.uid() not null,
  created_at timestamp with time zone default now() not null,
  applied_by uuid,
  applied_at timestamp with time zone);

create table if not exists public.program_versions (program_id uuid not null,
  workspace_id uuid not null,
  revision integer not null,
  data jsonb not null,
  archived boolean not null,
  created_at timestamp with time zone default now() not null,
  created_by uuid default auth.uid() not null);

create table if not exists public.programs (id uuid default gen_random_uuid() not null,
  workspace_id uuid not null,
  data jsonb not null,
  origin text default 'manual'::text not null,
  revision integer default 1 not null,
  archived boolean default false not null,
  created_by uuid default auth.uid() not null,
  created_at timestamp with time zone default now() not null,
  updated_at timestamp with time zone default now() not null);

create table if not exists public.recording_chunks (id bigint default nextval('recording_chunks_id_seq'::regclass) not null,
  recording_id uuid not null,
  workspace_id uuid not null,
  idx integer not null,
  at_s integer,
  speakers text,
  body text not null,
  tsv tsvector generated always as (to_tsvector('english'::regconfig, ((COALESCE(speakers, ''::text) || ' '::text) || body))) stored);

create table if not exists public.recordings (id uuid default gen_random_uuid() not null,
  workspace_id uuid not null,
  source text default 'zoom'::text not null,
  ext_id text not null,
  title text default 'Recording'::text not null,
  started_at timestamp with time zone,
  minutes integer,
  url text,
  words integer default 0 not null,
  status text default 'ready'::text not null,
  error text,
  created_at timestamp with time zone default now() not null,
  updated_at timestamp with time zone default now() not null,
  reviewed_at timestamp with time zone,
  review jsonb);

create table if not exists public.recurring_tasks (id uuid not null,
  workspace_id uuid not null,
  agent_id uuid,
  kind text not null,
  name text not null,
  instructions text default ''::text not null,
  deliverable text not null,
  output text not null,
  format text not null,
  platform text not null,
  idea_count integer default 5 not null,
  tags jsonb default '[]'::jsonb not null,
  schedule jsonb not null,
  enabled boolean default true not null,
  archived boolean default false not null,
  revision integer default 1 not null,
  next_run_at timestamp with time zone not null,
  last_run_at timestamp with time zone,
  last_status text,
  last_error text,
  created_at timestamp with time zone default now() not null,
  updated_at timestamp with time zone default now() not null);

create table if not exists public.research_runs (id uuid default gen_random_uuid() not null,
  workspace_id uuid not null,
  provider text default 'apify'::text not null,
  preset text not null,
  label text not null,
  actor_id text not null,
  input jsonb default '{}'::jsonb not null,
  run_id text,
  dataset_id text,
  status text default 'starting'::text not null,
  item_count integer default 0 not null,
  items jsonb default '[]'::jsonb not null,
  cost_usd numeric(10,4),
  error text,
  created_by uuid default auth.uid(),
  created_at timestamp with time zone default now() not null,
  finished_at timestamp with time zone,
  creator_id uuid);

create table if not exists public.swipe_items (id uuid default gen_random_uuid() not null,
  workspace_id uuid not null,
  kind text default 'funnel'::text not null,
  title text,
  brand text,
  url text,
  body text,
  page_text text,
  images jsonb default '[]'::jsonb not null,
  notes text,
  tags text[] default '{}'::text[] not null,
  analysis jsonb default '{}'::jsonb not null,
  analyzed_by text,
  analyzed_at timestamp with time zone,
  pinned boolean default false not null,
  created_at timestamp with time zone default now() not null,
  updated_at timestamp with time zone default now() not null);

create table if not exists public.team_agent_settings (workspace_id uuid not null,
  agent_id text not null,
  instructions text default ''::text not null,
  context text default ''::text not null,
  updated_by uuid default auth.uid(),
  updated_at timestamp with time zone default now() not null);

create table if not exists public.tella_approvals (id uuid default gen_random_uuid() not null,
  workspace_id uuid not null,
  edit_id uuid not null,
  kind text not null,
  edit_revision integer not null,
  snapshot jsonb not null,
  digest text not null,
  approved_by uuid,
  created_at timestamp with time zone default now() not null);

create table if not exists public.tella_edits (id uuid not null,
  workspace_id uuid not null,
  tella_video_id text not null,
  title text not null,
  source jsonb not null,
  plan jsonb,
  notes text default ''::text not null,
  revision integer default 1 not null,
  run jsonb default '{}'::jsonb not null,
  archived boolean default false not null,
  created_by uuid,
  created_at timestamp with time zone default now() not null,
  updated_at timestamp with time zone default now() not null);

create table if not exists public.user_access (user_id uuid not null,
  status text default 'pending'::text not null,
  is_admin boolean default false not null,
  requested_at timestamp with time zone default now() not null,
  decided_at timestamp with time zone,
  decided_by uuid);

create table if not exists public.vault_notes (id uuid not null,
  workspace_id uuid not null,
  title text not null,
  purpose text default 'general'::text not null,
  body text not null,
  context text default ''::text not null,
  sources jsonb default '[]'::jsonb not null,
  by text default 'Saved breakdowns'::text not null,
  dna_version integer,
  enabled boolean default true not null,
  pinned boolean default false not null,
  archived boolean default false not null,
  revision integer default 1 not null,
  created_by uuid,
  created_at timestamp with time zone default clock_timestamp() not null,
  updated_at timestamp with time zone default clock_timestamp() not null,
  search_text tsvector generated always as (to_tsvector('english'::regconfig, ((((COALESCE(title, ''::text) || ' '::text) || COALESCE(body, ''::text)) || ' '::text) || COALESCE(context, ''::text)))) stored);

create table if not exists public.video_approvals (id uuid default gen_random_uuid() not null,
  workspace_id uuid not null,
  project_id uuid not null,
  project_revision integer not null,
  snapshot jsonb not null,
  digest text not null,
  approved_by uuid,
  created_at timestamp with time zone default now() not null);

create table if not exists public.video_exports (id uuid not null,
  workspace_id uuid not null,
  project_id uuid not null,
  approval_id uuid not null,
  storage_path text not null,
  filename text not null,
  size bigint not null,
  duration numeric not null,
  mime text not null,
  created_at timestamp with time zone default now() not null,
  created_by uuid);

create table if not exists public.video_projects (id uuid not null,
  workspace_id uuid not null,
  title text not null,
  data jsonb not null,
  revision integer default 1 not null,
  archived boolean default false not null,
  created_by uuid,
  created_at timestamp with time zone default now() not null,
  updated_at timestamp with time zone default now() not null);

create table if not exists public.workspace_connections (workspace_id uuid not null,
  provider text not null,
  status text default 'not_connected'::text not null,
  account_label text,
  connected_at timestamp with time zone,
  updated_at timestamp with time zone default now() not null,
  meta jsonb default '{}'::jsonb not null);

create table if not exists public.workspace_members (workspace_id uuid not null,
  user_id uuid not null,
  role text default 'member'::text not null,
  created_at timestamp with time zone default now() not null);

create table if not exists public.workspaces (id uuid default gen_random_uuid() not null,
  name text not null,
  owner_id uuid not null,
  plan text default 'trial'::text not null,
  created_at timestamp with time zone default now() not null,
  kind text default 'live'::text not null);

create table if not exists public.writing_samples (id uuid default gen_random_uuid() not null,
  workspace_id uuid not null,
  title text default 'Untitled'::text not null,
  kind text default 'other'::text not null,
  body text not null,
  words integer default 0 not null,
  pinned boolean default false not null,
  created_by uuid default auth.uid(),
  created_at timestamp with time zone default now() not null,
  updated_at timestamp with time zone default now() not null);

create table if not exists public.writing_style (workspace_id uuid not null,
  profile jsonb default '{}'::jsonb not null,
  guide text[] default '{}'::text[] not null,
  ai_guide text[],
  ai_by text,
  ai_samples integer,
  samples integer default 0 not null,
  words integer default 0 not null,
  studied_at timestamp with time zone default now() not null,
  ai_at timestamp with time zone);

-- The owner's time zone for daily briefs and "today". The app stores FOS_TZ here through public.fos_setup.
CREATE OR REPLACE FUNCTION private.app_tz()
 RETURNS text
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select coalesce((select c.value from private.app_config c where c.key = 'timezone' and exists (select 1 from pg_catalog.pg_timezone_names z where z.name = c.value)), 'UTC');
$function$
;

-- Called by the app (POST /api/config) when an admin opens the setup check. It stores the SHA-256 of
-- CRON_SECRET, so the scheduled jobs can prove who they are, and the time zone from FOS_TZ.
-- Anyone who is not an approved admin gets {admin:false} and nothing changes.
CREATE OR REPLACE FUNCTION public.fos_setup(p_cron_hash text, p_timezone text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare v_tz text;
begin
  if not private.is_admin() then return jsonb_build_object('admin', false); end if;
  if p_cron_hash is not null and p_cron_hash ~ '^[0-9a-f]{64}$' then
    insert into private.app_config (key, value) values ('cron_hash', p_cron_hash)
      on conflict (key) do update set value = excluded.value;
  end if;
  if p_timezone is not null and exists (select 1 from pg_catalog.pg_timezone_names z where z.name = p_timezone) then
    insert into private.app_config (key, value) values ('timezone', p_timezone)
      on conflict (key) do update set value = excluded.value;
  end if;
  v_tz := private.app_tz();
  return jsonb_build_object('admin', true,
    'cron_registered', p_cron_hash is not null and exists (select 1 from private.app_config where key = 'cron_hash' and value = p_cron_hash),
    'timezone', v_tz);
end; $function$
;

CREATE OR REPLACE FUNCTION private.calls_pending(p_ws uuid, p_limit integer, p_id uuid DEFAULT NULL::uuid)
 RETURNS json
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select coalesce(json_agg(x order by x.started_at desc), '[]'::json) from (
    select r.id, r.title, r.started_at, r.minutes, r.words,
      (select string_agg('[' || lpad((c.at_s / 60)::text, 2, '0') || ':' || lpad((c.at_s % 60)::text, 2, '0') || '] ' || c.body, E'\n' order by c.idx)
         from public.recording_chunks c where c.recording_id = r.id) as transcript
    from public.recordings r
    where r.workspace_id = p_ws and r.status = 'ready' and (p_id is not null and r.id = p_id or p_id is null and r.reviewed_at is null)
    order by r.started_at desc limit greatest(1, least(p_limit, 5))
  ) x;
$function$
;

CREATE OR REPLACE FUNCTION private.calls_save(p_ws uuid, p_rec uuid, p_review jsonb, p_items jsonb, p_ideas jsonb, p_by uuid)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare rec public.recordings; it jsonb; n int := 0; k int := 0; src text;
begin
  select * into rec from public.recordings r where r.id = p_rec and r.workspace_id = p_ws for update;
  if not found then raise exception 'call not found' using errcode = 'P0002'; end if;
  src := 'Call, ' || left(rec.title, 120);
  -- a second run replaces the earlier suggestions for this call; kept items stay
  delete from public.memory_items m where m.workspace_id = p_ws and m.status = 'suggested' and m.meta->>'recording_id' = p_rec::text;
  delete from public.content_items c where c.workspace_id = p_ws and c.stage = 'suggested' and c.meta->>'recording_id' = p_rec::text;
  for it in select * from jsonb_array_elements(coalesce(p_items, '[]'::jsonb)) loop
    continue when coalesce(it->>'kind', '') not in ('commitment', 'waiting', 'decision', 'note', 'idea') or length(coalesce(it->>'text', '')) < 3;
    insert into public.memory_items (workspace_id, kind, text, meta, due, status, created_by)
    values (p_ws, it->>'kind', left(it->>'text', 2000),
      jsonb_strip_nulls(jsonb_build_object('from', 'call', 'source', src, 'recording_id', p_rec, 'recording', rec.title, 'call_at', rec.started_at,
        'who', nullif(left(it->>'who', 120), ''), 'at_s', case when (it->>'at_s') ~ '^\d+$' then (it->>'at_s')::int end,
        'quote', nullif(left(it->>'quote', 400), ''), 'tag', nullif(left(it->>'tag', 30), ''))),
      case when (it->>'due') ~ '^\d{4}-\d{2}-\d{2}$' then (it->>'due')::date end, 'suggested', p_by);
    n := n + 1;
  end loop;
  for it in select * from jsonb_array_elements(coalesce(p_ideas, '[]'::jsonb)) loop
    continue when length(coalesce(it->>'title', '')) < 3;
    insert into public.content_items (workspace_id, title, stage, channel, format, meta, created_by)
    values (p_ws, left(it->>'title', 300), 'suggested', coalesce(nullif(left(it->>'channel', 30), ''), 'youtube'), nullif(left(it->>'format', 30), ''),
      jsonb_strip_nulls(jsonb_build_object('from', 'call', 'source', src, 'recording_id', p_rec, 'recording', rec.title,
        'why', nullif(left(it->>'why', 600), ''), 'quote', nullif(left(it->>'quote', 400), ''),
        'at_s', case when (it->>'at_s') ~ '^\d+$' then (it->>'at_s')::int end)), p_by);
    k := k + 1;
  end loop;
  update public.recordings set reviewed_at = now(), review = p_review, updated_at = now() where id = p_rec;
  return json_build_object('id', p_rec, 'items', n, 'ideas', k);
end $function$
;

CREATE OR REPLACE FUNCTION private.calls_status(p_ws uuid)
 RETURNS json
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select json_build_object(
    'calls', (select count(*) from public.recordings r where r.workspace_id = p_ws and r.status = 'ready'),
    'reviewed', (select count(*) from public.recordings r where r.workspace_id = p_ws and r.status = 'ready' and r.reviewed_at is not null),
    'suggested', (select count(*) from public.memory_items m where m.workspace_id = p_ws and m.status = 'suggested' and m.meta->>'from' = 'call'),
    'ideas', (select count(*) from public.content_items c where c.workspace_id = p_ws and c.stage = 'suggested' and c.meta->>'from' = 'call'),
    'last', (select max(r.reviewed_at) from public.recordings r where r.workspace_id = p_ws));
$function$
;

CREATE OR REPLACE FUNCTION private.chat_query(p_q text)
 RETURNS tsquery
 LANGUAGE sql
 IMMUTABLE
 SET search_path TO ''
AS $function$
  select case when count(*) = 0 then null else to_tsquery('english', string_agg(quote_literal(lexeme), ' | ')) end
  from unnest(to_tsvector('english', coalesce(p_q, '')))
$function$
;

CREATE OR REPLACE FUNCTION private.chat_search(p_ws uuid, p_q text, p_kinds text[] DEFAULT NULL::text[], p_limit integer DEFAULT 24)
 RETURNS TABLE(kind text, ref text, title text, snippet text, at timestamp with time zone, url text, rank real, extra jsonb)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare tq tsquery := private.chat_query(p_q); hl text := 'MaxFragments=2, MaxWords=38, MinWords=14, FragmentDelimiter=" … ", StartSel=<<, StopSel=>>';
begin
  if tq is null then return; end if;
  return query
  select * from (
    select 'recording'::text, r.id::text || '#' || c.idx, r.title, ts_headline('english', c.body, tq, hl), r.started_at, r.url,
      (ts_rank(c.tsv, tq) * 1.25)::real, jsonb_build_object('at_s', c.at_s, 'body', left(c.body, 1600), 'source', r.source, 'speakers', c.speakers, 'recording_id', r.id)
    from public.recording_chunks c join public.recordings r on r.id = c.recording_id
    where c.workspace_id = p_ws and c.tsv @@ tq and (p_kinds is null or 'recording' = any(p_kinds))
    union all
    select 'doc', d.id::text || '#' || c.idx, case when d.category = 'reference' then 'Third-party reference: ' else '' end || coalesce(d.title, 'Document') || coalesce(' · ' || c.heading, ''), ts_headline('english', c.body, tq, hl), d.updated_at, d.url,
      (ts_rank(c.tsv, tq) * case when d.category = 'reference' then 0.5 else 1 end)::real, jsonb_build_object('body', left(c.body, 1600), 'doc_id', d.id, 'reference', d.category = 'reference')
    from public.brain_chunks c join public.brain_docs d on d.id = c.doc_id
    where c.workspace_id = p_ws and c.tsv @@ tq and (p_kinds is null or 'doc' = any(p_kinds))
    union all
    select 'fact', f.id::text, coalesce(f.category, 'Fact'), f.statement, f.approved_at, null,
      (ts_rank(to_tsvector('english', f.statement), tq) * 1.4)::real, jsonb_build_object('body', f.statement, 'evidence', f.evidence)
    from public.brain_facts f
    where f.workspace_id = p_ws and f.status = 'approved' and to_tsvector('english', f.statement) @@ tq and (p_kinds is null or 'fact' = any(p_kinds))
    union all
    select i.kind, i.id::text, i.name, coalesce(nullif(concat_ws(' · ', case when i.price is not null then i.price::text || ' ' || coalesce(i.currency, '') end, i.price_note, i.summary), ''), i.name), i.updated_at, i.url,
      (ts_rank(to_tsvector('english', i.name || ' ' || coalesce(i.summary, '')), tq) * 1.3)::real, jsonb_build_object('body', concat_ws(' · ', i.name, i.price::text, i.currency, i.price_note, i.summary, i.url), 'source', i.source)
    from public.dna_items i
    where i.workspace_id = p_ws and i.included and to_tsvector('english', i.name || ' ' || coalesce(i.summary, '')) @@ tq and (p_kinds is null or i.kind = any(p_kinds))
    union all
    select 'post', p.id::text, cr.name || ' on ' || initcap(p.platform), p.title, p.posted_at, p.url,
      (ts_rank(to_tsvector('english', p.title), tq) * (1 + least(ln(greatest(coalesce(p.views, 1), 1)) / 20, 0.8)))::real,
      jsonb_build_object('body', p.title, 'views', p.views, 'likes', p.likes, 'format', p.format, 'author', cr.name)
    from public.creator_posts p join public.creators cr on cr.id = p.creator_id
    where p.workspace_id = p_ws and p.title is not null and to_tsvector('english', p.title) @@ tq and (p_kinds is null or 'post' = any(p_kinds))
    union all
    select 'research', x.id::text, x.label, ts_headline('english', x.txt, tq, hl), coalesce(x.finished_at, x.created_at), null,
      (ts_rank(to_tsvector('english', x.label || ' ' || x.txt), tq) * 0.9)::real, jsonb_build_object('body', left(x.txt, 1600), 'items', x.item_count)
    from (select rr.*, coalesce((select string_agg(left(coalesce(e->>'title', e->>'text', e->>'caption', e->>'name', ''), 300), ' · ') from jsonb_array_elements(case when jsonb_typeof(rr.items) = 'array' then rr.items else '[]'::jsonb end) e), '') as txt
          from public.research_runs rr where rr.workspace_id = p_ws and rr.status = 'succeeded') x
    where to_tsvector('english', x.label || ' ' || x.txt) @@ tq and (p_kinds is null or 'research' = any(p_kinds))
    union all
    select 'draft', o.id::text, coalesce(o.kind, 'Draft') || ': ' || o.title, ts_headline('english', coalesce(o.body, o.title), tq, hl), o.created_at, null,
      ts_rank(to_tsvector('english', o.title || ' ' || coalesce(o.body, '')), tq)::real, jsonb_build_object('body', left(coalesce(o.body, ''), 1600), 'status', o.status)
    from public.os_drafts o
    where o.workspace_id = p_ws and to_tsvector('english', o.title || ' ' || coalesce(o.body, '')) @@ tq and (p_kinds is null or 'draft' = any(p_kinds))
    union all
    select 'memory', m.id::text, initcap(m.kind), m.text, m.created_at, null,
      (ts_rank(to_tsvector('english', m.text), tq) * 1.1)::real, jsonb_build_object('body', m.text, 'status', m.status, 'due', m.due)
    from public.memory_items m
    where m.workspace_id = p_ws and to_tsvector('english', m.text) @@ tq and (p_kinds is null or 'memory' = any(p_kinds))
  ) s(kind, ref, title, snippet, at, url, rank, extra)
  order by s.rank desc, s.at desc nulls last
  limit least(greatest(coalesce(p_limit, 24), 1), 60);
end $function$
;

CREATE OR REPLACE FUNCTION private.check_current_ws()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
  if new.current_workspace is not null and not exists (select 1 from public.workspace_members m where m.workspace_id = new.current_workspace and m.user_id = new.id) then
    raise exception 'not a member of that workspace';
  end if;
  return new;
end; $function$
;

CREATE OR REPLACE FUNCTION private.content_learning_capture()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare k text; before_value jsonb; after_value jsonb;
begin
  if auth.uid() is null or not private.is_member(new.workspace_id)
    or not private.content_learning_enabled(new.workspace_id) then return new; end if;
  if tg_op='UPDATE' and old.workspace_id is distinct from new.workspace_id then return new; end if;
  if tg_table_name='content_items' then
    if tg_op='UPDATE' and new.stage is distinct from old.stage then
      if new.stage='passed' then k:='pass';
      elsif new.stage in ('approved','planned','production','published') and
        (old.stage in ('suggested','passed') or not exists(select 1 from public.content_learning_events
          where workspace_id=new.workspace_id and subject_key='content:'||new.id and kind='approve')) then k:='approve';
      end if;
    elsif tg_op='INSERT' and new.stage in ('approved','passed') and not(new.meta ? 'from_memory') and
      (new.meta->'sources' ? 'YOU' or new.meta ? 'approved_at' or new.meta ? 'passed_reason') then
      k:=case when new.stage='passed' then 'pass' else 'approve' end;
    end if;
    if k is not null then
      insert into public.content_learning_events(workspace_id,subject_key,content_id,kind,channel,format,title,reason,origin,created_by)
      values(new.workspace_id,'content:'||new.id,new.id,k,new.channel,new.format,left(new.title,300),
        case when k='pass' then left(coalesce(new.meta->>'passed_reason',''),1000) else '' end,'content',auth.uid());
    end if;
    -- Only the explicit manual-editor RPC sets this transaction-local marker.
    -- AI rewrites, stat refreshes, date changes and morning drafts are not edits.
    if tg_op='UPDATE' and current_setting('founder.content_manual_edit',true)=new.id::text then
      before_value:=private.content_learning_text(old.title,old.meta);
      after_value:=private.content_learning_text(new.title,new.meta);
      if before_value is distinct from after_value then
        insert into public.content_learning_events(workspace_id,subject_key,content_id,kind,channel,format,title,before_text,after_text,origin,created_by)
        values(new.workspace_id,'content:'||new.id,new.id,'edit',new.channel,new.format,left(new.title,300),before_value,after_value,'content',auth.uid());
      end if;
    end if;
  elsif tg_table_name='morning_suggestions' and tg_op='UPDATE' and new.state is distinct from old.state then
    if new.state='dismissed' then k:='dismiss';
    elsif new.state='production' and new.content_id is null then k:='approve';
    else k:=null; end if;
    if k is not null then
      insert into public.content_learning_events(workspace_id,subject_key,content_id,kind,channel,title,reason,origin,created_by)
      values(new.workspace_id,case when new.content_id is null then 'morning:'||new.id else 'content:'||new.content_id end,
        new.content_id,k,new.kind,left(new.title,300),
        case when k='dismiss' then 'Hidden from the morning briefing, not passed on the Content board.' else '' end,'morning',auth.uid());
    end if;
  end if;
  return new;
end $function$
;

CREATE OR REPLACE FUNCTION private.content_learning_collect(p_ws uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare c record; v jsonb; observed timestamptz; published timestamptz; cid uuid; data jsonb; sk text; platform text;
begin
  if not private.content_learning_enabled(p_ws) then return; end if;
  for c in select provider,meta from public.workspace_connections where workspace_id=p_ws
    and provider in ('youtube','youtube-2') and status='connected' loop
    observed:=private.content_learning_time(c.meta->>'last_sync_at');
    if observed is null or observed>now()+interval '1 day' or observed<now()-interval '90 days'
      or coalesce(c.meta->>'channel_id','')='' then continue; end if;
    for v in select value from jsonb_array_elements(case when jsonb_typeof(c.meta->'videos')='array' then c.meta->'videos' else '[]'::jsonb end) limit 100 loop
      if coalesce(v->>'id','') !~ '^[A-Za-z0-9_-]{11}$' then continue; end if;
      published:=private.content_learning_time(v->>'at');
      select id into cid from public.content_items where workspace_id=p_ws and meta->>'video_id'=v->>'id' order by created_at desc limit 1;
      sk:='yt:'||(c.meta->>'channel_id')||':'||(v->>'id');
      data:=jsonb_build_object('source_key',sk,'source','youtube','account',c.meta->>'channel_id','platform','youtube',
        'account_name',left(coalesce(c.meta->'channel'->>'title',c.meta->>'__label',c.meta->>'channel_id'),120),
        'content_id',cid,'title',left(coalesce(v->>'title','Untitled video'),300),
        'url','https://www.youtube.com/watch?v='||(v->>'id'),'duration',v->>'duration',
        'published_at',published,'observed_at',observed,
        'views',private.content_learning_number(v->>'views'),'likes',private.content_learning_number(v->>'likes'),
        'comments',private.content_learning_number(v->>'comments'));
      insert into public.content_learning_metrics(workspace_id,source_key,observed_day,observed_at,content_id,source,payload)
      values(p_ws,sk,(observed at time zone 'UTC')::date,observed,cid,'youtube',data)
      on conflict(workspace_id,source_key,observed_day) do update set
        observed_at=excluded.observed_at,content_id=excluded.content_id,payload=excluded.payload
        where public.content_learning_metrics.observed_at<excluded.observed_at
          or public.content_learning_metrics.content_id is distinct from excluded.content_id;
    end loop;
  end loop;
  for c in select id,title,channel,format,publish_at,meta from public.content_items
    where workspace_id=p_ws and stage='published' and jsonb_typeof(meta->'manual')='object' loop
    v:=c.meta->'manual'; observed:=private.content_learning_time(v->>'at');
    if observed is null or observed>now()+interval '1 day' or observed<now()-interval '90 days' then continue; end if;
    -- A connected YouTube reading wins over a manual duplicate of that video.
    if exists(select 1 from public.content_learning_metrics where workspace_id=p_ws and content_id=c.id and source='youtube') then continue; end if;
    published:=coalesce(private.content_learning_time(c.meta->>'published_at'),c.publish_at::timestamp at time zone 'UTC');
    platform:=coalesce(nullif(v->>'platform',''),case when c.channel in ('youtube','short') then 'youtube'
      when c.channel in ('instagram','reel','carousel') then 'instagram' when c.channel='tiktok' then 'tiktok'
      when c.channel in ('linkedin','facebook','x') then c.channel end);
    sk:='manual:'||c.id;
    data:=jsonb_build_object('source_key',sk,'source','manual','account',left(lower(trim(v->>'account')),120),'platform',platform,
      'account_name',left(trim(v->>'account'),120),
      'content_id',c.id,'title',left(c.title,300),'channel',c.channel,'format',c.format,
      'published_at',published,'observed_at',observed,
      'views',private.content_learning_number(v->>'views'),'likes',private.content_learning_number(v->>'likes'),
      'comments',private.content_learning_number(v->>'comments'));
    insert into public.content_learning_metrics(workspace_id,source_key,observed_day,observed_at,content_id,source,payload)
    values(p_ws,sk,(observed at time zone 'UTC')::date,observed,c.id,'manual',data)
    on conflict(workspace_id,source_key,observed_day) do update set
      observed_at=excluded.observed_at,payload=excluded.payload
      where public.content_learning_metrics.observed_at<excluded.observed_at;
  end loop;
end $function$
;

CREATE OR REPLACE FUNCTION private.content_learning_enabled(p_ws uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select coalesce((select enabled from public.content_learning_config where workspace_id=p_ws),true)
    and exists(select 1 from public.workspaces where id=p_ws and kind<>'demo');
$function$
;

CREATE OR REPLACE FUNCTION private.content_learning_inputs(p_ws uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare config public.content_learning_config;
begin
  insert into public.content_learning_config(workspace_id) values(p_ws) on conflict do nothing;
  select * into config from public.content_learning_config where workspace_id=p_ws;
  perform private.content_learning_collect(p_ws);
  return jsonb_build_object('settings',to_jsonb(config)-'workspace_id',
    'events',coalesce((select jsonb_agg(to_jsonb(x)-'workspace_id'-'created_by' order by sequence desc) from (
      select * from public.content_learning_events where workspace_id=p_ws
        and created_at>=greatest(config.since_at,now()-interval '90 days')
      order by sequence desc limit 1000) x),'[]'::jsonb),
    'snapshots',coalesce((select jsonb_agg(payload||jsonb_build_object('content_id',content_id)) from (
      select m.payload,m.content_id from public.content_learning_metrics m where m.workspace_id=p_ws
        and m.observed_at>=greatest(config.since_at,now()-interval '90 days')
        and ((m.source='manual' and exists(select 1 from public.content_items i where i.id=m.content_id and i.workspace_id=p_ws and i.stage='published')) or exists(select 1 from public.workspace_connections c where c.workspace_id=p_ws
          and c.provider in ('youtube','youtube-2') and c.status<>'not_connected' and c.meta->>'channel_id'=m.payload->>'account'))
      order by m.observed_at desc limit 5000) x),'[]'::jsonb));
end $function$
;

CREATE OR REPLACE FUNCTION private.content_learning_number(p_value text)
 RETURNS bigint
 LANGUAGE plpgsql
 IMMUTABLE
 SET search_path TO ''
AS $function$
declare n numeric;
begin
  if p_value is null or length(p_value)>20 or p_value !~ '^[0-9]+([.][0-9]+)?$' then return null; end if;
  n:=p_value::numeric;
  if n>9000000000000000 then return null; end if;
  return floor(n)::bigint;
exception when others then return null;
end $function$
;

CREATE OR REPLACE FUNCTION private.content_learning_text(p_title text, p_meta jsonb)
 RETURNS jsonb
 LANGUAGE sql
 IMMUTABLE
 SET search_path TO ''
AS $function$
  select jsonb_build_object('title',left(coalesce(p_title,''),300),
    'hook',left(coalesce(p_meta->>'hook',''),2000),
    'body',left(coalesce(p_meta->>'post_body',p_meta->>'body',''),12000),
    'caption',left(coalesce(p_meta->>'caption',''),3000));
$function$
;

CREATE OR REPLACE FUNCTION private.content_learning_time(p_value text)
 RETURNS timestamp with time zone
 LANGUAGE plpgsql
 STABLE
 SET search_path TO ''
 SET "TimeZone" TO 'UTC'
AS $function$
begin
  if p_value is null or p_value !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}' then return null; end if;
  return p_value::timestamptz;
exception when others then return null;
end $function$
;

CREATE OR REPLACE FUNCTION private.cron_ok(p_secret text)
 RETURNS boolean
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select exists (select 1 from private.app_config where key = 'cron_hash' and value = encode(extensions.digest(p_secret, 'sha256'), 'hex'));
$function$
;

CREATE OR REPLACE FUNCTION private.dna_compile(p_ws uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_facts text; v_prof text; v_offers text; v_funnels text; v_proven text; v_body text; v_hash text; v_write text; v_swipe text;
  n_facts int; n_offers int; n_funnels int; n_proven int; n_docs int; n_write int; n_swipe int; v_prof_at timestamptz; pr jsonb;
begin
  if p_ws is null or not exists (select 1 from public.workspaces w where w.id = p_ws) then return; end if;
  select count(*) into n_facts from public.brain_facts f where f.workspace_id = p_ws and f.status = 'approved';
  select string_agg(x.block, E'\n\n' order by x.ord) into v_facts from (
    select c.ord, c.label || E':\n' || string_agg('- ' || f.statement || case when f.weight >= 3 then ' (core)' else '' end, E'\n' order by f.weight desc, f.approved_at) as block
    from public.brain_facts f join (values ('identity','Who I am',1),('offers','What I sell',2),('revenue','How I make money',3),('audience','Who I serve',4),('voice','How I talk',5),('beliefs','What I believe',6),('proof','Proof and results',7),('goals','Where I am going',8),('stack','How I run it',9),('never','Never',10)) c(cat, label, ord) on c.cat = f.category
    where f.workspace_id = p_ws and f.status = 'approved' group by c.ord, c.label) x;

  select p.profile, p.studied_at into pr, v_prof_at from public.brain_profile p where p.workspace_id = p_ws;
  if pr is not null then
    v_prof := concat_ws(E'\n',
      case when pr->>'summary' is not null then 'Summary: ' || (pr->>'summary') end,
      case when jsonb_typeof(pr->'voice') = 'object' then 'Voice: ' || (pr->'voice')::text when pr->>'voice' is not null then 'Voice: ' || (pr->>'voice') end,
      case when jsonb_typeof(pr->'audience') = 'array' then 'Audience: ' || (select string_agg(value #>> '{}', '; ') from jsonb_array_elements(pr->'audience')) end,
      case when jsonb_typeof(pr->'beliefs') = 'array' then 'Beliefs: ' || (select string_agg(value #>> '{}', '; ') from jsonb_array_elements(pr->'beliefs')) end,
      case when jsonb_typeof(pr->'phrases') = 'array' and jsonb_array_length(pr->'phrases') > 0 then 'Phrases I repeat: ' || (select string_agg(coalesce(value->>'p', value #>> '{}'), ', ') from (select value from jsonb_array_elements(pr->'phrases') limit 10) x) end,
      case when jsonb_typeof(pr->'keywords') = 'array' and jsonb_array_length(pr->'keywords') > 0 then 'Words I use most: ' || (select string_agg(coalesce(value->>'w', value #>> '{}'), ', ') from (select value from jsonb_array_elements(pr->'keywords') limit 14) x) end,
      case when jsonb_typeof(pr->'stats') = 'object' and pr->'stats'->>'avg_sentence_words' is not null then 'Writing rhythm: about ' || (pr->'stats'->>'avg_sentence_words') || ' words per sentence, reading grade ' || coalesce(pr->'stats'->>'reading_grade', '?') end);
    if v_prof = '' then v_prof := null; end if;
  end if;
  select count(*) into n_docs from public.brain_docs d where d.workspace_id = p_ws and d.status = 'ready';
  select count(*) into n_write from public.writing_samples x where x.workspace_id = p_ws;
  v_write := private.dna_writing(p_ws);

  select count(*), string_agg('- ' || i.name
      || case when i.price is not null then ' (' || coalesce(i.currency || ' ', '') || trim(to_char(i.price, 'FM999G999G990D00')) || coalesce(' ' || i.price_note, '') || ')' else '' end
      || case when coalesce(i.summary, '') <> '' then '. ' || left(i.summary, 220) else '' end
      || case when coalesce(i.url, '') <> '' then '. Page: ' || i.url else '' end, E'\n' order by i.price desc nulls last, i.name)
    into n_offers, v_offers from public.dna_items i where i.workspace_id = p_ws and i.kind = 'offer' and i.included;
  select count(*), string_agg('- ' || i.name || case when coalesce(i.url, '') <> '' then ' (' || i.url || ')' else '' end
      || case when i.steps is not null then ', ' || i.steps || ' step' || case when i.steps = 1 then '' else 's' end else '' end
      || case when coalesce(i.summary, '') <> '' then '. ' || left(i.summary, 200) else '' end, E'\n' order by i.ext_updated_at desc nulls last, i.name)
    into n_funnels, v_funnels from public.dna_items i where i.workspace_id = p_ws and i.kind = 'funnel' and i.included;

  select count(*), string_agg('- "' || p.title || '" by ' || coalesce(p.author, 'a creator') || ', ' || p.outlier || 'x their median'
      || case when p.views is not null then ', ' || to_char(p.views, 'FM999G999G999') || ' views' else '' end || ' (' || p.platform || ' ' || p.format || ')', E'\n' order by p.outlier desc)
    into n_proven, v_proven from private.proven(p_ws, 12, 2) p;

  select count(*), string_agg('- ' || coalesce(nullif(s.analysis->>'name', ''), s.title, s.url, 'Untitled') || ' (' || s.kind || coalesce(', by ' || nullif(coalesce(nullif(s.analysis->>'brand', ''), s.brand), ''), '') || ')'
      || case when jsonb_typeof(s.analysis->'price_points') = 'array' and jsonb_array_length(s.analysis->'price_points') > 0 then '. Prices: ' || (select string_agg(coalesce(p->>'label', '') || ' ' || coalesce(p->>'price', ''), ', ') from (select p from jsonb_array_elements(s.analysis->'price_points') p limit 5) z) else '' end
      || case when coalesce(s.analysis->>'promise', '') <> '' then '. Promise: ' || rtrim(left(s.analysis->>'promise', 160), '. ') else '' end
      || case when coalesce(s.analysis->>'mechanism', '') <> '' then '. Why it sells: ' || rtrim(left(s.analysis->>'mechanism', 160), '. ') else '' end, E'\n' order by s.pinned desc, s.analyzed_at desc)
    into n_swipe, v_swipe from (select * from public.swipe_items x where x.workspace_id = p_ws and x.analyzed_at is not null order by x.pinned desc, x.analyzed_at desc limit 10) s;

  v_body := concat_ws(E'\n\n',
    'BRAND DNA. Read this before writing anything for this founder. Founder facts are always true and win over everything else. Write in the founder''s own voice as described under HOW I WRITE. Only use the offers and funnels listed here, with these names and prices. Every piece of content should start from a proven pattern and point to one of these offers or funnels.',
    case when v_facts is not null then E'FOUNDER FACTS\n' || v_facts end,
    v_write,
    case when v_prof is not null then E'STUDIED FROM MY OWN MATERIAL\n' || v_prof end,
    case when v_offers is not null then E'MY OFFERS\n' || v_offers end,
    case when v_funnels is not null then E'MY FUNNELS (hosted in HighLevel)\n' || v_funnels end,
    case when v_proven is not null then E'PROVEN IN MY SPACE (posts that beat their creator''s own median)\n' || v_proven end,
    null::text);
  v_hash := md5(v_body);

  insert into public.brand_dna as d (workspace_id, version, body, hash, counts, built_at, checked_at)
  values (p_ws, 1, v_body, v_hash, jsonb_build_object('facts', n_facts, 'offers', n_offers, 'funnels', n_funnels, 'proven', n_proven, 'docs', n_docs, 'writing', n_write, 'swipe', coalesce(n_swipe, 0), 'studied_at', v_prof_at), now(), now())
  on conflict (workspace_id) do update set
    version = case when d.hash is distinct from excluded.hash then d.version + 1 else d.version end,
    built_at = case when d.hash is distinct from excluded.hash then now() else d.built_at end,
    body = excluded.body, hash = excluded.hash, counts = excluded.counts, checked_at = now();
end $function$
;

CREATE OR REPLACE FUNCTION private.dna_save(p_ws uuid, p_items jsonb, p_kinds text[])
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare n int := 0; gone int := 0;
begin
  insert into public.dna_items as i (workspace_id, kind, source, ext_id, name, price, currency, price_note, summary, url, steps, included, ext_updated_at, synced_at)
  select p_ws, e->>'kind', 'highlevel', e->>'ext_id', left(e->>'name', 200), nullif(e->>'price', '')::numeric, nullif(e->>'currency', ''), nullif(e->>'price_note', ''),
    left(nullif(e->>'summary', ''), 600), nullif(e->>'url', ''), nullif(e->>'steps', '')::int, coalesce((e->>'included')::boolean, false), nullif(e->>'ext_updated_at', '')::timestamptz, now()
  from jsonb_array_elements(p_items) e where e->>'kind' = any(p_kinds) and coalesce(e->>'name', '') <> ''
  on conflict (workspace_id, kind, source, ext_id) do update set
    name = excluded.name, price = excluded.price, currency = excluded.currency, price_note = excluded.price_note, summary = excluded.summary,
    url = excluded.url, steps = excluded.steps, ext_updated_at = excluded.ext_updated_at, synced_at = now(), updated_at = now(),
    included = case when i.user_set then i.included else excluded.included end;
  get diagnostics n = row_count;
  delete from public.dna_items i where i.workspace_id = p_ws and i.source = 'highlevel' and i.kind = any(p_kinds)
    and not exists (select 1 from jsonb_array_elements(p_items) e where e->>'kind' = i.kind and e->>'ext_id' = i.ext_id);
  get diagnostics gone = row_count;
  perform private.dna_compile(p_ws);
  return json_build_object('saved', n, 'removed', gone);
end $function$
;

CREATE OR REPLACE FUNCTION private.dna_touch_new()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare w uuid; begin for w in select distinct workspace_id from nt loop perform private.dna_compile(w); end loop; return null; end $function$
;

CREATE OR REPLACE FUNCTION private.dna_touch_old()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare w uuid; begin for w in select distinct workspace_id from ot loop perform private.dna_compile(w); end loop; return null; end $function$
;

CREATE OR REPLACE FUNCTION private.dna_writing(p_ws uuid)
 RETURNS text
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare s record; n int; w int; v_guide text[]; v_ex text; v_out text;
begin
  select count(*), coalesce(sum(x.words), 0) into n, w from public.writing_samples x where x.workspace_id = p_ws;
  if n = 0 then return null; end if;
  select * into s from public.writing_style y where y.workspace_id = p_ws;
  v_guide := case when s.ai_guide is not null and array_length(s.ai_guide, 1) > 0 and s.ai_samples = n then s.ai_guide else s.guide end;
  select string_agg('--- ' || initcap(e.kind) || ': ' || e.title || E'\n' || e.ex, E'\n\n' order by e.ord) into v_ex from (
    select x.kind, x.title, row_number() over (order by x.pinned desc, x.created_at desc) as ord,
      case when char_length(x.body) > 900 then left(x.body, 900) || ' [...]' else x.body end as ex
    from public.writing_samples x where x.workspace_id = p_ws
    order by x.pinned desc, x.created_at desc limit 3) e;
  v_out := 'HOW I WRITE (studied from ' || n || ' piece' || case when n = 1 then '' else 's' end || ' I wrote myself, ' || to_char(w, 'FM999G999G990') || ' words). Write like this. Match the rhythm, the moves and the word choice. Never copy my lines word for word.';
  if v_guide is not null and array_length(v_guide, 1) > 0 then
    v_out := v_out || E'\n' || (select string_agg('- ' || g, E'\n') from unnest(v_guide) g);
  end if;
  if v_ex is not null then v_out := v_out || E'\n\nEXAMPLES OF MY OWN WRITING\n' || v_ex; end if;
  return v_out;
end $function$
;

CREATE OR REPLACE FUNCTION private.gfx_kit_row(p_ws uuid)
 RETURNS graphic_kits
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare k public.graphic_kits;
begin
  insert into public.graphic_kits (workspace_id) values (p_ws) on conflict (workspace_id) do nothing;
  select * into k from public.graphic_kits where workspace_id = p_ws;
  return k;
end $function$
;

CREATE OR REPLACE FUNCTION private.goal_inputs_for(p_ws uuid)
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select jsonb_build_object(
    'goals', coalesce((select jsonb_agg(jsonb_build_object('id', id, 'text', text, 'meta', meta, 'due', due, 'created_at', created_at)) from public.memory_items where workspace_id = p_ws and kind = 'goal' and status = 'open'), '[]'::jsonb),
    'conns', coalesce((select jsonb_agg(jsonb_build_object('provider', provider, 'status', status, 'meta', meta)) from public.workspace_connections where workspace_id = p_ws), '[]'::jsonb),
    'items', coalesce((select jsonb_agg(jsonb_build_object('id', id, 'kind', kind, 'name', name, 'ext_id', ext_id, 'source', source, 'url', url)) from public.dna_items where workspace_id = p_ws), '[]'::jsonb),
    'os', jsonb_build_object(
      'drafts-w', (select count(*) from public.os_drafts where workspace_id = p_ws and status = 'approved' and coalesce(decided_at, created_at) > now() - interval '7 days'),
      'promises-m', (select count(*) from public.memory_items where workspace_id = p_ws and kind = 'commitment' and status = 'done' and updated_at > now() - interval '30 days'),
      'calls-m', (select count(*) from public.recordings where workspace_id = p_ws and started_at > now() - interval '30 days'),
      'facts', (select count(*) from public.brain_facts where workspace_id = p_ws and status = 'approved'),
      'docs', (select count(*) from public.brain_docs where workspace_id = p_ws and status = 'ready'),
      'research-m', (select count(*) from public.research_runs where workspace_id = p_ws and status = 'succeeded' and created_at > now() - interval '30 days'),
      'creators', (select count(*) from public.creators where workspace_id = p_ws),
      'chat-w', (select count(*) from public.chat_messages where workspace_id = p_ws and role = 'user' and created_at > now() - interval '7 days')
    )
  );
$function$
;

CREATE OR REPLACE FUNCTION private.graphic_sets_gone()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin delete from private.graphic_assets where set_id = old.id; return old; end $function$
;

CREATE OR REPLACE FUNCTION private.idea_inputs(p_ws uuid)
 RETURNS json
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select json_build_object(
    'dna', (select body from public.brand_dna where workspace_id=p_ws),
    'offers', coalesce((select json_agg(json_build_object('kind',kind,'name',name,'price',price,'currency',currency,
      'price_note',price_note,'summary',summary,'url',url)) from public.dna_items
      where workspace_id=p_ws and included and kind in ('offer','funnel')),'[]'::json),
    'proven', coalesce((select json_agg(row_to_json(p)) from private.proven(p_ws,40,1.5) p),'[]'::json),
    'taken', coalesce((select json_agg(title) from (
      select c.title from public.content_items c where c.workspace_id=p_ws and c.created_at>now()-interval '120 days'
        and (not (c.stage='suggested' and c.meta ? 'morning')
          or exists (select 1 from public.morning_suggestions s where s.content_id=c.id))
      order by c.created_at desc limit 200) t),'[]'::json),
    'last', (select max(meta->>'morning') from public.content_items where workspace_id=p_ws and meta ? 'morning')
  );
$function$
;

CREATE OR REPLACE FUNCTION private.ideas_save(p_ws uuid, p_items jsonb)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare n int;
begin
  delete from public.content_items c where c.workspace_id=p_ws and c.stage='suggested' and c.meta ? 'morning'
    and not exists (select 1 from public.morning_suggestions s where s.content_id=c.id);
  insert into public.content_items (workspace_id,title,stage,channel,format,position,meta)
    select p_ws,left(coalesce(nullif(x->>'title',''),'Untitled idea'),300),'suggested',
      coalesce(x->>'channel','youtube'),x->>'format',-extract(epoch from now())/1e6 + o/1e9,
      coalesce(x->'meta','{}'::jsonb)
    from jsonb_array_elements(coalesce(p_items,'[]'::jsonb)) with ordinality as t(x,o) limit 120;
  get diagnostics n=row_count; return n;
end $function$
;

CREATE OR REPLACE FUNCTION private.is_admin()
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select exists (select 1 from public.user_access a where a.user_id = (select auth.uid()) and a.status = 'approved' and a.is_admin);
$function$
;

CREATE OR REPLACE FUNCTION private.is_approved(uid uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select exists (select 1 from public.user_access a where a.user_id = uid and a.status = 'approved');
$function$
;

CREATE OR REPLACE FUNCTION private.is_member(ws uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select exists (select 1 from public.workspace_members m where m.workspace_id = ws and m.user_id = (select auth.uid()))
     and private.is_approved((select auth.uid()));
$function$
;

CREATE OR REPLACE FUNCTION private.mcp_auth(p_hash text, p_client text DEFAULT NULL::text)
 RETURNS TABLE(workspace_id uuid, user_id uuid, ws_name text, ws_kind text, token_name text, last_client text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
#variable_conflict use_column
declare t public.mcp_tokens;
begin
  select * into t from public.mcp_tokens mt where mt.token_hash = p_hash and mt.revoked_at is null;
  if not found then raise exception 'invalid token' using errcode = '28000'; end if;
  if not exists (select 1 from public.workspace_members m where m.workspace_id = t.workspace_id and m.user_id = t.user_id) then raise exception 'invalid token' using errcode = '28000'; end if;
  if not private.is_approved(t.user_id) then raise exception 'invalid token' using errcode = '28000'; end if;
  if p_client is not null then
    update public.mcp_tokens mt set calls = mt.calls + 1, last_used_at = now(), last_client = coalesce(nullif(left(p_client, 80), ''), mt.last_client) where mt.id = t.id
    returning mt.* into t;
  end if;
  return query select w.id, t.user_id, w.name, w.kind, t.name, t.last_client from public.workspaces w where w.id = t.workspace_id;
end $function$
;

CREATE OR REPLACE FUNCTION private.mcp_cols(p_t text)
 RETURNS text[]
 LANGUAGE sql
 STABLE
 SET search_path TO ''
AS $function$
  select coalesce(array_agg(column_name::text order by ordinal_position), '{}')
  from information_schema.columns
  where table_schema = 'public' and table_name = p_t and is_generated = 'NEVER' and udt_name <> 'tsvector';
$function$
;

CREATE OR REPLACE FUNCTION private.mcp_require_write(p_hash text)
 RETURNS void
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
  if exists (select 1 from public.mcp_tokens t where t.token_hash = p_hash and t.revoked_at is null and t.scope in ('read', 'agent')) then
    raise exception 'This token cannot change anything. Create a token with write access in Founders AI OS under AI access.' using errcode = '42501';
  end if;
end $function$
;

CREATE OR REPLACE FUNCTION private.mcp_sections()
 RETURNS jsonb
 LANGUAGE sql
 IMMUTABLE
 SET search_path TO ''
AS $function$
select '{
 "content":       {"t":"content_items","w":["title","stage","channel","format","publish_at","position","meta"],"ops":"cud","note":"Content pipeline: suggested, approved, planned, production, published, passed"},
 "approvals":     {"t":"os_drafts","w":["kind","title","body","stream","action","source","meta","status"],"ops":"cud","note":"Drafts waiting for the founder. Status can be waiting or rejected; only the founder approves."},
 "ideas":         {"t":"morning_suggestions","w":["title","summary","why","payload"],"ops":"u","heavy":["evidence"],"note":"Morning ideas in Approvals. Edit wording only; the founder moves them."},
 "briefs":        {"t":"morning_briefs","w":[],"ops":"","note":"Morning brief runs (read only)"},
 "memory":        {"t":"memory_items","w":["kind","text","meta","due","status"],"ops":"cud","note":"Notes, ideas, decisions, commitments, waiting, people and goals (kind=goal)"},
 "facts":         {"t":"brain_facts","w":["category","statement","status","source","evidence","weight"],"ops":"cud","note":"Founder facts behind Brand DNA"},
 "documents":     {"t":"brain_docs","w":["title","category","summary"],"ops":"u","note":"Brain documents. Use search_brain for full text."},
 "brain_profile": {"t":"brain_profile","w":["profile"],"ops":"u","one":true,"note":"Studied founder profile"},
 "brand_dna":     {"t":"brand_dna","w":[],"ops":"","one":true,"heavy":["body"],"note":"Built Brand DNA (read only, rebuilt from facts, writing and offers)"},
 "dna_items":     {"t":"dna_items","w":["name","summary","price","currency","price_note","url","steps","included","user_set"],"ops":"u","note":"Synced offers and funnels feeding Brand DNA"},
 "strategy":      {"t":"founder_strategy","w":["kind","name","lifecycle","summary","price","currency","price_note","url","steps","linked_offer_id","details"],"ops":"cud","note":"Offers and funnels strategy (live, planned, paused, archived)"},
 "programs":      {"t":"programs","w":["data","archived"],"ops":"cu","note":"Courses and coaching boards. Every save keeps a version."},
 "program_materials": {"t":"program_materials","w":["title","notes"],"ops":"u","heavy":["body"],"note":"Files attached to programs"},
 "program_proposals": {"t":"program_proposals","w":[],"ops":"","heavy":["data","changes"],"note":"Program changes waiting for confirmation (read only)"},
 "emails":        {"t":"email_sets","w":["sequence","title","item_name","context","emails"],"ops":"cud","note":"Email sequences"},
 "vault":         {"t":"swipe_items","w":["kind","title","brand","url","body","notes","tags","pinned"],"ops":"cud","heavy":["page_text","images","analysis"],"note":"Swipe vault"},
 "vault_notes":   {"t":"vault_notes","w":["title","purpose","body","context","enabled","pinned","archived"],"ops":"cud","note":"Vault briefs used as creation context"},
 "writing":       {"t":"writing_samples","w":["title","kind","body","pinned"],"ops":"cud","note":"Writing samples that train the founder voice"},
 "writing_style": {"t":"writing_style","w":["profile","guide"],"ops":"u","one":true,"note":"Writing style profile and guide"},
 "creators":      {"t":"creators","w":["name","ig_handle","yt_url","x_handle","li_url","fb_url","news_url","news_kind"],"ops":"cud","note":"Tracked creators"},
 "creator_posts": {"t":"creator_posts","w":["picked"],"ops":"ud","note":"Creator posts (picked=true keeps one as proven content)"},
 "research":      {"t":"research_runs","w":["label"],"ops":"ud","heavy":["items","input"],"note":"Research runs"},
 "brand_board":   {"t":"graphic_kits","w":["palette","fonts","style","handle","palettes","font_sets"],"ops":"u","one":true,"note":"Shared Brand board: palettes, fonts, handle, style"},
 "graphics":      {"t":"graphic_sets","w":["title","copy","plan","slides"],"ops":"ud","heavy":["input"],"note":"Graphic sets"},
 "funnels":       {"t":"funnel_builds","w":["title","answers","offer","copy","emails","brand"],"ops":"ud","heavy":["html","versions","revisions","research","visuals","design","assets","qa","draft","steps"],"note":"Funnel builds. Use funnel_update to change page html."},
 "videos":        {"t":"video_projects","w":["title","data","archived"],"ops":"cud","note":"Video editor projects"},
 "video_edits":   {"t":"tella_edits","w":["title","plan","notes","archived"],"ops":"u","heavy":["source","run"],"note":"Tella storyboard edits"},
 "agents":        {"t":"founder_agents","w":["name","role","instructions","model","enabled","archived"],"ops":"cud","note":"Founder agents"},
 "routines":      {"t":"recurring_tasks","w":["name","instructions","deliverable","output","format","platform","idea_count","tags","enabled","archived"],"ops":"u","note":"Recurring agent routines"},
 "agent_proposals": {"t":"agent_proposals","w":[],"ops":"","note":"Agent changes waiting for confirmation (read only)"},
 "playbook":      {"t":"coach_playbook","w":["topic","question","keywords","answer","status","position"],"ops":"cud","note":"AI Coach Playbook answers"},
 "chats":         {"t":"chat_threads","w":["title"],"ops":"u","note":"AI Chat threads"},
 "chat_messages": {"t":"chat_messages","w":[],"ops":"","heavy":["sources","room"],"note":"AI Chat messages (filter by thread_id)"},
 "recordings":    {"t":"recordings","w":["title","review"],"ops":"u","note":"Call recordings and reviews. Use get_recordings for transcripts."},
 "grok_tasks":    {"t":"grok_tasks","w":[],"ops":"","note":"Grok Bot handoffs (use grok_task_update to report)"},
 "affiliate":     {"t":"affiliate_events","w":[],"ops":"","heavy":["raw"],"note":"Affiliate events (read only)"},
 "changes":       {"t":"mcp_changes","w":[],"ops":"","heavy":["before","after"],"note":"Log of AI edits. Undo with os_undo."}
}'::jsonb;
$function$
;

CREATE OR REPLACE FUNCTION private.mcp_trim(p_row jsonb, p_heavy text[])
 RETURNS jsonb
 LANGUAGE sql
 IMMUTABLE
 SET search_path TO ''
AS $function$
  select coalesce(jsonb_object_agg(k, case
    when jsonb_typeof(v) = 'string' and length(v #>> '{}') > 500 then to_jsonb(left(v #>> '{}', 500) || '... [read by id for full text]')
    when jsonb_typeof(v) in ('object','array') and length(v::text) > 3000 then to_jsonb('[large, read by id]'::text)
    else v end), '{}'::jsonb)
  from jsonb_each(p_row - coalesce(p_heavy, '{}')) e(k, v);
$function$
;

CREATE OR REPLACE FUNCTION private.mcp_write(a_ws uuid, a_user uuid, p_section text, p_op text, p_id text, p_data jsonb, p_client text, p_log boolean DEFAULT true)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare c jsonb; t text; cols text[]; wr text[]; keys text[]; one boolean; before jsonb; after jsonb; rid text;
  setl text; sel text; ins text; newid uuid; mat_missing boolean; chg uuid;
begin
  c := private.mcp_sections() -> p_section;
  if c is null then raise exception 'Unknown section %. Call os_sections first.', p_section; end if;
  if p_op not in ('create','update','delete') then raise exception 'op must be create, update or delete'; end if;
  if position(left(p_op, 1) in c->>'ops') = 0 then raise exception 'Section % does not allow %', p_section, p_op; end if;
  t := c->>'t'; cols := private.mcp_cols(t); one := coalesce((c->>'one')::boolean, false);
  wr := array(select jsonb_array_elements_text(c->'w'));
  if p_data is not null and jsonb_typeof(p_data) <> 'object' then raise exception 'data must be an object'; end if;
  keys := array(select k from jsonb_object_keys(coalesce(p_data, '{}')) k where k = any(wr));
  if p_op <> 'delete' and cardinality(keys) = 0 then
    raise exception 'Nothing to write. Writable fields for %: %', p_section, array_to_string(wr, ', ');
  end if;
  -- guards that keep founder-only decisions with the founder
  if t = 'os_drafts' and p_data ? 'status' and p_data->>'status' not in ('waiting','rejected') then
    raise exception 'Only the founder approves drafts. Set status to waiting or rejected.';
  end if;
  if t = 'programs' and p_data ? 'data' then
    if not private.program_valid(p_data->'data') then raise exception 'Invalid program data'; end if;
    select exists(select 1 from jsonb_array_elements(p_data->'data'->'stages') s cross join lateral jsonb_array_elements(s->'cards') cd
      cross join lateral jsonb_array_elements_text(coalesce(cd->'material_ids', '[]')) m
      where not exists(select 1 from public.program_materials pm where pm.workspace_id = a_ws and pm.id::text = m and not pm.removal_pending))
      into mat_missing;
    if mat_missing then raise exception 'A material is not in this workspace'; end if;
  end if;

  if one then
    if p_op <> 'update' then raise exception 'Section % has one row; use update', p_section; end if;
    execute format('insert into public.%I (workspace_id) values ($1) on conflict do nothing', t) using a_ws;
    execute format('select to_jsonb(x) from public.%I x where workspace_id = $1 for update', t) into before using a_ws;
    rid := a_ws::text;
  elsif p_op in ('update','delete') then
    if p_id is null then raise exception 'id is required'; end if;
    execute format('select to_jsonb(x) from public.%I x where workspace_id = $1 and id::text = $2 for update', t) into before using a_ws, p_id;
    if before is null then raise exception 'Not found in %', p_section; end if;
    rid := p_id;
  end if;

  if p_op = 'delete' then
    execute format('delete from public.%I where workspace_id = $1 and id::text = $2', t) using a_ws, p_id;
    after := null;
  elsif p_op = 'update' then
    if t = 'programs' then
      insert into public.program_versions(program_id, workspace_id, revision, data, archived, created_by)
      values ((before->>'id')::uuid, a_ws, (before->>'revision')::int, before->'data', coalesce((before->>'archived')::boolean, false), a_user);
    end if;
    setl := (select string_agg(format('%I = r.%I', k, k), ', ') from unnest(keys) k);
    if 'revision' = any(cols) then setl := setl || ', revision = x.revision + 1'; end if;
    if 'updated_at' = any(cols) then setl := setl || ', updated_at = now()'; end if;
    if t = 'dna_items' then setl := setl || ', user_set = true'; end if;
    if t = 'writing_samples' and 'body' = any(keys) then
      setl := setl || ', words = coalesce(array_length(regexp_split_to_array(trim(r.body), ''\s+''), 1), 0)';
    end if;
    if t = 'brain_facts' and p_data->>'status' = 'approved' then setl := setl || ', approved_at = coalesce(x.approved_at, now())'; end if;
    execute format('update public.%I x set %s from jsonb_populate_record(null::public.%I, $3) r where x.workspace_id = $1 and %s returning to_jsonb(x)',
      t, setl, t, case when one then 'true' else 'x.id::text = $2' end) into after using a_ws, rid, p_data;
  else
    sel := (select string_agg(format('r.%I', k), ', ') from unnest(keys) k);
    ins := (select string_agg(format('%I', k), ', ') from unnest(keys) k);
    if 'created_by' = any(cols) then ins := ins || ', created_by'; sel := sel || ', $2'; end if;
    if t = 'programs' then ins := ins || ', origin'; sel := sel || ', ''ai'''; end if;
    if t = 'brain_facts' and not p_data ? 'status' then ins := ins || ', status'; sel := sel || ', ''proposed'''; end if;
    if t = 'writing_samples' then ins := ins || ', words'; sel := sel || ', coalesce(array_length(regexp_split_to_array(trim(r.body), ''\s+''), 1), 0)'; end if;
    execute format('insert into public.%I (workspace_id, %s) select $1, %s from jsonb_populate_record(null::public.%I, $3) r returning to_jsonb(%I)',
      t, ins, sel, t, t) into after using a_ws, a_user, p_data;
    rid := after->>'id';
  end if;

  if p_log then
    insert into public.mcp_changes(workspace_id, section, row_id, op, before, after, client)
    values (a_ws, p_section, rid, p_op, before, after, left(p_client, 80)) returning id into chg;
  end if;
  return jsonb_build_object('ok', true, 'section', p_section, 'op', p_op, 'id', rid, 'change_id', chg,
    'row', private.mcp_trim(coalesce(after, before) - 'workspace_id', '{}'));
end $function$
;

CREATE OR REPLACE FUNCTION private.morning_snapshot(p_ws uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  tz text := private.app_tz();
  d date := (now() at time zone tz)::date;
  b public.morning_briefs; cur public.morning_briefs; h text;
begin
  select * into cur from public.morning_briefs where workspace_id = p_ws and day = d;
  select * into b from public.morning_briefs where workspace_id = p_ws and revision > 0 order by day desc limit 1;
  if b.id is null then b := cur; end if;
  select hash into h from public.brand_dna where workspace_id = p_ws;
  return jsonb_build_object('today', d, 'timezone', tz, 'schedule_utc', '05:15',
    'current', case when cur.id is null then null else to_jsonb(cur) - 'lease' end,
    'brief', case when b.id is null then null else to_jsonb(b) - 'lease' end,
    'context_changed', b.context_hash is not null and b.context_hash is distinct from h,
    'items', coalesce((select jsonb_agg(to_jsonb(s) || jsonb_build_object(
      'content_stage', c.stage, 'content_title', c.title,
      'state', case when c.stage in ('production','published') then 'production' when c.stage = 'passed' then 'dismissed' else s.state end
    ) order by s.position) from public.morning_suggestions s
    left join public.content_items c on c.id = s.content_id and c.workspace_id = p_ws
    where s.workspace_id = p_ws and s.brief_id = b.id and
      (s.revision = b.revision or s.state = 'production')), '[]'::jsonb));
end $function$
;

CREATE OR REPLACE FUNCTION private.program_valid(v jsonb)
 RETURNS boolean
 LANGUAGE plpgsql
 IMMUTABLE
 SET search_path TO ''
AS $function$
declare s jsonb; c jsonb; ids text[] := '{}'; n integer := 0;
begin
  if v is null or jsonb_typeof(v)<>'object' or octet_length(v::text)>1200000 then return false; end if;
  if coalesce(jsonb_typeof(v->'title'),'')<>'string' or char_length(v->>'title') not between 1 and 200
    or coalesce(v->>'kind','') not in ('course','coaching') or coalesce(v->>'access','') not in ('free','paid')
    or coalesce(jsonb_typeof(v->'description'),'')<>'string' or char_length(v->>'description')>6000
    or coalesce(jsonb_typeof(v->'stages'),'')<>'array' then return false; end if;
  if v->'stages' is null or jsonb_array_length(v->'stages')>24 then return false; end if;
  for s in select value from jsonb_array_elements(v->'stages') loop
    if jsonb_typeof(s)<>'object' or coalesce(s->>'id','') !~ '^[a-f0-9-]{36}$'
      or coalesce(jsonb_typeof(s->'title'),'')<>'string' or coalesce(char_length(s->>'title'),0) not between 1 and 200
      or coalesce(jsonb_typeof(s->'cards'),'')<>'array' then return false; end if;
    if s->'cards' is null or jsonb_array_length(s->'cards')>100 or (s->>'id')=any(ids) then return false; end if;
    ids:=array_append(ids,s->>'id');
    for c in select value from jsonb_array_elements(s->'cards') loop
      n:=n+1;
      if n>300 or jsonb_typeof(c)<>'object' or coalesce(c->>'id','') !~ '^[a-f0-9-]{36}$'
        or (c->>'id')=any(ids) or coalesce(jsonb_typeof(c->'title'),'')<>'string' or coalesce(char_length(c->>'title'),0) not between 1 and 200
        or coalesce(jsonb_typeof(c->'body'),'')<>'string' or char_length(c->>'body')>20000
        or coalesce(c->>'kind','') not in ('lesson','session','exercise','resource')
        or coalesce(c->>'status','') not in ('idea','draft','ready')
        or coalesce(jsonb_typeof(c->'material_ids'),'')<>'array' then return false; end if;
      if c->'material_ids' is null or jsonb_array_length(c->'material_ids')>30 then return false; end if;
      if exists(select 1 from jsonb_array_elements_text(c->'material_ids') m where m !~ '^[a-f0-9-]{36}$') then return false; end if;
      ids:=array_append(ids,c->>'id');
    end loop;
  end loop;
  return true;
exception when others then return false;
end $function$
;

CREATE OR REPLACE FUNCTION private.proven(p_ws uuid, p_limit integer DEFAULT 12, p_min numeric DEFAULT 2)
 RETURNS TABLE(title text, author text, platform text, format text, views bigint, outlier numeric, url text, thumb text, posted_at timestamp with time zone, src text)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  with base as (
    -- Written posts have no public view count everywhere, so they rank on reactions, comments and reposts.
    select p.id, p.creator_id, p.platform, p.format, p.title, p.url, p.thumb, p.posted_at, c.name as cname,
      case when p.platform in ('x','linkedin','facebook','newsletter') then nullif(coalesce(p.likes, 0) + coalesce(p.comments, 0) + coalesce(p.shares, 0), 0) else p.views end as views
    from public.creator_posts p join public.creators c on c.id = p.creator_id
    where p.workspace_id = p_ws and p.format not in ('carousel','photo')
  ), base2 as (select * from base where views is not null
  ), m as (
    select creator_id, platform, format, percentile_cont(0.5) within group (order by views) as med from base2 group by 1, 2, 3
  ), cp as (
    select base2.*, m.med from base2 join m using (creator_id, platform, format)
  ), a as (
    select cp.title, cp.cname as author, cp.platform, cp.format, cp.views::bigint as views,
      round((cp.views / nullif(cp.med, 0))::numeric, 1) as outlier, cp.url, cp.thumb, cp.posted_at, 'creators'::text as src
    from cp where cp.med > 0 and cp.title is not null
  ), b as (
    select distinct on (e->>'url') e->>'title' as title, e->>'author' as author,
      case when r.preset like 'ig-%' then 'instagram' when r.preset like 'tt-%' then 'tiktok' when r.preset like 'x-%' then 'x' else 'youtube' end as platform,
      case when r.preset like 'x-%' then 'post' else 'video' end::text as format, nullif(e->>'views', '')::numeric::bigint as views, nullif(e->>'outlier', '')::numeric as outlier,
      e->>'url' as url, e->>'thumb' as thumb, nullif(e->>'date', '')::timestamptz as posted_at, 'research'::text as src
    from public.research_runs r, jsonb_array_elements(case when jsonb_typeof(r.items) = 'array' then r.items else '[]'::jsonb end) e
    where r.workspace_id = p_ws and r.status = 'succeeded' and r.preset in ('yt-channels','yt-search','ig-profiles','tt-profiles','x-search')
      and e->>'title' is not null and e->>'outlier' ~ '^[0-9.]+$'
    order by e->>'url', r.created_at desc
  )
  select y.title, y.author, y.platform, y.format, y.views, y.outlier, y.url, y.thumb, y.posted_at, y.src from (
    select distinct on (lower(left(split_part(x.title, E'\n', 1), 140))) left(split_part(x.title, E'\n', 1), 140) as title, x.author, x.platform, x.format, x.views, x.outlier, x.url, x.thumb, x.posted_at, x.src
    from (select * from a union all select * from b) x
    where x.outlier >= p_min and (x.posted_at is null or x.posted_at > now() - interval '400 days') and length(trim(split_part(x.title, E'\n', 1))) > 3
    order by lower(left(split_part(x.title, E'\n', 1), 140)), x.outlier desc
  ) y
  order by y.outlier desc, y.views desc nulls last
  limit greatest(1, least(p_limit, 200));
$function$
;

CREATE OR REPLACE FUNCTION private.queue_legacy_draft()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
  if new.status='waiting' then
    insert into public.content_items(id,workspace_id,title,stage,channel,format,position,meta,created_by,created_at,updated_at)
    values(new.id,new.workspace_id,left(new.title,300),'suggested',
      case when lower(new.kind) like '%email%' then 'email' when lower(new.kind) like '%video%' or lower(new.kind) like '%youtube%' then 'youtube' else 'post' end,
      case when lower(new.kind) like '%email%' then 'email' when lower(new.kind) like '%video%' or lower(new.kind) like '%youtube%' then 'long' else 'post' end,
      -extract(epoch from new.created_at)/1e6,
      coalesce(new.meta,'{}')||jsonb_build_object('legacy_draft',new.id,'draft_body',new.body,'post_body',new.body,
        'requested_artifact',new.kind,'source',new.source,'tags',jsonb_build_array('draft')),
      new.created_by,new.created_at,new.created_at) on conflict(id) do nothing;
  end if;
  return new;
end $function$
;

CREATE OR REPLACE FUNCTION private.recording_store(p_ws uuid, p_rec jsonb, p_chunks jsonb)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare rid uuid;
begin
  insert into public.recordings(workspace_id, source, ext_id, title, started_at, minutes, url, words, status, error, updated_at)
  values (p_ws, coalesce(p_rec->>'source', 'zoom'), p_rec->>'ext_id', coalesce(left(p_rec->>'title', 200), 'Recording'), (p_rec->>'started_at')::timestamptz,
    (p_rec->>'minutes')::integer, p_rec->>'url', coalesce((p_rec->>'words')::integer, 0), coalesce(p_rec->>'status', 'ready'), left(p_rec->>'error', 240), now())
  on conflict (workspace_id, source, ext_id) do update set title = excluded.title, started_at = excluded.started_at, minutes = excluded.minutes, url = excluded.url,
    words = excluded.words, status = excluded.status, error = excluded.error, updated_at = now()
  returning id into rid;
  delete from public.recording_chunks where recording_id = rid;
  insert into public.recording_chunks(recording_id, workspace_id, idx, at_s, speakers, body)
  select rid, p_ws, (e->>'idx')::integer, (e->>'at_s')::integer, left(e->>'speakers', 300), left(e->>'body', 4000)
  from jsonb_array_elements(coalesce(p_chunks, '[]'::jsonb)) e where coalesce(e->>'body', '') <> '';
  return rid;
end $function$
;

CREATE OR REPLACE FUNCTION private.task_next(p_schedule jsonb, p_after timestamp with time zone)
 RETURNS timestamp with time zone
 LANGUAGE plpgsql
 STABLE
 SET search_path TO ''
AS $function$
declare tz text:=p_schedule->>'timezone'; cadence text:=p_schedule->>'cadence'; tm text:=p_schedule->>'time';
  d date; candidate timestamptz; wd int; md int; i int;
begin
  if tz is null or not exists(select 1 from pg_timezone_names where name=tz) then raise exception 'Choose a valid time zone.'; end if;
  if cadence is null or cadence not in ('daily','weekdays','weekly','monthly') or tm is null or tm !~ '^(0[0-9]|1[0-9]|2[0-3]):[0-5][0-9]$' then raise exception 'Invalid recurrence.'; end if;
  wd:=coalesce((p_schedule->>'weekday')::int,1); md:=coalesce((p_schedule->>'month_day')::int,1);
  if wd not between 0 and 6 or md not between 1 and 28 then raise exception 'Invalid recurrence day.'; end if;
  for i in 0..62 loop
    d:=(p_after at time zone tz)::date+i;
    if cadence='weekdays' and extract(isodow from d)>5 then continue; end if;
    if cadence='weekly' and extract(dow from d)<>wd then continue; end if;
    if cadence='monthly' and extract(day from d)<>md then continue; end if;
    candidate:=(d+tm::time) at time zone tz;
    if candidate>p_after then return candidate; end if;
  end loop;
  raise exception 'No next scheduled time was found.';
end $function$
;

CREATE OR REPLACE FUNCTION private.task_put(p_ws uuid, p_agent uuid, p_kind text, p jsonb)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare r public.recurring_tasks; pid uuid:=(p->>'id')::uuid;
begin
  perform private.task_validate(p);
  select * into r from public.recurring_tasks where id=pid for update;
  if found and (r.workspace_id<>p_ws or r.agent_id is distinct from p_agent or r.kind<>p_kind) then raise exception 'not allowed' using errcode='42501'; end if;
  insert into public.recurring_tasks(id,workspace_id,agent_id,kind,name,instructions,deliverable,output,format,platform,idea_count,tags,schedule,enabled,next_run_at)
  values(pid,p_ws,p_agent,p_kind,trim(p->>'name'),coalesce(p->>'instructions',''),trim(p->>'deliverable'),p->>'output',p->>'format',p->>'platform',(p->>'count')::int,p->'tags',p->'schedule',coalesce((p->>'enabled')::boolean,true),private.task_next(p->'schedule',now()))
  on conflict(id) do update set name=excluded.name,instructions=excluded.instructions,deliverable=excluded.deliverable,
    output=excluded.output,format=excluded.format,platform=excluded.platform,idea_count=excluded.idea_count,
    tags=excluded.tags,schedule=excluded.schedule,enabled=excluded.enabled,archived=false,
    next_run_at=case when recurring_tasks.schedule=excluded.schedule and recurring_tasks.enabled=excluded.enabled and not recurring_tasks.archived then recurring_tasks.next_run_at else excluded.next_run_at end,
    revision=recurring_tasks.revision+1,updated_at=now();
end $function$
;

CREATE OR REPLACE FUNCTION private.task_validate(p jsonb)
 RETURNS void
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
begin
  if jsonb_typeof(p) is distinct from 'object' or length(trim(coalesce(p->>'name',''))) not between 1 and 140
    or length(coalesce(p->>'instructions',''))>12000 or length(trim(coalesce(p->>'deliverable',''))) not between 1 and 2000
    or coalesce(p->>'output','') not in ('brief','ideas') or coalesce(p->>'format','') not in ('youtube','short','reel','carousel','tiktok','post','email','newsletter','article','podcast')
    or coalesce(p->>'platform','') not in ('youtube','instagram','tiktok','linkedin','facebook','x','community','email','website','podcast')
    or coalesce((p->>'count')::int,0) not between 1 and 10
    or jsonb_typeof(p->'tags') is distinct from 'array' or jsonb_array_length(p->'tags')>12 then raise exception 'Invalid task.'; end if;
  if exists(select 1 from jsonb_array_elements(p->'tags') t where jsonb_typeof(t)<>'string' or length(t#>>'{}')>40) then raise exception 'Invalid task tags.'; end if;
  if not (
    (p->>'format' in ('youtube','short') and p->>'platform'='youtube') or
    (p->>'format'='reel' and p->>'platform'='instagram') or
    (p->>'format'='tiktok' and p->>'platform'='tiktok') or
    (p->>'format'='carousel' and p->>'platform' in ('instagram','linkedin')) or
    (p->>'format'='post' and p->>'platform' in ('linkedin','facebook','x','instagram','community')) or
    (p->>'format' in ('email','newsletter') and p->>'platform'='email') or
    (p->>'format'='article' and p->>'platform' in ('website','linkedin')) or
    (p->>'format'='podcast' and p->>'platform'='podcast')) then raise exception 'Format and platform do not match.'; end if;
  perform private.task_next(p->'schedule',now());
end $function$
;

CREATE OR REPLACE FUNCTION private.vault_notes_for(p_ws uuid, p_query text, p_purpose text, p_ids uuid[])
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  with words as (
    select nullif(string_agg(w,' | '),'') as q from
    (select distinct w from regexp_split_to_table(lower(left(coalesce(p_query,''),1800)),'[^a-z0-9]+') w
     where length(w)>3 and w not in ('write','create','draft','about','this','that','with','from','offer','email','sales','page') limit 24) a
  ), query as (select case when q is not null then to_tsquery('english',q) end as q from words),
  ranked as (
    select n.*,case when query.q is null then 0 else ts_rank_cd(n.search_text,query.q) end as relevance
    from public.vault_notes n cross join query
    where n.workspace_id=p_ws and not n.archived and
      (case when cardinality(p_ids)>0 then n.id=any(p_ids)
       else n.enabled and (n.pinned or (query.q is not null and n.search_text @@ query.q)) end)
    order by case when cardinality(p_ids)>0 then array_position(p_ids,n.id) end,
      relevance desc,n.pinned desc,(n.purpose=p_purpose) desc,n.updated_at desc
    limit case when cardinality(p_ids)>0 then 4 else 3 end
  ) select coalesce(jsonb_agg(to_jsonb(r)-'search_text'-'relevance'),'[]') from ranked r;
$function$
;

CREATE OR REPLACE FUNCTION private.video_plan_valid(p jsonb, d numeric)
 RETURNS boolean
 LANGUAGE plpgsql
 IMMUTABLE
 SET search_path TO ''
AS $function$
declare s jsonb;t numeric:=0;
begin
  if jsonb_typeof(p) is distinct from 'object' or jsonb_typeof(p->'segments') is distinct from 'array'
    or jsonb_array_length(p->'segments') not between 1 and 500 or jsonb_typeof(p->'style') is distinct from 'object'
    or coalesce(p->'style'->>'aspect','') not in ('16:9','9:16','1:1')
    or coalesce(p->'style'->>'fit','') not in ('cover','contain') or (p->'style'->>'fps')::int<>30
    or jsonb_typeof(p->'style'->'captions') is distinct from 'boolean'
    or coalesce(p->'style'->>'text_color','') !~ '^#[a-fA-F0-9]{6}$' then return false;end if;
  for s in select * from jsonb_array_elements(p->'segments') loop
    if jsonb_typeof(s) is distinct from 'object' or jsonb_typeof(s->'start') is distinct from 'number'
      or jsonb_typeof(s->'end') is distinct from 'number' or (s->>'start')::numeric<0
      or (s->>'end')::numeric>d+.05 or (s->>'end')::numeric-(s->>'start')::numeric<.1
      or coalesce((s->>'zoom')::numeric,0) not between 1 and 1.8
      or coalesce((s->>'focus_x')::numeric,-1) not between 0 and 1
      or coalesce((s->>'focus_y')::numeric,-1) not between 0 and 1
      or length(coalesce(s->>'overlay',''))>150 then return false;end if;
    t:=t+(s->>'end')::numeric-(s->>'start')::numeric;
  end loop;return t<=14400;
exception when others then return false;
end $function$
;

CREATE OR REPLACE FUNCTION public.account_delete(p_confirm text)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'private', 'auth', 'pg_temp'
AS $function$
declare
  uid uuid := auth.uid();
  n_ws integer;
begin
  if uid is null then raise exception 'Sign in first' using errcode = '42501'; end if;
  if lower(btrim(coalesce(p_confirm, ''))) <> 'delete' then raise exception 'Type delete to confirm' using errcode = '22023'; end if;
  if exists (select 1 from public.user_access a where a.user_id = uid and a.is_admin) then
    raise exception 'Admin accounts cannot be deleted from Settings.' using errcode = '42501';
  end if;
  delete from public.coach_usage where user_id = uid;
  with d as (delete from public.workspaces where owner_id = uid returning 1) select count(*) into n_ws from d;
  delete from auth.users where id = uid;
  return json_build_object('deleted', true, 'workspaces', n_ws);
end;
$function$
;

CREATE OR REPLACE FUNCTION public.admin_access_list()
 RETURNS TABLE(user_id uuid, email text, full_name text, status text, is_admin boolean, requested_at timestamp with time zone, decided_at timestamp with time zone, confirmed boolean, last_sign_in timestamp with time zone)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
  if not private.is_admin() then raise exception 'not allowed' using errcode = '42501'; end if;
  return query select a.user_id, u.email::text, p.full_name, a.status, a.is_admin, a.requested_at, a.decided_at, u.email_confirmed_at is not null, u.last_sign_in_at
    from public.user_access a join auth.users u on u.id = a.user_id left join public.profiles p on p.id = a.user_id
    order by (a.status = 'pending') desc, a.requested_at desc;
end $function$
;

CREATE OR REPLACE FUNCTION public.admin_access_set(p_user uuid, p_status text)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare r public.user_access;
begin
  if not private.is_admin() then raise exception 'not allowed' using errcode = '42501'; end if;
  if p_status not in ('pending','approved','denied') then raise exception 'unknown status'; end if;
  if p_user = (select auth.uid()) then raise exception 'You cannot change your own access'; end if;
  update public.user_access set status = p_status, decided_at = now(), decided_by = (select auth.uid()) where user_id = p_user returning * into r;
  if not found then raise exception 'No such account'; end if;
  return json_build_object('user_id', r.user_id, 'status', r.status);
end $function$
;

CREATE OR REPLACE FUNCTION public.affiliate_done(p_secret text, p_ws uuid, p_key text, p_contact text, p_tags text[], p_status text, p_note text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
  if not private.cron_ok(p_secret) then raise exception 'not allowed' using errcode = '42501'; end if;
  update public.affiliate_events set contact_id = p_contact, tags = coalesce(p_tags, tags), status = p_status, note = p_note
   where workspace_id = p_ws and event_key = p_key;
end $function$
;

CREATE OR REPLACE FUNCTION public.affiliate_hook(p_ws uuid, p_rotate boolean DEFAULT false, p_settings jsonb DEFAULT NULL::jsonb)
 RETURNS TABLE(token text, settings jsonb)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
  if auth.uid() is null or not private.is_member(p_ws) then raise exception 'not allowed' using errcode = '42501'; end if;
  insert into private.affiliate_hooks(workspace_id, token) values (p_ws, encode(extensions.gen_random_bytes(24), 'hex'))
    on conflict (workspace_id) do nothing;
  if p_rotate then update private.affiliate_hooks h set token = encode(extensions.gen_random_bytes(24), 'hex'), rotated_at = now() where h.workspace_id = p_ws; end if;
  if p_settings is not null then update private.affiliate_hooks h set settings = p_settings where h.workspace_id = p_ws; end if;
  return query select h.token, h.settings from private.affiliate_hooks h where h.workspace_id = p_ws;
end $function$
;

CREATE OR REPLACE FUNCTION public.affiliate_log(p_secret text, p_ws uuid, p_e jsonb)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare n int;
begin
  if not private.cron_ok(p_secret) then raise exception 'not allowed' using errcode = '42501'; end if;
  insert into public.affiliate_events(workspace_id, event_key, kind, email, name, plan, amount, sub_id, contact_id, tags, status, note, raw)
  values (p_ws, p_e->>'event_key', p_e->>'kind', p_e->>'email', p_e->>'name', p_e->>'plan', nullif(p_e->>'amount','')::numeric, p_e->>'sub_id',
          p_e->>'contact_id', coalesce(array(select jsonb_array_elements_text(p_e->'tags')), '{}'), coalesce(p_e->>'status','ok'), p_e->>'note', p_e->'raw')
  on conflict (workspace_id, event_key) do nothing;
  get diagnostics n = row_count; return n > 0;
end $function$
;

CREATE OR REPLACE FUNCTION public.affiliate_resolve(p_secret text, p_token text)
 RETURNS TABLE(workspace_id uuid, settings jsonb, ciphertext text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
  if not private.cron_ok(p_secret) then raise exception 'not allowed' using errcode = '42501'; end if;
  return query select h.workspace_id, h.settings, s.ciphertext from private.affiliate_hooks h
    join public.workspaces w on w.id = h.workspace_id and w.kind <> 'demo'
    left join private.workspace_secrets s on s.workspace_id = h.workspace_id and s.provider = 'highlevel'
    where h.token = p_token;
end $function$
;

CREATE OR REPLACE FUNCTION public.agent_confirm(p_ws uuid, p_id uuid, p_digest text, p_confirm boolean)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare p public.agent_proposals; r jsonb;
begin
  if auth.uid() is null or not private.is_member(p_ws) then raise exception 'not allowed' using errcode='42501'; end if;
  select * into p from public.agent_proposals where id=p_id and workspace_id=p_ws and actor_id=auth.uid() for update;
  if not found then raise exception 'Proposal not found.'; end if;
  if p_confirm is distinct from true or p.digest is distinct from p_digest then raise exception 'Review and confirm the exact proposal first.'; end if;
  if p.status='dismissed' then raise exception 'This proposal was dismissed.'; end if;
  if p.status='applied' then return jsonb_build_object('agent',(select to_jsonb(a) from public.founder_agents a where id=p.result_id and workspace_id=p_ws),'already',true); end if;
  -- AI proposals may create new agents only. They cannot update an existing one.
  if exists(select 1 from public.founder_agents where id=(p.data->>'id')::uuid) then raise exception 'This agent already exists. Edit it from Agents.'; end if;
  r:=public.founder_agent_save(p_ws,p.data,0);
  update public.agent_proposals set status='applied',result_id=(r->>'id')::uuid where id=p_id;
  return jsonb_build_object('agent',r,'already',false);
end $function$
;

CREATE OR REPLACE FUNCTION public.agent_dismiss(p_ws uuid, p_id uuid)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare p public.agent_proposals;
begin
  if auth.uid() is null or not private.is_member(p_ws) then raise exception 'not allowed' using errcode='42501'; end if;
  select * into p from public.agent_proposals where id=p_id and workspace_id=p_ws and actor_id=auth.uid() for update;
  if not found then raise exception 'Proposal not found.'; end if;
  if p.status='applied' then raise exception 'This agent was already created. Manage it from Agents.'; end if;
  update public.agent_proposals set status='dismissed' where id=p_id;
  return true;
end $function$
;

CREATE OR REPLACE FUNCTION public.agent_propose(p_ws uuid, p_id uuid, p_data jsonb, p_digest text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare r public.agent_proposals;
begin
  if auth.uid() is null or not private.is_member(p_ws) then raise exception 'not allowed' using errcode='42501'; end if;
  if length(p_digest)<>64 or octet_length(p_data::text)>220000 then raise exception 'Invalid proposal.'; end if;
  insert into public.agent_proposals(id,workspace_id,actor_id,data,digest) values(p_id,p_ws,auth.uid(),p_data,p_digest)
    on conflict(id) do nothing;
  select * into r from public.agent_proposals where id=p_id;
  if r.workspace_id<>p_ws or r.actor_id<>auth.uid() then raise exception 'not allowed' using errcode='42501'; end if;
  return to_jsonb(r);
end $function$
;

CREATE OR REPLACE FUNCTION public.agent_run_now(p_ws uuid, p_task uuid, p_request uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare t public.recurring_tasks; a public.founder_agents; r public.agent_runs;
begin
  if auth.uid() is null or not private.is_member(p_ws) then raise exception 'not allowed' using errcode='42501'; end if;
  perform pg_advisory_xact_lock(hashtextextended(p_ws::text,23));
  select * into r from public.agent_runs where id=p_request;
  if found then
    if r.workspace_id<>p_ws or r.task_id<>p_task then raise exception 'not allowed' using errcode='42501'; end if;
    return to_jsonb(r);
  end if;
  select * into t from public.recurring_tasks where id=p_task and workspace_id=p_ws for update;
  if not found or t.archived then raise exception 'Task not found.'; end if;
  if t.agent_id is not null then select * into a from public.founder_agents where id=t.agent_id and workspace_id=p_ws; end if;
  if a.archived then raise exception 'This agent is archived.'; end if;
  if exists(select 1 from public.agent_runs where task_id=p_task and status in ('queued','running')) then raise exception 'This task already has a run in progress.'; end if;
  if (select count(*) from public.agent_runs where workspace_id=p_ws and created_at>now()-interval '1 hour')>=50 then raise exception 'This workspace has reached 50 runs this hour. Try again later.'; end if;
  insert into public.agent_runs(id,workspace_id,task_id,agent_id,trigger,scheduled_for,status,snapshot)
    values(p_request,p_ws,p_task,t.agent_id,'manual',now(),'queued',jsonb_build_object('task',to_jsonb(t),'agent',case when a.id is null then null else to_jsonb(a) end)) returning * into r;
  return to_jsonb(r);
end $function$
;

CREATE OR REPLACE FUNCTION public.brain_search(p_ws uuid, p_q text, p_limit integer DEFAULT 8)
 RETURNS TABLE(doc_id uuid, title text, category text, heading text, body text, rank real)
 LANGUAGE sql
 STABLE
 SET search_path TO ''
AS $function$
  with qq as (select nullif(array_to_string(array(select distinct w from regexp_split_to_table(lower(coalesce(p_q, '')), '[^a-z0-9]+') w where length(w) > 2 limit 24), ' | '), '') s),
  tq as (select case when s is null then null else to_tsquery('english', s) end q from qq)
  select c.doc_id, d.title, d.category, c.heading, c.body, ts_rank_cd(c.tsv, tq.q)::real
  from public.brain_chunks c join public.brain_docs d on d.id = c.doc_id, tq
  where c.workspace_id = p_ws and tq.q is not null and c.tsv @@ tq.q
  order by 6 desc limit least(greatest(coalesce(p_limit, 8), 1), 30);
$function$
;

CREATE OR REPLACE FUNCTION public.calls_status(p_ws uuid)
 RETURNS json
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
  if not private.is_member(p_ws) then raise exception 'not allowed' using errcode = '42501'; end if;
  return private.calls_status(p_ws);
end $function$
;

CREATE OR REPLACE FUNCTION public.chat_search(p_ws uuid, p_q text, p_kinds text[] DEFAULT NULL::text[], p_limit integer DEFAULT 24)
 RETURNS TABLE(kind text, ref text, title text, snippet text, at timestamp with time zone, url text, rank real, extra jsonb)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
  if auth.uid() is null or not private.is_member(p_ws) then raise exception 'not allowed' using errcode = '42501'; end if;
  return query select * from private.chat_search(p_ws, p_q, p_kinds, p_limit);
end $function$
;

CREATE OR REPLACE FUNCTION public.chat_sources(p_ws uuid)
 RETURNS json
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
  if auth.uid() is null or not private.is_member(p_ws) then raise exception 'not allowed' using errcode = '42501'; end if;
  return json_build_object(
    'recordings', (select count(*) from public.recordings where workspace_id = p_ws and status = 'ready'),
    'recording_words', (select coalesce(sum(words), 0) from public.recordings where workspace_id = p_ws),
    'docs', (select count(*) from public.brain_docs where workspace_id = p_ws),
    'facts', (select count(*) from public.brain_facts where workspace_id = p_ws and status = 'approved'),
    'offers', (select count(*) from public.dna_items where workspace_id = p_ws and included and kind = 'offer'),
    'funnels', (select count(*) from public.dna_items where workspace_id = p_ws and included and kind = 'funnel'),
    'posts', (select count(*) from public.creator_posts where workspace_id = p_ws),
    'research', (select count(*) from public.research_runs where workspace_id = p_ws and status = 'succeeded'),
    'drafts', (select count(*) from public.os_drafts where workspace_id = p_ws),
    'memory', (select count(*) from public.memory_items where workspace_id = p_ws),
    'latest_recording', (select json_build_object('id', id, 'title', title, 'started_at', started_at, 'minutes', minutes) from public.recordings where workspace_id = p_ws and status = 'ready' order by started_at desc nulls last limit 1)
  );
end $function$
;

CREATE OR REPLACE FUNCTION public.coach_list(p_ws uuid)
 RETURNS TABLE(id uuid, kind text, ref text, title text, url text, enabled boolean, chars integer, removed integer, passages integer, published_at timestamp with time zone)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
  if not private.is_admin() or not private.is_member(p_ws) then raise exception 'Only the admin can see the Coach library' using errcode = '42501'; end if;
  return query select s.id, s.kind, s.ref, s.title, s.url, s.enabled, s.chars, s.removed,
    (select count(*)::int from public.coach_chunks c where c.source_id = s.id), s.published_at
  from public.coach_sources s order by s.kind, s.title;
end $function$
;

CREATE OR REPLACE FUNCTION public.coach_lookup(p_q text, p_limit integer DEFAULT 6)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare v_uid uuid := auth.uid(); v_hour timestamptz := date_trunc('hour', now()); v_n integer; v_tq tsquery; v_and tsquery;
  v_lim integer := least(greatest(coalesce(p_limit, 6), 1), 8); v_plays jsonb; v_passages jsonb;
begin
  if v_uid is null or not private.is_approved(v_uid) then raise exception 'Sign in with an approved account to use the AI Coach' using errcode = '42501'; end if;
  insert into public.coach_usage (user_id, hour, n) values (v_uid, v_hour, 1)
  on conflict (user_id, hour) do update set n = public.coach_usage.n + 1 returning n into v_n;
  if v_n > 60 then raise exception 'The AI Coach is taking a short break. Try again in a few minutes.' using errcode = 'P0001'; end if;
  delete from public.coach_usage where hour < now() - interval '2 days';
  v_and := plainto_tsquery('english', left(coalesce(p_q, ''), 500));
  v_tq := nullif(replace(v_and::text, ' & ', ' | '), '')::tsquery;
  if v_tq is null then return jsonb_build_object('plays', '[]'::jsonb, 'passages', '[]'::jsonb); end if;
  -- Score: question and keyword hits count most, and the share of the member's words that hit matters.
  select coalesce(jsonb_agg(x order by x->>'score' desc), '[]'::jsonb) into v_plays from (
    select jsonb_build_object('question', p.question, 'topic', p.topic, 'answer', p.answer, 'sources', to_jsonb(p.sources),
      'score', round((ts_rank(p.tsv, v_tq, 1) * 10)::numeric, 3)) x
    from public.coach_playbook p
    where p.status = 'approved' and p.tsv @@ v_tq
      and ts_rank(setweight(to_tsvector('english', p.question || ' ' || p.keywords), 'A'), v_tq, 1) >= 0.05
    order by ts_rank(p.tsv, v_tq, 1) desc limit 2
  ) s;
  if jsonb_array_length(v_plays) > 0 then v_lim := least(v_lim, 3); end if;
  select coalesce(jsonb_agg(jsonb_build_object('title', r.title, 'kind', r.kind, 'url', r.url, 'at_s', r.at_s, 'body', r.body)), '[]'::jsonb) into v_passages from (
    select s.title, s.kind, s.url, c.at_s, left(c.body, 1800) body
    from public.coach_chunks c join public.coach_sources s on s.id = c.source_id
    where s.enabled and c.tsv @@ v_tq order by ts_rank_cd(c.tsv, v_tq) desc limit v_lim * 2
  ) r;
  return jsonb_build_object('plays', v_plays, 'passages', v_passages);
end $function$
;

CREATE OR REPLACE FUNCTION public.coach_play_delete(p_ws uuid, p_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
  if not private.is_admin() or not private.is_member(p_ws) then raise exception 'Only the admin can change the Playbook' using errcode = '42501'; end if;
  delete from public.coach_playbook where id = p_id and workspace_id = p_ws;
end $function$
;

CREATE OR REPLACE FUNCTION public.coach_play_list(p_ws uuid)
 RETURNS TABLE(id uuid, topic text, question text, keywords text, answer text, sources text[], status text, "position" integer, updated_at timestamp with time zone, approved_at timestamp with time zone)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
  if not private.is_admin() or not private.is_member(p_ws) then raise exception 'Only the admin can see the Playbook' using errcode = '42501'; end if;
  return query select p.id, p.topic, p.question, p.keywords, p.answer, p.sources, p.status, p.position, p.updated_at, p.approved_at
  from public.coach_playbook p where p.workspace_id = p_ws order by p.position, p.question;
end $function$
;

CREATE OR REPLACE FUNCTION public.coach_play_save(p_ws uuid, p_id uuid, p_row jsonb)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare v_id uuid; v_status text := coalesce(nullif(p_row->>'status', ''), 'draft'); v_answer text := left(trim(coalesce(p_row->>'answer', '')), 8000);
  v_q text := left(trim(coalesce(p_row->>'question', '')), 300);
begin
  if not private.is_admin() or not private.is_member(p_ws) then raise exception 'Only the admin can change the Playbook' using errcode = '42501'; end if;
  if char_length(v_q) < 3 then raise exception 'Write the question first'; end if;
  if v_status not in ('draft', 'approved') then raise exception 'Unknown status'; end if;
  if v_status = 'approved' and char_length(v_answer) < 20 then raise exception 'Write an answer before approving'; end if;
  if p_id is null then
    insert into public.coach_playbook (workspace_id, topic, question, keywords, answer, sources, status, position, approved_at)
    values (p_ws, left(coalesce(nullif(trim(p_row->>'topic'), ''), 'General'), 80), v_q, left(coalesce(p_row->>'keywords', ''), 400), v_answer,
      coalesce((select array_agg(left(x, 200)) from jsonb_array_elements_text(coalesce(p_row->'sources', '[]'::jsonb)) x), '{}'),
      v_status, coalesce((p_row->>'position')::int, (select coalesce(max(position), 0) + 1 from public.coach_playbook where workspace_id = p_ws)),
      case when v_status = 'approved' then now() end)
    returning id into v_id;
  else
    update public.coach_playbook p set
      topic = left(coalesce(nullif(trim(p_row->>'topic'), ''), p.topic), 80), question = v_q,
      keywords = left(coalesce(p_row->>'keywords', p.keywords), 400), answer = v_answer,
      sources = coalesce((select array_agg(left(x, 200)) from jsonb_array_elements_text(p_row->'sources') x), p.sources),
      status = v_status, updated_at = now(), updated_by = auth.uid(),
      approved_at = case when v_status = 'approved' then coalesce(p.approved_at, now()) else null end
    where p.id = p_id and p.workspace_id = p_ws returning p.id into v_id;
    if v_id is null then raise exception 'That entry is gone'; end if;
  end if;
  return v_id;
end $function$
;

CREATE OR REPLACE FUNCTION public.coach_publish(p_ws uuid, p_source jsonb, p_chunks jsonb)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare v_id uuid; v_kind text := p_source->>'kind'; v_ref text := p_source->>'ref';
begin
  if not private.is_admin() or not private.is_member(p_ws) then raise exception 'Only the admin can publish to the Coach library' using errcode = '42501'; end if;
  if v_kind not in ('doc', 'recording', 'youtube') or coalesce(v_ref, '') = '' then raise exception 'Unknown source'; end if;
  if jsonb_typeof(p_chunks) <> 'array' or jsonb_array_length(p_chunks) = 0 or jsonb_array_length(p_chunks) > 2000 then raise exception 'Nothing to publish'; end if;
  insert into public.coach_sources (kind, ref, workspace_id, title, url, chars, removed, published_by, published_at)
  values (v_kind, v_ref, p_ws, left(coalesce(nullif(p_source->>'title', ''), 'Untitled'), 300), nullif(p_source->>'url', ''),
    coalesce((select sum(char_length(x->>'body')) from jsonb_array_elements(p_chunks) x), 0), coalesce((p_source->>'removed')::int, 0), auth.uid(), now())
  on conflict (kind, ref) do update set title = excluded.title, url = excluded.url, chars = excluded.chars, removed = excluded.removed,
    published_by = excluded.published_by, published_at = now(), workspace_id = excluded.workspace_id
  returning id into v_id;
  delete from public.coach_chunks where source_id = v_id;
  insert into public.coach_chunks (source_id, idx, at_s, body)
  select v_id, (row_number() over ()) - 1, nullif(x->>'at_s', '')::int, left(x->>'body', 6000)
  from jsonb_array_elements(p_chunks) x where char_length(coalesce(x->>'body', '')) > 0;
  return v_id;
end $function$
;

CREATE OR REPLACE FUNCTION public.coach_remove(p_ws uuid, p_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
  if not private.is_admin() or not private.is_member(p_ws) then raise exception 'Only the admin can change the Coach library' using errcode = '42501'; end if;
  delete from public.coach_sources where id = p_id;
end $function$
;

CREATE OR REPLACE FUNCTION public.coach_search(p_q text, p_limit integer DEFAULT 6)
 RETURNS TABLE(title text, kind text, url text, at_s integer, body text, rank real)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare v_uid uuid := auth.uid(); v_hour timestamptz := date_trunc('hour', now()); v_n integer; v_tq tsquery; v_lim integer := least(greatest(coalesce(p_limit, 6), 1), 8);
begin
  if v_uid is null or not private.is_approved(v_uid) then raise exception 'Sign in with an approved account to use the AI Coach' using errcode = '42501'; end if;
  insert into public.coach_usage (user_id, hour, n) values (v_uid, v_hour, 1)
  on conflict (user_id, hour) do update set n = public.coach_usage.n + 1 returning n into v_n;
  if v_n > 60 then raise exception 'The AI Coach is taking a short break. Try again in a few minutes.' using errcode = 'P0001'; end if;
  delete from public.coach_usage where hour < now() - interval '2 days';
  v_tq := nullif(replace(plainto_tsquery('english', left(coalesce(p_q, ''), 500))::text, ' & ', ' | '), '')::tsquery;
  if v_tq is null then return; end if;
  return query
    select s.title, s.kind, s.url, c.at_s, left(c.body, 1800), ts_rank_cd(c.tsv, v_tq) as r
    from public.coach_chunks c join public.coach_sources s on s.id = c.source_id
    where s.enabled and c.tsv @@ v_tq
    order by r desc limit v_lim;
end $function$
;

CREATE OR REPLACE FUNCTION public.coach_set_enabled(p_ws uuid, p_id uuid, p_on boolean)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
  if not private.is_admin() or not private.is_member(p_ws) then raise exception 'Only the admin can change the Coach library' using errcode = '42501'; end if;
  update public.coach_sources set enabled = coalesce(p_on, true) where id = p_id;
end $function$
;

CREATE OR REPLACE FUNCTION public.coach_stats()
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select case when private.is_approved((select auth.uid())) then jsonb_build_object(
    'docs', (select count(*) from public.coach_sources where enabled and kind = 'doc'),
    'calls', (select count(*) from public.coach_sources where enabled and kind = 'recording'),
    'videos', (select count(*) from public.coach_sources where enabled and kind = 'youtube'),
    'answers', (select count(*) from public.coach_playbook where status = 'approved'),
    'passages', (select count(*) from public.coach_chunks c join public.coach_sources s on s.id = c.source_id where s.enabled))
  else null end;
$function$
;

CREATE OR REPLACE FUNCTION public.connection_hook_ingest(p_ws uuid, p_provider text, p_key text, p_event jsonb)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare m jsonb; ev jsonb;
begin
  if not exists (select 1 from private.workspace_secrets s where s.workspace_id = p_ws and s.provider = p_provider and s.hook_hash = encode(extensions.digest(p_key, 'sha256'), 'hex')) then raise exception 'not allowed' using errcode = '42501'; end if;
  select coalesce(meta, '{}'::jsonb) into m from public.workspace_connections where workspace_id = p_ws and provider = p_provider;
  ev := jsonb_build_object('at', now()) || coalesce(p_event, '{}'::jsonb);
  m := m || jsonb_build_object('events', (select coalesce(jsonb_agg(e), '[]'::jsonb) from (select e from jsonb_array_elements(jsonb_build_array(ev) || coalesce(m->'events', '[]'::jsonb)) e limit 40) x),
    'event_count', coalesce((m->>'event_count')::int, 0) + 1, 'last_event_at', now());
  update public.workspace_connections set meta = m, updated_at = now() where workspace_id = p_ws and provider = p_provider;
  if p_event ? 'draft_title' then
    insert into public.os_drafts(workspace_id, kind, title, body, stream, source, status, action)
      values (p_ws, coalesce(p_event->>'draft_kind', 'Follow-up'), left(p_event->>'draft_title', 200), left(coalesce(p_event->>'draft_body', ''), 8000), p_event->>'stream', 'HighLevel workflow', 'waiting', p_event->>'draft_action');
  end if;
end $function$
;

CREATE OR REPLACE FUNCTION public.connection_hook_set(p_ws uuid, p_provider text, p_hash text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
  if auth.uid() is null or not private.is_member(p_ws) then raise exception 'not allowed' using errcode = '42501'; end if;
  update private.workspace_secrets set hook_hash = p_hash where workspace_id = p_ws and provider = p_provider;
end $function$
;

CREATE OR REPLACE FUNCTION public.connection_meta(p_ws uuid, p_provider text, p_meta jsonb)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
  if auth.uid() is null or not private.is_member(p_ws) then raise exception 'not allowed' using errcode = '42501'; end if;
  update public.workspace_connections set meta = coalesce(meta, '{}'::jsonb) || coalesce(p_meta, '{}'::jsonb), updated_at = now() where workspace_id = p_ws and provider = p_provider;
end $function$
;

CREATE OR REPLACE FUNCTION public.connection_remove(p_ws uuid, p_provider text)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
  if auth.uid() is null or not private.is_member(p_ws) then raise exception 'not allowed' using errcode = '42501'; end if;
  delete from private.workspace_secrets where workspace_id = p_ws and provider = p_provider;
  update public.workspace_connections set status = 'not_connected', account_label = null, meta = '{}'::jsonb, updated_at = now() where workspace_id = p_ws and provider = p_provider;
  return json_build_object('provider', p_provider, 'status', 'not_connected');
end $function$
;

CREATE OR REPLACE FUNCTION public.connection_reseal(p_ws uuid, p_provider text, p_cipher text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
  if auth.uid() is null or not private.is_member(p_ws) then raise exception 'not allowed' using errcode = '42501'; end if;
  update private.workspace_secrets set ciphertext = p_cipher, updated_at = now() where workspace_id = p_ws and provider = p_provider;
end $function$
;

CREATE OR REPLACE FUNCTION public.connection_save(p_ws uuid, p_provider text, p_cipher text, p_label text, p_meta jsonb DEFAULT '{}'::jsonb)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
  if auth.uid() is null or not private.is_member(p_ws) then raise exception 'not allowed' using errcode = '42501'; end if;
  if p_provider !~ '^[a-z0-9-]{2,30}$' then raise exception 'unsupported provider'; end if;
  insert into private.workspace_secrets(workspace_id, provider, ciphertext, updated_at) values (p_ws, p_provider, p_cipher, now())
    on conflict (workspace_id, provider) do update set ciphertext = excluded.ciphertext, updated_at = now();
  insert into public.workspace_connections(workspace_id, provider, status, account_label, connected_at, updated_at, meta)
    values (p_ws, p_provider, 'connected', left(p_label, 120), now(), now(), coalesce(p_meta, '{}'::jsonb))
    on conflict (workspace_id, provider) do update set status = 'connected', account_label = excluded.account_label, connected_at = now(), updated_at = now(), meta = excluded.meta;
  return json_build_object('provider', p_provider, 'status', 'connected', 'account_label', left(p_label, 120));
end $function$
;

CREATE OR REPLACE FUNCTION public.connection_secret(p_ws uuid, p_provider text)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare c text;
begin
  if auth.uid() is null or not private.is_member(p_ws) then raise exception 'not allowed' using errcode = '42501'; end if;
  select ciphertext into c from private.workspace_secrets where workspace_id = p_ws and provider = p_provider;
  return c;
end $function$
;

CREATE OR REPLACE FUNCTION public.connection_status(p_ws uuid, p_provider text, p_status text, p_meta jsonb DEFAULT '{}'::jsonb)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
  if auth.uid() is null or not private.is_member(p_ws) then raise exception 'not allowed' using errcode = '42501'; end if;
  if p_status not in ('connected','error','pending') then raise exception 'bad status'; end if;
  update public.workspace_connections set status = p_status, meta = coalesce(meta, '{}'::jsonb) || coalesce(p_meta, '{}'::jsonb), updated_at = now() where workspace_id = p_ws and provider = p_provider;
end $function$
;

CREATE OR REPLACE FUNCTION public.content_decide(p_ws uuid, p_id uuid, p_stage text, p_expected_at timestamp with time zone)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare c public.content_items;
begin
  if auth.uid() is null or not private.is_member(p_ws) then raise exception 'not allowed' using errcode='42501'; end if;
  select * into c from public.content_items where id=p_id and workspace_id=p_ws for update;
  if not found then raise exception 'Idea not found.'; end if;
  if p_stage is null or p_stage not in ('approved','passed','suggested') then raise exception 'Invalid decision.'; end if;
  if c.stage=p_stage then return to_jsonb(c); end if;
  if c.updated_at is distinct from p_expected_at or p_expected_at is null then
    raise exception 'This idea changed in another window. Reopen it before deciding.' using errcode='40001';
  end if;
  if not ((c.stage='suggested' and p_stage in ('approved','passed')) or (c.stage='passed' and p_stage='suggested')) then
    raise exception 'Only suggestions can be approved or trashed. Restore a trashed idea first.';
  end if;
  update public.content_items set stage=p_stage,updated_at=clock_timestamp(),meta=meta||
    jsonb_build_object('decision',p_stage,'decision_at',clock_timestamp(),'decision_by',auth.uid())||
    case when p_stage='approved' then jsonb_build_object('approved_at',clock_timestamp(),'approved_from','approvals') else '{}'::jsonb end
    where id=p_id and workspace_id=p_ws returning * into c;
  return to_jsonb(c);
end $function$
;

CREATE OR REPLACE FUNCTION public.content_learning_edit(p_ws uuid, p_id uuid, p_patch jsonb, p_expected_at timestamp with time zone)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare c public.content_items; changed public.content_items; ch text; st text;
begin
  if not private.is_member(p_ws) then raise exception 'not allowed' using errcode='42501'; end if;
  select * into c from public.content_items where workspace_id=p_ws and id=p_id for update;
  if c.id is null then raise exception 'Content piece not found' using errcode='P0002'; end if;
  if p_expected_at is null or c.updated_at is distinct from p_expected_at then
    raise exception 'This piece changed in another window. Reopen it before saving so newer work is not overwritten.' using errcode='40001';
  end if;
  if p_patch is null or jsonb_typeof(p_patch)<>'object' or length(p_patch::text)>120000 then raise exception 'Invalid content edit'; end if;
  ch:=coalesce(p_patch->>'channel',c.channel); st:=coalesce(p_patch->>'stage',c.stage);
  if ch not in ('youtube','short','reel','carousel','tiktok','post','email','podcast','community','instagram','linkedin','facebook','x') then raise exception 'Unknown format'; end if;
  if st<>c.stage and not(c.stage='approved' and st='planned') then raise exception 'Use the stage controls to move this piece'; end if;
  if p_patch ? 'meta' and jsonb_typeof(p_patch->'meta')<>'object' then raise exception 'Invalid draft'; end if;
  perform set_config('founder.content_manual_edit',p_id::text,true);
  update public.content_items set
    title=case when p_patch ? 'title' then trim(p_patch->>'title') else title end,
    channel=ch,format=case when p_patch ? 'format' then p_patch->>'format' else format end,stage=st,
    publish_at=case when p_patch ? 'publish_at' then nullif(p_patch->>'publish_at','')::date else publish_at end,
    meta=case when p_patch ? 'meta' then p_patch->'meta' else meta end,updated_at=clock_timestamp()
    where id=p_id and workspace_id=p_ws returning * into changed;
  perform set_config('founder.content_manual_edit','',true);
  return to_jsonb(changed);
end $function$
;

CREATE OR REPLACE FUNCTION public.content_learning_read(p_ws uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
  if not private.is_member(p_ws) then raise exception 'not allowed' using errcode='42501'; end if;
  return private.content_learning_inputs(p_ws);
end $function$
;

CREATE OR REPLACE FUNCTION public.content_learning_settings(p_ws uuid, p_enabled boolean DEFAULT NULL::boolean, p_key text DEFAULT NULL::text, p_muted boolean DEFAULT NULL::boolean)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare config public.content_learning_config;
begin
  if not private.is_member(p_ws) then raise exception 'not allowed' using errcode='42501'; end if;
  insert into public.content_learning_config(workspace_id) values(p_ws) on conflict do nothing;
  select * into config from public.content_learning_config where workspace_id=p_ws for update;
  if p_enabled is not null then config.enabled:=p_enabled; end if;
  if p_key is not null then
    if length(p_key)>240 or p_key !~ '^(choice|edit|results|followup):[a-zA-Z0-9:|_-]+$'
      or p_muted is null then raise exception 'Invalid learning control'; end if;
    if p_muted then
      if cardinality(config.muted_keys)>=500 and not(p_key=any(config.muted_keys)) then raise exception 'Too many ignored observations'; end if;
      if not(p_key=any(config.muted_keys)) then config.muted_keys:=array_append(config.muted_keys,p_key); end if;
    else config.muted_keys:=array_remove(config.muted_keys,p_key); end if;
  end if;
  update public.content_learning_config set enabled=config.enabled,muted_keys=config.muted_keys,updated_at=clock_timestamp()
    where workspace_id=p_ws returning * into config;
  return to_jsonb(config)-'workspace_id';
end $function$
;

CREATE OR REPLACE FUNCTION public.cron_agent_claim(p_secret text, p_id uuid DEFAULT NULL::uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare r public.agent_runs; token uuid:=gen_random_uuid();
begin
  if not private.cron_ok(p_secret) then raise exception 'not allowed' using errcode='42501'; end if;
  -- Provider calls may repeat after a process crash, but finish is lease-fenced
  -- and the draft inserts are transactional, so visible outputs never duplicate.
  update public.agent_runs set status='error',error='Run timed out twice. Review the task and run it again.',finished_at=now()
    where status='running' and lease_until<now() and attempt>=2;
  select x.* into r from public.agent_runs x where (p_id is null or x.id=p_id)
    and (x.status='queued' or (x.status='running' and x.lease_until<now() and x.attempt<2))
    order by x.created_at limit 1 for update skip locked;
  if not found then return null; end if;
  if not exists(select 1 from public.recurring_tasks t left join public.founder_agents a on a.id=t.agent_id
      where t.id=r.task_id and not t.archived and (r.trigger='manual' or t.enabled)
        and (t.agent_id is null or (not a.archived and (r.trigger='manual' or a.enabled)))) then
    update public.agent_runs set status='skipped',error='Task or agent was paused or archived.',finished_at=now() where id=r.id;
    return null;
  end if;
  update public.agent_runs set status='running',attempt=attempt+1,started_at=now(),lease_until=now()+interval '6 minutes',error=null where id=r.id returning * into r;
  insert into private.recurring_leases values(r.id,token) on conflict(run_id) do update set token=excluded.token;
  update public.recurring_tasks set last_run_at=now(),last_status='running',last_error=null where id=r.task_id;
  return to_jsonb(r)||jsonb_build_object('lease',token);
end $function$
;

CREATE OR REPLACE FUNCTION public.cron_agent_enqueue(p_secret text)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare t public.recurring_tasks; a public.founder_agents; n int:=0;
begin
  if not private.cron_ok(p_secret) then raise exception 'not allowed' using errcode='42501'; end if;
  for t in select x.* from public.recurring_tasks x join public.workspaces w on w.id=x.workspace_id
    left join public.founder_agents ag on ag.id=x.agent_id and ag.workspace_id=x.workspace_id
    where w.kind<>'demo' and x.enabled and not x.archived and x.next_run_at<=now()
      and (x.kind='ideation' or (ag.enabled and not ag.archived))
    order by x.next_run_at limit 150 for update of x skip locked loop
    -- One most-recent scheduled slot, never many missed runs.
    if not exists(select 1 from public.agent_runs r where r.task_id=t.id and r.status in ('queued','running')) then
      a:=null;
      if t.agent_id is not null then select * into a from public.founder_agents where id=t.agent_id; end if;
      insert into public.agent_runs(id,workspace_id,task_id,agent_id,trigger,scheduled_for,status,snapshot)
        values(gen_random_uuid(),t.workspace_id,t.id,t.agent_id,'schedule',t.next_run_at,'queued',jsonb_build_object('task',to_jsonb(t),'agent',case when a.id is null then null else to_jsonb(a) end))
        on conflict do nothing;
      n:=n+1;
    end if;
    update public.recurring_tasks set next_run_at=private.task_next(schedule,now()) where id=t.id;
  end loop;
  return n;
end $function$
;

CREATE OR REPLACE FUNCTION public.cron_agent_finish(p_secret text, p_id uuid, p_lease uuid, p_output jsonb, p_model text DEFAULT NULL::text, p_error text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare r public.agent_runs; t public.recurring_tasks; x jsonb; cid uuid; ids jsonb:='[]'; v_status text; batch uuid:=gen_random_uuid(); n int:=0;
begin
  if not private.cron_ok(p_secret) then raise exception 'not allowed' using errcode='42501'; end if;
  select * into r from public.agent_runs where id=p_id for update;
  if not found or r.status<>'running' or r.lease_until<clock_timestamp() or not exists(select 1 from private.recurring_leases where run_id=p_id and token=p_lease) then raise exception 'This run lease has expired.'; end if;
  select * into t from public.recurring_tasks where id=r.task_id and workspace_id=r.workspace_id;
  if p_error is null and (p_output is null or jsonb_typeof(p_output) is distinct from 'object' or octet_length(p_output::text)>400000) then raise exception 'Invalid output.'; end if;
  v_status:=case when p_error is null then 'done' else 'error' end;
  if p_error is null and r.snapshot->'task'->>'output'='ideas' then
    if jsonb_typeof(p_output->'ideas') is distinct from 'array' or jsonb_array_length(p_output->'ideas') not between 1 and 10 then raise exception 'No valid ideas were returned.'; end if;
    for x in select value from jsonb_array_elements(p_output->'ideas') loop
      if length(trim(coalesce(x->>'title',''))) not between 1 and 300 then raise exception 'An idea is missing its title.'; end if;
      insert into public.content_items(workspace_id,title,stage,channel,format,position,meta)
      values(r.workspace_id,x->>'title','suggested',case r.snapshot->'task'->>'format' when 'newsletter' then 'email' when 'article' then 'post' else r.snapshot->'task'->>'format' end,
        case when r.snapshot->'task'->>'format' in ('youtube','podcast') then 'long' when r.snapshot->'task'->>'format' in ('short','reel','tiktok') then 'short' when r.snapshot->'task'->>'format' in ('email','newsletter') then 'email' else r.snapshot->'task'->>'format' end,
        -extract(epoch from now())/1e6+n/1e9,
        jsonb_build_object('hook',left(coalesce(x->>'hook',''),2000),'outline',coalesce(x->'outline','[]'::jsonb),
          'post_body',left(coalesce(x->>'body',''),18000),'why',left(coalesce(x->>'why',''),2000),
          'platform',r.snapshot->'task'->>'platform','idea_format',r.snapshot->'task'->>'format','tags',coalesce(x->'tags','[]'::jsonb),
          'source_url',x->>'source_url','evidence',coalesce(x->'evidence','[]'::jsonb),
          'by',left(p_model,100),'agent_run',r.id,'agent_id',r.agent_id,'task_id',r.task_id,'batch_id',batch,
          'agent_name',coalesce(r.snapshot->'agent'->>'name','Proactive ideation'),'origin',t.kind,
          'context_at',p_output->>'context_at','dna_version',p_output->'dna_version'))
      returning id into cid;
      ids:=ids||jsonb_build_array(cid); n:=n+1;
    end loop;
  end if;
  update public.agent_runs set status=v_status,output=case when p_error is null then p_output||jsonb_build_object('content_ids',ids) else null end,
    model=left(p_model,100),error=left(p_error,500),finished_at=now(),lease_until=null where id=r.id returning * into r;
  delete from private.recurring_leases where run_id=r.id;
  update public.recurring_tasks set last_status=r.status,last_error=left(p_error,500) where id=r.task_id;
  return to_jsonb(r);
end $function$
;

CREATE OR REPLACE FUNCTION public.cron_calls_pending(p_secret text, p_ws uuid, p_limit integer DEFAULT 1, p_id uuid DEFAULT NULL::uuid)
 RETURNS json
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
  if not private.cron_ok(p_secret) then raise exception 'not allowed' using errcode = '42501'; end if;
  return private.calls_pending(p_ws, p_limit, p_id);
end $function$
;

CREATE OR REPLACE FUNCTION public.cron_calls_save(p_secret text, p_ws uuid, p_rec uuid, p_review jsonb, p_items jsonb, p_ideas jsonb, p_by uuid DEFAULT NULL::uuid)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
  if not private.cron_ok(p_secret) then raise exception 'not allowed' using errcode = '42501'; end if;
  return private.calls_save(p_ws, p_rec, p_review, p_items, p_ideas, p_by);
end $function$
;

CREATE OR REPLACE FUNCTION public.cron_calls_status(p_secret text, p_ws uuid)
 RETURNS json
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
  if not private.cron_ok(p_secret) then raise exception 'not allowed' using errcode = '42501'; end if;
  return private.calls_status(p_ws);
end $function$
;

CREATE OR REPLACE FUNCTION public.cron_connections(p_secret text)
 RETURNS TABLE(workspace_id uuid, provider text, ciphertext text, meta jsonb, owner_email text, workspace_name text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
  if not private.cron_ok(p_secret) then raise exception 'not allowed' using errcode = '42501'; end if;
  return query select c.workspace_id, c.provider, s.ciphertext, c.meta, u.email::text, w.name
    from public.workspace_connections c join private.workspace_secrets s on s.workspace_id = c.workspace_id and s.provider = c.provider
    join public.workspaces w on w.id = c.workspace_id join auth.users u on u.id = w.owner_id
    where c.status in ('connected','error') and w.kind <> 'demo';
end $function$
;

CREATE OR REPLACE FUNCTION public.cron_content_learning_read(p_secret text, p_ws uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
  if not private.cron_ok(p_secret) then raise exception 'not allowed' using errcode='42501'; end if;
  if not exists(select 1 from public.workspaces where id=p_ws and kind<>'demo') then raise exception 'Workspace not found' using errcode='P0002'; end if;
  return private.content_learning_inputs(p_ws);
end $function$
;

CREATE OR REPLACE FUNCTION public.cron_design_skills(p_secret text, p_ws uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
  if not private.cron_ok(p_secret) then raise exception 'not allowed' using errcode='42501'; end if;
  return (select coalesce(jsonb_agg(jsonb_build_object('name',c.name,'meta',c.meta,'ciphertext',s.ciphertext)),'[]'::jsonb)
    from public.custom_connections c join private.custom_connection_secrets s on s.connection_id=c.id
    where c.workspace_id=p_ws and c.enabled and c.kind='skill' and coalesce((c.meta->>'use_funnels')::boolean,false));
end $function$
;

CREATE OR REPLACE FUNCTION public.cron_dna_save(p_secret text, p_ws uuid, p_items jsonb, p_kinds text[])
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
  if not private.cron_ok(p_secret) then raise exception 'not allowed' using errcode = '42501'; end if;
  return private.dna_save(p_ws, p_items, p_kinds);
end $function$
;

CREATE OR REPLACE FUNCTION public.cron_funnel_asset_put(p_secret text, p_id uuid, p_name text, p_mime text, p_data text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
  if not private.cron_ok(p_secret) then raise exception 'not allowed' using errcode = '42501'; end if;
  insert into private.funnel_assets (build_id, name, mime, data) values (p_id, p_name, p_mime, p_data)
    on conflict (build_id, name) do update set mime = excluded.mime, data = excluded.data, created_at = now();
end $function$
;

CREATE OR REPLACE FUNCTION public.cron_funnel_assets(p_secret text, p_id uuid)
 RETURNS json
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
  if not private.cron_ok(p_secret) then raise exception 'not allowed' using errcode = '42501'; end if;
  return coalesce((select json_agg(json_build_object('name', name, 'mime', mime, 'data', data)) from private.funnel_assets where build_id = p_id), '[]'::json);
end $function$
;

CREATE OR REPLACE FUNCTION public.cron_funnel_claim(p_secret text, p_id uuid, p_secs integer DEFAULT 290)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare r public.funnel_builds;
begin
  if not private.cron_ok(p_secret) then raise exception 'not allowed' using errcode = '42501'; end if;
  update public.funnel_builds set lease_until = now() + make_interval(secs => least(greatest(p_secs, 30), 600)), updated_at = now()
    where id = p_id and (lease_until is null or lease_until < now()) returning * into r;
  if not found then return null; end if;
  return row_to_json(r);
end $function$
;

CREATE OR REPLACE FUNCTION public.cron_funnel_get(p_secret text, p_id uuid)
 RETURNS json
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
  if not private.cron_ok(p_secret) then raise exception 'not allowed' using errcode = '42501'; end if;
  return (select row_to_json(b) from public.funnel_builds b where b.id = p_id);
end $function$
;

CREATE OR REPLACE FUNCTION public.cron_funnel_inputs(p_secret text, p_ws uuid)
 RETURNS json
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
  if not private.cron_ok(p_secret) then raise exception 'not allowed' using errcode = '42501'; end if;
  return json_build_object(
    'workspace', (select json_build_object('name', w.name, 'kind', w.kind, 'owner', coalesce(p.full_name, split_part(u.email, '@', 1)), 'email', u.email)
      from public.workspaces w join auth.users u on u.id = w.owner_id left join public.profiles p on p.id = w.owner_id where w.id = p_ws),
    'dna', (select body from public.brand_dna where workspace_id = p_ws),
    'offers', coalesce((select json_agg(json_build_object('id', id, 'kind', kind, 'name', name, 'price', price, 'currency', currency, 'price_note', price_note, 'summary', summary, 'url', url) order by kind, price desc nulls last) from public.dna_items where workspace_id = p_ws and (included or kind = 'offer')), '[]'::json),
    'proven', coalesce((select json_agg(row_to_json(x)) from private.proven(p_ws, 30, 1.5) x), '[]'::json),
    'profile', (select profile from public.brain_profile where workspace_id = p_ws),
    'voice', (select json_build_object('guide', guide, 'ai_guide', ai_guide) from public.writing_style where workspace_id = p_ws),
    'facts', coalesce((select json_agg(json_build_object('category', category, 'statement', statement)) from (select category, statement from public.brain_facts where workspace_id = p_ws and status = 'approved' order by updated_at desc limit 60) f), '[]'::json),
    'swipe', coalesce((select json_agg(json_build_object('kind', kind, 'title', title, 'brand', brand, 'url', url, 'notes', notes, 'analysis', analysis, 'text', left(coalesce(page_text, body), 2500))) from (select * from public.swipe_items where workspace_id = p_ws order by pinned desc, created_at desc limit 8) s), '[]'::json),
    'connected', coalesce((select json_agg(provider) from public.workspace_connections where workspace_id = p_ws and status = 'connected'), '[]'::json)
  );
end $function$
;

CREATE OR REPLACE FUNCTION public.cron_funnel_save(p_secret text, p_id uuid, p_patch jsonb)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare r public.funnel_builds;
begin
  if not private.cron_ok(p_secret) then raise exception 'not allowed' using errcode = '42501'; end if;
  update public.funnel_builds b set
    status = case when p_patch ? 'status' then p_patch->>'status' else b.status end,
    step = case when p_patch ? 'step' then p_patch->>'step' else b.step end,
    steps = case when p_patch ? 'steps_merge' then b.steps || (p_patch->'steps_merge') else b.steps end,
    research = case when p_patch ? 'research' then p_patch->'research' else b.research end,
    offer = case when p_patch ? 'offer' then p_patch->'offer' else b.offer end,
    copy = case when p_patch ? 'copy' then p_patch->'copy' else b.copy end,
    emails = case when p_patch ? 'emails' then p_patch->'emails' else b.emails end,
    handoff = case when p_patch ? 'handoff' then p_patch->'handoff' else b.handoff end,
    brand = case when p_patch ? 'brand' then p_patch->'brand' else b.brand end,
    visuals = case when p_patch ? 'visuals' then p_patch->'visuals' else b.visuals end,
    design = case when p_patch ? 'design' then p_patch->'design' else b.design end,
    assets = case when p_patch ? 'assets' then p_patch->'assets' else b.assets end,
    links = case when p_patch ? 'links' then b.links || (p_patch->'links') else b.links end,
    html = case when p_patch ? 'html' then p_patch->>'html' else b.html end,
    qa = case when p_patch ? 'qa' then p_patch->'qa' else b.qa end,
    version = case when p_patch ? 'version' then (p_patch->>'version')::int else b.version end,
    versions = case when p_patch ? 'versions_set' then p_patch->'versions_set' when p_patch ? 'version_push' then b.versions || jsonb_build_array(p_patch->'version_push') else b.versions end,
    revisions = case when p_patch ? 'revisions' then p_patch->'revisions' else b.revisions end,
    repo = case when p_patch ? 'repo' then p_patch->'repo' else b.repo end,
    deploy = case when p_patch ? 'deploy' then p_patch->'deploy' else b.deploy end,
    error = case when p_patch ? 'error' then p_patch->>'error' else b.error end,
    draft = case when p_patch ? 'draft' then nullif(p_patch->>'draft', '') else b.draft end,
    engine = case when p_patch ->> 'engine' in ('os', 'claude', 'codex', 'gemini') then p_patch->>'engine' else b.engine end,
    lease_until = case when coalesce((p_patch->>'release')::boolean, false) then null else b.lease_until end,
    updated_at = now()
  where b.id = p_id returning * into r;
  return json_build_object('id', r.id, 'status', r.status, 'step', r.step, 'version', r.version);
end $function$
;

CREATE OR REPLACE FUNCTION public.cron_funnel_secret(p_secret text, p_ws uuid, p_provider text)
 RETURNS text
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
  if not private.cron_ok(p_secret) then raise exception 'not allowed' using errcode = '42501'; end if;
  return (select s.ciphertext from private.workspace_secrets s join public.workspace_connections c on c.workspace_id = s.workspace_id and c.provider = s.provider
    where s.workspace_id = p_ws and s.provider = p_provider and c.status in ('connected','error'));
end $function$
;

CREATE OR REPLACE FUNCTION public.cron_gfx_asset_get(p_secret text, p_ws uuid, p_name text)
 RETURNS json
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
  if not private.cron_ok(p_secret) then raise exception 'not allowed' using errcode = '42501'; end if;
  return (select json_build_object('mime', mime, 'data', data) from private.graphic_assets where workspace_id = p_ws and name = p_name);
end $function$
;

CREATE OR REPLACE FUNCTION public.cron_gfx_asset_put(p_secret text, p_ws uuid, p_set uuid, p_name text, p_mime text, p_data text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
  if not private.cron_ok(p_secret) then raise exception 'not allowed' using errcode = '42501'; end if;
  insert into private.graphic_assets (workspace_id, name, set_id, mime, data) values (p_ws, p_name, p_set, p_mime, p_data)
    on conflict (workspace_id, name) do update set mime = excluded.mime, data = excluded.data, set_id = excluded.set_id, created_at = now();
end $function$
;

CREATE OR REPLACE FUNCTION public.cron_gfx_claim(p_secret text, p_id uuid, p_secs integer DEFAULT 290)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare r public.graphic_sets;
begin
  if not private.cron_ok(p_secret) then raise exception 'not allowed' using errcode = '42501'; end if;
  update public.graphic_sets set lease_until = now() + make_interval(secs => least(greatest(p_secs, 30), 600)), updated_at = now()
    where id = p_id and (lease_until is null or lease_until < now()) returning * into r;
  if not found then return null; end if;
  return row_to_json(r);
end $function$
;

CREATE OR REPLACE FUNCTION public.cron_gfx_get(p_secret text, p_id uuid)
 RETURNS json
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
  if not private.cron_ok(p_secret) then raise exception 'not allowed' using errcode = '42501'; end if;
  return (select row_to_json(s) from public.graphic_sets s where s.id = p_id);
end $function$
;

CREATE OR REPLACE FUNCTION public.cron_gfx_kit(p_secret text, p_ws uuid)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
  if not private.cron_ok(p_secret) then raise exception 'not allowed' using errcode = '42501'; end if;
  return json_build_object('kit', row_to_json(private.gfx_kit_row(p_ws)),
    'funnel_brand', (select b.brand from public.funnel_builds b where b.workspace_id = p_ws and b.brand is not null order by b.updated_at desc limit 1));
end $function$
;

CREATE OR REPLACE FUNCTION public.cron_gfx_save(p_secret text, p_id uuid, p_patch jsonb)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare r public.graphic_sets;
begin
  if not private.cron_ok(p_secret) then raise exception 'not allowed' using errcode = '42501'; end if;
  update public.graphic_sets s set
    status = case when p_patch ? 'status' then p_patch->>'status' else s.status end,
    step = case when p_patch ? 'step' then p_patch->>'step' else s.step end,
    title = case when p_patch ? 'title' then left(p_patch->>'title', 200) else s.title end,
    plan = case when p_patch ? 'plan' then p_patch->'plan' else s.plan end,
    slides = case when p_patch ? 'slides' then p_patch->'slides' else s.slides end,
    copy = case when p_patch ? 'copy' then p_patch->'copy' else s.copy end,
    input = case when p_patch ? 'input_merge' then s.input || (p_patch->'input_merge') else s.input end,
    error = case when p_patch ? 'error' then p_patch->>'error' else s.error end,
    lease_until = case when coalesce((p_patch->>'release')::boolean, false) then null else s.lease_until end,
    updated_at = now()
  where s.id = p_id returning * into r;
  return json_build_object('id', r.id, 'status', r.status, 'step', r.step);
end $function$
;

CREATE OR REPLACE FUNCTION public.cron_gfx_slide(p_secret text, p_id uuid, p_i integer, p_slide jsonb)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
  if not private.cron_ok(p_secret) then raise exception 'not allowed' using errcode = '42501'; end if;
  update public.graphic_sets s set slides = jsonb_set(s.slides, array[p_i::text], coalesce(s.slides->p_i, '{}'::jsonb) || p_slide), updated_at = now()
  where s.id = p_id and jsonb_array_length(s.slides) > p_i;
end $function$
;

CREATE OR REPLACE FUNCTION public.cron_goal_inputs(p_secret text, p_ws uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
  if not private.cron_ok(p_secret) then raise exception 'not allowed' using errcode = '42501'; end if;
  return private.goal_inputs_for(p_ws);
end $function$
;

CREATE OR REPLACE FUNCTION public.cron_goal_save(p_secret text, p_ws uuid, p_id uuid, p_meta jsonb)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
  if not private.cron_ok(p_secret) then raise exception 'not allowed' using errcode = '42501'; end if;
  update public.memory_items set meta = p_meta, updated_at = now() where id = p_id and workspace_id = p_ws and kind = 'goal';
end $function$
;

CREATE OR REPLACE FUNCTION public.cron_idea_inputs(p_secret text, p_ws uuid)
 RETURNS json
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
  if not private.cron_ok(p_secret) then raise exception 'not allowed' using errcode = '42501'; end if;
  return private.idea_inputs(p_ws);
end $function$
;

CREATE OR REPLACE FUNCTION public.cron_ideas_save(p_secret text, p_ws uuid, p_items jsonb)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
  if not private.cron_ok(p_secret) then raise exception 'not allowed' using errcode = '42501'; end if;
  return private.ideas_save(p_ws, p_items);
end $function$
;

CREATE OR REPLACE FUNCTION public.cron_meta(p_secret text, p_ws uuid, p_provider text, p_meta jsonb, p_status text DEFAULT NULL::text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
  if not private.cron_ok(p_secret) then raise exception 'not allowed' using errcode = '42501'; end if;
  update public.workspace_connections set meta = coalesce(meta, '{}'::jsonb) || coalesce(p_meta, '{}'::jsonb), status = coalesce(p_status, status), updated_at = now() where workspace_id = p_ws and provider = p_provider;
end $function$
;

CREATE OR REPLACE FUNCTION public.cron_recording_known(p_secret text, p_ws uuid)
 RETURNS text[]
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
  if not private.cron_ok(p_secret) then raise exception 'not allowed' using errcode = '42501'; end if;
  return coalesce((select array_agg(ext_id) from public.recordings where workspace_id = p_ws and status <> 'error'), '{}');
end $function$
;

CREATE OR REPLACE FUNCTION public.cron_recording_store(p_secret text, p_ws uuid, p_rec jsonb, p_chunks jsonb)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
  if not private.cron_ok(p_secret) then raise exception 'not allowed' using errcode = '42501'; end if;
  return private.recording_store(p_ws, p_rec, p_chunks);
end $function$
;

CREATE OR REPLACE FUNCTION public.cron_reseal(p_secret text, p_ws uuid, p_provider text, p_cipher text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
  if not private.cron_ok(p_secret) then raise exception 'not allowed' using errcode = '42501'; end if;
  update private.workspace_secrets set ciphertext = p_cipher, updated_at = now() where workspace_id = p_ws and provider = p_provider;
end $function$
;

CREATE OR REPLACE FUNCTION public.cron_strategy_context(p_secret text, p_ws uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
  if not private.cron_ok(p_secret) then raise exception 'not allowed' using errcode='42501'; end if;
  return (select coalesce(jsonb_agg(to_jsonb(s) order by s.updated_at desc),'[]') from public.founder_strategy s
    where s.workspace_id=p_ws and s.lifecycle in ('live','planned'));
end $function$
;

CREATE OR REPLACE FUNCTION public.cron_vault_context(p_secret text, p_ws uuid, p_query text DEFAULT ''::text, p_purpose text DEFAULT 'general'::text, p_ids uuid[] DEFAULT '{}'::uuid[])
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
  if not private.cron_ok(p_secret) then raise exception 'not allowed' using errcode='42501'; end if;
  if cardinality(p_ids)>4 then raise exception 'Choose up to four inspiration briefs'; end if;
  if cardinality(p_ids)>0 and
     (select count(*) from public.vault_notes where workspace_id=p_ws and id=any(p_ids) and not archived) <> cardinality(p_ids) then
    raise exception 'A selected inspiration brief is unavailable'; end if;
  return private.vault_notes_for(p_ws,p_query,p_purpose,p_ids);
end $function$
;

CREATE OR REPLACE FUNCTION public.cron_workspace(p_secret text, p_ws uuid)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
  if not private.cron_ok(p_secret) then raise exception 'not allowed' using errcode = '42501'; end if;
  return json_build_object(
    'drafts', (select count(*) from public.os_drafts where workspace_id = p_ws and status = 'waiting'),
    'top_draft', (select title from public.os_drafts where workspace_id = p_ws and status = 'waiting' order by created_at desc limit 1),
    'late', (select count(*) from public.memory_items where workspace_id = p_ws and kind = 'commitment' and status = 'open' and due is not null and due <= current_date));
end $function$
;

CREATE OR REPLACE FUNCTION public.cron_workspaces(p_secret text)
 RETURNS SETOF uuid
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
  if not private.cron_ok(p_secret) then raise exception 'not allowed' using errcode = '42501'; end if;
  return query select id from public.workspaces where kind <> 'demo';
end $function$
;

CREATE OR REPLACE FUNCTION public.custom_connection_claim(p_ws uuid, p_id uuid, p_nonce uuid, p_revision integer, p_label text, p_digest text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare c public.custom_connections; r public.custom_connection_runs; n integer;
begin
  if auth.uid() is null or not private.is_member(p_ws) then raise exception 'not allowed' using errcode='42501'; end if;
  select * into c from public.custom_connections where id=p_id and workspace_id=p_ws for update;
  if not found or not c.enabled or c.kind<>'mcp' then raise exception 'Connection is unavailable.'; end if;
  if c.revision<>p_revision then raise exception 'Connection changed. Review the request again.'; end if;
  select * into r from public.custom_connection_runs where id=p_nonce;
  if found then
    if r.workspace_id<>p_ws or r.connection_id<>p_id or r.actor_id<>auth.uid() or r.digest<>p_digest then raise exception 'not allowed' using errcode='42501'; end if;
    return jsonb_build_object('claimed',false,'run',to_jsonb(r));
  end if;
  select count(*) into n from public.custom_connection_runs where workspace_id=p_ws and started_at>now()-interval '1 minute';
  if n>=20 then raise exception 'Please wait a minute before running another tool.'; end if;
  insert into public.custom_connection_runs(id,workspace_id,connection_id,actor_id,label,digest,status)
    values(p_nonce,p_ws,p_id,auth.uid(),left(p_label,240),p_digest,'running') returning * into r;
  return jsonb_build_object('claimed',true,'run',to_jsonb(r));
end $function$
;

CREATE OR REPLACE FUNCTION public.custom_connection_finish(p_ws uuid, p_run uuid, p_status text, p_result jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare r public.custom_connection_runs;
begin
  if auth.uid() is null or not private.is_member(p_ws) then raise exception 'not allowed' using errcode='42501'; end if;
  if p_status not in ('done','error','uncertain') or octet_length(p_result::text)>350000 then raise exception 'Invalid result.'; end if;
  update public.custom_connection_runs set status=p_status,result=p_result,finished_at=now()
    where id=p_run and workspace_id=p_ws and actor_id=auth.uid() and status='running' returning * into r;
  if not found then select * into r from public.custom_connection_runs where id=p_run and workspace_id=p_ws and actor_id=auth.uid(); end if;
  return to_jsonb(r);
end $function$
;

CREATE OR REPLACE FUNCTION public.custom_connection_remove(p_ws uuid, p_id uuid, p_revision integer)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare r public.custom_connections;
begin
  if auth.uid() is null or not private.is_member(p_ws) then raise exception 'not allowed' using errcode='42501'; end if;
  select * into r from public.custom_connections where id=p_id and workspace_id=p_ws for update;
  if not found then return; end if;
  if r.revision<>p_revision then raise exception 'Connection changed. Reload it before removing it.'; end if;
  delete from public.custom_connections where id=p_id and workspace_id=p_ws;
end $function$
;

CREATE OR REPLACE FUNCTION public.custom_connection_save(p_ws uuid, p_id uuid, p_name text, p_kind text, p_cipher text, p_meta jsonb, p_revision integer, p_enabled boolean DEFAULT true)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare r public.custom_connections; n integer;
begin
  if auth.uid() is null or not private.is_member(p_ws) then raise exception 'not allowed' using errcode='42501'; end if;
  -- Serialize the workspace quota and same-id creation, including two tabs.
  perform pg_advisory_xact_lock(hashtextextended(p_ws::text,17));
  select * into r from public.custom_connections where id=p_id for update;
  if found then
    if r.workspace_id<>p_ws then raise exception 'not allowed' using errcode='42501'; end if;
    if r.revision<>p_revision then raise exception 'Connection changed. Reload it before saving.'; end if;
    if r.kind<>p_kind then raise exception 'Connection type cannot change.'; end if;
  else
    if p_revision<>0 then raise exception 'Connection changed. Reload it before saving.'; end if;
    select count(*) into n from public.custom_connections where workspace_id=p_ws;
    if n>=30 then raise exception 'This workspace already has 30 custom connections.'; end if;
  end if;
  if p_kind not in ('mcp','skill') or length(trim(p_name)) not between 1 and 100 or p_cipher not like 'v1.%'
    or octet_length(p_cipher)>900000 or octet_length(p_meta::text)>500000 then raise exception 'Invalid connection.'; end if;
  insert into public.custom_connections(id,workspace_id,name,kind,enabled,meta)
    values(p_id,p_ws,trim(p_name),p_kind,p_enabled,coalesce(p_meta,'{}'::jsonb))
    on conflict(id) do update set name=excluded.name,enabled=excluded.enabled,meta=excluded.meta,
      revision=public.custom_connections.revision+1,updated_at=now() returning * into r;
  insert into private.custom_connection_secrets(connection_id,ciphertext) values(p_id,p_cipher)
    on conflict(connection_id) do update set ciphertext=excluded.ciphertext;
  return to_jsonb(r);
end $function$
;

CREATE OR REPLACE FUNCTION public.custom_connection_secret(p_ws uuid, p_id uuid)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
  if auth.uid() is null or not private.is_member(p_ws) then raise exception 'not allowed' using errcode='42501'; end if;
  return (select s.ciphertext from private.custom_connection_secrets s join public.custom_connections c on c.id=s.connection_id where c.workspace_id=p_ws and c.id=p_id);
end $function$
;

CREATE OR REPLACE FUNCTION public.dna_rebuild(p_ws uuid)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare r json;
begin
  if not private.is_member(p_ws) then raise exception 'not allowed' using errcode = '42501'; end if;
  perform private.dna_compile(p_ws);
  select row_to_json(d) into r from public.brand_dna d where d.workspace_id = p_ws;
  return r;
end $function$
;

CREATE OR REPLACE FUNCTION public.dna_sync_save(p_ws uuid, p_items jsonb, p_kinds text[])
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
  if not private.is_member(p_ws) then raise exception 'not allowed' using errcode = '42501'; end if;
  return private.dna_save(p_ws, p_items, p_kinds);
end $function$
;

CREATE OR REPLACE FUNCTION public.founder_agent_save(p_ws uuid, p_data jsonb, p_revision integer DEFAULT 0)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare r public.founder_agents; pid uuid:=(p_data->>'id')::uuid; t jsonb; tids uuid[]:='{}';
begin
  if auth.uid() is null or not private.is_member(p_ws) then raise exception 'not allowed' using errcode='42501'; end if;
  perform pg_advisory_xact_lock(hashtextextended(p_ws::text,22));
  if jsonb_typeof(p_data) is distinct from 'object' or length(trim(coalesce(p_data->>'name',''))) not between 1 and 100
    or length(trim(coalesce(p_data->>'role',''))) not between 1 and 240 or length(trim(coalesce(p_data->>'instructions',''))) not between 1 and 16000
    or length(coalesce(p_data->>'model',''))>100 or jsonb_typeof(p_data->'tasks') is distinct from 'array'
    or jsonb_array_length(p_data->'tasks') not between 1 and 12 then raise exception 'Invalid agent.'; end if;
  select * into r from public.founder_agents where id=pid for update;
  if found then
    if r.workspace_id<>p_ws then raise exception 'not allowed' using errcode='42501'; end if;
    if r.revision<>p_revision then raise exception 'Agent changed. Reload before saving.' using errcode='40001'; end if;
  elsif p_revision<>0 then raise exception 'Agent no longer exists.';
  elsif (select count(*) from public.founder_agents where workspace_id=p_ws and not archived)>=40 then raise exception 'This workspace already has 40 agents.'; end if;
  insert into public.founder_agents(id,workspace_id,name,role,instructions,model,enabled,created_by)
    values(pid,p_ws,trim(p_data->>'name'),trim(p_data->>'role'),trim(p_data->>'instructions'),coalesce(p_data->>'model',''),coalesce((p_data->>'enabled')::boolean,true),auth.uid())
    on conflict(id) do update set name=excluded.name,role=excluded.role,instructions=excluded.instructions,model=excluded.model,
      enabled=excluded.enabled,archived=false,revision=founder_agents.revision+1,updated_at=now() returning * into r;
  for t in select value from jsonb_array_elements(p_data->'tasks') loop
    if (t->>'id')::uuid=any(tids) then raise exception 'Duplicate task ID.'; end if;
    tids:=array_append(tids,(t->>'id')::uuid);
    perform private.task_put(p_ws,pid,'agent',t);
  end loop;
  update public.recurring_tasks set archived=true,enabled=false,revision=revision+1,updated_at=now()
    where workspace_id=p_ws and agent_id=pid and not(id=any(tids)) and not archived;
  -- A saved schedule is prospective. Never queue a catch-up burst after a pause.
  if r.enabled then update public.recurring_tasks set next_run_at=private.task_next(schedule,now())
    where workspace_id=p_ws and agent_id=pid and next_run_at<now() and not archived; end if;
  return to_jsonb(r);
end $function$
;

CREATE OR REPLACE FUNCTION public.founder_agent_state(p_ws uuid, p_id uuid, p_revision integer, p_enabled boolean, p_archived boolean DEFAULT false)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare r public.founder_agents;
begin
  if auth.uid() is null or not private.is_member(p_ws) then raise exception 'not allowed' using errcode='42501'; end if;
  select * into r from public.founder_agents where id=p_id and workspace_id=p_ws for update;
  if not found then raise exception 'Agent not found.'; end if;
  if r.revision<>p_revision then raise exception 'Agent changed. Reload before saving.' using errcode='40001'; end if;
  update public.founder_agents set enabled=p_enabled and not p_archived,archived=p_archived,revision=revision+1,updated_at=now() where id=p_id returning * into r;
  if not r.enabled then
    update public.agent_runs set status='skipped',error='Agent paused before the run started.',finished_at=now() where agent_id=p_id and status='queued';
  else
    update public.recurring_tasks set next_run_at=private.task_next(schedule,now()) where agent_id=p_id and enabled and not archived;
  end if;
  return to_jsonb(r);
end $function$
;

CREATE OR REPLACE FUNCTION public.funnel_create(p_ws uuid, p_title text, p_offer_ref text, p_answers jsonb, p_offer jsonb DEFAULT NULL::jsonb)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare r public.funnel_builds;
begin
  if not private.is_member(p_ws) then raise exception 'not allowed' using errcode = '42501'; end if;
  if (select count(*) from public.funnel_builds where workspace_id = p_ws and status in ('queued','running')) >= 6 then raise exception 'Six builds are already running. Wait for one to finish.'; end if;
  insert into public.funnel_builds (workspace_id, created_by, title, offer_ref, answers, offer, status, step, steps)
  values (p_ws, auth.uid(), left(coalesce(nullif(trim(p_title), ''), 'Sales page'), 200), left(p_offer_ref, 120), coalesce(p_answers, '{}'::jsonb), p_offer, 'queued', 'research',
    jsonb_build_object('intake', jsonb_build_object('state', 'done', 'at', now(), 'done_at', now(), 'note', 'Answers saved')))
  returning * into r;
  return json_build_object('id', r.id, 'status', r.status, 'step', r.step);
end $function$
;

CREATE OR REPLACE FUNCTION public.funnel_preview(p_id uuid, p_key text)
 RETURNS json
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select json_build_object('html', b.html, 'title', b.title, 'version', b.version, 'status', b.status, 'updated_at', b.updated_at)
  from public.funnel_builds b where b.id = p_id and b.preview_key = p_key;
$function$
;

CREATE OR REPLACE FUNCTION public.funnel_preview_asset(p_id uuid, p_key text, p_name text)
 RETURNS json
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select json_build_object('mime', a.mime, 'data', a.data) from private.funnel_assets a join public.funnel_builds b on b.id = a.build_id
  where b.id = p_id and b.preview_key = p_key and a.name = p_name;
$function$
;

CREATE OR REPLACE FUNCTION public.gfx_asset(p_ws uuid, p_key text, p_name text)
 RETURNS json
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select json_build_object('mime', a.mime, 'data', a.data) from private.graphic_assets a join public.graphic_kits k on k.workspace_id = a.workspace_id
  where a.workspace_id = p_ws and k.asset_key = p_key and a.name = p_name;
$function$
;

CREATE OR REPLACE FUNCTION public.gfx_create(p_ws uuid, p_title text, p_format text, p_aspect text, p_model text, p_input jsonb)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare r public.graphic_sets;
begin
  if not private.is_member(p_ws) then raise exception 'not allowed' using errcode = '42501'; end if;
  if (select count(*) from public.graphic_sets where workspace_id = p_ws and status in ('queued','running')) >= 4 then raise exception 'Four sets are already being made. Wait for one to finish.'; end if;
  perform private.gfx_kit_row(p_ws);
  insert into public.graphic_sets (workspace_id, created_by, title, format, aspect, model, input, status, step)
  values (p_ws, auth.uid(), left(coalesce(nullif(trim(p_title), ''), 'Graphics'), 200), left(p_format, 30), left(p_aspect, 8), left(p_model, 80), coalesce(p_input, '{}'::jsonb), 'queued', 'plan')
  returning * into r;
  return json_build_object('id', r.id, 'status', r.status, 'step', r.step);
end $function$
;

CREATE OR REPLACE FUNCTION public.gfx_kit(p_ws uuid)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare k public.graphic_kits;
begin
  if not private.is_member(p_ws) then raise exception 'not allowed' using errcode = '42501'; end if;
  k := private.gfx_kit_row(p_ws);
  return json_build_object('kit', row_to_json(k),
    'funnel_brand', (select b.brand from public.funnel_builds b where b.workspace_id = p_ws and b.brand is not null order by b.updated_at desc limit 1),
    'refs', coalesce((select json_agg(json_build_object('name', a.name, 'at', a.created_at) order by a.created_at desc) from (select name, created_at from private.graphic_assets where workspace_id = p_ws and name like 'ref-%' order by created_at desc limit 60) a), '[]'::json));
end $function$
;

CREATE OR REPLACE FUNCTION public.gfx_kit_save(p_ws uuid, p_patch jsonb)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare k public.graphic_kits;
begin
  if not private.is_member(p_ws) then raise exception 'not allowed' using errcode = '42501'; end if;
  perform private.gfx_kit_row(p_ws);
  if p_patch ? 'photos' and jsonb_typeof(p_patch->'photos') = 'array' and jsonb_array_length(p_patch->'photos') > 20 then raise exception 'Up to 20 brand photos'; end if;
  if p_patch ? 'palettes' and jsonb_typeof(p_patch->'palettes') = 'array' and jsonb_array_length(p_patch->'palettes') > 12 then raise exception 'Up to 12 palettes'; end if;
  if p_patch ? 'font_sets' and jsonb_typeof(p_patch->'font_sets') = 'array' and jsonb_array_length(p_patch->'font_sets') > 12 then raise exception 'Up to 12 font pairings'; end if;
  if p_patch ? 'custom_fonts' and jsonb_typeof(p_patch->'custom_fonts') = 'array' and jsonb_array_length(p_patch->'custom_fonts') > 12 then raise exception 'Up to 12 custom fonts'; end if;
  update public.graphic_kits set
    palette = case when p_patch ? 'palette' and jsonb_typeof(p_patch->'palette') = 'object' then p_patch->'palette' else palette end,
    fonts = case when p_patch ? 'fonts' and jsonb_typeof(p_patch->'fonts') = 'object' then p_patch->'fonts' else fonts end,
    palettes = case when p_patch ? 'palettes' and jsonb_typeof(p_patch->'palettes') = 'array' then p_patch->'palettes' else palettes end,
    font_sets = case when p_patch ? 'font_sets' and jsonb_typeof(p_patch->'font_sets') = 'array' then p_patch->'font_sets' else font_sets end,
    custom_fonts = case when p_patch ? 'custom_fonts' and jsonb_typeof(p_patch->'custom_fonts') = 'array' then p_patch->'custom_fonts' else custom_fonts end,
    style = case when p_patch ? 'style' then left(p_patch->>'style', 1200) else style end,
    handle = case when p_patch ? 'handle' then left(p_patch->>'handle', 60) else handle end,
    logo = case when p_patch ? 'logo' then nullif(left(p_patch->>'logo', 80), '') else logo end,
    photos = case when p_patch ? 'photos' and jsonb_typeof(p_patch->'photos') = 'array' then p_patch->'photos' else photos end,
    updated_at = now()
  where workspace_id = p_ws returning * into k;
  return row_to_json(k);
end $function$
;

CREATE OR REPLACE FUNCTION public.gfx_unupload(p_ws uuid, p_name text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
  if not private.is_member(p_ws) then raise exception 'not allowed' using errcode = '42501'; end if;
  delete from private.graphic_assets where workspace_id = p_ws and name = p_name and set_id is null;
end $function$
;

CREATE OR REPLACE FUNCTION public.gfx_upload(p_ws uuid, p_name text, p_mime text, p_data text)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
  if not private.is_member(p_ws) then raise exception 'not allowed' using errcode = '42501'; end if;
  if p_name ~ '^kit-font-' then
    if p_name !~ '^kit-font-[a-z0-9-]{4,60}\.(woff2|woff|ttf|otf)$' then raise exception 'Bad file name'; end if;
    if p_mime not in ('font/woff2', 'font/woff', 'font/ttf', 'font/otf') then raise exception 'Use a WOFF2, WOFF, TTF or OTF font file'; end if;
    if length(p_data) > 4000000 then raise exception 'That font file is too large'; end if;
  else
    if p_name !~ '^(ref|kit)-[a-z0-9-]{4,60}\.(jpg|png|webp)$' then raise exception 'Bad file name'; end if;
    if p_mime not in ('image/jpeg', 'image/png', 'image/webp') then raise exception 'Use a JPG, PNG or WebP image'; end if;
    if length(p_data) > 6000000 then raise exception 'That image is too large'; end if;
  end if;
  if (select count(*) from private.graphic_assets where workspace_id = p_ws and set_id is null) >= 400 then raise exception 'You have 400 uploads. Delete a few first.'; end if;
  insert into private.graphic_assets (workspace_id, name, mime, data) values (p_ws, p_name, p_mime, p_data)
    on conflict (workspace_id, name) do update set mime = excluded.mime, data = excluded.data, created_at = now();
  return json_build_object('name', p_name);
end $function$
;

CREATE OR REPLACE FUNCTION public.goal_inputs(p_ws uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
  if not private.is_member(p_ws) then raise exception 'not allowed' using errcode = '42501'; end if;
  return private.goal_inputs_for(p_ws);
end $function$
;

CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare ws uuid; nm text;
begin
  nm := coalesce(nullif(trim(new.raw_user_meta_data->>'full_name'), ''), split_part(new.email, '@', 1));
  insert into public.profiles (id, full_name, email) values (new.id, nm, new.email);
  insert into public.workspaces (name, owner_id, kind) values (left(nm, 66) || '''s workspace', new.id, 'live') returning id into ws;
  insert into public.workspace_members (workspace_id, user_id, role) values (ws, new.id, 'owner');
  update public.profiles set current_workspace = ws where id = new.id;
  -- The first person to sign up owns this install and is approved as admin. Everyone after waits for approval.
  perform pg_advisory_xact_lock(hashtext('fos_first_admin'));
  if not exists (select 1 from public.user_access a where a.is_admin) then
    insert into public.user_access (user_id, status, is_admin, decided_at) values (new.id, 'approved', true, now()) on conflict (user_id) do update set status = 'approved', is_admin = true;
  else
    insert into public.user_access (user_id, status) values (new.id, 'pending') on conflict do nothing;
  end if;
  return new;
end; $function$
;

CREATE OR REPLACE FUNCTION public.hl_app_ingest(p_secret text, p_location text, p_event jsonb)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare n int := 0; r record; m jsonb; ev jsonb;
begin
  if not private.cron_ok(p_secret) then raise exception 'not allowed' using errcode = '42501'; end if;
  if coalesce(p_location, '') = '' then return 0; end if;
  ev := jsonb_build_object('at', now()) || coalesce(p_event, '{}'::jsonb);
  for r in select c.workspace_id, coalesce(c.meta, '{}'::jsonb) meta from public.workspace_connections c
    where c.provider = 'highlevel' and c.status in ('connected', 'error') and c.meta->>'location_id' = p_location loop
    m := r.meta || jsonb_build_object(
      'events', (select coalesce(jsonb_agg(e), '[]'::jsonb) from (select e from jsonb_array_elements(jsonb_build_array(ev) || coalesce(r.meta->'events', '[]'::jsonb)) e limit 40) x),
      'event_count', coalesce((r.meta->>'event_count')::int, 0) + 1, 'last_event_at', now());
    update public.workspace_connections set meta = m, updated_at = now() where workspace_id = r.workspace_id and provider = 'highlevel';
    n := n + 1;
  end loop;
  return n;
end $function$
;

CREATE OR REPLACE FUNCTION public.idea_inputs(p_ws uuid)
 RETURNS json
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
  if not private.is_member(p_ws) then raise exception 'not allowed' using errcode = '42501'; end if;
  return private.idea_inputs(p_ws);
end $function$
;

CREATE OR REPLACE FUNCTION public.ideas_save(p_ws uuid, p_items jsonb)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
  if not private.is_member(p_ws) then raise exception 'not allowed' using errcode = '42501'; end if;
  return private.ideas_save(p_ws, p_items);
end $function$
;

CREATE OR REPLACE FUNCTION public.ideation_task_save(p_ws uuid, p_data jsonb, p_revision integer DEFAULT 0, p_archived boolean DEFAULT false)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare r public.recurring_tasks; pid uuid:=(p_data->>'id')::uuid;
begin
  if auth.uid() is null or not private.is_member(p_ws) then raise exception 'not allowed' using errcode='42501'; end if;
  perform pg_advisory_xact_lock(hashtextextended(p_ws::text,22));
  select * into r from public.recurring_tasks where id=pid for update;
  if found then
    if r.workspace_id<>p_ws or r.kind<>'ideation' then raise exception 'not allowed' using errcode='42501'; end if;
    if r.revision<>p_revision then raise exception 'Cadence changed. Reload before saving.' using errcode='40001'; end if;
  elsif p_revision<>0 then raise exception 'Cadence no longer exists.'; end if;
  if not p_archived then
    if p_data->>'output'<>'ideas' then raise exception 'Choose ideas for a proactive cadence.'; end if;
    if (select count(*) from public.recurring_tasks where workspace_id=p_ws and kind='ideation' and not archived and id<>pid)>=40 then raise exception 'This workspace already has 40 cadences.'; end if;
    perform private.task_put(p_ws,null,'ideation',p_data);
  else
    update public.recurring_tasks set archived=true,enabled=false,revision=revision+1,updated_at=now() where id=pid and workspace_id=p_ws;
  end if;
  select * into r from public.recurring_tasks where id=pid and workspace_id=p_ws;
  if not r.enabled then update public.agent_runs set status='skipped',error='Cadence paused before the run started.',finished_at=now() where task_id=pid and status='queued'; end if;
  return to_jsonb(r);
end $function$
;

CREATE OR REPLACE FUNCTION public.inbox_account_save(p_ws uuid, p_kind text, p_address text, p_label text, p_cipher text, p_meta jsonb DEFAULT '{}'::jsonb, p_hook_hash text DEFAULT NULL::text)
 RETURNS inbox_accounts
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare a public.inbox_accounts;
begin
  if auth.uid() is null or not private.is_member(p_ws) then raise exception 'not allowed' using errcode = '42501'; end if;
  insert into public.inbox_accounts(workspace_id, kind, address, label, meta, status, last_error)
    values (p_ws, p_kind, lower(left(p_address, 200)), left(p_label, 120), coalesce(p_meta, '{}'::jsonb), 'connected', null)
    on conflict (workspace_id, kind, address) do update set label = excluded.label, meta = excluded.meta, status = 'connected', last_error = null
    returning * into a;
  insert into private.inbox_secrets(account_id, ciphertext, hook_hash) values (a.id, p_cipher, p_hook_hash)
    on conflict (account_id) do update set ciphertext = excluded.ciphertext, hook_hash = coalesce(excluded.hook_hash, private.inbox_secrets.hook_hash);
  return a;
end $function$
;

CREATE OR REPLACE FUNCTION public.inbox_account_secret(p_account uuid)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare c text; ws uuid;
begin
  select workspace_id into ws from public.inbox_accounts where id = p_account;
  if ws is null or auth.uid() is null or not private.is_member(ws) then raise exception 'not allowed' using errcode = '42501'; end if;
  select ciphertext into c from private.inbox_secrets where account_id = p_account;
  return c;
end $function$
;

CREATE OR REPLACE FUNCTION public.inbox_hook_ingest(p_account uuid, p_key text, p_rows jsonb)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare a public.inbox_accounts; r jsonb; th uuid; pe uuid; n int := 0;
begin
  select * into a from public.inbox_accounts where id = p_account;
  if a.id is null then raise exception 'not allowed' using errcode = '42501'; end if;
  if not exists (select 1 from private.inbox_secrets s where s.account_id = a.id and s.hook_hash = encode(extensions.digest(p_key, 'sha256'), 'hex')) then raise exception 'not allowed' using errcode = '42501'; end if;
  for r in select * from jsonb_array_elements(coalesce(p_rows, '[]'::jsonb)) loop
    select id into pe from public.inbox_people where workspace_id = a.workspace_id and (r->>'from') = any(phones) limit 1;
    if pe is null then
      insert into public.inbox_people(workspace_id, name, phones) values (a.workspace_id, coalesce(nullif(r->>'name',''), '+' || (r->>'from')), array[r->>'from']) returning id into pe;
    end if;
    insert into public.inbox_threads(workspace_id, source, account_id, channel, ext_id, person_id, snippet, last_at, last_dir, unread, status)
      values (a.workspace_id, 'whatsapp', a.id, 'whatsapp', a.id::text || ':' || (r->>'from'), pe, left(r->>'body', 240), to_timestamp((r->>'ts')::bigint), 'in', 1, 'open')
      on conflict (workspace_id, source, ext_id) do update set snippet = excluded.snippet, last_at = excluded.last_at, last_dir = 'in', unread = public.inbox_threads.unread + 1, status = 'open'
      returning id into th;
    insert into public.inbox_messages(workspace_id, thread_id, ext_id, dir, author, body, sent_at)
      values (a.workspace_id, th, r->>'id', 'in', coalesce(nullif(r->>'name',''), r->>'from'), r->>'body', to_timestamp((r->>'ts')::bigint))
      on conflict (thread_id, ext_id) do nothing;
    n := n + 1;
  end loop;
  return n;
end $function$
;

CREATE OR REPLACE FUNCTION public.mcp_agents(p_hash text)
 RETURNS json
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare a record; ws uuid;
begin
  select * into a from private.mcp_auth(p_hash); ws := a.workspace_id;
  return json_build_object(
    'funnel_agent', (select json_build_object('builds', count(*), 'running', count(*) filter (where f.status in ('queued', 'running')), 'last', max(f.updated_at)) from public.funnel_builds f where f.workspace_id = ws),
    'graphics', (select json_build_object('sets', count(*), 'running', count(*) filter (where g.status in ('queued', 'running')), 'last', max(g.updated_at)) from public.graphic_sets g where g.workspace_id = ws),
    'research', (select json_build_object('runs', count(*), 'last', max(r.created_at)) from public.research_runs r where r.workspace_id = ws),
    'brand_dna', (select json_build_object('version', d.version, 'built', d.built_at) from public.brand_dna d where d.workspace_id = ws),
    'ideas', (select json_build_object('suggested', count(*) filter (where c.stage = 'suggested'), 'on_board', count(*) filter (where c.stage in ('approved', 'planned', 'production')), 'published', count(*) filter (where c.stage = 'published'), 'last', max(c.created_at)) from public.content_items c where c.workspace_id = ws),
    'calls', private.calls_status(ws),
    'brain', (select json_build_object('docs', (select count(*) from public.brain_docs b where b.workspace_id = ws and b.status = 'ready'), 'studied_docs', p.doc_count, 'studied', p.studied_at) from (select 1) one left join public.brain_profile p on p.workspace_id = ws),
    'creators', (select json_build_object('tracked', count(*)) from public.creators c where c.workspace_id = ws),
    'syncs', (select coalesce(json_agg(json_build_object('provider', c.provider, 'status', c.status, 'last_sync', c.meta->>'last_sync_at') order by c.provider), '[]'::json) from public.workspace_connections c where c.workspace_id = ws)
  );
end $function$
;

CREATE OR REPLACE FUNCTION public.mcp_brain_facts(p_hash text)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare a record; r json;
begin
  select * into a from private.mcp_auth(p_hash);
  select json_build_object(
    'approved', coalesce((select json_agg(json_build_object('category', f.category, 'statement', f.statement, 'weight', f.weight, 'approved_at', f.approved_at) order by f.category, f.weight desc, f.approved_at)
      from public.brain_facts f where f.workspace_id = a.workspace_id and f.status = 'approved'), '[]'::json),
    'waiting_for_founder', (select count(*) from public.brain_facts f where f.workspace_id = a.workspace_id and f.status = 'proposed')) into r;
  return r;
end $function$
;

CREATE OR REPLACE FUNCTION public.mcp_brain_profile(p_hash text)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare a record; r json;
begin
  select * into a from private.mcp_auth(p_hash);
  select json_build_object('profile', p.profile, 'method', p.method, 'studied_at', p.studied_at, 'doc_count', p.doc_count,
    'docs', (select coalesce(json_agg(json_build_object('title', d.title, 'category', d.category, 'kind', d.kind, 'words', d.words, 'summary', d.summary) order by d.created_at desc), '[]'::json) from (select * from public.brain_docs where workspace_id = a.workspace_id order by created_at desc limit 60) d))
    into r from public.brain_profile p where p.workspace_id = a.workspace_id;
  if r is null then
    select json_build_object('profile', null, 'docs', (select coalesce(json_agg(json_build_object('title', d.title, 'category', d.category, 'kind', d.kind, 'words', d.words)), '[]'::json) from public.brain_docs d where d.workspace_id = a.workspace_id)) into r;
  end if;
  return r;
end $function$
;

CREATE OR REPLACE FUNCTION public.mcp_brain_search(p_hash text, p_q text, p_limit integer DEFAULT 8)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare a record; r json; tq tsquery; s text;
begin
  select * into a from private.mcp_auth(p_hash);
  s := nullif(array_to_string(array(select distinct w from regexp_split_to_table(lower(coalesce(p_q, '')), '[^a-z0-9]+') w where length(w) > 2 limit 24), ' | '), '');
  if s is null then return '[]'::json; end if; tq := to_tsquery('english', s);
  select coalesce(json_agg(x), '[]'::json) into r from (
    select d.title, d.category, c.heading, c.body as text, round(ts_rank_cd(c.tsv, tq)::numeric, 3) as rank
    from public.brain_chunks c join public.brain_docs d on d.id = c.doc_id
    where c.workspace_id = a.workspace_id and c.tsv @@ tq order by ts_rank_cd(c.tsv, tq) desc limit least(greatest(coalesce(p_limit, 8), 1), 20)) x;
  return r;
end $function$
;

CREATE OR REPLACE FUNCTION public.mcp_brand_dna(p_hash text)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare a record; r json;
begin
  select * into a from private.mcp_auth(p_hash);
  perform private.dna_compile(a.workspace_id);
  select json_build_object('version', d.version, 'updated_at', d.built_at, 'counts', d.counts, 'dna', d.body,
    'offers', coalesce((select json_agg(json_build_object('name', i.name, 'price', i.price, 'currency', i.currency, 'note', i.price_note, 'summary', i.summary, 'url', i.url) order by i.price desc nulls last) from public.dna_items i where i.workspace_id = a.workspace_id and i.kind = 'offer' and i.included), '[]'::json),
    'funnels', coalesce((select json_agg(json_build_object('name', i.name, 'url', i.url, 'steps', i.steps) order by i.ext_updated_at desc nulls last) from public.dna_items i where i.workspace_id = a.workspace_id and i.kind = 'funnel' and i.included), '[]'::json))
  into r from public.brand_dna d where d.workspace_id = a.workspace_id;
  return r;
end $function$
;

CREATE OR REPLACE FUNCTION public.mcp_connections(p_hash text)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare a record; r json;
begin
  select * into a from private.mcp_auth(p_hash);
  select coalesce(json_agg(json_build_object('provider', c.provider, 'status', c.status, 'account', c.account_label,
    'last_sync_at', c.meta->>'last_sync_at', 'metrics', c.meta->'feed'->'metrics',
    'revenue', case when c.provider in ('stripe','paypal') then (c.meta->'revenue') - 'recent' when c.provider = 'affiliate' then (c.meta->'aff') - 'items' - 'rows' else null end)), '[]'::json)
    into r from public.workspace_connections c where c.workspace_id = a.workspace_id;
  return r;
end $function$
;

CREATE OR REPLACE FUNCTION public.mcp_content(p_hash text, p_limit integer DEFAULT 120)
 RETURNS json
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare a record;
begin
  select * into a from private.mcp_auth(p_hash);
  return (select coalesce(json_agg(json_build_object('id', c.id, 'title', c.title, 'stage', c.stage, 'channel', c.channel, 'format', c.format, 'publish_at', c.publish_at,
      'from', coalesce(c.meta->>'source', c.meta->>'from'), 'why', c.meta->>'why', 'quote', c.meta->>'quote', 'created_at', c.created_at) order by c.created_at desc), '[]'::json)
    from (select * from public.content_items x where x.workspace_id = a.workspace_id and x.stage <> 'passed' order by x.created_at desc limit greatest(1, least(p_limit, 300))) c);
end $function$
;

CREATE OR REPLACE FUNCTION public.mcp_creator_posts(p_hash text, p_platform text DEFAULT NULL::text, p_format text DEFAULT NULL::text, p_min_views bigint DEFAULT NULL::bigint, p_creator text DEFAULT NULL::text, p_limit integer DEFAULT 20)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare a record; r json;
begin
  select * into a from private.mcp_auth(p_hash);
  select coalesce(json_agg(x), '[]'::json) into r from (
    select c.name as creator, p.platform, p.format, p.title, p.url, p.views, p.likes, p.comments, p.posted_at, p.picked
    from public.creator_posts p join public.creators c on c.id = p.creator_id
    where p.workspace_id = a.workspace_id
      and (p_platform is null or p.platform = p_platform)
      and (p_format is null or p.format = p_format)
      and (p_min_views is null or p.views >= p_min_views)
      and (p_creator is null or c.name ilike '%' || p_creator || '%' or c.ig_handle ilike '%' || p_creator || '%')
    order by coalesce(p.views, p.likes) desc nulls last
    limit least(greatest(coalesce(p_limit, 20), 1), 50)) x;
  return r;
end $function$
;

CREATE OR REPLACE FUNCTION public.mcp_draft_add(p_hash text, p_kind text, p_title text, p_body text, p_stream text DEFAULT NULL::text, p_action text DEFAULT NULL::text, p_source text DEFAULT 'MCP'::text)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare a record;c public.content_items;ch text;
begin
  perform private.mcp_require_write(p_hash);
  select * into a from private.mcp_auth(p_hash);
  if length(trim(coalesce(p_title,''))) not between 1 and 200 or length(coalesce(p_body,'')) not between 1 and 20000 then raise exception 'Provide a title and a complete draft.'; end if;
  ch:=case when lower(p_kind) like '%email%' then 'email' when lower(p_kind) like '%short%' then 'short'
    when lower(p_kind) like '%video%' or lower(p_kind) like '%youtube%' then 'youtube' else 'post' end;
  insert into public.content_items(workspace_id,title,stage,channel,format,meta,created_by)
  values(a.workspace_id,trim(p_title),'suggested',ch,case when ch='youtube' then 'long' else ch end,
    jsonb_build_object('draft_body',p_body,'post_body',p_body,'requested_artifact',left(p_kind,60),
      'stream',left(p_stream,60),'action',left(p_action,200),'source',left(p_source,60),
      'tags',jsonb_build_array('mcp'),'idea_format',ch),a.user_id) returning * into c;
  return json_build_object('id',c.id,'kind',p_kind,'title',c.title,'status','waiting','stage','suggested','route','approvals');
end $function$
;

CREATE OR REPLACE FUNCTION public.mcp_drafts(p_hash text, p_status text DEFAULT 'waiting'::text)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare a record;r json;
begin
  select * into a from private.mcp_auth(p_hash);
  select coalesce(json_agg(x order by x.created_at desc),'[]'::json) into r from (
    select c.id,coalesce(c.meta->>'requested_artifact',c.channel) as kind,c.title,
      coalesce(c.meta->>'post_body',c.meta->>'draft_body',c.meta->>'body','') as body,
      c.meta->>'stream' as stream,c.meta->>'source' as source,c.stage,
      case when c.stage='suggested' then 'waiting' when c.stage='passed' then 'rejected' else 'approved' end as status,c.created_at
    from public.content_items c where c.workspace_id=a.workspace_id and
      (p_status is null or p_status='any' or c.stage=case p_status when 'waiting' then 'suggested' when 'rejected' then 'passed' else p_status end
        or (p_status='approved' and c.stage in ('approved','planned','production','published')))
    order by c.created_at desc limit 200
  ) x;return r;
end $function$
;

CREATE OR REPLACE FUNCTION public.mcp_fact_propose(p_hash text, p_category text, p_statement text, p_evidence text DEFAULT NULL::text, p_client text DEFAULT NULL::text)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare a record; r public.brain_facts;
begin
  perform private.mcp_require_write(p_hash);
  select * into a from private.mcp_auth(p_hash);
  if length(coalesce(p_statement, '')) < 3 or length(p_statement) > 500 then raise exception 'statement must be 3 to 500 characters'; end if;
  insert into public.brain_facts (workspace_id, category, statement, status, source, evidence, created_by)
  values (a.workspace_id, p_category, p_statement, 'proposed', coalesce(nullif(left(p_client, 40), ''), 'AI access'), left(p_evidence, 600), a.user_id)
  on conflict do nothing returning * into r;
  if r.id is null then return json_build_object('queued', false, 'message', 'The founder already has this fact, or rejected it before.'); end if;
  return json_build_object('queued', true, 'id', r.id, 'status', r.status);
end $function$
;

CREATE OR REPLACE FUNCTION public.mcp_founder_dna_read(p_hash text)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare a record;
begin
  select * into a from private.mcp_auth(p_hash);
  if a.workspace_id is null then raise exception 'not allowed' using errcode='42501'; end if;
  return coalesce((select jsonb_build_object('version',d.version,'updated_at',d.built_at,
    'counts',d.counts,'dna',d.body) from public.brand_dna d where d.workspace_id=a.workspace_id),
    jsonb_build_object('version',null,'updated_at',null,'counts','{}'::jsonb,'dna',''));
end $function$
;

CREATE OR REPLACE FUNCTION public.mcp_funnel_get(p_hash text, p_id uuid)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare a record; r json;
begin
  select * into a from private.mcp_auth(p_hash);
  select json_build_object('id', b.id, 'title', b.title, 'status', b.status, 'step', b.step, 'version', b.version, 'answers', b.answers, 'research', b.research, 'offer', b.offer, 'copy', b.copy, 'emails', b.emails, 'handoff', b.handoff, 'brand', b.brand, 'design', b.design, 'assets', b.assets, 'links', b.links, 'html', b.html, 'qa', b.qa, 'versions', b.versions, 'revisions', b.revisions, 'engine', b.engine, 'repo', b.repo, 'deploy', b.deploy, 'preview_key', b.preview_key)
    into r from public.funnel_builds b where b.id = p_id and b.workspace_id = a.workspace_id;
  if r is null then raise exception 'No build with that id in this workspace'; end if;
  return r;
end $function$
;

CREATE OR REPLACE FUNCTION public.mcp_funnel_update(p_hash text, p_id uuid, p_html text, p_note text, p_preview_url text DEFAULT NULL::text, p_source text DEFAULT 'AI access'::text)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare a record; r public.funnel_builds;
begin
  perform private.mcp_require_write(p_hash);
  select * into a from private.mcp_auth(p_hash);
  if p_html is not null and (length(p_html) < 200 or length(p_html) > 900000) then raise exception 'html must be a full page, under 900 KB'; end if;
  if p_preview_url is not null and p_preview_url !~ '^https://' then raise exception 'preview_url must start with https://'; end if;
  update public.funnel_builds b set
    html = coalesce(p_html, b.html),
    version = b.version + 1,
    versions = b.versions || jsonb_build_array(jsonb_build_object('v', b.version + 1, 'at', now(), 'note', left(coalesce(nullif(p_note, ''), 'Update from ' || coalesce(p_source, 'AI access')), 300), 'by', left(coalesce(p_source, 'AI access'), 60), 'url', p_preview_url)),
    deploy = case when p_preview_url is not null then coalesce(b.deploy, '{}'::jsonb) || jsonb_build_object('external_url', p_preview_url, 'external_at', now()) else b.deploy end,
    status = case when b.status = 'failed' then 'done' else b.status end,
    updated_at = now()
  where b.id = p_id and b.workspace_id = a.workspace_id returning * into r;
  if not found then raise exception 'No build with that id in this workspace'; end if;
  return json_build_object('id', r.id, 'version', r.version, 'has_github', r.repo is not null);
end $function$
;

CREATE OR REPLACE FUNCTION public.mcp_funnels(p_hash text)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare a record;
begin
  select * into a from private.mcp_auth(p_hash);
  return coalesce((select json_agg(json_build_object('id', b.id, 'title', b.title, 'status', b.status, 'step', b.step, 'version', b.version, 'offer', b.offer->>'name', 'repo', b.repo->>'url', 'live_url', b.deploy->>'url', 'updated_at', b.updated_at) order by b.updated_at desc)
    from public.funnel_builds b where b.workspace_id = a.workspace_id), '[]'::json);
end $function$
;

CREATE OR REPLACE FUNCTION public.mcp_grok_task_update(p_hash text, p_id uuid, p_status text, p_summary text DEFAULT NULL::text, p_links jsonb DEFAULT '[]'::jsonb, p_client text DEFAULT NULL::text)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare a record; r public.grok_tasks; lk jsonb;
begin
  perform private.mcp_require_write(p_hash);
  select * into a from private.mcp_auth(p_hash);
  if p_status not in ('started', 'done', 'failed', 'needs_you') then raise exception 'status must be started, done, failed or needs_you'; end if;
  if p_summary is not null and length(p_summary) > 4000 then raise exception 'summary must be under 4000 characters'; end if;
  select coalesce(jsonb_agg(x), '[]'::jsonb) into lk from (
    select jsonb_build_object('label', left(coalesce(e->>'label', e->>'url'), 120), 'url', left(e->>'url', 600)) x
    from jsonb_array_elements(case when jsonb_typeof(p_links) = 'array' then p_links else '[]'::jsonb end) e
    where (e->>'url') ~ '^https://' limit 10) s;
  update public.grok_tasks g set
    status = p_status,
    summary = coalesce(nullif(p_summary, ''), g.summary),
    links = case when jsonb_array_length(lk) > 0 then lk else g.links end,
    updates = (g.updates || jsonb_build_array(jsonb_build_object('at', now(), 'status', p_status, 'summary', left(coalesce(p_summary, ''), 600), 'by', left(coalesce(nullif(p_client, ''), 'Grok'), 60)))),
    updated_at = now()
  where g.id = p_id and g.workspace_id = a.workspace_id returning * into r;
  if not found then raise exception 'No Grok task with that task_id in this workspace'; end if;
  return json_build_object('task_id', r.id, 'status', r.status, 'saved', true);
end $function$
;

CREATE OR REPLACE FUNCTION public.mcp_grok_tasks(p_hash text, p_status text DEFAULT 'open'::text)
 RETURNS json
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare a record;
begin
  select * into a from private.mcp_auth(p_hash);
  return coalesce((select json_agg(json_build_object('task_id', t.id, 'agent', t.agent, 'title', t.title, 'instruction', t.instruction, 'status', t.status, 'summary', t.summary, 'links', t.links, 'sent_at', t.sent_at, 'updated_at', t.updated_at) order by t.created_at desc)
    from (select * from public.grok_tasks g where g.workspace_id = a.workspace_id
      and (p_status = 'all' or (p_status = 'open' and g.status in ('sent', 'started', 'needs_you')) or g.status = p_status)
      order by g.created_at desc limit 25) t), '[]'::json);
end $function$
;

CREATE OR REPLACE FUNCTION public.mcp_hl_secret(p_hash text)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare a record; c text;
begin
  select * into a from private.mcp_auth(p_hash);
  select ciphertext into c from private.workspace_secrets where workspace_id = a.workspace_id and provider = 'highlevel';
  return c;
end $function$
;

CREATE OR REPLACE FUNCTION public.mcp_log_change(p_hash text, p_section text, p_row text, p_before jsonb, p_after jsonb, p_client text DEFAULT NULL::text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare a record; chg uuid;
begin
  perform private.mcp_require_write(p_hash);
  select * into a from private.mcp_auth(p_hash);
  if p_section not in ('crm') then raise exception 'Unknown section'; end if;
  insert into public.mcp_changes(workspace_id, section, row_id, op, before, after, client)
  values (a.workspace_id, p_section, left(p_row, 80), 'update', p_before, p_after, left(coalesce(p_client, a.last_client), 80)) returning id into chg;
  return chg;
end $function$
;

CREATE OR REPLACE FUNCTION public.mcp_memory(p_hash text, p_kind text DEFAULT NULL::text, p_status text DEFAULT 'open'::text, p_query text DEFAULT NULL::text, p_limit integer DEFAULT 50)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare a record; r json;
begin
  select * into a from private.mcp_auth(p_hash);
  select coalesce(json_agg(x order by x.due nulls last, x.created_at desc), '[]'::json) into r from (
    select m.id, m.kind, m.text, m.meta, m.due, m.status, m.created_at from public.memory_items m
    where m.workspace_id = a.workspace_id
      and (p_kind is null or m.kind = p_kind)
      and (p_status is null or p_status = 'any' or m.status = p_status)
      and (p_query is null or m.text ilike '%' || p_query || '%' or m.meta::text ilike '%' || p_query || '%')
    order by m.created_at desc limit least(greatest(coalesce(p_limit, 50), 1), 200)) x;
  return r;
end $function$
;

CREATE OR REPLACE FUNCTION public.mcp_memory_add(p_hash text, p_kind text, p_text text, p_due date DEFAULT NULL::date, p_meta jsonb DEFAULT '{}'::jsonb)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare a record; r public.memory_items;
begin
  perform private.mcp_require_write(p_hash);
  select * into a from private.mcp_auth(p_hash);
  if length(coalesce(p_text, '')) = 0 or length(p_text) > 4000 then raise exception 'text must be 1 to 4000 characters'; end if;
  insert into public.memory_items (workspace_id, kind, text, meta, due, created_by)
  values (a.workspace_id, p_kind, p_text, coalesce(p_meta, '{}'::jsonb) || '{"source":"MCP"}'::jsonb, p_due, a.user_id) returning * into r;
  return json_build_object('id', r.id, 'kind', r.kind, 'text', r.text, 'due', r.due, 'status', r.status);
end $function$
;

CREATE OR REPLACE FUNCTION public.mcp_memory_set_status(p_hash text, p_id uuid, p_status text)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare a record; r public.memory_items;
begin
  perform private.mcp_require_write(p_hash);
  select * into a from private.mcp_auth(p_hash);
  update public.memory_items set status = p_status, updated_at = now() where id = p_id and workspace_id = a.workspace_id returning * into r;
  if not found then raise exception 'item not found'; end if;
  return json_build_object('id', r.id, 'text', r.text, 'status', r.status);
end $function$
;

CREATE OR REPLACE FUNCTION public.mcp_os_read(p_hash text, p_section text, p_id text DEFAULT NULL::text, p_query text DEFAULT NULL::text, p_filter jsonb DEFAULT NULL::jsonb, p_limit integer DEFAULT 25, p_offset integer DEFAULT 0)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare a record; c jsonb; t text; cols text[]; heavy text[]; one boolean; w text := 'workspace_id = $1';
  k text; v text; ord text; r jsonb; total int;
begin
  select * into a from private.mcp_auth(p_hash);
  c := private.mcp_sections() -> p_section;
  if c is null then raise exception 'Unknown section %. Call os_sections first.', p_section; end if;
  t := c->>'t'; cols := private.mcp_cols(t); one := coalesce((c->>'one')::boolean, false);
  heavy := array(select jsonb_array_elements_text(coalesce(c->'heavy', '[]')));
  if p_id is not null and not one then
    if not 'id' = any(cols) then raise exception 'This section has no ids'; end if;
    execute format('select to_jsonb(x) - ''workspace_id'' from public.%I x where workspace_id = $1 and id::text = $2', t)
      into r using a.workspace_id, p_id;
    if r is null then raise exception 'Not found in %', p_section; end if;
    return jsonb_build_object('section', p_section, 'row', r - array(select column_name::text from information_schema.columns
      where table_schema = 'public' and table_name = t and udt_name = 'tsvector'));
  end if;
  if p_filter is not null then
    for k, v in select key, value #>> '{}' from jsonb_each(p_filter) loop
      if not k = any(cols) or k = 'workspace_id' then raise exception 'Unknown filter column %', k; end if;
      w := w || format(' and %I::text = %L', k, v);
    end loop;
  end if;
  if nullif(trim(p_query), '') is not null then
    w := w || format(' and to_jsonb(x)::text ilike %L', '%' || left(trim(p_query), 200) || '%');
  end if;
  ord := case when 'updated_at' = any(cols) then 'updated_at desc nulls last'
    when 'created_at' = any(cols) then 'created_at desc nulls last' when 'at' = any(cols) then 'at desc' else '1' end;
  execute format('select count(*) from public.%I x where %s', t, w) into total using a.workspace_id;
  execute format('select coalesce(jsonb_agg(private.mcp_trim(to_jsonb(x) - ''workspace_id'', $2)), ''[]'') from (select * from public.%I x where %s order by %s limit $3 offset $4) x', t, w, ord)
    into r using a.workspace_id, heavy || array(select column_name::text from information_schema.columns
      where table_schema = 'public' and table_name = t and udt_name = 'tsvector'),
      least(greatest(coalesce(p_limit, 25), 1), 100), greatest(coalesce(p_offset, 0), 0);
  return jsonb_build_object('section', p_section, 'total', total, 'rows', r,
    'writable', c->'w', 'note', c->>'note');
end $function$
;

CREATE OR REPLACE FUNCTION public.mcp_os_sections(p_hash text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare a record; s text; c jsonb; n int; out jsonb := '[]'::jsonb; cfg jsonb := private.mcp_sections();
begin
  select * into a from private.mcp_auth(p_hash);
  for s, c in select key, value from jsonb_each(cfg) order by key loop
    execute format('select count(*) from public.%I where workspace_id = $1', c->>'t') into n using a.workspace_id;
    out := out || jsonb_build_object('section', s, 'rows', n, 'note', c->>'note',
      'writable', c->'w', 'can', jsonb_build_object('create', position('c' in c->>'ops') > 0,
        'update', position('u' in c->>'ops') > 0, 'delete', position('d' in c->>'ops') > 0));
  end loop;
  return out;
end $function$
;

CREATE OR REPLACE FUNCTION public.mcp_os_undo(p_hash text, p_change uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare a record; ch public.mcp_changes; c jsonb; t text; cols text[]; wr jsonb; res jsonb; ins text; sel text;
begin
  perform private.mcp_require_write(p_hash);
  select * into a from private.mcp_auth(p_hash);
  select * into ch from public.mcp_changes where id = p_change and workspace_id = a.workspace_id for update;
  if not found then raise exception 'Change not found'; end if;
  if ch.undone_at is not null then raise exception 'Already undone'; end if;
  if ch.op = 'undo' then raise exception 'Undo entries cannot be undone'; end if;
  c := private.mcp_sections() -> ch.section;
  if c is null then raise exception 'This change was made in HighLevel. Change it back on the CRM page.'; end if;
  t := c->>'t'; cols := private.mcp_cols(t);
  if ch.op = 'create' then
    execute format('delete from public.%I where workspace_id = $1 and id::text = $2', t) using a.workspace_id, ch.row_id;
    res := jsonb_build_object('ok', true, 'removed', ch.row_id);
  elsif ch.op = 'update' then
    wr := (select jsonb_object_agg(k, ch.before -> k) from jsonb_array_elements_text(c->'w') k where ch.before ? k);
    res := private.mcp_write(a.workspace_id, a.user_id, ch.section, 'update', ch.row_id, wr, 'undo', false);
  else
    ins := (select string_agg(format('%I', k), ', ') from unnest(cols) k where ch.before ? k);
    sel := (select string_agg(format('r.%I', k), ', ') from unnest(cols) k where ch.before ? k);
    execute format('insert into public.%I (%s) select %s from jsonb_populate_record(null::public.%I, $1) r', t, ins, sel, t) using ch.before;
    res := jsonb_build_object('ok', true, 'restored', ch.row_id);
  end if;
  update public.mcp_changes set undone_at = now() where id = ch.id;
  insert into public.mcp_changes(workspace_id, section, row_id, op, before, after, client)
  values (a.workspace_id, ch.section, ch.row_id, 'undo', ch.after, ch.before, 'undo of ' || ch.id);
  return res;
end $function$
;

CREATE OR REPLACE FUNCTION public.mcp_os_write(p_hash text, p_section text, p_op text, p_id text DEFAULT NULL::text, p_data jsonb DEFAULT NULL::jsonb, p_client text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare a record;
begin
  perform private.mcp_require_write(p_hash);
  select * into a from private.mcp_auth(p_hash);
  return private.mcp_write(a.workspace_id, a.user_id, p_section, p_op, p_id, p_data, coalesce(p_client, a.last_client));
end $function$
;

CREATE OR REPLACE FUNCTION public.mcp_proven(p_hash text, p_limit integer DEFAULT 20)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare a record;
begin
  select * into a from private.mcp_auth(p_hash);
  return coalesce((select json_agg(row_to_json(p)) from private.proven(a.workspace_id, least(coalesce(p_limit, 20), 50), 2) p), '[]'::json);
end $function$
;

CREATE OR REPLACE FUNCTION public.mcp_recordings(p_hash text, p_limit integer DEFAULT 10)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare a record;
begin
  select * into a from private.mcp_auth(p_hash);
  return coalesce((select json_agg(row_to_json(r)) from (
    select r.id, r.source, r.title, r.started_at, r.minutes, r.url, r.words,
      (select left(string_agg(c.body, ' ' order by c.idx), 1400) from public.recording_chunks c where c.recording_id = r.id and c.idx < 3) as opening
    from public.recordings r where r.workspace_id = a.workspace_id and r.status = 'ready' order by r.started_at desc nulls last limit least(coalesce(p_limit, 10), 30)) r), '[]'::json);
end $function$
;

CREATE OR REPLACE FUNCTION public.mcp_research(p_hash text, p_preset text DEFAULT NULL::text, p_limit integer DEFAULT 3)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare a record; r json;
begin
  select * into a from private.mcp_auth(p_hash);
  select coalesce(json_agg(x), '[]'::json) into r from (
    select id, preset, label, status, items, item_count, cost_usd, created_at from public.research_runs
    where workspace_id = a.workspace_id and preset not like 'creator-%' and (p_preset is null or preset = p_preset)
    order by created_at desc limit least(greatest(coalesce(p_limit, 3), 1), 10)) x;
  return r;
end $function$
;

CREATE OR REPLACE FUNCTION public.mcp_scores(p_hash text)
 RETURNS json
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare a record; ws uuid;
begin
  select * into a from private.mcp_auth(p_hash); ws := a.workspace_id;
  return json_build_object(
    'facts_approved', (select count(*) from public.brain_facts f where f.workspace_id = ws and f.status = 'approved'),
    'facts_waiting', (select count(*) from public.brain_facts f where f.workspace_id = ws and f.status = 'proposed'),
    'writing_samples', (select count(*) from public.writing_samples w where w.workspace_id = ws),
    'docs', (select count(*) from public.brain_docs b where b.workspace_id = ws and b.status = 'ready'),
    'studied_docs', (select p.doc_count from public.brain_profile p where p.workspace_id = ws),
    'connected', (select coalesce(json_agg(c.provider), '[]'::json) from public.workspace_connections c where c.workspace_id = ws and c.status = 'connected'),
    'creators', (select count(*) from public.creators c where c.workspace_id = ws),
    'calls', private.calls_status(ws),
    'open_loops', (select count(*) from public.memory_items m where m.workspace_id = ws and m.status = 'open' and m.kind in ('commitment', 'waiting')),
    'suggested', (select count(*) from public.memory_items m where m.workspace_id = ws and m.status = 'suggested'),
    'drafts_waiting', (select count(*) from public.os_drafts d where d.workspace_id = ws and d.status = 'waiting'),
    'oldest_draft_days', (select extract(day from now() - min(d.created_at))::int from public.os_drafts d where d.workspace_id = ws and d.status = 'waiting'),
    'drafts_decided_30d', (select count(*) from public.os_drafts d where d.workspace_id = ws and d.decided_at > now() - interval '30 days'),
    'goals', (select count(*) from public.memory_items m where m.workspace_id = ws and m.kind = 'goal' and m.status <> 'archived'));
end $function$
;

CREATE OR REPLACE FUNCTION public.mcp_search(p_hash text, p_q text, p_kinds text[] DEFAULT NULL::text[], p_limit integer DEFAULT 12)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare a record;
begin
  select * into a from private.mcp_auth(p_hash);
  return coalesce((select json_agg(row_to_json(s)) from private.chat_search(a.workspace_id, p_q, p_kinds, least(coalesce(p_limit, 12), 30)) s), '[]'::json);
end $function$
;

CREATE OR REPLACE FUNCTION public.mcp_strategy_context(p_hash text)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare a record;
begin
  select * into a from private.mcp_auth(p_hash);
  return (select coalesce(jsonb_agg(to_jsonb(s) order by s.updated_at desc),'[]') from public.founder_strategy s
    where s.workspace_id=a.workspace_id and s.lifecycle in ('live','planned'));
end $function$
;

CREATE OR REPLACE FUNCTION public.mcp_whoami(p_hash text, p_client text DEFAULT NULL::text)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare a record; p record; s text;
begin
  select * into a from private.mcp_auth(p_hash, coalesce(p_client, ''));
  select full_name into p from public.profiles where id = a.user_id;
  select t.scope into s from public.mcp_tokens t where t.token_hash = p_hash;
  return json_build_object('workspace_id', a.workspace_id, 'workspace', a.ws_name, 'kind', a.ws_kind, 'token', a.token_name, 'founder', p.full_name, 'client', a.last_client, 'scope', coalesce(s, 'write'));
end $function$
;

CREATE OR REPLACE FUNCTION public.mcp_writing(p_hash text, p_limit integer DEFAULT 5)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare a record;
begin
  select * into a from private.mcp_auth(p_hash);
  return json_build_object(
    'guide', (select coalesce(case when y.ai_guide is not null and array_length(y.ai_guide, 1) > 0 then y.ai_guide else y.guide end, '{}') from public.writing_style y where y.workspace_id = a.workspace_id),
    'profile', (select y.profile from public.writing_style y where y.workspace_id = a.workspace_id),
    'samples', coalesce((select json_agg(json_build_object('title', x.title, 'kind', x.kind, 'words', x.words, 'body', left(x.body, 4000)) order by x.pinned desc, x.created_at desc)
      from (select * from public.writing_samples x where x.workspace_id = a.workspace_id order by x.pinned desc, x.created_at desc limit least(greatest(coalesce(p_limit, 5), 1), 20)) x), '[]'::json));
end $function$
;

CREATE OR REPLACE FUNCTION public.morning_claim(p_secret text, p_ws uuid, p_force boolean DEFAULT false)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  d date := (now() at time zone private.app_tz())::date;
  b public.morning_briefs; token uuid := gen_random_uuid(); inputs jsonb;
begin
  if not private.cron_ok(p_secret) then raise exception 'not allowed' using errcode = '42501'; end if;
  if not exists (select 1 from public.workspaces where id = p_ws and kind <> 'demo') then
    raise exception 'Workspace not found' using errcode = 'P0002';
  end if;
  insert into public.morning_briefs (workspace_id, day, started_at)
    values (p_ws, d, now() - interval '10 minutes') on conflict (workspace_id, day) do nothing;
  select * into b from public.morning_briefs where workspace_id = p_ws and day = d for update;
  if (b.status = 'ready' and not p_force) or
     (b.status = 'generating' and b.started_at > now() - interval '4 minutes') then
    return jsonb_build_object('claimed', false, 'status', b.status, 'snapshot', private.morning_snapshot(p_ws));
  end if;
  if p_force and b.status = 'ready' and b.started_at > now() - interval '2 minutes' then
    return jsonb_build_object('claimed', false, 'status', 'cooldown', 'snapshot', private.morning_snapshot(p_ws));
  end if;
  perform private.dna_compile(p_ws);
  update public.morning_briefs set lease = token, status = 'generating', started_at = now(), error = null where id = b.id;
  select jsonb_build_object(
    'day', d,
    'dna', (select to_jsonb(x) from public.brand_dna x where x.workspace_id = p_ws),
    'facts', coalesce((select jsonb_agg(to_jsonb(x)) from (
      select category, statement from public.brain_facts where workspace_id = p_ws and status = 'approved'
      order by weight desc, approved_at desc limit 35) x), '[]'::jsonb),
    'items', coalesce((select jsonb_agg(to_jsonb(x)) from (
      select kind, name, summary, price, currency, price_note, url from public.dna_items
      where workspace_id = p_ws and included order by updated_at desc limit 30) x), '[]'::jsonb),
    'proven', coalesce((select jsonb_agg(to_jsonb(x)) from private.proven(p_ws, 30, 1.5) x), '[]'::jsonb),
    'writing', (select to_jsonb(x) from public.writing_style x where workspace_id = p_ws),
    'goals', coalesce((select jsonb_agg(to_jsonb(x)) from (
      select text, due from public.memory_items where workspace_id=p_ws and kind='goal' and status='open'
      order by created_at desc limit 12) x), '[]'::jsonb),
    'candidates', coalesce((select jsonb_agg(to_jsonb(x)) from (
      select id, title, channel, format, meta, updated_at from public.content_items
      where workspace_id = p_ws and stage = 'suggested' and channel in ('youtube','post')
        and meta->>'morning' = d::text
      order by created_at desc, position limit 40) x), '[]'::jsonb),
    'recent', coalesce((select jsonb_agg(title) from (
      select title from public.morning_suggestions where workspace_id = p_ws and kind in ('offer','email')
        and created_at > now() - interval '21 days' order by created_at desc limit 100) x), '[]'::jsonb)
  ) into inputs;
  return jsonb_build_object('claimed', true, 'lease', token, 'inputs', inputs);
end $function$
;

CREATE OR REPLACE FUNCTION public.morning_finish(p_secret text, p_ws uuid, p_lease uuid, p_items jsonb DEFAULT '[]'::jsonb, p_by text DEFAULT NULL::text, p_context_hash text DEFAULT NULL::text, p_dna_version integer DEFAULT NULL::integer, p_error text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  b public.morning_briefs; x jsonb; c uuid; k text; n int := 0; rev int; ch text;
begin
  if not private.cron_ok(p_secret) then raise exception 'not allowed' using errcode = '42501'; end if;
  select * into b from public.morning_briefs where workspace_id = p_ws and lease = p_lease for update;
  if b.id is null or b.status <> 'generating' then raise exception 'This briefing run has expired'; end if;
  if p_error is not null then
    update public.morning_briefs set status = 'error', error = left(p_error, 400), lease = null where id = b.id;
    return private.morning_snapshot(p_ws);
  end if;
  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) <> 8 then raise exception 'Expected eight suggestions'; end if;
  foreach k in array array['youtube','post','offer','email'] loop
    if (select count(*) from jsonb_array_elements(p_items) e where e->>'kind' = k) <> 2 then
      raise exception 'Expected two suggestions per format';
    end if;
  end loop;
  rev := b.revision + 1;
  for x in select value from jsonb_array_elements(p_items) loop
    k := x->>'kind'; c := null;
    if length(trim(coalesce(x->>'title',''))) < 5 then raise exception 'Suggestion title is missing'; end if;
    if k in ('youtube','post') then
      if nullif(x->>'content_id','') is not null then
        select id into c from public.content_items where id = (x->>'content_id')::uuid and workspace_id = p_ws
          and channel = k and stage = 'suggested';
        if c is null then raise exception 'This content idea has changed. Refresh the briefing'; end if;
      else
        insert into public.content_items (workspace_id,title,stage,channel,format,position,meta)
        values (p_ws,left(x->>'title',300),'suggested',k,case when k='youtube' then 'long' else 'post' end,
          -extract(epoch from now())/1e6,
          jsonb_build_object('hook', x->'payload'->>'hook', 'outline', coalesce(x->'payload'->'outline','[]'::jsonb),
            'post_body', case when k='post' then x->'payload'->>'body' else null end,
            'why', x->>'why', 'morning_brief', b.id, 'by', p_by,
            'evidence', coalesce(x->'evidence','[]'::jsonb)))
        returning id into c;
      end if;
    end if;
    insert into public.morning_suggestions (workspace_id,brief_id,revision,kind,title,summary,why,payload,evidence,content_id,position)
    values (p_ws,b.id,rev,k,left(x->>'title',300),left(coalesce(x->>'summary',''),500),
      left(coalesce(x->>'why',''),2500),coalesce(x->'payload','{}'::jsonb) ||
        jsonb_build_object('source_updated_at',x->>'source_updated_at'),
      coalesce(x->'evidence','[]'::jsonb),c,n);
    n := n+1;
  end loop;
  update public.morning_briefs set status='ready', revision=rev, generated_at=now(),
    context_hash=p_context_hash, dna_version=p_dna_version, by=left(p_by,80), lease=null, error=null where id=b.id;
  return private.morning_snapshot(p_ws);
end $function$
;

CREATE OR REPLACE FUNCTION public.morning_move(p_ws uuid, p_id uuid, p_dismiss boolean DEFAULT false)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
  if not private.is_member(p_ws) then raise exception 'not allowed' using errcode='42501'; end if;
  raise exception 'Review this idea in Approvals. The old briefing no longer moves drafts into production.';
end $function$
;

CREATE OR REPLACE FUNCTION public.morning_read(p_ws uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
  if not private.is_member(p_ws) then raise exception 'not allowed' using errcode = '42501'; end if;
  return private.morning_snapshot(p_ws);
end $function$
;

CREATE OR REPLACE FUNCTION public.program_confirm(p_ws uuid, p_id uuid, p_digest text, p_confirm boolean DEFAULT false)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare p public.program_proposals; result jsonb; rid uuid; revision integer;
begin
  if auth.uid() is null or not private.is_member(p_ws) then raise exception 'not allowed'; end if;
  if p_confirm is distinct from true then raise exception 'Confirm the displayed proposal first'; end if;
  perform pg_advisory_xact_lock(hashtextextended(p_ws::text,9));
  select * into p from public.program_proposals where id=p_id and workspace_id=p_ws for update;
  if not found then raise exception 'Proposal not found'; end if;
  if p_digest is distinct from p.digest then raise exception 'The reviewed proposal does not match'; end if;
  if p.status='applied' then
    select to_jsonb(x) into result from public.programs x where id=p.result_id and workspace_id=p_ws;
    return jsonb_build_object('program',result,'already_applied',true);
  end if;
  if p.status<>'pending' then raise exception 'This proposal was dismissed'; end if;
  if p.target_id is not null then
    select x.revision into revision from public.programs x where id=p.target_id and workspace_id=p_ws and not archived;
    if not found then raise exception 'This program is archived or no longer available'; end if;
    if revision<>p.expected_revision then raise exception 'Program changed. Request a fresh proposal.' using errcode='40001'; end if;
  end if;
  rid:=coalesce(p.target_id,gen_random_uuid());
  result:=public.program_save(p_ws,rid,p.data,p.expected_revision,false);
  if p.target_id is null then
    update public.programs set origin='ai' where id=rid returning to_jsonb(programs.*) into result;
  end if;
  update public.program_proposals set status='applied',result_id=rid,applied_at=now(),applied_by=auth.uid() where id=p_id;
  return jsonb_build_object('program',result,'already_applied',false);
end $function$
;

CREATE OR REPLACE FUNCTION public.program_dismiss(p_ws uuid, p_id uuid)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
  if auth.uid() is null or not private.is_member(p_ws) then raise exception 'not allowed'; end if;
  update public.program_proposals set status='dismissed' where id=p_id and workspace_id=p_ws and status='pending';
  return found;
end $function$
;

CREATE OR REPLACE FUNCTION public.program_material_remove(p_ws uuid, p_id uuid, p_revision integer)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare m public.program_materials;
begin
  if auth.uid() is null or not private.is_member(p_ws) then raise exception 'not allowed'; end if;
  perform pg_advisory_xact_lock(hashtextextended(p_ws::text,9));
  select * into m from public.program_materials where id=p_id and workspace_id=p_ws for update;
  if not found then return jsonb_build_object('removed',true); end if;
  if m.revision is distinct from p_revision then raise exception 'Material changed. Reload it before removing.' using errcode='40001'; end if;
  if exists(select 1 from public.programs p cross join lateral jsonb_array_elements(p.data->'stages') s
    cross join lateral jsonb_array_elements(s->'cards') c where p.workspace_id=p_ws and c->'material_ids' ? p_id::text)
    then raise exception 'Unlink this material from its lessons before removing it.'; end if;
  if m.storage_path is null then
    delete from public.program_materials where id=p_id;
    return jsonb_build_object('removed',true);
  end if;
  update public.program_materials set removal_pending=true where id=p_id;
  return jsonb_build_object('removed',false,'storage_path',m.storage_path);
end $function$
;

CREATE OR REPLACE FUNCTION public.program_material_removed(p_ws uuid, p_id uuid, p_path text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare m public.program_materials;
begin
  if auth.uid() is null or not private.is_member(p_ws) then raise exception 'not allowed'; end if;
  perform pg_advisory_xact_lock(hashtextextended(p_ws::text,9));
  select * into m from public.program_materials where id=p_id and workspace_id=p_ws for update;
  if not found then return jsonb_build_object('removed',true); end if;
  if not m.removal_pending or p_path is distinct from m.storage_path then raise exception 'Begin this material removal first'; end if;
  delete from public.program_materials where id=p_id;
  return jsonb_build_object('removed',true);
end $function$
;

CREATE OR REPLACE FUNCTION public.program_material_save(p_ws uuid, p_id uuid, p_row jsonb, p_revision integer)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare cur public.program_materials; result public.program_materials; pid uuid; sp text;
begin
  if auth.uid() is null or not private.is_member(p_ws) then raise exception 'not allowed'; end if;
  if p_id is null or p_revision is null or p_revision<0 then raise exception 'Invalid material'; end if;
  pid:=nullif(p_row->>'program_id','')::uuid; sp:=nullif(p_row->>'storage_path','');
  if pid is not null and not exists(select 1 from public.programs where id=pid and workspace_id=p_ws) then raise exception 'not allowed'; end if;
  if sp is not null and (sp not like p_ws::text||'/programs/'||p_id::text||'/%' or cardinality(string_to_array(sp,'/'))<>4 or position('..' in sp)>0) then raise exception 'Invalid file path'; end if;
  if nullif(p_row->>'url','') is not null and p_row->>'url' !~ '^https?://' then raise exception 'Invalid material URL'; end if;
  perform pg_advisory_xact_lock(hashtextextended(p_ws::text,9));
  perform pg_advisory_xact_lock(hashtextextended(p_id::text,8));
  select * into cur from public.program_materials where id=p_id for update;
  if found then
    if cur.workspace_id<>p_ws then raise exception 'not allowed'; end if;
    if cur.removal_pending then raise exception 'This material is being removed. Retry removal before continuing.'; end if;
    if cur.revision<>p_revision then
      if cur.revision=p_revision+1 and cur.storage_path is not distinct from sp and cur.title=p_row->>'title'
        and cur.notes=coalesce(p_row->>'notes','') and cur.program_id is not distinct from pid
        and (p_revision>0 or (
          cur.body=coalesce(p_row->>'body','') and cur.url is not distinct from nullif(p_row->>'url','')
          and coalesce(cur.filename,'')=coalesce(p_row->>'filename','')
          and coalesce(cur.mime,'')=coalesce(p_row->>'mime','')
          and cur.size=coalesce((p_row->>'size')::bigint,0)
          and cur.read_state=coalesce(p_row->>'read_state','attachment')
        )) then return to_jsonb(cur); end if;
      raise exception 'Material changed. Reload it before saving.' using errcode='40001';
    end if;
    update public.program_materials set title=p_row->>'title',notes=coalesce(p_row->>'notes',''),program_id=pid,
      revision=revision+1,updated_at=now() where id=p_id returning * into result;
  else
    if p_revision<>0 then raise exception 'Material no longer exists'; end if;
    insert into public.program_materials(id,workspace_id,program_id,title,filename,mime,size,storage_path,url,body,notes,read_state,chars)
    values(p_id,p_ws,pid,p_row->>'title',left(p_row->>'filename',200),left(p_row->>'mime',160),
      coalesce((p_row->>'size')::bigint,0),sp,nullif(p_row->>'url',''),coalesce(p_row->>'body',''),
      coalesce(p_row->>'notes',''),coalesce(p_row->>'read_state','attachment'),char_length(coalesce(p_row->>'body','')))
    returning * into result;
  end if;
  return to_jsonb(result);
end $function$
;

CREATE OR REPLACE FUNCTION public.program_propose(p_ws uuid, p_id uuid, p_data jsonb, p_digest text, p_answer text, p_changes jsonb DEFAULT '[]'::jsonb, p_target uuid DEFAULT NULL::uuid, p_revision integer DEFAULT 0, p_update_requested boolean DEFAULT false)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare r public.program_proposals;
begin
  if auth.uid() is null or not private.is_member(p_ws) then raise exception 'not allowed'; end if;
  if p_target is not null then
    if not coalesce(p_update_requested,false) then raise exception 'Explicit permission to propose updates is required'; end if;
    if not exists(select 1 from public.programs where id=p_target and workspace_id=p_ws and revision=p_revision and not archived)
      then raise exception 'Program changed. Request a fresh proposal.' using errcode='40001'; end if;
  end if;
  if not private.program_valid(p_data) or jsonb_typeof(p_changes)<>'array' or jsonb_array_length(p_changes)>60 or char_length(p_answer)>10000 then raise exception 'Invalid proposal'; end if;
  insert into public.program_proposals(id,workspace_id,target_id,expected_revision,data,changes,answer,digest)
    values(p_id,p_ws,p_target,p_revision,p_data,p_changes,coalesce(p_answer,''),p_digest) on conflict(id) do nothing;
  select * into r from public.program_proposals where id=p_id and workspace_id=p_ws;
  if not found then raise exception 'not allowed'; end if;
  return to_jsonb(r);
end $function$
;

CREATE OR REPLACE FUNCTION public.program_save(p_ws uuid, p_id uuid, p_data jsonb, p_revision integer, p_archived boolean DEFAULT false)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare cur public.programs; result public.programs;
begin
  if auth.uid() is null or not private.is_member(p_ws) then raise exception 'not allowed'; end if;
  if not private.program_valid(p_data) or p_id is null or p_revision is null or p_revision<0 then raise exception 'Invalid program'; end if;
  perform pg_advisory_xact_lock(hashtextextended(p_ws::text,9));
  if exists(
    select 1 from jsonb_array_elements(p_data->'stages') s cross join lateral jsonb_array_elements(s->'cards') c
      cross join lateral jsonb_array_elements_text(c->'material_ids') m
    where not exists(select 1 from public.program_materials pm where pm.workspace_id=p_ws and pm.id=m::uuid and not pm.removal_pending)
  ) then raise exception 'A material is not in this workspace or is being removed'; end if;
  perform pg_advisory_xact_lock(hashtextextended(p_id::text,7));
  select * into cur from public.programs where id=p_id for update;
  if found then
    if cur.workspace_id<>p_ws then raise exception 'not allowed'; end if;
    if cur.revision<>p_revision then
      if cur.revision=p_revision+1 and cur.data=p_data and cur.archived=coalesce(p_archived,false) then return to_jsonb(cur); end if;
      raise exception 'Program changed. Reload it before saving.' using errcode='40001';
    end if;
    insert into public.program_versions(program_id,workspace_id,revision,data,archived) values(cur.id,p_ws,cur.revision,cur.data,cur.archived);
    update public.programs set data=p_data,archived=coalesce(p_archived,false),revision=revision+1,updated_at=now()
      where id=p_id returning * into result;
    delete from public.program_versions where program_id=p_id and revision not in
      (select revision from public.program_versions where program_id=p_id order by revision desc limit 30);
  else
    if p_revision<>0 then raise exception 'Program no longer exists'; end if;
    insert into public.programs(id,workspace_id,data,archived) values(p_id,p_ws,p_data,coalesce(p_archived,false)) returning * into result;
  end if;
  return to_jsonb(result);
end $function$
;

CREATE OR REPLACE FUNCTION public.proven_content(p_ws uuid, p_limit integer DEFAULT 60, p_min numeric DEFAULT 1.5)
 RETURNS SETOF json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
  if not private.is_member(p_ws) then raise exception 'not allowed' using errcode = '42501'; end if;
  return query select row_to_json(p) from private.proven(p_ws, p_limit, p_min) p;
end $function$
;

CREATE OR REPLACE FUNCTION public.recording_store(p_ws uuid, p_rec jsonb, p_chunks jsonb)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
  if auth.uid() is null or not private.is_member(p_ws) then raise exception 'not allowed' using errcode = '42501'; end if;
  return private.recording_store(p_ws, p_rec, p_chunks);
end $function$
;

CREATE OR REPLACE FUNCTION public.strategy_save(p_ws uuid, p_id uuid, p_data jsonb, p_revision integer DEFAULT 0)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare r public.founder_strategy; linked uuid:=nullif(p_data->>'linked_offer_id','')::uuid; inv uuid:=nullif(p_data->>'inventory_id','')::uuid;
begin
  if auth.uid() is null or not private.is_member(p_ws) then raise exception 'not allowed' using errcode='42501'; end if;
  perform pg_advisory_xact_lock(hashtextextended(p_ws::text,24));
  if p_id is null or jsonb_typeof(p_data) is distinct from 'object' or length(trim(coalesce(p_data->>'name',''))) not between 1 and 200
    or coalesce(p_data->>'kind','') not in ('offer','funnel') or coalesce(p_data->>'lifecycle','') not in ('live','planned','paused','archived')
    or length(coalesce(p_data->>'summary',''))>4000 or length(coalesce(p_data->>'price_note',''))>200
    or coalesce(p_data->>'currency','USD') !~ '^[A-Z]{3}$' or length(coalesce(p_data->>'url',''))>2000
    or jsonb_typeof(p_data->'details') is distinct from 'object' or octet_length((p_data->'details')::text)>60000 then raise exception 'Invalid strategy details.'; end if;
  if coalesce(p_data->>'url','')<>'' and p_data->>'url' !~ '^https?://[^/?#@[:space:]]+([/?#]|$)' then raise exception 'Use a full public page URL without credentials.'; end if;
  if linked is not null and (p_data->>'kind'<>'funnel' or not exists(select 1 from public.founder_strategy where id=linked and workspace_id=p_ws and kind='offer')) then raise exception 'Choose an offer from this workspace.'; end if;
  if inv is not null and not exists(select 1 from public.dna_items where id=inv and workspace_id=p_ws and kind=p_data->>'kind') then raise exception 'Inventory item not found in this workspace.'; end if;
  select * into r from public.founder_strategy where id=p_id for update;
  if found then
    if r.workspace_id<>p_ws or r.kind<>p_data->>'kind' then raise exception 'not allowed' using errcode='42501'; end if;
    if r.revision<>p_revision then raise exception 'This strategy changed in another tab. Reload before saving.' using errcode='40001'; end if;
  elsif p_revision<>0 then raise exception 'This strategy no longer exists.';
  elsif (select count(*) from public.founder_strategy where workspace_id=p_ws)>=500 then raise exception 'This workspace already has 500 strategy records.'; end if;
  insert into public.founder_strategy(id,workspace_id,kind,name,lifecycle,summary,price,currency,price_note,url,steps,linked_offer_id,inventory_id,details,created_by)
  values(p_id,p_ws,p_data->>'kind',trim(p_data->>'name'),p_data->>'lifecycle',coalesce(p_data->>'summary',''),
    nullif(p_data->>'price','')::numeric,coalesce(p_data->>'currency','USD'),coalesce(p_data->>'price_note',''),coalesce(p_data->>'url',''),
    nullif(p_data->>'steps','')::int,linked,inv,p_data->'details',auth.uid())
  on conflict(id) do update set name=excluded.name,lifecycle=excluded.lifecycle,summary=excluded.summary,price=excluded.price,
    currency=excluded.currency,price_note=excluded.price_note,url=excluded.url,steps=excluded.steps,linked_offer_id=excluded.linked_offer_id,
    inventory_id=excluded.inventory_id,details=excluded.details,revision=founder_strategy.revision+1,updated_at=now()
  returning * into r;
  return to_jsonb(r);
end $function$
;

CREATE OR REPLACE FUNCTION public.tella_approve(p_ws uuid, p_id uuid, p_revision integer, p_kind text, p_confirm boolean)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare e public.tella_edits;a public.tella_approvals;
begin
  if auth.uid() is null or not private.is_member(p_ws) then raise exception 'not allowed' using errcode='42501';end if;
  if p_confirm is distinct from true then raise exception 'Confirm the exact storyboard before approving.';end if;
  if p_kind not in ('storyboard','final','publish') then raise exception 'Unknown approval.';end if;
  select * into e from public.tella_edits where id=p_id and workspace_id=p_ws for update;
  if not found or e.archived or e.revision<>p_revision then raise exception 'The storyboard changed. Review the latest saved revision before approving.' using errcode='40001';end if;
  if e.plan is null then raise exception 'Generate or write a storyboard first.';end if;
  if p_kind in ('final','publish') and not exists(select 1 from public.tella_approvals where edit_id=p_id and kind='storyboard' and edit_revision=p_revision) then raise exception 'Approve the storyboard first.';end if;
  if p_kind='final' and (coalesce(e.run->>'status','')<>'review' or (e.run->>'revision')::int is distinct from p_revision) then raise exception 'Apply this storyboard in Tella and review it first.';end if;
  if p_kind='publish' and not exists(select 1 from public.tella_approvals where edit_id=p_id and kind='final' and edit_revision=p_revision) then raise exception 'Approve the finished edit before publishing.';end if;
  insert into public.tella_approvals(workspace_id,edit_id,kind,edit_revision,snapshot,digest,approved_by)
    values(p_ws,p_id,p_kind,p_revision,jsonb_build_object('title',e.title,'plan',e.plan,'video',e.run->>'video_id'),encode(extensions.digest(e.plan::text,'sha256'),'hex'),auth.uid())
    on conflict(edit_id,kind,edit_revision) do nothing;
  select * into a from public.tella_approvals where edit_id=p_id and kind=p_kind and edit_revision=p_revision;
  return to_jsonb(a);
end $function$
;

CREATE OR REPLACE FUNCTION public.tella_edit_save(p_ws uuid, p_id uuid, p_data jsonb, p_revision integer DEFAULT 0)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare r public.tella_edits;t text:=trim(coalesce(p_data->>'title',''));pl jsonb:=p_data->'plan';n text:=coalesce(p_data->>'notes','');ar boolean:=coalesce((p_data->>'archived')::boolean,false);
begin
  if auth.uid() is null or not private.is_member(p_ws) then raise exception 'not allowed' using errcode='42501';end if;
  if p_id is null or jsonb_typeof(p_data) is distinct from 'object' or length(t) not between 1 and 180 or length(n)>8000
    or (pl is not null and pl<>'null'::jsonb and (jsonb_typeof(pl)<>'object' or octet_length(pl::text)>400000)) then raise exception 'Invalid Tella edit.';end if;
  if pl='null'::jsonb then pl:=null;end if;
  perform pg_advisory_xact_lock(hashtextextended(p_ws::text,36));
  select * into r from public.tella_edits where id=p_id for update;
  if found then
    if r.workspace_id<>p_ws then raise exception 'not allowed' using errcode='42501';end if;
    if r.title=t and r.plan is not distinct from pl and r.notes=n and r.archived=ar then return to_jsonb(r);end if;
    if r.revision<>p_revision then raise exception 'This edit changed in another window. Reload it before saving.' using errcode='40001';end if;
    update public.tella_edits set title=t,plan=pl,notes=n,archived=ar,revision=revision+1,updated_at=clock_timestamp() where id=p_id returning * into r;
  else
    if p_revision<>0 then raise exception 'Tella edit not found.';end if;
    if jsonb_typeof(p_data->'source') is distinct from 'object' or jsonb_typeof(p_data->'source'->'clips') is distinct from 'array'
      or octet_length((p_data->'source')::text)>1500000 then raise exception 'Import the Tella video again.';end if;
    if (select count(*) from public.tella_edits where workspace_id=p_ws)>=300 then raise exception 'This workspace already has 300 Tella edits.';end if;
    insert into public.tella_edits(id,workspace_id,tella_video_id,title,source,plan,notes,created_by)
      values(p_id,p_ws,p_data->>'tella_video_id',t,p_data->'source',pl,n,auth.uid())
      on conflict(workspace_id,tella_video_id) do nothing returning * into r;
    if r.id is null then select * into r from public.tella_edits where workspace_id=p_ws and tella_video_id=p_data->>'tella_video_id';end if;
  end if;return to_jsonb(r);
end $function$
;

CREATE OR REPLACE FUNCTION public.tella_run_save(p_ws uuid, p_id uuid, p_revision integer, p_run jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare e public.tella_edits;
begin
  if auth.uid() is null or not private.is_member(p_ws) then raise exception 'not allowed' using errcode='42501';end if;
  if jsonb_typeof(p_run) is distinct from 'object' or octet_length(p_run::text)>400000 or (p_run->>'revision')::int is distinct from p_revision then raise exception 'Invalid apply state.';end if;
  select * into e from public.tella_edits where id=p_id and workspace_id=p_ws for update;
  if not found or e.archived or e.revision<>p_revision then raise exception 'The storyboard changed while applying. Review and approve the latest revision.' using errcode='40001';end if;
  if not exists(select 1 from public.tella_approvals where edit_id=p_id and kind='storyboard' and edit_revision=p_revision) then raise exception 'Approve the storyboard first.';end if;
  update public.tella_edits set run=p_run,updated_at=clock_timestamp() where id=p_id returning * into e;
  return to_jsonb(e);
end $function$
;

CREATE OR REPLACE FUNCTION public.touch_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
begin new.updated_at := now(); return new; end; $function$
;

CREATE OR REPLACE FUNCTION public.vault_context(p_ws uuid, p_query text DEFAULT ''::text, p_purpose text DEFAULT 'general'::text, p_ids uuid[] DEFAULT '{}'::uuid[])
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
  if not private.is_member(p_ws) then raise exception 'not allowed' using errcode='42501'; end if;
  if cardinality(p_ids)>4 then raise exception 'Choose up to four inspiration briefs'; end if;
  if cardinality(p_ids)>0 and
     (select count(*) from public.vault_notes where workspace_id=p_ws and id=any(p_ids) and not archived) <> cardinality(p_ids) then
    raise exception 'A selected inspiration brief is unavailable'; end if;
  return private.vault_notes_for(p_ws,p_query,p_purpose,p_ids);
end $function$
;

CREATE OR REPLACE FUNCTION public.vault_note_create(p_ws uuid, p_id uuid, p_note jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare n public.vault_notes; src jsonb; ids uuid[]; found_count integer;
begin
  if not private.is_member(p_ws) then raise exception 'not allowed' using errcode='42501'; end if;
  select * into n from public.vault_notes where id=p_id and workspace_id=p_ws;
  if found then return to_jsonb(n)-'search_text'; end if;
  if jsonb_typeof(p_note->'sources') is distinct from 'array'
     or jsonb_array_length(p_note->'sources') not between 1 and 12 then
    raise exception 'Choose between one and twelve saved examples'; end if;
  select array_agg(distinct (s->>'id')::uuid) into ids from jsonb_array_elements(p_note->'sources') s;
  select count(*) into found_count from public.swipe_items where workspace_id=p_ws and id=any(ids);
  if found_count <> cardinality(ids) or cardinality(ids) <> jsonb_array_length(p_note->'sources') then
    raise exception 'An example was removed or belongs to another workspace' using errcode='42501'; end if;
  -- Titles and URLs are canonical. Keep the reading fingerprint and date to flag
  -- changed material later; a saved brief survives deletion of its source.
  select jsonb_agg(jsonb_build_object(
    'id',s.id,'ref','S'||j.ord,'title',coalesce(s.title,s.analysis->>'name','Untitled example'),
    'url',s.url,'brand',s.brand,'kind',s.kind,
    'captured_at',j.obj->>'captured_at','read_at',j.obj->>'read_at',
    'fingerprint',left(j.obj->>'fingerprint',20),'coverage',left(j.obj->>'coverage',30)
  ) order by j.ord) into src
  from jsonb_array_elements(p_note->'sources') with ordinality j(obj,ord)
  join public.swipe_items s on s.id=(j.obj->>'id')::uuid and s.workspace_id=p_ws;
  insert into public.vault_notes(id,workspace_id,title,purpose,body,context,sources,by,dna_version,created_by)
  values(p_id,p_ws,btrim(p_note->>'title'),coalesce(p_note->>'purpose','general'),
    p_note->>'body',coalesce(p_note->>'context',''),src,left(coalesce(p_note->>'by','Saved breakdowns'),100),
    (p_note->>'dna_version')::integer,auth.uid())
  on conflict(id) do nothing;
  select * into n from public.vault_notes where id=p_id and workspace_id=p_ws;
  if not found then raise exception 'Could not save this brief' using errcode='42501'; end if;
  return to_jsonb(n)-'search_text';
end $function$
;

CREATE OR REPLACE FUNCTION public.vault_note_update(p_ws uuid, p_id uuid, p_revision integer, p_patch jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare n public.vault_notes;
begin
  if not private.is_member(p_ws) then raise exception 'not allowed' using errcode='42501'; end if;
  select * into n from public.vault_notes where id=p_id and workspace_id=p_ws for update;
  if not found then raise exception 'This brief is no longer available'; end if;
  if n.revision is distinct from p_revision then
    raise exception 'This brief changed in another tab. Reload it before saving.' using errcode='40001'; end if;
  update public.vault_notes set
    title=case when p_patch ? 'title' then btrim(p_patch->>'title') else title end,
    body=case when p_patch ? 'body' then p_patch->>'body' else body end,
    context=case when p_patch ? 'context' then p_patch->>'context' else context end,
    purpose=case when p_patch ? 'purpose' then p_patch->>'purpose' else purpose end,
    enabled=case when p_patch ? 'enabled' then (p_patch->>'enabled')::boolean else enabled end,
    pinned=case when p_patch ? 'pinned' then (p_patch->>'pinned')::boolean else pinned end,
    archived=case when p_patch ? 'archived' then (p_patch->>'archived')::boolean else archived end,
    revision=revision+1,updated_at=clock_timestamp()
  where id=p_id and workspace_id=p_ws returning * into n;
  return to_jsonb(n)-'search_text';
end $function$
;

CREATE OR REPLACE FUNCTION public.video_approve(p_ws uuid, p_id uuid, p_revision integer, p_confirm boolean)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare p public.video_projects;a public.video_approvals;d text;
begin
  if auth.uid() is null or not private.is_member(p_ws) then raise exception 'not allowed' using errcode='42501';end if;
  if p_confirm is distinct from true then raise exception 'Confirm the exact storyboard and style before editing.';end if;
  select * into p from public.video_projects where id=p_id and workspace_id=p_ws for update;
  if not found or p.archived or p.revision<>p_revision then raise exception 'The storyboard changed. Review the latest saved revision before approving.' using errcode='40001';end if;
  if p.data->'source' is null or p.data->'source'='null'::jsonb or not private.video_plan_valid(p.data->'plan',(p.data->'source'->>'duration')::numeric) then raise exception 'Save a complete storyboard before approving.';end if;
  d:=encode(extensions.digest(p.data::text,'sha256'),'hex');
  insert into public.video_approvals(workspace_id,project_id,project_revision,snapshot,digest,approved_by)
    values(p_ws,p_id,p_revision,p.data,d,auth.uid()) on conflict(project_id,project_revision) do nothing;
  select * into a from public.video_approvals where project_id=p_id and project_revision=p_revision;
  return to_jsonb(a);
end $function$
;

CREATE OR REPLACE FUNCTION public.video_export_save(p_ws uuid, p_id uuid, p_project uuid, p_approval uuid, p_file jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare a public.video_approvals;p public.video_projects;r public.video_exports;sp text:=p_file->>'path';sz bigint;expected numeric;
begin
  if auth.uid() is null or not private.is_member(p_ws) then raise exception 'not allowed' using errcode='42501';end if;
  select * into a from public.video_approvals where id=p_approval and workspace_id=p_ws and project_id=p_project;
  if not found then raise exception 'Review and approve this storyboard first.';end if;
  if position(p_ws::text||'/videos/'||p_project::text||'/exports/' in coalesce(sp,''))<>1 then raise exception 'Invalid export path.';end if;
  select (metadata->>'size')::bigint into sz from storage.objects where bucket_id='video-editor' and name=sp;
  if sz is null or sz not between 1 and 524288000 or sz is distinct from (p_file->>'size')::bigint then raise exception 'Finish uploading the rendered file first.';end if;
  select sum((s->>'end')::numeric-(s->>'start')::numeric) into expected from jsonb_array_elements(a.snapshot->'plan'->'segments') s;
  if p_file->>'mime' not in ('video/mp4','video/webm') or abs(coalesce((p_file->>'duration')::numeric,0)-expected)>.2 then raise exception 'The export does not match its approved timeline.';end if;
  insert into public.video_exports(id,workspace_id,project_id,approval_id,storage_path,filename,size,duration,mime,created_by)
  values(p_id,p_ws,p_project,p_approval,sp,left(p_file->>'name',240),sz,expected,p_file->>'mime',auth.uid())
  on conflict(id) do nothing;
  select * into r from public.video_exports where id=p_id and workspace_id=p_ws and project_id=p_project and approval_id=p_approval;
  if r.id is null or r.storage_path<>sp then raise exception 'This export ID is already used.';end if;return to_jsonb(r);
end $function$
;

CREATE OR REPLACE FUNCTION public.video_save(p_ws uuid, p_id uuid, p_data jsonb, p_revision integer DEFAULT 0, p_archived boolean DEFAULT false)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare r public.video_projects;src jsonb:=p_data->'source';ref jsonb;s jsonb;d numeric;prefix text;file_size bigint;
begin
  if auth.uid() is null or not private.is_member(p_ws) then raise exception 'not allowed' using errcode='42501';end if;
  perform pg_advisory_xact_lock(hashtextextended(p_ws::text,35));
  if p_id is null or jsonb_typeof(p_data) is distinct from 'object' or octet_length(p_data::text)>1800000
    or length(trim(coalesce(p_data->>'title',''))) not between 1 and 180
    or length(coalesce(p_data->>'brief',''))>14000 or length(coalesce(p_data->>'revision_notes',''))>8000
    or jsonb_typeof(p_data->'references') is distinct from 'array' or jsonb_array_length(p_data->'references')>10
    or jsonb_typeof(p_data->'transcript') is distinct from 'array' or jsonb_array_length(p_data->'transcript')>12000
    then raise exception 'Invalid video project.';end if;
  prefix:=p_ws::text||'/videos/'||p_id::text||'/';
  if src is not null and src<>'null'::jsonb then
    d:=(src->>'duration')::numeric;
    if jsonb_typeof(src) is distinct from 'object' or d is null or d not between .1 and 14400
      or coalesce((src->>'size')::bigint,0) not between 1 and 524288000
      or coalesce((src->>'width')::int,0) not between 1 and 16384 or coalesce((src->>'height')::int,0) not between 1 and 16384
      or position(prefix||'source/' in coalesce(src->>'path',''))<>1 then raise exception 'Invalid source video.';end if;
    select (metadata->>'size')::bigint into file_size from storage.objects where bucket_id='video-editor' and name=src->>'path';
    if file_size is distinct from (src->>'size')::bigint then raise exception 'Finish uploading the source video before saving.';end if;
  else d:=0;end if;
  for ref in select * from jsonb_array_elements(p_data->'references') loop
    if jsonb_typeof(ref) is distinct from 'object' or length(coalesce(ref->>'url',''))>2000
      or (coalesce(ref->>'url','')<>'' and ref->>'url' !~ '^https?://[^/?#@[:space:]]+([/?#]|$)')
      or length(coalesce(ref->>'notes',''))>4000 then raise exception 'Invalid style reference.';end if;
    if coalesce(ref->>'path','')<>'' and (position(prefix||'refs/' in ref->>'path')<>1
      or not exists(select 1 from storage.objects where bucket_id='video-editor' and name=ref->>'path')) then raise exception 'Reference is not in this project.';end if;
  end loop;
  for s in select * from jsonb_array_elements(p_data->'transcript') loop
    if jsonb_typeof(s->'start') is distinct from 'number' or jsonb_typeof(s->'end') is distinct from 'number'
      or (s->>'start')::numeric<0 or (s->>'end')::numeric>d+.15 or (s->>'end')::numeric<=(s->>'start')::numeric
      or length(coalesce(s->>'text','')) not between 1 and 2000 then raise exception 'Invalid transcript timestamps.';end if;
  end loop;
  if p_data->'plan' is not null and p_data->'plan'<>'null'::jsonb and (d=0 or not private.video_plan_valid(p_data->'plan',d)) then raise exception 'Invalid storyboard or unsupported edit operation.';end if;
  select * into r from public.video_projects where id=p_id for update;
  if found then
    if r.workspace_id<>p_ws then raise exception 'not allowed' using errcode='42501';end if;
    if r.data=p_data and r.archived=p_archived then return to_jsonb(r);end if;
    if r.revision<>p_revision then raise exception 'This edit changed in another window. Reload it before saving.' using errcode='40001';end if;
    update public.video_projects set title=trim(p_data->>'title'),data=p_data,revision=revision+1,archived=p_archived,updated_at=clock_timestamp() where id=p_id returning * into r;
  else
    if p_revision<>0 then raise exception 'Video project not found.';end if;
    if (select count(*) from public.video_projects where workspace_id=p_ws)>=200 then raise exception 'This workspace already has 200 video projects.';end if;
    insert into public.video_projects(id,workspace_id,title,data,archived,created_by) values(p_id,p_ws,trim(p_data->>'title'),p_data,p_archived,auth.uid()) returning * into r;
  end if;return to_jsonb(r);
end $function$
;

alter table private.affiliate_hooks add constraint affiliate_hooks_pkey PRIMARY KEY (workspace_id);
alter table private.app_config add constraint app_config_pkey PRIMARY KEY (key);
alter table private.custom_connection_secrets add constraint custom_connection_secrets_pkey PRIMARY KEY (connection_id);
alter table private.funnel_assets add constraint funnel_assets_pkey PRIMARY KEY (build_id, name);
alter table private.graphic_assets add constraint graphic_assets_pkey PRIMARY KEY (workspace_id, name);
alter table private.inbox_secrets add constraint inbox_secrets_pkey PRIMARY KEY (account_id);
alter table private.recurring_leases add constraint recurring_leases_pkey PRIMARY KEY (run_id);
alter table private.workspace_secrets add constraint workspace_secrets_pkey PRIMARY KEY (workspace_id, provider);
alter table public.affiliate_events add constraint affiliate_events_pkey PRIMARY KEY (id);
alter table public.agent_proposals add constraint agent_proposals_pkey PRIMARY KEY (id);
alter table public.agent_runs add constraint agent_runs_pkey PRIMARY KEY (id);
alter table public.brain_chunks add constraint brain_chunks_pkey PRIMARY KEY (id);
alter table public.brain_docs add constraint brain_docs_pkey PRIMARY KEY (id);
alter table public.brain_facts add constraint brain_facts_pkey PRIMARY KEY (id);
alter table public.brain_profile add constraint brain_profile_pkey PRIMARY KEY (workspace_id);
alter table public.brand_dna add constraint brand_dna_pkey PRIMARY KEY (workspace_id);
alter table public.chat_messages add constraint chat_messages_pkey PRIMARY KEY (id);
alter table public.chat_threads add constraint chat_threads_pkey PRIMARY KEY (id);
alter table public.coach_chunks add constraint coach_chunks_pkey PRIMARY KEY (id);
alter table public.coach_playbook add constraint coach_playbook_pkey PRIMARY KEY (id);
alter table public.coach_sources add constraint coach_sources_pkey PRIMARY KEY (id);
alter table public.coach_usage add constraint coach_usage_pkey PRIMARY KEY (user_id, hour);
alter table public.content_funnel add constraint content_funnel_pkey PRIMARY KEY (id);
alter table public.content_items add constraint content_items_pkey PRIMARY KEY (id);
alter table public.content_learning_config add constraint content_learning_config_pkey PRIMARY KEY (workspace_id);
alter table public.content_learning_events add constraint content_learning_events_pkey PRIMARY KEY (id);
alter table public.content_learning_metrics add constraint content_learning_metrics_pkey PRIMARY KEY (workspace_id, source_key, observed_day);
alter table public.creator_posts add constraint creator_posts_pkey PRIMARY KEY (id);
alter table public.creators add constraint creators_pkey PRIMARY KEY (id);
alter table public.custom_connection_runs add constraint custom_connection_runs_pkey PRIMARY KEY (id);
alter table public.custom_connections add constraint custom_connections_pkey PRIMARY KEY (id);
alter table public.dna_items add constraint dna_items_pkey PRIMARY KEY (id);
alter table public.email_sets add constraint email_sets_pkey PRIMARY KEY (id);
alter table public.founder_agents add constraint founder_agents_pkey PRIMARY KEY (id);
alter table public.founder_strategy add constraint founder_strategy_pkey PRIMARY KEY (id);
alter table public.funnel_builds add constraint funnel_builds_pkey PRIMARY KEY (id);
alter table public.graphic_kits add constraint graphic_kits_pkey PRIMARY KEY (workspace_id);
alter table public.graphic_sets add constraint graphic_sets_pkey PRIMARY KEY (id);
alter table public.grok_tasks add constraint grok_tasks_pkey PRIMARY KEY (id);
alter table public.inbox_accounts add constraint inbox_accounts_pkey PRIMARY KEY (id);
alter table public.inbox_messages add constraint inbox_messages_pkey PRIMARY KEY (id);
alter table public.inbox_people add constraint inbox_people_pkey PRIMARY KEY (id);
alter table public.inbox_stages add constraint inbox_stages_pkey PRIMARY KEY (id);
alter table public.inbox_threads add constraint inbox_threads_pkey PRIMARY KEY (id);
alter table public.mcp_changes add constraint mcp_changes_pkey PRIMARY KEY (id);
alter table public.mcp_tokens add constraint mcp_tokens_pkey PRIMARY KEY (id);
alter table public.memory_items add constraint memory_items_pkey PRIMARY KEY (id);
alter table public.morning_briefs add constraint morning_briefs_pkey PRIMARY KEY (id);
alter table public.morning_suggestions add constraint morning_suggestions_pkey PRIMARY KEY (id);
alter table public.os_drafts add constraint os_drafts_pkey PRIMARY KEY (id);
alter table public.profiles add constraint profiles_pkey PRIMARY KEY (id);
alter table public.program_materials add constraint program_materials_pkey PRIMARY KEY (id);
alter table public.program_proposals add constraint program_proposals_pkey PRIMARY KEY (id);
alter table public.program_versions add constraint program_versions_pkey PRIMARY KEY (program_id, revision);
alter table public.programs add constraint programs_pkey PRIMARY KEY (id);
alter table public.recording_chunks add constraint recording_chunks_pkey PRIMARY KEY (id);
alter table public.recordings add constraint recordings_pkey PRIMARY KEY (id);
alter table public.recurring_tasks add constraint recurring_tasks_pkey PRIMARY KEY (id);
alter table public.research_runs add constraint research_runs_pkey PRIMARY KEY (id);
alter table public.swipe_items add constraint swipe_items_pkey PRIMARY KEY (id);
alter table public.team_agent_settings add constraint team_agent_settings_pkey PRIMARY KEY (workspace_id, agent_id);
alter table public.tella_approvals add constraint tella_approvals_pkey PRIMARY KEY (id);
alter table public.tella_edits add constraint tella_edits_pkey PRIMARY KEY (id);
alter table public.user_access add constraint user_access_pkey PRIMARY KEY (user_id);
alter table public.vault_notes add constraint vault_notes_pkey PRIMARY KEY (id);
alter table public.video_approvals add constraint video_approvals_pkey PRIMARY KEY (id);
alter table public.video_exports add constraint video_exports_pkey PRIMARY KEY (id);
alter table public.video_projects add constraint video_projects_pkey PRIMARY KEY (id);
alter table public.workspace_connections add constraint workspace_connections_pkey PRIMARY KEY (workspace_id, provider);
alter table public.workspace_members add constraint workspace_members_pkey PRIMARY KEY (workspace_id, user_id);
alter table public.workspaces add constraint workspaces_pkey PRIMARY KEY (id);
alter table public.writing_samples add constraint writing_samples_pkey PRIMARY KEY (id);
alter table public.writing_style add constraint writing_style_pkey PRIMARY KEY (workspace_id);
alter table private.affiliate_hooks add constraint affiliate_hooks_token_key UNIQUE (token);
alter table public.affiliate_events add constraint affiliate_events_workspace_id_event_key_key UNIQUE (workspace_id, event_key);
alter table public.agent_runs add constraint agent_runs_workspace_id_id_key UNIQUE (workspace_id, id);
alter table public.coach_sources add constraint coach_sources_kind_ref_key UNIQUE (kind, ref);
alter table public.creator_posts add constraint creator_posts_workspace_id_platform_ext_id_key UNIQUE (workspace_id, platform, ext_id);
alter table public.custom_connections add constraint custom_connections_workspace_id_id_key UNIQUE (workspace_id, id);
alter table public.dna_items add constraint dna_items_workspace_id_kind_source_ext_id_key UNIQUE (workspace_id, kind, source, ext_id);
alter table public.founder_agents add constraint founder_agents_workspace_id_id_key UNIQUE (workspace_id, id);
alter table public.founder_strategy add constraint founder_strategy_workspace_id_id_key UNIQUE (workspace_id, id);
alter table public.inbox_accounts add constraint inbox_accounts_workspace_id_kind_address_key UNIQUE (workspace_id, kind, address);
alter table public.inbox_messages add constraint inbox_messages_thread_id_ext_id_key UNIQUE (thread_id, ext_id);
alter table public.inbox_people add constraint inbox_people_workspace_id_hl_contact_id_key UNIQUE (workspace_id, hl_contact_id);
alter table public.inbox_threads add constraint inbox_threads_workspace_id_source_ext_id_key UNIQUE (workspace_id, source, ext_id);
alter table public.mcp_tokens add constraint mcp_tokens_token_hash_key UNIQUE (token_hash);
alter table public.morning_briefs add constraint morning_briefs_workspace_id_day_key UNIQUE (workspace_id, day);
alter table public.program_materials add constraint program_materials_storage_path_key UNIQUE (storage_path);
alter table public.program_materials add constraint program_materials_workspace_id_id_key UNIQUE (workspace_id, id);
alter table public.program_proposals add constraint program_proposals_workspace_id_id_key UNIQUE (workspace_id, id);
alter table public.programs add constraint programs_workspace_id_id_key UNIQUE (workspace_id, id);
alter table public.recordings add constraint recordings_workspace_id_source_ext_id_key UNIQUE (workspace_id, source, ext_id);
alter table public.recurring_tasks add constraint recurring_tasks_workspace_id_id_key UNIQUE (workspace_id, id);
alter table public.tella_approvals add constraint tella_approvals_edit_id_kind_edit_revision_key UNIQUE (edit_id, kind, edit_revision);
alter table public.tella_edits add constraint tella_edits_workspace_id_id_key UNIQUE (workspace_id, id);
alter table public.tella_edits add constraint tella_edits_workspace_id_tella_video_id_key UNIQUE (workspace_id, tella_video_id);
alter table public.video_approvals add constraint video_approvals_project_id_project_revision_key UNIQUE (project_id, project_revision);
alter table public.video_approvals add constraint video_approvals_workspace_id_id_key UNIQUE (workspace_id, id);
alter table public.video_exports add constraint video_exports_storage_path_key UNIQUE (storage_path);
alter table public.video_projects add constraint video_projects_workspace_id_id_key UNIQUE (workspace_id, id);
alter table private.funnel_assets add constraint funnel_assets_name_check CHECK ((name ~ '^[a-z0-9-]{1,40}\.(webp|png|jpg|svg)$'::text));
alter table public.affiliate_events add constraint affiliate_events_kind_check CHECK ((kind = ANY (ARRAY['lead'::text, 'trial'::text, 'customer'::text, 'commission'::text, 'cancelled'::text, 'other'::text])));
alter table public.agent_proposals add constraint agent_proposals_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'applied'::text, 'dismissed'::text])));
alter table public.agent_runs add constraint agent_runs_status_check CHECK ((status = ANY (ARRAY['queued'::text, 'running'::text, 'done'::text, 'error'::text, 'skipped'::text])));
alter table public.agent_runs add constraint agent_runs_trigger_check CHECK ((trigger = ANY (ARRAY['schedule'::text, 'manual'::text])));
alter table public.brain_docs add constraint brain_docs_category_check CHECK ((category = ANY (ARRAY['voice'::text, 'offers'::text, 'audience'::text, 'story'::text, 'brand'::text, 'frameworks'::text, 'sop'::text, 'research'::text, 'reference'::text, 'other'::text])));
alter table public.brain_docs add constraint brain_docs_kind_check CHECK ((kind ~ '^[a-z0-9-]{2,20}$'::text));
alter table public.brain_docs add constraint brain_docs_status_check CHECK ((status = ANY (ARRAY['ready'::text, 'processing'::text, 'error'::text])));
alter table public.brain_docs add constraint brain_docs_title_check CHECK (((char_length(title) >= 1) AND (char_length(title) <= 200)));
alter table public.brain_facts add constraint brain_facts_category_check CHECK ((category = ANY (ARRAY['identity'::text, 'offers'::text, 'revenue'::text, 'audience'::text, 'voice'::text, 'beliefs'::text, 'proof'::text, 'goals'::text, 'stack'::text, 'never'::text])));
alter table public.brain_facts add constraint brain_facts_statement_check CHECK (((char_length(statement) >= 3) AND (char_length(statement) <= 500)));
alter table public.brain_facts add constraint brain_facts_status_check CHECK ((status = ANY (ARRAY['approved'::text, 'proposed'::text, 'rejected'::text])));
alter table public.brain_facts add constraint brain_facts_weight_check CHECK (((weight >= 1) AND (weight <= 3)));
alter table public.chat_messages add constraint chat_messages_role_check CHECK ((role = ANY (ARRAY['user'::text, 'assistant'::text])));
alter table public.chat_threads add constraint chat_threads_agent_chk CHECK (((agent IS NULL) OR (agent ~ '^[a-z]{2,20}$'::text)));
alter table public.coach_chunks add constraint coach_chunks_body_check CHECK (((char_length(body) >= 1) AND (char_length(body) <= 6000)));
alter table public.coach_playbook add constraint coach_playbook_answer_check CHECK ((char_length(answer) <= 8000));
alter table public.coach_playbook add constraint coach_playbook_keywords_check CHECK ((char_length(keywords) <= 400));
alter table public.coach_playbook add constraint coach_playbook_question_check CHECK (((char_length(question) >= 3) AND (char_length(question) <= 300)));
alter table public.coach_playbook add constraint coach_playbook_status_check CHECK ((status = ANY (ARRAY['draft'::text, 'approved'::text])));
alter table public.coach_playbook add constraint coach_playbook_topic_check CHECK (((char_length(topic) >= 1) AND (char_length(topic) <= 80)));
alter table public.coach_sources add constraint coach_sources_kind_check CHECK ((kind = ANY (ARRAY['doc'::text, 'recording'::text, 'youtube'::text])));
alter table public.coach_sources add constraint coach_sources_title_check CHECK (((char_length(title) >= 1) AND (char_length(title) <= 300)));
alter table public.content_funnel add constraint content_funnel_kind_check CHECK ((kind = ANY (ARRAY['freebie'::text, 'offer'::text, 'funnel'::text])));
alter table public.content_funnel add constraint content_funnel_name_check CHECK (((name IS NULL) OR ((char_length(name) >= 1) AND (char_length(name) <= 200))));
alter table public.content_funnel add constraint content_funnel_plan_check CHECK (((plan IS NULL) OR ((jsonb_typeof(plan) = 'object'::text) AND (octet_length((plan)::text) <= 120000))));
alter table public.content_funnel add constraint content_funnel_shape CHECK ((((kind = 'freebie'::text) AND (name IS NOT NULL) AND (strategy_id IS NULL)) OR ((kind <> 'freebie'::text) AND (strategy_id IS NOT NULL) AND (leads_to IS NULL))));
alter table public.content_funnel add constraint content_funnel_summary_check CHECK ((char_length(summary) <= 2000));
alter table public.content_funnel add constraint content_funnel_url_check CHECK ((char_length(url) <= 2000));
alter table public.content_items add constraint content_items_stage_check CHECK ((stage = ANY (ARRAY['suggested'::text, 'approved'::text, 'planned'::text, 'production'::text, 'published'::text, 'passed'::text])));
alter table public.content_items add constraint content_items_title_check CHECK (((char_length(title) >= 1) AND (char_length(title) <= 300)));
alter table public.content_learning_events add constraint content_learning_events_kind_check CHECK ((kind = ANY (ARRAY['approve'::text, 'pass'::text, 'dismiss'::text, 'edit'::text])));
alter table public.content_learning_events add constraint content_learning_events_origin_check CHECK ((origin = ANY (ARRAY['content'::text, 'morning'::text])));
alter table public.content_learning_metrics add constraint content_learning_metrics_source_check CHECK ((source = ANY (ARRAY['youtube'::text, 'manual'::text])));
alter table public.creator_posts add constraint creator_posts_body_check CHECK (((body IS NULL) OR (char_length(body) <= 8000)));
alter table public.creator_posts add constraint creator_posts_format_check CHECK ((format = ANY (ARRAY['reel'::text, 'carousel'::text, 'photo'::text, 'video'::text, 'short'::text, 'post'::text, 'essay'::text])));
alter table public.creator_posts add constraint creator_posts_platform_check CHECK ((platform = ANY (ARRAY['instagram'::text, 'youtube'::text, 'x'::text, 'linkedin'::text, 'facebook'::text, 'newsletter'::text])));
alter table public.creators add constraint creators_check CHECK ((COALESCE(ig_handle, yt_url, x_handle, li_url, fb_url, news_url) IS NOT NULL));
alter table public.creators add constraint creators_fb_url_check CHECK (((fb_url IS NULL) OR (fb_url ~ '^https://www\.facebook\.com/[^?#]+$'::text)));
alter table public.creators add constraint creators_ig_handle_check CHECK (((ig_handle IS NULL) OR (ig_handle ~ '^[A-Za-z0-9._]{1,30}$'::text)));
alter table public.creators add constraint creators_li_url_check CHECK (((li_url IS NULL) OR (li_url ~ '^https://www\.linkedin\.com/(in|company)/[^/?#]+/$'::text)));
alter table public.creators add constraint creators_name_check CHECK (((char_length(name) >= 1) AND (char_length(name) <= 80)));
alter table public.creators add constraint creators_news_kind_check CHECK (((news_kind IS NULL) OR (news_kind = ANY (ARRAY['substack'::text, 'rss'::text]))));
alter table public.creators add constraint creators_news_url_check CHECK (((news_url IS NULL) OR ((news_url ~ '^https://[^\s]+$'::text) AND (char_length(news_url) <= 300))));
alter table public.creators add constraint creators_x_handle_check CHECK (((x_handle IS NULL) OR (x_handle ~ '^[A-Za-z0-9_]{1,15}$'::text)));
alter table public.creators add constraint creators_yt_url_check CHECK (((yt_url IS NULL) OR (yt_url ~ '^https://(www\.|m\.)?youtube\.com/'::text)));
alter table public.custom_connection_runs add constraint custom_connection_runs_status_check CHECK ((status = ANY (ARRAY['running'::text, 'done'::text, 'error'::text, 'uncertain'::text])));
alter table public.custom_connections add constraint custom_connections_kind_check CHECK ((kind = ANY (ARRAY['mcp'::text, 'skill'::text])));
alter table public.custom_connections add constraint custom_connections_name_check CHECK (((char_length(name) >= 1) AND (char_length(name) <= 100)));
alter table public.dna_items add constraint dna_items_kind_check CHECK ((kind = ANY (ARRAY['offer'::text, 'funnel'::text])));
alter table public.dna_items add constraint dna_items_name_check CHECK (((char_length(name) >= 1) AND (char_length(name) <= 200)));
alter table public.dna_items add constraint dna_items_source_check CHECK ((source = ANY (ARRAY['highlevel'::text, 'you'::text])));
alter table public.email_sets add constraint email_sets_context_check CHECK ((char_length(context) <= 6000));
alter table public.email_sets add constraint email_sets_sequence_check CHECK (((char_length(sequence) >= 1) AND (char_length(sequence) <= 80)));
alter table public.email_sets add constraint email_sets_title_check CHECK (((char_length(title) >= 1) AND (char_length(title) <= 200)));
alter table public.founder_agents add constraint founder_agents_instructions_check CHECK (((length(instructions) >= 1) AND (length(instructions) <= 16000)));
alter table public.founder_agents add constraint founder_agents_name_check CHECK (((length(name) >= 1) AND (length(name) <= 100)));
alter table public.founder_agents add constraint founder_agents_role_check CHECK (((length(role) >= 1) AND (length(role) <= 240)));
alter table public.founder_strategy add constraint founder_strategy_currency_check CHECK ((currency ~ '^[A-Z]{3}$'::text));
alter table public.founder_strategy add constraint founder_strategy_details_check CHECK (((jsonb_typeof(details) = 'object'::text) AND (octet_length((details)::text) <= 60000)));
alter table public.founder_strategy add constraint founder_strategy_kind_check CHECK ((kind = ANY (ARRAY['offer'::text, 'funnel'::text])));
alter table public.founder_strategy add constraint founder_strategy_lifecycle_check CHECK ((lifecycle = ANY (ARRAY['live'::text, 'planned'::text, 'paused'::text, 'archived'::text])));
alter table public.founder_strategy add constraint founder_strategy_name_check CHECK (((length(name) >= 1) AND (length(name) <= 200)));
alter table public.founder_strategy add constraint founder_strategy_price_check CHECK (((price >= (0)::numeric) AND (price <= (1000000000)::numeric)));
alter table public.founder_strategy add constraint founder_strategy_price_note_check CHECK ((length(price_note) <= 200));
alter table public.founder_strategy add constraint founder_strategy_summary_check CHECK ((length(summary) <= 4000));
alter table public.founder_strategy add constraint founder_strategy_url_check CHECK ((length(url) <= 2000));
alter table public.funnel_builds add constraint funnel_builds_engine_check CHECK ((engine = ANY (ARRAY['os'::text, 'claude'::text, 'codex'::text, 'gemini'::text])));
alter table public.funnel_builds add constraint funnel_builds_status_check CHECK ((status = ANY (ARRAY['queued'::text, 'running'::text, 'done'::text, 'failed'::text])));
alter table public.funnel_builds add constraint funnel_builds_title_check CHECK (((char_length(title) >= 1) AND (char_length(title) <= 200)));
alter table public.graphic_sets add constraint graphic_sets_status_check CHECK ((status = ANY (ARRAY['queued'::text, 'running'::text, 'done'::text, 'failed'::text])));
alter table public.graphic_sets add constraint graphic_sets_title_check CHECK (((char_length(title) >= 1) AND (char_length(title) <= 200)));
alter table public.grok_tasks add constraint grok_tasks_agent_check CHECK ((agent = ANY (ARRAY['automations'::text, 'support'::text, 'qa'::text, 'accounting'::text, 'other'::text])));
alter table public.grok_tasks add constraint grok_tasks_instruction_check CHECK (((length(instruction) >= 1) AND (length(instruction) <= 8000)));
alter table public.grok_tasks add constraint grok_tasks_status_check CHECK ((status = ANY (ARRAY['draft'::text, 'sent'::text, 'started'::text, 'done'::text, 'failed'::text, 'needs_you'::text, 'cancelled'::text])));
alter table public.grok_tasks add constraint grok_tasks_summary_check CHECK (((summary IS NULL) OR (length(summary) <= 4000)));
alter table public.grok_tasks add constraint grok_tasks_title_check CHECK (((length(title) >= 1) AND (length(title) <= 160)));
alter table public.inbox_accounts add constraint inbox_accounts_kind_check CHECK ((kind = ANY (ARRAY['imap'::text, 'gmail'::text, 'whatsapp'::text, 'instagram'::text])));
alter table public.inbox_accounts add constraint inbox_accounts_status_check CHECK ((status = ANY (ARRAY['connected'::text, 'error'::text, 'pending'::text])));
alter table public.inbox_messages add constraint inbox_messages_dir_check CHECK ((dir = ANY (ARRAY['in'::text, 'out'::text])));
alter table public.inbox_people add constraint inbox_people_stream_check CHECK ((stream = ANY (ARRAY['software'::text, 'services'::text, 'products'::text, 'affiliate'::text])));
alter table public.inbox_threads add constraint inbox_threads_channel_check CHECK ((channel = ANY (ARRAY['email'::text, 'sms'::text, 'whatsapp'::text, 'instagram'::text, 'facebook'::text, 'chat'::text, 'call'::text, 'other'::text])));
alter table public.inbox_threads add constraint inbox_threads_last_dir_check CHECK ((last_dir = ANY (ARRAY['in'::text, 'out'::text])));
alter table public.inbox_threads add constraint inbox_threads_priority_check CHECK ((priority = ANY (ARRAY['hot'::text, 'client'::text, 'partner'::text, 'normal'::text, 'noise'::text])));
alter table public.inbox_threads add constraint inbox_threads_source_check CHECK ((source = ANY (ARRAY['highlevel'::text, 'imap'::text, 'gmail'::text, 'whatsapp'::text, 'instagram'::text])));
alter table public.inbox_threads add constraint inbox_threads_status_check CHECK ((status = ANY (ARRAY['open'::text, 'waiting'::text, 'done'::text])));
alter table public.mcp_changes add constraint mcp_changes_op_check CHECK ((op = ANY (ARRAY['create'::text, 'update'::text, 'delete'::text, 'undo'::text])));
alter table public.mcp_tokens add constraint mcp_tokens_scope_check CHECK ((scope = ANY (ARRAY['read'::text, 'write'::text, 'agent'::text])));
alter table public.memory_items add constraint memory_items_kind_check CHECK ((kind = ANY (ARRAY['note'::text, 'idea'::text, 'decision'::text, 'commitment'::text, 'waiting'::text, 'person'::text, 'goal'::text])));
alter table public.memory_items add constraint memory_items_status_check CHECK ((status = ANY (ARRAY['suggested'::text, 'open'::text, 'done'::text, 'archived'::text])));
alter table public.memory_items add constraint memory_items_text_check CHECK (((char_length(text) >= 1) AND (char_length(text) <= 2000)));
alter table public.morning_briefs add constraint morning_briefs_status_check CHECK ((status = ANY (ARRAY['generating'::text, 'ready'::text, 'error'::text])));
alter table public.morning_suggestions add constraint morning_suggestions_kind_check CHECK ((kind = ANY (ARRAY['youtube'::text, 'post'::text, 'offer'::text, 'email'::text])));
alter table public.morning_suggestions add constraint morning_suggestions_state_check CHECK ((state = ANY (ARRAY['suggested'::text, 'production'::text, 'dismissed'::text])));
alter table public.os_drafts add constraint os_drafts_status_check CHECK ((status = ANY (ARRAY['waiting'::text, 'approved'::text, 'rejected'::text])));
alter table public.profiles add constraint profiles_theme_check CHECK ((theme = ANY (ARRAY['light'::text, 'dark'::text])));
alter table public.program_materials add constraint program_materials_body_check CHECK ((char_length(body) <= 250000));
alter table public.program_materials add constraint program_materials_notes_check CHECK ((char_length(notes) <= 12000));
alter table public.program_materials add constraint program_materials_read_state_check CHECK ((read_state = ANY (ARRAY['text'::text, 'attachment'::text, 'note'::text])));
alter table public.program_materials add constraint program_materials_size_check CHECK (((size >= 0) AND (size <= 524288000)));
alter table public.program_materials add constraint program_materials_title_check CHECK (((char_length(title) >= 1) AND (char_length(title) <= 200)));
alter table public.program_proposals add constraint program_proposal_data_valid CHECK (private.program_valid(data));
alter table public.program_proposals add constraint program_proposals_check CHECK ((((target_id IS NULL) AND (expected_revision = 0)) OR ((target_id IS NOT NULL) AND (expected_revision > 0))));
alter table public.program_proposals add constraint program_proposals_digest_check CHECK ((digest ~ '^[a-f0-9]{64}$'::text));
alter table public.program_proposals add constraint program_proposals_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'applied'::text, 'dismissed'::text])));
alter table public.programs add constraint program_data_valid CHECK (private.program_valid(data));
alter table public.programs add constraint programs_origin_check CHECK ((origin = ANY (ARRAY['manual'::text, 'ai'::text])));
alter table public.programs add constraint programs_revision_check CHECK ((revision > 0));
alter table public.recordings add constraint recordings_source_check CHECK ((source ~ '^[a-z0-9-]{2,30}$'::text));
alter table public.recordings add constraint recordings_status_check CHECK ((status = ANY (ARRAY['ready'::text, 'no_transcript'::text, 'error'::text])));
alter table public.recurring_tasks add constraint recurring_tasks_check CHECK ((((kind = 'agent'::text) AND (agent_id IS NOT NULL)) OR ((kind = 'ideation'::text) AND (agent_id IS NULL) AND (output = 'ideas'::text))));
alter table public.recurring_tasks add constraint recurring_tasks_deliverable_check CHECK (((length(deliverable) >= 1) AND (length(deliverable) <= 2000)));
alter table public.recurring_tasks add constraint recurring_tasks_idea_count_check CHECK (((idea_count >= 1) AND (idea_count <= 10)));
alter table public.recurring_tasks add constraint recurring_tasks_kind_check CHECK ((kind = ANY (ARRAY['agent'::text, 'ideation'::text])));
alter table public.recurring_tasks add constraint recurring_tasks_name_check CHECK (((length(name) >= 1) AND (length(name) <= 140)));
alter table public.recurring_tasks add constraint recurring_tasks_output_check CHECK ((output = ANY (ARRAY['brief'::text, 'ideas'::text])));
alter table public.research_runs add constraint research_runs_status_check CHECK ((status = ANY (ARRAY['starting'::text, 'running'::text, 'succeeded'::text, 'failed'::text, 'aborted'::text, 'timed_out'::text])));
alter table public.swipe_items add constraint swipe_items_kind_check CHECK ((kind = ANY (ARRAY['funnel'::text, 'offer'::text, 'page'::text, 'ad'::text, 'email'::text, 'other'::text])));
alter table public.team_agent_settings add constraint team_agent_settings_agent_id_check CHECK ((agent_id ~ '^[a-z]{2,24}$'::text));
alter table public.team_agent_settings add constraint team_agent_settings_context_check CHECK ((char_length(context) <= 20000));
alter table public.team_agent_settings add constraint team_agent_settings_instructions_check CHECK ((char_length(instructions) <= 8000));
alter table public.tella_approvals add constraint tella_approvals_kind_check CHECK ((kind = ANY (ARRAY['storyboard'::text, 'final'::text, 'publish'::text])));
alter table public.tella_edits add constraint tella_edits_tella_video_id_check CHECK ((tella_video_id ~ '^[A-Za-z0-9_-]{4,80}$'::text));
alter table public.user_access add constraint user_access_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'approved'::text, 'denied'::text])));
alter table public.vault_notes add constraint vault_notes_body_check CHECK (((char_length(body) >= 20) AND (char_length(body) <= 24000)));
alter table public.vault_notes add constraint vault_notes_context_check CHECK ((char_length(context) <= 5000));
alter table public.vault_notes add constraint vault_notes_purpose_check CHECK ((purpose = ANY (ARRAY['general'::text, 'offers'::text, 'copy'::text, 'funnels'::text, 'emails'::text])));
alter table public.vault_notes add constraint vault_notes_sources_check CHECK (((jsonb_typeof(sources) = 'array'::text) AND ((jsonb_array_length(sources) >= 1) AND (jsonb_array_length(sources) <= 12))));
alter table public.vault_notes add constraint vault_notes_title_check CHECK (((char_length(title) >= 1) AND (char_length(title) <= 160)));
alter table public.workspace_connections add constraint workspace_connections_provider_check CHECK ((provider ~ '^[a-z0-9-]{2,30}$'::text));
alter table public.workspace_connections add constraint workspace_connections_status_check CHECK ((status = ANY (ARRAY['not_connected'::text, 'pending'::text, 'connected'::text, 'error'::text])));
alter table public.workspace_members add constraint workspace_members_role_check CHECK ((role = ANY (ARRAY['owner'::text, 'admin'::text, 'member'::text])));
alter table public.workspaces add constraint workspaces_kind_check CHECK ((kind = ANY (ARRAY['live'::text, 'demo'::text])));
alter table public.workspaces add constraint workspaces_name_check CHECK (((char_length(name) >= 1) AND (char_length(name) <= 80)));
alter table public.workspaces add constraint workspaces_plan_check CHECK ((plan = ANY (ARRAY['trial'::text, 'founder'::text, 'pro'::text])));
alter table public.writing_samples add constraint writing_samples_body_check CHECK (((char_length(body) >= 40) AND (char_length(body) <= 60000)));
alter table public.writing_samples add constraint writing_samples_kind_check CHECK ((kind = ANY (ARRAY['email'::text, 'post'::text, 'script'::text, 'caption'::text, 'page'::text, 'newsletter'::text, 'message'::text, 'other'::text])));
alter table public.writing_samples add constraint writing_samples_title_check CHECK (((char_length(title) >= 1) AND (char_length(title) <= 200)));
alter table private.affiliate_hooks add constraint affiliate_hooks_workspace_id_fkey FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE;
alter table private.custom_connection_secrets add constraint custom_connection_secrets_connection_id_fkey FOREIGN KEY (connection_id) REFERENCES custom_connections(id) ON DELETE CASCADE;
alter table private.funnel_assets add constraint funnel_assets_build_id_fkey FOREIGN KEY (build_id) REFERENCES funnel_builds(id) ON DELETE CASCADE;
alter table private.graphic_assets add constraint graphic_assets_workspace_id_fkey FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE;
alter table private.inbox_secrets add constraint inbox_secrets_account_id_fkey FOREIGN KEY (account_id) REFERENCES inbox_accounts(id) ON DELETE CASCADE;
alter table private.recurring_leases add constraint recurring_leases_run_id_fkey FOREIGN KEY (run_id) REFERENCES agent_runs(id) ON DELETE CASCADE;
alter table private.workspace_secrets add constraint workspace_secrets_workspace_id_fkey FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE;
alter table public.affiliate_events add constraint affiliate_events_workspace_id_fkey FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE;
alter table public.agent_proposals add constraint agent_proposals_workspace_id_fkey FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE;
alter table public.agent_runs add constraint agent_runs_workspace_id_agent_id_fkey FOREIGN KEY (workspace_id, agent_id) REFERENCES founder_agents(workspace_id, id);
alter table public.agent_runs add constraint agent_runs_workspace_id_fkey FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE;
alter table public.agent_runs add constraint agent_runs_workspace_id_task_id_fkey FOREIGN KEY (workspace_id, task_id) REFERENCES recurring_tasks(workspace_id, id);
alter table public.brain_chunks add constraint brain_chunks_doc_id_fkey FOREIGN KEY (doc_id) REFERENCES brain_docs(id) ON DELETE CASCADE;
alter table public.brain_chunks add constraint brain_chunks_workspace_id_fkey FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE;
alter table public.brain_docs add constraint brain_docs_workspace_id_fkey FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE;
alter table public.brain_facts add constraint brain_facts_workspace_id_fkey FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE;
alter table public.brain_profile add constraint brain_profile_workspace_id_fkey FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE;
alter table public.brand_dna add constraint brand_dna_workspace_id_fkey FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE;
alter table public.chat_messages add constraint chat_messages_thread_id_fkey FOREIGN KEY (thread_id) REFERENCES chat_threads(id) ON DELETE CASCADE;
alter table public.chat_messages add constraint chat_messages_workspace_id_fkey FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE;
alter table public.chat_messages add constraint chat_program_proposal_workspace FOREIGN KEY (workspace_id, program_proposal) REFERENCES program_proposals(workspace_id, id);
alter table public.chat_threads add constraint chat_threads_workspace_id_fkey FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE;
alter table public.coach_chunks add constraint coach_chunks_source_id_fkey FOREIGN KEY (source_id) REFERENCES coach_sources(id) ON DELETE CASCADE;
alter table public.coach_playbook add constraint coach_playbook_workspace_id_fkey FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE;
alter table public.coach_sources add constraint coach_sources_workspace_id_fkey FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE;
alter table public.content_funnel add constraint content_funnel_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL;
alter table public.content_funnel add constraint content_funnel_leads_to_fk FOREIGN KEY (workspace_id, leads_to) REFERENCES founder_strategy(workspace_id, id) ON DELETE SET NULL (leads_to);
alter table public.content_funnel add constraint content_funnel_strategy_fk FOREIGN KEY (workspace_id, strategy_id) REFERENCES founder_strategy(workspace_id, id) ON DELETE CASCADE;
alter table public.content_funnel add constraint content_funnel_workspace_id_fkey FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE;
alter table public.content_items add constraint content_items_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL;
alter table public.content_items add constraint content_items_workspace_id_fkey FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE;
alter table public.content_learning_config add constraint content_learning_config_workspace_id_fkey FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE;
alter table public.content_learning_events add constraint content_learning_events_content_id_fkey FOREIGN KEY (content_id) REFERENCES content_items(id) ON DELETE SET NULL;
alter table public.content_learning_events add constraint content_learning_events_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL;
alter table public.content_learning_events add constraint content_learning_events_workspace_id_fkey FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE;
alter table public.content_learning_metrics add constraint content_learning_metrics_content_id_fkey FOREIGN KEY (content_id) REFERENCES content_items(id) ON DELETE SET NULL;
alter table public.content_learning_metrics add constraint content_learning_metrics_workspace_id_fkey FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE;
alter table public.creator_posts add constraint creator_posts_creator_id_fkey FOREIGN KEY (creator_id) REFERENCES creators(id) ON DELETE CASCADE;
alter table public.creator_posts add constraint creator_posts_workspace_id_fkey FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE;
alter table public.creators add constraint creators_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL;
alter table public.creators add constraint creators_workspace_id_fkey FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE;
alter table public.custom_connection_runs add constraint custom_connection_runs_connection_id_fkey FOREIGN KEY (connection_id) REFERENCES custom_connections(id) ON DELETE CASCADE;
alter table public.custom_connection_runs add constraint custom_connection_runs_workspace_id_fkey FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE;
alter table public.custom_connections add constraint custom_connections_workspace_id_fkey FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE;
alter table public.dna_items add constraint dna_items_workspace_id_fkey FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE;
alter table public.email_sets add constraint email_sets_workspace_id_fkey FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE;
alter table public.founder_agents add constraint founder_agents_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL;
alter table public.founder_agents add constraint founder_agents_workspace_id_fkey FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE;
alter table public.founder_strategy add constraint founder_strategy_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL;
alter table public.founder_strategy add constraint founder_strategy_inventory_id_fkey FOREIGN KEY (inventory_id) REFERENCES dna_items(id) ON DELETE SET NULL;
alter table public.founder_strategy add constraint founder_strategy_workspace_id_fkey FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE;
alter table public.founder_strategy add constraint founder_strategy_workspace_id_linked_offer_id_fkey FOREIGN KEY (workspace_id, linked_offer_id) REFERENCES founder_strategy(workspace_id, id);
alter table public.funnel_builds add constraint funnel_builds_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL;
alter table public.funnel_builds add constraint funnel_builds_workspace_id_fkey FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE;
alter table public.graphic_kits add constraint graphic_kits_workspace_id_fkey FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE;
alter table public.graphic_sets add constraint graphic_sets_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL;
alter table public.graphic_sets add constraint graphic_sets_workspace_id_fkey FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE;
alter table public.grok_tasks add constraint grok_tasks_workspace_id_fkey FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE;
alter table public.inbox_accounts add constraint inbox_accounts_workspace_id_fkey FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE;
alter table public.inbox_messages add constraint inbox_messages_thread_id_fkey FOREIGN KEY (thread_id) REFERENCES inbox_threads(id) ON DELETE CASCADE;
alter table public.inbox_messages add constraint inbox_messages_workspace_id_fkey FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE;
alter table public.inbox_people add constraint inbox_people_stage_id_fkey FOREIGN KEY (stage_id) REFERENCES inbox_stages(id) ON DELETE SET NULL;
alter table public.inbox_people add constraint inbox_people_workspace_id_fkey FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE;
alter table public.inbox_stages add constraint inbox_stages_workspace_id_fkey FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE;
alter table public.inbox_threads add constraint inbox_threads_account_id_fkey FOREIGN KEY (account_id) REFERENCES inbox_accounts(id) ON DELETE CASCADE;
alter table public.inbox_threads add constraint inbox_threads_person_id_fkey FOREIGN KEY (person_id) REFERENCES inbox_people(id) ON DELETE SET NULL;
alter table public.inbox_threads add constraint inbox_threads_workspace_id_fkey FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE;
alter table public.mcp_changes add constraint mcp_changes_workspace_id_fkey FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE;
alter table public.mcp_tokens add constraint mcp_tokens_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
alter table public.mcp_tokens add constraint mcp_tokens_workspace_id_fkey FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE;
alter table public.memory_items add constraint memory_items_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL;
alter table public.memory_items add constraint memory_items_workspace_id_fkey FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE;
alter table public.morning_briefs add constraint morning_briefs_workspace_id_fkey FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE;
alter table public.morning_suggestions add constraint morning_suggestions_brief_id_fkey FOREIGN KEY (brief_id) REFERENCES morning_briefs(id) ON DELETE CASCADE;
alter table public.morning_suggestions add constraint morning_suggestions_content_id_fkey FOREIGN KEY (content_id) REFERENCES content_items(id) ON DELETE SET NULL;
alter table public.morning_suggestions add constraint morning_suggestions_workspace_id_fkey FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE;
alter table public.os_drafts add constraint os_drafts_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL;
alter table public.os_drafts add constraint os_drafts_workspace_id_fkey FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE;
alter table public.profiles add constraint profiles_current_workspace_fkey FOREIGN KEY (current_workspace) REFERENCES workspaces(id) ON DELETE SET NULL;
alter table public.profiles add constraint profiles_id_fkey FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE;
alter table public.program_materials add constraint program_materials_workspace_id_fkey FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE;
alter table public.program_materials add constraint program_materials_workspace_id_program_id_fkey FOREIGN KEY (workspace_id, program_id) REFERENCES programs(workspace_id, id);
alter table public.program_proposals add constraint program_proposals_workspace_id_fkey FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE;
alter table public.program_proposals add constraint program_proposals_workspace_id_result_id_fkey FOREIGN KEY (workspace_id, result_id) REFERENCES programs(workspace_id, id);
alter table public.program_proposals add constraint program_proposals_workspace_id_target_id_fkey FOREIGN KEY (workspace_id, target_id) REFERENCES programs(workspace_id, id);
alter table public.program_versions add constraint program_versions_program_id_fkey FOREIGN KEY (program_id) REFERENCES programs(id) ON DELETE CASCADE;
alter table public.program_versions add constraint program_versions_workspace_id_fkey FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE;
alter table public.programs add constraint programs_workspace_id_fkey FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE;
alter table public.recording_chunks add constraint recording_chunks_recording_id_fkey FOREIGN KEY (recording_id) REFERENCES recordings(id) ON DELETE CASCADE;
alter table public.recording_chunks add constraint recording_chunks_workspace_id_fkey FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE;
alter table public.recordings add constraint recordings_workspace_id_fkey FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE;
alter table public.recurring_tasks add constraint recurring_tasks_workspace_id_agent_id_fkey FOREIGN KEY (workspace_id, agent_id) REFERENCES founder_agents(workspace_id, id);
alter table public.recurring_tasks add constraint recurring_tasks_workspace_id_fkey FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE;
alter table public.research_runs add constraint research_runs_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL;
alter table public.research_runs add constraint research_runs_creator_id_fkey FOREIGN KEY (creator_id) REFERENCES creators(id) ON DELETE SET NULL;
alter table public.research_runs add constraint research_runs_workspace_id_fkey FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE;
alter table public.swipe_items add constraint swipe_items_workspace_id_fkey FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE;
alter table public.team_agent_settings add constraint team_agent_settings_workspace_id_fkey FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE;
alter table public.tella_approvals add constraint tella_approvals_approved_by_fkey FOREIGN KEY (approved_by) REFERENCES auth.users(id) ON DELETE SET NULL;
alter table public.tella_approvals add constraint tella_approvals_workspace_id_edit_id_fkey FOREIGN KEY (workspace_id, edit_id) REFERENCES tella_edits(workspace_id, id) ON DELETE CASCADE;
alter table public.tella_edits add constraint tella_edits_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL;
alter table public.tella_edits add constraint tella_edits_workspace_id_fkey FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE;
alter table public.user_access add constraint user_access_decided_by_fkey FOREIGN KEY (decided_by) REFERENCES auth.users(id) ON DELETE SET NULL;
alter table public.user_access add constraint user_access_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
alter table public.vault_notes add constraint vault_notes_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL;
alter table public.vault_notes add constraint vault_notes_workspace_id_fkey FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE;
alter table public.video_approvals add constraint video_approvals_approved_by_fkey FOREIGN KEY (approved_by) REFERENCES auth.users(id) ON DELETE SET NULL;
alter table public.video_approvals add constraint video_approvals_workspace_id_project_id_fkey FOREIGN KEY (workspace_id, project_id) REFERENCES video_projects(workspace_id, id) ON DELETE CASCADE;
alter table public.video_exports add constraint video_exports_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL;
alter table public.video_exports add constraint video_exports_workspace_id_approval_id_fkey FOREIGN KEY (workspace_id, approval_id) REFERENCES video_approvals(workspace_id, id);
alter table public.video_exports add constraint video_exports_workspace_id_project_id_fkey FOREIGN KEY (workspace_id, project_id) REFERENCES video_projects(workspace_id, id) ON DELETE CASCADE;
alter table public.video_projects add constraint video_projects_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL;
alter table public.video_projects add constraint video_projects_workspace_id_fkey FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE;
alter table public.workspace_connections add constraint workspace_connections_workspace_id_fkey FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE;
alter table public.workspace_members add constraint workspace_members_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
alter table public.workspace_members add constraint workspace_members_workspace_id_fkey FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE;
alter table public.workspaces add constraint workspaces_owner_id_fkey FOREIGN KEY (owner_id) REFERENCES auth.users(id) ON DELETE CASCADE;
alter table public.writing_samples add constraint writing_samples_workspace_id_fkey FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE;
alter table public.writing_style add constraint writing_style_workspace_id_fkey FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS os_drafts_user ON public.os_drafts USING btree (created_by);
CREATE INDEX IF NOT EXISTS video_projects_workspace ON public.video_projects USING btree (workspace_id, updated_at DESC);
CREATE INDEX IF NOT EXISTS recurring_due ON public.recurring_tasks USING btree (next_run_at) WHERE (enabled AND (NOT archived));
CREATE INDEX IF NOT EXISTS agent_runs_history ON public.agent_runs USING btree (workspace_id, created_at DESC);
CREATE INDEX IF NOT EXISTS chat_threads_ws ON public.chat_threads USING btree (workspace_id, updated_at DESC);
CREATE INDEX IF NOT EXISTS content_funnel_leads_to ON public.content_funnel USING btree (workspace_id, leads_to) WHERE (leads_to IS NOT NULL);
CREATE INDEX IF NOT EXISTS workspace_members_user_idx ON public.workspace_members USING btree (user_id);
CREATE INDEX IF NOT EXISTS mcp_tokens_ws ON public.mcp_tokens USING btree (workspace_id);
CREATE INDEX IF NOT EXISTS vault_notes_search ON public.vault_notes USING gin (search_text);
CREATE INDEX IF NOT EXISTS writing_samples_ws ON public.writing_samples USING btree (workspace_id, created_at DESC);
CREATE UNIQUE INDEX agent_scheduled_slot ON public.agent_runs USING btree (task_id, scheduled_for) WHERE (trigger = 'schedule'::text);
CREATE INDEX IF NOT EXISTS workspaces_owner_idx ON public.workspaces USING btree (owner_id);
CREATE INDEX IF NOT EXISTS morning_suggestions_day ON public.morning_suggestions USING btree (workspace_id, brief_id, revision);
CREATE INDEX IF NOT EXISTS inbox_people_workspace_id_stage_id_idx ON public.inbox_people USING btree (workspace_id, stage_id);
CREATE INDEX IF NOT EXISTS program_materials_workspace ON public.program_materials USING btree (workspace_id, updated_at DESC);
CREATE INDEX IF NOT EXISTS content_learning_events_subject ON public.content_learning_events USING btree (workspace_id, subject_key);
CREATE INDEX IF NOT EXISTS recording_chunks_ws ON public.recording_chunks USING btree (workspace_id);
CREATE INDEX IF NOT EXISTS custom_connection_runs_workspace ON public.custom_connection_runs USING btree (workspace_id, started_at DESC);
CREATE INDEX IF NOT EXISTS recordings_ws ON public.recordings USING btree (workspace_id, started_at DESC);
CREATE INDEX IF NOT EXISTS graphic_sets_ws ON public.graphic_sets USING btree (workspace_id, created_at DESC);
CREATE INDEX IF NOT EXISTS research_runs_ws_idx ON public.research_runs USING btree (workspace_id, created_at DESC);
CREATE INDEX IF NOT EXISTS morning_suggestions_content ON public.morning_suggestions USING btree (content_id) WHERE (content_id IS NOT NULL);
CREATE INDEX IF NOT EXISTS chat_messages_thread ON public.chat_messages USING btree (thread_id, id);
CREATE INDEX IF NOT EXISTS brain_chunks_tsv ON public.brain_chunks USING gin (tsv);
CREATE INDEX IF NOT EXISTS content_funnel_created_by ON public.content_funnel USING btree (created_by);
CREATE INDEX IF NOT EXISTS affiliate_events_ws_time ON public.affiliate_events USING btree (workspace_id, created_at DESC);
CREATE INDEX IF NOT EXISTS inbox_stages_workspace_id_position_idx ON public.inbox_stages USING btree (workspace_id, "position");
CREATE INDEX IF NOT EXISTS recording_chunks_rec ON public.recording_chunks USING btree (recording_id, idx);
CREATE INDEX IF NOT EXISTS strategy_workspace ON public.founder_strategy USING btree (workspace_id, kind, lifecycle);
CREATE INDEX IF NOT EXISTS tella_edits_workspace ON public.tella_edits USING btree (workspace_id, updated_at DESC);
CREATE UNIQUE INDEX brain_facts_uniq ON public.brain_facts USING btree (workspace_id, lower(regexp_replace(statement, '[^a-zA-Z0-9]+'::text, ''::text, 'g'::text)));
CREATE INDEX IF NOT EXISTS dna_items_ws ON public.dna_items USING btree (workspace_id, kind, included);
CREATE INDEX IF NOT EXISTS inbox_threads_workspace_id_last_at_idx ON public.inbox_threads USING btree (workspace_id, last_at DESC);
CREATE INDEX IF NOT EXISTS creators_ws ON public.creators USING btree (workspace_id);
CREATE INDEX IF NOT EXISTS program_proposals_workspace ON public.program_proposals USING btree (workspace_id, created_at DESC);
CREATE INDEX IF NOT EXISTS programs_workspace ON public.programs USING btree (workspace_id, updated_at DESC);
CREATE UNIQUE INDEX content_funnel_strategy_one ON public.content_funnel USING btree (workspace_id, strategy_id) WHERE (strategy_id IS NOT NULL);
CREATE INDEX IF NOT EXISTS chat_threads_ws_agent_idx ON public.chat_threads USING btree (workspace_id, agent, updated_at DESC);
CREATE UNIQUE INDEX recurring_ideation_format_platform ON public.recurring_tasks USING btree (workspace_id, format, platform) WHERE ((kind = 'ideation'::text) AND (NOT archived));
CREATE INDEX IF NOT EXISTS swipe_items_ws ON public.swipe_items USING btree (workspace_id, created_at DESC);
CREATE INDEX IF NOT EXISTS coach_playbook_tsv ON public.coach_playbook USING gin (tsv);
CREATE INDEX IF NOT EXISTS content_funnel_ws ON public.content_funnel USING btree (workspace_id, kind, "position");
CREATE INDEX IF NOT EXISTS coach_chunks_source ON public.coach_chunks USING btree (source_id, idx);
CREATE INDEX IF NOT EXISTS creator_posts_creator ON public.creator_posts USING btree (creator_id);
CREATE INDEX IF NOT EXISTS mcp_changes_ws_at ON public.mcp_changes USING btree (workspace_id, at DESC);
CREATE INDEX IF NOT EXISTS vault_notes_workspace ON public.vault_notes USING btree (workspace_id, archived, updated_at DESC);
CREATE INDEX IF NOT EXISTS creator_posts_ws ON public.creator_posts USING btree (workspace_id, platform, views DESC NULLS LAST);
CREATE INDEX IF NOT EXISTS os_drafts_ws ON public.os_drafts USING btree (workspace_id, status);
CREATE INDEX IF NOT EXISTS brain_facts_ws ON public.brain_facts USING btree (workspace_id, status, category);
CREATE INDEX IF NOT EXISTS coach_playbook_ws ON public.coach_playbook USING btree (workspace_id, "position");
CREATE INDEX IF NOT EXISTS content_learning_events_recent ON public.content_learning_events USING btree (workspace_id, created_at DESC, sequence DESC);
CREATE INDEX IF NOT EXISTS inbox_messages_thread_id_sent_at_idx ON public.inbox_messages USING btree (thread_id, sent_at);
CREATE INDEX IF NOT EXISTS graphic_assets_set ON private.graphic_assets USING btree (set_id);
CREATE INDEX IF NOT EXISTS brain_chunks_ws ON public.brain_chunks USING btree (workspace_id);
CREATE INDEX IF NOT EXISTS recording_chunks_tsv ON public.recording_chunks USING gin (tsv);
CREATE INDEX IF NOT EXISTS funnel_builds_ws ON public.funnel_builds USING btree (workspace_id, created_at DESC);
CREATE INDEX IF NOT EXISTS email_sets_ws ON public.email_sets USING btree (workspace_id, created_at DESC);
CREATE INDEX IF NOT EXISTS brain_docs_ws ON public.brain_docs USING btree (workspace_id, created_at DESC);
CREATE INDEX IF NOT EXISTS custom_connections_workspace ON public.custom_connections USING btree (workspace_id);
CREATE INDEX IF NOT EXISTS coach_chunks_tsv ON public.coach_chunks USING gin (tsv);
CREATE UNIQUE INDEX strategy_one_inventory ON public.founder_strategy USING btree (workspace_id, inventory_id) WHERE (inventory_id IS NOT NULL);
CREATE INDEX IF NOT EXISTS memory_items_ws_idx ON public.memory_items USING btree (workspace_id, kind, created_at DESC);
CREATE INDEX IF NOT EXISTS content_learning_metrics_recent ON public.content_learning_metrics USING btree (workspace_id, observed_at DESC);
CREATE INDEX IF NOT EXISTS mcp_tokens_user ON public.mcp_tokens USING btree (user_id);
CREATE INDEX IF NOT EXISTS content_items_ws ON public.content_items USING btree (workspace_id, stage);
CREATE INDEX IF NOT EXISTS brain_chunks_doc ON public.brain_chunks USING btree (doc_id, idx);
CREATE INDEX IF NOT EXISTS grok_tasks_ws_idx ON public.grok_tasks USING btree (workspace_id, created_at DESC);

CREATE TRIGGER dna_del AFTER DELETE ON public.brain_facts REFERENCING OLD TABLE AS ot FOR EACH STATEMENT EXECUTE FUNCTION private.dna_touch_old();
CREATE TRIGGER dna_ins AFTER INSERT ON public.brain_facts REFERENCING NEW TABLE AS nt FOR EACH STATEMENT EXECUTE FUNCTION private.dna_touch_new();
CREATE TRIGGER dna_upd AFTER UPDATE ON public.brain_facts REFERENCING NEW TABLE AS nt FOR EACH STATEMENT EXECUTE FUNCTION private.dna_touch_new();
CREATE TRIGGER dna_del AFTER DELETE ON public.brain_profile REFERENCING OLD TABLE AS ot FOR EACH STATEMENT EXECUTE FUNCTION private.dna_touch_old();
CREATE TRIGGER dna_ins AFTER INSERT ON public.brain_profile REFERENCING NEW TABLE AS nt FOR EACH STATEMENT EXECUTE FUNCTION private.dna_touch_new();
CREATE TRIGGER dna_upd AFTER UPDATE ON public.brain_profile REFERENCING NEW TABLE AS nt FOR EACH STATEMENT EXECUTE FUNCTION private.dna_touch_new();
CREATE TRIGGER content_learning_capture AFTER INSERT OR UPDATE ON public.content_items FOR EACH ROW EXECUTE FUNCTION private.content_learning_capture();
CREATE TRIGGER dna_del AFTER DELETE ON public.creator_posts REFERENCING OLD TABLE AS ot FOR EACH STATEMENT EXECUTE FUNCTION private.dna_touch_old();
CREATE TRIGGER dna_ins AFTER INSERT ON public.creator_posts REFERENCING NEW TABLE AS nt FOR EACH STATEMENT EXECUTE FUNCTION private.dna_touch_new();
CREATE TRIGGER dna_upd AFTER UPDATE ON public.creator_posts REFERENCING NEW TABLE AS nt FOR EACH STATEMENT EXECUTE FUNCTION private.dna_touch_new();
CREATE TRIGGER dna_del AFTER DELETE ON public.creators REFERENCING OLD TABLE AS ot FOR EACH STATEMENT EXECUTE FUNCTION private.dna_touch_old();
CREATE TRIGGER dna_ins AFTER INSERT ON public.creators REFERENCING NEW TABLE AS nt FOR EACH STATEMENT EXECUTE FUNCTION private.dna_touch_new();
CREATE TRIGGER dna_upd AFTER UPDATE ON public.creators REFERENCING NEW TABLE AS nt FOR EACH STATEMENT EXECUTE FUNCTION private.dna_touch_new();
CREATE TRIGGER dna_del AFTER DELETE ON public.dna_items REFERENCING OLD TABLE AS ot FOR EACH STATEMENT EXECUTE FUNCTION private.dna_touch_old();
CREATE TRIGGER dna_ins AFTER INSERT ON public.dna_items REFERENCING NEW TABLE AS nt FOR EACH STATEMENT EXECUTE FUNCTION private.dna_touch_new();
CREATE TRIGGER dna_upd AFTER UPDATE ON public.dna_items REFERENCING NEW TABLE AS nt FOR EACH STATEMENT EXECUTE FUNCTION private.dna_touch_new();
CREATE TRIGGER graphic_sets_gone AFTER DELETE ON public.graphic_sets FOR EACH ROW EXECUTE FUNCTION private.graphic_sets_gone();
CREATE TRIGGER morning_learning_capture AFTER UPDATE ON public.morning_suggestions FOR EACH ROW EXECUTE FUNCTION private.content_learning_capture();
CREATE TRIGGER queue_new_draft AFTER INSERT ON public.os_drafts FOR EACH ROW EXECUTE FUNCTION private.queue_legacy_draft();
CREATE TRIGGER profiles_current_ws BEFORE UPDATE OF current_workspace ON public.profiles FOR EACH ROW EXECUTE FUNCTION private.check_current_ws();
CREATE TRIGGER profiles_touch BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION touch_updated_at();
CREATE TRIGGER dna_del AFTER DELETE ON public.research_runs REFERENCING OLD TABLE AS ot FOR EACH STATEMENT EXECUTE FUNCTION private.dna_touch_old();
CREATE TRIGGER dna_ins AFTER INSERT ON public.research_runs REFERENCING NEW TABLE AS nt FOR EACH STATEMENT EXECUTE FUNCTION private.dna_touch_new();
CREATE TRIGGER dna_upd AFTER UPDATE ON public.research_runs REFERENCING NEW TABLE AS nt FOR EACH STATEMENT EXECUTE FUNCTION private.dna_touch_new();
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION handle_new_user();
CREATE TRIGGER dna_del AFTER DELETE ON public.writing_samples REFERENCING OLD TABLE AS ot FOR EACH STATEMENT EXECUTE FUNCTION private.dna_touch_old();
CREATE TRIGGER dna_ins AFTER INSERT ON public.writing_samples REFERENCING NEW TABLE AS nt FOR EACH STATEMENT EXECUTE FUNCTION private.dna_touch_new();
CREATE TRIGGER dna_upd AFTER UPDATE ON public.writing_samples REFERENCING NEW TABLE AS nt FOR EACH STATEMENT EXECUTE FUNCTION private.dna_touch_new();
CREATE TRIGGER dna_del AFTER DELETE ON public.writing_style REFERENCING OLD TABLE AS ot FOR EACH STATEMENT EXECUTE FUNCTION private.dna_touch_old();
CREATE TRIGGER dna_ins AFTER INSERT ON public.writing_style REFERENCING NEW TABLE AS nt FOR EACH STATEMENT EXECUTE FUNCTION private.dna_touch_new();
CREATE TRIGGER dna_upd AFTER UPDATE ON public.writing_style REFERENCING NEW TABLE AS nt FOR EACH STATEMENT EXECUTE FUNCTION private.dna_touch_new();

alter table public.workspace_members enable row level security;
alter table public.workspaces enable row level security;
alter table public.brain_chunks enable row level security;
alter table public.brain_profile enable row level security;
alter table public.profiles enable row level security;
alter table public.brain_docs enable row level security;
alter table public.workspace_connections enable row level security;
alter table public.mcp_tokens enable row level security;
alter table public.os_drafts enable row level security;
alter table public.memory_items enable row level security;
alter table public.research_runs enable row level security;
alter table public.inbox_accounts enable row level security;
alter table public.inbox_stages enable row level security;
alter table public.inbox_people enable row level security;
alter table public.inbox_threads enable row level security;
alter table public.inbox_messages enable row level security;
alter table public.user_access enable row level security;
alter table public.brain_facts enable row level security;
alter table public.dna_items enable row level security;
alter table public.brand_dna enable row level security;
alter table public.video_projects enable row level security;
alter table public.video_approvals enable row level security;
alter table public.recording_chunks enable row level security;
alter table public.content_items enable row level security;
alter table public.writing_samples enable row level security;
alter table public.writing_style enable row level security;
alter table public.recordings enable row level security;
alter table public.chat_threads enable row level security;
alter table public.affiliate_events enable row level security;
alter table public.swipe_items enable row level security;
alter table public.creators enable row level security;
alter table public.creator_posts enable row level security;
alter table public.graphic_sets enable row level security;
alter table public.email_sets enable row level security;
alter table public.graphic_kits enable row level security;
alter table public.morning_briefs enable row level security;
alter table public.morning_suggestions enable row level security;
alter table public.content_learning_config enable row level security;
alter table public.content_learning_events enable row level security;
alter table public.content_learning_metrics enable row level security;
alter table public.vault_notes enable row level security;
alter table public.program_versions enable row level security;
alter table public.programs enable row level security;
alter table public.program_proposals enable row level security;
alter table public.program_materials enable row level security;
alter table public.custom_connections enable row level security;
alter table public.custom_connection_runs enable row level security;
alter table public.founder_strategy enable row level security;
alter table public.chat_messages enable row level security;
alter table public.founder_agents enable row level security;
alter table public.recurring_tasks enable row level security;
alter table public.agent_runs enable row level security;
alter table public.agent_proposals enable row level security;
alter table public.video_exports enable row level security;
alter table public.coach_playbook enable row level security;
alter table public.coach_sources enable row level security;
alter table public.coach_chunks enable row level security;
alter table public.coach_usage enable row level security;
alter table public.tella_edits enable row level security;
alter table public.tella_approvals enable row level security;
alter table public.funnel_builds enable row level security;
alter table public.grok_tasks enable row level security;
alter table public.team_agent_settings enable row level security;
alter table public.mcp_changes enable row level security;
alter table public.content_funnel enable row level security;

create policy affiliate_events_read on public.affiliate_events as PERMISSIVE for SELECT to public using (private.is_member(workspace_id));
create policy member_read on public.agent_proposals as PERMISSIVE for SELECT to authenticated using (private.is_member(workspace_id));
create policy member_read on public.agent_runs as PERMISSIVE for SELECT to authenticated using (private.is_member(workspace_id));
create policy "members add brain_chunks" on public.brain_chunks as PERMISSIVE for INSERT to authenticated with check (( SELECT private.is_member(brain_chunks.workspace_id) AS is_member));
create policy "members change brain_chunks" on public.brain_chunks as PERMISSIVE for UPDATE to authenticated using (( SELECT private.is_member(brain_chunks.workspace_id) AS is_member)) with check (( SELECT private.is_member(brain_chunks.workspace_id) AS is_member));
create policy "members delete brain_chunks" on public.brain_chunks as PERMISSIVE for DELETE to authenticated using (( SELECT private.is_member(brain_chunks.workspace_id) AS is_member));
create policy "members read brain_chunks" on public.brain_chunks as PERMISSIVE for SELECT to authenticated using (( SELECT private.is_member(brain_chunks.workspace_id) AS is_member));
create policy "members add brain_docs" on public.brain_docs as PERMISSIVE for INSERT to authenticated with check (( SELECT private.is_member(brain_docs.workspace_id) AS is_member));
create policy "members change brain_docs" on public.brain_docs as PERMISSIVE for UPDATE to authenticated using (( SELECT private.is_member(brain_docs.workspace_id) AS is_member)) with check (( SELECT private.is_member(brain_docs.workspace_id) AS is_member));
create policy "members delete brain_docs" on public.brain_docs as PERMISSIVE for DELETE to authenticated using (( SELECT private.is_member(brain_docs.workspace_id) AS is_member));
create policy "members read brain_docs" on public.brain_docs as PERMISSIVE for SELECT to authenticated using (( SELECT private.is_member(brain_docs.workspace_id) AS is_member));
create policy "members add brain_facts" on public.brain_facts as PERMISSIVE for INSERT to authenticated with check (( SELECT private.is_member(brain_facts.workspace_id) AS is_member));
create policy "members change brain_facts" on public.brain_facts as PERMISSIVE for UPDATE to authenticated using (( SELECT private.is_member(brain_facts.workspace_id) AS is_member)) with check (( SELECT private.is_member(brain_facts.workspace_id) AS is_member));
create policy "members delete brain_facts" on public.brain_facts as PERMISSIVE for DELETE to authenticated using (( SELECT private.is_member(brain_facts.workspace_id) AS is_member));
create policy "members read brain_facts" on public.brain_facts as PERMISSIVE for SELECT to authenticated using (( SELECT private.is_member(brain_facts.workspace_id) AS is_member));
create policy "members add brain_profile" on public.brain_profile as PERMISSIVE for INSERT to authenticated with check (( SELECT private.is_member(brain_profile.workspace_id) AS is_member));
create policy "members change brain_profile" on public.brain_profile as PERMISSIVE for UPDATE to authenticated using (( SELECT private.is_member(brain_profile.workspace_id) AS is_member)) with check (( SELECT private.is_member(brain_profile.workspace_id) AS is_member));
create policy "members delete brain_profile" on public.brain_profile as PERMISSIVE for DELETE to authenticated using (( SELECT private.is_member(brain_profile.workspace_id) AS is_member));
create policy "members read brain_profile" on public.brain_profile as PERMISSIVE for SELECT to authenticated using (( SELECT private.is_member(brain_profile.workspace_id) AS is_member));
create policy "members read brand_dna" on public.brand_dna as PERMISSIVE for SELECT to authenticated using (( SELECT private.is_member(brand_dna.workspace_id) AS is_member));
create policy "members add chat_messages" on public.chat_messages as PERMISSIVE for INSERT to authenticated with check (( SELECT private.is_member(chat_messages.workspace_id) AS is_member));
create policy "members change chat_messages" on public.chat_messages as PERMISSIVE for UPDATE to authenticated using (( SELECT private.is_member(chat_messages.workspace_id) AS is_member)) with check (( SELECT private.is_member(chat_messages.workspace_id) AS is_member));
create policy "members delete chat_messages" on public.chat_messages as PERMISSIVE for DELETE to authenticated using (( SELECT private.is_member(chat_messages.workspace_id) AS is_member));
create policy "members read chat_messages" on public.chat_messages as PERMISSIVE for SELECT to authenticated using (( SELECT private.is_member(chat_messages.workspace_id) AS is_member));
create policy "members add chat_threads" on public.chat_threads as PERMISSIVE for INSERT to authenticated with check (( SELECT private.is_member(chat_threads.workspace_id) AS is_member));
create policy "members change chat_threads" on public.chat_threads as PERMISSIVE for UPDATE to authenticated using (( SELECT private.is_member(chat_threads.workspace_id) AS is_member)) with check (( SELECT private.is_member(chat_threads.workspace_id) AS is_member));
create policy "members delete chat_threads" on public.chat_threads as PERMISSIVE for DELETE to authenticated using (( SELECT private.is_member(chat_threads.workspace_id) AS is_member));
create policy "members read chat_threads" on public.chat_threads as PERMISSIVE for SELECT to authenticated using (( SELECT private.is_member(chat_threads.workspace_id) AS is_member));
create policy "members add content funnel" on public.content_funnel as PERMISSIVE for INSERT to authenticated with check (( SELECT private.is_member(content_funnel.workspace_id) AS is_member));
create policy "members delete content funnel" on public.content_funnel as PERMISSIVE for DELETE to authenticated using (( SELECT private.is_member(content_funnel.workspace_id) AS is_member));
create policy "members read content funnel" on public.content_funnel as PERMISSIVE for SELECT to authenticated using (( SELECT private.is_member(content_funnel.workspace_id) AS is_member));
create policy "members update content funnel" on public.content_funnel as PERMISSIVE for UPDATE to authenticated using (( SELECT private.is_member(content_funnel.workspace_id) AS is_member)) with check (( SELECT private.is_member(content_funnel.workspace_id) AS is_member));
create policy "members add content" on public.content_items as PERMISSIVE for INSERT to authenticated with check (( SELECT private.is_member(content_items.workspace_id) AS is_member));
create policy "members delete content" on public.content_items as PERMISSIVE for DELETE to authenticated using (( SELECT private.is_member(content_items.workspace_id) AS is_member));
create policy "members read content" on public.content_items as PERMISSIVE for SELECT to authenticated using (( SELECT private.is_member(content_items.workspace_id) AS is_member));
create policy "members update content" on public.content_items as PERMISSIVE for UPDATE to authenticated using (( SELECT private.is_member(content_items.workspace_id) AS is_member)) with check (( SELECT private.is_member(content_items.workspace_id) AS is_member));
create policy member_read on public.content_learning_config as PERMISSIVE for SELECT to authenticated using (private.is_member(workspace_id));
create policy member_read on public.content_learning_events as PERMISSIVE for SELECT to authenticated using (private.is_member(workspace_id));
create policy member_read on public.content_learning_metrics as PERMISSIVE for SELECT to authenticated using (private.is_member(workspace_id));
create policy "Members add creator posts" on public.creator_posts as PERMISSIVE for INSERT to authenticated with check (private.is_member(workspace_id));
create policy "Members delete creator posts" on public.creator_posts as PERMISSIVE for DELETE to authenticated using (private.is_member(workspace_id));
create policy "Members read creator posts" on public.creator_posts as PERMISSIVE for SELECT to authenticated using (private.is_member(workspace_id));
create policy "Members update creator posts" on public.creator_posts as PERMISSIVE for UPDATE to authenticated using (private.is_member(workspace_id)) with check (private.is_member(workspace_id));
create policy "Members add creators" on public.creators as PERMISSIVE for INSERT to authenticated with check (private.is_member(workspace_id));
create policy "Members delete creators" on public.creators as PERMISSIVE for DELETE to authenticated using (private.is_member(workspace_id));
create policy "Members read creators" on public.creators as PERMISSIVE for SELECT to authenticated using (private.is_member(workspace_id));
create policy "Members update creators" on public.creators as PERMISSIVE for UPDATE to authenticated using (private.is_member(workspace_id)) with check (private.is_member(workspace_id));
create policy custom_connection_runs_read on public.custom_connection_runs as PERMISSIVE for SELECT to authenticated using (private.is_member(workspace_id));
create policy custom_connections_read on public.custom_connections as PERMISSIVE for SELECT to authenticated using (private.is_member(workspace_id));
create policy "members add dna_items" on public.dna_items as PERMISSIVE for INSERT to authenticated with check (( SELECT private.is_member(dna_items.workspace_id) AS is_member));
create policy "members change dna_items" on public.dna_items as PERMISSIVE for UPDATE to authenticated using (( SELECT private.is_member(dna_items.workspace_id) AS is_member)) with check (( SELECT private.is_member(dna_items.workspace_id) AS is_member));
create policy "members delete dna_items" on public.dna_items as PERMISSIVE for DELETE to authenticated using (( SELECT private.is_member(dna_items.workspace_id) AS is_member));
create policy "members read dna_items" on public.dna_items as PERMISSIVE for SELECT to authenticated using (( SELECT private.is_member(dna_items.workspace_id) AS is_member));
create policy "members add email_sets" on public.email_sets as PERMISSIVE for INSERT to authenticated with check (( SELECT private.is_member(email_sets.workspace_id) AS is_member));
create policy "members change email_sets" on public.email_sets as PERMISSIVE for UPDATE to authenticated using (( SELECT private.is_member(email_sets.workspace_id) AS is_member)) with check (( SELECT private.is_member(email_sets.workspace_id) AS is_member));
create policy "members delete email_sets" on public.email_sets as PERMISSIVE for DELETE to authenticated using (( SELECT private.is_member(email_sets.workspace_id) AS is_member));
create policy "members read email_sets" on public.email_sets as PERMISSIVE for SELECT to authenticated using (( SELECT private.is_member(email_sets.workspace_id) AS is_member));
create policy member_read on public.founder_agents as PERMISSIVE for SELECT to authenticated using (private.is_member(workspace_id));
create policy member_read on public.founder_strategy as PERMISSIVE for SELECT to authenticated using (private.is_member(workspace_id));
create policy "members delete funnel_builds" on public.funnel_builds as PERMISSIVE for DELETE to authenticated using (( SELECT private.is_member(funnel_builds.workspace_id) AS is_member));
create policy "members read funnel_builds" on public.funnel_builds as PERMISSIVE for SELECT to authenticated using (( SELECT private.is_member(funnel_builds.workspace_id) AS is_member));
create policy "members read graphic_kits" on public.graphic_kits as PERMISSIVE for SELECT to authenticated using (( SELECT private.is_member(graphic_kits.workspace_id) AS is_member));
create policy "members delete graphic_sets" on public.graphic_sets as PERMISSIVE for DELETE to authenticated using (( SELECT private.is_member(graphic_sets.workspace_id) AS is_member));
create policy "members read graphic_sets" on public.graphic_sets as PERMISSIVE for SELECT to authenticated using (( SELECT private.is_member(graphic_sets.workspace_id) AS is_member));
create policy grok_tasks_delete on public.grok_tasks as PERMISSIVE for DELETE to authenticated using (private.is_member(workspace_id));
create policy grok_tasks_insert on public.grok_tasks as PERMISSIVE for INSERT to authenticated with check ((private.is_member(workspace_id) AND (status = 'draft'::text)));
create policy grok_tasks_select on public.grok_tasks as PERMISSIVE for SELECT to authenticated using (private.is_member(workspace_id));
create policy grok_tasks_update on public.grok_tasks as PERMISSIVE for UPDATE to authenticated using (private.is_member(workspace_id)) with check (private.is_member(workspace_id));
create policy "inbox_accounts member delete" on public.inbox_accounts as PERMISSIVE for DELETE to authenticated using (( SELECT private.is_member(inbox_accounts.workspace_id) AS is_member));
create policy "inbox_accounts member insert" on public.inbox_accounts as PERMISSIVE for INSERT to authenticated with check (( SELECT private.is_member(inbox_accounts.workspace_id) AS is_member));
create policy "inbox_accounts member select" on public.inbox_accounts as PERMISSIVE for SELECT to authenticated using (( SELECT private.is_member(inbox_accounts.workspace_id) AS is_member));
create policy "inbox_accounts member update" on public.inbox_accounts as PERMISSIVE for UPDATE to authenticated using (( SELECT private.is_member(inbox_accounts.workspace_id) AS is_member)) with check (( SELECT private.is_member(inbox_accounts.workspace_id) AS is_member));
create policy "inbox_messages member delete" on public.inbox_messages as PERMISSIVE for DELETE to authenticated using (( SELECT private.is_member(inbox_messages.workspace_id) AS is_member));
create policy "inbox_messages member insert" on public.inbox_messages as PERMISSIVE for INSERT to authenticated with check (( SELECT private.is_member(inbox_messages.workspace_id) AS is_member));
create policy "inbox_messages member select" on public.inbox_messages as PERMISSIVE for SELECT to authenticated using (( SELECT private.is_member(inbox_messages.workspace_id) AS is_member));
create policy "inbox_messages member update" on public.inbox_messages as PERMISSIVE for UPDATE to authenticated using (( SELECT private.is_member(inbox_messages.workspace_id) AS is_member)) with check (( SELECT private.is_member(inbox_messages.workspace_id) AS is_member));
create policy "inbox_people member delete" on public.inbox_people as PERMISSIVE for DELETE to authenticated using (( SELECT private.is_member(inbox_people.workspace_id) AS is_member));
create policy "inbox_people member insert" on public.inbox_people as PERMISSIVE for INSERT to authenticated with check (( SELECT private.is_member(inbox_people.workspace_id) AS is_member));
create policy "inbox_people member select" on public.inbox_people as PERMISSIVE for SELECT to authenticated using (( SELECT private.is_member(inbox_people.workspace_id) AS is_member));
create policy "inbox_people member update" on public.inbox_people as PERMISSIVE for UPDATE to authenticated using (( SELECT private.is_member(inbox_people.workspace_id) AS is_member)) with check (( SELECT private.is_member(inbox_people.workspace_id) AS is_member));
create policy "inbox_stages member delete" on public.inbox_stages as PERMISSIVE for DELETE to authenticated using (( SELECT private.is_member(inbox_stages.workspace_id) AS is_member));
create policy "inbox_stages member insert" on public.inbox_stages as PERMISSIVE for INSERT to authenticated with check (( SELECT private.is_member(inbox_stages.workspace_id) AS is_member));
create policy "inbox_stages member select" on public.inbox_stages as PERMISSIVE for SELECT to authenticated using (( SELECT private.is_member(inbox_stages.workspace_id) AS is_member));
create policy "inbox_stages member update" on public.inbox_stages as PERMISSIVE for UPDATE to authenticated using (( SELECT private.is_member(inbox_stages.workspace_id) AS is_member)) with check (( SELECT private.is_member(inbox_stages.workspace_id) AS is_member));
create policy "inbox_threads member delete" on public.inbox_threads as PERMISSIVE for DELETE to authenticated using (( SELECT private.is_member(inbox_threads.workspace_id) AS is_member));
create policy "inbox_threads member insert" on public.inbox_threads as PERMISSIVE for INSERT to authenticated with check (( SELECT private.is_member(inbox_threads.workspace_id) AS is_member));
create policy "inbox_threads member select" on public.inbox_threads as PERMISSIVE for SELECT to authenticated using (( SELECT private.is_member(inbox_threads.workspace_id) AS is_member));
create policy "inbox_threads member update" on public.inbox_threads as PERMISSIVE for UPDATE to authenticated using (( SELECT private.is_member(inbox_threads.workspace_id) AS is_member)) with check (( SELECT private.is_member(inbox_threads.workspace_id) AS is_member));
create policy mcp_changes_read on public.mcp_changes as PERMISSIVE for SELECT to public using (private.is_member(workspace_id));
create policy "members create tokens" on public.mcp_tokens as PERMISSIVE for INSERT to authenticated with check ((private.is_member(workspace_id) AND (user_id = ( SELECT auth.uid() AS uid))));
create policy "members read tokens" on public.mcp_tokens as PERMISSIVE for SELECT to authenticated using (private.is_member(workspace_id));
create policy "owners delete tokens" on public.mcp_tokens as PERMISSIVE for DELETE to authenticated using ((user_id = ( SELECT auth.uid() AS uid)));
create policy "owners revoke tokens" on public.mcp_tokens as PERMISSIVE for UPDATE to authenticated using ((user_id = ( SELECT auth.uid() AS uid))) with check ((user_id = ( SELECT auth.uid() AS uid)));
create policy "members add memory" on public.memory_items as PERMISSIVE for INSERT to authenticated with check (( SELECT private.is_member(memory_items.workspace_id) AS is_member));
create policy "members delete memory" on public.memory_items as PERMISSIVE for DELETE to authenticated using (( SELECT private.is_member(memory_items.workspace_id) AS is_member));
create policy "members read memory" on public.memory_items as PERMISSIVE for SELECT to authenticated using (( SELECT private.is_member(memory_items.workspace_id) AS is_member));
create policy "members update memory" on public.memory_items as PERMISSIVE for UPDATE to authenticated using (( SELECT private.is_member(memory_items.workspace_id) AS is_member)) with check (( SELECT private.is_member(memory_items.workspace_id) AS is_member));
create policy member_read on public.morning_briefs as PERMISSIVE for SELECT to authenticated using (private.is_member(workspace_id));
create policy member_read on public.morning_suggestions as PERMISSIVE for SELECT to authenticated using (private.is_member(workspace_id));
create policy "members add drafts" on public.os_drafts as PERMISSIVE for INSERT to authenticated with check (private.is_member(workspace_id));
create policy "members decide drafts" on public.os_drafts as PERMISSIVE for UPDATE to authenticated using (private.is_member(workspace_id)) with check (private.is_member(workspace_id));
create policy "members delete drafts" on public.os_drafts as PERMISSIVE for DELETE to authenticated using (private.is_member(workspace_id));
create policy "members read drafts" on public.os_drafts as PERMISSIVE for SELECT to authenticated using (private.is_member(workspace_id));
create policy "Read own profile" on public.profiles as PERMISSIVE for SELECT to authenticated using ((id = ( SELECT auth.uid() AS uid)));
create policy "Update own profile" on public.profiles as PERMISSIVE for UPDATE to authenticated using ((id = ( SELECT auth.uid() AS uid))) with check ((id = ( SELECT auth.uid() AS uid)));
create policy "members read" on public.program_materials as PERMISSIVE for SELECT to authenticated using (( SELECT private.is_member(program_materials.workspace_id) AS is_member));
create policy "members read" on public.program_proposals as PERMISSIVE for SELECT to authenticated using (( SELECT private.is_member(program_proposals.workspace_id) AS is_member));
create policy "members read" on public.program_versions as PERMISSIVE for SELECT to authenticated using (( SELECT private.is_member(program_versions.workspace_id) AS is_member));
create policy "members read" on public.programs as PERMISSIVE for SELECT to authenticated using (( SELECT private.is_member(programs.workspace_id) AS is_member));
create policy "members add recording_chunks" on public.recording_chunks as PERMISSIVE for INSERT to authenticated with check (( SELECT private.is_member(recording_chunks.workspace_id) AS is_member));
create policy "members change recording_chunks" on public.recording_chunks as PERMISSIVE for UPDATE to authenticated using (( SELECT private.is_member(recording_chunks.workspace_id) AS is_member)) with check (( SELECT private.is_member(recording_chunks.workspace_id) AS is_member));
create policy "members delete recording_chunks" on public.recording_chunks as PERMISSIVE for DELETE to authenticated using (( SELECT private.is_member(recording_chunks.workspace_id) AS is_member));
create policy "members read recording_chunks" on public.recording_chunks as PERMISSIVE for SELECT to authenticated using (( SELECT private.is_member(recording_chunks.workspace_id) AS is_member));
create policy "members add recordings" on public.recordings as PERMISSIVE for INSERT to authenticated with check (( SELECT private.is_member(recordings.workspace_id) AS is_member));
create policy "members change recordings" on public.recordings as PERMISSIVE for UPDATE to authenticated using (( SELECT private.is_member(recordings.workspace_id) AS is_member)) with check (( SELECT private.is_member(recordings.workspace_id) AS is_member));
create policy "members delete recordings" on public.recordings as PERMISSIVE for DELETE to authenticated using (( SELECT private.is_member(recordings.workspace_id) AS is_member));
create policy "members read recordings" on public.recordings as PERMISSIVE for SELECT to authenticated using (( SELECT private.is_member(recordings.workspace_id) AS is_member));
create policy member_read on public.recurring_tasks as PERMISSIVE for SELECT to authenticated using (private.is_member(workspace_id));
create policy "Members add research" on public.research_runs as PERMISSIVE for INSERT to authenticated with check (private.is_member(workspace_id));
create policy "Members delete research" on public.research_runs as PERMISSIVE for DELETE to authenticated using (private.is_member(workspace_id));
create policy "Members read research" on public.research_runs as PERMISSIVE for SELECT to authenticated using (private.is_member(workspace_id));
create policy "Members update research" on public.research_runs as PERMISSIVE for UPDATE to authenticated using (private.is_member(workspace_id)) with check (private.is_member(workspace_id));
create policy swipe_del on public.swipe_items as PERMISSIVE for DELETE to authenticated using (( SELECT private.is_member(swipe_items.workspace_id) AS is_member));
create policy swipe_ins on public.swipe_items as PERMISSIVE for INSERT to authenticated with check (( SELECT private.is_member(swipe_items.workspace_id) AS is_member));
create policy swipe_sel on public.swipe_items as PERMISSIVE for SELECT to authenticated using (( SELECT private.is_member(swipe_items.workspace_id) AS is_member));
create policy swipe_upd on public.swipe_items as PERMISSIVE for UPDATE to authenticated using (( SELECT private.is_member(swipe_items.workspace_id) AS is_member)) with check (( SELECT private.is_member(swipe_items.workspace_id) AS is_member));
create policy "members add agent settings" on public.team_agent_settings as PERMISSIVE for INSERT to authenticated with check (private.is_member(workspace_id));
create policy "members clear agent settings" on public.team_agent_settings as PERMISSIVE for DELETE to authenticated using (private.is_member(workspace_id));
create policy "members edit agent settings" on public.team_agent_settings as PERMISSIVE for UPDATE to authenticated using (private.is_member(workspace_id)) with check (private.is_member(workspace_id));
create policy "members read agent settings" on public.team_agent_settings as PERMISSIVE for SELECT to authenticated using (private.is_member(workspace_id));
create policy member_read on public.tella_approvals as PERMISSIVE for SELECT to authenticated using (private.is_member(workspace_id));
create policy member_read on public.tella_edits as PERMISSIVE for SELECT to authenticated using (private.is_member(workspace_id));
create policy "Read own access" on public.user_access as PERMISSIVE for SELECT to authenticated using ((user_id = ( SELECT auth.uid() AS uid)));
create policy member_read on public.vault_notes as PERMISSIVE for SELECT to authenticated using (private.is_member(workspace_id));
create policy member_read on public.video_approvals as PERMISSIVE for SELECT to authenticated using (private.is_member(workspace_id));
create policy member_read on public.video_exports as PERMISSIVE for SELECT to authenticated using (private.is_member(workspace_id));
create policy member_read on public.video_projects as PERMISSIVE for SELECT to authenticated using (private.is_member(workspace_id));
create policy "Members read connections" on public.workspace_connections as PERMISSIVE for SELECT to authenticated using (private.is_member(workspace_id));
create policy "Members read membership" on public.workspace_members as PERMISSIVE for SELECT to authenticated using (private.is_member(workspace_id));
create policy "Members read workspace" on public.workspaces as PERMISSIVE for SELECT to authenticated using (private.is_member(id));
create policy "Owner updates workspace" on public.workspaces as PERMISSIVE for UPDATE to authenticated using ((owner_id = ( SELECT auth.uid() AS uid))) with check ((owner_id = ( SELECT auth.uid() AS uid)));
create policy "members add writing_samples" on public.writing_samples as PERMISSIVE for INSERT to authenticated with check (( SELECT private.is_member(writing_samples.workspace_id) AS is_member));
create policy "members change writing_samples" on public.writing_samples as PERMISSIVE for UPDATE to authenticated using (( SELECT private.is_member(writing_samples.workspace_id) AS is_member)) with check (( SELECT private.is_member(writing_samples.workspace_id) AS is_member));
create policy "members delete writing_samples" on public.writing_samples as PERMISSIVE for DELETE to authenticated using (( SELECT private.is_member(writing_samples.workspace_id) AS is_member));
create policy "members read writing_samples" on public.writing_samples as PERMISSIVE for SELECT to authenticated using (( SELECT private.is_member(writing_samples.workspace_id) AS is_member));
create policy "members add writing_style" on public.writing_style as PERMISSIVE for INSERT to authenticated with check (( SELECT private.is_member(writing_style.workspace_id) AS is_member));
create policy "members change writing_style" on public.writing_style as PERMISSIVE for UPDATE to authenticated using (( SELECT private.is_member(writing_style.workspace_id) AS is_member)) with check (( SELECT private.is_member(writing_style.workspace_id) AS is_member));
create policy "members delete writing_style" on public.writing_style as PERMISSIVE for DELETE to authenticated using (( SELECT private.is_member(writing_style.workspace_id) AS is_member));
create policy "members read writing_style" on public.writing_style as PERMISSIVE for SELECT to authenticated using (( SELECT private.is_member(writing_style.workspace_id) AS is_member));
create policy "brain members add" on storage.objects as PERMISSIVE for INSERT to authenticated with check (((bucket_id = 'brain'::text) AND ( SELECT private.is_member(((storage.foldername(objects.name))[1])::uuid) AS is_member)));
create policy "brain members delete" on storage.objects as PERMISSIVE for DELETE to authenticated using (((bucket_id = 'brain'::text) AND ( SELECT private.is_member(((storage.foldername(objects.name))[1])::uuid) AS is_member)));
create policy "brain members read" on storage.objects as PERMISSIVE for SELECT to authenticated using (((bucket_id = 'brain'::text) AND ( SELECT private.is_member(((storage.foldername(objects.name))[1])::uuid) AS is_member)));
create policy video_member_delete on storage.objects as PERMISSIVE for DELETE to authenticated using (((bucket_id = 'video-editor'::text) AND ((storage.foldername(name))[1] IN ( SELECT (w.id)::text AS id
   FROM workspaces w
  WHERE private.is_member(w.id)))));
create policy video_member_read on storage.objects as PERMISSIVE for SELECT to authenticated using (((bucket_id = 'video-editor'::text) AND ((storage.foldername(name))[1] IN ( SELECT (w.id)::text AS id
   FROM workspaces w
  WHERE private.is_member(w.id)))));
create policy video_member_upload on storage.objects as PERMISSIVE for INSERT to authenticated with check (((bucket_id = 'video-editor'::text) AND (name ~ '^[0-9a-f-]{36}/videos/[0-9a-f-]{36}/(source|refs|exports)/[0-9a-f-]{36}\.[a-z0-9]{2,8}$'::text) AND ((storage.foldername(name))[1] IN ( SELECT (w.id)::text AS id
   FROM workspaces w
  WHERE private.is_member(w.id)))));

revoke all on all tables in schema public from anon, authenticated;
revoke all on all sequences in schema public from anon, authenticated;

grant INSERT on table public.workspace_members to anon;
grant SELECT on table public.workspace_members to anon;
grant UPDATE on table public.workspace_members to anon;
grant DELETE on table public.workspace_members to anon;
grant TRUNCATE on table public.workspace_members to anon;
grant REFERENCES on table public.workspace_members to anon;
grant TRIGGER on table public.workspace_members to anon;
grant INSERT on table public.workspace_members to authenticated;
grant SELECT on table public.workspace_members to authenticated;
grant UPDATE on table public.workspace_members to authenticated;
grant DELETE on table public.workspace_members to authenticated;
grant TRUNCATE on table public.workspace_members to authenticated;
grant REFERENCES on table public.workspace_members to authenticated;
grant TRIGGER on table public.workspace_members to authenticated;
grant INSERT on table public.workspace_members to service_role;
grant SELECT on table public.workspace_members to service_role;
grant UPDATE on table public.workspace_members to service_role;
grant DELETE on table public.workspace_members to service_role;
grant TRUNCATE on table public.workspace_members to service_role;
grant REFERENCES on table public.workspace_members to service_role;
grant TRIGGER on table public.workspace_members to service_role;
grant INSERT on table public.workspaces to anon;
grant SELECT on table public.workspaces to anon;
grant UPDATE on table public.workspaces to anon;
grant DELETE on table public.workspaces to anon;
grant TRUNCATE on table public.workspaces to anon;
grant REFERENCES on table public.workspaces to anon;
grant TRIGGER on table public.workspaces to anon;
grant INSERT on table public.workspaces to authenticated;
grant SELECT on table public.workspaces to authenticated;
grant UPDATE on table public.workspaces to authenticated;
grant DELETE on table public.workspaces to authenticated;
grant TRUNCATE on table public.workspaces to authenticated;
grant REFERENCES on table public.workspaces to authenticated;
grant TRIGGER on table public.workspaces to authenticated;
grant INSERT on table public.workspaces to service_role;
grant SELECT on table public.workspaces to service_role;
grant UPDATE on table public.workspaces to service_role;
grant DELETE on table public.workspaces to service_role;
grant TRUNCATE on table public.workspaces to service_role;
grant REFERENCES on table public.workspaces to service_role;
grant TRIGGER on table public.workspaces to service_role;
grant INSERT on table public.brain_chunks to anon;
grant SELECT on table public.brain_chunks to anon;
grant UPDATE on table public.brain_chunks to anon;
grant DELETE on table public.brain_chunks to anon;
grant TRUNCATE on table public.brain_chunks to anon;
grant REFERENCES on table public.brain_chunks to anon;
grant TRIGGER on table public.brain_chunks to anon;
grant INSERT on table public.brain_chunks to authenticated;
grant SELECT on table public.brain_chunks to authenticated;
grant UPDATE on table public.brain_chunks to authenticated;
grant DELETE on table public.brain_chunks to authenticated;
grant TRUNCATE on table public.brain_chunks to authenticated;
grant REFERENCES on table public.brain_chunks to authenticated;
grant TRIGGER on table public.brain_chunks to authenticated;
grant INSERT on table public.brain_chunks to service_role;
grant SELECT on table public.brain_chunks to service_role;
grant UPDATE on table public.brain_chunks to service_role;
grant DELETE on table public.brain_chunks to service_role;
grant TRUNCATE on table public.brain_chunks to service_role;
grant REFERENCES on table public.brain_chunks to service_role;
grant TRIGGER on table public.brain_chunks to service_role;
grant INSERT on table public.brain_profile to anon;
grant SELECT on table public.brain_profile to anon;
grant UPDATE on table public.brain_profile to anon;
grant DELETE on table public.brain_profile to anon;
grant TRUNCATE on table public.brain_profile to anon;
grant REFERENCES on table public.brain_profile to anon;
grant TRIGGER on table public.brain_profile to anon;
grant INSERT on table public.brain_profile to authenticated;
grant SELECT on table public.brain_profile to authenticated;
grant UPDATE on table public.brain_profile to authenticated;
grant DELETE on table public.brain_profile to authenticated;
grant TRUNCATE on table public.brain_profile to authenticated;
grant REFERENCES on table public.brain_profile to authenticated;
grant TRIGGER on table public.brain_profile to authenticated;
grant INSERT on table public.brain_profile to service_role;
grant SELECT on table public.brain_profile to service_role;
grant UPDATE on table public.brain_profile to service_role;
grant DELETE on table public.brain_profile to service_role;
grant TRUNCATE on table public.brain_profile to service_role;
grant REFERENCES on table public.brain_profile to service_role;
grant TRIGGER on table public.brain_profile to service_role;
grant INSERT on table public.profiles to anon;
grant SELECT on table public.profiles to anon;
grant UPDATE on table public.profiles to anon;
grant DELETE on table public.profiles to anon;
grant TRUNCATE on table public.profiles to anon;
grant REFERENCES on table public.profiles to anon;
grant TRIGGER on table public.profiles to anon;
grant INSERT on table public.profiles to authenticated;
grant SELECT on table public.profiles to authenticated;
grant UPDATE on table public.profiles to authenticated;
grant DELETE on table public.profiles to authenticated;
grant TRUNCATE on table public.profiles to authenticated;
grant REFERENCES on table public.profiles to authenticated;
grant TRIGGER on table public.profiles to authenticated;
grant INSERT on table public.profiles to service_role;
grant SELECT on table public.profiles to service_role;
grant UPDATE on table public.profiles to service_role;
grant DELETE on table public.profiles to service_role;
grant TRUNCATE on table public.profiles to service_role;
grant REFERENCES on table public.profiles to service_role;
grant TRIGGER on table public.profiles to service_role;
grant INSERT on table public.brain_docs to anon;
grant SELECT on table public.brain_docs to anon;
grant UPDATE on table public.brain_docs to anon;
grant DELETE on table public.brain_docs to anon;
grant TRUNCATE on table public.brain_docs to anon;
grant REFERENCES on table public.brain_docs to anon;
grant TRIGGER on table public.brain_docs to anon;
grant INSERT on table public.brain_docs to authenticated;
grant SELECT on table public.brain_docs to authenticated;
grant UPDATE on table public.brain_docs to authenticated;
grant DELETE on table public.brain_docs to authenticated;
grant TRUNCATE on table public.brain_docs to authenticated;
grant REFERENCES on table public.brain_docs to authenticated;
grant TRIGGER on table public.brain_docs to authenticated;
grant INSERT on table public.brain_docs to service_role;
grant SELECT on table public.brain_docs to service_role;
grant UPDATE on table public.brain_docs to service_role;
grant DELETE on table public.brain_docs to service_role;
grant TRUNCATE on table public.brain_docs to service_role;
grant REFERENCES on table public.brain_docs to service_role;
grant TRIGGER on table public.brain_docs to service_role;
grant INSERT on table public.workspace_connections to anon;
grant SELECT on table public.workspace_connections to anon;
grant UPDATE on table public.workspace_connections to anon;
grant DELETE on table public.workspace_connections to anon;
grant TRUNCATE on table public.workspace_connections to anon;
grant REFERENCES on table public.workspace_connections to anon;
grant TRIGGER on table public.workspace_connections to anon;
grant INSERT on table public.workspace_connections to authenticated;
grant SELECT on table public.workspace_connections to authenticated;
grant UPDATE on table public.workspace_connections to authenticated;
grant DELETE on table public.workspace_connections to authenticated;
grant TRUNCATE on table public.workspace_connections to authenticated;
grant REFERENCES on table public.workspace_connections to authenticated;
grant TRIGGER on table public.workspace_connections to authenticated;
grant INSERT on table public.workspace_connections to service_role;
grant SELECT on table public.workspace_connections to service_role;
grant UPDATE on table public.workspace_connections to service_role;
grant DELETE on table public.workspace_connections to service_role;
grant TRUNCATE on table public.workspace_connections to service_role;
grant REFERENCES on table public.workspace_connections to service_role;
grant TRIGGER on table public.workspace_connections to service_role;
grant INSERT on table public.mcp_tokens to anon;
grant SELECT on table public.mcp_tokens to anon;
grant UPDATE on table public.mcp_tokens to anon;
grant DELETE on table public.mcp_tokens to anon;
grant TRUNCATE on table public.mcp_tokens to anon;
grant REFERENCES on table public.mcp_tokens to anon;
grant TRIGGER on table public.mcp_tokens to anon;
grant INSERT on table public.mcp_tokens to authenticated;
grant SELECT on table public.mcp_tokens to authenticated;
grant UPDATE on table public.mcp_tokens to authenticated;
grant DELETE on table public.mcp_tokens to authenticated;
grant TRUNCATE on table public.mcp_tokens to authenticated;
grant REFERENCES on table public.mcp_tokens to authenticated;
grant TRIGGER on table public.mcp_tokens to authenticated;
grant INSERT on table public.mcp_tokens to service_role;
grant SELECT on table public.mcp_tokens to service_role;
grant UPDATE on table public.mcp_tokens to service_role;
grant DELETE on table public.mcp_tokens to service_role;
grant TRUNCATE on table public.mcp_tokens to service_role;
grant REFERENCES on table public.mcp_tokens to service_role;
grant TRIGGER on table public.mcp_tokens to service_role;
grant INSERT on table public.os_drafts to anon;
grant SELECT on table public.os_drafts to anon;
grant UPDATE on table public.os_drafts to anon;
grant DELETE on table public.os_drafts to anon;
grant TRUNCATE on table public.os_drafts to anon;
grant REFERENCES on table public.os_drafts to anon;
grant TRIGGER on table public.os_drafts to anon;
grant INSERT on table public.os_drafts to authenticated;
grant SELECT on table public.os_drafts to authenticated;
grant UPDATE on table public.os_drafts to authenticated;
grant DELETE on table public.os_drafts to authenticated;
grant TRUNCATE on table public.os_drafts to authenticated;
grant REFERENCES on table public.os_drafts to authenticated;
grant TRIGGER on table public.os_drafts to authenticated;
grant INSERT on table public.os_drafts to service_role;
grant SELECT on table public.os_drafts to service_role;
grant UPDATE on table public.os_drafts to service_role;
grant DELETE on table public.os_drafts to service_role;
grant TRUNCATE on table public.os_drafts to service_role;
grant REFERENCES on table public.os_drafts to service_role;
grant TRIGGER on table public.os_drafts to service_role;
grant INSERT on table public.memory_items to anon;
grant SELECT on table public.memory_items to anon;
grant UPDATE on table public.memory_items to anon;
grant DELETE on table public.memory_items to anon;
grant TRUNCATE on table public.memory_items to anon;
grant REFERENCES on table public.memory_items to anon;
grant TRIGGER on table public.memory_items to anon;
grant INSERT on table public.memory_items to authenticated;
grant SELECT on table public.memory_items to authenticated;
grant UPDATE on table public.memory_items to authenticated;
grant DELETE on table public.memory_items to authenticated;
grant TRUNCATE on table public.memory_items to authenticated;
grant REFERENCES on table public.memory_items to authenticated;
grant TRIGGER on table public.memory_items to authenticated;
grant INSERT on table public.memory_items to service_role;
grant SELECT on table public.memory_items to service_role;
grant UPDATE on table public.memory_items to service_role;
grant DELETE on table public.memory_items to service_role;
grant TRUNCATE on table public.memory_items to service_role;
grant REFERENCES on table public.memory_items to service_role;
grant TRIGGER on table public.memory_items to service_role;
grant INSERT on table public.research_runs to anon;
grant SELECT on table public.research_runs to anon;
grant UPDATE on table public.research_runs to anon;
grant DELETE on table public.research_runs to anon;
grant TRUNCATE on table public.research_runs to anon;
grant REFERENCES on table public.research_runs to anon;
grant TRIGGER on table public.research_runs to anon;
grant INSERT on table public.research_runs to authenticated;
grant SELECT on table public.research_runs to authenticated;
grant UPDATE on table public.research_runs to authenticated;
grant DELETE on table public.research_runs to authenticated;
grant TRUNCATE on table public.research_runs to authenticated;
grant REFERENCES on table public.research_runs to authenticated;
grant TRIGGER on table public.research_runs to authenticated;
grant INSERT on table public.research_runs to service_role;
grant SELECT on table public.research_runs to service_role;
grant UPDATE on table public.research_runs to service_role;
grant DELETE on table public.research_runs to service_role;
grant TRUNCATE on table public.research_runs to service_role;
grant REFERENCES on table public.research_runs to service_role;
grant TRIGGER on table public.research_runs to service_role;
grant INSERT on table public.inbox_accounts to anon;
grant SELECT on table public.inbox_accounts to anon;
grant UPDATE on table public.inbox_accounts to anon;
grant DELETE on table public.inbox_accounts to anon;
grant TRUNCATE on table public.inbox_accounts to anon;
grant REFERENCES on table public.inbox_accounts to anon;
grant TRIGGER on table public.inbox_accounts to anon;
grant INSERT on table public.inbox_accounts to authenticated;
grant SELECT on table public.inbox_accounts to authenticated;
grant UPDATE on table public.inbox_accounts to authenticated;
grant DELETE on table public.inbox_accounts to authenticated;
grant TRUNCATE on table public.inbox_accounts to authenticated;
grant REFERENCES on table public.inbox_accounts to authenticated;
grant TRIGGER on table public.inbox_accounts to authenticated;
grant INSERT on table public.inbox_accounts to service_role;
grant SELECT on table public.inbox_accounts to service_role;
grant UPDATE on table public.inbox_accounts to service_role;
grant DELETE on table public.inbox_accounts to service_role;
grant TRUNCATE on table public.inbox_accounts to service_role;
grant REFERENCES on table public.inbox_accounts to service_role;
grant TRIGGER on table public.inbox_accounts to service_role;
grant INSERT on table public.inbox_stages to anon;
grant SELECT on table public.inbox_stages to anon;
grant UPDATE on table public.inbox_stages to anon;
grant DELETE on table public.inbox_stages to anon;
grant TRUNCATE on table public.inbox_stages to anon;
grant REFERENCES on table public.inbox_stages to anon;
grant TRIGGER on table public.inbox_stages to anon;
grant INSERT on table public.inbox_stages to authenticated;
grant SELECT on table public.inbox_stages to authenticated;
grant UPDATE on table public.inbox_stages to authenticated;
grant DELETE on table public.inbox_stages to authenticated;
grant TRUNCATE on table public.inbox_stages to authenticated;
grant REFERENCES on table public.inbox_stages to authenticated;
grant TRIGGER on table public.inbox_stages to authenticated;
grant INSERT on table public.inbox_stages to service_role;
grant SELECT on table public.inbox_stages to service_role;
grant UPDATE on table public.inbox_stages to service_role;
grant DELETE on table public.inbox_stages to service_role;
grant TRUNCATE on table public.inbox_stages to service_role;
grant REFERENCES on table public.inbox_stages to service_role;
grant TRIGGER on table public.inbox_stages to service_role;
grant INSERT on table public.inbox_people to anon;
grant SELECT on table public.inbox_people to anon;
grant UPDATE on table public.inbox_people to anon;
grant DELETE on table public.inbox_people to anon;
grant TRUNCATE on table public.inbox_people to anon;
grant REFERENCES on table public.inbox_people to anon;
grant TRIGGER on table public.inbox_people to anon;
grant INSERT on table public.inbox_people to authenticated;
grant SELECT on table public.inbox_people to authenticated;
grant UPDATE on table public.inbox_people to authenticated;
grant DELETE on table public.inbox_people to authenticated;
grant TRUNCATE on table public.inbox_people to authenticated;
grant REFERENCES on table public.inbox_people to authenticated;
grant TRIGGER on table public.inbox_people to authenticated;
grant INSERT on table public.inbox_people to service_role;
grant SELECT on table public.inbox_people to service_role;
grant UPDATE on table public.inbox_people to service_role;
grant DELETE on table public.inbox_people to service_role;
grant TRUNCATE on table public.inbox_people to service_role;
grant REFERENCES on table public.inbox_people to service_role;
grant TRIGGER on table public.inbox_people to service_role;
grant INSERT on table public.inbox_threads to anon;
grant SELECT on table public.inbox_threads to anon;
grant UPDATE on table public.inbox_threads to anon;
grant DELETE on table public.inbox_threads to anon;
grant TRUNCATE on table public.inbox_threads to anon;
grant REFERENCES on table public.inbox_threads to anon;
grant TRIGGER on table public.inbox_threads to anon;
grant INSERT on table public.inbox_threads to authenticated;
grant SELECT on table public.inbox_threads to authenticated;
grant UPDATE on table public.inbox_threads to authenticated;
grant DELETE on table public.inbox_threads to authenticated;
grant TRUNCATE on table public.inbox_threads to authenticated;
grant REFERENCES on table public.inbox_threads to authenticated;
grant TRIGGER on table public.inbox_threads to authenticated;
grant INSERT on table public.inbox_threads to service_role;
grant SELECT on table public.inbox_threads to service_role;
grant UPDATE on table public.inbox_threads to service_role;
grant DELETE on table public.inbox_threads to service_role;
grant TRUNCATE on table public.inbox_threads to service_role;
grant REFERENCES on table public.inbox_threads to service_role;
grant TRIGGER on table public.inbox_threads to service_role;
grant INSERT on table public.inbox_messages to anon;
grant SELECT on table public.inbox_messages to anon;
grant UPDATE on table public.inbox_messages to anon;
grant DELETE on table public.inbox_messages to anon;
grant TRUNCATE on table public.inbox_messages to anon;
grant REFERENCES on table public.inbox_messages to anon;
grant TRIGGER on table public.inbox_messages to anon;
grant INSERT on table public.inbox_messages to authenticated;
grant SELECT on table public.inbox_messages to authenticated;
grant UPDATE on table public.inbox_messages to authenticated;
grant DELETE on table public.inbox_messages to authenticated;
grant TRUNCATE on table public.inbox_messages to authenticated;
grant REFERENCES on table public.inbox_messages to authenticated;
grant TRIGGER on table public.inbox_messages to authenticated;
grant INSERT on table public.inbox_messages to service_role;
grant SELECT on table public.inbox_messages to service_role;
grant UPDATE on table public.inbox_messages to service_role;
grant DELETE on table public.inbox_messages to service_role;
grant TRUNCATE on table public.inbox_messages to service_role;
grant REFERENCES on table public.inbox_messages to service_role;
grant TRIGGER on table public.inbox_messages to service_role;
grant SELECT on table public.brain_chunks_id_seq to anon;
grant UPDATE on table public.brain_chunks_id_seq to anon;
grant USAGE on table public.brain_chunks_id_seq to anon;
grant SELECT on table public.brain_chunks_id_seq to authenticated;
grant UPDATE on table public.brain_chunks_id_seq to authenticated;
grant USAGE on table public.brain_chunks_id_seq to authenticated;
grant SELECT on table public.brain_chunks_id_seq to service_role;
grant UPDATE on table public.brain_chunks_id_seq to service_role;
grant USAGE on table public.brain_chunks_id_seq to service_role;
grant INSERT on table public.user_access to service_role;
grant SELECT on table public.user_access to service_role;
grant UPDATE on table public.user_access to service_role;
grant DELETE on table public.user_access to service_role;
grant TRUNCATE on table public.user_access to service_role;
grant REFERENCES on table public.user_access to service_role;
grant TRIGGER on table public.user_access to service_role;
grant SELECT on table public.user_access to authenticated;
grant INSERT on table public.brain_facts to anon;
grant SELECT on table public.brain_facts to anon;
grant UPDATE on table public.brain_facts to anon;
grant DELETE on table public.brain_facts to anon;
grant TRUNCATE on table public.brain_facts to anon;
grant REFERENCES on table public.brain_facts to anon;
grant TRIGGER on table public.brain_facts to anon;
grant INSERT on table public.brain_facts to authenticated;
grant SELECT on table public.brain_facts to authenticated;
grant UPDATE on table public.brain_facts to authenticated;
grant DELETE on table public.brain_facts to authenticated;
grant TRUNCATE on table public.brain_facts to authenticated;
grant REFERENCES on table public.brain_facts to authenticated;
grant TRIGGER on table public.brain_facts to authenticated;
grant INSERT on table public.brain_facts to service_role;
grant SELECT on table public.brain_facts to service_role;
grant UPDATE on table public.brain_facts to service_role;
grant DELETE on table public.brain_facts to service_role;
grant TRUNCATE on table public.brain_facts to service_role;
grant REFERENCES on table public.brain_facts to service_role;
grant TRIGGER on table public.brain_facts to service_role;
grant INSERT on table public.dna_items to anon;
grant SELECT on table public.dna_items to anon;
grant UPDATE on table public.dna_items to anon;
grant DELETE on table public.dna_items to anon;
grant TRUNCATE on table public.dna_items to anon;
grant REFERENCES on table public.dna_items to anon;
grant TRIGGER on table public.dna_items to anon;
grant INSERT on table public.dna_items to authenticated;
grant SELECT on table public.dna_items to authenticated;
grant UPDATE on table public.dna_items to authenticated;
grant DELETE on table public.dna_items to authenticated;
grant TRUNCATE on table public.dna_items to authenticated;
grant REFERENCES on table public.dna_items to authenticated;
grant TRIGGER on table public.dna_items to authenticated;
grant INSERT on table public.dna_items to service_role;
grant SELECT on table public.dna_items to service_role;
grant UPDATE on table public.dna_items to service_role;
grant DELETE on table public.dna_items to service_role;
grant TRUNCATE on table public.dna_items to service_role;
grant REFERENCES on table public.dna_items to service_role;
grant TRIGGER on table public.dna_items to service_role;
grant INSERT on table public.brand_dna to anon;
grant SELECT on table public.brand_dna to anon;
grant UPDATE on table public.brand_dna to anon;
grant DELETE on table public.brand_dna to anon;
grant TRUNCATE on table public.brand_dna to anon;
grant REFERENCES on table public.brand_dna to anon;
grant TRIGGER on table public.brand_dna to anon;
grant INSERT on table public.brand_dna to authenticated;
grant SELECT on table public.brand_dna to authenticated;
grant UPDATE on table public.brand_dna to authenticated;
grant DELETE on table public.brand_dna to authenticated;
grant TRUNCATE on table public.brand_dna to authenticated;
grant REFERENCES on table public.brand_dna to authenticated;
grant TRIGGER on table public.brand_dna to authenticated;
grant INSERT on table public.brand_dna to service_role;
grant SELECT on table public.brand_dna to service_role;
grant UPDATE on table public.brand_dna to service_role;
grant DELETE on table public.brand_dna to service_role;
grant TRUNCATE on table public.brand_dna to service_role;
grant REFERENCES on table public.brand_dna to service_role;
grant TRIGGER on table public.brand_dna to service_role;
grant INSERT on table public.video_projects to service_role;
grant SELECT on table public.video_projects to service_role;
grant UPDATE on table public.video_projects to service_role;
grant DELETE on table public.video_projects to service_role;
grant TRUNCATE on table public.video_projects to service_role;
grant REFERENCES on table public.video_projects to service_role;
grant TRIGGER on table public.video_projects to service_role;
grant SELECT on table public.video_projects to authenticated;
grant INSERT on table public.video_approvals to service_role;
grant SELECT on table public.video_approvals to service_role;
grant UPDATE on table public.video_approvals to service_role;
grant DELETE on table public.video_approvals to service_role;
grant TRUNCATE on table public.video_approvals to service_role;
grant REFERENCES on table public.video_approvals to service_role;
grant TRIGGER on table public.video_approvals to service_role;
grant SELECT on table public.video_approvals to authenticated;
grant INSERT on table public.recording_chunks to anon;
grant SELECT on table public.recording_chunks to anon;
grant UPDATE on table public.recording_chunks to anon;
grant DELETE on table public.recording_chunks to anon;
grant TRUNCATE on table public.recording_chunks to anon;
grant REFERENCES on table public.recording_chunks to anon;
grant TRIGGER on table public.recording_chunks to anon;
grant INSERT on table public.recording_chunks to authenticated;
grant SELECT on table public.recording_chunks to authenticated;
grant UPDATE on table public.recording_chunks to authenticated;
grant DELETE on table public.recording_chunks to authenticated;
grant TRUNCATE on table public.recording_chunks to authenticated;
grant REFERENCES on table public.recording_chunks to authenticated;
grant TRIGGER on table public.recording_chunks to authenticated;
grant INSERT on table public.recording_chunks to service_role;
grant SELECT on table public.recording_chunks to service_role;
grant UPDATE on table public.recording_chunks to service_role;
grant DELETE on table public.recording_chunks to service_role;
grant TRUNCATE on table public.recording_chunks to service_role;
grant REFERENCES on table public.recording_chunks to service_role;
grant TRIGGER on table public.recording_chunks to service_role;
grant SELECT on table public.recording_chunks_id_seq to anon;
grant UPDATE on table public.recording_chunks_id_seq to anon;
grant USAGE on table public.recording_chunks_id_seq to anon;
grant SELECT on table public.recording_chunks_id_seq to authenticated;
grant UPDATE on table public.recording_chunks_id_seq to authenticated;
grant USAGE on table public.recording_chunks_id_seq to authenticated;
grant SELECT on table public.recording_chunks_id_seq to service_role;
grant UPDATE on table public.recording_chunks_id_seq to service_role;
grant USAGE on table public.recording_chunks_id_seq to service_role;
grant SELECT on table public.chat_messages_id_seq to anon;
grant UPDATE on table public.chat_messages_id_seq to anon;
grant USAGE on table public.chat_messages_id_seq to anon;
grant SELECT on table public.chat_messages_id_seq to authenticated;
grant UPDATE on table public.chat_messages_id_seq to authenticated;
grant USAGE on table public.chat_messages_id_seq to authenticated;
grant SELECT on table public.chat_messages_id_seq to service_role;
grant UPDATE on table public.chat_messages_id_seq to service_role;
grant USAGE on table public.chat_messages_id_seq to service_role;
grant INSERT on table public.content_items to anon;
grant SELECT on table public.content_items to anon;
grant UPDATE on table public.content_items to anon;
grant DELETE on table public.content_items to anon;
grant TRUNCATE on table public.content_items to anon;
grant REFERENCES on table public.content_items to anon;
grant TRIGGER on table public.content_items to anon;
grant INSERT on table public.content_items to authenticated;
grant SELECT on table public.content_items to authenticated;
grant UPDATE on table public.content_items to authenticated;
grant DELETE on table public.content_items to authenticated;
grant TRUNCATE on table public.content_items to authenticated;
grant REFERENCES on table public.content_items to authenticated;
grant TRIGGER on table public.content_items to authenticated;
grant INSERT on table public.content_items to service_role;
grant SELECT on table public.content_items to service_role;
grant UPDATE on table public.content_items to service_role;
grant DELETE on table public.content_items to service_role;
grant TRUNCATE on table public.content_items to service_role;
grant REFERENCES on table public.content_items to service_role;
grant TRIGGER on table public.content_items to service_role;
grant INSERT on table public.writing_samples to anon;
grant SELECT on table public.writing_samples to anon;
grant UPDATE on table public.writing_samples to anon;
grant DELETE on table public.writing_samples to anon;
grant TRUNCATE on table public.writing_samples to anon;
grant REFERENCES on table public.writing_samples to anon;
grant TRIGGER on table public.writing_samples to anon;
grant INSERT on table public.writing_samples to authenticated;
grant SELECT on table public.writing_samples to authenticated;
grant UPDATE on table public.writing_samples to authenticated;
grant DELETE on table public.writing_samples to authenticated;
grant TRUNCATE on table public.writing_samples to authenticated;
grant REFERENCES on table public.writing_samples to authenticated;
grant TRIGGER on table public.writing_samples to authenticated;
grant INSERT on table public.writing_samples to service_role;
grant SELECT on table public.writing_samples to service_role;
grant UPDATE on table public.writing_samples to service_role;
grant DELETE on table public.writing_samples to service_role;
grant TRUNCATE on table public.writing_samples to service_role;
grant REFERENCES on table public.writing_samples to service_role;
grant TRIGGER on table public.writing_samples to service_role;
grant INSERT on table public.writing_style to anon;
grant SELECT on table public.writing_style to anon;
grant UPDATE on table public.writing_style to anon;
grant DELETE on table public.writing_style to anon;
grant TRUNCATE on table public.writing_style to anon;
grant REFERENCES on table public.writing_style to anon;
grant TRIGGER on table public.writing_style to anon;
grant INSERT on table public.writing_style to authenticated;
grant SELECT on table public.writing_style to authenticated;
grant UPDATE on table public.writing_style to authenticated;
grant DELETE on table public.writing_style to authenticated;
grant TRUNCATE on table public.writing_style to authenticated;
grant REFERENCES on table public.writing_style to authenticated;
grant TRIGGER on table public.writing_style to authenticated;
grant INSERT on table public.writing_style to service_role;
grant SELECT on table public.writing_style to service_role;
grant UPDATE on table public.writing_style to service_role;
grant DELETE on table public.writing_style to service_role;
grant TRUNCATE on table public.writing_style to service_role;
grant REFERENCES on table public.writing_style to service_role;
grant TRIGGER on table public.writing_style to service_role;
grant INSERT on table public.recordings to anon;
grant SELECT on table public.recordings to anon;
grant UPDATE on table public.recordings to anon;
grant DELETE on table public.recordings to anon;
grant TRUNCATE on table public.recordings to anon;
grant REFERENCES on table public.recordings to anon;
grant TRIGGER on table public.recordings to anon;
grant INSERT on table public.recordings to authenticated;
grant SELECT on table public.recordings to authenticated;
grant UPDATE on table public.recordings to authenticated;
grant DELETE on table public.recordings to authenticated;
grant TRUNCATE on table public.recordings to authenticated;
grant REFERENCES on table public.recordings to authenticated;
grant TRIGGER on table public.recordings to authenticated;
grant INSERT on table public.recordings to service_role;
grant SELECT on table public.recordings to service_role;
grant UPDATE on table public.recordings to service_role;
grant DELETE on table public.recordings to service_role;
grant TRUNCATE on table public.recordings to service_role;
grant REFERENCES on table public.recordings to service_role;
grant TRIGGER on table public.recordings to service_role;
grant INSERT on table public.chat_threads to anon;
grant SELECT on table public.chat_threads to anon;
grant UPDATE on table public.chat_threads to anon;
grant DELETE on table public.chat_threads to anon;
grant TRUNCATE on table public.chat_threads to anon;
grant REFERENCES on table public.chat_threads to anon;
grant TRIGGER on table public.chat_threads to anon;
grant INSERT on table public.chat_threads to authenticated;
grant SELECT on table public.chat_threads to authenticated;
grant UPDATE on table public.chat_threads to authenticated;
grant DELETE on table public.chat_threads to authenticated;
grant TRUNCATE on table public.chat_threads to authenticated;
grant REFERENCES on table public.chat_threads to authenticated;
grant TRIGGER on table public.chat_threads to authenticated;
grant INSERT on table public.chat_threads to service_role;
grant SELECT on table public.chat_threads to service_role;
grant UPDATE on table public.chat_threads to service_role;
grant DELETE on table public.chat_threads to service_role;
grant TRUNCATE on table public.chat_threads to service_role;
grant REFERENCES on table public.chat_threads to service_role;
grant TRIGGER on table public.chat_threads to service_role;
grant INSERT on table public.affiliate_events to anon;
grant SELECT on table public.affiliate_events to anon;
grant UPDATE on table public.affiliate_events to anon;
grant DELETE on table public.affiliate_events to anon;
grant TRUNCATE on table public.affiliate_events to anon;
grant REFERENCES on table public.affiliate_events to anon;
grant TRIGGER on table public.affiliate_events to anon;
grant INSERT on table public.affiliate_events to authenticated;
grant SELECT on table public.affiliate_events to authenticated;
grant UPDATE on table public.affiliate_events to authenticated;
grant DELETE on table public.affiliate_events to authenticated;
grant TRUNCATE on table public.affiliate_events to authenticated;
grant REFERENCES on table public.affiliate_events to authenticated;
grant TRIGGER on table public.affiliate_events to authenticated;
grant INSERT on table public.affiliate_events to service_role;
grant SELECT on table public.affiliate_events to service_role;
grant UPDATE on table public.affiliate_events to service_role;
grant DELETE on table public.affiliate_events to service_role;
grant TRUNCATE on table public.affiliate_events to service_role;
grant REFERENCES on table public.affiliate_events to service_role;
grant TRIGGER on table public.affiliate_events to service_role;
grant INSERT on table public.swipe_items to anon;
grant SELECT on table public.swipe_items to anon;
grant UPDATE on table public.swipe_items to anon;
grant DELETE on table public.swipe_items to anon;
grant TRUNCATE on table public.swipe_items to anon;
grant REFERENCES on table public.swipe_items to anon;
grant TRIGGER on table public.swipe_items to anon;
grant INSERT on table public.swipe_items to authenticated;
grant SELECT on table public.swipe_items to authenticated;
grant UPDATE on table public.swipe_items to authenticated;
grant DELETE on table public.swipe_items to authenticated;
grant TRUNCATE on table public.swipe_items to authenticated;
grant REFERENCES on table public.swipe_items to authenticated;
grant TRIGGER on table public.swipe_items to authenticated;
grant INSERT on table public.swipe_items to service_role;
grant SELECT on table public.swipe_items to service_role;
grant UPDATE on table public.swipe_items to service_role;
grant DELETE on table public.swipe_items to service_role;
grant TRUNCATE on table public.swipe_items to service_role;
grant REFERENCES on table public.swipe_items to service_role;
grant TRIGGER on table public.swipe_items to service_role;
grant INSERT on table public.creators to anon;
grant SELECT on table public.creators to anon;
grant UPDATE on table public.creators to anon;
grant DELETE on table public.creators to anon;
grant TRUNCATE on table public.creators to anon;
grant REFERENCES on table public.creators to anon;
grant TRIGGER on table public.creators to anon;
grant INSERT on table public.creators to authenticated;
grant SELECT on table public.creators to authenticated;
grant UPDATE on table public.creators to authenticated;
grant DELETE on table public.creators to authenticated;
grant TRUNCATE on table public.creators to authenticated;
grant REFERENCES on table public.creators to authenticated;
grant TRIGGER on table public.creators to authenticated;
grant INSERT on table public.creators to service_role;
grant SELECT on table public.creators to service_role;
grant UPDATE on table public.creators to service_role;
grant DELETE on table public.creators to service_role;
grant TRUNCATE on table public.creators to service_role;
grant REFERENCES on table public.creators to service_role;
grant TRIGGER on table public.creators to service_role;
grant INSERT on table public.creator_posts to anon;
grant SELECT on table public.creator_posts to anon;
grant UPDATE on table public.creator_posts to anon;
grant DELETE on table public.creator_posts to anon;
grant TRUNCATE on table public.creator_posts to anon;
grant REFERENCES on table public.creator_posts to anon;
grant TRIGGER on table public.creator_posts to anon;
grant INSERT on table public.creator_posts to authenticated;
grant SELECT on table public.creator_posts to authenticated;
grant UPDATE on table public.creator_posts to authenticated;
grant DELETE on table public.creator_posts to authenticated;
grant TRUNCATE on table public.creator_posts to authenticated;
grant REFERENCES on table public.creator_posts to authenticated;
grant TRIGGER on table public.creator_posts to authenticated;
grant INSERT on table public.creator_posts to service_role;
grant SELECT on table public.creator_posts to service_role;
grant UPDATE on table public.creator_posts to service_role;
grant DELETE on table public.creator_posts to service_role;
grant TRUNCATE on table public.creator_posts to service_role;
grant REFERENCES on table public.creator_posts to service_role;
grant TRIGGER on table public.creator_posts to service_role;
grant INSERT on table public.graphic_sets to anon;
grant SELECT on table public.graphic_sets to anon;
grant UPDATE on table public.graphic_sets to anon;
grant DELETE on table public.graphic_sets to anon;
grant TRUNCATE on table public.graphic_sets to anon;
grant REFERENCES on table public.graphic_sets to anon;
grant TRIGGER on table public.graphic_sets to anon;
grant INSERT on table public.graphic_sets to authenticated;
grant SELECT on table public.graphic_sets to authenticated;
grant UPDATE on table public.graphic_sets to authenticated;
grant DELETE on table public.graphic_sets to authenticated;
grant TRUNCATE on table public.graphic_sets to authenticated;
grant REFERENCES on table public.graphic_sets to authenticated;
grant TRIGGER on table public.graphic_sets to authenticated;
grant INSERT on table public.graphic_sets to service_role;
grant SELECT on table public.graphic_sets to service_role;
grant UPDATE on table public.graphic_sets to service_role;
grant DELETE on table public.graphic_sets to service_role;
grant TRUNCATE on table public.graphic_sets to service_role;
grant REFERENCES on table public.graphic_sets to service_role;
grant TRIGGER on table public.graphic_sets to service_role;
grant INSERT on table public.email_sets to anon;
grant SELECT on table public.email_sets to anon;
grant UPDATE on table public.email_sets to anon;
grant DELETE on table public.email_sets to anon;
grant TRUNCATE on table public.email_sets to anon;
grant REFERENCES on table public.email_sets to anon;
grant TRIGGER on table public.email_sets to anon;
grant INSERT on table public.email_sets to authenticated;
grant SELECT on table public.email_sets to authenticated;
grant UPDATE on table public.email_sets to authenticated;
grant DELETE on table public.email_sets to authenticated;
grant TRUNCATE on table public.email_sets to authenticated;
grant REFERENCES on table public.email_sets to authenticated;
grant TRIGGER on table public.email_sets to authenticated;
grant INSERT on table public.email_sets to service_role;
grant SELECT on table public.email_sets to service_role;
grant UPDATE on table public.email_sets to service_role;
grant DELETE on table public.email_sets to service_role;
grant TRUNCATE on table public.email_sets to service_role;
grant REFERENCES on table public.email_sets to service_role;
grant TRIGGER on table public.email_sets to service_role;
grant INSERT on table public.graphic_kits to anon;
grant SELECT on table public.graphic_kits to anon;
grant UPDATE on table public.graphic_kits to anon;
grant DELETE on table public.graphic_kits to anon;
grant TRUNCATE on table public.graphic_kits to anon;
grant REFERENCES on table public.graphic_kits to anon;
grant TRIGGER on table public.graphic_kits to anon;
grant INSERT on table public.graphic_kits to authenticated;
grant SELECT on table public.graphic_kits to authenticated;
grant UPDATE on table public.graphic_kits to authenticated;
grant DELETE on table public.graphic_kits to authenticated;
grant TRUNCATE on table public.graphic_kits to authenticated;
grant REFERENCES on table public.graphic_kits to authenticated;
grant TRIGGER on table public.graphic_kits to authenticated;
grant INSERT on table public.graphic_kits to service_role;
grant SELECT on table public.graphic_kits to service_role;
grant UPDATE on table public.graphic_kits to service_role;
grant DELETE on table public.graphic_kits to service_role;
grant TRUNCATE on table public.graphic_kits to service_role;
grant REFERENCES on table public.graphic_kits to service_role;
grant TRIGGER on table public.graphic_kits to service_role;
grant INSERT on table public.morning_briefs to service_role;
grant SELECT on table public.morning_briefs to service_role;
grant UPDATE on table public.morning_briefs to service_role;
grant DELETE on table public.morning_briefs to service_role;
grant TRUNCATE on table public.morning_briefs to service_role;
grant REFERENCES on table public.morning_briefs to service_role;
grant TRIGGER on table public.morning_briefs to service_role;
grant SELECT on table public.morning_briefs to authenticated;
grant INSERT on table public.morning_suggestions to service_role;
grant SELECT on table public.morning_suggestions to service_role;
grant UPDATE on table public.morning_suggestions to service_role;
grant DELETE on table public.morning_suggestions to service_role;
grant TRUNCATE on table public.morning_suggestions to service_role;
grant REFERENCES on table public.morning_suggestions to service_role;
grant TRIGGER on table public.morning_suggestions to service_role;
grant SELECT on table public.morning_suggestions to authenticated;
grant SELECT on table public.content_learning_events_sequence_seq to anon;
grant UPDATE on table public.content_learning_events_sequence_seq to anon;
grant USAGE on table public.content_learning_events_sequence_seq to anon;
grant SELECT on table public.content_learning_events_sequence_seq to authenticated;
grant UPDATE on table public.content_learning_events_sequence_seq to authenticated;
grant USAGE on table public.content_learning_events_sequence_seq to authenticated;
grant SELECT on table public.content_learning_events_sequence_seq to service_role;
grant UPDATE on table public.content_learning_events_sequence_seq to service_role;
grant USAGE on table public.content_learning_events_sequence_seq to service_role;
grant INSERT on table public.content_learning_config to service_role;
grant SELECT on table public.content_learning_config to service_role;
grant UPDATE on table public.content_learning_config to service_role;
grant DELETE on table public.content_learning_config to service_role;
grant TRUNCATE on table public.content_learning_config to service_role;
grant REFERENCES on table public.content_learning_config to service_role;
grant TRIGGER on table public.content_learning_config to service_role;
grant SELECT on table public.content_learning_config to authenticated;
grant INSERT on table public.content_learning_events to service_role;
grant SELECT on table public.content_learning_events to service_role;
grant UPDATE on table public.content_learning_events to service_role;
grant DELETE on table public.content_learning_events to service_role;
grant TRUNCATE on table public.content_learning_events to service_role;
grant REFERENCES on table public.content_learning_events to service_role;
grant TRIGGER on table public.content_learning_events to service_role;
grant SELECT on table public.content_learning_events to authenticated;
grant INSERT on table public.content_learning_metrics to service_role;
grant SELECT on table public.content_learning_metrics to service_role;
grant UPDATE on table public.content_learning_metrics to service_role;
grant DELETE on table public.content_learning_metrics to service_role;
grant TRUNCATE on table public.content_learning_metrics to service_role;
grant REFERENCES on table public.content_learning_metrics to service_role;
grant TRIGGER on table public.content_learning_metrics to service_role;
grant SELECT on table public.content_learning_metrics to authenticated;
grant INSERT on table public.vault_notes to service_role;
grant SELECT on table public.vault_notes to service_role;
grant UPDATE on table public.vault_notes to service_role;
grant DELETE on table public.vault_notes to service_role;
grant TRUNCATE on table public.vault_notes to service_role;
grant REFERENCES on table public.vault_notes to service_role;
grant TRIGGER on table public.vault_notes to service_role;
grant SELECT on table public.vault_notes to authenticated;
grant INSERT on table public.program_versions to service_role;
grant SELECT on table public.program_versions to service_role;
grant UPDATE on table public.program_versions to service_role;
grant DELETE on table public.program_versions to service_role;
grant TRUNCATE on table public.program_versions to service_role;
grant REFERENCES on table public.program_versions to service_role;
grant TRIGGER on table public.program_versions to service_role;
grant SELECT on table public.program_versions to authenticated;
grant INSERT on table public.programs to service_role;
grant SELECT on table public.programs to service_role;
grant UPDATE on table public.programs to service_role;
grant DELETE on table public.programs to service_role;
grant TRUNCATE on table public.programs to service_role;
grant REFERENCES on table public.programs to service_role;
grant TRIGGER on table public.programs to service_role;
grant SELECT on table public.programs to authenticated;
grant INSERT on table public.program_proposals to service_role;
grant SELECT on table public.program_proposals to service_role;
grant UPDATE on table public.program_proposals to service_role;
grant DELETE on table public.program_proposals to service_role;
grant TRUNCATE on table public.program_proposals to service_role;
grant REFERENCES on table public.program_proposals to service_role;
grant TRIGGER on table public.program_proposals to service_role;
grant SELECT on table public.program_proposals to authenticated;
grant INSERT on table public.program_materials to service_role;
grant SELECT on table public.program_materials to service_role;
grant UPDATE on table public.program_materials to service_role;
grant DELETE on table public.program_materials to service_role;
grant TRUNCATE on table public.program_materials to service_role;
grant REFERENCES on table public.program_materials to service_role;
grant TRIGGER on table public.program_materials to service_role;
grant SELECT on table public.program_materials to authenticated;
grant INSERT on table public.custom_connections to service_role;
grant SELECT on table public.custom_connections to service_role;
grant UPDATE on table public.custom_connections to service_role;
grant DELETE on table public.custom_connections to service_role;
grant TRUNCATE on table public.custom_connections to service_role;
grant REFERENCES on table public.custom_connections to service_role;
grant TRIGGER on table public.custom_connections to service_role;
grant SELECT on table public.custom_connections to authenticated;
grant INSERT on table public.custom_connection_runs to service_role;
grant SELECT on table public.custom_connection_runs to service_role;
grant UPDATE on table public.custom_connection_runs to service_role;
grant DELETE on table public.custom_connection_runs to service_role;
grant TRUNCATE on table public.custom_connection_runs to service_role;
grant REFERENCES on table public.custom_connection_runs to service_role;
grant TRIGGER on table public.custom_connection_runs to service_role;
grant SELECT on table public.custom_connection_runs to authenticated;
grant INSERT on table public.founder_strategy to service_role;
grant SELECT on table public.founder_strategy to service_role;
grant UPDATE on table public.founder_strategy to service_role;
grant DELETE on table public.founder_strategy to service_role;
grant TRUNCATE on table public.founder_strategy to service_role;
grant REFERENCES on table public.founder_strategy to service_role;
grant TRIGGER on table public.founder_strategy to service_role;
grant SELECT on table public.founder_strategy to authenticated;
grant INSERT on table public.chat_messages to anon;
grant SELECT on table public.chat_messages to anon;
grant UPDATE on table public.chat_messages to anon;
grant DELETE on table public.chat_messages to anon;
grant TRUNCATE on table public.chat_messages to anon;
grant REFERENCES on table public.chat_messages to anon;
grant TRIGGER on table public.chat_messages to anon;
grant INSERT on table public.chat_messages to authenticated;
grant SELECT on table public.chat_messages to authenticated;
grant UPDATE on table public.chat_messages to authenticated;
grant DELETE on table public.chat_messages to authenticated;
grant TRUNCATE on table public.chat_messages to authenticated;
grant REFERENCES on table public.chat_messages to authenticated;
grant TRIGGER on table public.chat_messages to authenticated;
grant INSERT on table public.chat_messages to service_role;
grant SELECT on table public.chat_messages to service_role;
grant UPDATE on table public.chat_messages to service_role;
grant DELETE on table public.chat_messages to service_role;
grant TRUNCATE on table public.chat_messages to service_role;
grant REFERENCES on table public.chat_messages to service_role;
grant TRIGGER on table public.chat_messages to service_role;
grant INSERT on table public.founder_agents to service_role;
grant SELECT on table public.founder_agents to service_role;
grant UPDATE on table public.founder_agents to service_role;
grant DELETE on table public.founder_agents to service_role;
grant TRUNCATE on table public.founder_agents to service_role;
grant REFERENCES on table public.founder_agents to service_role;
grant TRIGGER on table public.founder_agents to service_role;
grant SELECT on table public.founder_agents to authenticated;
grant INSERT on table public.recurring_tasks to service_role;
grant SELECT on table public.recurring_tasks to service_role;
grant UPDATE on table public.recurring_tasks to service_role;
grant DELETE on table public.recurring_tasks to service_role;
grant TRUNCATE on table public.recurring_tasks to service_role;
grant REFERENCES on table public.recurring_tasks to service_role;
grant TRIGGER on table public.recurring_tasks to service_role;
grant SELECT on table public.recurring_tasks to authenticated;
grant INSERT on table public.agent_runs to service_role;
grant SELECT on table public.agent_runs to service_role;
grant UPDATE on table public.agent_runs to service_role;
grant DELETE on table public.agent_runs to service_role;
grant TRUNCATE on table public.agent_runs to service_role;
grant REFERENCES on table public.agent_runs to service_role;
grant TRIGGER on table public.agent_runs to service_role;
grant SELECT on table public.agent_runs to authenticated;
grant INSERT on table public.agent_proposals to service_role;
grant SELECT on table public.agent_proposals to service_role;
grant UPDATE on table public.agent_proposals to service_role;
grant DELETE on table public.agent_proposals to service_role;
grant TRUNCATE on table public.agent_proposals to service_role;
grant REFERENCES on table public.agent_proposals to service_role;
grant TRIGGER on table public.agent_proposals to service_role;
grant SELECT on table public.agent_proposals to authenticated;
grant INSERT on table public.video_exports to service_role;
grant SELECT on table public.video_exports to service_role;
grant UPDATE on table public.video_exports to service_role;
grant DELETE on table public.video_exports to service_role;
grant TRUNCATE on table public.video_exports to service_role;
grant REFERENCES on table public.video_exports to service_role;
grant TRIGGER on table public.video_exports to service_role;
grant SELECT on table public.video_exports to authenticated;
grant SELECT on table public.coach_chunks_id_seq to anon;
grant UPDATE on table public.coach_chunks_id_seq to anon;
grant USAGE on table public.coach_chunks_id_seq to anon;
grant SELECT on table public.coach_chunks_id_seq to authenticated;
grant UPDATE on table public.coach_chunks_id_seq to authenticated;
grant USAGE on table public.coach_chunks_id_seq to authenticated;
grant SELECT on table public.coach_chunks_id_seq to service_role;
grant UPDATE on table public.coach_chunks_id_seq to service_role;
grant USAGE on table public.coach_chunks_id_seq to service_role;
grant INSERT on table public.coach_playbook to service_role;
grant SELECT on table public.coach_playbook to service_role;
grant UPDATE on table public.coach_playbook to service_role;
grant DELETE on table public.coach_playbook to service_role;
grant TRUNCATE on table public.coach_playbook to service_role;
grant REFERENCES on table public.coach_playbook to service_role;
grant TRIGGER on table public.coach_playbook to service_role;
grant INSERT on table public.coach_sources to service_role;
grant SELECT on table public.coach_sources to service_role;
grant UPDATE on table public.coach_sources to service_role;
grant DELETE on table public.coach_sources to service_role;
grant TRUNCATE on table public.coach_sources to service_role;
grant REFERENCES on table public.coach_sources to service_role;
grant TRIGGER on table public.coach_sources to service_role;
grant INSERT on table public.coach_chunks to service_role;
grant SELECT on table public.coach_chunks to service_role;
grant UPDATE on table public.coach_chunks to service_role;
grant DELETE on table public.coach_chunks to service_role;
grant TRUNCATE on table public.coach_chunks to service_role;
grant REFERENCES on table public.coach_chunks to service_role;
grant TRIGGER on table public.coach_chunks to service_role;
grant INSERT on table public.coach_usage to service_role;
grant SELECT on table public.coach_usage to service_role;
grant UPDATE on table public.coach_usage to service_role;
grant DELETE on table public.coach_usage to service_role;
grant TRUNCATE on table public.coach_usage to service_role;
grant REFERENCES on table public.coach_usage to service_role;
grant TRIGGER on table public.coach_usage to service_role;
grant INSERT on table public.tella_edits to service_role;
grant SELECT on table public.tella_edits to service_role;
grant UPDATE on table public.tella_edits to service_role;
grant DELETE on table public.tella_edits to service_role;
grant TRUNCATE on table public.tella_edits to service_role;
grant REFERENCES on table public.tella_edits to service_role;
grant TRIGGER on table public.tella_edits to service_role;
grant SELECT on table public.tella_edits to authenticated;
grant INSERT on table public.tella_approvals to service_role;
grant SELECT on table public.tella_approvals to service_role;
grant UPDATE on table public.tella_approvals to service_role;
grant DELETE on table public.tella_approvals to service_role;
grant TRUNCATE on table public.tella_approvals to service_role;
grant REFERENCES on table public.tella_approvals to service_role;
grant TRIGGER on table public.tella_approvals to service_role;
grant SELECT on table public.tella_approvals to authenticated;
grant INSERT on table public.funnel_builds to anon;
grant SELECT on table public.funnel_builds to anon;
grant UPDATE on table public.funnel_builds to anon;
grant DELETE on table public.funnel_builds to anon;
grant TRUNCATE on table public.funnel_builds to anon;
grant REFERENCES on table public.funnel_builds to anon;
grant TRIGGER on table public.funnel_builds to anon;
grant INSERT on table public.funnel_builds to authenticated;
grant SELECT on table public.funnel_builds to authenticated;
grant UPDATE on table public.funnel_builds to authenticated;
grant DELETE on table public.funnel_builds to authenticated;
grant TRUNCATE on table public.funnel_builds to authenticated;
grant REFERENCES on table public.funnel_builds to authenticated;
grant TRIGGER on table public.funnel_builds to authenticated;
grant INSERT on table public.funnel_builds to service_role;
grant SELECT on table public.funnel_builds to service_role;
grant UPDATE on table public.funnel_builds to service_role;
grant DELETE on table public.funnel_builds to service_role;
grant TRUNCATE on table public.funnel_builds to service_role;
grant REFERENCES on table public.funnel_builds to service_role;
grant TRIGGER on table public.funnel_builds to service_role;
grant INSERT on table public.grok_tasks to anon;
grant SELECT on table public.grok_tasks to anon;
grant UPDATE on table public.grok_tasks to anon;
grant DELETE on table public.grok_tasks to anon;
grant TRUNCATE on table public.grok_tasks to anon;
grant REFERENCES on table public.grok_tasks to anon;
grant TRIGGER on table public.grok_tasks to anon;
grant INSERT on table public.grok_tasks to authenticated;
grant SELECT on table public.grok_tasks to authenticated;
grant UPDATE on table public.grok_tasks to authenticated;
grant DELETE on table public.grok_tasks to authenticated;
grant TRUNCATE on table public.grok_tasks to authenticated;
grant REFERENCES on table public.grok_tasks to authenticated;
grant TRIGGER on table public.grok_tasks to authenticated;
grant INSERT on table public.grok_tasks to service_role;
grant SELECT on table public.grok_tasks to service_role;
grant UPDATE on table public.grok_tasks to service_role;
grant DELETE on table public.grok_tasks to service_role;
grant TRUNCATE on table public.grok_tasks to service_role;
grant REFERENCES on table public.grok_tasks to service_role;
grant TRIGGER on table public.grok_tasks to service_role;
grant INSERT on table public.team_agent_settings to authenticated;
grant SELECT on table public.team_agent_settings to authenticated;
grant UPDATE on table public.team_agent_settings to authenticated;
grant DELETE on table public.team_agent_settings to authenticated;
grant TRUNCATE on table public.team_agent_settings to authenticated;
grant REFERENCES on table public.team_agent_settings to authenticated;
grant TRIGGER on table public.team_agent_settings to authenticated;
grant INSERT on table public.team_agent_settings to service_role;
grant SELECT on table public.team_agent_settings to service_role;
grant UPDATE on table public.team_agent_settings to service_role;
grant DELETE on table public.team_agent_settings to service_role;
grant TRUNCATE on table public.team_agent_settings to service_role;
grant REFERENCES on table public.team_agent_settings to service_role;
grant TRIGGER on table public.team_agent_settings to service_role;
grant SELECT on table public.mcp_changes to anon;
grant TRUNCATE on table public.mcp_changes to anon;
grant REFERENCES on table public.mcp_changes to anon;
grant TRIGGER on table public.mcp_changes to anon;
grant SELECT on table public.mcp_changes to authenticated;
grant TRUNCATE on table public.mcp_changes to authenticated;
grant REFERENCES on table public.mcp_changes to authenticated;
grant TRIGGER on table public.mcp_changes to authenticated;
grant INSERT on table public.mcp_changes to service_role;
grant SELECT on table public.mcp_changes to service_role;
grant UPDATE on table public.mcp_changes to service_role;
grant DELETE on table public.mcp_changes to service_role;
grant TRUNCATE on table public.mcp_changes to service_role;
grant REFERENCES on table public.mcp_changes to service_role;
grant TRIGGER on table public.mcp_changes to service_role;
grant INSERT on table public.content_funnel to service_role;
grant SELECT on table public.content_funnel to service_role;
grant UPDATE on table public.content_funnel to service_role;
grant DELETE on table public.content_funnel to service_role;
grant TRUNCATE on table public.content_funnel to service_role;
grant REFERENCES on table public.content_funnel to service_role;
grant TRIGGER on table public.content_funnel to service_role;
grant INSERT on table public.content_funnel to authenticated;
grant SELECT on table public.content_funnel to authenticated;
grant UPDATE on table public.content_funnel to authenticated;
grant DELETE on table public.content_funnel to authenticated;

grant usage on schema private to authenticated;


revoke all on function public.mcp_fact_propose(p_hash text, p_category text, p_statement text, p_evidence text, p_client text) from public, anon, authenticated; grant execute on function public.mcp_fact_propose(p_hash text, p_category text, p_statement text, p_evidence text, p_client text) to anon; grant execute on function public.mcp_fact_propose(p_hash text, p_category text, p_statement text, p_evidence text, p_client text) to authenticated; grant execute on function public.mcp_fact_propose(p_hash text, p_category text, p_statement text, p_evidence text, p_client text) to service_role;
revoke all on function public.mcp_memory_add(p_hash text, p_kind text, p_text text, p_due date, p_meta jsonb) from public, anon, authenticated; grant execute on function public.mcp_memory_add(p_hash text, p_kind text, p_text text, p_due date, p_meta jsonb) to anon; grant execute on function public.mcp_memory_add(p_hash text, p_kind text, p_text text, p_due date, p_meta jsonb) to authenticated; grant execute on function public.mcp_memory_add(p_hash text, p_kind text, p_text text, p_due date, p_meta jsonb) to service_role;
revoke all on function public.mcp_memory_set_status(p_hash text, p_id uuid, p_status text) from public, anon, authenticated; grant execute on function public.mcp_memory_set_status(p_hash text, p_id uuid, p_status text) to anon; grant execute on function public.mcp_memory_set_status(p_hash text, p_id uuid, p_status text) to authenticated; grant execute on function public.mcp_memory_set_status(p_hash text, p_id uuid, p_status text) to service_role;
revoke all on function public.dna_rebuild(p_ws uuid) from public, anon, authenticated; grant execute on function public.dna_rebuild(p_ws uuid) to anon; grant execute on function public.dna_rebuild(p_ws uuid) to authenticated; grant execute on function public.dna_rebuild(p_ws uuid) to service_role;
revoke all on function public.cron_workspaces(p_secret text) from public, anon, authenticated; grant execute on function public.cron_workspaces(p_secret text) to anon; grant execute on function public.cron_workspaces(p_secret text) to authenticated; grant execute on function public.cron_workspaces(p_secret text) to service_role;
revoke all on function private.content_learning_number(p_value text) from public, anon, authenticated;
revoke all on function private.content_learning_text(p_title text, p_meta jsonb) from public, anon, authenticated;
revoke all on function private.content_learning_capture() from public, anon, authenticated;
revoke all on function public.connection_secret(p_ws uuid, p_provider text) from public, anon, authenticated; grant execute on function public.connection_secret(p_ws uuid, p_provider text) to authenticated; grant execute on function public.connection_secret(p_ws uuid, p_provider text) to service_role;
revoke all on function public.connection_remove(p_ws uuid, p_provider text) from public, anon, authenticated; grant execute on function public.connection_remove(p_ws uuid, p_provider text) to authenticated; grant execute on function public.connection_remove(p_ws uuid, p_provider text) to service_role;
revoke all on function public.connection_meta(p_ws uuid, p_provider text, p_meta jsonb) from public, anon, authenticated; grant execute on function public.connection_meta(p_ws uuid, p_provider text, p_meta jsonb) to authenticated; grant execute on function public.connection_meta(p_ws uuid, p_provider text, p_meta jsonb) to service_role;
revoke all on function public.cron_meta(p_secret text, p_ws uuid, p_provider text, p_meta jsonb, p_status text) from public, anon, authenticated; grant execute on function public.cron_meta(p_secret text, p_ws uuid, p_provider text, p_meta jsonb, p_status text) to anon; grant execute on function public.cron_meta(p_secret text, p_ws uuid, p_provider text, p_meta jsonb, p_status text) to authenticated; grant execute on function public.cron_meta(p_secret text, p_ws uuid, p_provider text, p_meta jsonb, p_status text) to service_role;
revoke all on function public.mcp_brain_search(p_hash text, p_q text, p_limit integer) from public, anon, authenticated; grant execute on function public.mcp_brain_search(p_hash text, p_q text, p_limit integer) to anon; grant execute on function public.mcp_brain_search(p_hash text, p_q text, p_limit integer) to authenticated; grant execute on function public.mcp_brain_search(p_hash text, p_q text, p_limit integer) to service_role;
revoke all on function public.mcp_brain_profile(p_hash text) from public, anon, authenticated; grant execute on function public.mcp_brain_profile(p_hash text) to anon; grant execute on function public.mcp_brain_profile(p_hash text) to authenticated; grant execute on function public.mcp_brain_profile(p_hash text) to service_role;
revoke all on function public.mcp_brain_facts(p_hash text) from public, anon, authenticated; grant execute on function public.mcp_brain_facts(p_hash text) to anon; grant execute on function public.mcp_brain_facts(p_hash text) to authenticated; grant execute on function public.mcp_brain_facts(p_hash text) to service_role;
revoke all on function public.dna_sync_save(p_ws uuid, p_items jsonb, p_kinds text[]) from public, anon, authenticated; grant execute on function public.dna_sync_save(p_ws uuid, p_items jsonb, p_kinds text[]) to anon; grant execute on function public.dna_sync_save(p_ws uuid, p_items jsonb, p_kinds text[]) to authenticated; grant execute on function public.dna_sync_save(p_ws uuid, p_items jsonb, p_kinds text[]) to service_role;
revoke all on function private.is_member(ws uuid) from public, anon, authenticated; grant execute on function private.is_member(ws uuid) to authenticated;
revoke all on function public.touch_updated_at() from public, anon, authenticated; grant execute on function public.touch_updated_at() to public; grant execute on function public.touch_updated_at() to anon; grant execute on function public.touch_updated_at() to authenticated; grant execute on function public.touch_updated_at() to service_role;
revoke all on function public.handle_new_user() from public, anon, authenticated; grant execute on function public.handle_new_user() to service_role;
revoke all on function public.cron_funnel_assets(p_secret text, p_id uuid) from public, anon, authenticated; grant execute on function public.cron_funnel_assets(p_secret text, p_id uuid) to anon; grant execute on function public.cron_funnel_assets(p_secret text, p_id uuid) to authenticated; grant execute on function public.cron_funnel_assets(p_secret text, p_id uuid) to service_role;
revoke all on function public.cron_funnel_secret(p_secret text, p_ws uuid, p_provider text) from public, anon, authenticated; grant execute on function public.cron_funnel_secret(p_secret text, p_ws uuid, p_provider text) to anon; grant execute on function public.cron_funnel_secret(p_secret text, p_ws uuid, p_provider text) to authenticated; grant execute on function public.cron_funnel_secret(p_secret text, p_ws uuid, p_provider text) to service_role;
revoke all on function public.mcp_proven(p_hash text, p_limit integer) from public, anon, authenticated; grant execute on function public.mcp_proven(p_hash text, p_limit integer) to anon; grant execute on function public.mcp_proven(p_hash text, p_limit integer) to authenticated; grant execute on function public.mcp_proven(p_hash text, p_limit integer) to service_role;
revoke all on function public.mcp_connections(p_hash text) from public, anon, authenticated; grant execute on function public.mcp_connections(p_hash text) to anon; grant execute on function public.mcp_connections(p_hash text) to authenticated; grant execute on function public.mcp_connections(p_hash text) to service_role;
revoke all on function public.mcp_memory(p_hash text, p_kind text, p_status text, p_query text, p_limit integer) from public, anon, authenticated; grant execute on function public.mcp_memory(p_hash text, p_kind text, p_status text, p_query text, p_limit integer) to anon; grant execute on function public.mcp_memory(p_hash text, p_kind text, p_status text, p_query text, p_limit integer) to authenticated; grant execute on function public.mcp_memory(p_hash text, p_kind text, p_status text, p_query text, p_limit integer) to service_role;
revoke all on function public.mcp_draft_add(p_hash text, p_kind text, p_title text, p_body text, p_stream text, p_action text, p_source text) from public, anon, authenticated; grant execute on function public.mcp_draft_add(p_hash text, p_kind text, p_title text, p_body text, p_stream text, p_action text, p_source text) to anon; grant execute on function public.mcp_draft_add(p_hash text, p_kind text, p_title text, p_body text, p_stream text, p_action text, p_source text) to authenticated; grant execute on function public.mcp_draft_add(p_hash text, p_kind text, p_title text, p_body text, p_stream text, p_action text, p_source text) to service_role;
revoke all on function public.mcp_drafts(p_hash text, p_status text) from public, anon, authenticated; grant execute on function public.mcp_drafts(p_hash text, p_status text) to anon; grant execute on function public.mcp_drafts(p_hash text, p_status text) to authenticated; grant execute on function public.mcp_drafts(p_hash text, p_status text) to service_role;
revoke all on function public.mcp_whoami(p_hash text, p_client text) from public, anon, authenticated; grant execute on function public.mcp_whoami(p_hash text, p_client text) to anon; grant execute on function public.mcp_whoami(p_hash text, p_client text) to authenticated; grant execute on function public.mcp_whoami(p_hash text, p_client text) to service_role;
revoke all on function public.mcp_creator_posts(p_hash text, p_platform text, p_format text, p_min_views bigint, p_creator text, p_limit integer) from public, anon, authenticated; grant execute on function public.mcp_creator_posts(p_hash text, p_platform text, p_format text, p_min_views bigint, p_creator text, p_limit integer) to public; grant execute on function public.mcp_creator_posts(p_hash text, p_platform text, p_format text, p_min_views bigint, p_creator text, p_limit integer) to anon; grant execute on function public.mcp_creator_posts(p_hash text, p_platform text, p_format text, p_min_views bigint, p_creator text, p_limit integer) to authenticated; grant execute on function public.mcp_creator_posts(p_hash text, p_platform text, p_format text, p_min_views bigint, p_creator text, p_limit integer) to service_role;
revoke all on function public.mcp_research(p_hash text, p_preset text, p_limit integer) from public, anon, authenticated; grant execute on function public.mcp_research(p_hash text, p_preset text, p_limit integer) to public; grant execute on function public.mcp_research(p_hash text, p_preset text, p_limit integer) to anon; grant execute on function public.mcp_research(p_hash text, p_preset text, p_limit integer) to authenticated; grant execute on function public.mcp_research(p_hash text, p_preset text, p_limit integer) to service_role;
revoke all on function public.inbox_account_secret(p_account uuid) from public, anon, authenticated; grant execute on function public.inbox_account_secret(p_account uuid) to authenticated; grant execute on function public.inbox_account_secret(p_account uuid) to service_role;
revoke all on function public.cron_funnel_asset_put(p_secret text, p_id uuid, p_name text, p_mime text, p_data text) from public, anon, authenticated; grant execute on function public.cron_funnel_asset_put(p_secret text, p_id uuid, p_name text, p_mime text, p_data text) to anon; grant execute on function public.cron_funnel_asset_put(p_secret text, p_id uuid, p_name text, p_mime text, p_data text) to authenticated; grant execute on function public.cron_funnel_asset_put(p_secret text, p_id uuid, p_name text, p_mime text, p_data text) to service_role;
revoke all on function public.inbox_hook_ingest(p_account uuid, p_key text, p_rows jsonb) from public, anon, authenticated; grant execute on function public.inbox_hook_ingest(p_account uuid, p_key text, p_rows jsonb) to anon; grant execute on function public.inbox_hook_ingest(p_account uuid, p_key text, p_rows jsonb) to authenticated; grant execute on function public.inbox_hook_ingest(p_account uuid, p_key text, p_rows jsonb) to service_role;
revoke all on function public.inbox_account_save(p_ws uuid, p_kind text, p_address text, p_label text, p_cipher text, p_meta jsonb, p_hook_hash text) from public, anon, authenticated; grant execute on function public.inbox_account_save(p_ws uuid, p_kind text, p_address text, p_label text, p_cipher text, p_meta jsonb, p_hook_hash text) to authenticated; grant execute on function public.inbox_account_save(p_ws uuid, p_kind text, p_address text, p_label text, p_cipher text, p_meta jsonb, p_hook_hash text) to service_role;
revoke all on function private.mcp_auth(p_hash text, p_client text) from public, anon, authenticated;
revoke all on function public.admin_access_list() from public, anon, authenticated; grant execute on function public.admin_access_list() to authenticated; grant execute on function public.admin_access_list() to service_role;
revoke all on function public.admin_access_set(p_user uuid, p_status text) from public, anon, authenticated; grant execute on function public.admin_access_set(p_user uuid, p_status text) to authenticated; grant execute on function public.admin_access_set(p_user uuid, p_status text) to service_role;
revoke all on function public.connection_save(p_ws uuid, p_provider text, p_cipher text, p_label text, p_meta jsonb) from public, anon, authenticated; grant execute on function public.connection_save(p_ws uuid, p_provider text, p_cipher text, p_label text, p_meta jsonb) to authenticated; grant execute on function public.connection_save(p_ws uuid, p_provider text, p_cipher text, p_label text, p_meta jsonb) to service_role;
revoke all on function public.connection_status(p_ws uuid, p_provider text, p_status text, p_meta jsonb) from public, anon, authenticated; grant execute on function public.connection_status(p_ws uuid, p_provider text, p_status text, p_meta jsonb) to public; grant execute on function public.connection_status(p_ws uuid, p_provider text, p_status text, p_meta jsonb) to anon; grant execute on function public.connection_status(p_ws uuid, p_provider text, p_status text, p_meta jsonb) to authenticated; grant execute on function public.connection_status(p_ws uuid, p_provider text, p_status text, p_meta jsonb) to service_role;
revoke all on function public.connection_hook_set(p_ws uuid, p_provider text, p_hash text) from public, anon, authenticated; grant execute on function public.connection_hook_set(p_ws uuid, p_provider text, p_hash text) to public; grant execute on function public.connection_hook_set(p_ws uuid, p_provider text, p_hash text) to anon; grant execute on function public.connection_hook_set(p_ws uuid, p_provider text, p_hash text) to authenticated; grant execute on function public.connection_hook_set(p_ws uuid, p_provider text, p_hash text) to service_role;
revoke all on function public.cron_connections(p_secret text) from public, anon, authenticated; grant execute on function public.cron_connections(p_secret text) to anon; grant execute on function public.cron_connections(p_secret text) to authenticated; grant execute on function public.cron_connections(p_secret text) to service_role;
revoke all on function public.connection_hook_ingest(p_ws uuid, p_provider text, p_key text, p_event jsonb) from public, anon, authenticated; grant execute on function public.connection_hook_ingest(p_ws uuid, p_provider text, p_key text, p_event jsonb) to anon; grant execute on function public.connection_hook_ingest(p_ws uuid, p_provider text, p_key text, p_event jsonb) to authenticated; grant execute on function public.connection_hook_ingest(p_ws uuid, p_provider text, p_key text, p_event jsonb) to service_role;
revoke all on function public.cron_reseal(p_secret text, p_ws uuid, p_provider text, p_cipher text) from public, anon, authenticated; grant execute on function public.cron_reseal(p_secret text, p_ws uuid, p_provider text, p_cipher text) to anon; grant execute on function public.cron_reseal(p_secret text, p_ws uuid, p_provider text, p_cipher text) to authenticated; grant execute on function public.cron_reseal(p_secret text, p_ws uuid, p_provider text, p_cipher text) to service_role;
revoke all on function public.connection_reseal(p_ws uuid, p_provider text, p_cipher text) from public, anon, authenticated; grant execute on function public.connection_reseal(p_ws uuid, p_provider text, p_cipher text) to public; grant execute on function public.connection_reseal(p_ws uuid, p_provider text, p_cipher text) to anon; grant execute on function public.connection_reseal(p_ws uuid, p_provider text, p_cipher text) to authenticated; grant execute on function public.connection_reseal(p_ws uuid, p_provider text, p_cipher text) to service_role;
revoke all on function public.brain_search(p_ws uuid, p_q text, p_limit integer) from public, anon, authenticated; grant execute on function public.brain_search(p_ws uuid, p_q text, p_limit integer) to public; grant execute on function public.brain_search(p_ws uuid, p_q text, p_limit integer) to anon; grant execute on function public.brain_search(p_ws uuid, p_q text, p_limit integer) to authenticated; grant execute on function public.brain_search(p_ws uuid, p_q text, p_limit integer) to service_role;
revoke all on function public.cron_workspace(p_secret text, p_ws uuid) from public, anon, authenticated; grant execute on function public.cron_workspace(p_secret text, p_ws uuid) to anon; grant execute on function public.cron_workspace(p_secret text, p_ws uuid) to authenticated; grant execute on function public.cron_workspace(p_secret text, p_ws uuid) to service_role;
revoke all on function public.proven_content(p_ws uuid, p_limit integer, p_min numeric) from public, anon, authenticated; grant execute on function public.proven_content(p_ws uuid, p_limit integer, p_min numeric) to anon; grant execute on function public.proven_content(p_ws uuid, p_limit integer, p_min numeric) to authenticated; grant execute on function public.proven_content(p_ws uuid, p_limit integer, p_min numeric) to service_role;
revoke all on function public.cron_dna_save(p_secret text, p_ws uuid, p_items jsonb, p_kinds text[]) from public, anon, authenticated; grant execute on function public.cron_dna_save(p_secret text, p_ws uuid, p_items jsonb, p_kinds text[]) to anon; grant execute on function public.cron_dna_save(p_secret text, p_ws uuid, p_items jsonb, p_kinds text[]) to authenticated; grant execute on function public.cron_dna_save(p_secret text, p_ws uuid, p_items jsonb, p_kinds text[]) to service_role;
revoke all on function public.mcp_brand_dna(p_hash text) from public, anon, authenticated; grant execute on function public.mcp_brand_dna(p_hash text) to anon; grant execute on function public.mcp_brand_dna(p_hash text) to authenticated; grant execute on function public.mcp_brand_dna(p_hash text) to service_role;
revoke all on function private.chat_query(p_q text) from public, anon, authenticated;
revoke all on function private.chat_search(p_ws uuid, p_q text, p_kinds text[], p_limit integer) from public, anon, authenticated;
revoke all on function public.cron_goal_inputs(p_secret text, p_ws uuid) from public, anon, authenticated; grant execute on function public.cron_goal_inputs(p_secret text, p_ws uuid) to anon; grant execute on function public.cron_goal_inputs(p_secret text, p_ws uuid) to authenticated; grant execute on function public.cron_goal_inputs(p_secret text, p_ws uuid) to service_role;
revoke all on function public.cron_goal_save(p_secret text, p_ws uuid, p_id uuid, p_meta jsonb) from public, anon, authenticated; grant execute on function public.cron_goal_save(p_secret text, p_ws uuid, p_id uuid, p_meta jsonb) to anon; grant execute on function public.cron_goal_save(p_secret text, p_ws uuid, p_id uuid, p_meta jsonb) to authenticated; grant execute on function public.cron_goal_save(p_secret text, p_ws uuid, p_id uuid, p_meta jsonb) to service_role;
revoke all on function public.chat_search(p_ws uuid, p_q text, p_kinds text[], p_limit integer) from public, anon, authenticated; grant execute on function public.chat_search(p_ws uuid, p_q text, p_kinds text[], p_limit integer) to anon; grant execute on function public.chat_search(p_ws uuid, p_q text, p_kinds text[], p_limit integer) to authenticated; grant execute on function public.chat_search(p_ws uuid, p_q text, p_kinds text[], p_limit integer) to service_role;
revoke all on function public.chat_sources(p_ws uuid) from public, anon, authenticated; grant execute on function public.chat_sources(p_ws uuid) to anon; grant execute on function public.chat_sources(p_ws uuid) to authenticated; grant execute on function public.chat_sources(p_ws uuid) to service_role;
revoke all on function public.mcp_search(p_hash text, p_q text, p_kinds text[], p_limit integer) from public, anon, authenticated; grant execute on function public.mcp_search(p_hash text, p_q text, p_kinds text[], p_limit integer) to anon; grant execute on function public.mcp_search(p_hash text, p_q text, p_kinds text[], p_limit integer) to authenticated; grant execute on function public.mcp_search(p_hash text, p_q text, p_kinds text[], p_limit integer) to service_role;
revoke all on function public.mcp_recordings(p_hash text, p_limit integer) from public, anon, authenticated; grant execute on function public.mcp_recordings(p_hash text, p_limit integer) to anon; grant execute on function public.mcp_recordings(p_hash text, p_limit integer) to authenticated; grant execute on function public.mcp_recordings(p_hash text, p_limit integer) to service_role;
revoke all on function private.recording_store(p_ws uuid, p_rec jsonb, p_chunks jsonb) from public, anon, authenticated;
revoke all on function public.recording_store(p_ws uuid, p_rec jsonb, p_chunks jsonb) from public, anon, authenticated; grant execute on function public.recording_store(p_ws uuid, p_rec jsonb, p_chunks jsonb) to anon; grant execute on function public.recording_store(p_ws uuid, p_rec jsonb, p_chunks jsonb) to authenticated; grant execute on function public.recording_store(p_ws uuid, p_rec jsonb, p_chunks jsonb) to service_role;
revoke all on function public.cron_recording_store(p_secret text, p_ws uuid, p_rec jsonb, p_chunks jsonb) from public, anon, authenticated; grant execute on function public.cron_recording_store(p_secret text, p_ws uuid, p_rec jsonb, p_chunks jsonb) to anon; grant execute on function public.cron_recording_store(p_secret text, p_ws uuid, p_rec jsonb, p_chunks jsonb) to authenticated; grant execute on function public.cron_recording_store(p_secret text, p_ws uuid, p_rec jsonb, p_chunks jsonb) to service_role;
revoke all on function public.cron_recording_known(p_secret text, p_ws uuid) from public, anon, authenticated; grant execute on function public.cron_recording_known(p_secret text, p_ws uuid) to anon; grant execute on function public.cron_recording_known(p_secret text, p_ws uuid) to authenticated; grant execute on function public.cron_recording_known(p_secret text, p_ws uuid) to service_role;
revoke all on function private.goal_inputs_for(p_ws uuid) from public, anon, authenticated;
revoke all on function public.goal_inputs(p_ws uuid) from public, anon, authenticated; grant execute on function public.goal_inputs(p_ws uuid) to anon; grant execute on function public.goal_inputs(p_ws uuid) to authenticated; grant execute on function public.goal_inputs(p_ws uuid) to service_role;
revoke all on function public.mcp_writing(p_hash text, p_limit integer) from public, anon, authenticated; grant execute on function public.mcp_writing(p_hash text, p_limit integer) to anon; grant execute on function public.mcp_writing(p_hash text, p_limit integer) to authenticated; grant execute on function public.mcp_writing(p_hash text, p_limit integer) to service_role;
revoke all on function public.affiliate_resolve(p_secret text, p_token text) from public, anon, authenticated; grant execute on function public.affiliate_resolve(p_secret text, p_token text) to anon; grant execute on function public.affiliate_resolve(p_secret text, p_token text) to authenticated; grant execute on function public.affiliate_resolve(p_secret text, p_token text) to service_role;
revoke all on function public.affiliate_log(p_secret text, p_ws uuid, p_e jsonb) from public, anon, authenticated; grant execute on function public.affiliate_log(p_secret text, p_ws uuid, p_e jsonb) to anon; grant execute on function public.affiliate_log(p_secret text, p_ws uuid, p_e jsonb) to authenticated; grant execute on function public.affiliate_log(p_secret text, p_ws uuid, p_e jsonb) to service_role;
revoke all on function public.affiliate_done(p_secret text, p_ws uuid, p_key text, p_contact text, p_tags text[], p_status text, p_note text) from public, anon, authenticated; grant execute on function public.affiliate_done(p_secret text, p_ws uuid, p_key text, p_contact text, p_tags text[], p_status text, p_note text) to anon; grant execute on function public.affiliate_done(p_secret text, p_ws uuid, p_key text, p_contact text, p_tags text[], p_status text, p_note text) to authenticated; grant execute on function public.affiliate_done(p_secret text, p_ws uuid, p_key text, p_contact text, p_tags text[], p_status text, p_note text) to service_role;
revoke all on function public.affiliate_hook(p_ws uuid, p_rotate boolean, p_settings jsonb) from public, anon, authenticated; grant execute on function public.affiliate_hook(p_ws uuid, p_rotate boolean, p_settings jsonb) to public; grant execute on function public.affiliate_hook(p_ws uuid, p_rotate boolean, p_settings jsonb) to anon; grant execute on function public.affiliate_hook(p_ws uuid, p_rotate boolean, p_settings jsonb) to authenticated; grant execute on function public.affiliate_hook(p_ws uuid, p_rotate boolean, p_settings jsonb) to service_role;
revoke all on function private.idea_inputs(p_ws uuid) from public, anon, authenticated;
revoke all on function public.idea_inputs(p_ws uuid) from public, anon, authenticated; grant execute on function public.idea_inputs(p_ws uuid) to anon; grant execute on function public.idea_inputs(p_ws uuid) to authenticated; grant execute on function public.idea_inputs(p_ws uuid) to service_role;
revoke all on function public.ideas_save(p_ws uuid, p_items jsonb) from public, anon, authenticated; grant execute on function public.ideas_save(p_ws uuid, p_items jsonb) to anon; grant execute on function public.ideas_save(p_ws uuid, p_items jsonb) to authenticated; grant execute on function public.ideas_save(p_ws uuid, p_items jsonb) to service_role;
revoke all on function public.cron_idea_inputs(p_secret text, p_ws uuid) from public, anon, authenticated; grant execute on function public.cron_idea_inputs(p_secret text, p_ws uuid) to anon; grant execute on function public.cron_idea_inputs(p_secret text, p_ws uuid) to authenticated; grant execute on function public.cron_idea_inputs(p_secret text, p_ws uuid) to service_role;
revoke all on function public.cron_ideas_save(p_secret text, p_ws uuid, p_items jsonb) from public, anon, authenticated; grant execute on function public.cron_ideas_save(p_secret text, p_ws uuid, p_items jsonb) to anon; grant execute on function public.cron_ideas_save(p_secret text, p_ws uuid, p_items jsonb) to authenticated; grant execute on function public.cron_ideas_save(p_secret text, p_ws uuid, p_items jsonb) to service_role;
revoke all on function private.ideas_save(p_ws uuid, p_items jsonb) from public, anon, authenticated;
revoke all on function public.cron_funnel_claim(p_secret text, p_id uuid, p_secs integer) from public, anon, authenticated; grant execute on function public.cron_funnel_claim(p_secret text, p_id uuid, p_secs integer) to anon; grant execute on function public.cron_funnel_claim(p_secret text, p_id uuid, p_secs integer) to authenticated; grant execute on function public.cron_funnel_claim(p_secret text, p_id uuid, p_secs integer) to service_role;
revoke all on function public.cron_funnel_get(p_secret text, p_id uuid) from public, anon, authenticated; grant execute on function public.cron_funnel_get(p_secret text, p_id uuid) to anon; grant execute on function public.cron_funnel_get(p_secret text, p_id uuid) to authenticated; grant execute on function public.cron_funnel_get(p_secret text, p_id uuid) to service_role;
revoke all on function public.cron_funnel_save(p_secret text, p_id uuid, p_patch jsonb) from public, anon, authenticated; grant execute on function public.cron_funnel_save(p_secret text, p_id uuid, p_patch jsonb) to anon; grant execute on function public.cron_funnel_save(p_secret text, p_id uuid, p_patch jsonb) to authenticated; grant execute on function public.cron_funnel_save(p_secret text, p_id uuid, p_patch jsonb) to service_role;
revoke all on function public.cron_funnel_inputs(p_secret text, p_ws uuid) from public, anon, authenticated; grant execute on function public.cron_funnel_inputs(p_secret text, p_ws uuid) to anon; grant execute on function public.cron_funnel_inputs(p_secret text, p_ws uuid) to authenticated; grant execute on function public.cron_funnel_inputs(p_secret text, p_ws uuid) to service_role;
revoke all on function public.funnel_preview(p_id uuid, p_key text) from public, anon, authenticated; grant execute on function public.funnel_preview(p_id uuid, p_key text) to anon; grant execute on function public.funnel_preview(p_id uuid, p_key text) to authenticated; grant execute on function public.funnel_preview(p_id uuid, p_key text) to service_role;
revoke all on function public.funnel_preview_asset(p_id uuid, p_key text, p_name text) from public, anon, authenticated; grant execute on function public.funnel_preview_asset(p_id uuid, p_key text, p_name text) to anon; grant execute on function public.funnel_preview_asset(p_id uuid, p_key text, p_name text) to authenticated; grant execute on function public.funnel_preview_asset(p_id uuid, p_key text, p_name text) to service_role;
revoke all on function public.mcp_funnels(p_hash text) from public, anon, authenticated; grant execute on function public.mcp_funnels(p_hash text) to anon; grant execute on function public.mcp_funnels(p_hash text) to authenticated; grant execute on function public.mcp_funnels(p_hash text) to service_role;
revoke all on function public.mcp_funnel_get(p_hash text, p_id uuid) from public, anon, authenticated; grant execute on function public.mcp_funnel_get(p_hash text, p_id uuid) to anon; grant execute on function public.mcp_funnel_get(p_hash text, p_id uuid) to authenticated; grant execute on function public.mcp_funnel_get(p_hash text, p_id uuid) to service_role;
revoke all on function public.gfx_kit(p_ws uuid) from public, anon, authenticated; grant execute on function public.gfx_kit(p_ws uuid) to anon; grant execute on function public.gfx_kit(p_ws uuid) to authenticated; grant execute on function public.gfx_kit(p_ws uuid) to service_role;
revoke all on function public.mcp_funnel_update(p_hash text, p_id uuid, p_html text, p_note text, p_preview_url text, p_source text) from public, anon, authenticated; grant execute on function public.mcp_funnel_update(p_hash text, p_id uuid, p_html text, p_note text, p_preview_url text, p_source text) to anon; grant execute on function public.mcp_funnel_update(p_hash text, p_id uuid, p_html text, p_note text, p_preview_url text, p_source text) to authenticated; grant execute on function public.mcp_funnel_update(p_hash text, p_id uuid, p_html text, p_note text, p_preview_url text, p_source text) to service_role;
revoke all on function public.gfx_unupload(p_ws uuid, p_name text) from public, anon, authenticated; grant execute on function public.gfx_unupload(p_ws uuid, p_name text) to anon; grant execute on function public.gfx_unupload(p_ws uuid, p_name text) to authenticated; grant execute on function public.gfx_unupload(p_ws uuid, p_name text) to service_role;
revoke all on function public.gfx_kit_save(p_ws uuid, p_patch jsonb) from public, anon, authenticated; grant execute on function public.gfx_kit_save(p_ws uuid, p_patch jsonb) to anon; grant execute on function public.gfx_kit_save(p_ws uuid, p_patch jsonb) to authenticated; grant execute on function public.gfx_kit_save(p_ws uuid, p_patch jsonb) to service_role;
revoke all on function public.gfx_upload(p_ws uuid, p_name text, p_mime text, p_data text) from public, anon, authenticated; grant execute on function public.gfx_upload(p_ws uuid, p_name text, p_mime text, p_data text) to anon; grant execute on function public.gfx_upload(p_ws uuid, p_name text, p_mime text, p_data text) to authenticated; grant execute on function public.gfx_upload(p_ws uuid, p_name text, p_mime text, p_data text) to service_role;
revoke all on function public.gfx_create(p_ws uuid, p_title text, p_format text, p_aspect text, p_model text, p_input jsonb) from public, anon, authenticated; grant execute on function public.gfx_create(p_ws uuid, p_title text, p_format text, p_aspect text, p_model text, p_input jsonb) to anon; grant execute on function public.gfx_create(p_ws uuid, p_title text, p_format text, p_aspect text, p_model text, p_input jsonb) to authenticated; grant execute on function public.gfx_create(p_ws uuid, p_title text, p_format text, p_aspect text, p_model text, p_input jsonb) to service_role;
revoke all on function public.gfx_asset(p_ws uuid, p_key text, p_name text) from public, anon, authenticated; grant execute on function public.gfx_asset(p_ws uuid, p_key text, p_name text) to anon; grant execute on function public.gfx_asset(p_ws uuid, p_key text, p_name text) to authenticated; grant execute on function public.gfx_asset(p_ws uuid, p_key text, p_name text) to service_role;
revoke all on function public.cron_gfx_claim(p_secret text, p_id uuid, p_secs integer) from public, anon, authenticated; grant execute on function public.cron_gfx_claim(p_secret text, p_id uuid, p_secs integer) to anon; grant execute on function public.cron_gfx_claim(p_secret text, p_id uuid, p_secs integer) to authenticated; grant execute on function public.cron_gfx_claim(p_secret text, p_id uuid, p_secs integer) to service_role;
revoke all on function public.cron_gfx_get(p_secret text, p_id uuid) from public, anon, authenticated; grant execute on function public.cron_gfx_get(p_secret text, p_id uuid) to anon; grant execute on function public.cron_gfx_get(p_secret text, p_id uuid) to authenticated; grant execute on function public.cron_gfx_get(p_secret text, p_id uuid) to service_role;
revoke all on function public.cron_calls_pending(p_secret text, p_ws uuid, p_limit integer, p_id uuid) from public, anon, authenticated; grant execute on function public.cron_calls_pending(p_secret text, p_ws uuid, p_limit integer, p_id uuid) to anon; grant execute on function public.cron_calls_pending(p_secret text, p_ws uuid, p_limit integer, p_id uuid) to authenticated; grant execute on function public.cron_calls_pending(p_secret text, p_ws uuid, p_limit integer, p_id uuid) to service_role;
revoke all on function public.cron_calls_status(p_secret text, p_ws uuid) from public, anon, authenticated; grant execute on function public.cron_calls_status(p_secret text, p_ws uuid) to anon; grant execute on function public.cron_calls_status(p_secret text, p_ws uuid) to authenticated; grant execute on function public.cron_calls_status(p_secret text, p_ws uuid) to service_role;
revoke all on function public.cron_calls_save(p_secret text, p_ws uuid, p_rec uuid, p_review jsonb, p_items jsonb, p_ideas jsonb, p_by uuid) from public, anon, authenticated; grant execute on function public.cron_calls_save(p_secret text, p_ws uuid, p_rec uuid, p_review jsonb, p_items jsonb, p_ideas jsonb, p_by uuid) to anon; grant execute on function public.cron_calls_save(p_secret text, p_ws uuid, p_rec uuid, p_review jsonb, p_items jsonb, p_ideas jsonb, p_by uuid) to authenticated; grant execute on function public.cron_calls_save(p_secret text, p_ws uuid, p_rec uuid, p_review jsonb, p_items jsonb, p_ideas jsonb, p_by uuid) to service_role;
revoke all on function public.cron_gfx_save(p_secret text, p_id uuid, p_patch jsonb) from public, anon, authenticated; grant execute on function public.cron_gfx_save(p_secret text, p_id uuid, p_patch jsonb) to anon; grant execute on function public.cron_gfx_save(p_secret text, p_id uuid, p_patch jsonb) to authenticated; grant execute on function public.cron_gfx_save(p_secret text, p_id uuid, p_patch jsonb) to service_role;
revoke all on function public.cron_gfx_slide(p_secret text, p_id uuid, p_i integer, p_slide jsonb) from public, anon, authenticated; grant execute on function public.cron_gfx_slide(p_secret text, p_id uuid, p_i integer, p_slide jsonb) to anon; grant execute on function public.cron_gfx_slide(p_secret text, p_id uuid, p_i integer, p_slide jsonb) to authenticated; grant execute on function public.cron_gfx_slide(p_secret text, p_id uuid, p_i integer, p_slide jsonb) to service_role;
revoke all on function public.cron_gfx_asset_put(p_secret text, p_ws uuid, p_set uuid, p_name text, p_mime text, p_data text) from public, anon, authenticated; grant execute on function public.cron_gfx_asset_put(p_secret text, p_ws uuid, p_set uuid, p_name text, p_mime text, p_data text) to anon; grant execute on function public.cron_gfx_asset_put(p_secret text, p_ws uuid, p_set uuid, p_name text, p_mime text, p_data text) to authenticated; grant execute on function public.cron_gfx_asset_put(p_secret text, p_ws uuid, p_set uuid, p_name text, p_mime text, p_data text) to service_role;
revoke all on function public.cron_gfx_asset_get(p_secret text, p_ws uuid, p_name text) from public, anon, authenticated; grant execute on function public.cron_gfx_asset_get(p_secret text, p_ws uuid, p_name text) to anon; grant execute on function public.cron_gfx_asset_get(p_secret text, p_ws uuid, p_name text) to authenticated; grant execute on function public.cron_gfx_asset_get(p_secret text, p_ws uuid, p_name text) to service_role;
revoke all on function public.cron_gfx_kit(p_secret text, p_ws uuid) from public, anon, authenticated; grant execute on function public.cron_gfx_kit(p_secret text, p_ws uuid) to anon; grant execute on function public.cron_gfx_kit(p_secret text, p_ws uuid) to authenticated; grant execute on function public.cron_gfx_kit(p_secret text, p_ws uuid) to service_role;
revoke all on function private.gfx_kit_row(p_ws uuid) from public, anon, authenticated;
revoke all on function private.calls_pending(p_ws uuid, p_limit integer, p_id uuid) from public, anon, authenticated;
revoke all on function private.calls_status(p_ws uuid) from public, anon, authenticated;
revoke all on function private.calls_save(p_ws uuid, p_rec uuid, p_review jsonb, p_items jsonb, p_ideas jsonb, p_by uuid) from public, anon, authenticated;
revoke all on function public.calls_status(p_ws uuid) from public, anon, authenticated; grant execute on function public.calls_status(p_ws uuid) to anon; grant execute on function public.calls_status(p_ws uuid) to authenticated; grant execute on function public.calls_status(p_ws uuid) to service_role;
revoke all on function public.mcp_agents(p_hash text) from public, anon, authenticated; grant execute on function public.mcp_agents(p_hash text) to anon; grant execute on function public.mcp_agents(p_hash text) to authenticated; grant execute on function public.mcp_agents(p_hash text) to service_role;
revoke all on function public.mcp_content(p_hash text, p_limit integer) from public, anon, authenticated; grant execute on function public.mcp_content(p_hash text, p_limit integer) to anon; grant execute on function public.mcp_content(p_hash text, p_limit integer) to authenticated; grant execute on function public.mcp_content(p_hash text, p_limit integer) to service_role;
revoke all on function public.mcp_scores(p_hash text) from public, anon, authenticated; grant execute on function public.mcp_scores(p_hash text) to anon; grant execute on function public.mcp_scores(p_hash text) to authenticated; grant execute on function public.mcp_scores(p_hash text) to service_role;
revoke all on function private.morning_snapshot(p_ws uuid) from public, anon, authenticated;
revoke all on function public.vault_context(p_ws uuid, p_query text, p_purpose text, p_ids uuid[]) from public, anon, authenticated; grant execute on function public.vault_context(p_ws uuid, p_query text, p_purpose text, p_ids uuid[]) to authenticated; grant execute on function public.vault_context(p_ws uuid, p_query text, p_purpose text, p_ids uuid[]) to service_role;
revoke all on function public.morning_read(p_ws uuid) from public, anon, authenticated; grant execute on function public.morning_read(p_ws uuid) to authenticated; grant execute on function public.morning_read(p_ws uuid) to service_role;
revoke all on function public.mcp_log_change(p_hash text, p_section text, p_row text, p_before jsonb, p_after jsonb, p_client text) from public, anon, authenticated; grant execute on function public.mcp_log_change(p_hash text, p_section text, p_row text, p_before jsonb, p_after jsonb, p_client text) to anon; grant execute on function public.mcp_log_change(p_hash text, p_section text, p_row text, p_before jsonb, p_after jsonb, p_client text) to authenticated; grant execute on function public.mcp_log_change(p_hash text, p_section text, p_row text, p_before jsonb, p_after jsonb, p_client text) to service_role;
revoke all on function public.morning_claim(p_secret text, p_ws uuid, p_force boolean) from public, anon, authenticated; grant execute on function public.morning_claim(p_secret text, p_ws uuid, p_force boolean) to anon; grant execute on function public.morning_claim(p_secret text, p_ws uuid, p_force boolean) to authenticated; grant execute on function public.morning_claim(p_secret text, p_ws uuid, p_force boolean) to service_role;
revoke all on function public.morning_finish(p_secret text, p_ws uuid, p_lease uuid, p_items jsonb, p_by text, p_context_hash text, p_dna_version integer, p_error text) from public, anon, authenticated; grant execute on function public.morning_finish(p_secret text, p_ws uuid, p_lease uuid, p_items jsonb, p_by text, p_context_hash text, p_dna_version integer, p_error text) to anon; grant execute on function public.morning_finish(p_secret text, p_ws uuid, p_lease uuid, p_items jsonb, p_by text, p_context_hash text, p_dna_version integer, p_error text) to authenticated; grant execute on function public.morning_finish(p_secret text, p_ws uuid, p_lease uuid, p_items jsonb, p_by text, p_context_hash text, p_dna_version integer, p_error text) to service_role;
revoke all on function public.morning_move(p_ws uuid, p_id uuid, p_dismiss boolean) from public, anon, authenticated; grant execute on function public.morning_move(p_ws uuid, p_id uuid, p_dismiss boolean) to authenticated; grant execute on function public.morning_move(p_ws uuid, p_id uuid, p_dismiss boolean) to service_role;
revoke all on function private.content_learning_enabled(p_ws uuid) from public, anon, authenticated;
revoke all on function private.content_learning_time(p_value text) from public, anon, authenticated;
revoke all on function private.content_learning_collect(p_ws uuid) from public, anon, authenticated;
revoke all on function private.content_learning_inputs(p_ws uuid) from public, anon, authenticated;
revoke all on function public.content_learning_read(p_ws uuid) from public, anon, authenticated; grant execute on function public.content_learning_read(p_ws uuid) to service_role; grant execute on function public.content_learning_read(p_ws uuid) to authenticated;
revoke all on function public.content_learning_edit(p_ws uuid, p_id uuid, p_patch jsonb, p_expected_at timestamp with time zone) from public, anon, authenticated; grant execute on function public.content_learning_edit(p_ws uuid, p_id uuid, p_patch jsonb, p_expected_at timestamp with time zone) to service_role; grant execute on function public.content_learning_edit(p_ws uuid, p_id uuid, p_patch jsonb, p_expected_at timestamp with time zone) to authenticated;
revoke all on function public.content_learning_settings(p_ws uuid, p_enabled boolean, p_key text, p_muted boolean) from public, anon, authenticated; grant execute on function public.content_learning_settings(p_ws uuid, p_enabled boolean, p_key text, p_muted boolean) to service_role; grant execute on function public.content_learning_settings(p_ws uuid, p_enabled boolean, p_key text, p_muted boolean) to authenticated;
revoke all on function public.cron_content_learning_read(p_secret text, p_ws uuid) from public, anon, authenticated; grant execute on function public.cron_content_learning_read(p_secret text, p_ws uuid) to service_role; grant execute on function public.cron_content_learning_read(p_secret text, p_ws uuid) to anon;
revoke all on function private.vault_notes_for(p_ws uuid, p_query text, p_purpose text, p_ids uuid[]) from public, anon, authenticated;
revoke all on function public.vault_note_create(p_ws uuid, p_id uuid, p_note jsonb) from public, anon, authenticated; grant execute on function public.vault_note_create(p_ws uuid, p_id uuid, p_note jsonb) to authenticated; grant execute on function public.vault_note_create(p_ws uuid, p_id uuid, p_note jsonb) to service_role;
revoke all on function public.vault_note_update(p_ws uuid, p_id uuid, p_revision integer, p_patch jsonb) from public, anon, authenticated; grant execute on function public.vault_note_update(p_ws uuid, p_id uuid, p_revision integer, p_patch jsonb) to authenticated; grant execute on function public.vault_note_update(p_ws uuid, p_id uuid, p_revision integer, p_patch jsonb) to service_role;
revoke all on function public.cron_vault_context(p_secret text, p_ws uuid, p_query text, p_purpose text, p_ids uuid[]) from public, anon, authenticated; grant execute on function public.cron_vault_context(p_secret text, p_ws uuid, p_query text, p_purpose text, p_ids uuid[]) to anon; grant execute on function public.cron_vault_context(p_secret text, p_ws uuid, p_query text, p_purpose text, p_ids uuid[]) to service_role;
revoke all on function public.custom_connection_save(p_ws uuid, p_id uuid, p_name text, p_kind text, p_cipher text, p_meta jsonb, p_revision integer, p_enabled boolean) from public, anon, authenticated; grant execute on function public.custom_connection_save(p_ws uuid, p_id uuid, p_name text, p_kind text, p_cipher text, p_meta jsonb, p_revision integer, p_enabled boolean) to authenticated; grant execute on function public.custom_connection_save(p_ws uuid, p_id uuid, p_name text, p_kind text, p_cipher text, p_meta jsonb, p_revision integer, p_enabled boolean) to service_role;
revoke all on function public.custom_connection_secret(p_ws uuid, p_id uuid) from public, anon, authenticated; grant execute on function public.custom_connection_secret(p_ws uuid, p_id uuid) to authenticated; grant execute on function public.custom_connection_secret(p_ws uuid, p_id uuid) to service_role;
revoke all on function public.custom_connection_remove(p_ws uuid, p_id uuid, p_revision integer) from public, anon, authenticated; grant execute on function public.custom_connection_remove(p_ws uuid, p_id uuid, p_revision integer) to authenticated; grant execute on function public.custom_connection_remove(p_ws uuid, p_id uuid, p_revision integer) to service_role;
revoke all on function private.program_valid(v jsonb) from public, anon, authenticated;
revoke all on function public.program_save(p_ws uuid, p_id uuid, p_data jsonb, p_revision integer, p_archived boolean) from public, anon, authenticated; grant execute on function public.program_save(p_ws uuid, p_id uuid, p_data jsonb, p_revision integer, p_archived boolean) to authenticated; grant execute on function public.program_save(p_ws uuid, p_id uuid, p_data jsonb, p_revision integer, p_archived boolean) to service_role;
revoke all on function public.program_propose(p_ws uuid, p_id uuid, p_data jsonb, p_digest text, p_answer text, p_changes jsonb, p_target uuid, p_revision integer, p_update_requested boolean) from public, anon, authenticated; grant execute on function public.program_propose(p_ws uuid, p_id uuid, p_data jsonb, p_digest text, p_answer text, p_changes jsonb, p_target uuid, p_revision integer, p_update_requested boolean) to authenticated; grant execute on function public.program_propose(p_ws uuid, p_id uuid, p_data jsonb, p_digest text, p_answer text, p_changes jsonb, p_target uuid, p_revision integer, p_update_requested boolean) to service_role;
revoke all on function public.program_dismiss(p_ws uuid, p_id uuid) from public, anon, authenticated; grant execute on function public.program_dismiss(p_ws uuid, p_id uuid) to authenticated; grant execute on function public.program_dismiss(p_ws uuid, p_id uuid) to service_role;
revoke all on function public.program_material_remove(p_ws uuid, p_id uuid, p_revision integer) from public, anon, authenticated; grant execute on function public.program_material_remove(p_ws uuid, p_id uuid, p_revision integer) to authenticated; grant execute on function public.program_material_remove(p_ws uuid, p_id uuid, p_revision integer) to service_role;
revoke all on function private.task_next(p_schedule jsonb, p_after timestamp with time zone) from public, anon, authenticated;
revoke all on function public.program_material_save(p_ws uuid, p_id uuid, p_row jsonb, p_revision integer) from public, anon, authenticated; grant execute on function public.program_material_save(p_ws uuid, p_id uuid, p_row jsonb, p_revision integer) to authenticated; grant execute on function public.program_material_save(p_ws uuid, p_id uuid, p_row jsonb, p_revision integer) to service_role;
revoke all on function public.program_material_removed(p_ws uuid, p_id uuid, p_path text) from public, anon, authenticated; grant execute on function public.program_material_removed(p_ws uuid, p_id uuid, p_path text) to authenticated; grant execute on function public.program_material_removed(p_ws uuid, p_id uuid, p_path text) to service_role;
revoke all on function public.program_confirm(p_ws uuid, p_id uuid, p_digest text, p_confirm boolean) from public, anon, authenticated; grant execute on function public.program_confirm(p_ws uuid, p_id uuid, p_digest text, p_confirm boolean) to authenticated; grant execute on function public.program_confirm(p_ws uuid, p_id uuid, p_digest text, p_confirm boolean) to service_role;
revoke all on function public.custom_connection_claim(p_ws uuid, p_id uuid, p_nonce uuid, p_revision integer, p_label text, p_digest text) from public, anon, authenticated; grant execute on function public.custom_connection_claim(p_ws uuid, p_id uuid, p_nonce uuid, p_revision integer, p_label text, p_digest text) to authenticated; grant execute on function public.custom_connection_claim(p_ws uuid, p_id uuid, p_nonce uuid, p_revision integer, p_label text, p_digest text) to service_role;
revoke all on function public.custom_connection_finish(p_ws uuid, p_run uuid, p_status text, p_result jsonb) from public, anon, authenticated; grant execute on function public.custom_connection_finish(p_ws uuid, p_run uuid, p_status text, p_result jsonb) to authenticated; grant execute on function public.custom_connection_finish(p_ws uuid, p_run uuid, p_status text, p_result jsonb) to service_role;
revoke all on function public.cron_design_skills(p_secret text, p_ws uuid) from public, anon, authenticated; grant execute on function public.cron_design_skills(p_secret text, p_ws uuid) to anon; grant execute on function public.cron_design_skills(p_secret text, p_ws uuid) to service_role;
revoke all on function public.strategy_save(p_ws uuid, p_id uuid, p_data jsonb, p_revision integer) from public, anon, authenticated; grant execute on function public.strategy_save(p_ws uuid, p_id uuid, p_data jsonb, p_revision integer) to authenticated; grant execute on function public.strategy_save(p_ws uuid, p_id uuid, p_data jsonb, p_revision integer) to service_role;
revoke all on function public.cron_strategy_context(p_secret text, p_ws uuid) from public, anon, authenticated; grant execute on function public.cron_strategy_context(p_secret text, p_ws uuid) to anon; grant execute on function public.cron_strategy_context(p_secret text, p_ws uuid) to service_role;
revoke all on function public.mcp_strategy_context(p_hash text) from public, anon, authenticated; grant execute on function public.mcp_strategy_context(p_hash text) to anon; grant execute on function public.mcp_strategy_context(p_hash text) to service_role;
revoke all on function private.task_validate(p jsonb) from public, anon, authenticated;
revoke all on function private.task_put(p_ws uuid, p_agent uuid, p_kind text, p jsonb) from public, anon, authenticated;
revoke all on function public.agent_propose(p_ws uuid, p_id uuid, p_data jsonb, p_digest text) from public, anon, authenticated; grant execute on function public.agent_propose(p_ws uuid, p_id uuid, p_data jsonb, p_digest text) to authenticated; grant execute on function public.agent_propose(p_ws uuid, p_id uuid, p_data jsonb, p_digest text) to service_role;
revoke all on function private.queue_legacy_draft() from public, anon, authenticated;
revoke all on function public.mcp_grok_tasks(p_hash text, p_status text) from public, anon, authenticated; grant execute on function public.mcp_grok_tasks(p_hash text, p_status text) to anon; grant execute on function public.mcp_grok_tasks(p_hash text, p_status text) to authenticated; grant execute on function public.mcp_grok_tasks(p_hash text, p_status text) to service_role;
revoke all on function public.founder_agent_save(p_ws uuid, p_data jsonb, p_revision integer) from public, anon, authenticated; grant execute on function public.founder_agent_save(p_ws uuid, p_data jsonb, p_revision integer) to authenticated; grant execute on function public.founder_agent_save(p_ws uuid, p_data jsonb, p_revision integer) to service_role;
revoke all on function public.founder_agent_state(p_ws uuid, p_id uuid, p_revision integer, p_enabled boolean, p_archived boolean) from public, anon, authenticated; grant execute on function public.founder_agent_state(p_ws uuid, p_id uuid, p_revision integer, p_enabled boolean, p_archived boolean) to authenticated; grant execute on function public.founder_agent_state(p_ws uuid, p_id uuid, p_revision integer, p_enabled boolean, p_archived boolean) to service_role;
revoke all on function public.ideation_task_save(p_ws uuid, p_data jsonb, p_revision integer, p_archived boolean) from public, anon, authenticated; grant execute on function public.ideation_task_save(p_ws uuid, p_data jsonb, p_revision integer, p_archived boolean) to authenticated; grant execute on function public.ideation_task_save(p_ws uuid, p_data jsonb, p_revision integer, p_archived boolean) to service_role;
revoke all on function public.agent_confirm(p_ws uuid, p_id uuid, p_digest text, p_confirm boolean) from public, anon, authenticated; grant execute on function public.agent_confirm(p_ws uuid, p_id uuid, p_digest text, p_confirm boolean) to authenticated; grant execute on function public.agent_confirm(p_ws uuid, p_id uuid, p_digest text, p_confirm boolean) to service_role;
revoke all on function public.agent_dismiss(p_ws uuid, p_id uuid) from public, anon, authenticated; grant execute on function public.agent_dismiss(p_ws uuid, p_id uuid) to authenticated; grant execute on function public.agent_dismiss(p_ws uuid, p_id uuid) to service_role;
revoke all on function public.coach_set_enabled(p_ws uuid, p_id uuid, p_on boolean) from public, anon, authenticated; grant execute on function public.coach_set_enabled(p_ws uuid, p_id uuid, p_on boolean) to authenticated; grant execute on function public.coach_set_enabled(p_ws uuid, p_id uuid, p_on boolean) to service_role;
revoke all on function public.agent_run_now(p_ws uuid, p_task uuid, p_request uuid) from public, anon, authenticated; grant execute on function public.agent_run_now(p_ws uuid, p_task uuid, p_request uuid) to authenticated; grant execute on function public.agent_run_now(p_ws uuid, p_task uuid, p_request uuid) to service_role;
revoke all on function public.cron_agent_enqueue(p_secret text) from public, anon, authenticated; grant execute on function public.cron_agent_enqueue(p_secret text) to anon; grant execute on function public.cron_agent_enqueue(p_secret text) to service_role;
revoke all on function public.coach_list(p_ws uuid) from public, anon, authenticated; grant execute on function public.coach_list(p_ws uuid) to authenticated; grant execute on function public.coach_list(p_ws uuid) to service_role;
revoke all on function public.coach_search(p_q text, p_limit integer) from public, anon, authenticated; grant execute on function public.coach_search(p_q text, p_limit integer) to authenticated; grant execute on function public.coach_search(p_q text, p_limit integer) to service_role;
revoke all on function public.cron_agent_claim(p_secret text, p_id uuid) from public, anon, authenticated; grant execute on function public.cron_agent_claim(p_secret text, p_id uuid) to anon; grant execute on function public.cron_agent_claim(p_secret text, p_id uuid) to service_role;
revoke all on function public.cron_agent_finish(p_secret text, p_id uuid, p_lease uuid, p_output jsonb, p_model text, p_error text) from public, anon, authenticated; grant execute on function public.cron_agent_finish(p_secret text, p_id uuid, p_lease uuid, p_output jsonb, p_model text, p_error text) to anon; grant execute on function public.cron_agent_finish(p_secret text, p_id uuid, p_lease uuid, p_output jsonb, p_model text, p_error text) to service_role;
revoke all on function public.content_decide(p_ws uuid, p_id uuid, p_stage text, p_expected_at timestamp with time zone) from public, anon, authenticated; grant execute on function public.content_decide(p_ws uuid, p_id uuid, p_stage text, p_expected_at timestamp with time zone) to authenticated; grant execute on function public.content_decide(p_ws uuid, p_id uuid, p_stage text, p_expected_at timestamp with time zone) to service_role;
revoke all on function private.video_plan_valid(p jsonb, d numeric) from public, anon, authenticated;
revoke all on function public.video_save(p_ws uuid, p_id uuid, p_data jsonb, p_revision integer, p_archived boolean) from public, anon, authenticated; grant execute on function public.video_save(p_ws uuid, p_id uuid, p_data jsonb, p_revision integer, p_archived boolean) to authenticated; grant execute on function public.video_save(p_ws uuid, p_id uuid, p_data jsonb, p_revision integer, p_archived boolean) to service_role;
revoke all on function public.video_approve(p_ws uuid, p_id uuid, p_revision integer, p_confirm boolean) from public, anon, authenticated; grant execute on function public.video_approve(p_ws uuid, p_id uuid, p_revision integer, p_confirm boolean) to authenticated; grant execute on function public.video_approve(p_ws uuid, p_id uuid, p_revision integer, p_confirm boolean) to service_role;
revoke all on function public.video_export_save(p_ws uuid, p_id uuid, p_project uuid, p_approval uuid, p_file jsonb) from public, anon, authenticated; grant execute on function public.video_export_save(p_ws uuid, p_id uuid, p_project uuid, p_approval uuid, p_file jsonb) to authenticated; grant execute on function public.video_export_save(p_ws uuid, p_id uuid, p_project uuid, p_approval uuid, p_file jsonb) to service_role;
revoke all on function public.mcp_founder_dna_read(p_hash text) from public, anon, authenticated; grant execute on function public.mcp_founder_dna_read(p_hash text) to anon; grant execute on function public.mcp_founder_dna_read(p_hash text) to service_role;
revoke all on function public.coach_play_list(p_ws uuid) from public, anon, authenticated; grant execute on function public.coach_play_list(p_ws uuid) to authenticated; grant execute on function public.coach_play_list(p_ws uuid) to service_role;
revoke all on function public.coach_play_save(p_ws uuid, p_id uuid, p_row jsonb) from public, anon, authenticated; grant execute on function public.coach_play_save(p_ws uuid, p_id uuid, p_row jsonb) to authenticated; grant execute on function public.coach_play_save(p_ws uuid, p_id uuid, p_row jsonb) to service_role;
revoke all on function public.coach_play_delete(p_ws uuid, p_id uuid) from public, anon, authenticated; grant execute on function public.coach_play_delete(p_ws uuid, p_id uuid) to authenticated; grant execute on function public.coach_play_delete(p_ws uuid, p_id uuid) to service_role;
revoke all on function public.coach_publish(p_ws uuid, p_source jsonb, p_chunks jsonb) from public, anon, authenticated; grant execute on function public.coach_publish(p_ws uuid, p_source jsonb, p_chunks jsonb) to authenticated; grant execute on function public.coach_publish(p_ws uuid, p_source jsonb, p_chunks jsonb) to service_role;
revoke all on function public.coach_remove(p_ws uuid, p_id uuid) from public, anon, authenticated; grant execute on function public.coach_remove(p_ws uuid, p_id uuid) to authenticated; grant execute on function public.coach_remove(p_ws uuid, p_id uuid) to service_role;
revoke all on function public.coach_lookup(p_q text, p_limit integer) from public, anon, authenticated; grant execute on function public.coach_lookup(p_q text, p_limit integer) to authenticated; grant execute on function public.coach_lookup(p_q text, p_limit integer) to service_role;
revoke all on function public.coach_stats() from public, anon, authenticated; grant execute on function public.coach_stats() to authenticated; grant execute on function public.coach_stats() to service_role;
revoke all on function public.account_delete(p_confirm text) from public, anon, authenticated; grant execute on function public.account_delete(p_confirm text) to authenticated; grant execute on function public.account_delete(p_confirm text) to service_role;
revoke all on function private.mcp_write(a_ws uuid, a_user uuid, p_section text, p_op text, p_id text, p_data jsonb, p_client text, p_log boolean) from public, anon, authenticated;
revoke all on function public.tella_edit_save(p_ws uuid, p_id uuid, p_data jsonb, p_revision integer) from public, anon, authenticated; grant execute on function public.tella_edit_save(p_ws uuid, p_id uuid, p_data jsonb, p_revision integer) to authenticated; grant execute on function public.tella_edit_save(p_ws uuid, p_id uuid, p_data jsonb, p_revision integer) to service_role;
revoke all on function public.tella_approve(p_ws uuid, p_id uuid, p_revision integer, p_kind text, p_confirm boolean) from public, anon, authenticated; grant execute on function public.tella_approve(p_ws uuid, p_id uuid, p_revision integer, p_kind text, p_confirm boolean) to authenticated; grant execute on function public.tella_approve(p_ws uuid, p_id uuid, p_revision integer, p_kind text, p_confirm boolean) to service_role;
revoke all on function public.tella_run_save(p_ws uuid, p_id uuid, p_revision integer, p_run jsonb) from public, anon, authenticated; grant execute on function public.tella_run_save(p_ws uuid, p_id uuid, p_revision integer, p_run jsonb) to authenticated; grant execute on function public.tella_run_save(p_ws uuid, p_id uuid, p_revision integer, p_run jsonb) to service_role;
revoke all on function public.funnel_create(p_ws uuid, p_title text, p_offer_ref text, p_answers jsonb, p_offer jsonb) from public, anon, authenticated; grant execute on function public.funnel_create(p_ws uuid, p_title text, p_offer_ref text, p_answers jsonb, p_offer jsonb) to anon; grant execute on function public.funnel_create(p_ws uuid, p_title text, p_offer_ref text, p_answers jsonb, p_offer jsonb) to authenticated; grant execute on function public.funnel_create(p_ws uuid, p_title text, p_offer_ref text, p_answers jsonb, p_offer jsonb) to service_role;
revoke all on function public.mcp_grok_task_update(p_hash text, p_id uuid, p_status text, p_summary text, p_links jsonb, p_client text) from public, anon, authenticated; grant execute on function public.mcp_grok_task_update(p_hash text, p_id uuid, p_status text, p_summary text, p_links jsonb, p_client text) to anon; grant execute on function public.mcp_grok_task_update(p_hash text, p_id uuid, p_status text, p_summary text, p_links jsonb, p_client text) to authenticated; grant execute on function public.mcp_grok_task_update(p_hash text, p_id uuid, p_status text, p_summary text, p_links jsonb, p_client text) to service_role;
revoke all on function public.mcp_os_sections(p_hash text) from public, anon, authenticated; grant execute on function public.mcp_os_sections(p_hash text) to anon; grant execute on function public.mcp_os_sections(p_hash text) to authenticated; grant execute on function public.mcp_os_sections(p_hash text) to service_role;
revoke all on function public.hl_app_ingest(p_secret text, p_location text, p_event jsonb) from public, anon, authenticated; grant execute on function public.hl_app_ingest(p_secret text, p_location text, p_event jsonb) to anon; grant execute on function public.hl_app_ingest(p_secret text, p_location text, p_event jsonb) to authenticated; grant execute on function public.hl_app_ingest(p_secret text, p_location text, p_event jsonb) to service_role;
revoke all on function public.mcp_os_write(p_hash text, p_section text, p_op text, p_id text, p_data jsonb, p_client text) from public, anon, authenticated; grant execute on function public.mcp_os_write(p_hash text, p_section text, p_op text, p_id text, p_data jsonb, p_client text) to anon; grant execute on function public.mcp_os_write(p_hash text, p_section text, p_op text, p_id text, p_data jsonb, p_client text) to authenticated; grant execute on function public.mcp_os_write(p_hash text, p_section text, p_op text, p_id text, p_data jsonb, p_client text) to service_role;
revoke all on function public.mcp_os_read(p_hash text, p_section text, p_id text, p_query text, p_filter jsonb, p_limit integer, p_offset integer) from public, anon, authenticated; grant execute on function public.mcp_os_read(p_hash text, p_section text, p_id text, p_query text, p_filter jsonb, p_limit integer, p_offset integer) to anon; grant execute on function public.mcp_os_read(p_hash text, p_section text, p_id text, p_query text, p_filter jsonb, p_limit integer, p_offset integer) to authenticated; grant execute on function public.mcp_os_read(p_hash text, p_section text, p_id text, p_query text, p_filter jsonb, p_limit integer, p_offset integer) to service_role;
revoke all on function public.mcp_os_undo(p_hash text, p_change uuid) from public, anon, authenticated; grant execute on function public.mcp_os_undo(p_hash text, p_change uuid) to anon; grant execute on function public.mcp_os_undo(p_hash text, p_change uuid) to authenticated; grant execute on function public.mcp_os_undo(p_hash text, p_change uuid) to service_role;
revoke all on function private.mcp_require_write(p_hash text) from public, anon, authenticated;
revoke all on function public.mcp_hl_secret(p_hash text) from public, anon, authenticated; grant execute on function public.mcp_hl_secret(p_hash text) to anon; grant execute on function public.mcp_hl_secret(p_hash text) to authenticated; grant execute on function public.mcp_hl_secret(p_hash text) to service_role;

insert into storage.buckets (id,name,public,file_size_limit,allowed_mime_types) values ('brain','brain',false,524288000,NULL) on conflict (id) do nothing;
insert into storage.buckets (id,name,public,file_size_limit,allowed_mime_types) values ('video-editor','video-editor',false,524288000,'{video/mp4,video/webm,video/quicktime,video/x-matroska,image/jpeg,image/png,image/webp,application/octet-stream}') on conflict (id) do nothing;

revoke all on function private.app_tz() from public, anon, authenticated;
revoke all on function public.fos_setup(p_cron_hash text, p_timezone text) from public, anon, authenticated; grant execute on function public.fos_setup(p_cron_hash text, p_timezone text) to authenticated;

insert into private.app_config(key,value) select 'schema_version','1' where not exists (select 1 from private.app_config where key='schema_version');

commit;
