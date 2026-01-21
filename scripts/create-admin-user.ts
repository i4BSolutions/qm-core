/**
 * Script to create an admin user
 *
 * Usage:
 * npx ts-node scripts/create-admin-user.ts admin@example.com "Admin User"
 *
 * Or run the SQL directly in Supabase SQL Editor
 */

import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

async function createAdminUser(email: string, fullName: string) {
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  console.log(`Creating admin user: ${email}`);

  // Create auth user
  const { data: authData, error: authError } = await supabase.auth.admin.createUser({
    email,
    email_confirm: true, // Auto-confirm email
    user_metadata: {
      full_name: fullName,
    },
  });

  if (authError) {
    console.error("Error creating auth user:", authError);
    return;
  }

  console.log("Auth user created:", authData.user?.id);

  // Update user role to admin
  const { error: updateError } = await supabase
    .from("users")
    .update({ role: "admin", full_name: fullName })
    .eq("id", authData.user?.id);

  if (updateError) {
    console.error("Error updating user role:", updateError);
    return;
  }

  console.log("User role updated to admin");
  console.log("\n✅ Admin user created successfully!");
  console.log(`Email: ${email}`);
  console.log("Use Magic Link / OTP to sign in.\n");
}

// Get args
const email = process.argv[2];
const fullName = process.argv[3] || "Admin User";

if (!email) {
  console.log("Usage: npx ts-node scripts/create-admin-user.ts <email> [full_name]");
  process.exit(1);
}

createAdminUser(email, fullName);
