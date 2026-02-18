# Phase 58: History Avatars + Comment Avatars - Research

**Researched:** 2026-02-18
**Domain:** React component integration -- adding UserAvatar to existing audit history timeline and comment card components
**Confidence:** HIGH

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| HIST-01 | Each audit history entry shows the user avatar next to the user name who performed the action | UserAvatar component exists at `/components/ui/user-avatar.tsx`; history-tab.tsx HistoryEntry component has `log.changed_by_name` field available for avatar seed; avatar goes inline next to the name text at line 257 |
| HIST-02 | System-generated actions (no user) show a distinct "System" indicator | Audit triggers use `COALESCE(audit_user_name, 'System')` -- when `changed_by` is NULL, `changed_by_name` is set to `'System'`; UI must detect this case and render a system indicator instead of UserAvatar |
| AVTR-02 | User avatar appears next to user name in comment cards | CommentCard already imports and renders `<UserAvatar fullName={comment.author.full_name} size={32} />` at line 36 -- this requirement is ALREADY SATISFIED by the debug fix (AVATAR_NOT_SHOWING.md resolution) |
</phase_requirements>

---

## Summary

Phase 58 is a focused UI integration phase. The core task is adding the existing `UserAvatar` component into the `HistoryEntry` sub-component within `history-tab.tsx`. The comment card (AVTR-02) is already done -- the debug fix in `AVATAR_NOT_SHOWING.md` resolved it by integrating `UserAvatar` into `comment-card.tsx`. So the real work is entirely within the history tab component.

The history tab's `HistoryEntry` component currently renders the acting user's name as plain text at line 257-259 (`log.changed_by_name || "System"`). The change is to add a `UserAvatar` circle next to this name. However, there is a critical branching condition: when `changed_by` is NULL (system-generated entries), the `changed_by_name` field is set to `'System'` by the database trigger via `COALESCE(audit_user_name, 'System')`. The UI must detect this case and render a distinct "System" indicator (a non-avatar visual) instead of passing `"System"` to `UserAvatar`, which would generate a random-looking avatar for the string "System".

The detection logic is straightforward: check `log.changed_by === null` (the UUID column) rather than checking `log.changed_by_name === 'System'` (since a real user could theoretically be named "System"). The `AuditLog` TypeScript interface already includes `changed_by: string | null`, so the null check is type-safe.

**Primary recommendation:** Add UserAvatar to HistoryEntry for user-initiated entries (where `changed_by` is non-null), and render a distinct system icon (lucide-react `Bot` or `Cog`) for system-generated entries (where `changed_by` is null). The comment card integration is already complete and just needs verification.

---

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| boring-avatars | ^2.0.4 | Deterministic SVG avatar generation | Already installed; UserAvatar component wraps it |
| lucide-react | (installed) | Icon library for system indicator | Already used throughout the project including history-tab.tsx |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| UserAvatar component | N/A (project component) | Renders boring-avatars Beam variant | Every place a user's name appears with a non-null `changed_by` |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Checking `changed_by === null` for system detection | Checking `changed_by_name === 'System'` | Name-based check is fragile -- a real user could be named "System"; UUID null check is authoritative |
| lucide-react `Bot` icon for system indicator | Text badge "SYS" or `Cog` icon | Bot icon clearly communicates "automated action"; Cog is ambiguous; text badge has i18n concerns |

**Installation:**
```bash
# No new packages needed -- boring-avatars and lucide-react are already installed
```

---

## Architecture Patterns

### Files to Modify

```
components/
├── history/
│   └── history-tab.tsx    # PRIMARY: Add UserAvatar to HistoryEntry, add system indicator
└── ui/
    └── user-avatar.tsx    # NO CHANGES needed -- component is ready
```

### Pattern 1: Avatar + Name Inline Layout in History Entry

**What:** Replace the plain text user name in HistoryEntry with an avatar circle next to the name.

**When to use:** For every audit log entry where `log.changed_by` is non-null.

