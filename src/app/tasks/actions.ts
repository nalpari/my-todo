"use server";

import { revalidatePath } from "next/cache";
import { createMutableClient } from "@/lib/supabase/server";

/* ─── createTask ────────────────────────────────────────────── */

export async function createTask(formData: FormData) {
  const title = (formData.get("title") as string | null)?.trim();
  if (!title) return;

  const projectId = (formData.get("project_id") as string | null) || null;
  const dueDate = (formData.get("due_date") as string | null) || null;
  const dueTime = (formData.get("due_time") as string | null) || null;

  const supabase = await createMutableClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  const { error } = await supabase.from("tasks").insert({
    user_id: user.id,
    title,
    project_id: projectId,
    due_date: dueDate,
    due_time: dueTime,
  });

  if (error) {
    console.error("[createTask]", error.message);
    return;
  }

  revalidatePath("/");
}

/* ─── toggleTask ────────────────────────────────────────────── */

export async function toggleTask(id: string, done: boolean) {
  const supabase = await createMutableClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  const { error } = await supabase
    .from("tasks")
    .update({ done })
    .eq("id", id)
    .eq("user_id", user.id); // 소유자 검증

  if (error) {
    console.error("[toggleTask]", error.message);
  }

  revalidatePath("/");
}

/* ─── updateTask ────────────────────────────────────────────── */

export async function updateTask(
  id: string,
  fields: { title?: string; due_date?: string | null; due_time?: string | null; project_id?: string | null },
) {
  const supabase = await createMutableClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  const { error } = await supabase
    .from("tasks")
    .update(fields)
    .eq("id", id)
    .eq("user_id", user.id); // 소유자 검증

  if (error) {
    console.error("[updateTask]", error.message);
  }

  revalidatePath("/");
}

/* ─── deleteTask ────────────────────────────────────────────── */

export async function deleteTask(id: string) {
  const supabase = await createMutableClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  const { error } = await supabase
    .from("tasks")
    .delete()
    .eq("id", id)
    .eq("user_id", user.id); // 소유자 검증

  if (error) {
    console.error("[deleteTask]", error.message);
  }

  revalidatePath("/");
}
