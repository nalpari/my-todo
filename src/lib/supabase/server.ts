import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

// 모든 Supabase 세션 쿠키에 강제 적용. supabase/ssr 기본값(httpOnly:false) 을 덮어쓴다.
const HARDENED_COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  path: "/",
};

/**
 * Server Component 가드(읽기) 전용.
 * RSC 컨텍스트에서는 cookies().set 이 throw 하므로 swallow. 세션 갱신은 proxy 가 담당.
 * mutating 경로(/auth/callback, signIn/Out)에는 createMutableClient 를 사용할 것.
 */
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, { ...options, ...HARDENED_COOKIE_OPTIONS }),
            );
          } catch {
            // RSC 컨텍스트 — set 불가. proxy 가 세션 갱신을 담당.
          }
        },
      },
    },
  );
}

/**
 * Route Handler / Server Action 용 mutating 클라이언트.
 * 쿠키 set 이 본질이므로 실패는 swallow 하지 않고 throw — 호출처가 명시적 실패 redirect 로 처리.
 */
export async function createMutableClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, { ...options, ...HARDENED_COOKIE_OPTIONS }),
          );
        },
      },
    },
  );
}
