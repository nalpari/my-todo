# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

Package manager is **pnpm** (lockfile: `pnpm-lock.yaml`, `.npmrc` sets `shamefully-hoist=true`). Do not run `npm install` — it will produce a competing `package-lock.json`.

- `pnpm dev` — Next.js dev server on http://localhost:3000 (Turbopack)
- `pnpm build` — production build
- `pnpm start` — serve the production build
- `pnpm lint` — ESLint (flat config in `eslint.config.mjs`, extends `eslint-config-next` core-web-vitals + typescript)

There is no test runner configured. Don't invent one when asked to "run the tests" — say so and ask.

## Bleeding-edge stack — verify before assuming

- **Next.js 16.2.6**, **React 19.2.4**, **Tailwind 4**, **TypeScript 5**
- `babel-plugin-react-compiler` is enabled via `next.config.ts` (`reactCompiler: true`). Avoid manual `useMemo`/`useCallback` unless profiling shows a need — the compiler handles memoization.
- Tailwind 4 has **no `tailwind.config.js`** — config lives in `globals.css` via `@import "tailwindcss"`.
- When the API surface of any of these is unclear, check `node_modules/next/dist/docs/` and the installed package's `README.md` rather than relying on v13/14 muscle memory.

## Two environment gotchas (both produce 500s with misleading stack traces)

1. **WSL after Windows-side install — `lightningcss` native binary missing.**
   Symptom: dev server 500 with `Cannot find module '../lightningcss.linux-x64-gnu.node'`. Cause: `node_modules` was populated on Windows so only `lightningcss-win32-x64-msvc` is present. Fix without polluting the lockfile:

   ```
   pnpm add -D --ignore-scripts lightningcss-linux-x64-gnu
   ```

   (or `npm install --no-save --no-package-lock lightningcss-linux-x64-gnu`)

2. **Don't add `@import url(...)` to `globals.css`.**
   Tailwind 4's `@import "tailwindcss"` is a build-time _inlining_ directive, not a real CSS import. Any sibling `@import url(...)` ends up after the inlined rules in the resolved output, violating the CSS spec ("@import rules must precede all rules…"). Symptom: 500 with a PostCSS line number far past the end of your source file. Load third-party CSS via `<link rel="stylesheet">` in `src/app/layout.tsx` (this is how Pretendard is loaded today). Google Fonts go through `next/font/google`.

## Architecture

App Router RSC + Client 혼합 앱:

```
page.tsx (RSC 인증가드) → getAppData() → VariantBSplit (Client, AppProvider)
login/page.tsx (RSC 인증가드) → AuthScreen
```

실제 Supabase DB와 연동. `src/lib/data.ts` 의 mock 데이터는 삭제되고 DB Row 타입/유틸 함수만 남음. "오늘" 날짜는 `useLiveClock()` 훅으로 실시간 갱신됨.

### Component layers (in `src/components/`)

- `Primitives.tsx` — atoms: `Checkbox`, `Switch`, `ProjectDot`, `TagChip`, `MonoLabel`, `KeyHint`, `GoogleIcon`, `DayHeader`
- `AppShell.tsx` — `AppSidebar` (user/nav/projects/tags), `AppTopBar` (title + search + filter), `InputBar` (the "+ 할 일 추가" composer — 인라인 `ProjectPicker` · `InputTagPicker` 임베드)
- `ProjectPicker.tsx` — InputBar prefix `+` 자리의 프로젝트 선택 팝오버. 선택 = URL `?project=` 토글 (사이드바 active · TopBar chip 과 linked). `SwatchPopover`/`NewProjectRow` 패턴 재사용
- `InputTagPicker.tsx` — InputBar 의 `#` 트리거 태그 팝오버 (add-only; 제거는 아래 tag display row 의 × 가 인풋 텍스트까지 strip)
- `TaskRow.tsx` — task rendering plus `MiniCalendar`, `SubtaskMeter`
- `AuthScreen.tsx` — 로그인 화면. `<form action={signInWithGoogle}>` + `GoogleSignInButton`
- `GoogleSignInButton.tsx` — `useFormStatus` 로 pending 처리하는 client 버튼 (AuthScreen 은 RSC). 더블클릭 PKCE race 방지
- `VariantBSplit.tsx` — the only "real" screen: sidebar + hour timeline + right rail (mini calendar / upcoming / progress)

