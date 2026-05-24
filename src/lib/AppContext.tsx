"use client";

import { createContext, useContext, useOptimistic, useState, startTransition, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { type Project, type Tag, type Task } from "@/lib/data";
import { type AppData } from "@/lib/queries";
import { toggleTask as toggleTaskAction, deleteTask as deleteTaskAction, updateTask as updateTaskAction } from "@/app/tasks/actions";
import { createProject as createProjectAction, updateProject as updateProjectAction, deleteProject as deleteProjectAction } from "@/app/projects/actions";
import { DEFAULT_PROJECT_COLOR } from "@/lib/palette";

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
  /** 새 프로젝트 — id 는 클라이언트가 crypto.randomUUID() 로 미리 발급. */
  createProject: (id: string, name: string, color?: string) => void;
  updateProject: (id: string, fields: { name?: string; color?: string }) => void;
  /** 삭제 → tasks 의 project 도 낙관적으로 null 로 cascade. */
  deleteProject: (id: string) => void;
  /** 가장 최근 액션 실패. null 이면 토스트 숨김 */
  error: AppError | null;
  /** 외부에서도 에러 띄울 수 있게 노출 (예: InputBar) */
  reportError: (msg: string) => void;
  dismissError: () => void;
};

const AppContext = createContext<AppContextValue | null>(null);

/* ─── 낙관 reducer 의 통합 state 와 액션 타입 ──────────────── */

type OptimisticState = { projects: Project[]; tasks: Task[] };

type OptimisticAction =
  | { type: "task.toggle"; id: string }
  | { type: "task.delete"; id: string }
  | { type: "task.updateTitle"; id: string; title: string }
  | { type: "project.create"; project: Project }
  | { type: "project.update"; id: string; name?: string; color?: string }
  | { type: "project.delete"; id: string };

function reducer(state: OptimisticState, action: OptimisticAction): OptimisticState {
  switch (action.type) {
    case "task.toggle":
      return {
        ...state,
        tasks: state.tasks.map((t) => (t.id === action.id ? { ...t, done: !t.done } : t)),
      };
    case "task.delete":
      return { ...state, tasks: state.tasks.filter((t) => t.id !== action.id) };
    case "task.updateTitle":
      return {
        ...state,
        tasks: state.tasks.map((t) => (t.id === action.id ? { ...t, title: action.title } : t)),
      };
    case "project.create":
      return { ...state, projects: [...state.projects, action.project] };
    case "project.update":
      return {
        ...state,
        projects: state.projects.map((p) =>
          p.id === action.id
            ? { ...p, ...(action.name !== undefined ? { name: action.name } : {}), ...(action.color !== undefined ? { color: action.color } : {}) }
            : p,
        ),
      };
    case "project.delete":
      // cascade: 이 프로젝트에 속한 task 들의 project 필드도 null 로.
      // DB 의 ON DELETE SET NULL 과 동일한 결과를 클라이언트에 미리 반영해
      // revalidate 전 0.1-0.3s 동안 lookup miss 가 깜박이지 않게 한다.
      return {
        projects: state.projects.filter((p) => p.id !== action.id),
        tasks: state.tasks.map((t) => (t.project === action.id ? { ...t, project: null } : t)),
      };
    default:
      return state;
  }
}

/* ─── Provider ──────────────────────────────────────────────── */

export function AppProvider({ appData, children }: { appData: AppData; children: ReactNode }) {
  const router = useRouter();
  const [error, setError] = useState<AppError | null>(null);

  const [optimistic, applyOptimistic] = useOptimistic(
    { projects: appData.projects, tasks: appData.tasks },
    reducer,
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
      applyOptimistic({ type: "task.toggle", id });
      void runAction(() => toggleTaskAction(id, !currentDone));
    });
  };

  const deleteTask = (id: string) => {
    startTransition(() => {
      applyOptimistic({ type: "task.delete", id });
      void runAction(() => deleteTaskAction(id));
    });
  };

  const updateTaskTitle = (id: string, title: string) => {
    startTransition(() => {
      applyOptimistic({ type: "task.updateTitle", id, title });
      void runAction(() => updateTaskAction(id, { title }));
    });
  };

  const createProject = (id: string, name: string, color?: string) => {
    const finalColor = color ?? DEFAULT_PROJECT_COLOR;
    startTransition(() => {
      applyOptimistic({
        type: "project.create",
        project: { id, name, color: finalColor, count: 0 },
      });
      void runAction(() => createProjectAction(id, name, finalColor));
    });
  };

  const updateProject = (id: string, fields: { name?: string; color?: string }) => {
    startTransition(() => {
      applyOptimistic({ type: "project.update", id, ...fields });
      void runAction(() => updateProjectAction(id, fields));
    });
  };

  const deleteProject = (id: string) => {
    startTransition(() => {
      applyOptimistic({ type: "project.delete", id });
      void runAction(() => deleteProjectAction(id));
    });
  };

  const reportError = (msg: string) => setError({ msg, ts: Date.now() });
  const dismissError = () => setError(null);

  return (
    <AppContext.Provider
      value={{
        projects: optimistic.projects,
        tags: appData.tags,
        tasks: optimistic.tasks,
        toggleTask,
        deleteTask,
        updateTaskTitle,
        createProject,
        updateProject,
        deleteProject,
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
