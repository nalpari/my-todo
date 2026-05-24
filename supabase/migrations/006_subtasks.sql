-- 006_subtasks.sql
-- 서브태스크 테이블 + RLS + 카운트 자동 갱신 트리거.
--
-- 기존의 tasks.subtotal / tasks.subdone 컬럼은 그대로 두되, subtasks 변이 시
-- 트리거가 자동으로 재계산해 두 테이블의 정합성을 DB 레벨에서 강제한다.
-- 이렇게 하면 server action 은 subtasks 만 다루면 되고, RLS 가 통과되는 경로면
-- 어떤 클라이언트가 변이해도 (Supabase Studio 직접 수정 포함) 일관 유지.
--
-- 003 의 복합 FK 패턴 그대로 — (task_id, user_id) → tasks(id, user_id) 로
-- cross-tenant 참조를 차단하고, ON DELETE CASCADE 로 부모 task 삭제 시 자식
-- 자동 삭제.

create table public.subtasks (
  id          uuid primary key default extensions.uuid_generate_v4(),
  task_id     uuid not null,
  user_id     uuid not null references auth.users(id) on delete cascade,
  title       text not null,
  done        boolean not null default false,
  sort_order  int not null default 0,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  constraint subtasks_task_user_fkey
    foreign key (task_id, user_id)
    references public.tasks(id, user_id)
    on delete cascade
);

-- 자주 쓰는 쿼리: 특정 task 의 subtasks 모두 조회.
create index subtasks_task_id_idx on public.subtasks(task_id);

-- updated_at 자동 갱신 트리거 (다른 테이블과 동일 패턴)
create trigger subtasks_updated_at
  before update on public.subtasks
  for each row execute function public.set_updated_at();

-- ─── RLS ───────────────────────────────────────────────
alter table public.subtasks enable row level security;

create policy "users see own subtasks" on public.subtasks
  for select using (auth.uid() = user_id);

create policy "users insert own subtasks" on public.subtasks
  for insert with check (auth.uid() = user_id);

create policy "users update own subtasks" on public.subtasks
  for update using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "users delete own subtasks" on public.subtasks
  for delete using (auth.uid() = user_id);

-- ─── 카운트 재계산 트리거 ──────────────────────────────
-- subtasks 의 INSERT/UPDATE/DELETE 시 부모 task 의 subtotal/subdone 을 재계산.
-- UPDATE 가 task_id 를 바꿀 수도 있으므로 old.task_id 와 new.task_id 양쪽 처리.
-- 부모 task 가 CASCADE 로 함께 삭제될 때 트리거의 UPDATE 는 0 rows 반환 (no-op).
create or replace function public.recalc_task_subtask_counts()
returns trigger language plpgsql as $$
declare
  v_task_id uuid;
begin
  if (tg_op = 'DELETE') then
    v_task_id := old.task_id;
  else
    v_task_id := new.task_id;
  end if;

  update public.tasks
  set
    subtotal = (select count(*) from public.subtasks where task_id = v_task_id),
    subdone  = (select count(*) from public.subtasks where task_id = v_task_id and done = true)
  where id = v_task_id;

  -- UPDATE 가 task_id 를 변경했다면 이전 task 도 함께 갱신
  if (tg_op = 'UPDATE' and old.task_id is distinct from new.task_id) then
    update public.tasks
    set
      subtotal = (select count(*) from public.subtasks where task_id = old.task_id),
      subdone  = (select count(*) from public.subtasks where task_id = old.task_id and done = true)
    where id = old.task_id;
  end if;

  if (tg_op = 'DELETE') then
    return old;
  end if;
  return new;
end;
$$;

create trigger subtasks_recalc_counts
  after insert or update or delete on public.subtasks
  for each row execute function public.recalc_task_subtask_counts();