The "Variant B" name is intentional: the design source defined three variants (A · Editorial Timeline, B · Split Calendar+Timeline, C · Week Spread). Only **B is built**. If the user asks for "the week spread" or "editorial timeline" view, they mean the unbuilt variants, not a refactor of B.

### Styling convention — **do not Tailwind-ify**

Components use **inline `style={{ ... }}` objects bound to CSS variables** declared in `src/app/globals.css` (e.g. `background: "var(--bg-sidebar)"`, `color: "var(--accent)"`). Tailwind is installed only because it ships with `create-next-app`; do **not** convert these to `className="bg-zinc-900 ..."`. The inline-styles-plus-tokens pattern is deliberate — it preserves the design-token coupling from the source design handoff and lets the warm-dark palette swap cleanly.

Design tokens live at the top of `globals.css` under `:root` (surfaces, text scale, the single coral accent `#d97757`, borders, shadows, radii, spacing, font-family vars). Reach for an existing token before introducing a literal color/spacing value.

### Fonts (configured in `src/app/layout.tsx`)

- **Fraunces** via `next/font/google` with `axes: ["opsz"]` — the optical-size axis is **required** for the headings that use `font-variation-settings: '"opsz" 72/144, ...'`. Don't drop the `axes` option.
- **JetBrains Mono** via `next/font/google` (400/500/600) — for monospaced labels and metadata.
- **Pretendard** (Korean body) via `<link>` to jsdelivr — see gotcha #2 above for why it's not in CSS.

### UI language

User-facing strings are in **Korean** (the app name is "치트키 Todo"). Keep new copy in Korean unless the user says otherwise. `<html lang="ko">` in the layout.

## Path alias

`@/*` → `./src/*` (configured in `tsconfig.json`). Use `@/components/...` and `@/lib/...` rather than relative paths.

## Auth (Supabase)

Google OAuth 활성화 + 할 일 CRUD 구현 완료.

- **프로젝트**: `tprewdmslvayiihukefg` (region `ap-northeast-2`, Postgres 17)
- **환경변수** (`.env.example` 참고):
  - `NEXT_PUBLIC_SUPABASE_URL` — 프로젝트 URL
  - `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` — publishable key (`sb_publishable_…`). legacy anon JWT 는 쓰지 않음.
  - `NEXT_PUBLIC_SITE_URL` — OAuth `redirectTo` 베이스 (예: `http://localhost:3000`)
- **인증 흐름**: `/` (RSC 가드) → 미인증 시 `/login` → `signInWithGoogle` Server Action → Google → `/auth/callback` 에서 `exchangeCodeForSession` → `/` 복귀. 실패 시 `/login?error=…` 로 돌아오고 AuthScreen 카드 위에 한 줄 표시.
- **핵심 파일**:
  - `src/lib/supabase/{client,server,proxy}.ts` — `@supabase/ssr` 의 세 가지 클라이언트
    - `server.ts` 는 의도가 다른 두 팩토리를 export 한다: **`createClient`** (RSC 가드 — `setAll` 실패를 swallow, 세션 갱신은 proxy 가 담당) vs **`createMutableClient`** (Route Handler / Server Action — 쿠키 set 이 본질이므로 실패는 throw → 호출처가 `cookie_write_failed` 로 명시적 redirect). RSC 가드(`page.tsx`, `login/page.tsx`) 외에는 반드시 mutable 사용.
    - `proxy.ts` 와 `server.ts` 모두 outbound 쿠키에 강제 옵션을 머지한다: `httpOnly: true`, `secure: NODE_ENV === "production"`, `sameSite: "lax"`, `path: "/"`. supabase/ssr 의 기본값 `httpOnly: false` 를 의도적으로 덮어쓰는 거라 새 supabase 클라이언트를 추가할 때도 동일 패턴 유지.
  - `src/proxy.ts` — Next.js 16 의 proxy convention (구 middleware). 모든 요청에서 세션 쿠키 갱신, 정적 자산 제외 표준 matcher
  - `src/app/{page,login/page}.tsx` — RSC 가드. 인증 상태에 따라 양방향 redirect.
  - `src/app/auth/actions.ts` — `signInWithGoogle`, `signOut` Server Actions.
  - `src/app/auth/callback/route.ts` — OAuth code 교환. 쿠키 write 실패 시 `/login?error=cookie_write_failed` 로 redirect.
