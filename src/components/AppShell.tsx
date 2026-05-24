"use client";

import type { CSSProperties } from "react";
import { useFormStatus } from "react-dom";
import { useRef, useState, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { signOut } from "@/app/auth/actions";
import { createTask } from "@/app/tasks/actions";
import { KeyHint, MonoLabel } from "./Primitives";
import { ProjectList } from "./ProjectList";
import { TagList } from "./TagList";
import { useApp } from "@/lib/AppContext";
import { toISODate } from "@/lib/data";
import { parseView, toggleViewHref, type ViewKey } from "@/lib/view";

export type DisplayUser = { name: string; email: string; avatarUrl?: string };

type SidebarProps = { compact?: boolean; user: DisplayUser };

/**
 * nav 카운트는 항상 "프로젝트 필터를 무시한 전역 카운트" (Q3-d).
 * inbox 분리 (Q3-a) 적용 후 정의 충돌 해소됨.
 */
export const AppSidebar = ({ compact = false, user }: SidebarProps) => {
  const { tasks } = useApp();
  const router = useRouter();
  const searchParams = useSearchParams();
  const activeView = parseView(searchParams.get("view"));

  const navItems: { id: ViewKey; label: string; count: number; kbd: string | null }[] = [
    { id: "today",    label: "오늘",   count: tasks.filter((t) => (t.bucket === "today" || t.bucket === "overdue") && !t.done).length, kbd: "⌘1" },
    { id: "upcoming", label: "예정",   count: tasks.filter((t) => ["tomorrow","day3","day4","day5","day6","day7"].includes(t.bucket) && !t.done).length, kbd: "⌘2" },
    { id: "inbox",    label: "인박스", count: tasks.filter((t) => t.bucket === "inbox" && !t.done).length, kbd: "⌘3" },
    { id: "someday",  label: "언젠가", count: tasks.filter((t) => t.bucket === "later" && !t.done).length, kbd: null },
    { id: "done",     label: "완료",   count: tasks.filter((t) => t.done).length, kbd: null },
  ];

  const handleNavClick = (e: React.MouseEvent, viewId: ViewKey) => {
    e.preventDefault();
    // router.replace — 히스토리 폭증 방지 (Q3-c). 동일 뷰 재클릭은 toggleViewHref 가 default 로 처리.
    router.replace(toggleViewHref(new URLSearchParams(searchParams.toString()), viewId), { scroll: false });
  };

  return (
    <aside style={{ ...S.sidebar, width: compact ? 220 : 260 }}>
      {/* user block */}
      <div style={S.userRow}>
        <div style={S.avatar}>{user.name.charAt(0) || "?"}</div>
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={S.userName}>{user.name}</div>
          <div style={S.userEmail}>{user.email}</div>
        </div>
        <form action={signOut}>
          <SignOutButton />
        </form>
      </div>

      {/* primary nav */}
      <nav style={S.nav}>
        {navItems.map((n) => {
          const isActive = n.id === activeView;
          return (
            <a
              key={n.id}
              href={toggleViewHref(new URLSearchParams(searchParams.toString()), n.id)}
              onClick={(e) => handleNavClick(e, n.id)}
              style={{ ...S.navLink, ...(isActive ? S.navLinkActive : {}) }}
            >
              <span
                style={{
                  width: 6,
                  height: 6,
                  borderRadius: "50%",
                  background: isActive ? "var(--accent)" : "var(--text-faint)",
                  boxShadow: isActive ? "0 0 8px var(--accent)" : "none",
                  flexShrink: 0,
                }}
              />
              <span style={S.navLabel}>{n.label}</span>
              <span style={S.navCount}>{n.count}</span>
            </a>
          );
        })}
      </nav>

      {/* projects */}
      <ProjectList />

      {/* tags */}
      <TagList />

      {/* shortcut */}
      <div style={S.shortcutBox}>
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
          <MonoLabel size={9} tracking={1}>Shortcut</MonoLabel>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <KeyHint>⌘</KeyHint>
          <KeyHint>N</KeyHint>
          <span style={{ fontSize: 12, color: "var(--text-muted)" }}>새 할 일</span>
        </div>
      </div>
    </aside>
  );
};

/**
 * searchQuery / onSearchChange / searchInputRef 는 controlled input 패턴.
 * 부모 (VariantBSplitInner) 가 state 와 ⌘K/Esc 전역 단축키를 소유 — TopBar 는
 * 순수 view. inputRef 를 prop 으로 받아 부모가 ref.focus() 호출 가능.
 *
 * 검색어가 있을 때만 우측 × clear 버튼 노출 (mousedown=preventDefault 로
 * input focus 유지 — 클릭 직후에도 계속 타이핑 가능).
 */
export const AppTopBar = ({
  title,
  subtitle,
  dense = false,
  searchQuery,
  onSearchChange,
  searchInputRef,
}: {
  title: string;
  subtitle: string;
  dense?: boolean;
  searchQuery: string;
  onSearchChange: (value: string) => void;
  searchInputRef: React.RefObject<HTMLInputElement | null>;
}) => {
  return (
    <div style={{ ...S.topbar, padding: dense ? "14px 32px" : "20px 40px" }}>
      <div style={{ display: "flex", alignItems: "baseline", gap: 14, minWidth: 0 }}>
        <h1 style={S.topTitle}>{title}</h1>
        <span style={S.topSub}>{subtitle}</span>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <label style={S.search}>
          <svg width="13" height="13" viewBox="0 0 16 16" fill="none" style={{ opacity: 0.5, flexShrink: 0 }} aria-hidden="true">
            <circle cx="7" cy="7" r="4.5" stroke="currentColor" strokeWidth="1.4" />
            <path d="M10.5 10.5l3 3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
          </svg>
          <input
            ref={searchInputRef}
            type="search"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            onKeyDown={(e) => {
              // Esc: 검색어 비우고 blur. 입력에 포커스가 있을 때만 동작 — ⌘K 는
              // 부모의 전역 리스너가 처리해서 어디서든 input 으로 점프.
              if (e.key === "Escape") {
                onSearchChange("");
                (e.target as HTMLInputElement).blur();
              }
            }}
            placeholder="할 일, 프로젝트 검색"
            aria-label="검색"
            autoComplete="off"
            // 일부 브라우저의 type=search 기본 X 버튼 제거 (자체 × 사용)
            style={S.searchInput}
          />
          {searchQuery ? (
            <button
              type="button"
              aria-label="검색어 지우기"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => onSearchChange("")}
              style={S.searchClear}
            >
              ×
            </button>
          ) : (
            <span style={{ marginLeft: "auto", display: "flex", gap: 4, flexShrink: 0 }}>
              <KeyHint>⌘</KeyHint>
              <KeyHint>K</KeyHint>
            </span>
          )}
        </label>
        <button style={S.filterBtn} type="button">
          <span>필터</span>
          <span style={{ color: "var(--accent)" }}>· 2</span>
        </button>
      </div>
    </div>
  );
};

