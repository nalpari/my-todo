-- ============================================================
-- 치트키 Todo — RLS UPDATE 정책에 WITH CHECK 추가
--
-- 배경: 001 의 UPDATE 정책은 USING 만 정의되어 있어, 사용자가
-- 자기 row 의 user_id 를 다른 사용자 uuid 로 변경 가능 (소유권
-- 이전 공격). WITH CHECK 를 추가해 변경 후 row 도 본인 소유임을
-- 보장한다.
-- ============================================================

drop policy if exists "users update own projects" on public.projects;
create policy "users update own projects"
  on public.projects for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "users update own tags" on public.tags;
create policy "users update own tags"
  on public.tags for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "users update own tasks" on public.tasks;
create policy "users update own tasks"
  on public.tasks for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