- **로그인/로그아웃 트리거**: 모두 `<form action={…}>` + Server Action. PKCE verifier 와 세션 쿠키 모두 `httpOnly` 라 JS 에서 읽을 수 없음 — XSS 가 나도 토큰 탈취는 막힘.

## DB 스키마 (CRUD 구현)

DB 마이그레이션 SQL: `supabase/migrations/` (현재 `001_initial_schema.sql`, `002_rls_with_check.sql`, `003_tenant_isolation.sql`, `004_projects_uniqueness.sql`, `005_tags_uniqueness.sql`, `006_subtasks.sql`, `007_features.sql`). 원격 적용은 Supabase MCP `apply_migration` 또는 Dashboard SQL Editor 사용. 002 는 001 의 UPDATE 정책에 `WITH CHECK` 를 추가해 소유권 이전 (`user_id` 변경) 공격을 막고, 003 은 외래키 차원의 cross-tenant 참조를 차단한다 (`tasks(project_id, user_id) → projects(id, user_id)` 복합 FK, `task_tags` 에 `user_id` 추가 후 task·tag 양쪽에 복합 FK, `due_time` HH:MM CHECK 제약). 004/005 는 각각 `projects`/`tags` 에 `(user_id, name) UNIQUE` 제약 — 같은 사용자 내 동명 항목 차단, 위반 시 `23505` → 서버 액션이 "이미 사용 중인 이름입니다" 로 변환. 006 은 `subtasks` 테이블 (복합 FK + RLS) + `recalc_task_subtask_counts` 트리거를 추가해 `tasks.subtotal/subdone` 의 자동 정합성을 DB 레벨에서 보장. 007 은 `features` 테이블 (project 의 하위 분류) + `tasks.feature_id` 컬럼을 추가하는데, 003 의 격리 패턴을 그대로 따른다 — `features` 가 `user_id` 직접 보유, `(project_id, user_id) → projects(id, user_id)` 와 `tasks(feature_id, user_id) → features(id, user_id)` 양쪽 복합 FK, UPDATE 정책에 `WITH CHECK` 강제, `(project_id, name) UNIQUE` 로 같은 프로젝트 내 동명 기능 차단.

### 테이블 구조

| 테이블 | 설명 |
|--------|------|
| `public.projects` | 프로젝트 (user_id FK, name, color) |
| `public.features` | 프로젝트 하위 기능 (user_id FK, project_id FK 복합, name). `(project_id, name) UNIQUE` |
| `public.tags` | 태그 (user_id FK, name, hue: "accent"\|"muted") |
| `public.tasks` | 할 일 (user_id FK, project_id FK, feature_id FK 복합, title, due_date DATE, due_time TEXT, done, subtotal, subdone, sort_order). subtotal/subdone 은 트리거가 자동 유지 |
| `public.task_tags` | N:M 조인 (task_id, tag_id) |
| `public.subtasks` | 서브태스크 (task_id FK 복합, user_id FK, title, done, sort_order). ON DELETE CASCADE 로 부모 task 삭제 시 함께 제거 |

모든 테이블에 RLS 활성화. `auth.uid() = user_id` 기반으로 사용자별 격리.

### 데이터 레이어 파일

