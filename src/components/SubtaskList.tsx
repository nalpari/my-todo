"use client";

import type { CSSProperties } from "react";
import { useState } from "react";
import { useApp } from "@/lib/AppContext";
import { Checkbox } from "./Primitives";
import { type Subtask } from "@/lib/data";

/**
 * Task 의 펼침 영역. TaskRow editorial/card 와 VariantBSplit 의 TimelineCard 가 공유.
 *
 * 본문 들여쓰기 (paddingLeft) 는 부모가 결정 — 각 surface 의 task 본문 시작 위치에
 * 맞춰서. 컴포넌트 자체는 0 padding 으로 시작.
 *
 *  - SubtaskItem: 작은 checkbox + 제목 인라인 편집 (blur=save, Esc=cancel) + 호버 ×
 *  - 새 항목 추가: 항상 맨 아래 "+" 입력 row. Enter 생성, Esc clear, 빈 값 blur 는 no-op.
 *  - 2단계 삭제 없음 — subtask 는 throwaway (project/tag 와 달리 자식 데이터 없음)
 */
export const SubtaskList = ({ taskId }: { taskId: string }) => {
  const { subtasks } = useApp();
  // 부모 task 의 subtasks 만, sort_order → created_at 순.
  const items = subtasks
    .filter((s) => s.task_id === taskId)
    .sort((a, b) => a.sort_order - b.sort_order || a.created_at.localeCompare(b.created_at));

  return (
    <div style={S.list}>
      {items.map((s) => (
        <SubtaskItem key={s.id} subtask={s} />
      ))}
      <NewSubtaskInput taskId={taskId} />
    </div>
  );
};

/* ─── SubtaskItem ────────────────────────────────────────── */

const SubtaskItem = ({ subtask }: { subtask: Subtask }) => {
  const { toggleSubtask, updateSubtaskTitle, deleteSubtask } = useApp();
  const [hovered, setHovered] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(subtask.title);

  // 외부 변경 흡수 — TaskRow/TimelineCard 와 동일 render-during-render 패턴.
  const [lastSeenTitle, setLastSeenTitle] = useState(subtask.title);
  if (subtask.title !== lastSeenTitle) {
    setLastSeenTitle(subtask.title);
    if (!isEditing) setEditValue(subtask.title);
  }

  const handleBlur = () => {
    setIsEditing(false);
    const next = editValue.trim().replace(/\s+/g, " ");
    if (!next || next === subtask.title) {
      setEditValue(subtask.title);
      return;
    }
    setEditValue(next);
    updateSubtaskTitle(subtask.id, next);
  };

  return (
    <div
      style={S.item}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <Checkbox
        done={subtask.done}
        size={14}
        onClick={() => toggleSubtask(subtask.id, subtask.task_id, subtask.done)}
      />
      {isEditing ? (
        <input
          autoFocus
          value={editValue}
          onChange={(e) => setEditValue(e.target.value)}
          onBlur={handleBlur}
          onKeyDown={(e) => {
            if (e.key === "Enter") (e.target as HTMLInputElement).blur();
            if (e.key === "Escape") {
              setEditValue(subtask.title);
              setIsEditing(false);
            }
          }}
          maxLength={200}
          style={S.titleInput}
        />
      ) : (
        <span
          style={{
            ...S.title,
            color: subtask.done ? "var(--text-faint)" : "var(--text-secondary)",
            textDecoration: subtask.done ? "line-through" : "none",
          }}
          onClick={() => {
            setEditValue(subtask.title);
            setIsEditing(true);
          }}
        >
          {subtask.title}
        </span>
      )}
      {hovered && !isEditing && (
        <button
          type="button"
          onClick={() => deleteSubtask(subtask.id, subtask.task_id, subtask.done)}
          aria-label="서브태스크 삭제"
          style={S.deleteBtn}
        >
          ×
        </button>
      )}
    </div>
  );
};

/* ─── NewSubtaskInput ───────────────────────────────────── */

const NewSubtaskInput = ({ taskId }: { taskId: string }) => {
  const { createSubtask } = useApp();
  const [value, setValue] = useState("");

  const commit = () => {
    const trimmed = value.trim().replace(/\s+/g, " ");
    if (!trimmed) return;
    createSubtask(crypto.randomUUID(), taskId, trimmed);
    setValue("");
  };

  return (
    <div style={S.newRow}>
      <span style={S.newPlus} aria-hidden="true">+</span>
      <input
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            commit();
            // 포커스 유지 — 연속 추가 편의
          }
          if (e.key === "Escape") setValue("");
        }}
        placeholder="서브태스크 추가"
        autoComplete="off"
        maxLength={200}
        aria-label="서브태스크 추가"
        style={S.newInput}
      />
    </div>
  );
};

/* ─── 스타일 ─────────────────────────────────────────────── */

const S: Record<string, CSSProperties> = {
  list: { display: "flex", flexDirection: "column", gap: 2, marginTop: 8 },
  item: {
    position: "relative",
    display: "flex", alignItems: "center", gap: 10,
    padding: "4px 24px 4px 4px",
    borderRadius: "var(--radius-sm)",
  },
  title: {
    flex: 1, minWidth: 0,
    fontSize: 13, letterSpacing: -0.1,
    cursor: "text",
    overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
  },
  titleInput: {
    flex: 1, minWidth: 0,
    background: "transparent", border: "none", outline: "none",
    color: "var(--text-display)",
    fontFamily: "var(--font-body)", fontSize: 13,
    letterSpacing: -0.1, padding: 0,
  },
  deleteBtn: {
    position: "absolute",
    right: 4, top: "50%", transform: "translateY(-50%)",
    width: 18, height: 18, borderRadius: 3,
    background: "rgba(217,119,87,0.10)",
    border: "1px solid var(--border-accent)",
    color: "var(--accent-bright)",
    fontSize: 12, lineHeight: 1, cursor: "pointer",
    display: "flex", alignItems: "center", justifyContent: "center",
    padding: 0,
  },
  newRow: {
    display: "flex", alignItems: "center", gap: 10,
    padding: "4px 4px",
    borderTop: "1px dashed var(--border)",
    marginTop: 4, paddingTop: 8,
  },
  newPlus: {
    width: 14, height: 14, borderRadius: 3,
    background: "transparent",
    border: "1px dashed var(--border-strong)",
    color: "var(--text-muted)",
    fontSize: 11, lineHeight: 1,
    display: "flex", alignItems: "center", justifyContent: "center",
    flexShrink: 0,
  },
  newInput: {
    flex: 1, minWidth: 0,
    background: "transparent", border: "none", outline: "none",
    color: "var(--text-secondary)",
    fontFamily: "var(--font-body)", fontSize: 12.5,
    letterSpacing: -0.1, padding: 0,
  },
};
