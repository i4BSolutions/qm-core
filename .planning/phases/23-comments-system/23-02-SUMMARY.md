---
phase: 23-comments-system
plan: 02
subsystem: ui-components
tags: [react, components, comments, ui, threading, supabase]

# Dependency Graph
requires:
  - 23-01 (comments table, RLS policies, Comment types)
  - components/ui/dialog.tsx
  - components/ui/button.tsx
  - components/ui/skeleton.tsx
  - components/ui/tooltip.tsx
  - components/ui/textarea.tsx
provides:
  - CommentsSection component (main container with fetch/state)
  - CommentCard component (individual comment display)
  - CommentInput component (add/reply form)
  - DeleteCommentDialog component (delete confirmation)
  - CommentsSkeleton component (loading state)
affects:
  - 23-03 (detail pages will import CommentsSection)

# Tech Stack
tech-stack:
  added:
    - date-fns (format function for absolute timestamps)
  patterns:
    - Threaded comment display with indented replies
    - Optimistic UI updates (add/delete immediately)
    - Card-based comment layout with connecting lines for replies
    - Soft delete with "has replies" protection at UI level

# File Tracking
key-files:
  created:
    - components/comments/index.ts
    - components/comments/comments-section.tsx
    - components/comments/comment-card.tsx
    - components/comments/comment-input.tsx
    - components/comments/delete-comment-dialog.tsx
    - components/comments/comments-skeleton.tsx
  modified:
    - types/database.ts

# Decisions
decisions:
  - id: comments-all-components-in-task-1
    decision: "Implemented all components (display, input, delete) in single task"
    rationale: "Components are tightly coupled - CommentsSection needs CommentInput and DeleteCommentDialog to function. Creating them separately would require placeholder implementations."
    alternatives: "Could have created stubs for Task 1, but would add unnecessary complexity"
    date: 2026-02-07

  - id: comments-optimistic-updates
    decision: "Use optimistic UI updates for add/delete (update local state immediately)"
    rationale: "Provides instant feedback, matches modern UX expectations. No real-time subscriptions needed."
    alternatives: "Re-fetch after every operation (slower), or use Supabase real-time (overkill for this use case)"
    date: 2026-02-07

  - id: comments-toast-notifications
    decision: "Show toast on add/reply/delete success, error toast on failure"
    rationale: "Consistent with existing QM System patterns (PO, Invoice, etc.)"
    alternatives: "Inline error messages (less consistent with codebase)"
    date: 2026-02-07

# Metrics
metrics:
  duration: "3 minutes"
  completed: "2026-02-07"
---

# Phase 23 Plan 02: Comment UI Components Summary

**One-liner:** React components for threaded comment display with card-based layout, inline reply, soft-delete confirmation, and optimistic updates.

## What Was Built

### 1. CommentsSection (Main Container)

**Location:** `components/comments/comments-section.tsx`

**Responsibilities:**
- Fetch comments from Supabase with author info
- Group into parent + replies structure
- Manage state: comments, loading, replyingTo, deleteTarget
- Handle add/reply/delete flows with optimistic updates
- Render section header with total count
- Render empty state, loading skeleton, or comment list

**Key State:**
```typescript
const [comments, setComments] = useState<CommentWithReplies[]>([]);
const [isLoading, setIsLoading] = useState(true);
const [replyingTo, setReplyingTo] = useState<string | null>(null);
const [deleteTarget, setDeleteTarget] = useState<CommentWithAuthor | null>(null);
```

**Fetch Logic:**
```typescript
const { data } = await supabase
  .from("comments")
  .select(`*, author:users!comments_author_id_fkey(id, full_name, avatar_url)`)
  .eq("entity_type", entityType)
  .eq("entity_id", entityId)
  .is("deleted_at", null)
  .order("created_at", { ascending: true });

// Group in frontend: parents first, then nest replies
const grouped = data?.reduce((acc, comment) => {
  if (!comment.parent_id) {
    acc.push({ ...comment, replies: [] });
  } else {
    const parent = acc.find(c => c.id === comment.parent_id);
    if (parent) parent.replies.push(comment);
  }
  return acc;
}, [] as CommentWithReplies[]);
```