| 파일 | 역할 |
|------|------|
| `src/lib/data.ts` | 타입 정의 (ProjectRow, TagRow, FeatureRow, TaskRow, SubtaskRow, Project, Tag, **Feature** (id·projectId·name), Task (featureId 포함), Subtask, **BucketKey** — `inbox` (due_date null) 와 `later` (today+7 너머) 분리). 날짜 유틸 (toISODate, dateToBucket, buildWeek, buildDayBuckets, rowToTask). `parseTaskInput` (pure 파서) — `[project]` · `[project:feature]` · prefix 없음 · `#tag` 0개 이상 모두 허용. ParsedTaskInput.project/feature 가 nullable |
| `src/lib/queries.ts` | RSC 서버에서 DB fetch (getProjects, getTags, getFeatures, getTasks, getSubtasks, getAppData). AppData 에 features 포함 |
| `src/lib/palette.ts` | 프로젝트 색 팔레트 (`PROJECT_COLORS` 8색, `DEFAULT_PROJECT_COLOR`, `isProjectColor` 런타임 가드) — Server Action 검증과 사이드바 swatch picker 가 공유 |
| `src/lib/view.ts` | 사이드바 view 라우팅 + 프로젝트·태그 필터 + 검색의 URL 직렬화·필터·정렬·라벨 헬퍼. `ViewKey`, `parseView`/`parseProjectId`/`parseTagId`, `toggleViewHref`/`toggleProjectHref`/`toggleTagHref` (동일 항목 재클릭 시 키 제거), `filterTasks(tasks, view, projectId, tagId)` (모두 AND), `filterBySearch` (title + project name case-insensitive substring), `sortTasksForView`, `viewTitle`/`viewSubtitleContext`/`viewEmptyMessage` |
| `src/lib/AppContext.tsx` | Client 컨텍스트. `useOptimistic` reducer 가 task·project·tag·feature·subtask 변이를 통합 관리. cascade 미러: `project.delete` → 소속 task.projectId=null + 소속 features 제거 + 해당 feature 참조 task.featureId=null / `tag.delete` → 모든 task.tags 에서 제거 / `task.delete` → 소속 subtasks 제거 / `subtask.create|toggle|delete` → 부모 task 의 subtotal/subdone 동기 갱신 (DB 트리거 결과 미러). features 자체에 대한 client 변이 액션은 없음 — createTask 의 ensureFeature 결과는 revalidate 가 반영 |
| `src/app/tasks/actions.ts` | Server Actions (createTask, toggleTask, updateTask, deleteTask) + `revalidatePath("/")`. `createTask` 는 단일 `input` 필드를 `parseTaskInput` 으로 분해 후 `parseProjectName`/`parseFeatureName`/`parseTagName` 으로 검증, `ensureProject` / `ensureFeature` / `ensureTags` 로 누락된 부속 row 를 user 스코프에서 upsert 후 task insert. ensure* 는 INSERT 23505 race 시 다시 SELECT 로 idempotent. 입력에 `[project]` 가 없으면 `formData.get("project_id")` (InputBar 의 activeProjectId fallback) 사용 |
| `src/app/projects/actions.ts` | Server Actions (createProject, updateProject, deleteProject). 동일 컨벤션 + `parseName` (trim·연속공백→1개·1-50자) + `parseColor` (`isProjectColor` enum 가드) + 23505 캐치 |
| `src/app/tags/actions.ts` | Server Actions (createTag, deleteTag, assignTag, unassignTag). `parseName` (1-30자, project 보다 짧음) + `parseHue` (accent\|muted enum). assignTag 는 (task_id, tag_id) UNIQUE 위반 시 멱등 처리 (이미 할당된 상태로 간주, 성공 반환) |
| `src/app/subtasks/actions.ts` | Server Actions (createSubtask, updateSubtask, deleteSubtask). 동일 컨벤션 + `parseTitle` (1-200자). updateSubtask 는 fields 화이트리스트 (title / done 만). subtotal/subdone 의 정합성은 DB 트리거가 담당 — action 코드는 subtasks 만 다룸 |
| `src/components/ProjectList.tsx` | 사이드바 프로젝트 섹션 UI. ProjectRow 는 **이름 클릭 = 필터 토글** (URL `project` 키), 호버 ✎ = 인라인 편집 (blur=save, Esc=cancel), 색 dot = swatch popover, 호버 × = 2단계 삭제 (`정말? · N개 해제`). 활성 시 row 좌측 코랄 인디케이터 + bg 강조. NewProjectRow 는 `+` 버튼으로 펼침, 색 dot/swatch mousedown `preventDefault` 로 input focus 유지 |
| `src/components/TagList.tsx` | 사이드바 태그 섹션 UI. SidebarTagChip 은 **클릭 = 필터 토글** (URL `tag` 키), 호버 chip → 우상단 × overlay → 2단계 확인 ("정말?" 텍스트 교체) → 삭제. NewTagRow 는 `+` 로 펼침, hue 라디오 (accent/muted) + 이름 input. rename/hue 변경 UI 없음 — 삭제 + 재생성으로 갈음 |
| `src/components/TaskList.tsx` | 비-오늘 뷰의 중앙 컨텐츠. `upcoming` 은 일별 헤더로 그룹핑 (비어있는 날 생략), `inbox`/`someday`/`done` 은 평면 리스트. 정렬은 `sortTasksForView`. 빈 상태 메시지 뷰별, `emptyOverride` prop 으로 검색 등 외부 컨텍스트 메시지 주입 가능. 재사용 가능한 `<EmptyState />` export (TodayTimeline 도 사용) |
| `src/components/TaskTagsEditor.tsx` | Task 의 태그 chips + 편집 컨트롤 공유 컴포넌트 (TaskRow editorial/card, TimelineCard 가 사용). `active=true` → 각 chip × overlay (unassign) + 마지막에 "+" 버튼. "+" 클릭 → 사용자의 모든 태그 popover, 클릭으로 toggle. chip × 가시성과 picker 가시성은 분리 (picker 열린 채 hover 떠도 picker 유지) |
| `src/components/SubtaskList.tsx` | Task 의 펼침 영역 — 작은 checkbox + 제목 인라인 편집 + 호버 ×. NewSubtaskInput 은 항상 맨 아래 + 입력, Enter 후 포커스 유지 (연속 추가 편의), Esc clear. 2단계 확인 없음 — subtask 는 throwaway. TaskRow editorial/card 와 TimelineCard 가 공유 |

