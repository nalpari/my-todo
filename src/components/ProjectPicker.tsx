"use client";

import type { CSSProperties } from "react";
import { useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useApp } from "@/lib/AppContext";
import { SwatchPopover } from "./ProjectList";
import { DEFAULT_PROJECT_COLOR, type ProjectColor } from "@/lib/palette";
import { parseProjectId, toggleProjectHref } from "@/lib/view";

/* ─── ProjectPicker ───────────────────────────────────────────
 * InputBar 의 prefix `+` 자리. 활성 프로젝트 = 색 닷, 미선택 = `+` 텍스트.
 * 클릭 시 팝오버 펼침: 미할당 / 프로젝트 리스트 / + 새 프로젝트.
 * 사이드바 ProjectRow 와 동일한 active 인디케이터 막대 + NewProjectRow
 * 패턴(색 dot + name input + SwatchPopover) 재사용.
 *
 * Linked 모델: 픽커 선택 = URL ?project= 토글 = TopBar 활성 칩 = sidebar active.
 * 새 프로젝트 생성 시 동일 id 로 낙관 insert, insert 성공 후에만 URL 도 갱신.
 */
export const ProjectPicker = () => {
  const { projects, createProject } = useApp();
  const router = useRouter();
  const searchParams = useSearchParams();
  const activeProjectId = parseProjectId(searchParams.get("project"));
  const activeProject = activeProjectId ? projects.find((p) => p.id === activeProjectId) ?? null : null;

  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);

  // 외부 클릭 / Esc → 닫기. isOpen 동안만 리스너 등록해 평소 비용 0.
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

  // 오픈 시 활성 항목이 보이도록 스크롤 — 프로젝트가 많을 때 특히 유용.
  useEffect(() => {
    if (!isOpen) return;
    const el = containerRef.current?.querySelector<HTMLElement>('[data-active="true"]');
    el?.scrollIntoView({ block: "nearest" });
  }, [isOpen]);

  const select = (projectId: string | null) => {
    if (projectId === null) {
      // 미할당: project 키 제거. view·tag 키는 보존.
      const next = new URLSearchParams(searchParams.toString());
      next.delete("project");
      const qs = next.toString();
      router.replace(qs ? `/?${qs}` : "/", { scroll: false });
    } else {
      router.replace(
        toggleProjectHref(new URLSearchParams(searchParams.toString()), projectId),
        { scroll: false },
      );
    }
    setIsOpen(false);
  };

  const handleCreate = (name: string, color: ProjectColor) => {
    const id = crypto.randomUUID();
    // insert 성공 후에만 ?project= 로 라우팅 — 실패 시 (예: 중복 이름) 낙관
    // 프로젝트는 롤백되는데 URL 만 무효 id 를 가리켜 task 리스트가 빈 채로
    // 갇히는 stranded 필터 상태를 방지. 실패하면 팝오버는 열린 채 에러 토스트 노출.
    void createProject(id, name, color).then((ok) => {
      if (ok) select(id);
    });
  };

  return (
    <div ref={containerRef} style={S.container}>
      <button
        type="button"
        onClick={() => setIsOpen((v) => !v)}
        aria-label={activeProject ? `프로젝트: ${activeProject.name}` : "프로젝트 선택"}
        aria-expanded={isOpen}
        style={S.trigger}
      >
        {activeProject ? (
          <span style={{ ...S.dot, background: activeProject.color }} aria-hidden="true" />
        ) : (
          <span aria-hidden="true">+</span>
        )}
      </button>

      {isOpen && (
        <div role="dialog" aria-label="프로젝트 선택" style={S.popover}>
          <button
            type="button"
            onClick={() => select(null)}
            data-active={!activeProjectId}
            style={{ ...S.item, ...(activeProjectId ? null : S.itemActive) }}
          >
            {!activeProjectId && <span aria-hidden="true" style={S.activeIndicator} />}
            <span style={S.itemDotEmpty} aria-hidden="true" />
            <span>미할당</span>
          </button>

          {projects.length > 0 && <div style={S.divider} />}

          {projects.map((p) => {
            const isActive = p.id === activeProjectId;
            return (
              <button
                key={p.id}
                type="button"
                onClick={() => select(p.id)}
                data-active={isActive}
                style={{ ...S.item, ...(isActive ? S.itemActive : null) }}
              >
                {isActive && <span aria-hidden="true" style={S.activeIndicator} />}
                <span style={{ ...S.itemDot, background: p.color }} aria-hidden="true" />
                <span style={S.itemLabel}>{p.name}</span>
              </button>
            );
          })}

          {projects.length > 0 && <div style={S.divider} />}

          <NewProjectRow onCreate={handleCreate} />
        </div>
      )}
    </div>
  );
};

