import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import type { Database } from "@/types/database";

// Routes that each role is NOT allowed to access (direct navigation blocked)
const ROLE_BLOCKED_ROUTES: Record<string, string[]> = {
  qmrl: ["/qmhq", "/po", "/invoice", "/inventory", "/warehouse", "/admin"],
  qmhq: ["/po", "/invoice", "/inventory", "/warehouse", "/admin"],
};

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  });

  const supabase = createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({
            request,
          });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // Do not run code between createServerClient and
  // supabase.auth.getUser(). A simple mistake could make it very hard to debug
  // issues with users being randomly logged out.

  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Define public routes that don't require authentication
  const publicRoutes = ["/login", "/auth/callback", "/auth/confirm"];
  const isPublicRoute = publicRoutes.some((route) =>
    request.nextUrl.pathname.startsWith(route)
  );

  if (!user && !isPublicRoute) {
    // No user, redirect to login page
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  // If user exists and route is protected, check if user is still active and enforce RBAC
  if (user && !isPublicRoute) {
    const { data: profile } = await supabase
      .from("users")
      .select("is_active")
      .eq("id", user.id)
      .single();

    if (profile && profile.is_active === false) {
      // Force sign out the deactivated user
      await supabase.auth.signOut();
      const url = request.nextUrl.clone();
      url.pathname = "/login";
      url.searchParams.set("reason", "deactivated");
      return NextResponse.redirect(url);
    }

    // TODO Phase 62: replace role-based route blocking with permission-based checks
    // users.role column dropped in Phase 60 — ROLE_BLOCKED_ROUTES disabled until Phase 62
    // if (profile && profile.role) {
    //   const blockedRoutes = ROLE_BLOCKED_ROUTES[profile.role as string] ?? [];
    //   const pathname = request.nextUrl.pathname;
    //   const isBlocked = blockedRoutes.some((blocked) =>
    //     pathname === blocked || pathname.startsWith(blocked + "/")
    //   );
    //   if (isBlocked) {
    //     const url = request.nextUrl.clone();
    //     url.pathname = "/dashboard";
    //     return NextResponse.redirect(url);
    //   }
    // }
  }

  if (user && request.nextUrl.pathname === "/login") {
    // User is logged in and trying to access login page, redirect to dashboard
    const url = request.nextUrl.clone();
    url.pathname = "/dashboard";
    return NextResponse.redirect(url);
  }

  return supabaseResponse;
}
