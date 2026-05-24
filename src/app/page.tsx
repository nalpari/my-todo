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

  return <VariantBSplit user={displayUser} appData={appData} />;
}
