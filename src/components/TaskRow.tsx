"use client";

import type { CSSProperties } from "react";
import { useState } from "react";
import { Checkbox, MonoLabel, ProjectDot } from "./Primitives";
import { TaskTagsEditor } from "./TaskTagsEditor";
import { SubtaskList } from "./SubtaskList";
import { useApp } from "@/lib/AppContext";
import { type Task } from "@/lib/data";

export type ItemStyle = "editorial" | "card" | "minimal";

/**
 * task 가 subtask 없으면 호버 시 표시할 "+ 서브태스크" affordance.
 * 클릭하면 expand + SubtaskList 자체 input 으로 진입 (자동 포커스는 SubtaskList 가 처리할 수 없어서
 * MVP 는 expand 만 — 사용자가 input 에 한 번 더 클릭).
 */
const AddSubtaskAffordance = ({ onClick }: { onClick: () => void }) => (
  <button
    type="button"
    onClick={onClick}
    style={{
      fontFamily: "var(--font-mono)", fontSize: 10,
      color: "var(--text-faint)", letterSpacing: 0.3,
      background: "transparent",
      border: "1px dashed var(--border)",
      borderRadius: 3,
      padding: "1px 6px",
      cursor: "pointer",
    }}
  >
    + 서브태스크
  </button>
);

