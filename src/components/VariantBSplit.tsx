"use client";

import type { CSSProperties } from "react";
import { Checkbox, MonoLabel, ProjectDot } from "./Primitives";
import { AppSidebar, AppTopBar, InputBar } from "./AppShell";
import { MiniCalendar, SubtaskMeter } from "./TaskRow";
import {
  DAY_BUCKETS,
  PROJECTS,
  TASKS,
  projectById,
  type Task,
} from "@/lib/data";
import { TagChip } from "./Primitives";

/* ─── Variant B: Calendar + Timeline Split ─────────────────── */
export const VariantBSplit = ({ onSignOut }: { onSignOut?: () => void }) => {
  return (
    <div style={S.appRoot}>
      <AppSidebar active="today" onSignOut={onSignOut} />
      <div style={S.colMain}>
        <AppTopBar title="이번 주" subtitle="May 25 — 31 · 12 tasks" dense />

        <div style={{ display: "grid", gridTemplateColumns: "1fr 320px", flex: 1, minHeight: 0 }}>
          {/* CENTER — hour timeline */}
          <div style={{ ...S.scrollPad, paddingRight: 16 }} className="no-scrollbar">
            <div style={{ padding: "24px 32px 0" }}>
              {/* editorial today header */}
              <div style={{ display: "flex", alignItems: "baseline", gap: 18, marginBottom: 20 }}>
                <div
                  style={{
                    fontFamily: "var(--font-display)",
                    fontStyle: "italic",
                    fontVariationSettings: '"opsz" 144, "wght" 320',
                    fontSize: 72,
                    lineHeight: 0.9,
                    color: "var(--text-display)",
                    letterSpacing: -2.5,
                  }}
                >
                  Tuesday
                </div>
                <div>
                  <div
                    style={{
                      fontSize: 16,
                      color: "var(--text-secondary)",
                      fontWeight: 500,
                      marginBottom: 2,
                    }}
                  >
                    5월 26일, 화
                  </div>
                  <MonoLabel tracking={1.4}>05 tasks · 1 overdue</MonoLabel>
                </div>
              </div>

              {/* hour timeline */}
              <div style={{ display: "flex", flexDirection: "column" }}>
                {HOUR_ROWS.map((h) => (
                  <HourRow
                    key={h.hour}
                    hour={h.hour}
                    nowLine={h.now}
                    tasks={h.taskIds
                      .map((id) => TASKS.find((t) => t.id === id))
                      .filter((t): t is Task => Boolean(t))}
                  />
                ))}
              </div>

              <div style={{ height: 100 }} />
            </div>

            <InputBar floating />
          </div>

          {/* RIGHT RAIL */}
          <aside style={S.rightRail}>
            <MiniCalendar />

            <div>
              <div style={S.railHead}>
                <MonoLabel tracking={1.5}>다가오는 일정</MonoLabel>
                <a
                  href="#"
                  style={{
                    fontFamily: "var(--font-mono)",
                    fontSize: 10,
                    color: "var(--accent)",
                    textDecoration: "none",
                    letterSpacing: 0.5,
                  }}
                >
                  전체 ↗
                </a>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                {[6, 7, 9, 11].map((id) => {
                  const t = TASKS.find((x) => x.id === id);
                  if (!t) return null;
                  return <UpcomingItem key={id} task={t} />;
                })}
              </div>
            </div>

            <div>
              <div style={S.railHead}>
                <MonoLabel tracking={1.5}>이번 주 진행률</MonoLabel>
              </div>
              <ProgressCard />
            </div>

            <div>
              <div style={S.railHead}>
                <MonoLabel tracking={1.5}>프로젝트별 분포</MonoLabel>
              </div>
              <div
                style={{
                  padding: 14,
                  borderRadius: "var(--radius)",
                  border: "1px solid var(--border)",
                  background: "var(--bg-surface)",
                  display: "flex",
                  flexDirection: "column",
                  gap: 10,
                }}
              >
                {PROJECTS.map((p) => (
                  <div key={p.id} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <span style={{ width: 8, height: 8, borderRadius: 2, background: p.color }} />
                    <span
                      style={{
                        fontSize: 12.5,
                        color: "var(--text-secondary)",
                        flex: 1,
                        letterSpacing: -0.1,
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {p.name}
                    </span>
                    <div
                      style={{
                        width: 60,
                        height: 3,
                        borderRadius: 2,
                        background: "rgba(255,255,255,0.06)",
                        overflow: "hidden",
                      }}
                    >
                      <div
                        style={{
                          width: `${Math.min(100, p.count * 12)}%`,
                          height: "100%",
                          background: p.color,
                          opacity: 0.7,
                        }}
                      />
                    </div>
                    <span
                      style={{
                        fontFamily: "var(--font-mono)",
                        fontSize: 11,
                        color: "var(--text-faint)",
                        minWidth: 16,
                        textAlign: "right",
                      }}
                    >
                      {p.count}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
};

/* ─── Hour rows / now-line / timeline card ─────────────────── */
const HOUR_ROWS: { hour: string; now: boolean; taskIds: number[] }[] = [
  { hour: "07:00", now: false, taskIds: [4] },
  { hour: "09:00", now: false, taskIds: [] },
  { hour: "11:00", now: true,  taskIds: [] },
  { hour: "13:00", now: false, taskIds: [2] },
  { hour: "15:00", now: false, taskIds: [] },
  { hour: "16:00", now: false, taskIds: [3] },
  { hour: "18:00", now: false, taskIds: [] },
  { hour: "20:00", now: false, taskIds: [1, 5] },
];

const HourRow = ({ hour, nowLine, tasks }: { hour: string; nowLine: boolean; tasks: Task[] }) => (
  <div style={{ position: "relative", display: "grid", gridTemplateColumns: "64px 1fr", gap: 0, minHeight: 56 }}>
    <div style={{ borderTop: "1px solid var(--border)", padding: "8px 12px 0 0", textAlign: "right" }}>
      <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--text-faint)", letterSpacing: 0.4 }}>
        {hour}
      </span>
    </div>
    <div
      style={{
        borderTop: "1px solid var(--border)",
        borderLeft: "1px solid var(--border)",
        padding: "6px 0 12px 18px",
        position: "relative",
      }}
    >
      {nowLine && <NowLine />}
      {tasks.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {tasks.map((t) => (
            <TimelineCard key={t.id} task={t} />
          ))}
        </div>
      )}
    </div>
  </div>
);

const NowLine = () => (
  <div
    style={{
      position: "absolute",
      left: -1,
      right: -2,
      top: -2,
      display: "flex",
      alignItems: "center",
      gap: 8,
      pointerEvents: "none",
    }}
  >
    <span
      style={{
        width: 8,
        height: 8,
        borderRadius: "50%",
        background: "var(--accent)",
        boxShadow: "0 0 0 3px rgba(217,119,87,0.18)",
      }}
    />
    <span style={{ flex: 1, height: 1, background: "var(--accent)" }} />
    <span
      style={{
        fontFamily: "var(--font-mono)",
        fontSize: 10,
        color: "var(--accent)",
        letterSpacing: 0.5,
        padding: "2px 6px",
        borderRadius: 3,
        background: "var(--accent-dim)",
        border: "1px solid var(--border-accent)",
      }}
    >
      NOW · 11:34
    </span>
  </div>
);

const TimelineCard = ({ task }: { task: Task }) => {
  const project = projectById(task.project);
  return (
    <div
      style={{
        display: "flex",
        alignItems: "flex-start",
        gap: 12,
        padding: "10px 14px",
        borderRadius: "var(--radius-sm)",
        border: `1px solid ${task.due === "overdue" ? "var(--border-accent)" : "var(--border)"}`,
        background: task.due === "overdue" ? "var(--accent-dim)" : "var(--bg-surface)",
        cursor: "pointer",
      }}
    >
      <span
        style={{
          width: 3,
          alignSelf: "stretch",
          borderRadius: 2,
          background: project ? project.color : "var(--text-faint)",
        }}
      />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginBottom: 3 }}>
          <span
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: 10,
              color: "var(--text-muted)",
              letterSpacing: 0.5,
            }}
          >
            {project?.name}
          </span>
          {task.tags.map((t) => (
            <TagChip key={t} id={t} small />
          ))}
        </div>
        <div
          style={{
            fontSize: 13.5,
            fontWeight: 500,
            color: "var(--text-display)",
            letterSpacing: -0.1,
            lineHeight: 1.35,
          }}
        >
          {task.title}
        </div>
        {task.subtotal > 0 && (
          <div style={{ marginTop: 6 }}>
            <SubtaskMeter total={task.subtotal} done={task.subdone} />
          </div>
        )}
      </div>
      <Checkbox done={task.done} size={16} />
    </div>
  );
};

