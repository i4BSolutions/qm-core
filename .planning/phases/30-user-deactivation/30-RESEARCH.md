# Phase 30: User Deactivation - Research

**Researched:** 2026-02-10
**Domain:** User management, authentication, authorization
**Confidence:** HIGH

## Summary

User deactivation is a soft-delete pattern for user accounts that preserves historical data attribution while preventing login and hiding deactivated users from assignment dropdowns. The QM system already has the `is_active` flag on the `users` table (line 29 of `002_users.sql`), which serves as the foundation for this feature.

Implementation requires three primary components: (1) UI changes to the user management page for deactivate/reactivate actions with confirmation dialogs, (2) middleware enhancement to check `is_active` status and block deactivated users at login, and (3) session invalidation to force immediate logout when a user is deactivated. The codebase already filters `.eq("is_active", true)` in user assignment queries, so dropdown filtering is partially implemented.

**Primary recommendation:** Leverage Supabase Auth Admin API's `ban_duration` parameter for session invalidation (set to '100y' for effective permanent deactivation), enhance middleware to check user's `is_active` flag from the `public.users` table, and implement a confirmation dialog pattern similar to existing `VoidInvoiceDialog` and `RejectionDialog` components.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Deactivation UX:**
- Trigger via action menu button (... menu or action dropdown) on each user row, not a toggle switch
- Confirmation dialog required with optional reason field ("Why are you deactivating this user?")
- Deactivated users shown mixed with active users in the same list, with an "Inactive" badge
- Deactivated user rows are visually dimmed/grayed out AND show the "Inactive" badge — immediately obvious
- Admins cannot deactivate their own account — blocked to prevent lockout

**Login blocking:**
- Deactivation forces immediate logout of all active sessions
- Deactivated users see a specific message: "Your account has been deactivated. Contact your administrator."
- Login page distinguishes between "user not found" and "user deactivated" with different error messages (deactivated gets the specific message above)

### Claude's Discretion

- Dropdown filtering approach (how deactivated users are hidden in assignment selects but visible in historical records)
- Reactivation flow (same action menu, confirmation dialog style)
- Database implementation (is_active flag, middleware check approach)
- Session invalidation mechanism (Supabase auth approach)

### Deferred Ideas (OUT OF SCOPE)

None — discussion stayed within phase scope

</user_constraints>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Supabase Auth Admin API | Current | User status management, session control | Official Supabase admin operations, provides `ban_duration` for session control |
| Next.js Middleware | 14+ | Request interception, auth checks | Built into Next.js App Router, runs before route handlers |
| Supabase RLS | Current | Database-level access control | Already implemented in QM system (027_rls_policies.sql) |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| shadcn/ui Dialog | Current | Confirmation dialogs | Already used for VoidInvoiceDialog, RejectionDialog |
| react-table | Current | Data table with action menus | Already used in users page (DataTable component) |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| ban_duration | Custom session tracking table | More control but significantly more complexity; Supabase handles session lifecycle automatically |
| Middleware DB check | Client-side only check | Simpler but insecure — users could bypass with auth token manipulation |
| Mixed active/inactive list | Separate tabs/filters | User requirement explicitly states "mixed in same list with badge" |

**Installation:**
No new packages required — all dependencies already in project.

## Architecture Patterns

### Existing Patterns to Follow

**1. Soft Delete Pattern (Already Implemented)**
```sql
-- From 002_users.sql line 29
is_active BOOLEAN DEFAULT true
```
- All major tables use `is_active` flag instead of hard deletes
- Preserved in audit trails and historical references
- Filtered in active queries: `.eq("is_active", true)`

**2. Confirmation Dialog Pattern**
Location: `/components/invoice/void-invoice-dialog.tsx`, `/components/stock-out-requests/rejection-dialog.tsx`

Key elements:
- State management: `[isSubmitting, setIsSubmitting]`
- Optional reason field (textarea)
- Warning message with icon (AlertTriangle)
- Destructive action button styling
- Reset form on close
- Success/error toast notifications

