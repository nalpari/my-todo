/* Shared sample data for the 치트키 Todo app */

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

export type BucketKey =
  | "overdue" | "today" | "tomorrow" | "thu" | "fri" | "next-mon" | "next-tue";

export type Task = {
  id: number;
  title: string;
  project: string;
  tags: string[];
  due: BucketKey;
  time: string | null;
  done: boolean;
  subtotal: number;
  subdone: number;
};

export type DayBucket = {
  key: BucketKey;
  label: string;
  date: string;
  fraunces: string;
};

export type WeekDay = {
  dow: string;
  dom: number;
  bucket: BucketKey | null;
  today: boolean;
};

export const PROJECTS: Project[] = [
  { id: "p1", name: "AI 치트키 채널", color: "#d97757", count: 8 },
  { id: "p2", name: "뉴스레터 발행",   color: "#9c8a6a", count: 4 },
  { id: "p3", name: "사이드 프로젝트", color: "#7a8a9c", count: 6 },
  { id: "p4", name: "개인",             color: "#6b6964", count: 3 },
];

export const TAGS: Tag[] = [
  { id: "t1", name: "긴급",   hue: "accent" },
  { id: "t2", name: "리서치", hue: "muted"  },
  { id: "t3", name: "디자인", hue: "muted"  },
  { id: "t4", name: "촬영",   hue: "muted"  },
  { id: "t5", name: "미팅",   hue: "muted"  },
];

/* Today = 화요일 5월 26일 */
export const TASKS: Task[] = [
  { id: 1,  title: "Claude Code 매뉴얼 1차 원고 마감",
    project: "p1", tags: ["t1"], due: "overdue", time: null,
    done: false, subtotal: 3, subdone: 2 },
  { id: 2,  title: "5월 4주차 뉴스레터 발송",
    project: "p2", tags: [], due: "today", time: "14:00",
    done: false, subtotal: 4, subdone: 1 },
  { id: 3,  title: "썸네일 시안 3개 검토",
    project: "p1", tags: ["t3"], due: "today", time: "16:30",
    done: false, subtotal: 0, subdone: 0 },
  { id: 4,  title: "아침 운동 30분",
    project: "p4", tags: [], due: "today", time: "07:00",
    done: true,  subtotal: 0, subdone: 0 },
  { id: 5,  title: "구독자 1만명 기념 영상 기획",
    project: "p1", tags: ["t2"], due: "today", time: null,
    done: false, subtotal: 5, subdone: 0 },

  { id: 6,  title: "MCP 서버 데모 촬영",
    project: "p1", tags: ["t4"], due: "tomorrow", time: "10:00",
    done: false, subtotal: 0, subdone: 0 },
  { id: 7,  title: "Notion 자동화 워크플로우 정리",
    project: "p3", tags: ["t2"], due: "tomorrow", time: null,
    done: false, subtotal: 3, subdone: 0 },
  { id: 8,  title: "커피챗 — 이서연 PM",
    project: "p4", tags: ["t5"], due: "tomorrow", time: "15:00",
    done: false, subtotal: 0, subdone: 0 },

  { id: 9,  title: "Supabase RLS 정책 리팩토링",
    project: "p3", tags: [], due: "thu", time: null,
    done: false, subtotal: 2, subdone: 0 },
  { id: 10, title: "Fraunces vs Pretendard 비교 글 초안",
    project: "p2", tags: ["t3"], due: "thu", time: null,
    done: false, subtotal: 0, subdone: 0 },

  { id: 11, title: "주간 회고 — 영상 4편 결산",
    project: "p1", tags: [], due: "fri", time: "18:00",
    done: false, subtotal: 0, subdone: 0 },

  { id: 12, title: "6월 콘텐츠 캘린더 확정",
    project: "p1", tags: ["t5"], due: "next-mon", time: "11:00",
    done: false, subtotal: 4, subdone: 0 },
  { id: 13, title: "독자 인터뷰 일정 조율 (3명)",
    project: "p2", tags: ["t2", "t5"], due: "next-tue", time: null,
    done: false, subtotal: 3, subdone: 0 },
];

export const DAY_BUCKETS: DayBucket[] = [
  { key: "overdue",  label: "지난 일정",  date: "— 누락",        fraunces: "Overdue"   },
  { key: "today",    label: "오늘",       date: "5월 26일, 화",  fraunces: "Today"     },
  { key: "tomorrow", label: "내일",       date: "5월 27일, 수",  fraunces: "Tomorrow"  },
  { key: "thu",      label: "목요일",     date: "5월 28일",      fraunces: "Thursday"  },
  { key: "fri",      label: "금요일",     date: "5월 29일",      fraunces: "Friday"    },
  { key: "next-mon", label: "다음 주 월", date: "6월 1일",       fraunces: "Next Mon"  },
  { key: "next-tue", label: "다음 주 화", date: "6월 2일",       fraunces: "Next Tue"  },
];

export const WEEK: WeekDay[] = [
  { dow: "월", dom: 25, bucket: null,        today: false },
  { dow: "화", dom: 26, bucket: "today",     today: true  },
  { dow: "수", dom: 27, bucket: "tomorrow",  today: false },
  { dow: "목", dom: 28, bucket: "thu",       today: false },
  { dow: "금", dom: 29, bucket: "fri",       today: false },
  { dow: "토", dom: 30, bucket: null,        today: false },
  { dow: "일", dom: 31, bucket: null,        today: false },
];

export const projectById = (id: string) => PROJECTS.find((p) => p.id === id);
export const tagById     = (id: string) => TAGS.find((t) => t.id === id);
export const tasksByBucket = (key: BucketKey) => TASKS.filter((t) => t.due === key);
