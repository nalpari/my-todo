-- ============================================================
-- 치트키 Todo — 테넌트 격리 강화 (복합 FK + due_time CHECK)
--
-- 배경 (codex adversarial review):
-- 001 의 tasks.project_id 는 projects(id) 로의 단순 FK 라
-- 사용자가 자기 task 에 다른 사용자의 project_id 를 붙일 수 있었다.
-- task_tags 도 task 소유권만 검사하고 tag 소유권은 검사하지 않아
-- cross-tenant 참조가 가능. RLS 정책은 자기 row 만 검사할 뿐
-- FK 가 가리키는 row 의 소유자는 보지 않으므로 DB 경계에서
-- 같은 소유자임을 강제하도록 복합 FK 로 전환한다.
-- ============================================================

-- 1. 복합 FK 의 타겟이 될 복합 UNIQUE 추가
alter table public.projects
  add constraint projects_id_user_id_key unique (id, user_id);
alter table public.tags
  add constraint tags_id_user_id_key unique (id, user_id);
alter table public.tasks
  add constraint tasks_id_user_id_key unique (id, user_id);

-- 2. tasks.project_id → projects(id, user_id) 복합 FK
--    같은 user_id 의 project 만 참조 가능.
--    project_id 가 NULL 이면 MATCH SIMPLE 기본 동작으로 검사 생략됨 (OK).
alter table public.tasks
  drop constraint tasks_project_id_fkey;
alter table public.tasks
  add constraint tasks_project_id_fkey
  foreign key (project_id, user_id)
  references public.projects(id, user_id)
  on delete set null;

-- 3. task_tags 에 user_id 추가 + 복합 FK 로 task·tag 양쪽 동일 소유자 강제
alter table public.task_tags
  add column user_id uuid not null
  references auth.users(id) on delete cascade;

alter table public.task_tags
  drop constraint task_tags_task_id_fkey;
alter table public.task_tags
  add constraint task_tags_task_id_fkey
  foreign key (task_id, user_id)
  references public.tasks(id, user_id)
  on delete cascade;

alter table public.task_tags
  drop constraint task_tags_tag_id_fkey;
alter table public.task_tags
  add constraint task_tags_tag_id_fkey
  foreign key (tag_id, user_id)
  references public.tags(id, user_id)
  on delete cascade;

-- 4. task_tags RLS 단순화 — user_id 컬럼이 생겼으니 EXISTS 서브쿼리 대신 직접 비교
drop policy if exists "users see own task_tags" on public.task_tags;
create policy "users see own task_tags"
  on public.task_tags for select
  using (auth.uid() = user_id);

drop policy if exists "users insert own task_tags" on public.task_tags;
create policy "users insert own task_tags"
  on public.task_tags for insert
  with check (auth.uid() = user_id);

drop policy if exists "users delete own task_tags" on public.task_tags;
create policy "users delete own task_tags"
  on public.task_tags for delete
  using (auth.uid() = user_id);

-- 5. due_time 포맷 제약 — 잘못된 시간이 timeline 에서 묻히는 걸 DB 수준에서 차단
alter table public.tasks
  add constraint tasks_due_time_format
  check (due_time is null or due_time ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$');

-- 6. task_tags 인덱스 — 사용자별 조회 최적화
create index task_tags_user_id_idx on public.task_tags(user_id);