**Optimistic Updates:**
- **Add parent comment:** Append to comments array with empty replies
- **Add reply:** Find parent by ID, append to its replies array
- **Delete reply:** Find parent, filter its replies array
- **Delete parent:** Filter comments array (only if no replies)

### 2. CommentCard (Individual Comment Display)

**Location:** `components/comments/comment-card.tsx`

**Layout (per user decision):**
- Card container: `rounded-lg border border-slate-700 bg-slate-800/30 p-4 shadow-soft`
- Avatar: `h-8 w-8 rounded-full bg-amber-500/20 border border-amber-500/30` with User icon
- Author name: `font-medium text-slate-200`
- Timestamp: Absolute format using `date-fns` - `"MMM d, yyyy 'at' h:mm a"` (e.g., "Feb 7, 2026 at 2:30 PM")
- Content: `text-slate-300 whitespace-pre-wrap` (plain text only)
- Actions row with Reply and Delete buttons

**Reply Button (only on parent comments):**
```tsx
{!isReply && onReply && (
  <Button variant="ghost" size="sm" onClick={onReply}>
    <Reply className="h-3 w-3 mr-1" />
    Reply
  </Button>
)}
```

**Delete Button (with tooltip when disabled):**
```tsx
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
      <TooltipContent>Cannot delete: has replies</TooltipContent>
    )}
  </Tooltip>
</TooltipProvider>
```

### 3. CommentInput (Add/Reply Form)

**Location:** `components/comments/comment-input.tsx`

**Features:**
- Textarea with min-height 80px, resize disabled
- "Replying to @name" label with Cancel button when replying
- Submit button disabled when content empty or submitting
- Button text: "Reply" if parentId, "Comment" otherwise
- Toast notifications on success/error

**Submit Logic:**
```typescript
const { data } = await supabase
  .from("comments")
  .insert({
    entity_type: entityType,
    entity_id: entityId,
    parent_id: parentId || null,
    content: content.trim(),
    author_id: userData.user?.id || "",
  })
  .select(`*, author:users!comments_author_id_fkey(id, full_name, avatar_url)`)
  .single();

if (!error) {
  setContent("");
  onSubmit(data); // Optimistic update in parent
  toast({ title: parentId ? "Reply added" : "Comment added" });
  if (onCancel) onCancel(); // Close reply mode
}
```

### 4. DeleteCommentDialog (Confirmation Dialog)

**Location:** `components/comments/delete-comment-dialog.tsx`

**UI:**
- Title: "Delete Comment"
- Description: "Are you sure you want to delete this comment? This action cannot be undone."
- Footer: Cancel (outline) + Delete (destructive) buttons
- Delete button shows Loader2 spinner when isDeleting

**Wired up in CommentsSection:**
```typescript
const handleDeleteConfirm = async () => {
  const { error } = await supabase
    .from("comments")
    .update({
      deleted_at: new Date().toISOString(),
      deleted_by: user.id,
    })
    .eq("id", deleteTarget.id);

  if (!error) {
    // Optimistic update: remove from local state
    if (deleteTarget.parent_id) {
      setComments(prev => prev.map(c => ({
        ...c,
        replies: c.replies.filter(r => r.id !== deleteTarget.id)
      })));
    } else {
      setComments(prev => prev.filter(c => c.id !== deleteTarget.id));
    }
  }
};
```

### 5. CommentsSkeleton (Loading State)

**Location:** `components/comments/comments-skeleton.tsx`

**Layout:**
- 3 skeleton cards
- Each: avatar circle (h-8 w-8), name bar, timestamp bar, content block
- Uses existing Skeleton component from `@/components/ui/skeleton`

### 6. Database Type Addition

**Modified:** `types/database.ts`

Added `comments` table definition to `Database["public"]["Tables"]`:
- Row, Insert, Update interfaces
- Relationships: author_id → users, deleted_by → users, parent_id → comments

## Task Commits