### CRUD 흐름

1. **읽기**: `page.tsx`(RSC) → `getAppData()` → `AppProvider` props → `useApp()` 로 소비
2. **추가**: `InputBar` form submit → `createTask` Server Action → `revalidatePath`
3. **완료 토글**: `Checkbox` click → `useOptimistic` 즉시 반영 → `toggleTask` Server Action
4. **수정**: 제목 클릭 → 인라인 input → blur/Enter → `updateTaskTitle` → Server Action
5. **삭제**: 카드 호버 → × 버튼 → `useOptimistic` 즉시 제거 → `deleteTask` Server Action

### 에러 처리 컨벤션 (tasks Server Action)

- 모든 task / project Server Action 은 실패 시 **throw** 한다 (silent return 금지). DB 에러는 `throw new Error(...)`, 세션 만료는 `redirect("/login?error=session_expired")` (NEXT_REDIRECT 라 try/catch 로 감싸면 안 됨 — `requireUser()` 헬퍼에 일임).
- 클라이언트는 `AppContext` 의 `runAction` 헬퍼가 try/catch 로 잡아 (1) 에러 메시지를 `error` 상태에 기록, (2) `router.refresh()` 로 서버 상태를 다시 받아 낙관 잔존을 정정한다.
- `VariantBSplit` 의 `<ErrorToast />` 는 `useApp().error` 를 구독해 하단 토스트로 표시 (4초 자동 닫힘 + 수동 ×). `InputBar` 도 createTask 실패 시 `reportError` + 입력값 복구.

### 입력 검증 컨벤션 (tasks Server Action)

