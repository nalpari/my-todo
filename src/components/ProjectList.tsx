"use client";

import type { CSSProperties } from "react";
import { useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useApp } from "@/lib/AppContext";
import { MonoLabel } from "./Primitives";
import { PROJECT_COLORS, DEFAULT_PROJECT_COLOR } from "@/lib/palette";
import { type Project } from "@/lib/data";
import { parseProjectId, toggleProjectHref } from "@/lib/view";

/* ─── ProjectList ────────────────────────────────────────────
 * 사이드바의 프로젝트 섹션 전체. AppShell 에서 import.
 *
 * 헤더 + 버튼 → isCreating 토글 → 리스트 맨 아래에 NewProjectRow 펼침.
 * 각 ProjectRow 는:
 *  - 이름 클릭 = URL project 필터 토글 (Round 2 view 라우팅)
 *  - 호버 ✎ = 인라인 이름 편집
 *  - 색 닷 = swatch popover
 *  - 호버 × = 2단계 삭제 확인
 * 모든 변이는 AppContext 의 낙관 reducer 를 통해 즉시 반영.
 */
export const ProjectList = () => {
  const { projects } = useApp();
  const searchParams = useSearchParams();
  const activeProjectId = parseProjectId(searchParams.get("project"));
  const [isCreating, setIsCreating] = useState(false);

  return (
    <div style={S.section}>
      <div style={S.sectionHead}>
        <MonoLabel tracking={1.4} size={10}>Projects</MonoLabel>
        <button
          style={S.addBtn}
          aria-label="새 프로젝트"
          type="button"
          onClick={() => setIsCreating(true)}
        >
          +
        </button>
      </div>
      <ul style={S.list}>
        {projects.map((p) => (
          <ProjectRow key={p.id} project={p} isActive={p.id === activeProjectId} />
        ))}
        {isCreating && <NewProjectRow onDone={() => setIsCreating(false)} />}
      </ul>
    </div>
  );
};

/* ─── ProjectRow ──────────────────────────────────────────── */

type EditMode = "name" | "color" | null;

