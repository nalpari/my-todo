"use client";

import type { CSSProperties } from "react";
import { Checkbox, MonoLabel, ProjectDot, TagChip } from "./Primitives";
import { projectById, type Task } from "@/lib/data";

export type ItemStyle = "editorial" | "card" | "minimal";

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
  const project = projectById(task.project);
  const hasSub = task.subtotal > 0;

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
      >
        <Checkbox done={task.done} />
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
                <ProjectDot id={task.project} size={6} />
                {project.name}
              </span>
            )}
          </div>
          <div
            style={{
              fontSize: 14.5,
              fontWeight: 500,
              color: task.done ? "var(--text-faint)" : "var(--text-display)",
              textDecoration: task.done ? "line-through" : "none",
              letterSpacing: -0.1,
              lineHeight: 1.4,
              marginBottom: 8,
            }}
          >
            {task.title}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
            {showTime && task.time && (
              <span
                style={{
                  fontFamily: "var(--font-mono)",
                  fontSize: 11,
                  color: "var(--text-muted)",
                  letterSpacing: 0.4,
                }}
              >
                {task.time}
              </span>
            )}
            {task.tags.map((t) => (
              <TagChip key={t} id={t} small />
            ))}
            {hasSub && <SubtaskMeter total={task.subtotal} done={task.subdone} />}
          </div>
        </div>
      </div>
    );
  }

  if (style === "minimal") {
    return (
      <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "8px 4px", borderRadius: 4 }}>
        <Checkbox done={task.done} size={16} />
        <span
          style={{
            fontSize: 14,
            color: task.done ? "var(--text-faint)" : "var(--text-secondary)",
            textDecoration: task.done ? "line-through" : "none",
            flex: 1,
            minWidth: 0,
            letterSpacing: -0.1,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {task.title}
        </span>
        {showProject && project && <ProjectDot id={task.project} size={6} />}
        {showTime && task.time && (
          <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--text-faint)", letterSpacing: 0.3 }}>
            {task.time}
          </span>
        )}
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
      }}
    >
      <span
        style={{
          fontFamily: "var(--font-mono)",
          fontSize: 11,
          color: task.time ? "var(--text-muted)" : "var(--text-faint)",
          letterSpacing: 0.4,
          paddingTop: 3,
        }}
      >
        {showTime ? task.time || "—:—" : ""}
      </span>

      <div style={{ paddingTop: 1 }}>
        <Checkbox done={task.done} />
      </div>

      <div style={{ minWidth: 0 }}>
        <div
          style={{
            fontSize: 15,
            fontWeight: 500,
            color: task.done ? "var(--text-faint)" : "var(--text-display)",
            textDecoration: task.done ? "line-through" : "none",
            letterSpacing: -0.15,
            lineHeight: 1.4,
          }}
        >
          {task.title}
        </div>
        {((showProject && project) || task.tags.length > 0 || hasSub) && (
          <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", marginTop: 6 }}>
            {showProject && project && (
              <span
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 5,
                  fontSize: 11.5,
                  color: "var(--text-muted)",
                }}
              >
                <ProjectDot id={task.project} size={6} />
                {project.name}
              </span>
            )}
            {task.tags.map((t) => (
              <TagChip key={t} id={t} small />
            ))}
            {hasSub && <SubtaskMeter total={task.subtotal} done={task.subdone} />}
          </div>
        )}
      </div>

      <span
        style={{
          fontFamily: "var(--font-display)",
          fontStyle: "italic",
          fontVariationSettings: '"opsz" 14, "wght" 400',
          fontSize: 13,
          color: "var(--text-faint)",
        }}
      >
        № {String(task.id).padStart(2, "0")}
      </span>
    </div>
  );
};

export const SubtaskMeter = ({ total, done }: { total: number; done: number }) => (
  <span
    style={{
      display: "inline-flex",
      alignItems: "center",
      gap: 6,
      fontFamily: "var(--font-mono)",
      fontSize: 10,
      color: "var(--text-muted)",
      letterSpacing: 0.3,
    }}
  >
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
      <rect
        x="2"
        y="3"
        width="3"
        height="3"
        rx="0.5"
        stroke="currentColor"
        strokeWidth="1.3"
        fill={done > 0 ? "currentColor" : "none"}
        opacity={done > 0 ? 0.7 : 1}
      />
      <line x1="7" y1="4.5" x2="14" y2="4.5" stroke="currentColor" strokeWidth="1.3" />
      <rect x="2" y="10" width="3" height="3" rx="0.5" stroke="currentColor" strokeWidth="1.3" />
      <line x1="7" y1="11.5" x2="14" y2="11.5" stroke="currentColor" strokeWidth="1.3" />
    </svg>
    {done}/{total}
  </span>
);

/* ─── Mini calendar (right rail) ───────────────────────────── */
export const MiniCalendar = ({ compact = false }: { compact?: boolean }) => {
  const days = Array.from({ length: 35 }, (_, i) => {
    const d = i - 3;
    return {
      n: d <= 0 ? 30 + d : d > 31 ? d - 31 : d,
      dim: d <= 0 || d > 31,
      today: d === 26,
      hasTask: [25, 26, 27, 28, 29].includes(d) || d === 31,
      heavy: d === 26 || d === 27,
    };
  });

  return (
    <div
      style={{
        padding: compact ? 14 : 18,
        borderRadius: "var(--radius)",
        border: "1px solid var(--border)",
        background: "var(--bg-surface)",
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 12 }}>
        <div>
          <div
            style={{
              fontFamily: "var(--font-display)",
              fontStyle: "italic",
              fontVariationSettings: '"opsz" 72, "wght" 380',
              fontSize: 24,
              color: "var(--text-display)",
              letterSpacing: -0.5,
              lineHeight: 1,
            }}
          >
            May
          </div>
          <MonoLabel size={10} tracking={1.2}>2026 · 5월</MonoLabel>
        </div>
        <div style={{ display: "flex", gap: 4 }}>
          <button style={miniBtn} type="button">‹</button>
          <button style={miniBtn} type="button">›</button>
        </div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 2, marginBottom: 6 }}>
        {["M", "T", "W", "T", "F", "S", "S"].map((d, i) => (
          <span
            key={i}
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: 9,
              color: i >= 5 ? "var(--text-faint)" : "var(--text-muted)",
              letterSpacing: 0.5,
              textAlign: "center",
              paddingBottom: 4,
            }}
          >
            {d}
          </span>
        ))}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 2 }}>
        {days.map((d, i) => (
          <div
            key={i}
            style={{
              aspectRatio: "1",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              borderRadius: 5,
              background: d.today ? "var(--accent)" : "transparent",
              color: d.today ? "white" : d.dim ? "var(--text-faint)" : "var(--text-secondary)",
              fontSize: 11.5,
              fontWeight: d.today ? 600 : 400,
              fontFamily: "var(--font-body)",
              position: "relative",
            }}
          >
            {d.n}
            {d.hasTask && !d.today && (
              <span
                style={{
                  position: "absolute",
                  bottom: 2,
                  width: d.heavy ? 4 : 3,
                  height: d.heavy ? 4 : 3,
                  borderRadius: "50%",
                  background: d.heavy ? "var(--accent)" : "var(--text-faint)",
                }}
              />
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

const miniBtn: CSSProperties = {
  width: 22,
  height: 22,
  borderRadius: 5,
  background: "transparent",
  border: "1px solid var(--border)",
  color: "var(--text-muted)",
  fontSize: 13,
  cursor: "pointer",
};