**3. Action Menu Pattern**
Location: `/app/(dashboard)/admin/users/page.tsx` lines 179-203

Current implementation:
```tsx
<DropdownMenu>
  <DropdownMenuTrigger asChild>
    <Button variant="ghost" size="icon" className="h-8 w-8">
      <MoreHorizontal className="h-4 w-4" />
    </Button>
  </DropdownMenuTrigger>
  <DropdownMenuContent align="end">
    <DropdownMenuItem onClick={() => handleEdit(row.original)}>
      <Pencil className="mr-2 h-4 w-4" />
      Edit
    </DropdownMenuItem>
    <DropdownMenuItem
      onClick={() => handleDelete(row.original.id)}
      className="text-red-400 focus:text-red-400"
    >
      <Trash2 className="mr-2 h-4 w-4" />
      Deactivate
    </DropdownMenuItem>
  </DropdownMenuContent>
</DropdownMenu>
```

### Recommended Architecture Changes

**1. Enhanced Middleware with User Status Check**

Current middleware (`lib/supabase/middleware.ts` lines 37-52):
- Only checks if user session exists
- No validation of user's active status

Enhancement needed:
```typescript
// After getting user from session
if (user && !isPublicRoute) {
  // Query public.users table for is_active status
  const { data: profile } = await supabase
    .from("users")
    .select("is_active")
    .eq("id", user.id)
    .single();

  if (profile && !profile.is_active) {
    // User is deactivated - sign out and redirect to login with reason
    await supabase.auth.signOut();
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("reason", "deactivated");
    return NextResponse.redirect(url);
  }
}
```

**Performance consideration:** Next.js middleware runs on every request. From Next.js 15.2.0+, middleware can use Node.js runtime for database access, but this adds latency. Alternative: check status only on authentication-critical routes (not static assets).

**2. Login Page Enhancement**

Current: `/app/(auth)/login/page.tsx` lines 45-68 handles OTP send
Enhancement: Check URL params for `reason=deactivated` and display specific error message

**3. Session Invalidation via Supabase Admin API**

Two approaches identified:

**Option A: Use ban_duration (RECOMMENDED)**
```typescript
// Server action or API route
const { data, error } = await supabase.auth.admin.updateUserById(
  userId,
  { ban_duration: '100y' } // Effectively permanent
);
```
Benefits:
- Supabase automatically blocks new logins
- Existing sessions remain valid until access token expires (5-60 minutes)
- Native Supabase feature, well-tested

**Option B: Manual session revocation**
```sql
UPDATE auth.sessions SET revoked = true WHERE user_id = 'user-uuid';
DELETE FROM auth.refresh_tokens WHERE user_id = 'user-uuid';
```
Benefits:
- More immediate (blocks within seconds)
- Direct database control

Drawbacks:
- Requires direct database access (service role key)
- Must manually manage when user is reactivated
- Access tokens remain valid until expiry (can't be revoked)

**Recommendation:** Use Option A (ban_duration) for deactivation, unban for reactivation. Combine with middleware check for defense-in-depth.

### Anti-Patterns to Avoid

- **Don't filter is_active in historical views:** Created_by, updated_by, assigned_to should show names even if deactivated
- **Don't use hard delete:** User records must be preserved for audit trails
- **Don't skip confirmation dialogs:** Prevents accidental deactivation (especially important for admin's own account protection)
- **Don't rely solely on client-side checks:** Middleware validation is critical for security

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Session invalidation | Custom session tracking table | Supabase `ban_duration` + `signOut({ scope: 'global' })` | Supabase handles token refresh, multi-device sessions, race conditions automatically |
| Login blocking | Client-side redirect loops | Middleware database check + URL params | Middleware runs before route handlers, provides server-side enforcement |
| Confirmation dialogs | Custom modal components | shadcn/ui Dialog (already in project) | Consistent with VoidInvoiceDialog, RejectionDialog patterns |
| User filtering in dropdowns | Custom filtering logic | Supabase `.eq("is_active", true)` (already implemented) | Declarative, leverages database indexes |

