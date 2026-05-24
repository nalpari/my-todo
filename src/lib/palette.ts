/**
 * 프로젝트 색 팔레트 — warm-dark 톤 8색.
 *
 * 사이드바 swatch picker 와 Server Action 의 색 검증 양쪽이 import.
 * DB 의 projects.color 는 text 라 자유 입력이지만, 앱 레이어에서 이 목록으로
 * 엄격히 제한해 design token (coral accent + neutral muteds) 의 시각적 일관성을 지킨다.
 *
 * 팔레트 확장은 이 상수만 수정하면 됨. DB CHECK 제약은 일부러 추가하지 않아
 * 미래의 팔레트 변경에 마이그레이션이 묶이지 않게 했다.
 */
export const PROJECT_COLORS = [
  "#d97757", // 코랄 (accent)
  "#c4945a", // 앰버
  "#a3895c", // 베이지
  "#8b9670", // 올리브
  "#6b8e8a", // 세이지
  "#7a8aa5", // 슬레이트
  "#9a7a8e", // 더스티 로즈
  "#6b6964", // 중성회 (DB default)
] as const;

export type ProjectColor = (typeof PROJECT_COLORS)[number];

/** projects.color 기본값 — DB default '#6b6964' 와 동기화 유지. */
export const DEFAULT_PROJECT_COLOR: ProjectColor = "#6b6964";

/** 런타임 enum 검증. Server Action 의 parseColor 에서 사용. */
export function isProjectColor(v: unknown): v is ProjectColor {
  return typeof v === "string" && (PROJECT_COLORS as readonly string[]).includes(v);
}