**Current code (lines 254-260 of history-tab.tsx):**
```typescript
{/* User and time */}
<div className="mt-1 flex items-center gap-3 text-xs text-slate-400">
  <span className="flex items-center gap-1">
    <span className="font-medium text-slate-300">
      {log.changed_by_name || "System"}
    </span>
  </span>
  ...
</div>
```

**Target code:**
```typescript
import { UserAvatar } from "@/components/ui/user-avatar";

{/* User and time */}
<div className="mt-1 flex items-center gap-3 text-xs text-slate-400">
  <span className="flex items-center gap-1.5">
    {log.changed_by ? (
      <>
        <UserAvatar fullName={log.changed_by_name || "Unknown"} size={20} />
        <span className="font-medium text-slate-300">
          {log.changed_by_name}
        </span>
      </>
    ) : (
      <>
        <Bot className="h-4 w-4 text-slate-500" />
        <span className="font-medium text-slate-500">System</span>
      </>
    )}
  </span>
  ...
</div>
```

### Pattern 2: System Indicator for Automated Actions

**What:** When `log.changed_by` is NULL, render a muted icon + "System" text instead of a user avatar.

**When to use:** Whenever `changed_by` is null -- this happens for:
- Database trigger-generated audit entries where no `auth.uid()` or `created_by`/`updated_by` is available
- Cascade effects (e.g., invoice void cascade creating PO status change entries) -- though these typically do carry the voiding user's ID

**Design rationale:** The system indicator should be visually distinct from user avatars:
- Smaller or same size as user avatars but with muted coloring (slate-500 instead of colorful)
- Uses an icon that communicates "automated" (Bot, Cog, or Server)
- Text says "System" with muted styling to differentiate from user names

### Pattern 3: Avatar Size for History Entries

**What:** Use `size={20}` for history entry avatars -- smaller than the 28px list row default.

**Why 20px:** The history entry user name line uses `text-xs` (12px font). A 28px avatar would be disproportionately large next to 12px text. At 20px, the avatar is approximately 1.67x the text height, which creates a visually balanced inline pairing. This matches the precedent of `size={20}` used in QMRL/QMHQ/PO list page filter dropdowns for user avatars.

**Precedent (from qmrl/page.tsx line 271):**
```typescript
<UserAvatar fullName={u.full_name} size={20} />
```

### Anti-Patterns to Avoid

- **Do not pass "System" string to UserAvatar.** This would generate a boring-avatars face for the word "System", which is misleading -- it looks like a real user. Always branch on `log.changed_by === null` to render the system indicator instead.

- **Do not add data fetching to history-tab.tsx for user avatars.** The `changed_by_name` field is already cached in `audit_logs` by the database trigger. UserAvatar only needs the name string. No additional Supabase queries are needed.

- **Do not modify the AuditLog TypeScript interface.** It already has `changed_by: string | null` and `changed_by_name: string | null` -- both fields needed for the branching logic are present.

- **Do not change comment-card.tsx.** AVTR-02 is already satisfied -- `comment-card.tsx` line 36 already renders `<UserAvatar fullName={comment.author.full_name} size={32} />`.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| User avatar generation | Custom initials/color circles | `UserAvatar` component (boring-avatars) | Already built in Phase 55; deterministic; consistent across pages |
| System action detection | String matching on `changed_by_name` | Null check on `changed_by` UUID | UUID null is authoritative; name string could match a real user |
| User name for audit display | Additional DB query in component | `log.changed_by_name` cached field | Already populated by database trigger; no N+1 risk |

**Key insight:** This phase requires zero new components and zero new data fetching. The UserAvatar component exists, the data (`changed_by_name`) is already in the audit log, and the branching condition (`changed_by` null check) is already in the TypeScript type. It is purely a rendering change in one component.

---

## Common Pitfalls

### Pitfall 1: Passing "System" to UserAvatar Instead of Using System Indicator
**What goes wrong:** A boring-avatars face appears for system-generated entries, making it look like a user named "System" performed the action.
**Why it happens:** Developer replaces the fallback text `{log.changed_by_name || "System"}` with `<UserAvatar fullName={log.changed_by_name || "System"} />` without adding the null check branching.
**How to avoid:** Always branch on `log.changed_by === null` FIRST, before rendering UserAvatar. When null, render a distinct system indicator icon.
**Warning signs:** A colorful avatar circle appears with "System" text on audit entries like "PO status recalculated due to void" or automatic status transitions.