| Task | Description | Commit | Files |
|------|-------------|--------|-------|
| 1-3  | Create all comment components and types | 93a8fcc | components/comments/*, types/database.ts |

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical] Added comments table to Database type**

- **Found during:** Task 1, TypeScript compilation
- **Issue:** Supabase type generation not run after migration, comments table missing from Database type
- **Fix:** Manually added comments table Row/Insert/Update/Relationships to types/database.ts
- **Files modified:** types/database.ts
- **Commit:** 93a8fcc (included in main commit)

**2. [Consolidation] Completed tasks 2-3 in task 1**

- **Rationale:** CommentInput and DeleteCommentDialog are tightly coupled with CommentsSection. Creating stubs would add unnecessary complexity.
- **Result:** Single cohesive commit with all components working together
- **Files created:** All 6 component files in one task
- **Commit:** 93a8fcc

## Technical Implementation Notes

### Threaded Display Pattern

**Parent comments:**
```tsx
{comments.map(comment => (
  <div key={comment.id}>
    <CommentCard comment={comment} />
    {/* Indented replies */}
    {comment.replies.length > 0 && (
      <div className="ml-8 mt-2 border-l-2 border-slate-700 pl-4 space-y-2">
        {comment.replies.map(reply => (
          <CommentCard key={reply.id} comment={reply} isReply={true} />
        ))}
      </div>
    )}
  </div>
))}
```

**Visual structure:**
- Parent comment: full-width card
- Replies: indented 32px (ml-8), left border (border-l-2 border-slate-700), padding-left 16px (pl-4)
- Space between replies: 8px (space-y-2)

### Reply Mode Flow

1. User clicks "Reply" on parent comment
2. `setReplyingTo(comment.id)` in CommentsSection
3. CommentInput receives `parentId={replyingTo}` and `replyingToName={...}`
4. Input shows "Replying to @name" with Cancel button
5. On submit: creates comment with parent_id, calls `onSubmit(newComment)`
6. CommentsSection adds to parent's replies array, calls `onCancel()` to exit reply mode

### Delete Protection

**UI Level (CommentCard):**
- Delete button `disabled={hasReplies}`
- Tooltip: "Cannot delete: has replies"

**Database Level (from 23-01):**
- RLS UPDATE policy checks `NOT comment_has_replies(id)`
- Prevents soft-delete if replies exist

**User can only delete own comments:**
- `canDelete={user?.id === comment.author_id}`
- No admin override (per user decision in CONTEXT.md)

### Timestamp Format

Using `date-fns` format:
```typescript
format(new Date(comment.created_at), "MMM d, yyyy 'at' h:mm a")
// Output: "Feb 7, 2026 at 2:30 PM"
```

Absolute timestamps (not relative like "2 hours ago") per user decision.

## Next Phase Readiness

### For Phase 23-03 (Integration):
- CommentsSection ready to import: `import { CommentsSection } from '@/components/comments'`
- Props: `<CommentsSection entityType="qmrl" entityId={qmrl.id} />`
- Placement: Inline section at bottom of detail page (not in tabs)
- Always visible, not collapsible (per user decision)

### Known Patterns Established:
- Optimistic UI updates for instant feedback
- Toast notifications for user actions
- Card-based comment layout matching existing UI patterns
- Single-level threading (enforced at DB and UI)

## Verification

- TypeScript type-check passes (`npm run type-check`)
- All components properly exported via barrel export (index.ts)
- Comments fetched with author info via Supabase join
- Reply and delete flows fully wired with state management
- Loading skeleton and empty state rendered correctly
- Delete confirmation dialog appears before soft-delete
- Reply mode shows "Replying to @name" with cancel option

## Self-Check: PASSED

Created files:
- components/comments/index.ts ✓
- components/comments/comments-section.tsx ✓
- components/comments/comment-card.tsx ✓
- components/comments/comment-input.tsx ✓
- components/comments/delete-comment-dialog.tsx ✓
- components/comments/comments-skeleton.tsx ✓

Modified files:
- types/database.ts ✓

Commits:
- 93a8fcc ✓
