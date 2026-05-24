/**
 * Supabase DB 데이터 fetch 함수 (서버 컴포넌트 / RSC 전용).
 * createClient (read-only) 를 사용한다.
 */

import { createClient } from "@/lib/supabase/server";
import {
  type Project,
  type Tag,
  type Task,
  type Subtask,
  type ProjectRow,
  type SubtaskRow,
  type TaskRow,
  rowToTask,
  rowToSubtask,
  toISODate,
} from "@/lib/data";

/* ─── Projects ──────────────────────────────────────────────── */

export async function getProjects(): Promise<Project[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("projects")
    .select("id, name, color")
    .order("created_at");

  if (error) {
    console.error("[getProjects]", error.message);
    return [];
  }

  // count: 해당 프로젝트의 미완료 task 수 (별도 조회 비용 없이 앱 수준에서 계산)
  // task fetch 후 계산하므로 일단 0으로 반환, buildAppData에서 채운다
  return (data as Pick<ProjectRow, "id" | "name" | "color">[]).map((p) => ({
    ...p,
    count: 0,
  }));
}

/* ─── Tags ──────────────────────────────────────────────────── */

export async function getTags(): Promise<Tag[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("tags")
    .select("id, name, hue")
    .order("created_at");

  if (error) {
    console.error("[getTags]", error.message);
    return [];
  }

  return data as Tag[];
}

/* ─── Tasks ─────────────────────────────────────────────────── */

/**
 * 오늘 기준 -30일 ~ +60일 범위의 task를 가져온다.
 * task_tags 조인 포함.
 */
export async function getTasks(today: Date): Promise<Task[]> {
  const supabase = await createClient();

  const from = new Date(today);
  from.setDate(today.getDate() - 30);
  const to = new Date(today);
  to.setDate(today.getDate() + 60);

  // toISOString 은 UTC 변환 — KST 등 비-UTC 환경에서 시각에 따라 날짜가 하루 어긋난다.
  // dateToBucket 및 InputBar 가 사용하는 로컬-기준 toISODate 와 통일.
  const fromStr = toISODate(from);
  const toStr = toISODate(to);

  // due_date 범위 내 태스크와 due_date가 null인 태스크를 별도 조회 후 합산
  // PostgREST .or()는 중첩 AND를 지원하지 않아 쿼리를 분리한다
  const [rangedResult, undatedResult] = await Promise.all([
    supabase
      .from("tasks")
      .select("*, task_tags(tag_id)")
      .gte("due_date", fromStr)
      .lte("due_date", toStr)
      .order("sort_order")
      .order("created_at"),
    supabase
      .from("tasks")
      .select("*, task_tags(tag_id)")
      .is("due_date", null)
      .order("sort_order")
      .order("created_at"),
  ]);

  if (rangedResult.error) {
    console.error("[getTasks/ranged]", rangedResult.error.message);
  }
  if (undatedResult.error) {
    console.error("[getTasks/undated]", undatedResult.error.message);
  }

  const combined = [
    ...(rangedResult.data ?? []),
    ...(undatedResult.data ?? []),
  ] as (TaskRow & { task_tags: { tag_id: string }[] })[];

  return combined.map((row) =>
    rowToTask(
      row,
      row.task_tags.map((tt) => tt.tag_id),
      today,
    ),
  );
}

/* ─── Subtasks ──────────────────────────────────────────── */

/**
 * 사용자의 모든 subtasks 조회. task 의 -30..+60 윈도우와 무관하게 전부 가져옴 —
 * subtask 는 양이 적고 task expand 시 즉시 보여야 하므로 클라이언트 메모리에
 * 두는 게 자연스럽다 (TaskList 의 N+1 fetch 회피).
 */
export async function getSubtasks(): Promise<Subtask[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("subtasks")
    .select("*")
    .order("sort_order")
    .order("created_at");

  if (error) {
    console.error("[getSubtasks]", error.message);
    return [];
  }

  return (data as SubtaskRow[]).map(rowToSubtask);
}

/* ─── 통합 조회 (page.tsx에서 1번 호출) ─────────────────────── */

export type AppData = {
  projects: Project[];
  tags: Tag[];
  tasks: Task[];
  subtasks: Subtask[];
};

export async function getAppData(): Promise<AppData> {
  const today = new Date();
  const [projects, tags, tasks, subtasks] = await Promise.all([
    getProjects(),
    getTags(),
    getTasks(today),
    getSubtasks(),
  ]);

  // 프로젝트별 미완료 task 수 계산
  const countMap = new Map<string, number>();
  for (const t of tasks) {
    if (!t.done && t.projectId) {
      countMap.set(t.projectId, (countMap.get(t.projectId) ?? 0) + 1);
    }
  }
  const projectsWithCount = projects.map((p) => ({
    ...p,
    count: countMap.get(p.id) ?? 0,
  }));

  return { projects: projectsWithCount, tags, tasks, subtasks };
}
