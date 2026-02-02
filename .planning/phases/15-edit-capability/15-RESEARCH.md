# Phase 15: Edit Capability - Research

**Researched:** 2026-02-02
**Domain:** Next.js App Router navigation, permission-based UI rendering
**Confidence:** HIGH

## Summary

This phase adds Edit buttons to entity detail pages (QMRL, QMHQ, PO) that route to existing edit forms. The implementation is straightforward since edit forms already exist at `[id]/edit` routes. The primary concerns are button placement consistency, permission-based visibility, and state-conditional rendering (PO status).

The standard approach uses Next.js `<Link>` component for navigation to edit routes, with permission checks via the existing `usePermissions()` hook to conditionally render buttons. PO requires additional status-based visibility using the existing `canEditPO()` utility. Invoice detail pages explicitly have no Edit button since void functionality serves as the modification mechanism.

**Primary recommendation:** Use `<Link>` wrapper around `<Button>` with permission-based conditional rendering. Hide buttons completely when unauthorized (not disabled). Apply responsive Tailwind classes for icon-only mobile display.

## Standard Stack

The established libraries/tools for this domain:

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Next.js | 14+ | App Router navigation | Framework requirement, file-based routing with `<Link>` component |
| React | 18+ | Component rendering | Framework requirement for conditional rendering patterns |
| lucide-react | Latest | Icons (Pencil) | Project standard for all icons |
| Tailwind CSS | 3.x | Responsive styling | Project standard for responsive breakpoints (md:) |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| next/navigation | 14+ | `useRouter` hook | Only if programmatic navigation needed (not for this phase) |
| class-variance-authority | Latest | Button variant styling | Already used in Button component |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `<Link>` component | `useRouter().push()` | `<Link>` is recommended by Next.js docs for navigation unless programmatic routing is required |
| Conditional rendering | Disabled button state | Hiding unauthorized buttons provides cleaner UX and avoids "error frustration" |

**Installation:**
```bash
# No new dependencies required - all libraries already in project
```

## Architecture Patterns

### Recommended Button Placement Pattern
```
Detail Page Header Structure:
┌──────────────────────────────────────────────────────────────┐
│  [← Back] [Entity Title/ID]           [Cancel] [Edit]        │
└──────────────────────────────────────────────────────────────┘
     Left side                           Right side (actions)
```

### Pattern 1: Permission-Based Edit Button
**What:** Conditionally render Edit button based on user permissions and entity state
**When to use:** All entity detail pages except Invoice
**Example:**
```typescript
// Source: Existing codebase pattern from QMRL/QMHQ/PO detail pages
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Pencil } from "lucide-react";
import { usePermissions } from "@/lib/hooks/use-permissions";

// In component
const { can } = usePermissions();

// QMRL: Check update permission
{can("update", "qmrl") && (
  <Link href={`/qmrl/${qmrlId}/edit`}>
    <Button variant="outline" className="border-slate-700 hover:bg-slate-800">
      <Pencil className="mr-2 h-4 w-4" />
      <span className="hidden md:inline">Edit</span>
    </Button>
  </Link>
)}

// PO: Check both permission AND status
{can("update", "purchase_orders") && canEditPO(po.status) && (
  <Link href={`/po/${poId}/edit`}>
    <Button variant="outline" className="border-slate-700 hover:bg-slate-800">
      <Pencil className="mr-2 h-4 w-4" />
      <span className="hidden md:inline">Edit</span>
    </Button>
  </Link>
)}
```

### Pattern 2: Responsive Icon/Text Display
**What:** Show icon-only on mobile, icon + text on desktop using Tailwind breakpoints
**When to use:** All buttons in header actions area
**Example:**
```typescript
// Source: Tailwind responsive design docs
// https://tailwindcss.com/docs/responsive-design
<Button variant="outline">
  <Pencil className="h-4 w-4 md:mr-2" />
  <span className="hidden md:inline">Edit</span>
</Button>

// Mobile: [✏️]
// Desktop: [✏️ Edit]
```

