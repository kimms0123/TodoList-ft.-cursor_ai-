-- AI Todo Manager - Supabase schema
-- PRD 기반: 사용자 프로필(public.users) + 할 일(public.todos) + RLS 정책

create extension if not exists pgcrypto;

-- Supabase Auth 사용자와 1:1로 연결되는 프로필 테이블
create table if not exists public.users (
  id uuid primary key references auth.users (id) on delete cascade,
  email text not null unique,
  name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 사용자별 할 일 관리 테이블
create table if not exists public.todos (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users (id) on delete cascade,
  title text not null,
  description text,
  created_at timestamptz not null default now(),
  due_date timestamptz,
  priority text not null default 'medium' check (priority in ('high', 'medium', 'low')),
  category text not null default '업무',
  completed boolean not null default false
);

create index if not exists idx_todos_user_id on public.todos (user_id);
create index if not exists idx_todos_due_date on public.todos (due_date);
create index if not exists idx_todos_priority on public.todos (priority);
create index if not exists idx_todos_completed on public.todos (completed);

-- RLS 활성화
alter table public.users enable row level security;
alter table public.todos enable row level security;

-- public.users: 소유자만 읽기/쓰기
drop policy if exists "users_select_own" on public.users;
create policy "users_select_own"
  on public.users
  for select
  using (auth.uid() = id);

drop policy if exists "users_insert_own" on public.users;
create policy "users_insert_own"
  on public.users
  for insert
  with check (auth.uid() = id);

drop policy if exists "users_update_own" on public.users;
create policy "users_update_own"
  on public.users
  for update
  using (auth.uid() = id)
  with check (auth.uid() = id);

drop policy if exists "users_delete_own" on public.users;
create policy "users_delete_own"
  on public.users
  for delete
  using (auth.uid() = id);

-- public.todos: 소유자만 읽기/쓰기
drop policy if exists "todos_select_own" on public.todos;
create policy "todos_select_own"
  on public.todos
  for select
  using (auth.uid() = user_id);

drop policy if exists "todos_insert_own" on public.todos;
create policy "todos_insert_own"
  on public.todos
  for insert
  with check (auth.uid() = user_id);

drop policy if exists "todos_update_own" on public.todos;
create policy "todos_update_own"
  on public.todos
  for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "todos_delete_own" on public.todos;
create policy "todos_delete_own"
  on public.todos
  for delete
  using (auth.uid() = user_id);
