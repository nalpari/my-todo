"use client";

import type { CSSProperties } from "react";
import { useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useApp } from "@/lib/AppContext";
import { MonoLabel } from "./Primitives";
import { type Tag } from "@/lib/data";
import { parseTagId, toggleTagHref } from "@/lib/view";

/* ─── TagList ────────────────────────────────────────────────
 * 사이드바의 태그 섹션 전체.
 *
 * - 헤더 + 버튼 → NewTagRow 펼침
 * - chip 클릭 → URL `tag` 필터 토글 (project 패턴과 대칭)
 * - 호버 chip → 우상단 × 오버레이 → 2단계 확인 → 삭제
 * - rename/hue 변경 UI 는 없음 (삭제 + 재생성으로 갈음)
 */
export const TagList = () => {
  const { tags } = useApp();
  const searchParams = useSearchParams();
  const activeTagId = parseTagId(searchParams.get("tag"));
  const [isCreating, setIsCreating] = useState(false);

  return (
    <div style={S.section}>
      <div style={S.sectionHead}>
        <MonoLabel tracking={1.4} size={10}>Tags</MonoLabel>
        <button
          style={S.addBtn}
          aria-label="새 태그"
          type="button"
          onClick={() => setIsCreating(true)}
        >
          +
        </button>
      </div>
      <div style={S.chipWrap}>
        {tags.map((t) => (
          <SidebarTagChip key={t.id} tag={t} isActive={t.id === activeTagId} />
        ))}
        {isCreating && <NewTagRow onDone={() => setIsCreating(false)} />}
      </div>
    </div>
  );
};

/* ─── SidebarTagChip ─────────────────────────────────────── */