### Pattern 3: Status-Conditional Rendering (PO only)
**What:** Hide Edit button when PO status is "closed" or "cancelled"
**When to use:** PO detail page only
**Example:**
```typescript
// Source: /Users/thihaaung/yn/qm-core/lib/utils/po-status.ts
import { canEditPO } from "@/lib/utils/po-status";

// canEditPO implementation:
export function canEditPO(status: POStatusEnum): boolean {
  return status !== "closed" && status !== "cancelled";
}

// In PO detail page:
{can("update", "purchase_orders") && canEditPO(po.status as POStatusEnum) && (
  <Link href={`/po/${poId}/edit`}>
    <Button variant="outline">
      <Pencil className="mr-2 h-4 w-4" />
      Edit
    </Button>
  </Link>
)}
```

### Anti-Patterns to Avoid
- **Disabled Edit button:** Show disabled button when user lacks permission - WRONG. Hide button completely. Disabled buttons frustrate users by suggesting action is possible.
- **Using `useRouter().push()` for navigation:** `<Link>` is the Next.js recommended approach and provides automatic prefetching.
- **Inconsistent button placement:** Edit button MUST be in header right side across all detail pages for consistency.
- **Server-side only permission checks:** Always check permissions client-side (hide button) AND server-side (protect route). Never rely solely on middleware.

## Don't Hand-Roll

Problems that look simple but have existing solutions:

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Permission checking | Custom permission logic | `usePermissions()` hook from `/lib/hooks/use-permissions.ts` | Already implements full RBAC matrix with `can()`, `canAny()`, `canAll()` methods |
| PO status checks | Manual status string comparison | `canEditPO()` from `/lib/utils/po-status.ts` | Centralized logic already exists, returns false for "closed" and "cancelled" |
| Responsive icon/text | Custom media query hooks | Tailwind `hidden md:inline` classes | Tailwind's mobile-first breakpoints handle this declaratively |
| Button styling | Custom button classes | `<Button>` component from `/components/ui/button.tsx` | Pre-configured with variant="outline" and consistent hover states |
| Navigation | `window.location.href` or `useRouter().push()` | `<Link>` component from `next/link` | Automatic prefetching, client-side navigation, framework recommended |

**Key insight:** The codebase already has all necessary utilities. This phase is primarily about composing existing patterns, not building new ones.

## Common Pitfalls

### Pitfall 1: Permission Check Inconsistency
**What goes wrong:** Different permission checks for same entity across different pages
**Why it happens:** Copy-pasting from one entity to another without updating resource name
**How to avoid:**
- QMRL uses `can("update", "qmrl")`
- QMHQ uses `can("update", "qmhq")`
- PO uses `can("update", "purchase_orders")` (note: underscore!)
- Verify resource name matches exactly with permission matrix in `use-permissions.ts`
**Warning signs:** Button shows for wrong users, or never shows for authorized users

### Pitfall 2: Forgetting PO Status Check
**What goes wrong:** Edit button shows on closed/cancelled POs, but edit form may have issues
**Why it happens:** PO is the only entity with state-based edit restrictions (QMRL/QMHQ always editable)
**How to avoid:** Always combine permission check with `canEditPO(po.status)` for PO detail page
**Warning signs:** Users can click Edit on closed POs, potential data integrity issues

### Pitfall 3: Responsive Class Confusion
**What goes wrong:** Using `sm:hidden` instead of `md:hidden`, or wrong class combinations
**Why it happens:** Misunderstanding Tailwind's mobile-first approach - unprefixed utilities affect all sizes
**How to avoid:** Pattern is always `hidden md:inline` (hidden on mobile, visible on desktop 768px+)
**Warning signs:** Text shows on mobile (screen cluttered), or never shows on desktop