/* ─── InputBar (활성화) ─────────────────────────────────────── */

export const InputBar = ({ floating = false }: { floating?: boolean }) => {
  const formRef = useRef<HTMLFormElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [value, setValue] = useState("");
  const [, startTransition] = useTransition();
  const { reportError } = useApp();
  const router = useRouter();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = value.trim();
    if (!trimmed) return;

    const fd = new FormData();
    fd.set("title", trimmed);
    fd.set("due_date", toISODate(new Date())); // 기본: 오늘

    // 낙관적으로 input 을 비우되, 실패 시 복원해서 사용자 입력 손실을 막는다.
    setValue("");
    inputRef.current?.focus();

    startTransition(async () => {
      try {
        await createTask(fd);
      } catch (err) {
        const msg = err instanceof Error ? err.message : "task 생성 실패";
        reportError(msg);
        setValue(trimmed);
        router.refresh();
      }
    });
  };

  return (
    <form
      ref={formRef}
      onSubmit={handleSubmit}
      style={{ ...S.inputBar, ...(floating ? S.inputBarFloating : {}) }}
    >
      <span style={S.inputPlus}>+</span>
      <input
        ref={inputRef}
        name="title"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="할 일 추가 — 내용을 적고 Enter, # 으로 프로젝트, @ 로 마감일"
        style={S.inputField}
        autoComplete="off"
      />
      <div style={S.inputChips}>
        <span style={S.chipAccent}>오늘</span>
      </div>
      <span style={{ display: "flex", gap: 4 }}>
        <KeyHint>↵</KeyHint>
      </span>
    </form>
  );
};

