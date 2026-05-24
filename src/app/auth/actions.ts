"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export async function signInWithGoogle() {
  const supabase = await createClient();

  // NEXT_PUBLIC_SITE_URL 우선, 누락 시 요청 origin fallback. 둘 다 없으면 에러.
  const origin =
    process.env.NEXT_PUBLIC_SITE_URL ?? (await headers()).get("origin");
  if (!origin) {
    redirect("/login?error=site_url_missing");
  }

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: `${origin}/auth/callback`,
    },
  });

  if (error) {
    redirect("/login?error=oauth_init_failed");
  }

  if (data?.url) {
    redirect(data.url);
  }

  // url 도 없고 error 도 없는 edge case (SDK shape 변경 등) — 무반응으로 끝나지 않게 명시적 redirect.
  redirect("/login?error=oauth_init_failed");
}

export async function signOut() {
  const supabase = await createClient();
  const { error } = await supabase.auth.signOut();
  if (error) {
    // 서버 revoke 실패 시에도 로컬 쿠키만큼은 정리해 /login → / 무한 redirect 를 끊는다.
    // refresh token 은 자연 만료까지 서버에 잔존 (가용성 vs revocation trade-off).
    await supabase.auth.signOut({ scope: "local" });
  }
  redirect("/login");
}
