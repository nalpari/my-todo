-- 005_tags_uniqueness.sql
-- 같은 사용자가 같은 이름의 태그를 두 개 만들지 못하게 한다.
-- 004 의 projects 패턴과 대칭 — 사이드바·task chip 에서 동명 태그는 시각적
-- 구분이 불가능하고, 향후 검색/필터 결과를 모호하게 만든다.
--
-- 제약 위반은 PostgreSQL error code 23505 (unique_violation) 로 발생 →
-- server action 에서 캐치해 "이미 사용 중인 이름입니다" 로 변환.

alter table public.tags
  add constraint tags_user_name_unique unique (user_id, name);