export const TaskRow = ({
  task,
  style = "editorial",
  focused = false,
  showProject = true,
  showTime = true,
}: {
  task: Task;
  style?: ItemStyle;
  focused?: boolean;
  showProject?: boolean;
  showTime?: boolean;
}) => {
  const { toggleTask, deleteTask, updateTaskTitle, projects } = useApp();
  const project = task.projectId ? projects.find((p) => p.id === task.projectId) : null;
  const hasSub = task.subtotal > 0;
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(task.title);
  const [hovered, setHovered] = useState(false);
  const [expanded, setExpanded] = useState(false);

  // 외부에서 task.title 이 바뀌면 (낙관 reducer / revalidate / 다른 surface 의 변경)
  // editValue 도 동기화. render-during-render 패턴 — useEffect + setState 의 cascade
  // 경고를 피하면서 React 19 가 같은 render pass 안에서 새 값을 흡수한다.
  // 편집 중이면 사용자의 입력을 덮어쓰지 않게 prev 만 추적.
  const [lastSeenTitle, setLastSeenTitle] = useState(task.title);
  if (task.title !== lastSeenTitle) {
    setLastSeenTitle(task.title);
    if (!isEditing) setEditValue(task.title);
  }

  // 0 subtasks 일 때도 expand 가능 — affordance 클릭 시 펼침 + SubtaskList 입력 노출.
  // SubtaskMeter 와 affordance 가 같은 토글 함수 공유.
  const toggleExpand = () => setExpanded((v) => !v);

  const handleTitleBlur = () => {
    setIsEditing(false);
    if (editValue.trim() && editValue !== task.title) {
      updateTaskTitle(task.id, editValue.trim());
    } else {
      setEditValue(task.title);
    }
  };

  const handleTitleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      (e.target as HTMLInputElement).blur();
    }
    if (e.key === "Escape") {
      setEditValue(task.title);
      setIsEditing(false);
    }
  };

  if (style === "card") {
    return (
      <div
        style={{
          display: "flex",
          alignItems: "flex-start",
          gap: 14,
          padding: "14px 16px",
          borderRadius: "var(--radius)",
          border: `1px solid ${focused ? "var(--border-accent)" : "var(--border)"}`,
          background: focused ? "rgba(217,119,87,0.04)" : "var(--bg-surface)",
          transition: "border-color .2s",
        }}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
      >
        <Checkbox done={task.done} onClick={() => toggleTask(task.id, task.done)} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "baseline", gap: 10, marginBottom: 6 }}>
            {showProject && project && (
              <span
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 6,
                  fontFamily: "var(--font-mono)",
                  fontSize: 10,
                  color: "var(--text-muted)",
                  letterSpacing: 0.6,
                  textTransform: "uppercase",
                }}
              >
                <ProjectDot id={task.projectId} size={6} />
                {project.name}
              </span>
            )}
          </div>
          {isEditing ? (
            <input
              value={editValue}
              onChange={(e) => setEditValue(e.target.value)}
              onBlur={handleTitleBlur}
              onKeyDown={handleTitleKeyDown}
              autoFocus
              style={{
                fontSize: 14.5, fontWeight: 500, letterSpacing: -0.1, lineHeight: 1.4,
                background: "transparent", border: "none", outline: "none",
                color: "var(--text-display)", fontFamily: "var(--font-body)", width: "100%",
              }}
            />
          ) : (
            <div
              onClick={() => setIsEditing(true)}
              style={{
                fontSize: 14.5, fontWeight: 500,
                color: task.done ? "var(--text-faint)" : "var(--text-display)",
                textDecoration: task.done ? "line-through" : "none",
                letterSpacing: -0.1, lineHeight: 1.4, marginBottom: 8, cursor: "text",
              }}
            >
              {task.title}
            </div>
          )}
          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
            {showTime && task.due_time && (
              <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--text-muted)", letterSpacing: 0.4 }}>
                {task.due_time}
              </span>
            )}
            <TaskTagsEditor taskId={task.id} tags={task.tags} active={hovered} />
            {hasSub ? (
              <SubtaskMeter
                total={task.subtotal}
                done={task.subdone}
                expanded={expanded}
                onClick={toggleExpand}
              />
            ) : (
              hovered && <AddSubtaskAffordance onClick={() => setExpanded(true)} />
            )}
          </div>
          {expanded && <SubtaskList taskId={task.id} />}
        </div>
        <button
          onClick={() => deleteTask(task.id)}
          style={deleteBtn}
          aria-label="삭제"
          type="button"
        >
          ×
        </button>
      </div>
    );
  }

  if (style === "minimal") {
    return (
      <div
        style={{ display: "flex", alignItems: "center", gap: 12, padding: "8px 4px", borderRadius: 4 }}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
      >
        <Checkbox done={task.done} size={16} onClick={() => toggleTask(task.id, task.done)} />
        <span
          style={{
            fontSize: 14,
            color: task.done ? "var(--text-faint)" : "var(--text-secondary)",
            textDecoration: task.done ? "line-through" : "none",
            flex: 1, minWidth: 0, letterSpacing: -0.1,
            overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
          }}
        >
          {task.title}
        </span>
        {showProject && project && <ProjectDot id={task.projectId} size={6} />}
        {showTime && task.due_time && (
          <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--text-faint)", letterSpacing: 0.3 }}>
            {task.due_time}
          </span>
        )}
        <button onClick={() => deleteTask(task.id)} style={deleteBtn} aria-label="삭제" type="button">×</button>
      </div>
    );
  }

  /* editorial */
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "38px 24px 1fr auto",
        alignItems: "baseline",
        gap: 14,
        padding: focused ? "14px 16px" : "14px 0",
        margin: focused ? "0 -16px" : 0,
        borderBottom: "1px solid var(--border)",
        background: focused ? "rgba(217,119,87,0.04)" : undefined,
        position: "relative",
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <span
        style={{
          fontFamily: "var(--font-mono)", fontSize: 11,
          color: task.due_time ? "var(--text-muted)" : "var(--text-faint)",
          letterSpacing: 0.4, paddingTop: 3,
        }}
      >
        {showTime ? task.due_time || "—:—" : ""}
      </span>

      <div style={{ paddingTop: 1 }}>
        <Checkbox done={task.done} onClick={() => toggleTask(task.id, task.done)} />
      </div>

      <div style={{ minWidth: 0 }}>
        {isEditing ? (
          <input
            value={editValue}
            onChange={(e) => setEditValue(e.target.value)}
            onBlur={handleTitleBlur}
            onKeyDown={handleTitleKeyDown}
            autoFocus
            style={{
              fontSize: 15, fontWeight: 500, letterSpacing: -0.15, lineHeight: 1.4,
              background: "transparent", border: "none", outline: "none",
              color: "var(--text-display)", fontFamily: "var(--font-body)", width: "100%",
            }}
          />
        ) : (
          <div
            onClick={() => setIsEditing(true)}
            style={{
              fontSize: 15, fontWeight: 500,
              color: task.done ? "var(--text-faint)" : "var(--text-display)",
              textDecoration: task.done ? "line-through" : "none",
              letterSpacing: -0.15, lineHeight: 1.4, cursor: "text",
            }}
          >
            {task.title}
          </div>
        )}
        {/* 메타데이터 줄: 호버 중이면 항상 표시 (TaskTagsEditor 의 "+" 가 항상 자리 확보).
            아니면 표시할 내용이 하나라도 있을 때만. */}
        {(hovered || (showProject && project) || task.tags.length > 0 || hasSub) && (
          <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", marginTop: 6 }}>
            {showProject && project && (
              <span style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 11.5, color: "var(--text-muted)" }}>
                <ProjectDot id={task.projectId} size={6} />
                {project.name}
              </span>
            )}
            <TaskTagsEditor taskId={task.id} tags={task.tags} active={hovered} />
            {hasSub ? (
              <SubtaskMeter
                total={task.subtotal}
                done={task.subdone}
                expanded={expanded}
                onClick={toggleExpand}
              />
            ) : (
              hovered && <AddSubtaskAffordance onClick={() => setExpanded(true)} />
            )}
          </div>
        )}
        {expanded && <SubtaskList taskId={task.id} />}
      </div>

      <span
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
        }}
      >
        <button
          onClick={() => deleteTask(task.id)}
          style={inlineDeleteBtn}
          aria-label="삭제"
          type="button"
        >
          ×
        </button>
        {!hovered && (
          <span
            style={{
              fontFamily: "var(--font-display)",
              fontStyle: "italic",
              fontVariationSettings: '"opsz" 14, "wght" 400',
              fontSize: 13,
              color: "var(--text-faint)",
            }}
          >
            {`№ ${String(task.id).slice(-4)}`}
          </span>
        )}
      </span>
    </div>
  );
};

