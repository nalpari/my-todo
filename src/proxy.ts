import { type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/proxy";

export async function proxy(request: NextRequest) {
  return await updateSession(request);
}

export const config = {
  matcher: [
    // auth/callback 은 자체 route handler 가 exchangeCodeForSession 으로 세션 쿠키를 직접 set 하므로
    // proxy 의 사전 getUser 호출과 충돌할 수 있어 제외.
    "/((?!_next/static|_next/image|favicon.ico|auth/callback|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
