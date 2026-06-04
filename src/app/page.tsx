import { Suspense } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { VariantBSplit } from "@/components/VariantBSplit";
import { type DisplayUser } from "@/components/AppShell";
import { getAppData } from "@/lib/queries";

export default async function Home() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const displayUser: DisplayUser = {
    name:
      (typeof user.user_metadata?.full_name === "string" && user.user_metadata.full_name) ||
      user.email?.split("@")[0] ||
      "사용자",
    email: user.email ?? "",
    avatarUrl:
      typeof user.user_metadata?.avatar_url === "string"
        ? user.user_metadata.avatar_url
        : undefined,
  };

  const appData = await getAppData();

  // VariantBSplit 하위의 여러 클라이언트 컴포넌트(ProjectList · TagList ·
  // ProjectPicker · AppShell 등)가 useSearchParams() 를 호출하므로 반드시
  // <Suspense> 경계가 필요. Next.js 16 prerender 단계에서 경계가 없으면
  // BailoutToCSRError 가 던져져 "useSearchParams() should be wrapped in a
  // suspense boundary" 런타임 에러 발생.
  return (
    <Suspense>
      <VariantBSplit user={displayUser} appData={appData} />
    </Suspense>
  );
}
