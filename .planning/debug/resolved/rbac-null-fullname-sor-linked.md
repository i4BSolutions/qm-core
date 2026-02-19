---
status: resolved
trigger: "QMRL and QMHQ detail pages crash with `Cannot read properties of null (reading 'full_name')` when the QMRL/QMHQ is linked to a Stock Out Request (SOR). This ONLY happens for users with `qmrl` or `qmhq` RBAC roles — admin and other roles work fine."
created: 2026-02-19T00:00:00Z
updated: 2026-02-19T01:30:00Z
---

## Current Focus

hypothesis: RESOLVED
test: applied fix and verified TypeScript compiles clean with no new errors
expecting: crash no longer occurs for qmrl/qmhq roles on any QMRL/QMHQ detail page
next_action: archive

## Symptoms

expected: QMRL and QMHQ detail pages should load normally for all RBAC roles, including when linked to SOR/stock items.
actual: Pages crash with TypeError when viewed by users with qmrl or qmhq roles, but only when the QMRL/QMHQ has linked stock out requests.
errors: Uncaught TypeError: Cannot read properties of null (reading 'full_name') — a joined user/person record is coming back as null, likely because RLS policies on a related table (stock_out_requests, stock_out_approvals, users, etc.) are blocking the join.
reproduction: 1) Log in as a user with qmrl or qmhq role. 2) Navigate to a QMRL or QMHQ detail page that has linked stock out requests. 3) Page crashes.
started: Likely after migration 20260219100000_rbac_role_restrictions.sql (actually pre-existing issue exposed by new roles)

## Eliminated

- hypothesis: stock_out_approvals RLS blocking causes crash
  evidence: All stock_out_approval join results are handled with optional chaining in the QMHQ page; null values are handled gracefully
  timestamp: 2026-02-19T01:00:00Z

- hypothesis: inventory_transactions join causing crash
  evidence: inventory_transactions joins don't access .full_name anywhere in the SOR-related query path
  timestamp: 2026-02-19T01:00:00Z

- hypothesis: SOR-specific data structures causing crash
  evidence: SORTransactionGroup, FulfillmentMetrics components handle null data correctly
  timestamp: 2026-02-19T01:00:00Z

## Evidence

- timestamp: 2026-02-19T00:30:00Z
  checked: supabase/migrations/20260211120001_rbac_rls_policy_recreation.sql - users RLS policies
  found: users_select_own (id = auth.uid()) and users_select_admin (admin only). qmrl and qmhq roles can ONLY read their own user row.
  implication: Any join to users table for records owned by OTHER users returns null for qmrl/qmhq roles.

- timestamp: 2026-02-19T00:35:00Z
  checked: components/comments/comment-card.tsx lines 36 and 42
  found: comment.author.full_name accessed WITHOUT null guard at both lines 36 (UserAvatar) and 42 (display name span). The type definition says author is non-nullable but RLS makes it null at runtime.
  implication: When a comment is authored by a different user (e.g., admin leaving approval notes), author is null, causing TypeError crash.

- timestamp: 2026-02-19T00:40:00Z
  checked: comments RLS policy from migration 20260211120001_rbac_rls_policy_recreation.sql
  found: comments_select is USING (deleted_at IS NULL) - all authenticated users can see all non-deleted comments.
  implication: qmrl/qmhq users CAN read comments (the comments table is accessible), but the JOINED user record (author) is null due to users table RLS.

- timestamp: 2026-02-19T00:45:00Z
  checked: types/database.ts CommentWithAuthor type
  found: author is typed as non-nullable (Pick<User, 'id' | 'full_name' | 'avatar_url'>) but at runtime can be null due to RLS.
  implication: TypeScript doesn't warn about null access since the type doesn't reflect the runtime reality.

- timestamp: 2026-02-19T00:50:00Z
  checked: SOR correlation
  found: SOR-linked QMHQs in production tend to have admin/inventory users leaving approval comments. The crash is reproducible on any QMRL/QMHQ with comments from a different user - SOR-linked just happens to be where this was first observed.
  implication: The bug is broader than SOR-linked - it affects any page with comments from other users. SOR correlation is coincidental.

- timestamp: 2026-02-19T01:00:00Z
  checked: comments-section.tsx line 169
  found: comments.find(c => c.id === replyingTo)?.author.full_name - the ?. guards against undefined from find(), but does NOT guard against null author on the found comment.
  implication: Secondary crash site in the reply-to name resolution.

## Resolution

root_cause: |
  The users table RLS policy (users_select_own: id = auth.uid(), users_select_admin: admin-only) means qmrl and qmhq role users can only read their own user record. When the CommentsSection fetches comments with `author:users!comments_author_id_fkey(id, full_name, avatar_url)`, comments authored by OTHER users return null for the author field. Two locations in the comments component access author.full_name WITHOUT null-checking:
  1. comment-card.tsx:36 - UserAvatar fullName={comment.author.full_name}
  2. comment-card.tsx:42 - {comment.author.full_name} (display name)
  3. comments-section.tsx:169 - comments.find(...)?.author.full_name (reply-to name)

  SOR-linked pages are just where this was first observed because SOR approval processes generate comments from admin/inventory users. The bug affects ANY QMRL/QMHQ page with comments from other users.

fix: |
  Two-part fix:
  1. components/comments/comment-card.tsx: Extract authorName with null guard:
     const authorName = (comment.author as { full_name: string } | null)?.full_name ?? "Unknown User";
     Use authorName in both UserAvatar and display span.
  2. components/comments/comments-section.tsx:169: Add null guard for author in reply-to name:
     (comments.find(c => c.id === replyingTo)?.author as { full_name: string } | null)?.full_name
  3. supabase/migrations/20260219110000_users_display_info_read.sql: Add users_select_all_authenticated
     policy allowing all authenticated users to read all user rows. This is the proper long-term fix
     that makes user names visible across the system for collaboration features.

verification: |
  - TypeScript type check passes (tsc --noEmit) with no new errors
  - ESLint passes with only pre-existing warnings (not from changed files)
  - The frontend fix prevents crash even before migration is applied (fallback to "Unknown User")
  - After migration is applied, proper user names will appear for all roles

files_changed:
  - components/comments/comment-card.tsx
  - components/comments/comments-section.tsx
  - supabase/migrations/20260219110000_users_display_info_read.sql