const inlineDeleteBtn: CSSProperties = {
  width: 18,
  height: 18,
  borderRadius: 4,
  background: "rgba(217,119,87,0.12)",
  border: "1px solid var(--border-accent)",
  color: "var(--accent-bright)",
  fontSize: 12,
  lineHeight: 1,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  cursor: "pointer",
  padding: 0,
  flexShrink: 0,
};

const deleteBtn: CSSProperties = {
  width: 18,
  height: 18,
  borderRadius: 4,
  background: "rgba(217,119,87,0.12)",
  border: "1px solid var(--border-accent)",
  color: "var(--accent-bright)",
  fontSize: 12,
  lineHeight: 1,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  cursor: "pointer",
  padding: 0,
  flexShrink: 0,
};

/**
 * onClick + expanded 가 전달되면 클릭 가능한 토글로 작동 (chevron 표시).
 * 둘 다 없으면 read-only span (기존 동작 유지 — UpcomingItem 등에서 사용).
 */
export const SubtaskMeter = ({
  total,
  done,
  expanded,
  onClick,
}: {
  total: number;
  done: number;
  expanded?: boolean;
  onClick?: () => void;
}) => {
  const content = (
    <>
      <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
        <rect x="2" y="3" width="3" height="3" rx="0.5" stroke="currentColor" strokeWidth="1.3"
          fill={done > 0 ? "currentColor" : "none"} opacity={done > 0 ? 0.7 : 1} />
        <line x1="7" y1="4.5" x2="14" y2="4.5" stroke="currentColor" strokeWidth="1.3" />
        <rect x="2" y="10" width="3" height="3" rx="0.5" stroke="currentColor" strokeWidth="1.3" />
        <line x1="7" y1="11.5" x2="14" y2="11.5" stroke="currentColor" strokeWidth="1.3" />
      </svg>
      {done}/{total}
      {onClick && (
        <span
          aria-hidden="true"
          style={{
            display: "inline-block",
            fontSize: 9,
            transition: "transform .15s",
            transform: expanded ? "rotate(90deg)" : "rotate(0deg)",
            color: "var(--text-faint)",
          }}
        >
          ▸
        </span>
      )}
    </>
  );

  const sharedStyle: CSSProperties = {
    display: "inline-flex", alignItems: "center", gap: 6,
    fontFamily: "var(--font-mono)", fontSize: 10,
    color: "var(--text-muted)", letterSpacing: 0.3,
  };

  if (!onClick) {
    return <span style={sharedStyle}>{content}</span>;
  }
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      aria-expanded={expanded}
      aria-label={expanded ? "서브태스크 접기" : "서브태스크 펼치기"}
      style={{
        ...sharedStyle,
        background: "transparent",
        border: "none",
        padding: 0,
        cursor: "pointer",
      }}
    >
      {content}
    </button>
  );
};