const ProjectRow = ({ project, isActive }: { project: Project; isActive: boolean }) => {
  const { tasks, updateProject, deleteProject } = useApp();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [edit, setEdit] = useState<EditMode>(null);
  const [nameValue, setNameValue] = useState(project.name);
  const [hovered, setHovered] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const rowRef = useRef<HTMLLIElement>(null);

  // 색 popover 와 삭제 확인은 자체적으로 "포커스" 가 없어 입력 blur 로 닫을 수 없음 →
  // document 리스너로 외부 클릭/Esc 를 직접 잡는다. 이름 편집은 input 자체의 blur/Esc 가 처리.
  useEffect(() => {
    if (edit !== "color" && !confirming) return;
    const onDown = (e: MouseEvent) => {
      if (rowRef.current?.contains(e.target as Node)) return;
      if (edit === "color") setEdit(null);
      setConfirming(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      if (edit === "color") setEdit(null);
      setConfirming(false);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [edit, confirming]);

  // blur=save (TaskRow 패턴). Esc 는 nameValue 를 원본으로 되돌리고 edit 종료 →
  // 후속 blur 가 fire 되어도 next === project.name 이라 save 가 일어나지 않는다.
  const commitName = () => {
    setEdit(null);
    const next = nameValue.trim().replace(/\s+/g, " ");
    if (!next || next === project.name) {
      setNameValue(project.name);
      return;
    }
    setNameValue(next);
    updateProject(project.id, { name: next });
  };

  const pickColor = (color: string) => {
    setEdit(null);
    if (color === project.color) return;
    updateProject(project.id, { color });
  };

  const handleDeleteClick = () => {
    if (confirming) {
      deleteProject(project.id);
      setConfirming(false);
      return;
    }
    setConfirming(true);
  };

  // 이름 클릭 = 프로젝트 필터 토글 (Round 2 Q4-g, ProjectRow 클릭 충돌 결정 = A).
  // 활성 상태에서 다시 클릭하면 URL 의 project 키 제거 → 필터 해제.
  const handleFilterToggle = () => {
    router.replace(toggleProjectHref(new URLSearchParams(searchParams.toString()), project.id), { scroll: false });
  };

  // 삭제 확인 메시지의 "N개 해제" 카운트 — 낙관 tasks 기준.
  const affectedCount = tasks.filter((t) => t.projectId === project.id).length;

  return (
    <li
      ref={rowRef}
      style={{
        ...S.row,
        ...(isActive ? S.rowActive : {}),
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {/* 활성 인디케이터 — row 좌측 끝에 작은 코랄 막대 */}
      {isActive && <span aria-hidden="true" style={S.activeIndicator} />}

      {/* 색 닷 — 클릭 시 swatch popover */}
      <button
        type="button"
        aria-label="색 변경"
        onClick={() => setEdit(edit === "color" ? null : "color")}
        style={{
          ...S.dotBtn,
          background: project.color,
          width: hovered || edit === "color" ? 12 : 8,
          height: hovered || edit === "color" ? 12 : 8,
        }}
      />

      {edit === "color" && (
        <SwatchPopover selected={project.color} onPick={pickColor} />
      )}

      {/* 이름 — 클릭 = 필터 토글 / ✎ 클릭 = 편집 모드 */}
      {edit === "name" ? (
        <input
          autoFocus
          value={nameValue}
          onChange={(e) => setNameValue(e.target.value)}
          onBlur={commitName}
          onKeyDown={(e) => {
            if (e.key === "Enter") (e.target as HTMLInputElement).blur();
            if (e.key === "Escape") {
              setNameValue(project.name);
              setEdit(null);
            }
          }}
          maxLength={50}
          style={S.nameInput}
        />
      ) : (
        <span
          style={{ ...S.name, ...(isActive ? S.nameActive : {}) }}
          onClick={handleFilterToggle}
          title={isActive ? "필터 해제" : `프로젝트 '${project.name}' 만 보기`}
        >
          {project.name}
        </span>
      )}

      {/* count — 호버하지 않을 때만. 호버 시 ✎/× 버튼이 자리를 차지 */}
      {!hovered && !confirming && (
        <span style={S.count}>{project.count}</span>
      )}

      {/* 편집 ✎ — 호버 시 등장 (삭제 확인 중에는 숨김) */}
      {hovered && !confirming && (
        <button
          type="button"
          onClick={() => {
            setNameValue(project.name);
            setEdit("name");
          }}
          aria-label="이름 변경"
          title="이름 변경"
          style={S.editBtn}
        >
          ✎
        </button>
      )}

      {/* 삭제 — 호버 시 등장, 2단계 확인 */}
      {(hovered || confirming) && (
        <button
          type="button"
          onClick={handleDeleteClick}
          aria-label={confirming ? "삭제 확정" : "프로젝트 삭제"}
          title={confirming ? (affectedCount > 0 ? `정말? ${affectedCount}개 해제` : "정말?") : "삭제"}
          style={{ ...S.deleteBtn, ...(confirming ? S.deleteBtnConfirm : {}) }}
        >
          {confirming ? (affectedCount > 0 ? `정말? · ${affectedCount}` : "정말?") : "×"}
        </button>
      )}
    </li>
  );
};

/* ─── NewProjectRow ──────────────────────────────────────── */

const NewProjectRow = ({ onDone }: { onDone: () => void }) => {
  const { createProject } = useApp();
  const [name, setName] = useState("");
  const [color, setColor] = useState<string>(DEFAULT_PROJECT_COLOR);
  const [pickingColor, setPickingColor] = useState(false);

  // blur 핸들러는 항상 최신 state 를 봐야 함 — input 의 onBlur 가 직접 closures 를
  // 캡처하므로 stale 문제는 없지만, "비어있으면 close, 있으면 create" 분기 명시.
  const commit = () => {
    const trimmed = name.trim().replace(/\s+/g, " ");
    if (!trimmed) {
      onDone();
      return;
    }
    // 클라이언트가 crypto.randomUUID() 로 id 발급 — 낙관 insert 가 즉시 동일 id 사용.
    createProject(crypto.randomUUID(), trimmed, color);
    onDone();
  };

  // 색 dot / swatch 클릭이 input 의 포커스를 빼앗지 않게 mousedown 에서 preventDefault.
  // 이게 없으면 dot 클릭 → input blur → commit → onDone 으로 row 가 닫혀버려 picker 가 안 뜬다.
  const preserveFocus = (e: React.MouseEvent) => e.preventDefault();

  return (
    <li style={{ ...S.row, background: "rgba(255,255,255,0.03)", position: "relative" }}>
      <button
        type="button"
        aria-label="색 선택"
        onMouseDown={preserveFocus}
        onClick={() => setPickingColor((v) => !v)}
        style={{ ...S.dotBtn, background: color, width: 12, height: 12 }}
      />
      {pickingColor && (
        <div onMouseDown={preserveFocus}>
          <SwatchPopover
            selected={color}
            onPick={(c) => {
              setColor(c);
              setPickingColor(false);
            }}
          />
        </div>
      )}
      <input
        autoFocus
        value={name}
        onChange={(e) => setName(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter") (e.target as HTMLInputElement).blur();
          if (e.key === "Escape") {
            // setName("") 후 blur → commit 이 빈 값 처리 → onDone
            setName("");
            (e.target as HTMLInputElement).blur();
          }
        }}
        placeholder="프로젝트 이름"
        autoComplete="off"
        maxLength={50}
        style={S.nameInput}
      />
    </li>
  );
};

/* ─── SwatchPopover ─────────────────────────────────────── */

const SwatchPopover = ({
  selected,
  onPick,
}: {
  selected: string;
  onPick: (color: string) => void;
}) => (
  <div role="dialog" aria-label="색 팔레트" style={S.popover}>
    {PROJECT_COLORS.map((c) => (
      <button
        key={c}
        type="button"
        aria-label={c}
        aria-pressed={c === selected}
        // NewProjectRow 가 부모에서 preventDefault 를 한 번 더 감싸지만,
        // ProjectRow 에서 호출될 때도 동일하게 input 이 없으니 안전한 noop.
        onMouseDown={(e) => e.preventDefault()}
        onClick={() => onPick(c)}
        style={{
          ...S.swatch,
          background: c,
          outline: c === selected ? "2px solid var(--accent-bright)" : "none",
          outlineOffset: c === selected ? 1 : 0,
        }}
      />
    ))}
  </div>
);

/* ─── 스타일 ───────────────────────────────────────────────── */

const S: Record<string, CSSProperties> = {
  section: { display: "flex", flexDirection: "column", gap: 10 },
  sectionHead: { display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 4px" },
  addBtn: {
    width: 18, height: 18, borderRadius: 4,
    background: "transparent", border: "1px solid var(--border)",
    color: "var(--text-muted)", fontSize: 12, lineHeight: 1, cursor: "pointer",
  },
  list: { listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: 2 },
  row: {
    position: "relative",
    display: "flex", alignItems: "center", gap: 10,
    padding: "6px 10px", borderRadius: "var(--radius-sm)",
    fontSize: 13, color: "var(--text-secondary)",
  },
  rowActive: {
    background: "rgba(255,255,255,0.04)",
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
  dotBtn: {
    borderRadius: 2,
    border: "none", padding: 0, cursor: "pointer",
    flexShrink: 0,
    transition: "width .15s, height .15s",
  },
  name: {
    flex: 1, minWidth: 0,
    letterSpacing: -0.1,
    overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
    cursor: "pointer",
  },
  nameActive: {
    color: "var(--text-display)",
    fontWeight: 500,
  },
  nameInput: {
    flex: 1, minWidth: 0,
    background: "transparent", border: "none", outline: "none",
    color: "var(--text-display)",
    fontFamily: "var(--font-body)", fontSize: 13,
    letterSpacing: -0.1, padding: 0,
  },
  count: { fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--text-faint)" },
  editBtn: {
    width: 20, height: 20,
    borderRadius: 4,
    background: "transparent",
    border: "1px solid var(--border)",
    color: "var(--text-muted)",
    fontSize: 11, lineHeight: 1, cursor: "pointer",
    display: "flex", alignItems: "center", justifyContent: "center",
    padding: 0,
  },
  deleteBtn: {
    height: 20, padding: "0 6px",
    borderRadius: 4,
    background: "rgba(217,119,87,0.10)",
    border: "1px solid var(--border-accent)",
    color: "var(--accent-bright)",
    fontSize: 11, lineHeight: 1, cursor: "pointer",
    display: "flex", alignItems: "center", justifyContent: "center",
    fontFamily: "var(--font-mono)", letterSpacing: 0.3,
  },
  deleteBtnConfirm: {
    background: "var(--accent)",
    color: "white",
    borderColor: "var(--accent-deep)",
  },
  popover: {
    position: "absolute", top: "100%", left: 6, zIndex: 50,
    marginTop: 4,
    padding: 8,
    display: "grid", gridTemplateColumns: "repeat(8, 1fr)", gap: 6,
    background: "var(--bg-surface)",
    border: "1px solid var(--border)",
    borderRadius: "var(--radius)",
    boxShadow: "var(--shadow-lg)",
  },
  swatch: {
    width: 18, height: 18, borderRadius: 3,
    border: "none", padding: 0, cursor: "pointer",
  },
};
