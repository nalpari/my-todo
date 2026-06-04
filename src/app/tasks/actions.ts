"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createMutableClient } from "@/lib/supabase/server";
import { parseTaskInput } from "@/lib/data";

async function requireUser() {
  const supabase = await createMutableClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?error=session_expired");
  return { supabase, user };
}

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const HHMM_RE = /^([01]\d|2[0-3]):[0-5]\d$/;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const MAX_TITLE_LEN = 500;
const MAX_PROJECT_NAME_LEN = 50;
const MAX_FEATURE_NAME_LEN = 50;
const MAX_TAG_NAME_LEN = 30;

/** trim + 연속 공백 1개로 정규화. projects/tags actions 의 parseName 과 동일 규칙. */
function normalizeName(raw: string): string {
  return raw.trim().replace(/\s+/g, " ");
}

function parseProjectName(raw: string): string {
  const n = normalizeName(raw);
  if (!n) throw new Error("프로젝트 이름을 입력해 주세요");
  if (n.length > MAX_PROJECT_NAME_LEN) {
    throw new Error(`프로젝트 이름은 ${MAX_PROJECT_NAME_LEN}자 이내`);
  }
  return n;
}

function parseFeatureName(raw: string): string {
  const n = normalizeName(raw);
  if (!n) throw new Error("기능 이름을 입력해 주세요");
  if (n.length > MAX_FEATURE_NAME_LEN) {
    throw new Error(`기능 이름은 ${MAX_FEATURE_NAME_LEN}자 이내`);
  }
  return n;
}

function parseTagName(raw: string): string {
  const n = normalizeName(raw);
  if (!n) throw new Error("태그 이름을 입력해 주세요");
  if (n.length > MAX_TAG_NAME_LEN) {
    throw new Error(`태그 이름은 ${MAX_TAG_NAME_LEN}자 이내`);
  }
  return n;
}

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
 * projects/tags/actions.ts 와 동일한 변환 규칙.
 * 23505 (unique_violation) → "이미 사용 중인 이름입니다"
 * 23503 (foreign_key_violation) → "참조 대상을 찾을 수 없습니다"
 */
function translateDbError(prefix: string, error: { code?: string; message: string }): Error {
  if (error.code === "23505") return new Error("이미 사용 중인 이름입니다");
  if (error.code === "23503") return new Error("참조 대상을 찾을 수 없습니다");
  return new Error(`${prefix}: ${error.message}`);
}

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

/**
 * SELECT-then-INSERT 의 race window 를 보완: INSERT 가 23505 로 실패하면
 * 동시 요청이 같은 이름을 먼저 만들었다는 뜻이므로 다시 SELECT 해서 그 id 를
 * 돌려준다. 일반 케이스(이미 존재)는 1 query, 신규 1 query, race 시 3 queries.
 */
async function ensureProject(
  supabase: Awaited<ReturnType<typeof createMutableClient>>,
  name: string,
  userId: string,
): Promise<string> {
  const { data: existing } = await supabase
    .from("projects")
    .select("id")
    .eq("user_id", userId)
    .eq("name", name)
    .maybeSingle();

  if (existing) return existing.id;

  const { data, error } = await supabase
    .from("projects")
    .insert({ user_id: userId, name })
    .select("id")
    .single();

  if (!error) return data.id;

  if (error.code === "23505") {
    const { data: raced } = await supabase
      .from("projects")
      .select("id")
      .eq("user_id", userId)
      .eq("name", name)
      .maybeSingle();
    if (raced) return raced.id;
  }

  throw translateDbError("프로젝트 생성 실패", error);
}

async function ensureFeature(
  supabase: Awaited<ReturnType<typeof createMutableClient>>,
  projectId: string,
  name: string,
  userId: string,
): Promise<string> {
  const { data: existing } = await supabase
    .from("features")
    .select("id")
    .eq("user_id", userId)
    .eq("project_id", projectId)
    .eq("name", name)
    .maybeSingle();

  if (existing) return existing.id;

  const { data, error } = await supabase
    .from("features")
    .insert({ user_id: userId, project_id: projectId, name })
    .select("id")
    .single();

  if (!error) return data.id;

  if (error.code === "23505") {
    const { data: raced } = await supabase
      .from("features")
      .select("id")
      .eq("user_id", userId)
      .eq("project_id", projectId)
      .eq("name", name)
      .maybeSingle();
    if (raced) return raced.id;
  }

  throw translateDbError("기능 생성 실패", error);
}

async function ensureTags(
  supabase: Awaited<ReturnType<typeof createMutableClient>>,
  names: string[],
  userId: string,
): Promise<string[]> {
  const ids: string[] = [];

  for (const name of names) {
    const { data: existing } = await supabase
      .from("tags")
      .select("id")
      .eq("user_id", userId)
      .eq("name", name)
      .maybeSingle();

    if (existing) {
      ids.push(existing.id);
      continue;
    }

    const { data, error } = await supabase
      .from("tags")
      .insert({ user_id: userId, name })
      .select("id")
      .single();

    if (!error) {
      ids.push(data.id);
      continue;
    }

    if (error.code === "23505") {
      const { data: raced } = await supabase
        .from("tags")
        .select("id")
        .eq("user_id", userId)
        .eq("name", name)
        .maybeSingle();
      if (raced) {
        ids.push(raced.id);
        continue;
      }
    }

    throw translateDbError("태그 생성 실패", error);
  }

  return ids;
}