- Server Action 은 사실상 public RPC. TS 타입은 런타임 강제력이 없으므로 client 가 임의 키 (`user_id`, `sort_order` 등) 를 보낼 수 있다. `actions.ts` 의 `parseTitle`/`parseNullableDate`/`parseNullableTime`/`parseNullableUuid` 헬퍼가 키 화이트리스트 + 포맷 검증을 담당. `updateTask` 는 `fields: unknown` 으로 받고 명시된 4개 키만 update 객체에 옮긴다. `createTask` 는 추가로 `parseProjectName` (50자) / `parseFeatureName` (50자) / `parseTagName` (30자) 로 parseTaskInput 결과를 normalize (trim + 연속 공백 1개) + 길이 검증 — projects/tags actions 의 `parseName` 과 동일 규칙.
- 다른 user 소유 row 를 참조할 수 있는 모든 mutate (tasks 의 project_id, subtasks/task_tags 의 task_id) 는 `assertOwnedProject` / `assertOwnedTask` 로 사전 소유권 확인 후 진행. 003 의 복합 FK 가 cross-tenant 참조를 어차피 거부하지만, FK 위반 raw 메시지 대신 명확한 한국어 에러를 노출하기 위함. FK 위반 (23503) 은 `translateDbError` 가 "참조 대상을 찾을 수 없습니다" 로 변환.
- `ensureProject` / `ensureFeature` / `ensureTags` 는 SELECT-then-INSERT 의 race window 를 23505 catch + re-SELECT 로 보완 — 동시 요청 두 개가 같은 이름을 만들어도 raw "duplicate key" 가 사용자에게 노출되지 않는다. task_tags insert 는 003 이 `user_id NOT NULL` 을 요구하므로 반드시 `user_id: user.id` 를 포함.

## 사이드바 view 라우팅 + 프로젝트·태그 필터

URL state: `/?view=today&project=<uuid>&tag=<uuid>`. `view` 기본값은 `today`, 없으면 default — URL 에 명시하지 않아 깨끗하게 유지. `project`/`tag` 없으면 해당 차원 필터 없음. 동일 항목 재클릭 = URL 키 제거 (default 복귀 / 필터 해제). 모든 nav·프로젝트·태그 클릭은 `router.replace` (히스토리 폭증 방지). project 와 tag 는 직교 — 동시에 활성 가능 (e.g. "프로젝트 X 의 #urgent task").

뷰 정의 (필터 + !done):
- **today**: `bucket in [today, overdue]` (overdue 도 오늘 시각으로 표시 — 카운트는 헤더에 별도)
- **upcoming**: `bucket in [tomorrow, day3..day7]`
- **inbox**: `bucket === "inbox"` (due_date null)
- **someday**: `bucket === "later"` (today+7 너머)
- **done**: `done === true` (date 무시, 직교)

레이아웃 분기: `view === "today"` → 기존 hour-timeline (분리된 `<TodayTimeline />` 서브컴포넌트), 그 외 → `<TaskList />`. 우측 rail (미니 캘린더 / 다가오는 일정 / 진행률 / 분포) 은 뷰·필터와 독립된 peripheral view 라 전역 `allTasks` 사용 — 의도된 컨텍스트 일관성.

사이드바 nav 카운트는 **모든 필터 (프로젝트·태그) 를 무시한 전역 카운트** — 다른 뷰의 전체 task 가 몇 개인지 보여야 의미. "지금 보고 있는 뷰 + 필터 결과 수" 는 TopBar subtitle 이 담당 (`{context} · N tasks`). 활성 필터의 식별은 TopBar 의 인라인 chips (project / tag) 와 search input 자체가 노출 — chip × 한 번으로 해당 차원만 해제.

## InputBar 의 입력 형식 + 컨텍스트 추론

`<InputBar />` 는 단일 `input` 필드를 받아 `parseTaskInput` (in `src/lib/data.ts`) 으로 분해한다. 모든 토큰이 **옵셔널** — `할 일` 만 입력하거나 `[프로젝트] 할 일`, `[프로젝트:기능] #태그 할 일` 등 어떤 조합이든 허용. 빈 본문만 거부한다. `#태그` 는 어디서나 0개 이상.