const S: Record<string, CSSProperties> = {
  sidebar: {
    background: "var(--bg-sidebar)",
    borderRight: "1px solid var(--border)",
    padding: "20px 16px",
    display: "flex",
    flexDirection: "column",
    gap: 22,
    overflowY: "hidden",
    flexShrink: 0,
  },
  userRow: { display: "flex", alignItems: "center", gap: 10, padding: "6px 8px", borderRadius: "var(--radius)" },
  avatar: {
    width: 32, height: 32, borderRadius: "50%",
    background: "linear-gradient(135deg, var(--accent), var(--accent-deep))",
    display: "flex", alignItems: "center", justifyContent: "center",
    color: "white", fontWeight: 600, fontSize: 13,
    fontFamily: "var(--font-body)", flexShrink: 0,
  },
  userName: {
    fontSize: 13, fontWeight: 600, color: "var(--text-display)",
    letterSpacing: -0.2,
    overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
  },
  userEmail: {
    fontSize: 11, color: "var(--text-faint)", fontFamily: "var(--font-mono)",
    overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
  },
  iconBtn: {
    width: 26, height: 26, borderRadius: 6,
    background: "transparent", border: "1px solid transparent",
    color: "var(--text-muted)",
    display: "flex", alignItems: "center", justifyContent: "center",
    cursor: "pointer",
  },
  nav: { display: "flex", flexDirection: "column", gap: 2 },
  navLink: {
    display: "flex", alignItems: "center", gap: 10,
    padding: "8px 10px", borderRadius: "var(--radius-sm)",
    fontSize: 13.5, color: "var(--text-secondary)",
    textDecoration: "none",
    transition: "background .15s, color .15s",
  },
  navLinkActive: { background: "rgba(255,255,255,0.04)", color: "var(--text-display)" },
  navLabel: { flex: 1, letterSpacing: -0.1 },
  navCount: { fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--text-faint)", letterSpacing: 0.3 },
  section: { display: "flex", flexDirection: "column", gap: 10 },
  sectionHead: { display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 4px" },
  shortcutBox: {
    marginTop: "auto",
    padding: "10px 12px", borderRadius: "var(--radius)",
    border: "1px solid var(--border)", background: "rgba(255,255,255,0.02)",
  },

  topbar: {
    display: "flex", alignItems: "center", justifyContent: "space-between",
    gap: 16,
    borderBottom: "1px solid var(--border)",
    background: "rgba(38,38,36,0.6)",
    backdropFilter: "blur(12px)",
    flexShrink: 0,
  },
  topTitle: {
    fontFamily: "var(--font-display)",
    fontVariationSettings: '"opsz" 72, "wght" 360',
    fontSize: 32, fontWeight: 400,
    color: "var(--text-display)",
    letterSpacing: -0.8, lineHeight: 1,
    margin: 0,
  },
  topSub: { fontSize: 13, color: "var(--text-muted)", fontFamily: "var(--font-mono)", letterSpacing: 0.3 },
  search: {
    display: "flex", alignItems: "center", gap: 8,
    padding: "8px 12px",
    minWidth: 280, borderRadius: "var(--radius)",
    border: "1px solid var(--border)",
    background: "rgba(255,255,255,0.03)",
    color: "var(--text-muted)",
    cursor: "text",
  },
  searchInput: {
    flex: 1, minWidth: 0,
    background: "transparent", border: "none", outline: "none",
    color: "var(--text-display)",
    fontFamily: "var(--font-body)", fontSize: 13,
    letterSpacing: -0.1,
    padding: 0,
    // 일부 브라우저의 type=search 기본 X 버튼 제거 (자체 × 사용)
    WebkitAppearance: "none",
  },
  searchClear: {
    width: 18, height: 18, borderRadius: 3,
    background: "transparent", border: "none",
    color: "var(--text-muted)", cursor: "pointer",
    fontSize: 14, lineHeight: 1, padding: 0,
    display: "flex", alignItems: "center", justifyContent: "center",
    flexShrink: 0,
  },
  filterBtn: {
    display: "flex", alignItems: "center", gap: 6,
    padding: "8px 12px", borderRadius: "var(--radius)",
    border: "1px solid var(--border)",
    background: "transparent", color: "var(--text-secondary)",
    fontSize: 13, cursor: "pointer",
  },

  inputBar: {
    display: "flex", alignItems: "center", gap: 12,
    padding: "12px 16px",
    borderRadius: "var(--radius)",
    border: "1px solid var(--border-strong)",
    background: "var(--bg-surface)",
    boxShadow: "var(--shadow-md)",
  },
  inputBarFloating: {
    position: "absolute", left: "50%", bottom: 24,
    transform: "translateX(-50%)",
    width: "min(720px, calc(100% - 80px))",
    boxShadow: "var(--shadow-lg)",
    border: "1px solid var(--border-accent)",
    background: "rgba(45,44,42,0.92)",
    backdropFilter: "blur(10px)",
  },
  inputPlus: {
    width: 22, height: 22, borderRadius: 5,
    background: "var(--accent-dim)",
    color: "var(--accent-bright)",
    border: "1px solid var(--border-accent)",
    display: "flex", alignItems: "center", justifyContent: "center",
    fontSize: 14, lineHeight: 1, fontWeight: 600,
  },
  inputField: {
    flex: 1, minWidth: 0,
    background: "transparent", border: "none", outline: "none",
    color: "var(--text-display)",
    fontFamily: "var(--font-body)", fontSize: 14,
    letterSpacing: -0.1,
  },
  inputChips: { display: "flex", gap: 6 },
  chipAccent: {
    padding: "3px 9px", borderRadius: "var(--radius-full)",
    border: "1px solid var(--border-accent)",
    background: "var(--accent-dim)",
    fontSize: 11, color: "var(--accent-bright)",
    fontFamily: "var(--font-mono)", letterSpacing: 0.4,
  },
};

function SignOutButton() {
  const { pending } = useFormStatus();
  return (
    <button
      style={{
        ...S.iconBtn,
        opacity: pending ? 0.5 : 1,
        cursor: pending ? "wait" : "pointer",
      }}
      aria-label="로그아웃"
      title="로그아웃"
      type="submit"
      disabled={pending}
    >
      <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
        <path d="M6.5 2.5h-3a1 1 0 0 0-1 1v9a1 1 0 0 0 1 1h3" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
        <path d="M10.5 5l3 3-3 3" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M13.5 8h-7" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
      </svg>
    </button>
  );
}
