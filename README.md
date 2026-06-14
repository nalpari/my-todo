# 치트키 Todo

Next.js 16 (App Router · RSC) + React 19 + Supabase 기반 할 일 앱. 사이드바 · 시간 타임라인 · 우측 rail(미니 캘린더 / 다가오는 일정 / 진행률)로 구성된 "Variant B · Split Calendar+Timeline" 화면 하나로 동작한다.

## 기술 스택

- **Next.js 16.2.6** (App Router, Turbopack, React Compiler 활성) · **React 19.2.4**
- **Tailwind 4** (config 없음 — `globals.css` 의 `@import "tailwindcss"`) · **TypeScript 5**
- **Supabase** — Google OAuth 인증 + Postgres 17 (RLS 사용자별 격리)
- 폰트: Fraunces · JetBrains Mono (`next/font/google`), Pretendard (`<link>`)

## 시작하기

패키지 매니저는 **pnpm** 전용이다 (`npm install` 금지 — `package-lock.json` 이 생겨 lockfile 이 충돌한다).

```bash
pnpm install
pnpm dev      # 개발 서버 → http://localhost:3000
```

기타 명령:

```bash
pnpm build    # 프로덕션 빌드
pnpm start    # 빌드 결과 서빙
pnpm lint     # ESLint (flat config)
```

테스트 러너는 설정돼 있지 않다.

## 환경 변수

`.env.example` 참고. Supabase 프로젝트와 OAuth 리다이렉트에 필요하다.

```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=   # sb_publishable_… (legacy anon JWT 아님)
NEXT_PUBLIC_SITE_URL=http://localhost:3000
```

## 구조 개요

- `src/app/` — App Router. `page.tsx`(RSC 인증가드) → `getAppData()` → `VariantBSplit`. `login/`, `auth/`(OAuth 콜백·액션), `tasks|projects|tags|subtasks/actions.ts`(Server Actions).
- `src/components/` — UI 레이어 (`Primitives`, `AppShell`, `VariantBSplit`, `TaskRow`, 픽커류 등).
- `src/lib/` — 데이터 레이어 (`data.ts` 타입·파서, `queries.ts` DB fetch, `AppContext.tsx` 낙관 reducer, `view.ts` URL 라우팅·필터, `supabase/` 클라이언트).
- `supabase/migrations/` — DB 스키마 SQL.

아키텍처·DB 스키마·코드 컨벤션 등 상세는 [`CLAUDE.md`](./CLAUDE.md) 참고.

## 배포

[Vercel](https://vercel.com/new) 권장. Supabase 환경 변수와 Google OAuth `redirectTo` 베이스(`NEXT_PUBLIC_SITE_URL`)를 배포 환경에 맞게 설정한다.
