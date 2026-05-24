"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createMutableClient } from "@/lib/supabase/server";
import { DEFAULT_PROJECT_COLOR, isProjectColor } from "@/lib/palette";

/**
 * tasks/actions.ts 와 동일 컨벤션:
 *  - requireUser: 세션 없으면 /login 으로 redirect (NEXT_REDIRECT throw)
 *  - 입력은 unknown 으로 받아 화이트리스트 + 포맷 검증
 *  - 모든 에러는 throw — 클라이언트의 runAction 헬퍼가 토스트로 표시
 *  - 성공 시 revalidatePath("/")
 */
async function requireUser() {
  const supabase = await createMutableClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?error=session_expired");
  return { supabase, user };
}

/* ─── 입력 검증 ─────────────────────────────────────────────── */

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MAX_NAME_LEN = 50;

/** trim + 연속 공백 1개로 정규화. 빈 문자열이면 throw. */
function parseName(raw: unknown): string {
  if (typeof raw !== "string") throw new Error("이름 형식 오류");
  const normalized = raw.trim().replace(/\s+/g, " ");
  if (!normalized) throw new Error("프로젝트 이름을 입력해 주세요");
  if (normalized.length > MAX_NAME_LEN) {
    throw new Error(`프로젝트 이름은 ${MAX_NAME_LEN}자 이내`);
  }
  return normalized;
}

function parseColor(raw: unknown): string {
  if (raw === null || raw === undefined || raw === "") return DEFAULT_PROJECT_COLOR;
  if (!isProjectColor(raw)) throw new Error("허용되지 않은 색입니다");
  return raw;
}

function parseUuid(raw: unknown): string {
  if (typeof raw !== "string" || !UUID_RE.test(raw)) {
    throw new Error("id 포맷 오류");
  }
  return raw;
}

/**
 * PostgreSQL unique_violation (23505) → 사용자 메시지로 변환.
 * 다른 에러는 prefix 와 함께 그대로 노출.
 */
function translateDbError(prefix: string, error: { code?: string; message: string }): Error {
  if (error.code === "23505") return new Error("이미 사용 중인 이름입니다");
  return new Error(`${prefix}: ${error.message}`);
}

/* ─── createProject ────────────────────────────────────────── */

/**
 * id 는 클라이언트가 crypto.randomUUID() 로 발급해 전달.
 * 낙관 UI 가 즉시 동일 id 를 사용하므로 후속 ops (rename/recolor/delete) 가
 * race 없이 동작한다. 충돌 확률은 1/2^122 — 사실상 0.
 */
export async function createProject(id: string, name: string, color?: string) {
  const projectId = parseUuid(id);
  const cleanName = parseName(name);
  const cleanColor = parseColor(color);

  const { supabase, user } = await requireUser();

  const { error } = await supabase.from("projects").insert({
    id: projectId,
    user_id: user.id,
    name: cleanName,
    color: cleanColor,
  });

  if (error) throw translateDbError("프로젝트 생성 실패", error);

  revalidatePath("/");
}

/* ─── updateProject ────────────────────────────────────────── */

export async function updateProject(id: string, fields: unknown) {
  const projectId = parseUuid(id);

  if (!fields || typeof fields !== "object") {
    throw new Error("수정할 필드가 비어있습니다");
  }
  const input = fields as Record<string, unknown>;
  const update: { name?: string; color?: string } = {};

  if ("name" in input) update.name = parseName(input.name);
  if ("color" in input) update.color = parseColor(input.color);

  if (Object.keys(update).length === 0) {
    throw new Error("수정할 필드가 없습니다");
  }

  const { supabase, user } = await requireUser();

  // 명시적 user_id 필터 — RLS 와 별개의 다층 방어. tasks/actions.ts 와 동일.
  const { error } = await supabase
    .from("projects")
    .update(update)
    .eq("id", projectId)
    .eq("user_id", user.id);

  if (error) throw translateDbError("프로젝트 수정 실패", error);

  revalidatePath("/");
}

/* ─── deleteProject ────────────────────────────────────────── */

/**
 * 소속 task 는 DB 의 ON DELETE SET NULL 로 살아남고 미할당 상태가 된다.
 * (003 마이그레이션의 복합 FK 가 cross-tenant 참조도 함께 차단)
 */
export async function deleteProject(id: string) {
  const projectId = parseUuid(id);

  const { supabase, user } = await requireUser();

  const { error } = await supabase
    .from("projects")
    .delete()
    .eq("id", projectId)
    .eq("user_id", user.id);

  if (error) throw new Error(`프로젝트 삭제 실패: ${error.message}`);

  revalidatePath("/");
}
