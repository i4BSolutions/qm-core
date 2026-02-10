# Phase 31: Context Sliders - Research

**Researched:** 2026-02-10
**Domain:** React/Next.js side panel UI patterns, responsive layout architecture
**Confidence:** HIGH

## Summary

Context sliders for QMHQ create and stock-out request pages can be implemented with **ZERO new dependencies**. The existing QM System codebase already contains a proven, production-ready pattern in `QmrlContextPanel` (640 lines) that implements all required behaviors:

- Push-content layout via CSS Grid
- Responsive mobile/desktop patterns
- Toggle state management
- Tab-based organization
- Smooth animations via Tailwind CSS

The existing implementation uses Radix UI Tabs (already installed), Tailwind transitions, and standard React state management. No additional libraries (Sheet components, animation libraries, or state management tools) are needed.

**Primary recommendation:** Extract and generalize the `QmrlContextPanel` pattern into a reusable `ContextSlider` component. Retire the old panel. Build fresh implementations for stock-out pages using the proven pattern.

---

## User Constraints

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Slider content:**
- Full detail view for both QMRL and QMHQ — not summarized, show all fields
- Slider uses tabs for sub-sections (QMHQ lines, attachments, comments) — mini detail page feel
- QMHQ create slider shows QMRL data + sibling QMHQ lines (simple list: line name, route type, status badge)
- QMRL tab shows QMHQ lines count badge at the bottom
- Sibling QMHQ lines are view-only — no navigation links, keeps focus on create form

**Context chain depth:**
- Stock-out request create page shows both QMRL and QMHQ in tabs (QMRL | QMHQ)
- Slider only appears when stock-out request originates from QMHQ item route — manual requests have no slider
- QMHQ create page shows QMRL detail + sibling QMHQ list

**Slider interaction:**
- Push content layout — main form shrinks to make room, both visible simultaneously, no overlap
- Toggle via icon button in page header
- Default open on desktop each time page loads (no persistent state across navigations)
- Open by default on desktop, closed on mobile, toggleable

### Claude's Discretion

- Slider width (likely fixed ~400px or responsive percentage — pick based on content)
- Animation/transition style
- Mobile experience (bottom sheet vs overlay vs slide-from-right)
- Exact tab organization within slider content

### Deferred Ideas (OUT OF SCOPE)

- Stock-out approval page slider — not in this phase
- Stock-out execution page slider — not in this phase
- Clickable sibling QMHQ navigation — view-only for now
</user_constraints>

---

## Standard Stack

### Core Components (Already Installed)

| Component | Current Version | Purpose | Why Standard |
|-----------|----------------|---------|--------------|
| Radix UI Tabs | @radix-ui/react-tabs | Tab organization within slider | Already used for tabs throughout app, proven pattern |
| Radix UI Dialog | @radix-ui/react-dialog | Base primitive for overlays | Used for modals, can inform slider patterns |
| Tailwind CSS | 3.4.13 | Animations, transitions, responsive utilities | Project standard, handles all styling |
| Next.js Server Components | 14.2.13 | Data fetching for slider content | App Router pattern, fetch data in parent, pass props |
| React useState | 18.3.1 | Toggle state management | Standard pattern, no external state library needed |

### Supporting Utilities

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| lucide-react | 0.447.0 | Icons for slider headers, tabs | All UI icons |
| clsx/cn utility | N/A | Conditional Tailwind classes | Dynamic styling based on open/closed state |
| Supabase client | 2.50.0 | Fetch slider data | Data for QMRL, QMHQ, sibling lines |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Custom slider pattern | shadcn/ui Sheet component | **Don't use:** Sheet doesn't exist in current Radix UI version, would need to install Vaul dependency. Existing pattern is simpler and proven. |
| Tailwind transitions | Framer Motion | **Don't use:** Overkill for simple slide animation. Tailwind transitions are smooth enough, existing panel proves this. |
| Local state | Zustand/Redux | **Don't use:** Toggle state is component-local, no global state needed. React useState sufficient. |

**Installation:**

None required. All dependencies already installed.

---

## Architecture Patterns

### Pattern 1: Existing QmrlContextPanel (Production Pattern)

**What:** 640-line component implementing right-side context panel for QMHQ create page

**When to use:** This is the proven pattern to extract and generalize

**Existing Implementation Analysis:**

