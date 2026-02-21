import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import type { Database } from "@/types/database";
import type { PermissionResource as DbPermissionResource } from "@/types/database";

/**
 * Maps URL path prefixes to the PermissionResource that controls access.
 * Ordered longest-prefix-first so more specific routes match before general ones.
 */
const ROUTE_RESOURCE_MAP: { prefix: string; resource: DbPermissionResource }[] = [
  { prefix: '/inventory/stock-in', resource: 'stock_in' },
  { prefix: '/inventory/stock-out-requests', resource: 'sor' },
  { prefix: '/inventory/stock-out', resource: 'sor' },
  { prefix: '/inventory', resource: 'inventory_dashboard' },
  { prefix: '/dashboard', resource: 'system_dashboard' },
  { prefix: '/qmrl', resource: 'qmrl' },
  { prefix: '/qmhq', resource: 'qmhq' },
  { prefix: '/po', resource: 'po' },
  { prefix: '/invoice', resource: 'invoice' },
  { prefix: '/warehouse', resource: 'warehouse' },
  { prefix: '/item', resource: 'item' },
  { prefix: '/admin', resource: 'admin' },
];

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

  // If user exists and route is protected, check if user is still active and enforce permissions
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

    // Permission-based route blocking
    // Skip check for root path (it redirects to dashboard anyway)
    const pathname = request.nextUrl.pathname;
    if (pathname !== '/') {
      const match = ROUTE_RESOURCE_MAP.find(
        (entry) => pathname === entry.prefix || pathname.startsWith(entry.prefix + '/')
      );

      if (match) {
        // Fetch only the relevant permission row for this resource
        const { data: perm } = await supabase
          .from("user_permissions")
          .select("resource, level")
          .eq("user_id", user.id)
          .eq("resource", match.resource)
          .single();

        const level = perm?.level ?? 'block';

        if (level === 'block') {
          // User is blocked from this resource — redirect to /dashboard
          // If the blocked route IS /dashboard, fall back to /qmrl
          const fallback = match.resource === 'system_dashboard' ? '/qmrl' : '/dashboard';
          const url = request.nextUrl.clone();
          url.pathname = fallback;
          return NextResponse.redirect(url);
        }
      }
    }
  }

  if (user && request.nextUrl.pathname === "/login") {
    // User is logged in and trying to access login page, redirect to dashboard
    const url = request.nextUrl.clone();
    url.pathname = "/dashboard";
    return NextResponse.redirect(url);
  }

  return supabaseResponse;
}
