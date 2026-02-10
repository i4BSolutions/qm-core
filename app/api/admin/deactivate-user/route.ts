import { createClient } from "@supabase/supabase-js";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  try {
    // Verify the requesting user is an admin
    const serverClient = await createServerClient();
    const { data: { user: currentUser } } = await serverClient.auth.getUser();

    if (!currentUser) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Check if current user is admin
    const { data: userData } = await serverClient
      .from("users")
      .select("role")
      .eq("id", currentUser.id)
      .single();

    if (userData?.role !== "admin") {
      return NextResponse.json({ error: "Forbidden - Admin only" }, { status: 403 });
    }

    // Get request body
    const body = await request.json();
    const { user_id, reason } = body;

    if (!user_id) {
      return NextResponse.json({ error: "User ID is required" }, { status: 400 });
    }

    // Guard: Prevent self-deactivation
    if (user_id === currentUser.id) {
      return NextResponse.json({ error: "Cannot deactivate your own account" }, { status: 400 });
    }

    // Create admin client with service role key
    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    // Set is_active = false on public.users table
    const { error: updateError } = await supabaseAdmin
      .from("users")
      .update({ is_active: false })
      .eq("id", user_id);

    if (updateError) {
      console.error("User deactivation error:", updateError);
      return NextResponse.json({ error: updateError.message }, { status: 400 });
    }

    // Ban user via Supabase Auth Admin API (100 years = effectively permanent)
    const { error: banError } = await supabaseAdmin.auth.admin.updateUserById(
      user_id,
      { ban_duration: "876600h" }
    );

    if (banError) {
      console.error("User ban error:", banError);
      // Continue anyway - the is_active flag is the primary control
    }

    // Kill all active sessions immediately
    try {
      await supabaseAdmin.auth.admin.signOut(user_id);
    } catch (signOutError) {
      console.error("Sign out error:", signOutError);
      // Continue anyway - user may not have active sessions
    }

    return NextResponse.json({
      success: true,
      message: "User deactivated successfully"
    });

  } catch (error: any) {
    console.error("Error deactivating user:", error);
    return NextResponse.json({ error: error.message || "Failed to deactivate user" }, { status: 500 });
  }
}