**Key insight:** Supabase Auth already provides user banning via `ban_duration`. Custom session invalidation systems introduce edge cases (token refresh timing, multi-tab sessions, mobile apps) that Supabase has already solved.

## Common Pitfalls

### Pitfall 1: Access Token Validity After Ban
**What goes wrong:** User is deactivated, but remains logged in for up to 60 minutes because their access token hasn't expired yet

**Why it happens:** Supabase Auth access tokens (JWTs) are self-contained and can't be revoked mid-flight. The `banned_until` check happens during token refresh, not on every request.

**How to avoid:**
- Implement middleware check that queries `public.users.is_active` on every protected request
- This provides immediate enforcement regardless of token state
- Trade-off: adds ~10-50ms per request for database query

**Warning signs:** User reports "I was deactivated but could still access the system for several minutes"

### Pitfall 2: Admin Self-Deactivation
**What goes wrong:** Admin deactivates their own account, loses all admin access, system becomes unmanageable

**Why it happens:** No UI-level check prevents self-targeting actions

**How to avoid:**
```typescript
const currentUser = useAuth(); // From auth-provider.tsx
const canDelete = can("delete", "users") && row.original.id !== currentUser?.id;
```
Conditionally render/disable deactivate action for current user

**Warning signs:** Dropdown menu allows admin to select "Deactivate" on their own row

### Pitfall 3: Historical Data Filtering
**What goes wrong:** Reports and audit logs show "[Deleted User]" or blank names for deactivated users

**Why it happens:** Queries for historical data (created_by, assigned_to) inadvertently filter `.eq("is_active", true)`

**How to avoid:**
- Dropdown filters (for assignment): `.eq("is_active", true)` ✓
- Historical display queries: NO is_active filter ✓
- Use separate query functions: `getActiveUsersForAssignment()` vs `getUserById()`

**Warning signs:** Audit logs missing user names, "Created by: Unknown" appears in historical views

### Pitfall 4: Reactivation Without Session Cleanup
**What goes wrong:** User is reactivated but can't log in because ban is still active in auth.users

**Why it happens:** Setting `is_active = true` in public.users doesn't clear `banned_until` in auth.users

**How to avoid:**
```typescript
// Reactivation must do BOTH:
await supabase.from("users").update({ is_active: true }).eq("id", userId);
await supabase.auth.admin.updateUserById(userId, { ban_duration: "none" });
```

**Warning signs:** User reports "I was reactivated but login still fails"

### Pitfall 5: Inconsistent Badge/Dimming Display
**What goes wrong:** Badge shows "Inactive" but row styling is normal, or vice versa — creates confusion about user status

**Why it happens:** Conditional classes applied to different elements without consistent status check

**How to avoid:**
```tsx
// Single source of truth
const isInactive = !row.original.is_active;

// Apply to row
<tr className={cn(isInactive && "opacity-50 bg-slate-800/30")}>
  {/* Badge in status column */}
  {isInactive && <Badge variant="secondary">Inactive</Badge>}
</tr>
```

**Warning signs:** User confusion: "Is this user active or not? The badge says inactive but it looks normal"

## Code Examples

Verified patterns from existing codebase:

### Pattern 1: User Filtering in Assignment Dropdowns
```typescript
// From /app/(dashboard)/qmrl/new/page.tsx lines 102-106
const { data: userData } = await supabase
  .from("users")
  .select("*")
  .eq("is_active", true)  // Already filtering inactive users
  .order("full_name");
```

### Pattern 2: Confirmation Dialog with Optional Reason
```typescript
// Based on /components/invoice/void-invoice-dialog.tsx
interface DeactivateUserDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  user: { id: string; full_name: string; email: string };
  onConfirm: (reason?: string) => Promise<void>;
  isLoading?: boolean;
}

// Usage pattern (lines 32-58 from void-invoice-dialog.tsx):
const [reason, setReason] = useState("");
const handleConfirm = async () => {
  await onConfirm(reason.trim() || undefined); // Optional reason
  setReason("");
  onOpenChange(false);
};
```