### Pitfall 2: Avatar Size Mismatch with History Timeline Layout
**What goes wrong:** The avatar is too large (28px or 32px) for the `text-xs` user line in history entries, causing visual imbalance or pushing the timeline layout.
**Why it happens:** Using the default `size={28}` or comment card `size={32}` without considering that history entry user names use very small text.
**How to avoid:** Use `size={20}` for history entries, matching the precedent in list page filter dropdowns.
**Warning signs:** The avatar circle is noticeably taller than the text beside it, or the history entry rows have uneven spacing.

### Pitfall 3: Forgetting the "use client" Boundary
**What goes wrong:** Build error if history-tab.tsx somehow loses its `"use client"` directive.
**Why it happens:** Unlikely in this case since history-tab.tsx is already a client component, but worth noting.
**How to avoid:** Verify `"use client"` is at top of history-tab.tsx (it already is at line 1).
**Warning signs:** Build error about `document is not defined` or hydration mismatch.

### Pitfall 4: Not Handling null changed_by_name for Real Users
**What goes wrong:** Avatar renders but name shows as empty or "null" when `changed_by` is non-null but `changed_by_name` was not populated (edge case from old data).
**Why it happens:** Very early audit entries might have `changed_by` set but `changed_by_name` null if the trigger version at the time did not cache the name.
**How to avoid:** Use `log.changed_by_name || "Unknown"` as the fallback for UserAvatar's `fullName` prop when `changed_by` is non-null. This ensures boring-avatars always gets a non-empty string.
**Warning signs:** An avatar renders but the name text beside it is blank.

---

## Code Examples

Verified patterns from the codebase:

### Current HistoryEntry User Display (history-tab.tsx lines 254-265)
```typescript
// Source: /home/yaungni/qm-core/components/history/history-tab.tsx
{/* User and time */}
<div className="mt-1 flex items-center gap-3 text-xs text-slate-400">
  <span className="flex items-center gap-1">
    <span className="font-medium text-slate-300">
      {log.changed_by_name || "System"}
    </span>
  </span>
  <span className="flex items-center gap-1" title={formatFullTime(log.changed_at)}>
    <Clock className="h-3 w-3" />
    {formatRelativeTime(log.changed_at)}
  </span>
</div>
```

### Target HistoryEntry User Display (with avatar)
```typescript
// New import at top of file
import { UserAvatar } from "@/components/ui/user-avatar";
// Add Bot to existing lucide-react imports
import { Bot, /* ...existing imports... */ } from "lucide-react";

{/* User and time */}
<div className="mt-1 flex items-center gap-3 text-xs text-slate-400">
  <span className="flex items-center gap-1.5">
    {log.changed_by ? (
      <>
        <UserAvatar fullName={log.changed_by_name || "Unknown"} size={20} />
        <span className="font-medium text-slate-300">
          {log.changed_by_name}
        </span>
      </>
    ) : (
      <>
        <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-slate-700">
          <Bot className="h-3 w-3 text-slate-400" />
        </span>
        <span className="font-medium text-slate-500">System</span>
      </>
    )}
  </span>
  <span className="flex items-center gap-1" title={formatFullTime(log.changed_at)}>
    <Clock className="h-3 w-3" />
    {formatRelativeTime(log.changed_at)}
  </span>
</div>
```

### Existing CommentCard Avatar (already done -- AVTR-02)
```typescript
// Source: /home/yaungni/qm-core/components/comments/comment-card.tsx line 36
<UserAvatar fullName={comment.author.full_name} size={32} />
```

### System Detection Logic
```typescript
// The AuditLog interface already supports this:
// changed_by: string | null;      -- UUID, null for system
// changed_by_name: string | null;  -- Cached name, 'System' for system entries

// Detection: use changed_by (UUID), not changed_by_name (string)
const isSystemAction = log.changed_by === null;
```

