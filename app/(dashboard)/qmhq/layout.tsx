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

  const { data: profile } = await supabase
    .from("users")
    .select("role")
    .eq("id", user.id)
    .single();

  // RBAC-07: QMRL users cannot access any QMHQ pages
  if (profile?.role === "qmrl") {
    redirect("/dashboard");
  }

  return <>{children}</>;
}