뷰 컨텍스트 기반 `due_date` prefill:
- view=today/done → due_date = 오늘
- view=upcoming → 내일
- view=inbox → null
- view=someday → 오늘 + 8일

input 우측의 due 칩 라벨도 뷰별로 변경 (`오늘` / `내일` / `미할당` / `나중에`).

프로젝트는 (1) 입력의 `[project]` 토큰이 우선, (2) 없으면 InputBar 의 `defaultProjectId` prop (VariantBSplit 이 `activeProjectId` 를 전달) 이 fallback, (3) 둘 다 없으면 미할당. fallback projectId 는 `assertOwnedProject` 로 사전 검증 — 다른 사용자 row 참조 차단. feature 는 입력 토큰에서만 추출 (fallback 개념 없음) 되며 project 와 짝일 때만 ensure. 누락된 프로젝트·기능·태그는 user 스코프에서 idempotent upsert 로 자동 생성된다.

## 서브태스크 (Subtasks)

`subtasks` 테이블은 별도. tasks 테이블의 `subtotal`/`subdone` 컬럼은 그대로 두되 `recalc_task_subtask_counts` 트리거 (006) 가 subtasks 의 INSERT/UPDATE/DELETE 시 자동 재계산 — DB 가 정합성 보증. 따라서 server action 은 subtasks 만 다룬다.

UI 는 **expand-in-place**: TaskRow editorial/card 와 TimelineCard 의 `SubtaskMeter` 가 클릭 가능한 chevron 토글로 작동. 펼쳐지면 본문 아래에 `<SubtaskList />` 렌더. 0 subtasks 인 task 는 호버 시 `+ 서브태스크` affordance 가 메타데이터 줄에 등장 — 클릭하면 expand. expand state 는 컴포넌트 local (URL X, 뷰 전환 시 리셋).

낙관 reducer 의 subtask 케이스는 부모 task 의 subtotal/subdone 도 함께 갱신 — DB 트리거 결과의 미러. revalidate 가 동일 값을 다시 가져오므로 reconcile 충돌 없음.

## 검색 (TopBar)

TopBar 의 검색 input 은 controlled 입력. state 와 `⌘K`/`Ctrl+K` 전역 단축키는 `VariantBSplitInner` 가 소유. AppTopBar 는 `searchQuery`/`onSearchChange`/`searchInputRef` props 만 받는 순수 view.

- **범위**: task title + project name (case-insensitive substring). 태그·due_date 는 1차 제외.
- **결합**: 뷰·프로젝트 필터에 AND. 검색은 client-only state — URL 에 넣지 않음 (뷰 전환·새로고침 시 리셋).
- **키보드**: `⌘K`/`Ctrl+K` → input focus + select. Esc → 검색어 비우고 blur (input 의 onKeyDown 이 처리).
- **빈 상태**: 검색 활성 + 0 결과면 뷰별 메시지 대신 "검색 결과가 없습니다" + 검색어 mono 라벨. today 뷰에서도 hour grid 대신 EmptyState 분기.
- **활성 표식**: 노출된 input 자체가 표식이라 subtitle 에 중복 prefix 는 두지 않는다 (TopBar subtitle 은 항상 `{context} · N tasks`). project / tag 필터의 인라인 chips 와 같은 layer 에서 컨텍스트를 노출.

## Not in scope (don't add unprompted)

- Variants A and C — deferred.
- A test framework.
- 태그 rename / hue 변경 UI (현재 삭제 + 재생성으로 갈음)
- multi-tag 필터 (현재 단일 선택)
- 검색의 cross-view discovery 힌트 (현재 뷰 빈 결과시 "다른 뷰에서 N개 발견" 링크)
- 검색어 매칭 부분 강조 (1차에선 단순 필터만)

If a task seems to require any of these, confirm with the user before adding the dependency.

## Always Do

