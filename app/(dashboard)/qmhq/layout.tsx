import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export default async function QmhqLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: perm } = await supabase
    .from("user_permissions")
    .select("level")
    .eq("user_id", user.id)
    .eq("resource", "qmhq")
    .single();

  if (!perm || perm.level === "block") {
    redirect("/dashboard");
  }

  return <>{children}</>;
}
