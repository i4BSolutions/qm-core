import { createClient } from "@supabase/supabase-js";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { PERMISSION_RESOURCES } from "@/types/database";
import type { PermissionResource, PermissionLevel } from "@/types/database";

interface PermissionEntry {
  resource: PermissionResource;
  level: PermissionLevel;
}

const VALID_LEVELS: PermissionLevel[] = ["edit", "view", "block"];

export async function POST(request: Request) {
  try {
    // Verify the requesting user is an admin
    const serverClient = await createServerClient();
    const { data: { user: currentUser } } = await serverClient.auth.getUser();

    if (!currentUser) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get request body
    const body = await request.json();
    const { email, full_name, department_id, phone, permissions } = body;

    if (!email || !full_name) {
      return NextResponse.json({ error: "Email and full name are required" }, { status: 400 });
    }

    // Validate permissions if provided
    if (permissions !== undefined) {
      if (!Array.isArray(permissions) || permissions.length !== 16) {
        return NextResponse.json(
          { error: "All 16 permissions must be configured" },
          { status: 400 }
        );
      }

      const providedResources = new Set<string>(permissions.map((p: PermissionEntry) => p.resource));

      for (const resource of PERMISSION_RESOURCES) {
        if (!providedResources.has(resource)) {
          return NextResponse.json(
            { error: `All 16 permissions must be configured. Missing: ${resource}` },
            { status: 400 }
          );
        }
      }

      for (const entry of permissions as PermissionEntry[]) {
        if (!VALID_LEVELS.includes(entry.level)) {
          return NextResponse.json(
            { error: `Invalid permission level "${entry.level}" for resource "${entry.resource}"` },
            { status: 400 }
          );
        }
      }
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
      const { error: updateError } = await supabaseAdmin
        .from("users")
        .update({
          full_name,
          department_id: department_id || null,
          phone: phone || null,
        })
        .eq("id", inviteData.user.id);

      if (updateError) {
        console.error("Profile update error:", updateError);
        // Continue anyway - profile might be created by trigger
      }

      // Save permissions if provided.
      // The handle_new_user() trigger already creates 16 Block rows;
      // upsert overwrites them with the admin-specified levels.
      if (permissions && Array.isArray(permissions)) {
        const permissionRows = (permissions as PermissionEntry[]).map((p) => ({
          user_id: inviteData.user!.id,
          resource: p.resource,
          level: p.level,
        }));

        const { error: permError } = await supabaseAdmin
          .from("user_permissions")
          .upsert(permissionRows, { onConflict: "user_id,resource" });

        if (permError) {
          console.error("Permission upsert error:", permError);
          // Roll back: delete the invited user to maintain atomicity (PERM-03)
          const { error: deleteError } = await supabaseAdmin.auth.admin.deleteUser(
            inviteData.user.id
          );
          if (deleteError) {
            console.error("Rollback delete error:", deleteError);
          }
          return NextResponse.json(
            { error: "Failed to set permissions. User creation rolled back. Please try again." },
            { status: 500 }
          );
        }
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