/* ─── NewProjectRow (인라인 새 프로젝트 폼) ─────────────────
 * 사이드바 NewProjectRow 와 동일 패턴이지만, 트리거는 버튼 토글이 아닌
 * useState. SwatchPopover 는 ProjectList 에서 export 해서 재사용.
 * Enter / blur → onCreate (성공 시 picker 의 select(id) 가 팝오버 닫고 URL 갱신).
 * 빈 이름이면 onCreate 호출 안 하고 폼만 닫음 — 사용자가 다시 시도 가능.
 */
const NewProjectRow = ({ onCreate }: { onCreate: (name: string, color: ProjectColor) => void }) => {
  const [isEditing, setIsEditing] = useState(false);
  const [name, setName] = useState("");
  const [color, setColor] = useState<ProjectColor>(DEFAULT_PROJECT_COLOR);
  const [pickingColor, setPickingColor] = useState(false);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const rowRef = useRef<HTMLDivElement | null>(null);

  // color picker 의 외부 클릭 / Esc 닫기. NewProjectRow 자체는 항상 렌더
  // 되어 있어 isEditing 이 false 가 되면 rowRef 가 unmount → useEffect cleanup.
  useEffect(() => {
    if (!pickingColor) return;
    const onDown = (e: MouseEvent) => {
      if (rowRef.current?.contains(e.target as Node)) return;
      setPickingColor(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      setPickingColor(false);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [pickingColor]);

  const commit = () => {
    const trimmed = name.trim().replace(/\s+/g, " ");
    setIsEditing(false);
    setName("");
    setColor(DEFAULT_PROJECT_COLOR);
    if (trimmed) onCreate(trimmed, color);
  };

  const cancel = () => {
    setIsEditing(false);
    setName("");
    setColor(DEFAULT_PROJECT_COLOR);
  };

  // mousedown preventDefault → input focus 유지. NewProjectRow 패턴 그대로.
  const preserveFocus = (e: React.MouseEvent) => e.preventDefault();

  if (!isEditing) {
    return (
      <button
        type="button"
        onClick={() => {
          setIsEditing(true);
          // 다음 tick 에 input 마운트 + autoFocus 가 setState 와 경합하지 않게
          queueMicrotask(() => inputRef.current?.focus());
        }}
        style={S.item}
      >
        <span style={S.itemPlus} aria-hidden="true">+</span>
        <span>새 프로젝트</span>
      </button>
    );
  }

  return (
    <div ref={rowRef} style={{ ...S.item, ...S.itemForm, cursor: "default" }}>
      <button
        type="button"
        aria-label="색 선택"
        onMouseDown={preserveFocus}
        onClick={() => setPickingColor((v) => !v)}
        style={{ ...S.itemDotBtn, background: color }}
      />
      {pickingColor && (
        <div onMouseDown={preserveFocus} style={S.swatchAnchor}>
          <SwatchPopover
            selected={color}
            onPick={(c) => {
              setColor(c as ProjectColor);
              setPickingColor(false);
              inputRef.current?.focus();
            }}
          />
        </div>
      )}
      <input
        ref={inputRef}
        value={name}
        onChange={(e) => setName(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          // Esc 의 popover-level 핸들러로 전파되지 않도록 stopPropagation.
          if (e.key === "Escape") {
            e.stopPropagation();
            cancel();
            return;
          }
          if (e.key === "Enter") (e.target as HTMLInputElement).blur();
        }}
        placeholder="프로젝트 이름"
        autoComplete="off"
        maxLength={50}
        style={S.itemInput}
      />
    </div>
  );
};

/* ─── 스타일 ─────────────────────────────────────────────────
 * 사이드바 ProjectRow 의 S.row / S.activeIndicator / S.dotBtn 와 동일한
 * 시각언어. popover 만 추가 (max-height + scroll + zIndex).
 */
const S: Record<string, CSSProperties> = {
  container: { position: "relative", display: "inline-flex" },
  trigger: {
    width: 22, height: 22, borderRadius: 5,
    background: "var(--accent-dim)",
    border: "1px solid var(--border-accent)",
    color: "var(--accent-bright)",
    display: "flex", alignItems: "center", justifyContent: "center",
    cursor: "pointer", padding: 0,
    fontSize: 14, lineHeight: 1, fontWeight: 600,
  },
  dot: {
    width: 12, height: 12, borderRadius: "50%",
    flexShrink: 0,
  },

  popover: {
    position: "absolute",
    bottom: "calc(100% + 8px)",
    left: 0,
    zIndex: 50,
    minWidth: 220,
    maxWidth: 300,
    maxHeight: 320,
    overflowY: "auto",
    padding: 6,
    background: "var(--bg-surface)",
    border: "1px solid var(--border)",
    borderRadius: "var(--radius)",
    boxShadow: "var(--shadow-lg)",
    display: "flex", flexDirection: "column", gap: 2,
  },

  item: {
    position: "relative",
    display: "flex", alignItems: "center", gap: 10,
    padding: "6px 10px", borderRadius: "var(--radius-sm)",
    fontSize: 13, color: "var(--text-secondary)",
    cursor: "pointer",
    background: "transparent", border: "none",
    width: "100%", textAlign: "left",
    fontFamily: "var(--font-body)",
  },
  itemActive: {
    background: "rgba(255,255,255,0.04)",
    color: "var(--text-display)",
    fontWeight: 500,
  },
  itemLabel: {
    flex: 1, minWidth: 0,
    overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
  },
  itemDot: {
    width: 12, height: 12, borderRadius: "50%",
    flexShrink: 0,
  },
  itemDotEmpty: {
    width: 12, height: 12, borderRadius: "50%",
    border: "1px dashed var(--text-faint)",
    flexShrink: 0,
  },
  itemPlus: {
    width: 12, height: 12,
    display: "flex", alignItems: "center", justifyContent: "center",
    fontSize: 14, fontWeight: 500, color: "var(--text-faint)",
    flexShrink: 0,
  },

  activeIndicator: {
    position: "absolute",
    left: 0, top: "50%",
    width: 2, height: 14,
    transform: "translateY(-50%)",
    background: "var(--accent)",
    borderRadius: 1,
    boxShadow: "0 0 6px var(--accent)",
  },

  divider: {
    height: 1, background: "var(--border)", margin: "4px 2px",
  },

  // NewProjectRow 인라인 폼
  itemForm: {
    background: "rgba(255,255,255,0.03)",
    position: "relative",
  },
  itemDotBtn: {
    width: 12, height: 12, borderRadius: "50%",
    border: "none", padding: 0, cursor: "pointer",
    flexShrink: 0,
  },
  swatchAnchor: {
    position: "absolute", top: "100%", left: 6, zIndex: 51,
    marginTop: 4,
  },
  itemInput: {
    flex: 1, minWidth: 0,
    background: "transparent", border: "none", outline: "none",
    color: "var(--text-display)",
    fontFamily: "var(--font-body)", fontSize: 13,
    letterSpacing: -0.1, padding: 0,
  },
};
