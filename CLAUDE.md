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

- `Primitives.tsx` — atoms: `Checkbox`, `ProjectDot`, `TagChip`, `MonoLabel`, `KeyHint`, `DayHeader`
- `AppShell.tsx` — `AppSidebar` (user/nav/projects/tags), `AppTopBar` (title + search + filter), `InputBar` (the "+ 할 일 추가" composer)
- `TaskRow.tsx` — task rendering plus `MiniCalendar`, `SubtaskMeter`
- `AuthScreen.tsx` — visual-only login (the `onSignIn` callback is fired by any button)
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

DB 마이그레이션 SQL: `supabase/migrations/` (현재 `001_initial_schema.sql`, `002_rls_with_check.sql`, `003_tenant_isolation.sql`). 원격 적용은 Supabase MCP `apply_migration` 또는 Dashboard SQL Editor 사용. 002 는 001 의 UPDATE 정책에 `WITH CHECK` 를 추가해 소유권 이전 (`user_id` 변경) 공격을 막고, 003 은 외래키 차원의 cross-tenant 참조를 차단한다 (`tasks(project_id, user_id) → projects(id, user_id)` 복합 FK, `task_tags` 에 `user_id` 추가 후 task·tag 양쪽에 복합 FK, `due_time` HH:MM CHECK 제약).

### 테이블 구조

| 테이블 | 설명 |
|--------|------|
| `public.projects` | 프로젝트 (user_id FK, name, color) |
| `public.tags` | 태그 (user_id FK, name, hue: "accent"\|"muted") |
| `public.tasks` | 할 일 (user_id FK, project_id FK, title, due_date DATE, due_time TEXT, done, subtotal, subdone, sort_order) |
| `public.task_tags` | N:M 조인 (task_id, tag_id) |

모든 테이블에 RLS 활성화. `auth.uid() = user_id` 기반으로 사용자별 격리.

### 데이터 레이어 파일

| 파일 | 역할 |
|------|------|
| `src/lib/data.ts` | 타입 정의 (ProjectRow, TaskRow, Project, Tag, Task, BucketKey), 날짜 유틸 (toISODate, dateToBucket, buildWeek, buildDayBuckets, rowToTask) |
| `src/lib/queries.ts` | RSC 서버에서 DB fetch (getProjects, getTags, getTasks, getAppData) |
| `src/lib/AppContext.tsx` | Client 컨텍스트. `useOptimistic` 기반 낙관적 UI (toggleTask, deleteTask, updateTaskTitle). `AppProvider` + `useApp()` 훅 |
| `src/app/tasks/actions.ts` | Server Actions (createTask, toggleTask, updateTask, deleteTask) + `revalidatePath("/")` |

### CRUD 흐름

1. **읽기**: `page.tsx`(RSC) → `getAppData()` → `AppProvider` props → `useApp()` 로 소비
2. **추가**: `InputBar` form submit → `createTask` Server Action → `revalidatePath`
3. **완료 토글**: `Checkbox` click → `useOptimistic` 즉시 반영 → `toggleTask` Server Action
4. **수정**: 제목 클릭 → 인라인 input → blur/Enter → `updateTaskTitle` → Server Action
5. **삭제**: 카드 호버 → × 버튼 → `useOptimistic` 즉시 제거 → `deleteTask` Server Action

### 에러 처리 컨벤션 (tasks Server Action)

- 모든 task Server Action 은 실패 시 **throw** 한다 (silent return 금지). DB 에러는 `throw new Error(...)`, 세션 만료는 `redirect("/login?error=session_expired")` (NEXT_REDIRECT 라 try/catch 로 감싸면 안 됨 — `requireUser()` 헬퍼에 일임).
- 클라이언트는 `AppContext` 의 `runAction` 헬퍼가 try/catch 로 잡아 (1) 에러 메시지를 `error` 상태에 기록, (2) `router.refresh()` 로 서버 상태를 다시 받아 낙관 잔존을 정정한다.
- `VariantBSplit` 의 `<ErrorToast />` 는 `useApp().error` 를 구독해 하단 토스트로 표시 (4초 자동 닫힘 + 수동 ×). `InputBar` 도 createTask 실패 시 `reportError` + 입력값 복구.

### 입력 검증 컨벤션 (tasks Server Action)

- Server Action 은 사실상 public RPC. TS 타입은 런타임 강제력이 없으므로 client 가 임의 키 (`user_id`, `sort_order` 등) 를 보낼 수 있다. `actions.ts` 의 `parseTitle`/`parseNullableDate`/`parseNullableTime`/`parseNullableUuid` 헬퍼가 키 화이트리스트 + 포맷 검증을 담당. `updateTask` 는 `fields: unknown` 으로 받고 명시된 4개 키만 update 객체에 옮긴다.
- `project_id` 는 `assertOwnedProject` 로 사전 소유권 확인 후 update — 003 의 복합 FK 가 cross-tenant 참조를 어차피 거부하지만, 사용자에게 명확한 에러 메시지 제공.

## Not in scope (don't add unprompted)

- Variants A and C — deferred.
- A test framework.
- 태그 CRUD UI (현재 DB에서 조회만, 추가/삭제 UI 없음)
- 프로젝트 CRUD UI (현재 DB에서 조회만)
- 서브태스크 CRUD (subtotal/subdone 은 표시만)
- 검색/필터 기능 (UI만)

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
