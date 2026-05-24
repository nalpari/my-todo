"use client";

import type { CSSProperties } from "react";
import { useState, useEffect, useRef } from "react";
import { useSearchParams } from "next/navigation";
import { Checkbox, MonoLabel, ProjectDot } from "./Primitives";
import { AppSidebar, AppTopBar, InputBar, type DisplayUser } from "./AppShell";
import { MiniCalendar, SubtaskMeter } from "./TaskRow";
import { TaskList, EmptyState } from "./TaskList";
import { AppProvider, useApp } from "@/lib/AppContext";
import { toISODate, type Task } from "@/lib/data";
import { type AppData } from "@/lib/queries";
import { TagChip } from "./Primitives";
import {
  parseView,
  parseProjectId,
  filterTasks,
  filterBySearch,
  viewTitle,
  viewSubtitleContext,
} from "@/lib/view";

/* ─── ErrorToast ────────────────────────────────────────────── */
const ErrorToast = () => {
  const { error, dismissError } = useApp();

  // error 가 { msg, ts } 객체라 같은 메시지가 연속 발생해도 ts 가 달라
  // useEffect 가 재실행되고 4초 타이머가 재시작된다.
  useEffect(() => {
    if (!error) return;
    const id = setTimeout(() => dismissError(), 4000);
    return () => clearTimeout(id);
  }, [error, dismissError]);

  if (!error) return null;

  return (
    <div
      role="alert"
      aria-live="assertive"
      style={{
        position: "fixed", left: "50%", bottom: 92,
        transform: "translateX(-50%)",
        display: "flex", alignItems: "center", gap: 10,
        padding: "10px 14px",
        borderRadius: "var(--radius)",
        border: "1px solid var(--border-accent)",
        background: "rgba(45,44,42,0.96)",
        boxShadow: "var(--shadow-lg)",
        color: "var(--accent-bright)",
        fontSize: 13, letterSpacing: -0.1,
        zIndex: 100,
        maxWidth: "min(520px, calc(100% - 80px))",
      }}
    >
      <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--accent)", letterSpacing: 0.5 }} aria-hidden="true">!</span>
      <span style={{ flex: 1, color: "var(--text-display)" }}>{error.msg}</span>
      <button
        onClick={dismissError}
        aria-label="닫기"
        type="button"
        style={{
          width: 18, height: 18, borderRadius: 3,
          background: "transparent", border: "1px solid transparent",
          color: "var(--text-muted)", cursor: "pointer",
          fontSize: 14, lineHeight: 1, padding: 0,
          outlineOffset: 1,
        }}
      >
        ×
      </button>
    </div>
  );
};

/* ─── Variant B: Calendar + Timeline Split ─────────────────── */
export const VariantBSplit = ({ user, appData }: { user: DisplayUser; appData: AppData }) => {
  return (
    <AppProvider appData={appData}>
      <VariantBSplitInner user={user} />
    </AppProvider>
  );
};

/* ─── 실시간 시계 훅 ─────────────────────────────────────────── */
function useLiveClock() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(id);
  }, []);
  return now;
}

