"use client";

import type { CSSProperties } from "react";
import { signOut } from "@/app/auth/actions";
import { KeyHint, MonoLabel, ProjectDot, TagChip } from "./Primitives";
import { PROJECTS, TAGS } from "@/lib/data";

export type DisplayUser = { name: string; email: string; avatarUrl?: string };

type SidebarProps = { active?: string; compact?: boolean; user: DisplayUser };

export const AppSidebar = ({ active = "today", compact = false, user }: SidebarProps) => {
  const navItems = [
    { id: "today",    label: "오늘",   count: 5,  kbd: "⌘1" },
    { id: "upcoming", label: "예정",   count: 8,  kbd: "⌘2" },
    { id: "inbox",    label: "인박스", count: 2,  kbd: "⌘3" },
    { id: "someday",  label: "언젠가", count: 12, kbd: null },
    { id: "done",     label: "완료",   count: 47, kbd: null },
  ];

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
          <button style={S.iconBtn} aria-label="sign out" type="submit">
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
              <circle cx="3" cy="8" r="1.5" fill="currentColor" />
              <circle cx="8" cy="8" r="1.5" fill="currentColor" />
              <circle cx="13" cy="8" r="1.5" fill="currentColor" />
            </svg>
          </button>
        </form>
      </div>

      {/* primary nav */}
      <nav style={S.nav}>
        {navItems.map((n) => {
          const isActive = n.id === active;
          return (
            <a
              key={n.id}
              href="#"
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
      <div style={S.section}>
        <div style={S.sectionHead}>
          <MonoLabel tracking={1.4} size={10}>Projects</MonoLabel>
          <button style={S.addBtn} aria-label="add project" type="button">+</button>
        </div>
        <ul style={S.projList}>
          {PROJECTS.map((p) => (
            <li key={p.id} style={S.projRow}>
              <span
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: 2,
                  background: p.color,
                  flexShrink: 0,
                }}
              />
              <span style={S.projName}>{p.name}</span>
              <span style={S.projCount}>{p.count}</span>
            </li>
          ))}
        </ul>
      </div>

      {/* tags */}
      <div style={S.section}>
        <div style={S.sectionHead}>
          <MonoLabel tracking={1.4} size={10}>Tags</MonoLabel>
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
          {TAGS.map((t) => (
            <TagChip key={t.id} id={t.id} small />
          ))}
        </div>
      </div>

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

export const AppTopBar = ({
  title = "오늘",
  subtitle = "5월 26일, 화요일",
  dense = false,
}: {
  title?: string;
  subtitle?: string;
  dense?: boolean;
}) => (
  <div style={{ ...S.topbar, padding: dense ? "14px 32px" : "20px 40px" }}>
    <div style={{ display: "flex", alignItems: "baseline", gap: 14, minWidth: 0 }}>
      <h1 style={S.topTitle}>{title}</h1>
      <span style={S.topSub}>{subtitle}</span>
    </div>
    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
      <div style={S.search}>
        <svg width="13" height="13" viewBox="0 0 16 16" fill="none" style={{ opacity: 0.5 }}>
          <circle cx="7" cy="7" r="4.5" stroke="currentColor" strokeWidth="1.4" />
          <path d="M10.5 10.5l3 3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
        </svg>
        <span style={{ color: "var(--text-faint)", fontSize: 13 }}>할 일, 프로젝트 검색</span>
        <span style={{ marginLeft: "auto", display: "flex", gap: 4 }}>
          <KeyHint>⌘</KeyHint>
          <KeyHint>K</KeyHint>
        </span>
      </div>
      <button style={S.filterBtn} type="button">
        <span>필터</span>
        <span style={{ color: "var(--accent)" }}>· 2</span>
      </button>
    </div>
  </div>
);

export const InputBar = ({ floating = false }: { floating?: boolean }) => (
  <div style={{ ...S.inputBar, ...(floating ? S.inputBarFloating : {}) }}>
    <span style={S.inputPlus}>+</span>
    <input
      placeholder="할 일 추가 — 내용을 적고 Enter, # 으로 프로젝트, @ 로 마감일"
      style={S.inputField}
      readOnly
    />
    <div style={S.inputChips}>
      <span style={S.chipMuted}>
        <ProjectDot id="p1" size={6} /> AI 치트키 채널
      </span>
      <span style={S.chipAccent}>오늘</span>
    </div>
    <span style={{ display: "flex", gap: 4 }}>
      <KeyHint>↵</KeyHint>
    </span>
  </div>
);

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
  addBtn: {
    width: 18, height: 18, borderRadius: 4,
    background: "transparent", border: "1px solid var(--border)",
    color: "var(--text-muted)", fontSize: 12, lineHeight: 1, cursor: "pointer",
  },
  projList: { listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: 2 },
  projRow: {
    display: "flex", alignItems: "center", gap: 10,
    padding: "6px 10px", borderRadius: "var(--radius-sm)",
    fontSize: 13, color: "var(--text-secondary)", cursor: "pointer",
  },
  projName: { flex: 1, letterSpacing: -0.1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" },
  projCount: { fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--text-faint)" },
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
  chipMuted: {
    display: "inline-flex", alignItems: "center", gap: 6,
    padding: "3px 9px", borderRadius: "var(--radius-full)",
    border: "1px solid var(--border)",
    background: "rgba(255,255,255,0.03)",
    fontSize: 11, color: "var(--text-muted)",
    fontFamily: "var(--font-mono)", letterSpacing: 0.2,
  },
  chipAccent: {
    padding: "3px 9px", borderRadius: "var(--radius-full)",
    border: "1px solid var(--border-accent)",
    background: "var(--accent-dim)",
    fontSize: 11, color: "var(--accent-bright)",
    fontFamily: "var(--font-mono)", letterSpacing: 0.4,
  },
};
