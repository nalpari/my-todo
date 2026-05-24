import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

// supabase/ssr 기본값(httpOnly:false) 을 덮어 outbound 쿠키를 하드닝한다.
const HARDENED_COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  path: "/",
};

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, {
              ...options,
              ...HARDENED_COOKIE_OPTIONS,
            }),
          );
        },
      },
    },
  );

  // 세션 토큰 갱신을 위해 반드시 호출. createServerClient 와 이 호출 사이에 다른 코드를 넣지 말 것.
  await supabase.auth.getUser();

  return supabaseResponse;
}