/* ─── 내부 컴포넌트 (AppProvider 안) ─────────────────────────── */
const VariantBSplitInner = ({ user }: { user: DisplayUser }) => {
  const now = useLiveClock();
  const { tasks: allTasks, projects } = useApp();
  const searchParams = useSearchParams();

  const view = parseView(searchParams.get("view"));
  const activeProjectId = parseProjectId(searchParams.get("project"));
  const activeProject = activeProjectId ? projects.find((p) => p.id === activeProjectId) ?? null : null;

  // 검색은 URL 에 넣지 않는 client-only state (Round 3 Q2-e). 뷰 전환·새로고침 시 리셋.
  const [searchQuery, setSearchQuery] = useState("");
  const searchInputRef = useRef<HTMLInputElement | null>(null);
  const isSearching = searchQuery.trim().length > 0;

  // ⌘K (mac) / Ctrl+K (Win) → 검색 input 포커스. 입력 중인 다른 input/textarea 가
  // 있어도 우선 — 어느 곳에서든 검색으로 점프. Esc 는 input 의 onKeyDown 이 처리.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && (e.key === "k" || e.key === "K")) {
        e.preventDefault();
        searchInputRef.current?.focus();
        searchInputRef.current?.select();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  // 필터 체인: view → project → search. 우측 rail 의 다가오는 일정·분포 차트는
  // 의도적으로 전역 allTasks 사용 — 필터·검색 컨텍스트와 독립된 peripheral view.
  const visibleTasks = filterBySearch(
    filterTasks(allTasks, view, activeProjectId),
    searchQuery,
    projects,
  );

  const today = now;
  const todayISO = toISODate(today);

  // TopBar 라벨 — 검색 활성이면 subtitle 앞에 검색 표식.
  const title = viewTitle(view);
  const subtitleContext = viewSubtitleContext(view, today);
  const baseSubtitle =
    `${subtitleContext} · ${visibleTasks.length} tasks` +
    (activeProject ? ` · ${activeProject.name}` : "");
  const subtitle = isSearching ? `검색: "${searchQuery.trim()}" · ${baseSubtitle}` : baseSubtitle;

  // 중앙 분기 — 검색 활성 + 0 결과면 EmptyState (뷰별 메시지 부적절).
  // 그 외엔 view==="today" → TodayTimeline (시간 0개도 "all clear" 유지), else → TaskList.
  const renderCenter = () => {
    if (isSearching && visibleTasks.length === 0) {
      return <EmptyState primary="검색 결과가 없습니다" mono={`"${searchQuery.trim()}"`} />;
    }
    if (view === "today") {
      return (
        <TodayTimeline
          visibleTasks={visibleTasks}
          today={today}
          now={now}
          todayISO={todayISO}
        />
      );
    }
    return <TaskList tasks={visibleTasks} view={view} today={today} />;
  };

  return (
    <div style={S.appRoot}>
      <AppSidebar user={user} />
      <div style={S.colMain}>
        <AppTopBar
          title={title}
          subtitle={subtitle}
          dense
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          searchInputRef={searchInputRef}
        />

        <div style={{ display: "grid", gridTemplateColumns: "1fr 320px", flex: 1, minHeight: 0 }}>
          {/* CENTER — view 에 따라 분기 */}
          <div style={{ ...S.scrollPad, paddingRight: 16 }} className="no-scrollbar">
            <div style={{ padding: "24px 32px 0" }}>
              {renderCenter()}
              <div style={{ height: 100 }} />
            </div>

            <InputBar floating />
          </div>

          {/* RIGHT RAIL — 뷰와 무관하게 일관 (Q4-f) */}
          <aside style={S.rightRail}>
            <MiniCalendar />

            <div>
              <div style={S.railHead}>
                <MonoLabel tracking={1.5}>다가오는 일정</MonoLabel>
                <a href="#" style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--accent)", textDecoration: "none", letterSpacing: 0.5 }}>
                  전체 ↗
                </a>
              </div>
              <UpcomingRail allTasks={allTasks} todayISO={todayISO} />
            </div>

            <div>
              <div style={S.railHead}>
                <MonoLabel tracking={1.5}>이번 주 진행률</MonoLabel>
              </div>
              <ProgressCard
                done={allTasks.filter((t) => t.done).length}
                total={allTasks.length}
              />
            </div>

            <div>
              <div style={S.railHead}>
                <MonoLabel tracking={1.5}>프로젝트별 분포</MonoLabel>
              </div>
              <div style={{ padding: 14, borderRadius: "var(--radius)", border: "1px solid var(--border)", background: "var(--bg-surface)", display: "flex", flexDirection: "column", gap: 10 }}>
                {projects.map((p) => (
                  <div key={p.id} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <span style={{ width: 8, height: 8, borderRadius: 2, background: p.color }} />
                    <span style={{ fontSize: 12.5, color: "var(--text-secondary)", flex: 1, letterSpacing: -0.1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {p.name}
                    </span>
                    <div style={{ width: 60, height: 3, borderRadius: 2, background: "rgba(255,255,255,0.06)", overflow: "hidden" }}>
                      <div style={{ width: `${Math.min(100, p.count * 12)}%`, height: "100%", background: p.color, opacity: 0.7 }} />
                    </div>
                    <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--text-faint)", minWidth: 16, textAlign: "right" }}>
                      {p.count}
                    </span>
                  </div>
                ))}
                {projects.length === 0 && (
                  <div style={{ fontSize: 12, color: "var(--text-faint)" }}>프로젝트 없음</div>
                )}
              </div>
            </div>
          </aside>
        </div>
      </div>
      <ErrorToast />
    </div>
  );
};

/* ─── TodayTimeline ─────────────────────────────────────────
 * 기존 hour-timeline 로직을 분리. visibleTasks 는 이미 (오늘+overdue + 프로젝트
 * 필터 + 검색) 적용된 상태. todayTasks 는 시간 그리드에 들어갈 due_date === 오늘 만.
 * overdue 는 카운트만 헤더에 표시 (시간 그리드에 자리 없음 — 기존 동작 유지).
 */
