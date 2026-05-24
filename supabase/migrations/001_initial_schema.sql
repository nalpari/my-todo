-- ============================================================
-- 치트키 Todo — Initial Schema
-- 실행 방법: Supabase Dashboard > SQL Editor 에 붙여넣고 실행
-- ============================================================

-- ------------------------------------------------------------
-- 1. projects
-- ------------------------------------------------------------
create table if not exists public.projects (
  id        uuid primary key default gen_random_uuid(),
  user_id   uuid not null references auth.users(id) on delete cascade,
  name      text not null,
  color     text not null default '#6b6964',
  created_at timestamptz not null default now()
);

alter table public.projects enable row level security;

create policy "users see own projects"
  on public.projects for select
  using (auth.uid() = user_id);

create policy "users insert own projects"
  on public.projects for insert
  with check (auth.uid() = user_id);

create policy "users update own projects"
  on public.projects for update
  using (auth.uid() = user_id);

create policy "users delete own projects"
  on public.projects for delete
  using (auth.uid() = user_id);

-- ------------------------------------------------------------
-- 2. tags
-- ------------------------------------------------------------
create table if not exists public.tags (
  id        uuid primary key default gen_random_uuid(),
  user_id   uuid not null references auth.users(id) on delete cascade,
  name      text not null,
  hue       text not null default 'muted' check (hue in ('accent', 'muted')),
  created_at timestamptz not null default now()
);

alter table public.tags enable row level security;

create policy "users see own tags"
  on public.tags for select
  using (auth.uid() = user_id);

create policy "users insert own tags"
  on public.tags for insert
  with check (auth.uid() = user_id);

create policy "users update own tags"
  on public.tags for update
  using (auth.uid() = user_id);

create policy "users delete own tags"
  on public.tags for delete
  using (auth.uid() = user_id);

-- ------------------------------------------------------------
-- 3. tasks
-- ------------------------------------------------------------
create table if not exists public.tasks (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users(id) on delete cascade,
  project_id uuid references public.projects(id) on delete set null,
  title      text not null,
  due_date   date,
  due_time   text,             -- "HH:MM" 형식, null 허용
  done       boolean not null default false,
  subtotal   int not null default 0,
  subdone    int not null default 0,
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.tasks enable row level security;

create policy "users see own tasks"
  on public.tasks for select
  using (auth.uid() = user_id);

create policy "users insert own tasks"
  on public.tasks for insert
  with check (auth.uid() = user_id);

create policy "users update own tasks"
  on public.tasks for update
  using (auth.uid() = user_id);

create policy "users delete own tasks"
  on public.tasks for delete
  using (auth.uid() = user_id);

-- updated_at 자동 갱신 트리거
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger tasks_updated_at
  before update on public.tasks
  for each row execute function public.set_updated_at();

-- ------------------------------------------------------------
-- 4. task_tags (N:M 조인)
-- ------------------------------------------------------------
create table if not exists public.task_tags (
  task_id uuid not null references public.tasks(id) on delete cascade,
  tag_id  uuid not null references public.tags(id) on delete cascade,
  primary key (task_id, tag_id)
);

alter table public.task_tags enable row level security;

-- task 소유자만 task_tags 조회/수정 가능
create policy "users see own task_tags"
  on public.task_tags for select
  using (
    exists (
      select 1 from public.tasks
      where tasks.id = task_tags.task_id
        and tasks.user_id = auth.uid()
    )
  );

create policy "users insert own task_tags"
  on public.task_tags for insert
  with check (
    exists (
      select 1 from public.tasks
      where tasks.id = task_tags.task_id
        and tasks.user_id = auth.uid()
    )
  );

create policy "users delete own task_tags"
  on public.task_tags for delete
  using (
    exists (
      select 1 from public.tasks
      where tasks.id = task_tags.task_id
        and tasks.user_id = auth.uid()
    )
  );

-- ------------------------------------------------------------
-- 5. 인덱스
-- ------------------------------------------------------------
create index tasks_user_id_due_date_idx on public.tasks(user_id, due_date);
create index tasks_user_id_done_idx on public.tasks(user_id, done);
create index projects_user_id_idx on public.projects(user_id);
create index tags_user_id_idx on public.tags(user_id);
