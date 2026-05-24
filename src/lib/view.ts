/**
 * 사이드바 뷰 라우팅 + 프로젝트 필터의 URL 직렬화 / 필터 헬퍼.
 *
 * URL 모양: /?view=today&project=<uuid>
 *  - view 키: today | upcoming | inbox | someday | done. 없으면 today (default).
 *  - project 키: project UUID. 없으면 전체.
 *
 * 토글 규칙 (사이드바 클릭이 호출하는 buildToggleHref):
 *  - nav 동일 항목 재클릭 → view 키 제거 → default 로 복귀
 *  - 프로젝트 동일 항목 재클릭 → project 키 제거 → 필터 해제
 */

import { type Project, type Task } from "@/lib/data";

export const VIEW_KEYS = ["today", "upcoming", "inbox", "someday", "done"] as const;
export type ViewKey = (typeof VIEW_KEYS)[number];

export const DEFAULT_VIEW: ViewKey = "today";

/* ─── URL 파싱 ─────────────────────────────────────────────── */

export function parseView(value: string | null | undefined): ViewKey {
  if (!value) return DEFAULT_VIEW;
  return (VIEW_KEYS as readonly string[]).includes(value) ? (value as ViewKey) : DEFAULT_VIEW;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export function parseProjectId(value: string | null | undefined): string | null {
  if (!value) return null;
  return UUID_RE.test(value) ? value : null;
}

export function parseTagId(value: string | null | undefined): string | null {
  if (!value) return null;
  return UUID_RE.test(value) ? value : null;
}

/* ─── 토글 href 빌더 ──────────────────────────────────────── */

/**
 * 사이드바 nav 클릭 시 호출. 현재 view 와 동일하면 URL 에서 view 제거,
 * 다르면 view 설정. project 키는 보존.
 *
 * default (today) 인 경우는 키를 명시하지 않아 URL 이 깨끗하게 유지된다
 * (`/?project=...` 또는 `/`).
 */
export function toggleViewHref(searchParams: URLSearchParams, target: ViewKey): string {
  const current = parseView(searchParams.get("view"));
  const next = new URLSearchParams(searchParams);
  if (current === target) {
    next.delete("view");
  } else if (target === DEFAULT_VIEW) {
    next.delete("view");
  } else {
    next.set("view", target);
  }
  const qs = next.toString();
  return qs ? `/?${qs}` : "/";
}

/**
 * 프로젝트 row 클릭 시 호출. 현재 project 와 동일하면 키 제거 (필터 해제),
 * 다르면 설정. view·tag 키는 보존.
 */
export function toggleProjectHref(searchParams: URLSearchParams, projectId: string): string {
  const current = parseProjectId(searchParams.get("project"));
  const next = new URLSearchParams(searchParams);
  if (current === projectId) {
    next.delete("project");
  } else {
    next.set("project", projectId);
  }
  const qs = next.toString();
  return qs ? `/?${qs}` : "/";
}

/**
 * 태그 chip 클릭 시 호출. project 와 동일 패턴 — 재클릭 해제, view·project 보존.
 * 단일 선택 (multi-tag 필터는 1차 제외).
 */
export function toggleTagHref(searchParams: URLSearchParams, tagId: string): string {
  const current = parseTagId(searchParams.get("tag"));
  const next = new URLSearchParams(searchParams);
  if (current === tagId) {
    next.delete("tag");
  } else {
    next.set("tag", tagId);
  }
  const qs = next.toString();
  return qs ? `/?${qs}` : "/";
}

/* ─── 필터 헬퍼 ──────────────────────────────────────────── */

/**
 * 뷰 정의 — Question 3 의 표를 코드로 옮긴 것. !done 필터는 뷰 자체에 내장.
 * 완료는 done=true 만 통과. 나머지는 done=false 이면서 bucket 매칭.
 */
export function isTaskInView(task: Task, view: ViewKey): boolean {
  if (view === "done") return task.done;
  if (task.done) return false;
  switch (view) {
    case "today":
      return task.bucket === "today" || task.bucket === "overdue";
    case "upcoming":
      return ["tomorrow", "day3", "day4", "day5", "day6", "day7"].includes(task.bucket);
    case "inbox":
      return task.bucket === "inbox";
    case "someday":
      return task.bucket === "later";
  }
}

export function filterTasks(
  tasks: Task[],
  view: ViewKey,
  projectId: string | null,
  tagId: string | null = null,
): Task[] {
  return tasks.filter((t) => {
    if (!isTaskInView(t, view)) return false;
    if (projectId && t.projectId !== projectId) return false;
    if (tagId && !t.tags.some((tg) => tg.id === tagId)) return false;
    return true;
  });
}

/**
 * 검색어로 추가 필터 — title 과 task 의 project name 양쪽에 case-insensitive
 * substring 매칭. 빈/공백-only 쿼리는 원본 그대로 반환 (no-op).
 *
 * project name 조회를 위해 projects 배열을 받지만, projectId → name 룩업은
 * Map 으로 1회 수행해 N*M 비용을 N+M 으로 줄인다.
 */
export function filterBySearch(
  tasks: Task[],
  query: string,
  projects: Project[],
): Task[] {
  const q = query.trim().toLowerCase();
  if (!q) return tasks;

  const projectNameById = new Map<string, string>();
  for (const p of projects) projectNameById.set(p.id, p.name.toLowerCase());

  return tasks.filter((t) => {
    if (t.title.toLowerCase().includes(q)) return true;
    if (t.projectId) {
      const name = projectNameById.get(t.projectId);
      if (name && name.includes(q)) return true;
    }
    return false;
  });
}

/* ─── 뷰별 정렬 ──────────────────────────────────────────── */

/**
 * TaskList 의 비-오늘 뷰 정렬 규칙 (Question 4 의 표).
 * 오늘 뷰는 hour-timeline 이 자체 그리드라 정렬 무관.
 */
export function sortTasksForView(tasks: Task[], view: ViewKey): Task[] {
  const sorted = [...tasks];
  switch (view) {
    case "upcoming":
      // due_date ASC, 같은 날은 due_time ASC (null 시간은 뒤)
      sorted.sort((a, b) => {
        const d = (a.due_date ?? "").localeCompare(b.due_date ?? "");
        if (d !== 0) return d;
        return (a.due_time ?? "99:99").localeCompare(b.due_time ?? "99:99");
      });
      break;
    case "someday":
      sorted.sort((a, b) => (a.due_date ?? "").localeCompare(b.due_date ?? ""));
      break;
    case "inbox":
      sorted.sort((a, b) => b.created_at.localeCompare(a.created_at));
      break;
    case "done":
      sorted.sort((a, b) => b.updated_at.localeCompare(a.updated_at));
      break;
    default:
      break;
  }
  return sorted;
}

/* ─── 뷰별 TopBar 라벨 ─────────────────────────────────── */

export function viewTitle(view: ViewKey): string {
  switch (view) {
    case "today": return "오늘";
    case "upcoming": return "예정";
    case "inbox": return "인박스";
    case "someday": return "언젠가";
    case "done": return "완료";
  }
}

/**
 * TopBar subtitle 의 시간/맥락 부분. count 는 호출처에서 ` · N tasks` 로 붙임.
 */
export function viewSubtitleContext(view: ViewKey, today: Date): string {
  switch (view) {
    case "today": {
      const month = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"][today.getMonth()];
      return `${month} ${today.getDate()}`;
    }
    case "upcoming": return "다음 7일";
    case "inbox": return "미할당";
    case "someday": return "일주일 너머";
    case "done": return "완료한 일";
  }
}

export function viewEmptyMessage(view: ViewKey): { primary: string; mono?: string } {
  switch (view) {
    case "today": return { primary: "오늘 할 일이 없어요", mono: "ALL CLEAR" };
    case "upcoming": return { primary: "예정된 일정이 없습니다" };
    case "inbox": return { primary: "인박스가 비어 있습니다" };
    case "someday": return { primary: "나중에 할 일이 없습니다" };
    case "done": return { primary: "완료한 일이 없습니다" };
  }
}