/**
 * tag_ids 로 들어온 ID 들이 user 소유임을 검증하고 ID 배열을 반환. 미소유/미존재
 * ID 가 하나라도 있으면 throw — 입력은 owner 가 만든 picker 라 안전 가정이지만
 * RLS 우회 시 방어. 003 의 복합 FK 도 cross-tenant 를 차단하지만 raw 23503 보다
 * 명확한 한국어 에러.
 */
async function assertOwnedTags(
  supabase: Awaited<ReturnType<typeof createMutableClient>>,
  ids: string[],
  userId: string,
): Promise<string[]> {
  if (ids.length === 0) return [];
  const { data, error } = await supabase
    .from("tags")
    .select("id")
    .eq("user_id", userId)
    .in("id", ids);
  if (error) throw new Error(`태그 검증 실패: ${error.message}`);
  if (!data || data.length !== ids.length) {
    throw new Error("일부 태그를 찾을 수 없거나 소유권이 없습니다");
  }
  return data.map((d) => d.id);
}

export async function createTask(formData: FormData) {
  const rawInput = formData.get("input");
  if (typeof rawInput !== "string" || !rawInput.trim()) {
    throw new Error("할 일을 입력해 주세요");
  }

  const parsed = parseTaskInput(rawInput);
  if (!parsed) {
    throw new Error("할 일을 입력해 주세요");
  }

  const title = parseTitle(parsed.title);
  const tagNames = parsed.tags.map(parseTagName);
  const dueDate = parseNullableDate(formData.get("due_date"));
  const dueTime = parseNullableTime(formData.get("due_time"));
  // 입력에 `[project]` 토큰이 없을 때 InputBar 가 활성 프로젝트 필터를
  // fallback 으로 전달 — 기존 quick-add 경험을 유지.
  const fallbackProjectId = parseNullableUuid(formData.get("project_id"));
  // 픽커로 선택된 태그 ID (comma-separated UUIDs). 인풋 `#tag` 와 같은 사용자
  // 의도 두 경로 — 서버에서 두 결과의 union 으로 dedupe.
  const rawTagIds = formData.get("tag_ids");
  // Set 으로 중복 id 제거 — assertOwnedTags 가 `data.length !== ids.length` 로
  // 소유권을 검증하므로, client 가 같은 id 를 두 번 보내면 길이 불일치로 소유한
  // 태그가 "소유권 없음" 으로 오발화한다. 진입부에서 dedupe 해 false-negative 차단.
  const tagIdsFromForm =
    typeof rawTagIds === "string" && rawTagIds.length > 0
      ? Array.from(new Set(rawTagIds.split(",").map((s) => s.trim()).filter(Boolean)))
      : [];
  // 빈 문자열은 위에서 이미 제거됨 — parseNullableUuid 는 throw 이므로
  // 잘못된 포맷은 즉시 잡혀 사용자 의도(클릭 시점의 ID) 가 아닌 입력 오류로 표면화.
  const parsedTagIds = tagIdsFromForm
    .map((id) => parseNullableUuid(id))
    .filter((id): id is string => id !== null);

  const { supabase, user } = await requireUser();

  // projectId 결정: 입력 토큰 > fallback > null.
  let projectId: string | null = null;
  if (parsed.project) {
    const projectName = parseProjectName(parsed.project);
    projectId = await ensureProject(supabase, projectName, user.id);
  } else if (fallbackProjectId) {
    await assertOwnedProject(supabase, fallbackProjectId, user.id);
    projectId = fallbackProjectId;
  }

  // featureId 는 project 와 짝일 때만. parsed.feature 는 regex 상 parsed.project
  // 없이 단독으로 올 수 없음 — 안전한 가드라기보다 명시적 의도 표현.
  let featureId: string | null = null;
  if (projectId && parsed.feature) {
    const featureName = parseFeatureName(parsed.feature);
    featureId = await ensureFeature(supabase, projectId, featureName, user.id);
  }

  const tagIdsFromNames = tagNames.length > 0 ? await ensureTags(supabase, tagNames, user.id) : [];
  const tagIdsFromPicker = await assertOwnedTags(supabase, parsedTagIds, user.id);
  // dedupe by id — 같은 태그가 인풋과 픽커 양쪽에서 들어와도 1회만 insert.
  const tagIds = Array.from(new Set([...tagIdsFromNames, ...tagIdsFromPicker]));

  const { data: task, error: taskError } = await supabase
    .from("tasks")
    .insert({
      user_id: user.id,
      title,
      project_id: projectId,
      feature_id: featureId,
      due_date: dueDate,
      due_time: dueTime,
    })
    .select("id")
    .single();

  if (taskError) throw translateDbError("task 생성 실패", taskError);

  if (tagIds.length > 0) {
    const { error: tagError } = await supabase.from("task_tags").insert(
      tagIds.map((tagId) => ({
        task_id: task.id,
        tag_id: tagId,
        user_id: user.id,
      })),
    );

    if (tagError) throw translateDbError("태그 연결 실패", tagError);
  }

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
