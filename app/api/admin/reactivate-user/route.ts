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
    const { user_id } = body;

    if (!user_id) {
      return NextResponse.json({ error: "User ID is required" }, { status: 400 });
    }

    // Create admin client with service role key
    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    // Set is_active = true on public.users table
    const { error: updateError } = await supabaseAdmin
      .from("users")
      .update({ is_active: true })
      .eq("id", user_id);

    if (updateError) {
      console.error("User reactivation error:", updateError);
      return NextResponse.json({ error: updateError.message }, { status: 400 });
    }

    // Unban user via Supabase Auth Admin API
    const { error: unbanError } = await supabaseAdmin.auth.admin.updateUserById(
      user_id,
      { ban_duration: "none" }
    );

    if (unbanError) {
      console.error("User unban error:", unbanError);
      // Continue anyway - the is_active flag is the primary control
    }

    return NextResponse.json({
      success: true,
      message: "User reactivated successfully"
    });

  } catch (error: any) {
    console.error("Error reactivating user:", error);
    return NextResponse.json({ error: error.message || "Failed to reactivate user" }, { status: 500 });
  }
}
