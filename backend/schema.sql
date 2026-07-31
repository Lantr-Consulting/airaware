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