```typescript
// File: components/qmhq/qmrl-context-panel.tsx
// Lines: 640
// Status: Production-ready, proven in QMHQ workflow

// State management - default open on desktop
const [isPanelOpen, setIsPanelOpen] = useState(() => {
  if (typeof window !== 'undefined') {
    return window.innerWidth >= 768; // Open on desktop, closed on mobile
  }
  return true;
});

// Layout structure - push content via CSS Grid
// Parent container (in app/(dashboard)/qmhq/new/page.tsx line 299):
<div className="md:grid md:grid-cols-[1fr_320px] lg:grid-cols-[1fr_384px] gap-6">
  {/* Form content - left side */}
  <div className="space-y-8">{/* Form sections */}</div>

  {/* Context panel - right side */}
  <QmrlContextPanel qmrlId={qmrlId} isOpen={isPanelOpen} onToggle={onToggle} />
</div>

// Panel styling - responsive behavior
<div className={cn(
  // Desktop: visible in grid, relative positioning
  'md:block md:relative md:translate-x-0',

  // Mobile: fixed slide-in from right
  'fixed inset-y-0 right-0 z-50',
  'w-80 md:w-80 lg:w-96',

  // Smooth animation
  'transform transition-transform duration-300 ease-in-out',
  isOpen ? 'translate-x-0' : 'translate-x-full md:translate-x-0',

  // Styling
  'border-l border-slate-700 bg-slate-900',
  'overflow-hidden flex flex-col'
)}>
```

**Key Features Implemented:**
- ✓ Mobile backdrop with blur (`bg-black/60 backdrop-blur-sm`)
- ✓ Floating toggle button on mobile (bottom-right corner)
- ✓ Close button (mobile only, hidden on desktop)
- ✓ Body scroll lock on mobile (prevents background scrolling)
- ✓ Collapsible sections (description/notes with "Show more/less")
- ✓ Responsive width (320px mobile, 384px desktop)
- ✓ Sticky header with title and icon
- ✓ Scrollable content area

### Pattern 2: Push Content Layout via CSS Grid

**What:** Main form and sidebar both visible, form shrinks to make room (no overlay)

**Implementation:**

```typescript
// Parent container uses CSS Grid
<div className="md:grid md:grid-cols-[1fr_320px] lg:grid-cols-[1fr_384px] gap-6">
  {/* Column 1: Main form - takes remaining space (1fr) */}
  <div className="space-y-8">
    {/* Form content */}
  </div>

  {/* Column 2: Context slider - fixed width (320px / 384px) */}
  <ContextSlider isOpen={isPanelOpen} onToggle={() => setIsPanelOpen(prev => !prev)}>
    {/* Slider content */}
  </ContextSlider>
</div>
```

**Why this pattern:**
- Form and context visible simultaneously (user requirement)
- Form shrinks smoothly when slider opens (push, not overlay)
- Responsive: grid on desktop (md:+), stacked on mobile
- Gap creates natural spacing (6 units = 24px)