/* ─── Upcoming + progress (right rail) ─────────────────────── */
const UpcomingItem = ({ task }: { task: Task }) => {
  const project = projectById(task.project);
  const bucket = DAY_BUCKETS.find((b) => b.key === task.due);
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 10,
        padding: "8px 10px",
        borderRadius: "var(--radius-sm)",
        borderBottom: "1px solid var(--border)",
      }}
    >
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", width: 32, flexShrink: 0 }}>
        <span
          style={{
            fontFamily: "var(--font-display)",
            fontStyle: "italic",
            fontVariationSettings: '"opsz" 72, "wght" 380',
            fontSize: 18,
            lineHeight: 1,
            color: "var(--text-display)",
          }}
        >
          {bucket?.date.match(/\d+/)?.[0] || ""}
        </span>
        <span
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: 9,
            color: "var(--text-faint)",
            letterSpacing: 0.5,
            textTransform: "uppercase",
            marginTop: 2,
          }}
        >
          {bucket?.label.split(" ")[0]}
        </span>
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            fontSize: 13,
            color: "var(--text-display)",
            letterSpacing: -0.1,
            fontWeight: 500,
            lineHeight: 1.3,
            overflow: "hidden",
            textOverflow: "ellipsis",
            display: "-webkit-box",
            WebkitLineClamp: 2,
            WebkitBoxOrient: "vertical",
          }}
        >
          {task.title}
        </div>
        <div style={{ marginTop: 3, display: "flex", gap: 6, alignItems: "center" }}>
          <ProjectDot id={task.project} size={5} />
          <span
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: 10,
              color: "var(--text-faint)",
              letterSpacing: 0.3,
            }}
          >
            {project?.name}
          </span>
        </div>
      </div>
    </div>
  );
};