const TodayTimeline = ({
  visibleTasks,
  today,
  now,
  todayISO,
}: {
  visibleTasks: Task[];
  today: Date;
  now: Date;
  todayISO: string;
}) => {
  const todayTasks = visibleTasks.filter((t) => t.due_date === todayISO);

  // KO 요일
  const KO_DOW = ["일", "월", "화", "수", "목", "금", "토"];
  const dow = KO_DOW[today.getDay()];
  const dateStr = `${today.getMonth() + 1}월 ${today.getDate()}일, ${dow}`;

  // 영문 요일
  const EN_DOW = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  const enDow = EN_DOW[today.getDay()];

  // 오늘 태스크의 due_time 시(hour) 추출 (파싱 실패는 NaN → 제거)
  const todayTaskHours = todayTasks
    .map((t) => (t.due_time ? parseInt(t.due_time.split(":")[0] ?? "", 10) : NaN))
    .filter((h) => Number.isFinite(h) && h >= 0 && h <= 23);

  // 기본 범위(07-20)를 유지하되, 범위 밖 태스크가 있으면 동적으로 확장 — 사일런트 누락 방지.
  const minHour = Math.min(7, ...todayTaskHours);
  const maxHour = Math.max(20, ...todayTaskHours);
  const hours = Array.from({ length: maxHour - minHour + 1 }, (_, i) =>
    `${String(minHour + i).padStart(2, "0")}:00`,
  );

  // 시간 → 해당 task 매핑. due_time 파싱 실패 (NaN) 는 매칭되지 않으므로 untimedTasks 로 분류된다.
  const tasksByHour = (hour: string) => {
    const h = parseInt(hour, 10);
    return todayTasks.filter((t) => {
      if (!t.due_time) return false;
      const th = parseInt(t.due_time.split(":")[0] ?? "", 10);
      return Number.isFinite(th) && th === h;
    });
  };

  // NOW 라인이 들어갈 시간 행 계산
  const nowHour = now.getHours();
  const nowMinStr = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
  const nowRowHour = `${String(Math.max(minHour, Math.min(maxHour, nowHour))).padStart(2, "0")}:00`;

  // 타임 없는 오늘 태스크 + due_time 이 형식 오류라 어떤 시간 행에도 못 들어가는 태스크.
  const untimedTasks = todayTasks.filter((t) => {
    if (!t.due_time) return true;
    const th = parseInt(t.due_time.split(":")[0] ?? "", 10);
    return !Number.isFinite(th);
  });
  // overdue 는 필터 컨텍스트 안의 것만 카운트 (visibleTasks 가 이미 필터됨)
  const overdueTask = visibleTasks.filter((t) => t.bucket === "overdue");

  // 전체 todayTasks 가 0 일 때 빈 상태 — 시간 그리드는 그래도 그리지만 헤더 분위기만 변화.
  // (TaskList 의 EmptyState 와 달리 timeline 은 시간 자체가 컨텐츠라 유지)
  const hasAny = todayTasks.length > 0 || overdueTask.length > 0 || untimedTasks.length > 0;

  return (
    <>
      {/* editorial today header */}
      <div style={{ display: "flex", alignItems: "baseline", gap: 18, marginBottom: 20 }}>
        <div
          style={{
            fontFamily: "var(--font-display)", fontStyle: "italic",
            fontVariationSettings: '"opsz" 144, "wght" 320',
            fontSize: 72, lineHeight: 0.9,
            color: "var(--text-display)", letterSpacing: -2.5,
          }}
        >
          {enDow}
        </div>
        <div>
          <div style={{ fontSize: 16, color: "var(--text-secondary)", fontWeight: 500, marginBottom: 2 }}>
            {dateStr}
          </div>
          <MonoLabel tracking={1.4}>
            {String(todayTasks.length).padStart(2, "0")} tasks
            {overdueTask.length > 0 ? ` · ${overdueTask.length} overdue` : ""}
            {!hasAny ? " · all clear" : ""}
          </MonoLabel>
        </div>
      </div>

      {/* 시간 없는 오늘 태스크 */}
      {untimedTasks.length > 0 && (
        <div style={{ marginBottom: 16 }}>
          <div style={{ marginBottom: 8 }}>
            <MonoLabel size={10} tracking={1.4}>시간 미지정</MonoLabel>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {untimedTasks.map((t) => (
              <TimelineCard key={t.id} task={t} />
            ))}
          </div>
        </div>
      )}

      {/* hour timeline */}
      <div style={{ display: "flex", flexDirection: "column" }}>
        {hours.map((h) => (
          <HourRow
            key={h}
            hour={h}
            nowLine={nowHour >= minHour && nowHour <= maxHour && h === nowRowHour}
            nowTimeStr={nowMinStr}
            tasks={tasksByHour(h)}
          />
        ))}
      </div>
    </>
  );
};

