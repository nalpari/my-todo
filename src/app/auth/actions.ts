"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { createMutableClient } from "@/lib/supabase/server";

export async function signInWithGoogle() {
  // NEXT_PUBLIC_SITE_URL 우선, 누락 시 요청 origin fallback. 둘 다 없으면 에러.
  const origin =
    process.env.NEXT_PUBLIC_SITE_URL ?? (await headers()).get("origin");
  if (!origin) {
    redirect("/login?error=site_url_missing");
  }

  // try/catch 안에서 redirect() 를 호출하면 NEXT_REDIRECT throw 를 catch 가 삼킨다.
  // 그래서 target URL 만 결정하고 마지막에 redirect 한 번.
  let target = "/login?error=oauth_init_failed";
  try {
    const supabase = await createMutableClient();
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${origin}/auth/callback`,
      },
    });

    // signInWithOAuth 는 PKCE verifier 쿠키를 set 한다 — set 실패는 throw 되어 catch 로 빠진다.
    if (!error && data?.url) {
      target = data.url;
    }
  } catch (e) {
    console.error("[signInWithGoogle] cookie write failed", e);
    target = "/login?error=cookie_write_failed";
  }

  redirect(target);
}

export async function signOut() {
  // try/catch 안에서 redirect 호출 회피 (NEXT_REDIRECT 가 catch 에 잡히는 걸 방지).
  let target = "/login";
  try {
    const supabase = await createMutableClient();
    const { error } = await supabase.auth.signOut();
    if (error) {
      // 서버 revoke 실패 시에도 로컬 쿠키만큼은 정리해 /login → / 무한 redirect 를 끊는다.
      // refresh token 은 자연 만료까지 서버에 잔존 (가용성 vs revocation trade-off).
      await supabase.auth.signOut({ scope: "local" });
    }
  } catch (e) {
    console.error("[signOut] cookie write failed", e);
    target = "/login?error=cookie_write_failed";
  }

  redirect(target);
}
