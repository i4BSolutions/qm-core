# Phase 23: Comments System - Research

**Researched:** 2026-02-07
**Domain:** Threaded Comments with Supabase RLS
**Confidence:** HIGH

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- Card-based layout for each comment (bordered card with subtle shadow)
- Replies indented under parent comment with connecting line
- Each comment shows: user avatar, display name, absolute timestamp (not relative like "2 hours ago")
- Plain text only - no markdown or rich text formatting
- Empty state: simple text "No comments yet" with add button
- Reply button visible on each parent comment (not on replies)
- Reply input appears at bottom of thread with "replying to @name" indicator
- Can only reply to parent comments, not to replies
- After submitting: reply appears immediately + success toast notification
- Inline section at bottom of detail page content (not in tabs, not in sidebar)
- Always visible - not collapsible
- Section header shows "Comments (5)" with comment count
- Add comment input positioned at bottom of section
- Delete button (trash icon) always visible on own comments
- Confirmation dialog before deleting ("Are you sure?")
- Comments with replies cannot be deleted - delete button disabled with tooltip "Cannot delete: has replies"
- Only replies (leaf comments) can be deleted
- Everyone can only delete their own comments (admin/quartermaster cannot delete others)

### Claude's Discretion
- Exact card styling (shadows, borders, spacing)
- Loading skeleton design while fetching comments
- Error state handling
- Exact timestamp format (e.g., "Feb 7, 2026 at 2:30 PM")

### Deferred Ideas (OUT OF SCOPE)
None - discussion stayed within phase scope.
</user_constraints>

## Summary

This phase implements a threaded comments system for QMRL, QMHQ, PO, and Invoice detail pages. The system uses a polymorphic table design similar to the existing `file_attachments` table, with entity_type and entity_id columns to associate comments with different entity types. Comments support single-level threading (parent comments can have replies, but replies cannot have nested replies).

The implementation follows existing QM System patterns: Supabase PostgreSQL with RLS policies that mirror parent entity visibility, soft delete using `deleted_at` timestamp, and React components using the established Card, Skeleton, Dialog, and Toast UI patterns. The key technical challenge is efficiently querying threaded comments while respecting RLS policies on the parent entities.

**Primary recommendation:** Use polymorphic table design with `parent_id` self-reference for threading, follow existing `file_attachments` RLS pattern for visibility, and implement soft delete with "has replies" check at both database trigger and UI levels.

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| @supabase/supabase-js | ^2.50.0 | Database client | Already in project |
| @radix-ui/react-dialog | ^1.1.15 | Delete confirmation modal | Already in project |
| @radix-ui/react-tooltip | ^1.1.3 | Disabled delete tooltip | Already in project |
| lucide-react | ^0.447.0 | Icons (MessageSquare, Reply, Trash2, User) | Already in project |
| date-fns | ^3.6.0 | Date formatting | Already in project |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| @radix-ui/react-toast | ^1.2.15 | Success/error notifications | Post-submit feedback |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Polymorphic table | Separate tables per entity | More tables, harder to maintain |
| Self-referential parent_id | Materialized path | Simpler queries but harder ordering |

**Installation:**
No new packages required - all dependencies already present.

## Architecture Patterns

### Recommended Table Structure
```sql
CREATE TABLE public.comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Polymorphic entity relationship (mirrors file_attachments)
  entity_type TEXT NOT NULL CHECK (entity_type IN ('qmrl', 'qmhq', 'po', 'invoice')),
  entity_id UUID NOT NULL,

  -- Threading
  parent_id UUID REFERENCES public.comments(id) ON DELETE RESTRICT,

  -- Content
  content TEXT NOT NULL,

  -- Ownership
  author_id UUID NOT NULL REFERENCES public.users(id),

  -- Soft delete
  deleted_at TIMESTAMPTZ,
  deleted_by UUID REFERENCES public.users(id),

  -- Audit
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

### Recommended Component Structure
```
components/
├── comments/
│   ├── index.ts                    # Barrel export
│   ├── comments-section.tsx        # Main container with header + count
│   ├── comment-list.tsx            # Threaded list with loading state
│   ├── comment-card.tsx            # Individual comment display
│   ├── comment-input.tsx           # Add/reply input form
│   └── delete-comment-dialog.tsx   # Confirmation dialog
```

### Pattern 1: Polymorphic RLS Following Parent Entity
**What:** Comments visibility mirrors parent entity RLS (user can see comment if they can see the QMRL/QMHQ/PO/Invoice)
**When to use:** All comment SELECT operations
**Example:**
```sql
-- Source: Existing file_attachments RLS pattern from 030_file_attachments.sql
CREATE POLICY comments_select ON public.comments
  FOR SELECT USING (
    deleted_at IS NULL
    AND (
      -- Privileged roles see all
      public.get_user_role() IN ('admin', 'quartermaster', 'finance', 'inventory', 'proposal', 'frontline')
      OR (
        -- Requester sees own QMRL comments
        public.get_user_role() = 'requester'
        AND entity_type = 'qmrl'
        AND public.owns_qmrl(entity_id)
      )
      OR (
        -- Requester sees QMHQ comments linked to own QMRL
        public.get_user_role() = 'requester'
        AND entity_type = 'qmhq'
        AND public.owns_qmhq(entity_id)
      )
      -- PO and Invoice visible to privileged roles only (no requester access per existing RLS)
    )
  );