const SidebarTagChip = ({ tag, isActive }: { tag: Tag; isActive: boolean }) => {
  const { deleteTag } = useApp();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [hovered, setHovered] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const wrapRef = useRef<HTMLSpanElement>(null);

  // 확인 단계 중 외부 클릭·Esc 로 취소.
  useEffect(() => {
    if (!confirming) return;
    const onDown = (e: MouseEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setConfirming(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setConfirming(false);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [confirming]);

  const handleChipClick = () => {
    // 확인 상태에서 chip 본문 클릭 = 취소 (삭제는 × 버튼만)
    if (confirming) {
      setConfirming(false);
      return;
    }
    router.replace(toggleTagHref(new URLSearchParams(searchParams.toString()), tag.id), { scroll: false });
  };

  const handleDeleteClick = (e: React.MouseEvent) => {
    e.stopPropagation(); // chip 본문 클릭 (= 필터 토글) 으로 전파 막기
    if (confirming) {
      deleteTag(tag.id);
      setConfirming(false);
      return;
    }
    setConfirming(true);
  };

  const isAccent = tag.hue === "accent";
  const showCross = hovered || confirming;

  // 확인 상태 = 코랄 강조 + "정말?" 텍스트로 교체
  const baseChipStyle: CSSProperties = confirming
    ? S.chipConfirming
    : isAccent
    ? (isActive ? S.chipAccentActive : S.chipAccent)
    : (isActive ? S.chipMutedActive : S.chipMuted);

  return (
    <span
      ref={wrapRef}
      style={S.chipWrapper}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <button
        type="button"
        onClick={handleChipClick}
        aria-pressed={isActive}
        title={confirming ? "× 한 번 더 누르면 삭제" : (isActive ? "필터 해제" : `'${tag.name}' 만 보기`)}
        style={baseChipStyle}
      >
        {confirming ? "정말?" : tag.name}
      </button>
      {showCross && (
        <button
          type="button"
          onClick={handleDeleteClick}
          aria-label={confirming ? "삭제 확정" : "태그 삭제"}
          style={S.chipDeleteOverlay}
        >
          ×
        </button>
      )}
    </span>
  );
};

/* ─── NewTagRow ──────────────────────────────────────────── */

const NewTagRow = ({ onDone }: { onDone: () => void }) => {
  const { createTag } = useApp();
  const [name, setName] = useState("");
  const [hue, setHue] = useState<"accent" | "muted">("muted");

  const commit = () => {
    const trimmed = name.trim().replace(/\s+/g, " ");
    if (!trimmed) {
      onDone();
      return;
    }
    createTag(crypto.randomUUID(), trimmed, hue);
    onDone();
  };

  // hue 토글 버튼 mousedown 에서 preventDefault — input focus 유지.
  // 안 그러면 hue 클릭 → input blur → commit → onDone 으로 row 가 닫힘.
  const preserveFocus = (e: React.MouseEvent) => e.preventDefault();

  return (
    <div style={S.newRow}>
      <span style={S.huePicker}>
        <button
          type="button"
          aria-label="accent 색"
          aria-pressed={hue === "accent"}
          onMouseDown={preserveFocus}
          onClick={() => setHue("accent")}
          style={{ ...S.hueDot, ...S.hueAccent, ...(hue === "accent" ? S.hueDotActive : {}) }}
        />
        <button
          type="button"
          aria-label="muted 색"
          aria-pressed={hue === "muted"}
          onMouseDown={preserveFocus}
          onClick={() => setHue("muted")}
          style={{ ...S.hueDot, ...S.hueMuted, ...(hue === "muted" ? S.hueDotActive : {}) }}
        />
      </span>
      <input
        autoFocus
        value={name}
        onChange={(e) => setName(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter") (e.target as HTMLInputElement).blur();
          if (e.key === "Escape") {
            setName("");
            (e.target as HTMLInputElement).blur();
          }
        }}
        placeholder="태그 이름"
        autoComplete="off"
        maxLength={30}
        style={S.newInput}
      />
    </div>
  );
};

/* ─── 스타일 ─────────────────────────────────────────────── */

const chipBase: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  padding: "1px 7px",
  borderRadius: "var(--radius-full)",
  fontFamily: "var(--font-mono)",
  fontSize: 10,
  letterSpacing: 0.3,
  whiteSpace: "nowrap",
  cursor: "pointer",
  border: "1px solid transparent",
  background: "transparent",
  lineHeight: 1.6,
};

const S: Record<string, CSSProperties> = {
  section: { display: "flex", flexDirection: "column", gap: 10 },
  sectionHead: { display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 4px" },
  addBtn: {
    width: 18, height: 18, borderRadius: 4,
    background: "transparent", border: "1px solid var(--border)",
    color: "var(--text-muted)", fontSize: 12, lineHeight: 1, cursor: "pointer",
  },
  chipWrap: { display: "flex", flexWrap: "wrap", gap: 6 },
  chipWrapper: { position: "relative", display: "inline-flex" },

  chipAccent: {
    ...chipBase,
    border: "1px solid var(--border-accent)",
    background: "var(--accent-dim)",
    color: "var(--accent-bright)",
  },
  chipAccentActive: {
    ...chipBase,
    border: "1px solid var(--accent)",
    background: "var(--accent-wash)",
    color: "var(--accent-bright)",
    fontWeight: 600,
  },
  chipMuted: {
    ...chipBase,
    border: "1px solid var(--border)",
    background: "rgba(255,255,255,0.04)",
    color: "var(--text-muted)",
  },
  chipMutedActive: {
    ...chipBase,
    border: "1px solid var(--border-strong)",
    background: "rgba(255,255,255,0.08)",
    color: "var(--text-display)",
    fontWeight: 600,
  },
  chipConfirming: {
    ...chipBase,
    border: "1px solid var(--accent-deep)",
    background: "var(--accent)",
    color: "white",
    fontWeight: 600,
  },

  chipDeleteOverlay: {
    position: "absolute",
    top: -6, right: -6,
    width: 14, height: 14, borderRadius: "50%",
    background: "var(--accent)",
    border: "1px solid var(--accent-deep)",
    color: "white",
    fontSize: 10, lineHeight: 1, cursor: "pointer",
    display: "flex", alignItems: "center", justifyContent: "center",
    padding: 0,
    boxShadow: "0 0 0 2px var(--bg-sidebar)",
  },

  newRow: {
    display: "inline-flex", alignItems: "center", gap: 6,
    padding: "2px 6px",
    borderRadius: "var(--radius-sm)",
    border: "1px dashed var(--border-strong)",
    background: "rgba(255,255,255,0.03)",
  },
  huePicker: { display: "inline-flex", gap: 3 },
  hueDot: {
    width: 10, height: 10, borderRadius: "50%",
    border: "1px solid transparent",
    cursor: "pointer", padding: 0, flexShrink: 0,
  },
  hueAccent: { background: "var(--accent)" },
  hueMuted: { background: "var(--text-faint)" },
  hueDotActive: {
    boxShadow: "0 0 0 2px var(--bg-sidebar), 0 0 0 3px var(--accent-bright)",
  },
  newInput: {
    background: "transparent", border: "none", outline: "none",
    color: "var(--text-display)",
    fontFamily: "var(--font-mono)", fontSize: 11,
    letterSpacing: 0.2,
    padding: 0,
    width: 80,
  },
};
