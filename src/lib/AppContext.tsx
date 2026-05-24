"use client";

import { createContext, useContext, useOptimistic, useCallback, startTransition, type ReactNode } from "react";
import { type Project, type Tag, type Task } from "@/lib/data";
import { type AppData } from "@/lib/queries";
import { toggleTask as toggleTaskAction, deleteTask as deleteTaskAction, updateTask as updateTaskAction } from "@/app/tasks/actions";

/* ─── 컨텍스트 타입 ─────────────────────────────────────────── */

type AppContextValue = {
  projects: Project[];
  tags: Tag[];
  tasks: Task[];
  /** currentDone: 현재 표시 중인 done 값. stale closure 방지용 */
  toggleTask: (id: string, currentDone: boolean) => void;
  deleteTask: (id: string) => void;
  updateTaskTitle: (id: string, title: string) => void;
};

const AppContext = createContext<AppContextValue | null>(null);

/* ─── Provider ──────────────────────────────────────────────── */

export function AppProvider({ appData, children }: { appData: AppData; children: ReactNode }) {
  const [optimisticTasks, applyOptimistic] = useOptimistic(
    appData.tasks,
    (tasks: Task[], update: { type: "toggle"; id: string } | { type: "delete"; id: string } | { type: "updateTitle"; id: string; title: string }) => {
      if (update.type === "toggle") {
        return tasks.map((t) => (t.id === update.id ? { ...t, done: !t.done } : t));
      }
      if (update.type === "delete") {
        return tasks.filter((t) => t.id !== update.id);
      }
      if (update.type === "updateTitle") {
        return tasks.map((t) => (t.id === update.id ? { ...t, title: update.title } : t));
      }
      return tasks;
    },
  );

  // useOptimistic dispatch 는 transition/action 안에서만 호출해야 함 (React 19).
  // 일반 onClick 핸들러에서 직접 호출하면 "Optimistic state update outside Transition or Action" 경고.
  const toggleTask = useCallback(
    (id: string, currentDone: boolean) => {
      startTransition(async () => {
        applyOptimistic({ type: "toggle", id });
        await toggleTaskAction(id, !currentDone);
      });
    },
    [applyOptimistic],
  );

  const deleteTask = useCallback(
    (id: string) => {
      startTransition(async () => {
        applyOptimistic({ type: "delete", id });
        await deleteTaskAction(id);
      });
    },
    [applyOptimistic],
  );

  const updateTaskTitle = useCallback(
    (id: string, title: string) => {
      startTransition(async () => {
        applyOptimistic({ type: "updateTitle", id, title });
        await updateTaskAction(id, { title });
      });
    },
    [applyOptimistic],
  );

  return (
    <AppContext.Provider
      value={{
        projects: appData.projects,
        tags: appData.tags,
        tasks: optimisticTasks,
        toggleTask,
        deleteTask,
        updateTaskTitle,
      }}
    >
      {children}
    </AppContext.Provider>
  );
}

/* ─── Hook ──────────────────────────────────────────────────── */

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error("useApp must be used inside AppProvider");
  return ctx;
}
