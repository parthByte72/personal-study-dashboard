-- Run this entire file in Supabase Dashboard → SQL Editor.
-- Row Level Security ensures each signed-in user can only access their own study data.
create extension if not exists pgcrypto;

create table if not exists public.study_tasks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  subject text not null default 'General',
  priority text not null default 'Medium' check (priority in ('High','Medium','Low')),
  done boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.study_subjects (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  code text not null default '',
  progress integer not null default 0 check (progress between 0 and 100),
  created_at timestamptz not null default now(),
  unique(user_id, name)
);

create table if not exists public.study_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  minutes integer not null check (minutes > 0 and minutes <= 240),
  completed_at timestamptz not null default now()
);

alter table public.study_tasks enable row level security;
alter table public.study_subjects enable row level security;
alter table public.study_sessions enable row level security;

create policy "Users manage their own tasks" on public.study_tasks
  for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "Users manage their own subjects" on public.study_subjects
  for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "Users manage their own sessions" on public.study_sessions
  for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

create index if not exists study_tasks_user_created_idx on public.study_tasks(user_id, created_at desc);
create index if not exists study_subjects_user_created_idx on public.study_subjects(user_id, created_at);
create index if not exists study_sessions_user_completed_idx on public.study_sessions(user_id, completed_at desc);