/* ─── UpcomingRail ──────────────────────────────────────── */
const UpcomingRail = ({ allTasks, todayISO }: { allTasks: Task[]; todayISO: string }) => {
  const upcomingTasks = allTasks
    .filter((t) => t.due_date && t.due_date > todayISO && !t.done)
    .sort((a, b) => (a.due_date ?? "").localeCompare(b.due_date ?? ""))
    .slice(0, 4);

  if (upcomingTasks.length === 0) {
    return (
      <div style={{ fontSize: 12, color: "var(--text-faint)", padding: "8px 10px" }}>
        다가오는 일정이 없습니다
      </div>
    );
  }
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
      {upcomingTasks.map((t) => (
        <UpcomingItem key={t.id} task={t} />
      ))}
    </div>
  );
};

/* ─── Hour rows / now-line / timeline card ─────────────────── */
const HourRow = ({
  hour,
  nowLine,
  nowTimeStr,
  tasks,
}: {
  hour: string;
  nowLine: boolean;
  nowTimeStr: string;
  tasks: Task[];
}) => (
  <div style={{ position: "relative", display: "grid", gridTemplateColumns: "64px 1fr", gap: 0, minHeight: 56 }}>
    <div style={{ borderTop: "1px solid var(--border)", padding: "8px 12px 0 0", textAlign: "right" }}>
      <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--text-faint)", letterSpacing: 0.4 }}>
        {hour}
      </span>
    </div>
    <div style={{ borderTop: "1px solid var(--border)", borderLeft: "1px solid var(--border)", padding: "6px 0 12px 18px", position: "relative" }}>
      {nowLine && <NowLine timeStr={nowTimeStr} />}
      {tasks.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {tasks.map((t) => (
            <TimelineCard key={t.id} task={t} />
          ))}
        </div>
      )}
    </div>
  </div>
);

const NowLine = ({ timeStr }: { timeStr: string }) => (
  <div style={{ position: "absolute", left: -1, right: -2, top: -2, display: "flex", alignItems: "center", gap: 8, pointerEvents: "none" }}>
    <span style={{ width: 8, height: 8, borderRadius: "50%", background: "var(--accent)", boxShadow: "0 0 0 3px rgba(217,119,87,0.18)" }} />
    <span style={{ flex: 1, height: 1, background: "var(--accent)" }} />
    <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--accent)", letterSpacing: 0.5, padding: "2px 6px", borderRadius: 3, background: "var(--accent-dim)", border: "1px solid var(--border-accent)" }}>
      NOW · {timeStr}
    </span>
  </div>
);

