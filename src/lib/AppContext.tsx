"use client";

import { createContext, useContext, useOptimistic, useState, startTransition, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { type Project, type Tag, type Task } from "@/lib/data";
import { type AppData } from "@/lib/queries";
import { toggleTask as toggleTaskAction, deleteTask as deleteTaskAction, updateTask as updateTaskAction } from "@/app/tasks/actions";

/* ─── 컨텍스트 타입 ─────────────────────────────────────────── */

/** 토스트가 같은 메시지를 연속 표시할 때도 타이머가 재시작되도록 ts 동반 */
export type AppError = { msg: string; ts: number };

type AppContextValue = {
  projects: Project[];
  tags: Tag[];
  tasks: Task[];
  /** currentDone: 서버에 보낼 새 done 값 계산용 (낙관 reducer 는 자체 toggle) */
  toggleTask: (id: string, currentDone: boolean) => void;
  deleteTask: (id: string) => void;
  updateTaskTitle: (id: string, title: string) => void;
  /** 가장 최근 액션 실패. null 이면 토스트 숨김 */
  error: AppError | null;
  /** 외부에서도 에러 띄울 수 있게 노출 (예: InputBar) */
  reportError: (msg: string) => void;
  dismissError: () => void;
};

const AppContext = createContext<AppContextValue | null>(null);

/* ─── Provider ──────────────────────────────────────────────── */

export function AppProvider({ appData, children }: { appData: AppData; children: ReactNode }) {
  const router = useRouter();
  const [error, setError] = useState<AppError | null>(null);

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
  //
  // Server Action 이 throw 하면 (1) try/catch 로 잡아 에러 메시지를 띄우고
  // (2) router.refresh() 로 서버 상태를 다시 가져와 낙관 잔존을 정정한다.
  // react-compiler 가 메모이제이션을 처리하므로 useCallback 은 쓰지 않는다.
  const runAction = async (action: () => Promise<void>) => {
    try {
      await action();
      setError(null);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "알 수 없는 오류";
      setError({ msg, ts: Date.now() });
      router.refresh();
    }
  };

  const toggleTask = (id: string, currentDone: boolean) => {
    startTransition(() => {
      applyOptimistic({ type: "toggle", id });
      void runAction(() => toggleTaskAction(id, !currentDone));
    });
  };

  const deleteTask = (id: string) => {
    startTransition(() => {
      applyOptimistic({ type: "delete", id });
      void runAction(() => deleteTaskAction(id));
    });
  };

  const updateTaskTitle = (id: string, title: string) => {
    startTransition(() => {
      applyOptimistic({ type: "updateTitle", id, title });
      void runAction(() => updateTaskAction(id, { title }));
    });
  };

  const reportError = (msg: string) => setError({ msg, ts: Date.now() });
  const dismissError = () => setError(null);

  return (
    <AppContext.Provider
      value={{
        projects: appData.projects,
        tags: appData.tags,
        tasks: optimisticTasks,
        toggleTask,
        deleteTask,
        updateTaskTitle,
        error,
        reportError,
        dismissError,
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
