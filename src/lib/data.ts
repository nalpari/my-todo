/* ============================================================
 * 치트키 Todo — 공유 타입 + 유틸리티
 * DB 레코드 타입(Row*)과 UI 표시용 타입을 분리한다.
 * ============================================================ */

/* ─── DB Row 타입 (Supabase 스키마와 1:1 대응) ──────────────── */

export type ProjectRow = {
  id: string;
  user_id: string;
  name: string;
  color: string;
  created_at: string;
};

export type TagRow = {
  id: string;
  user_id: string;
  name: string;
  hue: "accent" | "muted";
  created_at: string;
};

export type TaskRow = {
  id: string;
  user_id: string;
  project_id: string | null;
  title: string;
  due_date: string | null;   // ISO date "YYYY-MM-DD"
  due_time: string | null;   // "HH:MM"
  done: boolean;
  subtotal: number;
  subdone: number;
  sort_order: number;
  created_at: string;
  updated_at: string;
};

/* ─── UI 표시용 타입 ─────────────────────────────────────────── */

/** 사이드바·분포 차트용 프로젝트 (task count 포함) */
export type Project = {
  id: string;
  name: string;
  color: string;
  count: number;
};

export type Tag = {
  id: string;
  name: string;
  hue: "accent" | "muted";
};

/**
 * 할 일 타임라인 버킷 키.
 * DB의 due_date(DATE)를 오늘 기준으로 분류할 때 사용한다.
 *
 * inbox: due_date 가 null — "언제 할지 정하지 않은" 일.
 * later: due_date 가 today + 7일 보다 미래 — "한참 뒤" 일.
 * 둘은 의미가 다르므로 분리 (이전 버전은 둘 다 "later" 로 묶여 사이드바
 * 인박스/언젠가 카운트가 중복되는 버그가 있었음).
 */
export type BucketKey =
  | "overdue"
  | "today"
  | "tomorrow"
  | "day3"
  | "day4"
  | "day5"
  | "day6"
  | "day7"
  | "later"
  | "inbox";

/** UI 컴포넌트에 넘기는 Task (DB Row + 파생 필드) */
export type Task = {
  id: string;           // DB uuid
  title: string;
  project: string | null;   // project_id
  tags: string[];            // tag id 배열
  due_date: string | null;  // ISO date
  due_time: string | null;  // "HH:MM"
  done: boolean;
  subtotal: number;
  subdone: number;
  /** due_date → 오늘 기준 버킷. 클라이언트에서 계산 */
  bucket: BucketKey;
  /** TaskList 의 인박스/완료 정렬에 사용 (ISO timestamp) */
  created_at: string;
  updated_at: string;
};

export type DayBucket = {
  key: BucketKey;
  label: string;   // "오늘", "내일", ...
  date: string;    // "5월 26일, 화" 등
  fraunces: string; // 영문 헤더
};

export type WeekDay = {
  dow: string;            // "월"~"일"
  dom: number;            // day-of-month
  date: string;           // ISO date "YYYY-MM-DD"
  today: boolean;
};

/* ─── 날짜 유틸리티 ─────────────────────────────────────────── */

/** "YYYY-MM-DD" 문자열 반환 (로컬 시각 기준) */
export function toISODate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** due_date(ISO)를 오늘 기준 BucketKey로 변환 */
export function dateToBucket(dueDate: string | null, today: Date): BucketKey {
  if (!dueDate) return "inbox";
  const due = new Date(dueDate + "T00:00:00"); // 로컬 자정
  const todayMidnight = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const diff = Math.floor((due.getTime() - todayMidnight.getTime()) / 86400000);
  if (diff < 0) return "overdue";
  if (diff === 0) return "today";
  if (diff === 1) return "tomorrow";
  if (diff === 2) return "day3";
  if (diff === 3) return "day4";
  if (diff === 4) return "day5";
  if (diff === 5) return "day6";
  if (diff === 6) return "day7";
  return "later";
}

/** 오늘 기준 이번 주(월~일) WeekDay 배열 생성 */
export function buildWeek(today: Date): WeekDay[] {
  const dow = today.getDay(); // 0=일,1=월,...
  const monday = new Date(today);
  monday.setDate(today.getDate() - ((dow + 6) % 7)); // 이번 주 월요일
  const labels = ["월", "화", "수", "목", "금", "토", "일"];
  return labels.map((label, i) => {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    return {
      dow: label,
      dom: d.getDate(),
      date: toISODate(d),
      today: d.toDateString() === today.toDateString(),
    };
  });
}

/** 이번 주 DayBucket 배열 생성 (overdue 포함) */
export function buildDayBuckets(today: Date): DayBucket[] {
  const week = buildWeek(today);
  const KO_DOW = ["일", "월", "화", "수", "목", "금", "토"];
  const EN_DAY = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

  const buckets: DayBucket[] = [
    { key: "overdue", label: "지난 일정", date: "— 누락", fraunces: "Overdue" },
  ];

  week.forEach((w, i) => {
    const d = new Date(w.date + "T00:00:00");
    const diff = i; // 0=월,...,6=일
    const bucketKeys: BucketKey[] = ["today", "tomorrow", "day3", "day4", "day5", "day6", "day7"];
    const fraunces = [EN_DAY[d.getDay()]];
    buckets.push({
      key: w.today ? "today" : bucketKeys[diff] ?? "later",
      label: w.today
        ? "오늘"
        : diff === 1
        ? "내일"
        : `${KO_DOW[d.getDay()]}요일`,
      date: `${d.getMonth() + 1}월 ${d.getDate()}일`,
      fraunces: fraunces[0] ?? "",
    });
  });

  return buckets;
}

/* ─── TaskRow → Task 변환 ──────────────────────────────────── */

export function rowToTask(row: TaskRow, tagIds: string[], today: Date): Task {
  return {
    id: row.id,
    title: row.title,
    project: row.project_id,
    tags: tagIds,
    due_date: row.due_date,
    due_time: row.due_time,
    done: row.done,
    subtotal: row.subtotal,
    subdone: row.subdone,
    bucket: dateToBucket(row.due_date, today),
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

/* ─── 헬퍼 함수 ─────────────────────────────────────────────── */

export const projectById = (projects: Project[], id: string | null) =>
  projects.find((p) => p.id === id);

export const tagById = (tags: Tag[], id: string) =>
  tags.find((t) => t.id === id);

export const tasksByBucket = (tasks: Task[], key: BucketKey) =>
  tasks.filter((t) => t.bucket === key);