### Pitfall 4: Button Inside Link Nesting
**What goes wrong:** Creating invalid HTML with `<button>` inside `<a>` tag
**Why it happens:** Wrapping `<Button>` with `<Link>` creates this structure automatically
**How to avoid:** Current codebase pattern is CORRECT: `<Link><Button>...</Button></Link>`. Button component uses Radix `Slot` to handle this properly. Do NOT use `<Link asChild>` pattern.
**Warning signs:** React warnings about nested interactive elements, accessibility issues

### Pitfall 5: Invoice Edit Button
**What goes wrong:** Adding Edit button to Invoice detail page
**Why it happens:** Copying pattern from other entities without reading requirements
**How to avoid:** Invoice has NO Edit button. Void functionality exists instead. Phase explicitly states "Invoice detail page has no Edit button".
**Warning signs:** Edit button appears on invoice detail page - this is wrong!

## Code Examples

Verified patterns from official sources:

### QMRL Edit Button (Always Available)
```typescript
// Source: Phase requirements + existing permission patterns
"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Pencil } from "lucide-react";
import { usePermissions } from "@/lib/hooks/use-permissions";

export default function QMRLDetailPage() {
  const { can } = usePermissions();
  // ... fetch QMRL data

  return (
    <div className="relative flex items-start justify-between">
      {/* Left: Back button + title */}
      <div className="flex items-start gap-4">
        {/* ... entity info */}
      </div>

      {/* Right: Actions */}
      <div className="flex gap-3">
        {can("update", "qmrl") && (
          <Link href={`/qmrl/${qmrlId}/edit`}>
            <Button
              variant="outline"
              className="border-slate-700 hover:bg-slate-800 hover:border-amber-500/30"
            >
              <Pencil className="h-4 w-4 md:mr-2" />
              <span className="hidden md:inline">Edit</span>
            </Button>
          </Link>
        )}
        {/* Other action buttons */}
      </div>
    </div>
  );
}
```

### QMHQ Edit Button (Always Available)
```typescript
// Source: /Users/thihaaung/yn/qm-core/app/(dashboard)/qmhq/[id]/page.tsx
// Pattern already exists in codebase, needs permission check added

{can("update", "qmhq") && (
  <Link href={`/qmhq/${qmhqId}/edit`}>
    <Button
      variant="outline"
      className="border-slate-700 hover:bg-slate-800 text-slate-300"
    >
      <Edit className="h-4 w-4 md:mr-2" />
      <span className="hidden md:inline">Edit</span>
    </Button>
  </Link>
)}
```

### PO Edit Button (Status-Conditional)
```typescript
// Source: /Users/thihaaung/yn/qm-core/app/(dashboard)/po/[id]/page.tsx
// Pattern already exists, demonstrates correct approach

import { canEditPO } from "@/lib/utils/po-status";
import type { POStatusEnum } from "@/types/database";

// In component:
const showEditButton = canEditPO(po.status as POStatusEnum);

{showEditButton && can("update", "purchase_orders") && (
  <Link href={`/po/${poId}/edit`}>
    <Button
      variant="outline"
      className="border-slate-700 hover:bg-slate-800 text-slate-300"
    >
      <Edit className="h-4 w-4 md:mr-2" />
      <span className="hidden md:inline">Edit</span>
    </Button>
  </Link>
)}
```

### Invoice Detail (NO Edit Button)
```typescript
// Source: Phase requirements
// Invoice detail page should NOT have Edit button
// Void functionality exists as the modification mechanism

export default function InvoiceDetailPage() {
  // ... fetch invoice data

  return (
    <div className="relative flex items-start justify-between">
      {/* Left: Back button + title */}
      <div className="flex items-start gap-4">
        {/* ... entity info */}
      </div>

      {/* Right: Only Void button (if applicable), NO Edit */}
      <div className="flex items-center gap-2">
        {showVoidButton && (
          <Button
            variant="outline"
            onClick={() => setShowVoidDialog(true)}
            className="border-red-500/30 text-red-400 hover:bg-red-500/10"
          >
            <Ban className="mr-2 h-4 w-4" />
            Void
          </Button>
        )}
        {/* NO Edit button here */}
      </div>
    </div>
  );
}
```

