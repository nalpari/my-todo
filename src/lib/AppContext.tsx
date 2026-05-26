"use client";

import { createContext, useContext, useOptimistic, useState, startTransition, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { type Feature, type Project, type Subtask, type Tag, type Task } from "@/lib/data";
import { type AppData } from "@/lib/queries";
import { toggleTask as toggleTaskAction, deleteTask as deleteTaskAction, updateTask as updateTaskAction } from "@/app/tasks/actions";
import { createProject as createProjectAction, updateProject as updateProjectAction, deleteProject as deleteProjectAction } from "@/app/projects/actions";
import { createTag as createTagAction, deleteTag as deleteTagAction, assignTag as assignTagAction, unassignTag as unassignTagAction } from "@/app/tags/actions";
import { createSubtask as createSubtaskAction, updateSubtask as updateSubtaskAction, deleteSubtask as deleteSubtaskAction } from "@/app/subtasks/actions";
import { DEFAULT_PROJECT_COLOR } from "@/lib/palette";

/* ─── 컨텍스트 타입 ─────────────────────────────────────────── */

/** 토스트가 같은 메시지를 연속 표시할 때도 타이머가 재시작되도록 ts 동반 */
export type AppError = { msg: string; ts: number };

type TagHue = "accent" | "muted";

type AppContextValue = {
  projects: Project[];
  tags: Tag[];
  features: Feature[];
  tasks: Task[];
  subtasks: Subtask[];
  /** currentDone: 서버에 보낼 새 done 값 계산용 (낙관 reducer 는 자체 toggle) */
  toggleTask: (id: string, currentDone: boolean) => void;
  deleteTask: (id: string) => void;
  updateTaskTitle: (id: string, title: string) => void;
  /** 새 프로젝트 — id 는 클라이언트가 crypto.randomUUID() 로 미리 발급. */
  createProject: (id: string, name: string, color?: string) => void;
  updateProject: (id: string, fields: { name?: string; color?: string }) => void;
  /** 삭제 → tasks 의 projectId 도 낙관적으로 null 로 cascade. */
  deleteProject: (id: string) => void;
  /** 새 태그 — id 는 클라이언트가 crypto.randomUUID() 로 미리 발급. */
  createTag: (id: string, name: string, hue: TagHue) => void;
  /** 삭제 → tasks.tags 에서 해당 tag 도 모두 제거 cascade (DB 의 task_tags ON DELETE CASCADE 미러). */
  deleteTag: (id: string) => void;
  assignTag: (taskId: string, tag: Tag) => void;
  unassignTag: (taskId: string, tagId: string) => void;
  /** 새 서브태스크 — id 는 클라이언트가 crypto.randomUUID() 로 미리 발급. */
  createSubtask: (id: string, taskId: string, title: string) => void;
  toggleSubtask: (id: string, taskId: string, currentDone: boolean) => void;
  updateSubtaskTitle: (id: string, title: string) => void;
  deleteSubtask: (id: string, taskId: string, wasDone: boolean) => void;
  /** 가장 최근 액션 실패. null 이면 토스트 숨김 */
  error: AppError | null;
  /** 외부에서도 에러 띄울 수 있게 노출 (예: InputBar) */
  reportError: (msg: string) => void;
  dismissError: () => void;
};

const AppContext = createContext<AppContextValue | null>(null);

/* ─── 낙관 reducer 의 통합 state 와 액션 타입 ──────────────── */

type OptimisticState = { projects: Project[]; tags: Tag[]; features: Feature[]; tasks: Task[]; subtasks: Subtask[] };

type OptimisticAction =
  | { type: "task.toggle"; id: string }
  | { type: "task.delete"; id: string }
  | { type: "task.updateTitle"; id: string; title: string }
  | { type: "project.create"; project: Project }
  | { type: "project.update"; id: string; name?: string; color?: string }
  | { type: "project.delete"; id: string }
  | { type: "tag.create"; tag: Tag }
  | { type: "tag.delete"; id: string }
  | { type: "tag.assign"; taskId: string; tag: Tag }
  | { type: "tag.unassign"; taskId: string; tagId: string }
  | { type: "subtask.create"; subtask: Subtask }
  | { type: "subtask.toggle"; id: string; taskId: string }
  | { type: "subtask.updateTitle"; id: string; title: string }
  | { type: "subtask.delete"; id: string; taskId: string; wasDone: boolean };

function reducer(state: OptimisticState, action: OptimisticAction): OptimisticState {
  switch (action.type) {
    case "task.toggle":
      return {
        ...state,
        tasks: state.tasks.map((t) => (t.id === action.id ? { ...t, done: !t.done } : t)),
      };
    case "task.delete":
      // DB 의 ON DELETE CASCADE 미러 — 해당 task 의 subtasks 도 함께 제거.
      return {
        ...state,
        tasks: state.tasks.filter((t) => t.id !== action.id),
        subtasks: state.subtasks.filter((s) => s.task_id !== action.id),
      };
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
    case "project.delete": {
      // cascade:
      //   - 이 프로젝트에 속한 task 들의 projectId → null (DB: tasks.project_id ON DELETE SET NULL).
      //   - 이 프로젝트 소속 features → 삭제 (DB: features.project_id ON DELETE CASCADE).
      //   - 그 feature 들을 참조하던 task.featureId → null (DB: tasks.feature_id ON DELETE SET NULL).
      const orphanedFeatureIds = new Set(
        state.features.filter((f) => f.projectId === action.id).map((f) => f.id),
      );
      return {
        ...state,
        projects: state.projects.filter((p) => p.id !== action.id),
        features: state.features.filter((f) => f.projectId !== action.id),
        tasks: state.tasks.map((t) => {
          const next = { ...t };
          if (t.projectId === action.id) next.projectId = null;
          if (t.featureId && orphanedFeatureIds.has(t.featureId)) next.featureId = null;
          return next;
        }),
      };
    }
    case "tag.create":
      return { ...state, tags: [...state.tags, action.tag] };
    case "tag.delete":
      // cascade: DB 의 task_tags ON DELETE CASCADE 와 동일 — 소속 task 의 tags 배열에서 제거.
      return {
        ...state,
        tags: state.tags.filter((g) => g.id !== action.id),
        tasks: state.tasks.map((t) =>
          t.tags.some((tg) => tg.id === action.id)
            ? { ...t, tags: t.tags.filter((tg) => tg.id !== action.id) }
            : t,
        ),
      };
    case "tag.assign":
      return {
        ...state,
        tasks: state.tasks.map((t) =>
          t.id === action.taskId && !t.tags.some((tg) => tg.id === action.tag.id)
            ? { ...t, tags: [...t.tags, action.tag] }
            : t,
        ),
      };
    case "tag.unassign":
      return {
        ...state,
        tasks: state.tasks.map((t) =>
          t.id === action.taskId ? { ...t, tags: t.tags.filter((tg) => tg.id !== action.tagId) } : t,
        ),
      };
    case "subtask.create":
      // tasks.subtotal 도 함께 증가 — DB 트리거의 결과 미러.
      return {
        ...state,
        subtasks: [...state.subtasks, action.subtask],
        tasks: state.tasks.map((t) =>
          t.id === action.subtask.task_id ? { ...t, subtotal: t.subtotal + 1 } : t,
        ),
      };
    case "subtask.toggle": {
      const target = state.subtasks.find((s) => s.id === action.id);
      if (!target) return state;
      const delta = target.done ? -1 : +1;
      return {
        ...state,
        subtasks: state.subtasks.map((s) =>
          s.id === action.id ? { ...s, done: !s.done } : s,
        ),
        tasks: state.tasks.map((t) =>
          t.id === action.taskId ? { ...t, subdone: t.subdone + delta } : t,
        ),
      };
    }
    case "subtask.updateTitle":
      return {
        ...state,
        subtasks: state.subtasks.map((s) =>
          s.id === action.id ? { ...s, title: action.title } : s,
        ),
      };
    case "subtask.delete":
      // subtotal 은 항상 -1. subdone 은 wasDone 일 때만 -1.
      return {
        ...state,
        subtasks: state.subtasks.filter((s) => s.id !== action.id),
        tasks: state.tasks.map((t) =>
          t.id === action.taskId
            ? { ...t, subtotal: t.subtotal - 1, subdone: action.wasDone ? t.subdone - 1 : t.subdone }
            : t,
        ),
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
    { projects: appData.projects, tags: appData.tags, features: appData.features, tasks: appData.tasks, subtasks: appData.subtasks },
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

  const createTag = (id: string, name: string, hue: TagHue) => {
    startTransition(() => {
      applyOptimistic({ type: "tag.create", tag: { id, name, hue } });
      void runAction(() => createTagAction(id, name, hue));
    });
  };

  const deleteTag = (id: string) => {
    startTransition(() => {
      applyOptimistic({ type: "tag.delete", id });
      void runAction(() => deleteTagAction(id));
    });
  };

  const assignTag = (taskId: string, tag: Tag) => {
    startTransition(() => {
      applyOptimistic({ type: "tag.assign", taskId, tag });
      void runAction(() => assignTagAction(taskId, tag.id));
    });
  };

  const unassignTag = (taskId: string, tagId: string) => {
    startTransition(() => {
      applyOptimistic({ type: "tag.unassign", taskId, tagId });
      void runAction(() => unassignTagAction(taskId, tagId));
    });
  };

  const createSubtask = (id: string, taskId: string, title: string) => {
    const now = new Date().toISOString();
    startTransition(() => {
      applyOptimistic({
        type: "subtask.create",
        subtask: { id, task_id: taskId, title, done: false, sort_order: 0, created_at: now },
      });
      void runAction(() => createSubtaskAction(id, taskId, title));
    });
  };

  const toggleSubtask = (id: string, taskId: string, currentDone: boolean) => {
    startTransition(() => {
      applyOptimistic({ type: "subtask.toggle", id, taskId });
      void runAction(() => updateSubtaskAction(id, { done: !currentDone }));
    });
  };

  const updateSubtaskTitle = (id: string, title: string) => {
    startTransition(() => {
      applyOptimistic({ type: "subtask.updateTitle", id, title });
      void runAction(() => updateSubtaskAction(id, { title }));
    });
  };

  const deleteSubtask = (id: string, taskId: string, wasDone: boolean) => {
    startTransition(() => {
      applyOptimistic({ type: "subtask.delete", id, taskId, wasDone });
      void runAction(() => deleteSubtaskAction(id));
    });
  };

  const reportError = (msg: string) => setError({ msg, ts: Date.now() });
  const dismissError = () => setError(null);

  return (
    <AppContext.Provider
      value={{
        projects: optimistic.projects,
        tags: optimistic.tags,
        features: optimistic.features,
        tasks: optimistic.tasks,
        subtasks: optimistic.subtasks,
        toggleTask,
        deleteTask,
        updateTaskTitle,
        createProject,
        updateProject,
        deleteProject,
        createTag,
        deleteTag,
        assignTag,
        unassignTag,
        createSubtask,
        toggleSubtask,
        updateSubtaskTitle,
        deleteSubtask,
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