### Pattern 3: Row-Level Action Menu
```typescript
// From /app/(dashboard)/admin/users/page.tsx lines 176-209
{
  id: "actions",
  cell: ({ row }) => (
    (canUpdate || canDelete) ? (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" className="h-8 w-8">
            <MoreHorizontal className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          {canUpdate && (
            <DropdownMenuItem onClick={() => handleEdit(row.original)}>
              <Pencil className="mr-2 h-4 w-4" />
              Edit
            </DropdownMenuItem>
          )}
          {canDelete && row.original.id !== currentUser?.id && (
            <DropdownMenuItem
              onClick={() => handleDeactivate(row.original)}
              className="text-red-400 focus:text-red-400"
            >
              <UserX className="mr-2 h-4 w-4" />
              Deactivate
            </DropdownMenuItem>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
    ) : (
      <span className="text-slate-500 flex items-center gap-1">
        <Lock className="h-3 w-3" />
      </span>
    )
  ),
}
```

### Pattern 4: Conditional Row Styling
```typescript
// Pattern for dimming inactive users in table
// Add to columns definition in users page
{
  accessorKey: "full_name",
  header: ({ column }) => <DataTableColumnHeader column={column} title="Name" />,
  cell: ({ row }) => {
    const isInactive = !row.original.is_active;
    return (
      <div className={cn(
        "flex items-center gap-3",
        isInactive && "opacity-50"
      )}>
        <div className="w-8 h-8 rounded-full bg-slate-700 flex items-center justify-center">
          {row.original.full_name?.charAt(0).toUpperCase() || "?"}
        </div>
        <div>
          <div className="flex items-center gap-2">
            <p className="font-medium text-slate-200">{row.original.full_name}</p>
            {isInactive && (
              <Badge variant="secondary" className="text-xs">Inactive</Badge>
            )}
          </div>
          <p className="text-xs text-slate-400">{row.original.email}</p>
        </div>
      </div>
    );
  },
}
```

