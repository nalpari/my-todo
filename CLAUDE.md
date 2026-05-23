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

Single-page App Router app (`src/app/page.tsx`) that flips between two screens via local `useState`:

```
AuthScreen ──(onSignIn)──▶ VariantBSplit ──(onSignOut)──▶ AuthScreen
```

No auth backend, no database, no API routes. All data is mock data in `src/lib/data.ts` (`PROJECTS`, `TAGS`, `TASKS`, `DAY_BUCKETS`, `WEEK`). "Today" is **hardcoded as 화요일 5월 26일** to match the source design — treat dates in the UI as fixtures, not live values.

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

Google OAuth 만 활성화되어 있고, 데이터는 여전히 mock 입니다. Auth 만 붙고 CRUD 는 다음 phase 입니다.

- **프로젝트**: `tprewdmslvayiihukefg` (region `ap-northeast-2`, Postgres 17)
- **환경변수** (`.env.example` 참고):
  - `NEXT_PUBLIC_SUPABASE_URL` — 프로젝트 URL
  - `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` — publishable key (`sb_publishable_…`). legacy anon JWT 는 쓰지 않음.
  - `NEXT_PUBLIC_SITE_URL` — OAuth `redirectTo` 베이스 (예: `http://localhost:3000`)
- **인증 흐름**: `/` (RSC 가드) → 미인증 시 `/login` → `signInWithGoogle` Server Action → Google → `/auth/callback` 에서 `exchangeCodeForSession` → `/` 복귀. 실패 시 `/login?error=…` 로 돌아오고 AuthScreen 카드 위에 한 줄 표시.
- **핵심 파일**:
  - `src/lib/supabase/{client,server,middleware}.ts` — `@supabase/ssr` 의 세 가지 클라이언트
  - `src/middleware.ts` — 모든 요청에서 세션 쿠키 갱신 (정적 자산 제외 표준 matcher)
  - `src/app/{page,login/page}.tsx` — RSC 가드. 인증 상태에 따라 양방향 redirect.
  - `src/app/auth/actions.ts` — `signInWithGoogle`, `signOut` Server Actions
  - `src/app/auth/callback/route.ts` — OAuth code 교환
- **로그인/로그아웃 트리거**: 모두 `<form action={…}>` + Server Action. PKCE verifier 가 httpOnly cookie 에 저장되어 XSS 안전.
- **표시용 사용자 정보**: `page.tsx` 에서 Supabase `User` → `DisplayUser({name,email,avatarUrl?})` 로 추출 후 AppSidebar 로 prop drilling. `full_name` 이 없으면 `email.split("@")[0]` fallback. 아바타는 아직 첫 글자만 표시 (이미지 로드는 다음 PR).
- **남은 정리** (다음 PR 시작 시): 이번 작업과 무관한 이전 실험 흔적인 `public.todos` 테이블 (20행, 본 앱 스키마와 무관) 과 unused `auth.users` test 계정 정리.

## Not in scope (don't add unprompted)

- Persistent storage — mock data only. 데이터 모델 (Projects/Tags/Tasks) 의 DB 마이그레이션과 RLS 는 다음 phase.
- Variants A and C — deferred.
- A test framework.

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
