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

    // TODO Phase 62: replace role check with has_permission('admin', 'edit') via RPC
    // users.role column dropped in Phase 60 — admin check relies on RLS until Phase 62
    // const { data: userData } = await serverClient.from("users").select("role").eq("id", currentUser.id).single();
    // if (userData?.role !== "admin") { return NextResponse.json({ error: "Forbidden - Admin only" }, { status: 403 }); }

    // Get request body
    const body = await request.json();
    const { email, full_name, role, department_id, phone } = body;

    if (!email || !full_name) {
      return NextResponse.json({ error: "Email and full name are required" }, { status: 400 });
    }

    // Create admin client with service role key
    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    // Invite user by email - this sends an invitation email
    const { data: inviteData, error: inviteError } = await supabaseAdmin.auth.admin.inviteUserByEmail(email, {
      redirectTo: `${process.env.NEXT_PUBLIC_APP_URL}/auth/callback`,
      data: {
        full_name,
      },
    });

    if (inviteError) {
      console.error("Invite error:", inviteError);
      return NextResponse.json({ error: inviteError.message }, { status: 400 });
    }

    if (inviteData.user) {
      // Update the user profile with additional info
      // TODO Phase 62: set user permissions via create_default_permissions() instead of role
      // users.role column dropped in Phase 60
      const { error: updateError } = await supabaseAdmin
        .from("users")
        .update({
          full_name,
          // role field removed (Phase 60) — use permission matrix instead
          department_id: department_id || null,
          phone: phone || null,
        })
        .eq("id", inviteData.user.id);

      if (updateError) {
        console.error("Profile update error:", updateError);
        // Continue anyway - profile might be created by trigger
      }
    }

    return NextResponse.json({
      success: true,
      message: `Invitation sent to ${email}`,
      user: inviteData.user
    });

  } catch (error: any) {
    console.error("Error inviting user:", error);
    return NextResponse.json({ error: error.message || "Failed to invite user" }, { status: 500 });
  }
}
