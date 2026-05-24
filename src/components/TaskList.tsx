"use client";

import type { CSSProperties } from "react";
import { TaskRow } from "./TaskRow";
import { MonoLabel } from "./Primitives";
import { type Task, type BucketKey, toISODate } from "@/lib/data";
import { type ViewKey, sortTasksForView, viewEmptyMessage } from "@/lib/view";

/**
 * 비-오늘 뷰의 중앙 컨텐츠. VariantBSplitInner 가 view !== "today" 일 때 hour-timeline
 * 대신 렌더. 정렬 규칙은 view.ts 의 sortTasksForView 가 담당.
 *
 *  - upcoming: 일별 헤더로 그룹핑 (tomorrow, day3..day7 순서, 비어있는 날은 생략)
 *  - inbox / someday / done: 평면 리스트 (구분선 없음)
 *
 * emptyOverride: 빈 상태일 때 뷰별 메시지 대신 사용할 메시지. 검색 활성 시
 * VariantBSplitInner 가 "검색 결과가 없습니다" 등을 전달.
 */
export const TaskList = ({
  tasks,
  view,
  today,
  emptyOverride,
}: {
  tasks: Task[];
  view: ViewKey;
  today: Date;
  emptyOverride?: { primary: string; mono?: string };
}) => {
  const sorted = sortTasksForView(tasks, view);

  if (sorted.length === 0) {
    const empty = emptyOverride ?? viewEmptyMessage(view);
    return <EmptyState primary={empty.primary} mono={empty.mono} />;
  }

  if (view === "upcoming") {
    return <UpcomingGrouped tasks={sorted} today={today} />;
  }

  return (
    <div style={S.flat}>
      {sorted.map((t) => (
        <TaskRow key={t.id} task={t} style="editorial" showProject showTime />
      ))}
    </div>
  );
};

/* ─── UpcomingGrouped ───────────────────────────────────────
 * Q4 의 표 그대로: bucket 별로 그룹핑, 일자 순으로 정렬된 task 를 일별 헤더와 함께.
 * 비어있는 일자는 생략 — 카드 없는 헤더는 시각 노이즈.
 */
const UPCOMING_BUCKETS: BucketKey[] = ["tomorrow", "day3", "day4", "day5", "day6", "day7"];

const UpcomingGrouped = ({ tasks, today }: { tasks: Task[]; today: Date }) => {
  // bucket → Task[] 맵
  const byBucket = new Map<BucketKey, Task[]>();
  for (const t of tasks) {
    const arr = byBucket.get(t.bucket) ?? [];
    arr.push(t);
    byBucket.set(t.bucket, arr);
  }

  return (
    <div style={S.grouped}>
      {UPCOMING_BUCKETS.map((bk, i) => {
        const items = byBucket.get(bk);
        if (!items || items.length === 0) return null;
        return (
          <section key={bk} style={S.group}>
            <DaySeparator bucket={bk} today={today} dayOffset={i + 1} count={items.length} />
            <div style={S.flat}>
              {items.map((t) => (
                <TaskRow key={t.id} task={t} style="editorial" showProject showTime />
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
};

/* ─── DaySeparator ───────────────────────────────────────── */

const KO_DOW = ["일", "월", "화", "수", "목", "금", "토"];
const EN_DOW = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

const DaySeparator = ({
  bucket,
  today,
  dayOffset,
  count,
}: {
  bucket: BucketKey;
  today: Date;
  dayOffset: number; // 1=tomorrow ... 6=day7
  count: number;
}) => {
  const d = new Date(today);
  d.setDate(today.getDate() + dayOffset);

  const fraunces = bucket === "tomorrow" ? "Tomorrow" : EN_DOW[d.getDay()];
  const koLabel = bucket === "tomorrow" ? "내일" : `${KO_DOW[d.getDay()]}요일`;
  const dateStr = `${d.getMonth() + 1}월 ${d.getDate()}일`;
  const iso = toISODate(d);

  return (
    <header style={S.daySep} aria-label={`${koLabel} ${dateStr}`}>
      <span style={S.daySepFraunces}>{fraunces}</span>
      <span style={S.daySepKo}>{koLabel}</span>
      <span style={S.daySepDate}>{dateStr}</span>
      <span style={{ flex: 1, height: 1, background: "var(--border)", margin: "0 12px" }} aria-hidden="true" />
      <MonoLabel size={10} tracking={1.2}>{String(count).padStart(2, "0")} tasks</MonoLabel>
      <span style={S.daySepIso} aria-hidden="true">{iso}</span>
    </header>
  );
};

/* ─── EmptyState ───────────────────────────────────────────
 * VariantBSplit 의 TodayTimeline 도 검색 빈 결과 시 동일한 빈 상태를 쓰므로 export.
 */
export const EmptyState = ({ primary, mono }: { primary: string; mono?: string }) => (
  <div style={S.empty}>
    <div style={S.emptyPrimary}>{primary}</div>
    {mono && (
      <div style={{ marginTop: 8 }}>
        <MonoLabel size={10} tracking={1.6}>{mono}</MonoLabel>
      </div>
    )}
  </div>
);

/* ─── 스타일 ───────────────────────────────────────────── */

const S: Record<string, CSSProperties> = {
  flat: { display: "flex", flexDirection: "column" },
  grouped: { display: "flex", flexDirection: "column", gap: 28 },
  group: { display: "flex", flexDirection: "column" },
  daySep: {
    display: "flex", alignItems: "baseline", gap: 12,
    padding: "0 0 10px 0", marginBottom: 6,
  },
  daySepFraunces: {
    fontFamily: "var(--font-display)", fontStyle: "italic",
    fontVariationSettings: '"opsz" 96, "wght" 360',
    fontSize: 28, lineHeight: 1, color: "var(--text-display)",
    letterSpacing: -0.6,
  },
  daySepKo: { fontSize: 13, color: "var(--text-secondary)", fontWeight: 500, letterSpacing: -0.1 },
  daySepDate: { fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--text-faint)", letterSpacing: 0.4 },
  daySepIso: { fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--text-faint)", letterSpacing: 0.5, marginLeft: 8 },
  empty: {
    display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
    padding: "80px 32px 60px",
    textAlign: "center",
  },
  emptyPrimary: {
    fontFamily: "var(--font-display)", fontStyle: "italic",
    fontVariationSettings: '"opsz" 72, "wght" 320',
    fontSize: 22, color: "var(--text-faint)",
    letterSpacing: -0.3,
  },
};
