"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createMutableClient } from "@/lib/supabase/server";

/**
 * tasks/projects/tags 와 동일 컨벤션. 다른 점: tasks.subtotal / tasks.subdone 의
 * 갱신은 DB 트리거가 담당 (006 마이그레이션) — server action 은 subtasks 만 다룸.
 *
 * client UUID 발급 + 낙관 UI 가 즉시 동일 id 사용. 003 의 복합 FK 가 cross-tenant
 * 참조를 DB 레벨에서 차단하지만, FK 위반 raw 메시지 대신 명확한 에러 UX 를
 * 위해 createSubtask 는 assertOwnedTask 로 부모 task 소유권을 사전 검증한다.
 */
async function requireUser() {
  const supabase = await createMutableClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?error=session_expired");
  return { supabase, user };
}

/* ─── 입력 검증 ─────────────────────────────────────────── */

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MAX_TITLE_LEN = 200;

function parseUuid(raw: unknown): string {
  if (typeof raw !== "string" || !UUID_RE.test(raw)) throw new Error("id 포맷 오류");
  return raw;
}

function parseTitle(raw: unknown): string {
  if (typeof raw !== "string") throw new Error("제목 형식 오류");
  const normalized = raw.trim().replace(/\s+/g, " ");
  if (!normalized) throw new Error("서브태스크 제목을 입력해 주세요");
  if (normalized.length > MAX_TITLE_LEN) throw new Error(`제목은 ${MAX_TITLE_LEN}자 이내`);
  return normalized;
}

function translateDbError(prefix: string, error: { code?: string; message: string }): Error {
  if (error.code === "23503") return new Error("참조 대상을 찾을 수 없습니다");
  return new Error(`${prefix}: ${error.message}`);
}

/**
 * 부모 task 가 인증된 사용자 소유인지 사전 검증.
 * DB 의 복합 FK (003) 가 cross-tenant 참조를 거부하지만, raw FK 위반 메시지
 * 대신 명확한 한국어 에러를 노출하기 위해 한 번 더 확인한다.
 */
async function assertOwnedTask(
  supabase: Awaited<ReturnType<typeof createMutableClient>>,
  taskId: string,
  userId: string,
) {
  const { data, error } = await supabase
    .from("tasks")
    .select("id")
    .eq("id", taskId)
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw new Error(`task 검증 실패: ${error.message}`);
  if (!data) throw new Error("해당 task 를 찾을 수 없습니다");
}

/* ─── createSubtask ─────────────────────────────────────── */

export async function createSubtask(id: string, taskId: string, title: string) {
  const subtaskId = parseUuid(id);
  const parentTaskId = parseUuid(taskId);
  const cleanTitle = parseTitle(title);

  const { supabase, user } = await requireUser();

  await assertOwnedTask(supabase, parentTaskId, user.id);

  const { error } = await supabase.from("subtasks").insert({
    id: subtaskId,
    task_id: parentTaskId,
    user_id: user.id,
    title: cleanTitle,
  });

  if (error) throw translateDbError("서브태스크 생성 실패", error);

  revalidatePath("/");
}

/* ─── updateSubtask ─────────────────────────────────────── */

/**
 * fields 는 unknown — title / done 키만 화이트리스트. 임의 컬럼 (user_id, task_id,
 * sort_order) 시도는 무시.
 */
export async function updateSubtask(id: string, fields: unknown) {
  const subtaskId = parseUuid(id);

  if (!fields || typeof fields !== "object") throw new Error("수정할 필드가 비어있습니다");
  const input = fields as Record<string, unknown>;
  const update: { title?: string; done?: boolean } = {};

  if ("title" in input) update.title = parseTitle(input.title);
  if ("done" in input) {
    if (typeof input.done !== "boolean") throw new Error("done 은 boolean 이어야 합니다");
    update.done = input.done;
  }

  if (Object.keys(update).length === 0) throw new Error("수정할 필드가 없습니다");

  const { supabase, user } = await requireUser();

  const { error } = await supabase
    .from("subtasks")
    .update(update)
    .eq("id", subtaskId)
    .eq("user_id", user.id);

  if (error) throw new Error(`서브태스크 수정 실패: ${error.message}`);

  revalidatePath("/");
}

/* ─── deleteSubtask ─────────────────────────────────────── */

export async function deleteSubtask(id: string) {
  const subtaskId = parseUuid(id);

  const { supabase, user } = await requireUser();

  const { error } = await supabase
    .from("subtasks")
    .delete()
    .eq("id", subtaskId)
    .eq("user_id", user.id);

  if (error) throw new Error(`서브태스크 삭제 실패: ${error.message}`);

  revalidatePath("/");
}
