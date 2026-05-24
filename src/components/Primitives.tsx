"use client";

import type { CSSProperties, ReactNode } from "react";
import { useApp } from "@/lib/AppContext";
import { type DayBucket } from "@/lib/data";

/* ─── Checkbox ───────────────────────────────────────────── */
export const Checkbox = ({
  done,
  size = 18,
  onClick,
}: {
  done?: boolean;
  size?: number;
  onClick?: () => void;
}) => {
  const s: CSSProperties = {
    width: size,
    height: size,
    borderRadius: 5,
    border: `1.5px solid ${done ? "var(--accent)" : "var(--border-strong)"}`,
    background: done ? "var(--accent)" : "transparent",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
    cursor: "pointer",
    padding: 0,
    transition: "border-color .15s, background .15s, transform .1s",
  };
  return (
    <button onClick={onClick} style={s} aria-label="toggle" type="button">
      {done && (
        <svg viewBox="0 0 16 16" width={size * 0.7} height={size * 0.7} fill="none">
          <path d="M3 8.5l3 3 7-7" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      )}
    </button>
  );
};

/* ─── Small atoms ────────────────────────────────────────── */
export const ProjectDot = ({ id, size = 7 }: { id: string | null; size?: number }) => {
  const { projects } = useApp();
  const p = id ? projects.find((pr) => pr.id === id) : null;
  return (
    <span
      style={{
        width: size,
        height: size,
        borderRadius: "50%",
        background: p ? p.color : "var(--text-faint)",
        display: "inline-block",
        flexShrink: 0,
      }}
    />
  );
};

/**
 * onRemove 가 전달되면 chip 우상단에 작은 × 가 항상 노출됨 — 호출처가 "지금 편집 모드"
 * 일 때만 prop 을 넘겨 visibility 를 제어 (TaskRow/TimelineCard 가 호버 상태에 따라 결정).
 */
export const TagChip = ({
  id,
  small = false,
  onRemove,
}: {
  id: string;
  small?: boolean;
  onRemove?: () => void;
}) => {
  const { tags } = useApp();
  const t = tags.find((tg) => tg.id === id);
  if (!t) return null;
  const isAccent = t.hue === "accent";
  return (
    <span
      style={{
        position: "relative",
        display: "inline-flex",
        alignItems: "center",
        padding: small ? "1px 7px" : "2px 8px",
        borderRadius: "var(--radius-full)",
        border: `1px solid ${isAccent ? "var(--border-accent)" : "var(--border)"}`,
        background: isAccent ? "var(--accent-dim)" : "rgba(255,255,255,0.04)",
        fontFamily: "var(--font-mono)",
        fontSize: small ? 10 : 11,
        letterSpacing: 0.3,
        color: isAccent ? "var(--accent-bright)" : "var(--text-muted)",
        whiteSpace: "nowrap",
      }}
    >
      {t.name}
      {onRemove && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onRemove();
          }}
          aria-label={`${t.name} 태그 제거`}
          style={{
            position: "absolute",
            top: -6, right: -6,
            width: 13, height: 13, borderRadius: "50%",
            background: "var(--accent)",
            border: "1px solid var(--accent-deep)",
            color: "white",
            fontSize: 9, lineHeight: 1, cursor: "pointer",
            display: "flex", alignItems: "center", justifyContent: "center",
            padding: 0,
            boxShadow: "0 0 0 2px var(--bg-surface)",
          }}
        >
          ×
        </button>
      )}
    </span>
  );
};

export const MonoLabel = ({
  children,
  color = "var(--text-faint)",
  tracking = 1.5,
  size = 11,
}: {
  children: ReactNode;
  color?: string;
  tracking?: number;
  size?: number;
}) => (
  <span
    style={{
      fontFamily: "var(--font-mono)",
      fontSize: size,
      fontWeight: 500,
      letterSpacing: tracking,
      textTransform: "uppercase",
      color,
    }}
  >
    {children}
  </span>
);

export const KeyHint = ({ children }: { children: ReactNode }) => (
  <kbd
    style={{
      fontFamily: "var(--font-mono)",
      fontSize: 10,
      fontWeight: 600,
      padding: "2px 6px",
      borderRadius: 4,
      background: "rgba(255,255,255,0.05)",
      border: "1px solid var(--border)",
      color: "var(--text-muted)",
      letterSpacing: 0.4,
    }}
  >
    {children}
  </kbd>
);

/* ─── Logos / Icons ──────────────────────────────────────── */
export const GoogleIcon = ({ size = 18 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 18 18" aria-hidden="true">
    <path fill="#4285F4" d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844a4.14 4.14 0 0 1-1.796 2.716v2.258h2.908c1.702-1.567 2.684-3.874 2.684-6.615z" />
    <path fill="#34A853" d="M9 18c2.43 0 4.467-.806 5.956-2.184l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.583-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z" />
    <path fill="#FBBC05" d="M3.964 10.706A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.706V4.962H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.038l3.007-2.332z" />
    <path fill="#EA4335" d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.962L3.964 7.294C4.672 5.166 6.656 3.58 9 3.58z" />
  </svg>
);

export const LogoMark = ({ size = 32, font = 12 }: { size?: number; font?: number }) => (
  <div
    style={{
      width: size,
      height: size,
      borderRadius: "var(--radius-sm)",
      background: "linear-gradient(135deg, var(--accent), var(--accent-deep))",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      fontFamily: "var(--font-mono)",
      fontWeight: 600,
      fontSize: font,
      color: "white",
      letterSpacing: -0.5,
      flexShrink: 0,
    }}
  >
    치트
  </div>
);

/* ─── DayHeader (used by timeline variants) ─────────────── */
export const DayHeader = ({
  bucket,
  count,
  accent = false,
}: {
  bucket: DayBucket;
  count: number;
  accent?: boolean;
}) => (
  <div
    style={{
      display: "flex",
      alignItems: "baseline",
      gap: 16,
      paddingBottom: 14,
      marginBottom: 18,
      borderBottom: `1px solid ${accent ? "var(--border-accent)" : "var(--border)"}`,
    }}
  >
    <h2
      style={{
        fontFamily: "var(--font-display)",
        fontSize: 38,
        fontWeight: 400,
        fontVariationSettings: '"opsz" 96, "wght" 360',
        letterSpacing: -0.8,
        lineHeight: 1,
        color: accent ? "var(--accent-bright)" : "var(--text-display)",
        fontStyle: accent ? "italic" : "normal",
        margin: 0,
      }}
    >
      {bucket.fraunces}
    </h2>
    <span style={{ fontFamily: "var(--font-body)", fontSize: 14, fontWeight: 500, color: "var(--text-secondary)", letterSpacing: -0.1 }}>
      {bucket.label}
    </span>
    <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--text-faint)", letterSpacing: 0.5 }}>
      {bucket.date}
    </span>
    <span style={{ flex: 1 }} />
    <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--text-muted)", letterSpacing: 0.8 }}>
      {String(count).padStart(2, "0")} tasks
    </span>
  </div>
);
