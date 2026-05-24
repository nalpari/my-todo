"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createMutableClient } from "@/lib/supabase/server";

/**
 * 세션 검증 후 (supabase, user) 반환. 세션 만료면 /login 으로 redirect.
 * 주의: redirect() 는 NEXT_REDIRECT throw 라서 호출처에서 try/catch 로 감싸면 안 된다.
 */
async function requireUser() {
  const supabase = await createMutableClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?error=session_expired");
  return { supabase, user };
}

/* ─── 입력 검증 유틸 ────────────────────────────────────────── */

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const HHMM_RE = /^([01]\d|2[0-3]):[0-5]\d$/;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const MAX_TITLE_LEN = 500;

function parseTitle(raw: unknown): string {
  if (typeof raw !== "string") throw new Error("제목 형식 오류");
  const t = raw.trim();
  if (!t) throw new Error("제목을 입력해 주세요");
  if (t.length > MAX_TITLE_LEN) throw new Error(`제목은 ${MAX_TITLE_LEN}자 이내`);
  return t;
}

function parseNullableDate(raw: unknown): string | null {
  if (raw === null || raw === "" || raw === undefined) return null;
  if (typeof raw !== "string" || !ISO_DATE_RE.test(raw)) {
    throw new Error("due_date 포맷 오류 (YYYY-MM-DD)");
  }
  return raw;
}

function parseNullableTime(raw: unknown): string | null {
  if (raw === null || raw === "" || raw === undefined) return null;
  if (typeof raw !== "string" || !HHMM_RE.test(raw)) {
    throw new Error("due_time 포맷 오류 (HH:MM, 24시간)");
  }
  return raw;
}

function parseNullableUuid(raw: unknown): string | null {
  if (raw === null || raw === "" || raw === undefined) return null;
  if (typeof raw !== "string" || !UUID_RE.test(raw)) {
    throw new Error("project_id 포맷 오류");
  }
  return raw;
}

/**
 * project_id 가 인증된 사용자 소유인지 사전 검증.
 * DB 의 복합 FK (003 마이그레이션) 가 cross-tenant 참조를 어차피 거부하지만,
 * 명확한 에러 메시지를 위해 앱 레이어에서도 한 번 더 확인한다.
 */
async function assertOwnedProject(
  supabase: Awaited<ReturnType<typeof createMutableClient>>,
  projectId: string,
  userId: string,
) {
  const { data, error } = await supabase
    .from("projects")
    .select("id")
    .eq("id", projectId)
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw new Error(`프로젝트 검증 실패: ${error.message}`);
  if (!data) throw new Error("해당 프로젝트를 찾을 수 없습니다");
}

/* ─── createTask ────────────────────────────────────────────── */

export async function createTask(formData: FormData) {
  const title = parseTitle(formData.get("title"));
  const projectId = parseNullableUuid(formData.get("project_id"));
  const dueDate = parseNullableDate(formData.get("due_date"));
  const dueTime = parseNullableTime(formData.get("due_time"));

  const { supabase, user } = await requireUser();

  if (projectId) await assertOwnedProject(supabase, projectId, user.id);

  const { error } = await supabase.from("tasks").insert({
    user_id: user.id,
    title,
    project_id: projectId,
    due_date: dueDate,
    due_time: dueTime,
  });

  if (error) throw new Error(`task 생성 실패: ${error.message}`);

  revalidatePath("/");
}

/* ─── toggleTask ────────────────────────────────────────────── */

export async function toggleTask(id: string, done: boolean) {
  const { supabase, user } = await requireUser();

  // RLS 와 별개로 명시적 user_id 필터 — RLS 정책이 잘못 바뀌어도 다른 사용자
  // row 를 건드리지 못하게 하는 다층 방어.
  const { error } = await supabase
    .from("tasks")
    .update({ done })
    .eq("id", id)
    .eq("user_id", user.id);

  if (error) throw new Error(`task 토글 실패: ${error.message}`);

  revalidatePath("/");
}

/* ─── updateTask ────────────────────────────────────────────── */

/**
 * 화이트리스트 + 포맷 검증 후 update.
 * fields 는 unknown 으로 받아 런타임에서 키·값 검증. TS 타입은 RPC 경계에서
 * 강제력이 없으므로 client 가 임의 컬럼(예: user_id, sort_order)을 보내도
 * 여기서 차단된다. 빈 객체면 throw.
 */
export async function updateTask(id: string, fields: unknown) {
  if (!fields || typeof fields !== "object") {
    throw new Error("수정할 필드가 비어있습니다");
  }
  const input = fields as Record<string, unknown>;
  const update: { title?: string; due_date?: string | null; due_time?: string | null; project_id?: string | null } = {};

  if ("title" in input) update.title = parseTitle(input.title);
  if ("due_date" in input) update.due_date = parseNullableDate(input.due_date);
  if ("due_time" in input) update.due_time = parseNullableTime(input.due_time);
  if ("project_id" in input) update.project_id = parseNullableUuid(input.project_id);

  if (Object.keys(update).length === 0) {
    throw new Error("수정할 필드가 없습니다");
  }

  const { supabase, user } = await requireUser();

  if (update.project_id) await assertOwnedProject(supabase, update.project_id, user.id);

  const { error } = await supabase
    .from("tasks")
    .update(update)
    .eq("id", id)
    .eq("user_id", user.id);

  if (error) throw new Error(`task 수정 실패: ${error.message}`);

  revalidatePath("/");
}

/* ─── deleteTask ────────────────────────────────────────────── */

export async function deleteTask(id: string) {
  const { supabase, user } = await requireUser();

  const { error } = await supabase
    .from("tasks")
    .delete()
    .eq("id", id)
    .eq("user_id", user.id);

  if (error) throw new Error(`task 삭제 실패: ${error.message}`);

  revalidatePath("/");
}