- 모든 답변과 추론과정은 한국어로 작성한다.
- 가급적 react 19.2, nextjs 16 버전의 최신 문법을 사용한다.
- 코드 파일(.ts/.tsx/.js/.jsx/.mjs/.cjs)을 수정한 턴이 끝나면 Stop 훅이 자동으로 pnpm lint + npx tsc --noEmit 을 실행한다 (`.claude/hooks/check-lint-tsc.mjs`, Node 기반 — Windows PowerShell · Git Bash · WSL 모두에서 동일하게 동작). 실패 시 stderr 가 Claude 에게 피드백되어 자동 수정 루프에 들어간다.
- 린트체크시 오류가 있으면 반드시 해결하고 넘어가도록 하고, 경고가 있더라도 해결하려고 노력한다.
- 빌드 검증(pnpm build)은 자동 훅에 포함되지 않는다 — 큰 변경 후 또는 사용자가 명시적으로 요청할 때만 수동 실행한다.
- 커밋시에 접두사는 영어로 나머지 타이틀과 내용은 한국어로 작성한다.
- task 완료시 CLAUDE.md, AGENTS.md 및 README.md 문서에 업데이트가 필요하면 진행한다.
- 작업시 한 문장으로 설명되는 의미있는 단위로 commit 한다.

<!-- codegraph:start -->
# CodeGraph — Code Intelligence

This project is indexed by CodeGraph (로컬 SQLite 인덱스, `.codegraph/`). CodeGraph MCP 도구로 심볼·호출그래프·변경 영향을 파악한다. `.mcp.json` 에 `codegraph serve --mcp` stdio 서버 등록됨.

> 인덱스가 오래됐다고 경고하면 터미널에서 `codegraph sync` (증분) 또는 `codegraph index` (전체) 를 먼저 실행한다.

## Always Do

- **심볼 편집 전 반드시 영향 분석.** function/class/method 를 수정하기 전 `codegraph_impact` 로 blast radius (소비처·영향 파일) 를 확인하고 사용자에게 보고한다.
- 넓은 변경이 영향 파일이 많게 나오면 **진행 전 사용자에게 경고**한다.
- 낯선 코드를 탐색할 때는 grep 대신 `codegraph_search` / `codegraph_explore` 로 심볼과 관계를 찾는다.
- 특정 심볼의 호출관계가 필요하면 `codegraph_callers` (호출하는 쪽) / `codegraph_callees` (호출당하는 쪽) / `codegraph_node` (심볼 컨텍스트) 를 쓴다.

## Never Do

- function/class/method 를 `codegraph_impact` 없이 편집하지 않는다.
- 영향 분석에서 광범위한 blast radius 가 나왔는데 경고 없이 진행하지 않는다.
- 심볼 rename 을 단순 find-and-replace 로 하지 않는다 — 먼저 `codegraph_callers`/`codegraph_impact` 로 참조 지점을 전부 확인한 뒤 수정한다.

## MCP 도구

| 도구 | 용도 |
|------|------|
| `codegraph_status` | 인덱스 상태·통계, freshness 확인 |
| `codegraph_search` | 심볼 검색 (정의 위치·시그니처) |
| `codegraph_explore` | 코드 구조·관계 탐색 |
| `codegraph_node` | 특정 심볼의 전체 컨텍스트 |
| `codegraph_callers` | 해당 심볼을 호출하는 쪽 |
| `codegraph_callees` | 해당 심볼이 호출하는 쪽 |
| `codegraph_impact` | 심볼 변경의 영향 범위 (blast radius) |
| `codegraph_files` | 프로젝트 파일 구조 + 파일별 심볼 수 |

## CLI

| 작업 | 명령 |
|------|------|
| 인덱스 상태/통계 | `codegraph status` |
| 증분 동기화 / 전체 재인덱스 | `codegraph sync` / `codegraph index` |
| 심볼 검색 | `codegraph query <search>` |
| 호출 그래프 | `codegraph callers <symbol>` / `codegraph callees <symbol>` |
| 변경 영향 분석 | `codegraph impact <symbol>` |
| 변경된 소스에 영향받는 테스트 | `codegraph affected [files...]` |

<!-- codegraph:end -->
