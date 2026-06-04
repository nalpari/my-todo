"use client";

import type { CSSProperties } from "react";
import { useEffect, useRef, useState } from "react";
import { type Tag } from "@/lib/data";

/* ─── InputTagPicker ─────────────────────────────────────────
 * InputBar 의 due-date chip 직전에 위치. `#` 아이콘 트리거 (ProjectPicker 의
 * `+` 와 형태 동일, 텍스트만 다름) 클릭 시 모든 태그를 chip 으로 나열하는
 * 팝오버.
 *
 * 동작 컨트랙트:
 *  - 클릭은 add-only. 이미 pending (인풋의 `#tag` 또는 이전 픽커 클릭) 인
 *    태그는 ✓ + active style 로 표시, 클릭은 no-op.
 *  - 제거는 아래 라인 (InputBar 의 tag display row) 의 × 로 — 인풋 텍스트까지
 *    함께 strip.
 *  - 빈 태그 상태는 "인풋의 #으로 만드세요" 안내 (사이드바/인풋으로 유도).
 */
export const InputTagPicker = ({
  allTags,
  pendingTagIds,
  onAdd,
}: {
  allTags: Tag[];
  pendingTagIds: string[];
  onAdd: (tag: Tag) => void;
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    const onDown = (e: MouseEvent) => {
      if (containerRef.current?.contains(e.target as Node)) return;
      setIsOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setIsOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [isOpen]);

  return (
    <div ref={containerRef} style={S.container}>
      <button
        type="button"
        onClick={() => setIsOpen((v) => !v)}
        aria-label="태그 선택"
        aria-expanded={isOpen}
        style={S.trigger}
      >
        <span aria-hidden="true">#</span>
      </button>

      {isOpen && (
        <div role="dialog" aria-label="태그 선택" style={S.popover}>
          {allTags.length === 0 ? (
            <div style={S.popoverEmpty}>태그 없음 — 인풋의 #으로 만드세요</div>
          ) : (
            allTags.map((t) => {
              const isPending = pendingTagIds.includes(t.id);
              const isAccent = t.hue === "accent";
              return (
                <button
                  key={t.id}
                  type="button"
                  aria-pressed={isPending}
                  onClick={() => {
                    if (!isPending) onAdd(t);
                  }}
                  title={isPending ? "선택됨 — 아래 × 로 제거" : "추가"}
                  style={
                    isAccent
                      ? (isPending ? S.chipAccentOn : S.chipAccentOff)
                      : (isPending ? S.chipMutedOn : S.chipMutedOff)
                  }
                >
                  {isPending ? "✓ " : ""}{t.name}
                </button>
              );
            })
          )}
        </div>
      )}
    </div>
  );
};

/* ─── 스타일 ─────────────────────────────────────────────────
 * TaskTagsEditor 의 popover 와 동일 시각언어. 단 트리거는 InputBar 의 좁은
 * 트리거 열 안에 들어가야 하므로 InputTagPicker 의 trigger 는 22x22 (다른
 * prefix 트리거와 통일).
 */
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
  border: "1px solid",
  background: "transparent",
};

const S: Record<string, CSSProperties> = {
  container: { position: "relative", display: "inline-flex" },
  trigger: {
    width: 22, height: 22, borderRadius: 5,
    background: "var(--accent-dim)",
    border: "1px solid var(--border-accent)",
    color: "var(--accent-bright)",
    display: "flex", alignItems: "center", justifyContent: "center",
    cursor: "pointer", padding: 0,
    fontSize: 13, lineHeight: 1, fontWeight: 600,
  },

  popover: {
    position: "absolute",
    bottom: "calc(100% + 8px)",
    right: 0,
    zIndex: 60,
    padding: 8,
    minWidth: 180, maxWidth: 280,
    background: "var(--bg-surface)",
    border: "1px solid var(--border)",
    borderRadius: "var(--radius)",
    boxShadow: "var(--shadow-lg)",
    display: "flex", flexWrap: "wrap", gap: 6,
  },
  popoverEmpty: {
    fontSize: 11, color: "var(--text-faint)",
    fontFamily: "var(--font-mono)", letterSpacing: 0.3,
    padding: "4px 2px",
  },

  chipAccentOff: {
    ...pickerChipBase,
    borderColor: "var(--border-accent)",
    color: "var(--accent-bright)",
  },
  chipAccentOn: {
    ...pickerChipBase,
    borderColor: "var(--accent)",
    background: "var(--accent-dim)",
    color: "var(--accent-bright)",
    fontWeight: 600,
    cursor: "default",
  },
  chipMutedOff: {
    ...pickerChipBase,
    borderColor: "var(--border)",
    color: "var(--text-muted)",
  },
  chipMutedOn: {
    ...pickerChipBase,
    borderColor: "var(--border-strong)",
    background: "rgba(255,255,255,0.06)",
    color: "var(--text-display)",
    fontWeight: 600,
    cursor: "default",
  },
};