```

### Pattern 2: Single-Level Threading Query
**What:** Fetch parent comments with their replies in correct order
**When to use:** Loading comments for a detail page
**Example:**
```typescript
// Fetch comments with author info, ordered for threading
const { data: comments } = await supabase
  .from("comments")
  .select(`
    *,
    author:users!comments_author_id_fkey(id, full_name, avatar_url)
  `)
  .eq("entity_type", entityType)
  .eq("entity_id", entityId)
  .is("deleted_at", null)
  .order("created_at", { ascending: true });

// Group in frontend: parents first, then nest replies
const groupedComments = comments?.reduce((acc, comment) => {
  if (!comment.parent_id) {
    acc.push({ ...comment, replies: [] });
  } else {
    const parent = acc.find(c => c.id === comment.parent_id);
    if (parent) parent.replies.push(comment);
  }
  return acc;
}, []);
```

### Pattern 3: Inline Section at Bottom of Detail Page
**What:** Comments section placed inline after main content, not in tabs
**When to use:** All 4 detail pages (QMRL, QMHQ, PO, Invoice)
**Example:**
```tsx
// In detail page component, after Tabs section
<div className="space-y-6">
  {/* Existing Tabs component */}
  <Tabs>...</Tabs>

  {/* Comments section - always visible, not in tabs */}
  <CommentsSection
    entityType="qmrl"
    entityId={qmrl.id}
  />
</div>
```

### Anti-Patterns to Avoid
- **Nested reply depth > 1:** User decided single-level only. Don't allow replies to replies.
- **Real-time subscriptions:** Not requested. Use optimistic updates instead.
- **Markdown rendering:** User explicitly wants plain text only.
- **Relative timestamps:** User explicitly wants absolute format like "Feb 7, 2026 at 2:30 PM".
- **Admin delete override:** Everyone can only delete own comments, even admin/quartermaster.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Confirmation dialog | Custom modal | Dialog from @radix-ui/react-dialog | Already themed, accessible |
| Date formatting | Manual date parsing | date-fns format() | Handles locales, edge cases |
| Toast notifications | Custom notification | Existing useToast hook | Already in codebase |
| Loading skeleton | Custom placeholder | Existing Skeleton component | Consistent styling |
| Tooltip for disabled state | Custom hover | @radix-ui/react-tooltip | Already imported |

**Key insight:** The codebase already has all required UI primitives. Comments system only needs domain-specific components.

## Common Pitfalls

### Pitfall 1: RLS Performance on Threaded Queries
**What goes wrong:** Slow comment fetching due to RLS policy evaluation on each row plus parent entity joins
**Why it happens:** RLS with `owns_qmrl()` or `owns_qmhq()` functions evaluated per-row
**How to avoid:**
1. Add index on `(entity_type, entity_id)` with `WHERE deleted_at IS NULL`
2. Wrap auth.uid() in SELECT per Supabase best practices
3. Use SECURITY DEFINER helper functions (already exist)
**Warning signs:** > 200ms query times on comment fetch

### Pitfall 2: Orphaned Replies After Delete
**What goes wrong:** Parent deleted, replies become orphaned (null parent_id reference)
**Why it happens:** Forgot to check for child comments before delete
**How to avoid:**
1. Database constraint: `ON DELETE RESTRICT` on parent_id FK
2. UI check: Disable delete button if `replies.length > 0`
3. RLS policy: Check function `has_replies(comment_id)` before allowing delete
**Warning signs:** Comments appearing without parent, broken thread structure

### Pitfall 3: Self-Delete Race Condition
**What goes wrong:** User deletes comment while another user is replying
**Why it happens:** No locking between reply and delete operations
**How to avoid:**
1. Optimistic UI: Show deleted state immediately
2. Database trigger: Block delete if reply added after delete initiated
3. Refresh on submit: Re-fetch thread after successful operations
**Warning signs:** "Reply failed" errors, orphaned replies

### Pitfall 4: Incorrect Reply Visibility
**What goes wrong:** Reply appears even though parent entity is not visible to user
**Why it happens:** Reply RLS doesn't check parent entity access
**How to avoid:** Comments RLS must mirror entity RLS exactly (already shown in Pattern 1)
**Warning signs:** Users seeing comments on entities they can't access

### Pitfall 5: Missing Soft Delete Check on Insert
**What goes wrong:** Reply added to soft-deleted parent comment
**Why it happens:** INSERT policy doesn't check parent's deleted_at
**How to avoid:** Add check in INSERT policy: `parent_id IS NULL OR EXISTS (SELECT 1 FROM comments WHERE id = parent_id AND deleted_at IS NULL)`
**Warning signs:** Replies appearing on deleted comments

## Code Examples

### Comment Card with Avatar and Timestamp
```tsx
// Source: Existing detail page User display pattern (qmrl/[id]/page.tsx lines 437-465)
interface CommentCardProps {
  comment: Comment;
  onReply?: () => void;
  onDelete?: () => void;
  canDelete: boolean;
  hasReplies: boolean;
}