const TimelineCard = ({ task }: { task: Task }) => {
  const { projects, toggleTask, deleteTask, updateTaskTitle } = useApp();
  const project = task.project ? projects.find((p) => p.id === task.project) : null;
  const [hovered, setHovered] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(task.title);

  const handleBlur = () => {
    setIsEditing(false);
    if (editValue.trim() && editValue !== task.title) {
      updateTaskTitle(task.id, editValue.trim());
    } else {
      setEditValue(task.title);
    }
  };

  return (
    <div
      style={{
        display: "flex", alignItems: "flex-start", gap: 12,
        padding: "10px 14px", borderRadius: "var(--radius-sm)",
        border: `1px solid ${task.bucket === "overdue" ? "var(--border-accent)" : "var(--border)"}`,
        background: task.bucket === "overdue" ? "var(--accent-dim)" : "var(--bg-surface)",
        cursor: "pointer", position: "relative",
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <span style={{ width: 3, alignSelf: "stretch", borderRadius: 2, background: project ? project.color : "var(--text-faint)" }} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginBottom: 3 }}>
          <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--text-muted)", letterSpacing: 0.5 }}>
            {project?.name}
          </span>
          {task.tags.map((t) => <TagChip key={t} id={t} small />)}
        </div>
        {isEditing ? (
          <input
            value={editValue}
            onChange={(e) => setEditValue(e.target.value)}
            onBlur={handleBlur}
            onKeyDown={(e) => {
              if (e.key === "Enter") (e.target as HTMLInputElement).blur();
              if (e.key === "Escape") { setEditValue(task.title); setIsEditing(false); }
            }}
            autoFocus
            style={{ fontSize: 13.5, fontWeight: 500, letterSpacing: -0.1, lineHeight: 1.35, background: "transparent", border: "none", outline: "none", color: "var(--text-display)", fontFamily: "var(--font-body)", width: "100%" }}
          />
        ) : (
          <div
            onClick={() => setIsEditing(true)}
            style={{ fontSize: 13.5, fontWeight: 500, color: "var(--text-display)", letterSpacing: -0.1, lineHeight: 1.35 }}
          >
            {task.title}
          </div>
        )}
        {task.subtotal > 0 && (
          <div style={{ marginTop: 6 }}>
            <SubtaskMeter total={task.subtotal} done={task.subdone} />
          </div>
        )}
      </div>
      <Checkbox done={task.done} size={16} onClick={() => toggleTask(task.id, task.done)} />
      {hovered && (
        <button
          onClick={(e) => { e.stopPropagation(); deleteTask(task.id); }}
          style={{ position: "absolute", top: 6, right: 6, width: 18, height: 18, borderRadius: 3, background: "rgba(217,119,87,0.12)", border: "1px solid var(--border-accent)", color: "var(--accent-bright)", fontSize: 12, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", padding: 0 }}
          aria-label="삭제"
          type="button"
        >
          ×
        </button>
      )}
    </div>
  );
};

/* ─── Upcoming + progress (right rail) ─────────────────────── */
const UpcomingItem = ({ task }: { task: Task }) => {
  const { projects } = useApp();
  const project = task.project ? projects.find((p) => p.id === task.project) : null;
  const dueDate = task.due_date ? new Date(task.due_date + "T00:00:00") : null;
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 10px", borderRadius: "var(--radius-sm)", borderBottom: "1px solid var(--border)" }}>
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", width: 32, flexShrink: 0 }}>
        <span style={{ fontFamily: "var(--font-display)", fontStyle: "italic", fontVariationSettings: '"opsz" 72, "wght" 380', fontSize: 18, lineHeight: 1, color: "var(--text-display)" }}>
          {dueDate?.getDate() ?? "—"}
        </span>
        <span style={{ fontFamily: "var(--font-mono)", fontSize: 9, color: "var(--text-faint)", letterSpacing: 0.5, textTransform: "uppercase", marginTop: 2 }}>
          {dueDate ? ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"][dueDate.getMonth()] : ""}
        </span>
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, color: "var(--text-display)", letterSpacing: -0.1, fontWeight: 500, lineHeight: 1.3, overflow: "hidden", textOverflow: "ellipsis", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" }}>
          {task.title}
        </div>
        <div style={{ marginTop: 3, display: "flex", gap: 6, alignItems: "center" }}>
          <ProjectDot id={task.project} size={5} />
          <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--text-faint)", letterSpacing: 0.3 }}>
            {project?.name}
          </span>
        </div>
      </div>
    </div>
  );
};

const ProgressCard = ({ done, total }: { done: number; total: number }) => {
  const pct = total > 0 ? Math.round((done / total) * 100) : 0;
  return (
    <div style={{ padding: 16, borderRadius: "var(--radius)", border: "1px solid var(--border)", background: "var(--bg-surface)" }}>
      <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginBottom: 12 }}>
        <span style={{ fontFamily: "var(--font-display)", fontStyle: "italic", fontVariationSettings: '"opsz" 96, "wght" 320', fontSize: 42, lineHeight: 0.9, color: "var(--text-display)", letterSpacing: -1.5 }}>
          {String(done).padStart(2, "0")}
          <span style={{ color: "var(--text-faint)", fontSize: 24 }}> / {total}</span>
        </span>
      </div>
      <div style={{ height: 4, borderRadius: 2, background: "rgba(255,255,255,0.06)", overflow: "hidden", marginBottom: 12 }}>
        <div style={{ width: `${pct}%`, height: "100%", background: "var(--accent)", transition: "width .3s" }} />
      </div>
      <div style={{ display: "flex", justifyContent: "space-between" }}>
        <MonoLabel size={10} tracking={1}>완료 / 전체</MonoLabel>
        <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--accent)", letterSpacing: 0.3 }}>
          {pct}%
        </span>
      </div>
    </div>
  );
};

const S: Record<string, CSSProperties> = {
  appRoot: { width: "100%", height: "100vh", background: "var(--bg-page)", color: "var(--text-secondary)", fontFamily: "var(--font-body)", display: "flex", overflow: "hidden" },
  colMain: { flex: 1, display: "flex", flexDirection: "column", minWidth: 0 },
  scrollPad: { flex: 1, position: "relative", overflow: "auto", minHeight: 0 },
  rightRail: { background: "var(--bg-sidebar)", borderLeft: "1px solid var(--border)", padding: "24px 20px", display: "flex", flexDirection: "column", gap: 24, overflowY: "auto" },
  railHead: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 },
};
