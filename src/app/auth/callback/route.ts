import { NextResponse, type NextRequest } from "next/server";
import { createMutableClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");

  if (!code) {
    return NextResponse.redirect(`${origin}/login?error=no_code`);
  }

  try {
    const supabase = await createMutableClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (error) {
      return NextResponse.redirect(`${origin}/login?error=exchange_failed`);
    }

    return NextResponse.redirect(`${origin}/`);
  } catch (e) {
    // 쿠키 set 실패가 silent success 로 새지 않게 명시적 실패 redirect.
    console.error("[auth/callback] cookie write failed", e);
    return NextResponse.redirect(`${origin}/login?error=cookie_write_failed`);
  }
}