const ProgressCard = () => (
  <div
    style={{
      padding: 16,
      borderRadius: "var(--radius)",
      border: "1px solid var(--border)",
      background: "var(--bg-surface)",
    }}
  >
    <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginBottom: 12 }}>
      <span
        style={{
          fontFamily: "var(--font-display)",
          fontStyle: "italic",
          fontVariationSettings: '"opsz" 96, "wght" 320',
          fontSize: 42,
          lineHeight: 0.9,
          color: "var(--text-display)",
          letterSpacing: -1.5,
        }}
      >
        04<span style={{ color: "var(--text-faint)", fontSize: 24 }}> / 13</span>
      </span>
    </div>
    <div
      style={{
        height: 4,
        borderRadius: 2,
        background: "rgba(255,255,255,0.06)",
        overflow: "hidden",
        marginBottom: 12,
      }}
    >
      <div style={{ width: "31%", height: "100%", background: "var(--accent)" }} />
    </div>
    <div style={{ display: "flex", justifyContent: "space-between" }}>
      <MonoLabel size={10} tracking={1}>완료 / 전체</MonoLabel>
      <span
        style={{
          fontFamily: "var(--font-mono)",
          fontSize: 10,
          color: "var(--accent)",
          letterSpacing: 0.3,
        }}
      >
        +2 어제보다
      </span>
    </div>
  </div>
);

const S: Record<string, CSSProperties> = {
  appRoot: {
    width: "100%",
    height: "100vh",
    background: "var(--bg-page)",
    color: "var(--text-secondary)",
    fontFamily: "var(--font-body)",
    display: "flex",
    overflow: "hidden",
  },
  colMain: { flex: 1, display: "flex", flexDirection: "column", minWidth: 0 },
  scrollPad: { flex: 1, position: "relative", overflow: "auto", minHeight: 0 },
  rightRail: {
    background: "var(--bg-sidebar)",
    borderLeft: "1px solid var(--border)",
    padding: "24px 20px",
    display: "flex",
    flexDirection: "column",
    gap: 24,
    overflowY: "auto",
  },
  railHead: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 10,
  },
};
