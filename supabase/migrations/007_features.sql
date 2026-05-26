-- ============================================================
-- 치트키 Todo — features 테이블 + tasks.feature_id (테넌트 격리)
--
-- 디자인 노트:
-- 003 의 cross-tenant 격리 패턴을 그대로 따른다.
--   - features 에 user_id 직접 보유 → RLS 를 EXISTS 서브쿼리 대신
--     단순 비교로 작성 가능, UPDATE 정책에도 WITH CHECK 강제
--     (002 의 소유권 이전 방지 패턴).
--   - (project_id, user_id) → projects(id, user_id) 복합 FK 로
--     "같은 user 의 project" 만 참조 가능하게 DB 경계에서 강제.
--   - tasks.feature_id 도 (feature_id, user_id) → features(id, user_id)
--     복합 FK 로 cross-tenant 참조 차단.
-- ============================================================

-- 1. features 테이블
create table public.features (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users(id) on delete cascade,
  project_id uuid not null,
  name       text not null,
  created_at timestamptz not null default now(),
  constraint features_project_name_unique unique (project_id, name),
  constraint features_id_user_id_key unique (id, user_id),
  constraint features_project_id_fkey
    foreign key (project_id, user_id)
    references public.projects(id, user_id)
    on delete cascade
);

alter table public.features enable row level security;

create policy "users see own features"
  on public.features for select
  using (auth.uid() = user_id);

create policy "users insert own features"
  on public.features for insert
  with check (auth.uid() = user_id);

create policy "users update own features"
  on public.features for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "users delete own features"
  on public.features for delete
  using (auth.uid() = user_id);

create index features_user_id_idx on public.features(user_id);
create index features_project_id_idx on public.features(project_id);

-- 2. tasks.feature_id — (feature_id, user_id) 복합 FK
alter table public.tasks
  add column feature_id uuid;

alter table public.tasks
  add constraint tasks_feature_id_fkey
  foreign key (feature_id, user_id)
  references public.features(id, user_id)
  on delete set null;

create index tasks_feature_id_idx on public.tasks(feature_id);