### Pattern 5: Server Action for Deactivation
```typescript
// Create new server action: /lib/actions/users.ts
"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

export async function deactivateUser(userId: string, reason?: string) {
  const supabase = createClient();

  // 1. Update public.users.is_active
  const { error: updateError } = await supabase
    .from("users")
    .update({
      is_active: false,
      // Optionally store reason in metadata or separate field
    })
    .eq("id", userId);

  if (updateError) throw updateError;

  // 2. Ban user in auth.users (prevents new logins, doesn't affect current sessions immediately)
  const { error: banError } = await supabase.auth.admin.updateUserById(
    userId,
    { ban_duration: "100y" }
  );

  if (banError) throw banError;

  // 3. Force sign out all sessions (admin API)
  await supabase.auth.admin.signOut(userId, "global");

  revalidatePath("/admin/users");
  return { success: true };
}

export async function reactivateUser(userId: string) {
  const supabase = createClient();

  // 1. Update public.users.is_active
  const { error: updateError } = await supabase
    .from("users")
    .update({ is_active: true })
    .eq("id", userId);

  if (updateError) throw updateError;

  // 2. Unban user in auth.users
  const { error: unbanError } = await supabase.auth.admin.updateUserById(
    userId,
    { ban_duration: "none" }
  );

  if (unbanError) throw unbanError;

  revalidatePath("/admin/users");
  return { success: true };
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Hard delete users | Soft delete with `is_active` flag | QM system since Iteration 2 (002_users.sql) | Preserves audit trails, historical references intact |
| Custom session tables | Supabase Auth built-in session management | Supabase Auth v2+ | Reduces complexity, leverages native token refresh |
| Client-side auth checks only | Middleware-based server-side checks | Next.js 13+ App Router | Security improvement, prevents auth bypass |
| Per-route auth validation | Edge middleware for all routes | Next.js 12.2+ | Consistent enforcement, runs before route handlers |

**Deprecated/outdated:**
- Direct `DELETE FROM auth.users`: Supabase Auth doesn't support this — use `ban_duration` instead
- `supabase.auth.signOut()` without scope: Default is now `"global"` (all sessions), but explicit is better
- Checking `auth.users` directly in RLS policies: Use `auth.uid()` and `public.users` join instead

## Open Questions

1. **Session Invalidation Timing**
   - What we know: `ban_duration` blocks new logins; existing access tokens valid until expiry (5-60min)
   - What's unclear: Does middleware DB check on every request cause performance issues?
   - Recommendation: Implement middleware check; monitor latency in production. If problematic, cache user status in session metadata with short TTL (5min).

2. **Deactivation Reason Storage**
   - What we know: Confirmation dialog can collect reason (optional per requirements)
   - What's unclear: Should reason be stored in database for audit purposes?
   - Recommendation: If audit trail needed, add `deactivation_reason TEXT` and `deactivated_at TIMESTAMPTZ` to users table. Otherwise, just log in audit_logs table with existing trigger.

3. **Reactivation Permissions**
   - What we know: Admin can deactivate users
   - What's unclear: Should reactivation also be admin-only, or could Quartermaster role reactivate?
   - Recommendation: Keep symmetric — same role that can deactivate can reactivate (admin only initially).

## Sources

### Primary (HIGH confidence)
- Existing codebase:
  - `/supabase/migrations/002_users.sql` - Users table schema with is_active flag
  - `/supabase/migrations/027_rls_policies.sql` - RLS policy patterns
  - `/app/(dashboard)/admin/users/page.tsx` - Current user management UI
  - `/lib/supabase/middleware.ts` - Current auth middleware
  - `/components/invoice/void-invoice-dialog.tsx` - Confirmation dialog pattern
  - `/components/stock-out-requests/rejection-dialog.tsx` - Reason field pattern
  - `/app/(dashboard)/qmrl/new/page.tsx` - User filtering in dropdowns

- Supabase Official Documentation:
  - [updateUserById - Supabase Admin API](https://supabase.com/docs/reference/javascript/auth-admin-updateuserbyid) - ban_duration parameter
  - [User Sessions - Supabase Docs](https://supabase.com/docs/guides/auth/sessions) - Session lifecycle and validation
  - [Signing Out - Supabase Docs](https://supabase.com/docs/guides/auth/signout) - Global signout scope

### Secondary (MEDIUM confidence)
- GitHub Discussions:
  - [How to disable/deactivate a user · supabase · Discussion #9239](https://github.com/orgs/supabase/discussions/9239) - Community patterns for user deactivation
  - [Display user valid sessions and allow to invalidate · Discussion #26863](https://github.com/orgs/supabase/discussions/26863) - Session management approaches
  - [Invalidate a session from database · Discussion #13941](https://github.com/orgs/supabase/discussions/13941) - Manual session revocation

- Next.js Middleware:
  - [Next.js Middleware Guide | Contentful](https://www.contentful.com/blog/next-js-middleware/) - Middleware patterns and database access considerations
  - [What is Middleware in Next.js? | Clerk Blog](https://clerk.com/blog/what-is-middleware-in-nextjs) - Authentication middleware patterns

### Tertiary (LOW confidence)
- General React patterns:
  - [PrimeReact Dropdown Documentation](https://primereact.org/dropdown/) - Dropdown filtering patterns
  - [KendoReact DropDownList Filtering](https://www.telerik.com/kendo-react-ui/components/dropdowns/dropdownlist/filtering) - Filter implementation examples

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - All libraries already in project, Supabase Admin API officially documented
- Architecture: HIGH - Existing patterns verified in codebase, Supabase Auth behavior documented
- Pitfalls: HIGH - Identified from codebase analysis and official Supabase documentation caveats

**Research date:** 2026-02-10
**Valid until:** March 12, 2026 (30 days — stable domain, Supabase Auth API unlikely to change)