**Source:** [CSS Grid Layout Guide](https://css-tricks.com/snippets/css/complete-guide-grid/) - `grid-template-columns: 1fr 300px` pattern for main + fixed sidebar

### Pattern 3: Mobile Slide-In Drawer

**What:** On mobile (<768px), slider becomes fixed overlay that slides from right

**Implementation:**

```typescript
// Panel classes - responsive positioning
const panelClasses = cn(
  // Desktop: static in grid
  'md:block md:relative md:translate-x-0',

  // Mobile: fixed positioned, slides from right
  'fixed inset-y-0 right-0 z-50',
  'transform transition-transform duration-300 ease-in-out',
  isOpen ? 'translate-x-0' : 'translate-x-full md:translate-x-0'
);

// Mobile backdrop - only visible on mobile when open
{isOpen && (
  <div
    onClick={onToggle}
    className="md:hidden fixed inset-0 z-40 bg-black/60 backdrop-blur-sm"
  />
)}

// Floating toggle button - only visible on mobile when closed
{!isOpen && (
  <button
    onClick={onToggle}
    className="md:hidden fixed bottom-4 right-4 z-40 rounded-full bg-gradient-to-r from-amber-600 to-amber-500 px-4 py-3"
  >
    <FileText className="h-5 w-5 text-white" />
    <span className="text-sm font-medium text-white">Context</span>
  </button>
)}
```

**Mobile UX features:**
- Backdrop dims and blurs background (focus on slider)
- Tapping backdrop closes slider
- Body scroll locked when open (prevents double-scroll)
- Floating button shows when closed (easy to reopen)

**Source:** [Responsive Next.js Templates](https://dev.to/hitesh_developer/designing-with-flexibility-responsive-nextjs-templates-for-any-device-3183) - Mobile drawer patterns

### Pattern 4: Tabs for Slider Content Organization

**What:** Use Radix UI Tabs to organize slider content (QMRL details, QMHQ lines, attachments)

**Implementation:**

```typescript
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';

// Inside slider content
<Tabs defaultValue="qmrl" className="w-full">
  <TabsList className="grid w-full grid-cols-2">
    <TabsTrigger value="qmrl">
      QMRL
      {qmhqLinesCount > 0 && (
        <Badge variant="outline" className="ml-2">{qmhqLinesCount}</Badge>
      )}
    </TabsTrigger>
    <TabsTrigger value="qmhq">QMHQ Lines</TabsTrigger>
  </TabsList>

  <TabsContent value="qmrl" className="space-y-4">
    {/* QMRL details sections */}
  </TabsContent>

  <TabsContent value="qmhq" className="space-y-4">
    {/* Sibling QMHQ list */}
  </TabsContent>
</Tabs>
```

**Why tabs:**
- Organizes dense information into logical sections
- User can focus on relevant context (QMRL vs QMHQ lines)
- Existing Radix UI Tabs component (`/components/ui/tabs.tsx`)
- Consistent with app patterns (already used in detail pages)

**Stock-out page tab structure:**
```typescript
// Stock-out request create page (when linked to QMHQ)
<TabsList className="grid w-full grid-cols-2">
  <TabsTrigger value="qmrl">QMRL</TabsTrigger>
  <TabsTrigger value="qmhq">QMHQ</TabsTrigger>
</TabsList>
```

### Pattern 5: Data Fetching - Avoid N+1 Queries

**What:** Fetch slider data in parent Server Component, pass as props to client slider

**Why:** Slider toggle requires client component (`'use client'`), but data fetching should happen on server to avoid waterfalls

**Implementation:**

```typescript
// BAD: Client component fetches own data (N+1 queries)
'use client';
export function ContextSlider({ qmrlId }) {
  const [qmrl, setQmrl] = useState(null);

  useEffect(() => {
    // This creates waterfall: page loads, THEN slider fetches
    fetchQmrl(qmrlId).then(setQmrl);
  }, [qmrlId]);
  // ...
}

// GOOD: Server Component fetches, passes data
// app/(dashboard)/qmhq/new/page.tsx
export default async function QmhqNewPage({ searchParams }) {
  const qmrlId = searchParams.qmrl;

  // Fetch on server
  const supabase = createServerClient();
  const { data: qmrlData } = await supabase
    .from('qmrl')
    .select(`
      *,
      status:status_config(*),
      category:categories(*),
      qmhq_lines:qmhq(id, request_id, line_name, route_type)
    `)
    .eq('id', qmrlId)
    .single();

  return (
    <div className="md:grid md:grid-cols-[1fr_384px] gap-6">
      <QmhqForm />
      <QmrlContextSliderClient qmrlData={qmrlData} />
    </div>
  );
}

// Client component receives data as props
'use client';
export function QmrlContextSliderClient({ qmrlData }) {
  const [isOpen, setIsOpen] = useState(true);

  return (
    <ContextSlider isOpen={isOpen} onToggle={() => setIsOpen(!isOpen)}>
      {/* Render qmrlData - no additional fetching */}
    </ContextSlider>
  );
}
```

**Benefits:**
- Single database query (no waterfall)
- Data available immediately on page load
- Client component handles only interaction (toggle state)
- Follows Next.js 14 Server Components pattern

**Source:** [Next.js Server and Client Components](https://nextjs.org/docs/app/getting-started/server-and-client-components) - Data fetching patterns

### Pattern 6: Controlled State with Radix UI Dialog Primitives

**What:** Use `open` and `onOpenChange` props for programmatic control

**Note:** While the existing pattern uses custom CSS for slide animation, understanding Radix Dialog's controlled state pattern is valuable for future component work.

**Implementation:**

```typescript
// Radix Dialog pattern (for reference)
const [open, setOpen] = React.useState(false);

<Dialog.Root open={open} onOpenChange={setOpen}>
  <Dialog.Trigger>Open</Dialog.Trigger>
  <Dialog.Content>{/* Content */}</Dialog.Content>
</Dialog.Root>

// Apply to slider (similar pattern)
interface ContextSliderProps {
  isOpen: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}

export function ContextSlider({ isOpen, onToggle, children }: ContextSliderProps) {
  // Parent controls state, slider is "controlled component"
  return (
    <>
      {/* Backdrop */}
      {isOpen && <div onClick={onToggle} className="backdrop" />}

      {/* Slider panel */}
      <div className={cn('slider', isOpen && 'open')}>
        {children}
      </div>
    </>
  );
}
```

**Why controlled pattern:**
- Parent page owns toggle state
- Multiple triggers can control same slider (button in header, floating button, backdrop click)
- Easier to coordinate with form state (close on submit)

**Source:** [Radix UI Dialog Controlled State](https://www.radix-ui.com/primitives/docs/components/dialog) - `open` and `onOpenChange` API

### Anti-Patterns to Avoid

- **Don't use sessionStorage for slider state:** Existing pattern intentionally resets per page load. Users expect consistent behavior (open on desktop, closed on mobile).
- **Don't fetch slider data in client component:** Creates waterfall. Fetch in Server Component parent, pass as props.
- **Don't use overlay on desktop:** User requirement is push-content layout. Form and slider both visible.
- **Don't add external animation library:** Tailwind transitions (`transition-transform duration-300`) are smooth enough. Existing panel proves this.
- **Don't make sibling QMHQ lines clickable:** User requirement is view-only to maintain focus on create form.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Responsive slide-in panel | Custom implementation from scratch | Extract from `QmrlContextPanel` | 640 lines of battle-tested code already solve this problem, including edge cases (body scroll lock, backdrop, mobile toggle) |
| Tab organization | Custom tab switcher | Radix UI Tabs (`@radix-ui/react-tabs`) | Already installed, accessible, keyboard navigation built-in |
| Smooth animations | JavaScript animation loop | Tailwind transitions (`transition-transform duration-300`) | GPU-accelerated, performant, existing panel proves sufficiency |
| Scroll management | Custom scroll locking | `document.body.style.overflow = 'hidden'` pattern | Simple, works across browsers, existing implementation proven |
| Backdrop blur | CSS filter workarounds | Tailwind `backdrop-blur-sm` utility | Native backdrop-filter support, optimized |

**Key insight:** The QM System codebase already contains a production-ready context slider pattern. Attempting to build from scratch would duplicate 640 lines of proven code and introduce new bugs. Extract and generalize the existing pattern.

---

## Common Pitfalls

### Pitfall 1: N+1 Query Waterfall

**What goes wrong:** Client component fetches slider data in `useEffect`, creating waterfall (page loads, slider renders, THEN data fetches)

**Why it happens:** Slider needs `'use client'` for toggle state, developers assume client component should fetch its own data

**How to avoid:** Fetch in parent Server Component, pass data as props to client slider component

**Warning signs:**
- Spinner shows in slider after page loaded
- Slow perceived performance on fast connections
- Multiple Supabase queries visible in Network tab

**Example:**

```typescript
// WRONG: Client component fetches data
'use client';
export function QmrlContextSlider({ qmrlId }) {
  const [qmrl, setQmrl] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Waterfall: page → slider → fetch
    fetchQmrl(qmrlId).then(data => {
      setQmrl(data);
      setLoading(false);
    });
  }, [qmrlId]);

  if (loading) return <Spinner />; // Bad UX
  return <div>{qmrl.title}</div>;
}

// RIGHT: Server Component fetches, client handles interaction
// page.tsx (Server Component)
export default async function Page({ searchParams }) {
  const qmrlData = await fetchQmrl(searchParams.qmrl); // Fetched on server

  return <QmrlContextSliderClient qmrlData={qmrlData} />;
}

// slider-client.tsx (Client Component)
'use client';
export function QmrlContextSliderClient({ qmrlData }) {
  const [isOpen, setIsOpen] = useState(true);

  // Data already available, no loading state
  return (
    <ContextSlider isOpen={isOpen} onToggle={() => setIsOpen(!isOpen)}>
      <div>{qmrlData.title}</div>
    </ContextSlider>
  );
}
```

**Source:** [React Server Components + TanStack Query 2026](https://dev.to/krish_kakadiya_5f0eaf6342/react-server-components-tanstack-query-the-2026-data-fetching-power-duo-you-cant-ignore-21fj) - Eliminating waterfalls

### Pitfall 2: Body Scroll Not Locked on Mobile

**What goes wrong:** When slider is open on mobile, user can scroll background content behind the slider, creating confusing UX

**Why it happens:** Forgot to lock body scroll, or only applied to slider container (not body element)

**How to avoid:** Use `useEffect` to set `document.body.style.overflow = 'hidden'` when slider open on mobile

**Warning signs:**
- Can scroll page content while slider is open on mobile
- Slider content and page content both scroll simultaneously
- Backdrop is visible but page still scrollable

**Example:**

```typescript
// WRONG: Only slider scrolls, body not locked
<div className="fixed inset-y-0 right-0 overflow-y-auto">
  {/* Slider content - scrollable */}
</div>
// User can still scroll background page!

// RIGHT: Lock body scroll on mobile when open
useEffect(() => {
  if (isOpen && typeof window !== 'undefined' && window.innerWidth < 768) {
    document.body.style.overflow = 'hidden';
  } else {
    document.body.style.overflow = 'auto';
  }

  // Cleanup on unmount
  return () => {
    document.body.style.overflow = 'auto';
  };
}, [isOpen]);
```

**Source:** Existing implementation in `QmrlContextPanel` lines 213-222

### Pitfall 3: Slider Width Inconsistency Across Breakpoints

**What goes wrong:** Slider is too narrow on desktop (content cramped) or too wide on mobile (obscures form)

**Why it happens:** Using responsive width (w-1/3, w-1/2) instead of fixed width with responsive adjustments

**How to avoid:** Use fixed widths with breakpoint overrides: `w-80 md:w-80 lg:w-96` (320px mobile, 384px desktop)

**Warning signs:**
- Slider content wraps awkwardly at certain screen widths
- Slider takes up too much screen on tablets
- Grid layout breaks at medium breakpoints

**Example:**

```typescript
// WRONG: Percentage width (inconsistent)
<div className="w-1/3 lg:w-1/4">
  {/* Content cramped on small screens, too wide on large */}
</div>

// RIGHT: Fixed width with breakpoints
<div className="w-80 md:w-80 lg:w-96">
  {/* 320px mobile/tablet, 384px desktop+ */}
</div>

// Grid layout matches slider width
<div className="md:grid md:grid-cols-[1fr_320px] lg:grid-cols-[1fr_384px] gap-6">
  {/* Form takes remaining space (1fr) */}
  <div className="space-y-8">{/* Form */}</div>

  {/* Slider fixed width matches above */}
  <div className="w-80 lg:w-96">{/* Slider */}</div>
</div>
```

**Recommended widths (from existing pattern):**
- Mobile: `w-80` (320px) - leaves room for backdrop edge
- Desktop: `lg:w-96` (384px) - comfortable reading width
- Grid columns: `[1fr_320px]` mobile, `[1fr_384px]` desktop

### Pitfall 4: Toggle Button Hidden on Desktop

**What goes wrong:** User can't close slider on desktop, or toggle button overlaps content

**Why it happens:** Applied wrong responsive classes or forgot to provide close mechanism on desktop

**How to avoid:** Toggle button in page header (always visible), floating button on mobile only (`md:hidden`)

**Warning signs:**
- No way to close slider on desktop without refreshing
- Toggle button shows on desktop and blocks content
- User confused about how to open/close slider

**Example:**

```typescript
// WRONG: Floating button shows on desktop
<button className="fixed bottom-4 right-4 z-50">
  {/* This overlaps content on desktop! */}
</button>

// RIGHT: Floating button mobile only, header button desktop
// Header (always visible)
<div className="flex items-center gap-4">
  <h1>Create QMHQ</h1>
  <button onClick={onToggle} className="md:inline-flex">
    {isOpen ? <ChevronRight /> : <ChevronLeft />}
    <span className="sr-only">Toggle context</span>
  </button>
</div>

// Floating button (mobile only, when closed)
{!isOpen && (
  <button
    onClick={onToggle}
    className="md:hidden fixed bottom-4 right-4 z-40"
  >
    <FileText className="h-5 w-5" />
    <span>Context</span>
  </button>
)}
```

**Source:** Existing implementation in `QmrlContextPanel` lines 298-315

### Pitfall 5: State Persistence Confusion

**What goes wrong:** Slider state saved in sessionStorage/localStorage causes confusion when user expects consistent behavior

**Why it happens:** Developer assumes users want state persisted across navigations

**How to avoid:** DO NOT persist slider state. Reset per page load (open on desktop, closed on mobile). User requirement is consistent default.

**Warning signs:**
- Slider opens on mobile unexpectedly (user closed it last time on desktop)
- State conflicts between different forms (QMHQ new vs stock-out new)
- User can't predict whether slider will be open or closed

**Example:**

```typescript
// WRONG: Persist state across navigations
const [isOpen, setIsOpen] = useState(() => {
  const saved = sessionStorage.getItem('slider-open');
  return saved ? JSON.parse(saved) : true;
});

useEffect(() => {
  sessionStorage.setItem('slider-open', JSON.stringify(isOpen));
}, [isOpen]);
// User confused: behavior inconsistent across pages

// RIGHT: Consistent default per device type
const [isOpen, setIsOpen] = useState(() => {
  if (typeof window !== 'undefined') {
    return window.innerWidth >= 768; // Desktop: open, Mobile: closed
  }
  return true;
});
// No persistence - resets per page load
// User knows what to expect: desktop = open, mobile = closed
```

**Rationale:** User requirement states "default open on desktop each time page loads (no persistent state across navigations)". Existing QMHQ pattern follows this (lines 76-82 in `QmrlContextPanel`).

---

## Code Examples

Verified patterns from existing codebase:

### Push Content Grid Layout

```typescript
// Source: app/(dashboard)/qmhq/new/page.tsx (line 299)

<div className="md:grid md:grid-cols-[1fr_320px] lg:grid-cols-[1fr_384px] gap-6">
  {/* Form Section - takes remaining space */}
  <div className="space-y-8">
    {/* Form fields */}
  </div>

  {/* QMRL Context Panel - fixed width */}
  <QmrlContextPanel
    qmrlId={formData.qmrl_id || null}
    isOpen={isPanelOpen}
    onToggle={() => setIsPanelOpen(prev => !prev)}
  />
</div>
```

### Responsive Slider Container

```typescript
// Source: components/qmhq/qmrl-context-panel.tsx (lines 326-340)

<div
  className={cn(
    // Desktop: visible in grid, sticky position
    'md:block md:relative md:translate-x-0',

    // Mobile: fixed slide-in drawer
    'fixed inset-y-0 right-0 z-50',
    'w-80 md:w-80 lg:w-96',

    // Smooth animation
    'transform transition-transform duration-300 ease-in-out',
    isOpen ? 'translate-x-0' : 'translate-x-full md:translate-x-0',

    // Styling
    'border-l border-slate-700 bg-slate-900',
    'overflow-hidden flex flex-col'
  )}
>
  {/* Panel content */}
</div>
```

### Mobile Backdrop and Toggle Button

```typescript
// Source: components/qmhq/qmrl-context-panel.tsx (lines 297-324)

{/* Mobile Toggle Button - shown when panel is closed */}
{!isOpen && (
  <button
    onClick={onToggle}
    className={cn(
      'md:hidden fixed bottom-4 right-4 z-40',
      'flex items-center gap-2 rounded-full',
      'bg-gradient-to-r from-amber-600 to-amber-500',
      'px-4 py-3 shadow-lg',
      'hover:from-amber-500 hover:to-amber-400',
      'transition-all duration-200',
      'animate-fade-in'
    )}
    aria-label="Show QMRL context"
  >
    <FileText className="h-5 w-5 text-white" />
    <span className="text-sm font-medium text-white">Context</span>
  </button>
)}

{/* Mobile Backdrop */}
{isOpen && (
  <div
    onClick={onToggle}
    className="md:hidden fixed inset-0 z-40 bg-black/60 backdrop-blur-sm"
    aria-hidden="true"
  />
)}
```

### Body Scroll Lock

```typescript
// Source: components/qmhq/qmrl-context-panel.tsx (lines 213-222)

useEffect(() => {
  if (isOpen && typeof window !== 'undefined' && window.innerWidth < 768) {
    document.body.style.overflow = 'hidden';
  } else {
    document.body.style.overflow = 'auto';
  }

  return () => {
    document.body.style.overflow = 'auto';
  };
}, [isOpen]);
```

### Default Open State

```typescript
// Source: components/qmhq/qmrl-context-panel.tsx (lines 76-82)

// Panel state: starts visible on desktop (>= 768px), closed on mobile
// No sessionStorage persistence - resets per step per user decision
const [isPanelOpen, setIsPanelOpen] = useState(() => {
  if (typeof window !== 'undefined') {
    return window.innerWidth >= 768;
  }
  return true;
});
```

### Tabs for Content Organization

```typescript
// Pattern for slider content tabs (not in existing code, recommended pattern)
// Source: Radix UI Tabs documentation + components/ui/tabs.tsx

import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';

<Tabs defaultValue="qmrl" className="w-full">
  <TabsList className="grid w-full grid-cols-2">
    <TabsTrigger value="qmrl">
      <FileText className="h-4 w-4 mr-2" />
      QMRL
      {qmhqLinesCount > 0 && (
        <Badge variant="outline" className="ml-2">{qmhqLinesCount}</Badge>
      )}
    </TabsTrigger>
    <TabsTrigger value="qmhq">
      <ExternalLink className="h-4 w-4 mr-2" />
      QMHQ Lines
    </TabsTrigger>
  </TabsList>

  <TabsContent value="qmrl" className="space-y-4">
    {/* QMRL details: title, status, category, description, etc. */}
  </TabsContent>

  <TabsContent value="qmhq" className="space-y-4">
    {/* Sibling QMHQ list */}
  </TabsContent>
</Tabs>
```

### Server Component Data Fetching Pattern

```typescript
// Pattern for fetching slider data (recommended, not in existing code)
// Source: Next.js documentation + existing server component patterns

// app/(dashboard)/inventory/stock-out-requests/new/page.tsx
import { createServerClient } from '@/lib/supabase/server';

export default async function NewStockOutRequestPage({ searchParams }) {
  const qmhqId = searchParams.qmhq;

  // Fetch QMHQ and QMRL data on server (single query, no waterfall)
  let qmhqData = null;
  let qmrlData = null;

  if (qmhqId) {
    const supabase = createServerClient();

    const { data } = await supabase
      .from('qmhq')
      .select(`
        id, request_id, line_name, route_type,
        qmrl:qmrl_id (
          *,
          status:status_config(*),
          category:categories(*),
          qmhq_siblings:qmhq(id, request_id, line_name, route_type)
        )
      `)
      .eq('id', qmhqId)
      .single();

    qmhqData = data;
    qmrlData = data?.qmrl;
  }

  return (
    <StockOutRequestFormClient
      qmhqData={qmhqData}
      qmrlData={qmrlData}
    />
  );
}

// Client component receives data as props (no additional fetching)
'use client';
export function StockOutRequestFormClient({ qmhqData, qmrlData }) {
  const [isPanelOpen, setIsPanelOpen] = useState(
    typeof window !== 'undefined' && window.innerWidth >= 768
  );

  return (
    <div className="md:grid md:grid-cols-[1fr_384px] gap-6">
      <StockOutForm />

      {qmhqData && (
        <ContextSlider isOpen={isPanelOpen} onToggle={() => setIsPanelOpen(!isPanelOpen)}>
          <Tabs defaultValue="qmrl">
            <TabsList>
              <TabsTrigger value="qmrl">QMRL</TabsTrigger>
              <TabsTrigger value="qmhq">QMHQ</TabsTrigger>
            </TabsList>
            <TabsContent value="qmrl">
              <QmrlDetails data={qmrlData} />
            </TabsContent>
            <TabsContent value="qmhq">
              <QmhqDetails data={qmhqData} />
            </TabsContent>
          </Tabs>
        </ContextSlider>
      )}
    </div>
  );
}
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Sheet components from libraries | Custom slider using Tailwind CSS Grid + transforms | 2024-2025 | Radix UI doesn't have Sheet primitive yet, shadcn/ui Sheet requires Vaul dependency. Custom implementation with Tailwind is simpler, more flexible, and proven in production. |
| Client-side data fetching | Server Component fetching, pass props to client slider | Next.js 13+ (2023) | Eliminates waterfalls, faster perceived performance. Server Components fetch on server, client components handle interaction only. |
| Framer Motion for animations | Tailwind transitions | 2024+ | Tailwind transitions are GPU-accelerated and smooth enough for simple slide animations. No need for heavy animation library. |
| Persistent slider state | Reset per page load (device-specific default) | 2025 | Simpler UX: users know what to expect (desktop = open, mobile = closed). No state confusion across navigations. |

**Deprecated/outdated:**

- **Separate Sheet component from UI library:** Modern approach is to use custom implementation with Tailwind CSS Grid for push-content layout. Sheet components typically create overlays, not push-content layouts.
- **Client-side slider data fetching:** Modern Next.js pattern is Server Component fetching (eliminates waterfalls). Prior to Next.js 13, all data fetching was client-side.
- **React Spring / Framer Motion for simple slide:** Tailwind's `transition-transform duration-300` is sufficient for slide animations. Heavy animation libraries are overkill for simple use cases.

---

## Open Questions

1. **Slider width on large screens (1920px+)**
   - What we know: Existing pattern uses `lg:w-96` (384px)
   - What's unclear: Whether ultra-wide screens (xl: 1280px+, 2xl: 1536px+) should increase slider width
   - Recommendation: Keep fixed at 384px (readable width for text content). Don't scale proportionally with screen size.

2. **Mobile experience: bottom sheet vs slide-from-right**
   - What we know: Existing pattern uses slide-from-right with backdrop
   - What's unclear: Whether bottom sheet (slide-from-bottom) would be more mobile-native
   - Recommendation: Keep slide-from-right. Consistent with desktop positioning, users understand "context on right". Bottom sheet feels like action menu, not contextual information.

3. **Animation duration and easing**
   - What we know: Existing pattern uses `duration-300 ease-in-out`
   - What's unclear: Whether faster (200ms) or spring easing would feel better
   - Recommendation: Keep `duration-300 ease-in-out`. Proven to feel smooth without being sluggish. Spring easing (`ease-spring`) doesn't exist in Tailwind without plugin.

4. **Tab persistence within session**
   - What we know: Slider open/closed state resets per page load
   - What's unclear: Whether active tab (QMRL vs QMHQ) should persist in sessionStorage when user returns to page
   - Recommendation: Don't persist. Always default to first tab (QMRL). Simpler, consistent behavior. User can switch tabs easily if needed.

---

## Sources

### Primary (HIGH confidence)

- **Codebase - Existing Implementation**
  - `/components/qmhq/qmrl-context-panel.tsx` - 640-line production slider (HIGH confidence: proven in QMHQ workflow)
  - `/app/(dashboard)/qmhq/new/page.tsx` - Grid layout integration (lines 299-658)
  - `/components/ui/tabs.tsx` - Radix UI Tabs wrapper component
  - `/.planning/research/STACK.md` - Stack decisions document confirming zero new dependencies

- **Official Documentation**
  - [Radix UI Dialog API](https://www.radix-ui.com/primitives/docs/components/dialog) - Controlled state pattern (`open`, `onOpenChange` props)
  - [shadcn/ui Sheet Component](https://ui.shadcn.com/docs/components/radix/sheet) - Sheet component API (not currently in codebase)

### Secondary (MEDIUM confidence)

- **Web Search - Verified with Official Sources**
  - [Next.js Server and Client Components](https://nextjs.org/docs/app/getting-started/server-and-client-components) - Data fetching patterns (verified official Next.js docs)
  - [CSS Grid Layout Guide](https://css-tricks.com/snippets/css/complete-guide-grid/) - Push content layout patterns (verified standard CSS Grid techniques)
  - [Tailwind CSS Animation](https://tailwindcss.com/docs/animation) - Transition utilities (verified official Tailwind docs)
  - [React Server Components + TanStack Query 2026](https://dev.to/krish_kakadiya_5f0eaf6342/react-server-components-tanstack-query-the-2026-data-fetching-power-duo-you-cant-ignore-21fj) - N+1 query prevention patterns

### Tertiary (LOW confidence - requires validation)

- **Web Search - Community Patterns**
  - [React Sliding Side Panel - GitHub](https://github.com/BenedicteGiraud/react-sliding-side-panel) - Alternative library approach (not recommended for this project)
  - [Responsive Next.js Templates](https://dev.to/hitesh_developer/designing-with-flexibility-responsive-nextjs-templates-for-any-device-3183) - Mobile drawer patterns (general guidance)
  - [shadcn-ui sidebar discussion](https://github.com/shadcn-ui/ui/discussions/2429) - Community discussion about right-side drawers (unverified)

---

## Metadata

**Confidence breakdown:**
- Existing pattern extraction: **HIGH** - 640 lines of production code, proven in QMHQ workflow for months
- CSS Grid push-content layout: **HIGH** - Standard CSS Grid technique, used throughout modern web apps
- Tailwind animations: **HIGH** - Official Tailwind utilities, existing implementation proves sufficiency
- Server Component data fetching: **HIGH** - Official Next.js 14+ pattern, documented extensively
- Tab organization: **HIGH** - Radix UI Tabs already installed and used in project
- Responsive patterns: **HIGH** - Existing implementation handles desktop/mobile, proven UX

**Research date:** 2026-02-10
**Valid until:** 60 days (2026-04-11) - Stable patterns, but Next.js/Radix updates could affect recommendations

**Key Finding:** Zero new dependencies needed. The QM System codebase already contains all necessary patterns and components. Primary task is extraction and generalization of existing `QmrlContextPanel` implementation.
