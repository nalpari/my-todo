"use client";

import type { CSSProperties } from "react";
import { useEffect, useRef, useState } from "react";
import { useApp } from "@/lib/AppContext";
import { type Tag } from "@/lib/data";
import { TagChip } from "./Primitives";

/**
 * Task 의 태그 chips + 편집 컨트롤. TaskRow editorial/card 와 VariantBSplit 의
 * TimelineCard 가 공유.
 *
 *  - active=true: 각 chip 에 × overlay (unassign) + 마지막에 "+" 버튼.
 *  - active=false: read-only chips.
 *  - "+" 클릭 → 사용자의 모든 태그 popover. 클릭으로 toggle. 외부 클릭/Esc 닫음.
 *
 * "+" 와 picker 의 가시성은 별개:
 *  - "+" 는 active=true 또는 picker 열림 중 표시 (picker 열린 채 hover 떠도 유지)
 *  - chip × 는 active=true 일 때만 (picker 열림과 무관 — 의도된 분리)
 */
export const TaskTagsEditor = ({
  taskId,
  tags,
  active,
}: {
  taskId: string;
  tags: Tag[];
  active: boolean;
}) => {
  const { assignTag, unassignTag } = useApp();
  const [pickerOpen, setPickerOpen] = useState(false);
  const assignedIds = tags.map((t) => t.id);

  return (
    <>
      {tags.map((t) => (
        <TagChip
          key={t.id}
          tag={t}
          small
          onRemove={active ? () => unassignTag(taskId, t.id) : undefined}
        />
      ))}
      {(active || pickerOpen) && (
        <span style={{ position: "relative", display: "inline-flex" }}>
          <button
            type="button"
            aria-label="태그 추가"
            // onMouseDown preventDefault 필요 없음 — 부모에 input 이 있을 일이 없음 (TaskRow 의
            // title 인라인 편집은 isEditing 분기로 다른 노드가 렌더되며, 그땐 메타데이터 줄이 안 보임)
            onClick={() => setPickerOpen((o) => !o)}
            style={S.plusBtn}
          >
            +
          </button>
          {pickerOpen && (
            <TagPickerPopover
              taskId={taskId}
              assignedIds={assignedIds}
              onAssign={(tag) => assignTag(taskId, tag)}
              onUnassign={(id) => unassignTag(taskId, id)}
              onClose={() => setPickerOpen(false)}
            />
          )}
        </span>
      )}
    </>
  );
};

/* ─── TagPickerPopover ───────────────────────────────────── */

const TagPickerPopover = ({
  taskId,
  assignedIds,
  onAssign,
  onUnassign,
  onClose,
}: {
  taskId: string;
  assignedIds: string[];
  onAssign: (tag: Tag) => void;
  onUnassign: (id: string) => void;
  onClose: () => void;
}) => {
  const { tags } = useApp();
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) onClose();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [onClose]);

  // taskId 는 디버깅 컨텍스트 — popover 가 어느 task 의 것인지 데이터 속성으로.
  return (
    <div
      ref={ref}
      role="dialog"
      aria-label="태그 선택"
      data-task-id={taskId}
      style={S.popover}
    >
      {tags.length === 0 ? (
        <div style={S.popoverEmpty}>
          태그 없음 — 사이드바 + 에서 만드세요
        </div>
      ) : (
        <div style={S.popoverChips}>
          {tags.map((t) => {
            const isAssigned = assignedIds.includes(t.id);
            const isAccent = t.hue === "accent";
            return (
              <button
                key={t.id}
                type="button"
                aria-pressed={isAssigned}
                onClick={() => (isAssigned ? onUnassign(t.id) : onAssign(t))}
                title={isAssigned ? "할당 해제" : "할당"}
                style={{
                  ...S.pickerChip,
                  ...(isAccent
                    ? (isAssigned ? S.pickerChipAccentOn : S.pickerChipAccentOff)
                    : (isAssigned ? S.pickerChipMutedOn : S.pickerChipMutedOff)),
                }}
              >
                {isAssigned ? "✓ " : ""}{t.name}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};

/* ─── 스타일 ─────────────────────────────────────────────── */

const pickerChipBase: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  padding: "2px 8px",
  borderRadius: "var(--radius-full)",
  fontFamily: "var(--font-mono)",
  fontSize: 10,
  letterSpacing: 0.3,
  whiteSpace: "nowrap",
  cursor: "pointer",
  lineHeight: 1.5,
};

const S: Record<string, CSSProperties> = {
  plusBtn: {
    width: 16, height: 16, borderRadius: 4,
    background: "transparent",
    border: "1px dashed var(--border)",
    color: "var(--text-muted)",
    fontSize: 11, lineHeight: 1, cursor: "pointer",
    display: "flex", alignItems: "center", justifyContent: "center",
    padding: 0,
    marginLeft: 2,
  },
  popover: {
    position: "absolute", top: "calc(100% + 6px)", left: 0,
    zIndex: 60,
    padding: 8,
    minWidth: 180, maxWidth: 280,
    background: "var(--bg-surface)",
    border: "1px solid var(--border)",
    borderRadius: "var(--radius)",
    boxShadow: "var(--shadow-lg)",
  },
  popoverEmpty: {
    fontSize: 11, color: "var(--text-faint)",
    fontFamily: "var(--font-mono)", letterSpacing: 0.3,
    padding: "4px 2px",
  },
  popoverChips: { display: "flex", flexWrap: "wrap", gap: 6 },

  pickerChipAccentOff: {
    ...pickerChipBase,
    border: "1px solid var(--border-accent)",
    background: "transparent",
    color: "var(--accent-bright)",
  },
  pickerChipAccentOn: {
    ...pickerChipBase,
    border: "1px solid var(--accent)",
    background: "var(--accent-dim)",
    color: "var(--accent-bright)",
    fontWeight: 600,
  },
  pickerChipMutedOff: {
    ...pickerChipBase,
    border: "1px solid var(--border)",
    background: "transparent",
    color: "var(--text-muted)",
  },
  pickerChipMutedOn: {
    ...pickerChipBase,
    border: "1px solid var(--border-strong)",
    background: "rgba(255,255,255,0.06)",
    color: "var(--text-display)",
    fontWeight: 600,
  },
};