### Responsive Button Pattern (Mobile Icon-Only)
```typescript
// Source: Tailwind CSS responsive design docs
// https://tailwindcss.com/docs/responsive-design

// Mobile-first approach: base styles apply to mobile, md: prefix for desktop (768px+)
<Button variant="outline">
  <Pencil className="h-4 w-4 md:mr-2" />
  {/* Always show icon, conditionally add right margin on desktop */}
  <span className="hidden md:inline">Edit</span>
  {/* Hidden on mobile, inline on desktop */}
</Button>

// Result:
// Mobile (<768px): [✏️] (icon only, no text)
// Desktop (≥768px): [✏️ Edit] (icon + text with gap)
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `next/router` (Pages Router) | `next/navigation` (App Router) | Next.js 13+ | App Router uses different imports: `useRouter` from `next/navigation`, not `next/router` |
| Disabled buttons for unauthorized users | Hidden buttons (conditional rendering) | Modern UX pattern (2024+) | Better UX - users don't see actions they can't take |
| Media query hooks for responsive UI | Tailwind responsive classes | Tailwind 3.x standard | Declarative, no JS needed, better performance |
| Client-side only permission checks | Client + server permission validation | Security best practice (2025+) | Defense in depth - hide UI AND protect routes |

**Deprecated/outdated:**
- `useRouter` from `next/router`: In App Router, import from `next/navigation` instead
- Showing disabled buttons for permission denial: Hide buttons completely for cleaner UX
- `sm:` breakpoint for mobile/desktop split: Use `md:` (768px) as primary mobile/desktop breakpoint

## Open Questions

None - all requirements are clear and existing patterns are well-established.

## Sources

### Primary (HIGH confidence)
- Next.js App Router Documentation - [Linking and Navigating](https://nextjs.org/docs/app/getting-started/linking-and-navigating)
- Next.js useRouter API - [Functions: useRouter](https://nextjs.org/docs/app/api-reference/functions/use-router)
- Tailwind CSS Responsive Design - [Core concepts](https://tailwindcss.com/docs/responsive-design)
- Existing codebase patterns:
  - `/Users/thihaaung/yn/qm-core/lib/hooks/use-permissions.ts` - Permission system
  - `/Users/thihaaung/yn/qm-core/lib/utils/po-status.ts` - PO status utilities
  - `/Users/thihaaung/yn/qm-core/app/(dashboard)/po/[id]/page.tsx` - Existing Edit button pattern
  - `/Users/thihaaung/yn/qm-core/app/(dashboard)/qmhq/[id]/page.tsx` - Existing Edit button pattern
  - `/Users/thihaaung/yn/qm-core/app/(dashboard)/qmrl/[id]/page.tsx` - Existing Edit button pattern

### Secondary (MEDIUM confidence)
- [How to conditionally render React UI based on user permissions](https://dev.to/worldlinetech/how-to-conditionally-render-react-ui-based-on-user-permissions-2amg)
- [Implementing Role Based Access Control (RABC) in React](https://www.permit.io/blog/implementing-react-rbac-authorization)
- [Next.js Middleware for Authentication & Authorization](https://www.freecodecamp.org/news/secure-routes-in-next-js/)

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - All libraries already in project, patterns verified in codebase
- Architecture: HIGH - Edit routes exist, permission system exists, PO status utilities exist
- Pitfalls: HIGH - Derived from CONTEXT.md decisions and existing code patterns

**Research date:** 2026-02-02
**Valid until:** 30 days (stable patterns - Next.js App Router and Tailwind are mature)
