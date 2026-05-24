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

/* ─── createTask ────────────────────────────────────────────── */

export async function createTask(formData: FormData) {
  const title = (formData.get("title") as string | null)?.trim();
  if (!title) throw new Error("제목을 입력해 주세요");

  const projectId = (formData.get("project_id") as string | null) || null;
  const dueDate = (formData.get("due_date") as string | null) || null;
  const dueTime = (formData.get("due_time") as string | null) || null;

  const { supabase, user } = await requireUser();

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

export async function updateTask(
  id: string,
  fields: { title?: string; due_date?: string | null; due_time?: string | null; project_id?: string | null },
) {
  const { supabase, user } = await requireUser();

  const { error } = await supabase
    .from("tasks")
    .update(fields)
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
