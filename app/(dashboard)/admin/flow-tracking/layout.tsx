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

  // TODO Phase 62: replace role-based access guard with has_permission('admin', 'edit') check
  // users.role column dropped in Phase 60 — role guard disabled until Phase 62
  // const { data: profile } = await supabase
  //   .from("users")
  //   .select("role")
  //   .eq("id", user.id)
  //   .single();
  // if (profile?.role !== "admin") { redirect("/dashboard"); }

  return <>{children}</>;
}