function CommentCard({ comment, onReply, onDelete, canDelete, hasReplies }: CommentCardProps) {
  return (
    <div className="rounded-lg border border-slate-700 bg-slate-800/30 p-4 shadow-soft">
      <div className="flex items-start gap-3">
        {/* User Avatar - follows existing pattern */}
        <div className="h-8 w-8 flex-shrink-0 rounded-full bg-amber-500/20 border border-amber-500/30 flex items-center justify-center">
          <User className="h-4 w-4 text-amber-500" />
        </div>

        <div className="flex-1 min-w-0">
          {/* Author name and timestamp */}
          <div className="flex items-center gap-2">
            <span className="font-medium text-slate-200">
              {comment.author.full_name}
            </span>
            <span className="text-xs text-slate-400">
              {format(new Date(comment.created_at), "MMM d, yyyy 'at' h:mm a")}
            </span>
          </div>

          {/* Plain text content */}
          <p className="mt-1 text-slate-300 whitespace-pre-wrap">
            {comment.content}
          </p>

          {/* Actions */}
          <div className="mt-2 flex items-center gap-2">
            {/* Reply button - only on parent comments */}
            {!comment.parent_id && onReply && (
              <Button
                variant="ghost"
                size="sm"
                onClick={onReply}
                className="text-slate-400 hover:text-amber-500"
              >
                <Reply className="h-3 w-3 mr-1" />
                Reply
              </Button>
            )}

            {/* Delete button with tooltip when disabled */}
            {canDelete && (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={onDelete}
                        disabled={hasReplies}
                        className="text-slate-400 hover:text-red-400 disabled:opacity-50"
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </span>
                  </TooltipTrigger>
                  {hasReplies && (
                    <TooltipContent>
                      Cannot delete: has replies
                    </TooltipContent>
                  )}
                </Tooltip>
              </TooltipProvider>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
```

### Comments Section Container
```tsx
// Source: Pattern from existing AttachmentsTab component structure
interface CommentsSectionProps {
  entityType: 'qmrl' | 'qmhq' | 'po' | 'invoice';
  entityId: string;
}

function CommentsSection({ entityType, entityId }: CommentsSectionProps) {
  const [comments, setComments] = useState<CommentWithReplies[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [replyingTo, setReplyingTo] = useState<string | null>(null);

  // ... fetch logic

  return (
    <div className="command-panel corner-accents">
      {/* Section header with count */}
      <div className="section-header mb-4">
        <MessageSquare className="h-4 w-4 text-amber-500" />
        <h3>Comments ({comments.length})</h3>
      </div>

      {/* Comment list with threading */}
      {isLoading ? (
        <CommentsSkeleton />
      ) : comments.length === 0 ? (
        <div className="text-center py-8 text-slate-400">
          <MessageSquare className="h-8 w-8 mx-auto mb-2 opacity-50" />
          <p>No comments yet</p>
        </div>
      ) : (
        <div className="space-y-4">
          {comments.map(comment => (
            <div key={comment.id}>
              <CommentCard
                comment={comment}
                onReply={() => setReplyingTo(comment.id)}
                // ... other props
              />
              {/* Indented replies with connecting line */}
              {comment.replies.length > 0 && (
                <div className="ml-8 mt-2 border-l-2 border-slate-700 pl-4 space-y-2">
                  {comment.replies.map(reply => (
                    <CommentCard
                      key={reply.id}
                      comment={reply}
                      // No onReply - replies can't have replies
                    />
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Add comment input at bottom */}
      <div className="mt-4 pt-4 border-t border-slate-700">
        <CommentInput
          entityType={entityType}
          entityId={entityId}
          parentId={replyingTo}
          replyingToName={replyingTo ? comments.find(c => c.id === replyingTo)?.author.full_name : undefined}
          onCancel={() => setReplyingTo(null)}
          onSubmit={handleNewComment}
        />
      </div>
    </div>
  );
}
```

### Delete Confirmation Dialog
```tsx
// Source: Existing Dialog component pattern
function DeleteCommentDialog({
  isOpen,
  onClose,
  onConfirm,
  isDeleting
}: DeleteCommentDialogProps) {
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Delete Comment</DialogTitle>
          <DialogDescription>
            Are you sure you want to delete this comment? This action cannot be undone.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={isDeleting}>
            Cancel
          </Button>
          <Button
            variant="destructive"
            onClick={onConfirm}
            disabled={isDeleting}
          >
            {isDeleting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Deleting...
              </>
            ) : (
              'Delete'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
```

### Database Migration
```sql
-- Source: Pattern from 030_file_attachments.sql

-- Create comments table
CREATE TABLE IF NOT EXISTS public.comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Polymorphic entity relationship
  entity_type TEXT NOT NULL CHECK (entity_type IN ('qmrl', 'qmhq', 'po', 'invoice')),
  entity_id UUID NOT NULL,

  -- Threading (single level only)
  parent_id UUID REFERENCES public.comments(id) ON DELETE RESTRICT,

  -- Content
  content TEXT NOT NULL CHECK (char_length(content) > 0),

  -- Ownership
  author_id UUID NOT NULL REFERENCES public.users(id),

  -- Soft delete
  deleted_at TIMESTAMPTZ,
  deleted_by UUID REFERENCES public.users(id),

  -- Audit
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Constraint: replies cannot have replies (enforce single-level)
ALTER TABLE public.comments
ADD CONSTRAINT comments_single_level_reply
CHECK (
  parent_id IS NULL
  OR NOT EXISTS (
    SELECT 1 FROM public.comments p WHERE p.id = parent_id AND p.parent_id IS NOT NULL
  )
);

-- Index for entity lookups (most common query pattern)
CREATE INDEX idx_comments_entity
  ON public.comments(entity_type, entity_id)
  WHERE deleted_at IS NULL;

-- Index for threading queries
CREATE INDEX idx_comments_parent
  ON public.comments(parent_id)
  WHERE deleted_at IS NULL;

-- Function to check if comment has replies
CREATE OR REPLACE FUNCTION public.comment_has_replies(comment_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.comments
    WHERE parent_id = comment_id AND deleted_at IS NULL
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- Enable RLS
ALTER TABLE public.comments ENABLE ROW LEVEL SECURITY;
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Recursive CTE for threads | Single query + frontend grouping | 2024 | Simpler, RLS-compatible |
| Hard delete | Soft delete with deleted_at | Standard | Preserves thread integrity |
| Separate comment tables | Polymorphic entity_type | Standard | One table, reusable RLS |

**Deprecated/outdated:**
- Nested Set Model: Overkill for single-level threading, complex updates
- Materialized path: Unnecessary without deep nesting

## Open Questions

1. **PO and Invoice visibility for Requester role**
   - What we know: Current RLS policies don't give Requester SELECT access to PO or Invoice
   - What's unclear: Should Requesters see comments on PO/Invoice linked to their QMRL chain?
   - Recommendation: Match existing RLS - Requesters don't see PO/Invoice comments. This is consistent with the fact that they can't see those entities anyway.

2. **Audit logging for comments**
   - What we know: Other entities use audit_logs table with triggers
   - What's unclear: Should comment create/delete be logged to audit_logs?
   - Recommendation: Skip for now - comments are lightweight and have their own created_at/deleted_at tracking. Can add audit logging in future if needed.

## Sources

### Primary (HIGH confidence)
- Existing codebase: `/supabase/migrations/030_file_attachments.sql` - Polymorphic RLS pattern
- Existing codebase: `/supabase/migrations/027_rls_policies.sql` - Entity RLS patterns
- Existing codebase: `/app/(dashboard)/qmrl/[id]/page.tsx` - Detail page UI patterns
- Existing codebase: `/components/ui/dialog.tsx`, `/components/ui/tooltip.tsx` - UI components

### Secondary (MEDIUM confidence)
- [Supabase RLS Performance Best Practices](https://supabase.com/docs/guides/troubleshooting/rls-performance-and-best-practices-Z5Jjwv) - Index RLS columns, wrap functions in SELECT
- [GitHub Discussion on Threaded Comments Schema](https://github.com/orgs/community/discussions/167352) - parent_id self-reference pattern

### Tertiary (LOW confidence)
- None - all patterns verified against existing codebase

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - All packages already in project, patterns verified
- Architecture: HIGH - Follows existing file_attachments pattern exactly
- Pitfalls: HIGH - Based on existing RLS implementation experience
- Code examples: HIGH - Derived from actual codebase patterns

**Research date:** 2026-02-07
**Valid until:** 60 days (stable domain, no external dependencies)