### Existing UserAvatar Size Precedents in Codebase
```typescript
// size={20}  -- filter dropdowns (qmrl/page.tsx:271, qmhq/page.tsx:289, po/page.tsx:306)
// size={28}  -- default, list row inline (user-avatar.tsx default)
// size={32}  -- comment cards (comment-card.tsx:36), detail page panels (qmrl/[id]:431)
// size={36}  -- header profile button (header.tsx:107)
// size={40}  -- header dropdown profile (header.tsx:142), qmhq detail panel (qmhq/[id]:846)
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Plain text `changed_by_name` in history entries | UserAvatar circle + name text inline | Phase 58 (this phase) | Visual consistency with list views and comment cards |
| Generic lucide `User` icon in comment cards | UserAvatar (boring-avatars beam) | Phase 55 debug fix (2026-02-17) | AVTR-02 already satisfied |

**Already completed (no action needed):**
- `comment-card.tsx` already uses `UserAvatar` at size 32 (resolved in AVATAR_NOT_SHOWING debug fix)
- `comments-section.tsx` passes `comment.author.full_name` through `CommentWithAuthor` type -- no changes needed

---

## Open Questions

1. **System indicator icon choice**
   - What we know: lucide-react is already imported in history-tab.tsx; `Bot`, `Cog`, `Server`, `Zap` are available
   - What's unclear: Which icon best communicates "system-generated action" to users
   - Recommendation: Use `Bot` icon -- it is the most universally recognized indicator for automated/system actions. Wrap it in a 20px slate-700 circle to match the avatar size. If `Bot` feels too playful, `Cog` is a safe alternative.

2. **History skeleton loader update**
   - What we know: `HistoryEntrySkeleton` currently renders a 9x9 circle skeleton on the left (the action icon area) plus text bars. It does not include a skeleton for the user avatar.
   - What's unclear: Whether the skeleton should be updated to include a small avatar circle in the user/time line area.
   - Recommendation: The skeleton is a low-priority enhancement. The user line is small (`text-xs`) and the avatar is only 20px -- adding a skeleton circle there would be barely visible. Keep the existing skeleton as-is.

---

## Sources

### Primary (HIGH confidence)
- `/home/yaungni/qm-core/components/history/history-tab.tsx` -- Full current implementation of HistoryEntry component, verified line-by-line
- `/home/yaungni/qm-core/components/ui/user-avatar.tsx` -- UserAvatar component API: `fullName: string`, `size?: number`, `className?: string`
- `/home/yaungni/qm-core/components/comments/comment-card.tsx` -- Already has UserAvatar integrated at line 36 (size 32)
- `/home/yaungni/qm-core/types/database.ts` lines 2333-2348 -- AuditLog interface with `changed_by: string | null` and `changed_by_name: string | null`
- `/home/yaungni/qm-core/supabase/migrations/048_status_update_with_note.sql` line 151 -- `COALESCE(audit_user_name, 'System')` confirms system entries set `changed_by_name` to 'System'
- `/home/yaungni/qm-core/supabase/migrations/025_audit_logs.sql` line 50-51 -- `changed_by UUID ... ON DELETE SET NULL` and `changed_by_name TEXT` column definitions
- `/home/yaungni/qm-core/.planning/debug/resolved/AVATAR_NOT_SHOWING.md` -- Confirms comment-card.tsx already has UserAvatar (AVTR-02 resolved)
- `/home/yaungni/qm-core/.planning/phases/55-database-foundation-useravatar/55-CONTEXT.md` -- Prior decisions on UserAvatar design (Beam variant, default palette, data-passive)

### Secondary (MEDIUM confidence)
- None needed -- all findings from direct codebase inspection

### Tertiary (LOW confidence)
- None

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- all libraries already installed and verified in codebase
- Architecture: HIGH -- single file modification with clear before/after code; pattern matches existing codebase precedents
- Pitfalls: HIGH -- all pitfalls identified from actual codebase patterns and data flow analysis

**Research date:** 2026-02-18
**Valid until:** 2026-03-18 (stable -- no external dependencies, all patterns are project-internal)
