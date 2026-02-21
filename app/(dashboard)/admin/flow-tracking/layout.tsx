import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export default async function FlowTrackingLayout({
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
    .eq("resource", "admin")
    .single();

  if (!perm || perm.level !== "edit") {
    redirect("/dashboard");
  }

  return <>{children}</>;
}
