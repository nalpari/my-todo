"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createMutableClient } from "@/lib/supabase/server";

/**
 * tasks/projects 와 동일 컨벤션. 다른 점: hue 는 'accent' | 'muted' enum.
 * tag <-> task 의 N:M 은 task_tags 조인 테이블. 003 의 복합 FK 와 cascade 가
 * cross-tenant 와 dangling row 를 DB 레벨에서 차단하지만, 명확한 에러 UX 를
 * 위해 task 를 참조하는 액션은 앱 레이어에서도 한 번 더 소유권을 확인한다.
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
const MAX_NAME_LEN = 30;
const ALLOWED_HUES = ["accent", "muted"] as const;
type Hue = (typeof ALLOWED_HUES)[number];

function parseUuid(raw: unknown): string {
  if (typeof raw !== "string" || !UUID_RE.test(raw)) throw new Error("id 포맷 오류");
  return raw;
}

function parseName(raw: unknown): string {
  if (typeof raw !== "string") throw new Error("이름 형식 오류");
  const normalized = raw.trim().replace(/\s+/g, " ");
  if (!normalized) throw new Error("태그 이름을 입력해 주세요");
  if (normalized.length > MAX_NAME_LEN) throw new Error(`태그 이름은 ${MAX_NAME_LEN}자 이내`);
  return normalized;
}

function parseHue(raw: unknown): Hue {
  if (typeof raw !== "string" || !(ALLOWED_HUES as readonly string[]).includes(raw)) {
    throw new Error("허용되지 않은 hue 입니다");
  }
  return raw as Hue;
}

function translateDbError(prefix: string, error: { code?: string; message: string }): Error {
  if (error.code === "23505") return new Error("이미 사용 중인 이름입니다");
  if (error.code === "23503") return new Error("참조 대상을 찾을 수 없습니다");
  return new Error(`${prefix}: ${error.message}`);
}

/**
 * task 가 인증된 사용자 소유인지 사전 검증.
 * DB 의 복합 FK (003) 가 cross-tenant 참조를 차단하지만, FK 위반 raw 메시지
 * 대신 명확한 한국어 에러를 사용자에게 노출하기 위해 한 번 더 확인한다.
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

/* ─── createTag ─────────────────────────────────────────── */

export async function createTag(id: string, name: string, hue: string) {
  const tagId = parseUuid(id);
  const cleanName = parseName(name);
  const cleanHue = parseHue(hue);

  const { supabase, user } = await requireUser();

  const { error } = await supabase.from("tags").insert({
    id: tagId,
    user_id: user.id,
    name: cleanName,
    hue: cleanHue,
  });

  if (error) throw translateDbError("태그 생성 실패", error);

  revalidatePath("/");
}

/* ─── deleteTag ─────────────────────────────────────────── */

export async function deleteTag(id: string) {
  const tagId = parseUuid(id);
  const { supabase, user } = await requireUser();

  // task_tags 의 FK 가 ON DELETE CASCADE 라 조인 row 도 함께 삭제됨.
  const { error } = await supabase
    .from("tags")
    .delete()
    .eq("id", tagId)
    .eq("user_id", user.id);

  if (error) throw new Error(`태그 삭제 실패: ${error.message}`);

  revalidatePath("/");
}

/* ─── assignTag / unassignTag ──────────────────────────── */

/**
 * task 에 태그를 붙임. assertOwnedTask 로 사전 소유권 확인 후 insert.
 * tag 쪽 소유권은 003 의 복합 FK 가 DB 레벨에서 검증 (23503).
 *
 * 이미 붙어있으면 PK (task_id, tag_id) UNIQUE 위반 (23505) → 멱등 처리 (no-op).
 */
export async function assignTag(taskId: string, tagId: string) {
  const t = parseUuid(taskId);
  const g = parseUuid(tagId);
  const { supabase, user } = await requireUser();

  await assertOwnedTask(supabase, t, user.id);

  const { error } = await supabase.from("task_tags").insert({
    task_id: t,
    tag_id: g,
    user_id: user.id,
  });

  if (error) {
    if (error.code === "23505") {
      // 이미 할당된 상태 — 사용자 입장에서 성공과 동일.
      revalidatePath("/");
      return;
    }
    throw translateDbError("태그 할당 실패", error);
  }

  revalidatePath("/");
}

export async function unassignTag(taskId: string, tagId: string) {
  const t = parseUuid(taskId);
  const g = parseUuid(tagId);
  const { supabase, user } = await requireUser();

  await assertOwnedTask(supabase, t, user.id);

  const { error } = await supabase
    .from("task_tags")
    .delete()
    .eq("task_id", t)
    .eq("tag_id", g)
    .eq("user_id", user.id);

  if (error) throw translateDbError("태그 해제 실패", error);

  revalidatePath("/");
}