/* ─── Mini calendar (right rail) ───────────────────────────── */
export const MiniCalendar = ({ compact = false }: { compact?: boolean }) => {
  const [viewDate, setViewDate] = useState(() => {
    const now = new Date();
    return { year: now.getFullYear(), month: now.getMonth() }; // 0-indexed
  });

  const today = new Date();
  const { year, month } = viewDate;

  const firstDow = new Date(year, month, 1).getDay(); // 0=일
  const offset = (firstDow + 6) % 7; // 월요일 시작 보정
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const daysInPrev = new Date(year, month, 0).getDate();

  // 필요한 행 수: offset (앞쪽 빈칸) + daysInMonth 를 7 로 나눠 올림.
  // 토요일/일요일에 1일이 시작하는 달은 6주 (42셀) 가 필요해 35셀 고정 시 마지막 줄이 잘렸음.
  const rows = Math.ceil((offset + daysInMonth) / 7);
  const cellCount = rows * 7;
  const cells = Array.from({ length: cellCount }, (_, i) => {
    const dayNum = i - offset + 1;
    if (dayNum <= 0) return { n: daysInPrev + dayNum, dim: true, date: null };
    if (dayNum > daysInMonth) return { n: dayNum - daysInMonth, dim: true, date: null };
    const date = new Date(year, month, dayNum);
    const isToday = date.toDateString() === today.toDateString();
    return { n: dayNum, dim: false, date, isToday };
  });

  const monthNames = ["January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"];
  const koMonths = ["1월", "2월", "3월", "4월", "5월", "6월",
    "7월", "8월", "9월", "10월", "11월", "12월"];

  const prev = () => setViewDate(({ year: y, month: m }) =>
    m === 0 ? { year: y - 1, month: 11 } : { year: y, month: m - 1 });
  const next = () => setViewDate(({ year: y, month: m }) =>
    m === 11 ? { year: y + 1, month: 0 } : { year: y, month: m + 1 });

  return (
    <div style={{ padding: compact ? 14 : 18, borderRadius: "var(--radius)", border: "1px solid var(--border)", background: "var(--bg-surface)" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 12 }}>
        <div>
          <div style={{ fontFamily: "var(--font-display)", fontStyle: "italic", fontVariationSettings: '"opsz" 72, "wght" 380', fontSize: 24, color: "var(--text-display)", letterSpacing: -0.5, lineHeight: 1 }}>
            {monthNames[month]}
          </div>
          <MonoLabel size={10} tracking={1.2}>{year} · {koMonths[month]}</MonoLabel>
        </div>
        <div style={{ display: "flex", gap: 4 }}>
          <button style={miniBtn} type="button" onClick={prev} aria-label="이전 달">‹</button>
          <button style={miniBtn} type="button" onClick={next} aria-label="다음 달">›</button>
        </div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 2, marginBottom: 6 }}>
        {["M", "T", "W", "T", "F", "S", "S"].map((d, i) => (
          <span key={i} style={{ fontFamily: "var(--font-mono)", fontSize: 9, color: i >= 5 ? "var(--text-faint)" : "var(--text-muted)", letterSpacing: 0.5, textAlign: "center", paddingBottom: 4 }}>
            {d}
          </span>
        ))}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 2 }}>
        {cells.map((d, i) => (
          <div
            key={i}
            style={{
              aspectRatio: "1",
              display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
              borderRadius: 5,
              background: d.isToday ? "var(--accent)" : "transparent",
              color: d.isToday ? "white" : d.dim ? "var(--text-faint)" : "var(--text-secondary)",
              fontSize: 11.5, fontWeight: d.isToday ? 600 : 400,
              fontFamily: "var(--font-body)",
            }}
          >
            {d.n}
          </div>
        ))}
      </div>
    </div>
  );
};

const miniBtn: CSSProperties = {
  width: 22, height: 22, borderRadius: 5,
  background: "transparent", border: "1px solid var(--border)",
  color: "var(--text-muted)", fontSize: 13, cursor: "pointer",
};
