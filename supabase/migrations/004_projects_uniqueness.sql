-- 004_projects_uniqueness.sql
-- 같은 사용자가 같은 이름의 프로젝트를 두 개 만들지 못하게 한다.
-- 사이드바·분포 차트에서 동명 프로젝트는 시각적 구분이 불가능하고,
-- 향후 검색/필터에서 결과를 모호하게 만든다.
--
-- 제약 위반은 PostgreSQL error code 23505 (unique_violation) 로 발생 →
-- server action 에서 캐치해 "이미 사용 중인 이름입니다" 로 변환.
--
-- (user_id, name) 순서로 인덱스 잡힘 — RLS 가 user_id 로 필터링하므로
-- 동일 user 내부에서만 UNIQUE 강제, 다른 user 와는 충돌하지 않는다.

alter table public.projects
  add constraint projects_user_name_unique unique (user_id, name);
