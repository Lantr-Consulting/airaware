-- AirAware Milestone 5: Memory & accounts.
-- Shares the "Ai Stock Analyst" Supabase project (a sample-fleet shortcut a
-- real student wouldn't take — they create their own project). Every table
-- is aa_-prefixed to stay out of the first sample's way; the auth user pool
-- is shared by design.
--
-- RLS: users can read only their own rows ("two people, two worlds").
-- All writes go through the backend service key, which bypasses RLS;
-- authorization for writes happens in auth.py + per-user filters in db.py.

create table if not exists aa_advisors (
  user_id uuid primary key references auth.users(id) on delete cascade,
  email text,
  profile jsonb not null,
  thresholds jsonb not null,
  home_location jsonb not null,
  units text not null default 'imperial',
  activated boolean not null default true,
  paused boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists aa_activities (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  kind text not null,
  days_of_week int[] not null,
  start_time text not null,
  duration_min int not null,
  intensity text not null,
  flexibility text not null,
  indoor_alternative text,
  enabled boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists aa_day_plans (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  date date not null,
  location jsonb not null,
  status text not null default 'active',
  day_score int not null,
  summary text not null default '',
  created_at timestamptz not null default now(),
  unique (user_id, date)
);

create table if not exists aa_plan_items (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid not null references aa_day_plans(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  activity_id uuid,
  kind text not null,
  title text not null,
  rationale text not null default '',
  "window" jsonb,
  original_window jsonb,
  checks jsonb not null default '[]',
  severity text not null default 'info',
  status text not null default 'auto',
  feedback jsonb,
  evidence jsonb not null default '[]',
  score int,
  created_at timestamptz not null default now()
);

-- Milestone 7: Workspace — async runs, chat persistence, supersession.

-- A re-plan supersedes rather than deletes: only one ACTIVE plan per day.
alter table aa_day_plans drop constraint if exists aa_day_plans_user_id_date_key;
create unique index if not exists aa_day_plans_active_unique
  on aa_day_plans (user_id, date) where (status = 'active');
alter table aa_day_plans add column if not exists conditions_snapshot jsonb;
alter table aa_day_plans add column if not exists superseded_note text;

-- Per-user run lock lives in the DB: an in-memory lock dies with 2 workers.
alter table aa_advisors add column if not exists run_lock_at timestamptz;

create table if not exists aa_plan_runs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  status text not null default 'running',
  dates text[] not null default '{}',
  steer jsonb not null default '[]',
  report text,
  error text,
  started_at timestamptz not null default now(),
  finished_at timestamptz
);

create table if not exists aa_threads (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null default 'New conversation',
  updated_at timestamptz not null default now()
);

create table if not exists aa_messages (
  id uuid primary key default gen_random_uuid(),
  thread_id uuid not null references aa_threads(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null,
  content text not null,
  created_at timestamptz not null default now()
);

alter table aa_plan_runs enable row level security;
alter table aa_threads enable row level security;
alter table aa_messages enable row level security;

drop policy if exists "read own runs" on aa_plan_runs;
create policy "read own runs" on aa_plan_runs
  for select using (auth.uid() = user_id);

drop policy if exists "read own threads" on aa_threads;
create policy "read own threads" on aa_threads
  for select using (auth.uid() = user_id);

drop policy if exists "read own messages" on aa_messages;
create policy "read own messages" on aa_messages
  for select using (auth.uid() = user_id);

alter table aa_advisors enable row level security;
alter table aa_activities enable row level security;
alter table aa_day_plans enable row level security;
alter table aa_plan_items enable row level security;

drop policy if exists "read own advisor" on aa_advisors;
create policy "read own advisor" on aa_advisors
  for select using (auth.uid() = user_id);

drop policy if exists "read own activities" on aa_activities;
create policy "read own activities" on aa_activities
  for select using (auth.uid() = user_id);

drop policy if exists "read own plans" on aa_day_plans;
create policy "read own plans" on aa_day_plans
  for select using (auth.uid() = user_id);

drop policy if exists "read own plan items" on aa_plan_items;
create policy "read own plan items" on aa_plan_items
  for select using (auth.uid() = user_id);
