# Architecture Research: v1.5 Features Integration

**Research Date:** 2026-02-07
**Target Milestone:** v1.5 Polish Features
**Confidence Level:** HIGH

## Executive Summary

This research analyzes how four v1.5 features integrate with the existing QM System architecture:
1. Comments system with polymorphic entity references
2. Responsive typography using Tailwind
3. Two-step selector components for improved UX
4. Currency cascade from money-in transactions to money-out/PO

All features integrate cleanly with existing patterns. The architecture already supports polymorphic references (file attachments), RLS-based permissions, audit logging, and component composition. No architectural changes required—only additions following established patterns.

---

## 1. Comments Integration

### Database Schema

**Pattern:** Polymorphic entity references (established by file_attachments table)

```sql
-- New table: comments
CREATE TABLE public.comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Polymorphic entity relationship
  entity_type TEXT NOT NULL CHECK (entity_type IN ('qmrl', 'qmhq', 'po', 'invoice')),
  entity_id UUID NOT NULL, -- No FK constraint (polymorphic)

  -- Comment content
  comment_text TEXT NOT NULL,

  -- Ownership/audit
  created_by UUID NOT NULL REFERENCES public.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- Soft delete
  deleted_at TIMESTAMPTZ,
  deleted_by UUID REFERENCES public.users(id)
);

-- Index for entity lookups (most common query)
CREATE INDEX idx_comments_entity
  ON public.comments(entity_type, entity_id)
  WHERE deleted_at IS NULL;

-- Index for creator lookups
CREATE INDEX idx_comments_created_by
  ON public.comments(created_by);

-- Composite index for timeline queries
CREATE INDEX idx_comments_entity_time
  ON public.comments(entity_type, entity_id, created_at DESC);
```

**Design Rationale:**
- Mirrors `file_attachments` table structure (lines 13-37 of migration 030)
- Uses same polymorphic pattern: `entity_type` + `entity_id`
- Supports same entities: qmrl, qmhq, plus po, invoice
- Soft delete pattern with grace period (consistent with attachments)
- Indexed for efficient timeline queries

### RLS Approach

**Pattern:** Mirror parent entity permissions (established by file_attachments RLS)

Comments access follows parent entity permissions:
- If user can view QMRL, user can view comments on that QMRL
- If user can edit QMHQ, user can create comments on that QMHQ
- Only comment creator or Admin can delete their own comments

```sql
-- SELECT: Mirror parent entity read permissions
CREATE POLICY comments_select ON public.comments
  FOR SELECT USING (
    deleted_at IS NULL
    AND (
      -- Privileged roles see all comments
      public.get_user_role() IN ('admin', 'quartermaster', 'finance', 'inventory', 'proposal', 'frontline')
      OR (
        -- Requester sees comments on own QMRL
        public.get_user_role() = 'requester'
        AND entity_type = 'qmrl'
        AND public.owns_qmrl(entity_id)
      )
      OR (
        -- Requester sees comments on QMHQ linked to own QMRL
        public.get_user_role() = 'requester'
        AND entity_type = 'qmhq'
        AND public.owns_qmhq(entity_id)
      )
      -- Note: PO/Invoice visible to Finance, Inventory, Proposal (handled above)
    )
  );

-- INSERT: Users who can view the entity can comment
CREATE POLICY comments_insert ON public.comments
  FOR INSERT WITH CHECK (
    public.get_user_role() IN ('admin', 'quartermaster')
    OR (
      public.get_user_role() IN ('proposal', 'frontline')
      AND entity_type IN ('qmrl', 'qmhq')
    )
    OR (
      public.get_user_role() IN ('finance', 'inventory')
      AND entity_type IN ('qmrl', 'qmhq', 'po', 'invoice')
    )
    OR (
      public.get_user_role() = 'requester'
      AND entity_type = 'qmrl'
      AND public.owns_qmrl(entity_id)
    )
  );

-- UPDATE (soft delete): Creator or Admin only
CREATE POLICY comments_update ON public.comments
  FOR UPDATE USING (
    created_by = auth.uid()
    OR public.get_user_role() = 'admin'
  );

-- DELETE (hard delete): Admin only - for cleanup
CREATE POLICY comments_delete ON public.comments
  FOR DELETE USING (
    public.get_user_role() = 'admin'
  );
```

**Design Rationale:**
- Uses existing `owns_qmrl()` and `owns_qmhq()` helper functions (lines 28-48 of migration 027)
- Follows same permission matrix as file attachments
- Reuses `get_user_role()` security definer function
- No new RLS helper functions needed

### Component Structure

**Pattern:** Reusable comment components following established UI patterns

```
/components/comments/
  comment-section.tsx         # Main container (server component)
  comment-list.tsx            # Displays comments timeline (server)
  comment-item.tsx            # Individual comment card (server)
  comment-form.tsx            # Create/edit form (client component)
  comment-actions.tsx         # Delete/edit actions (client component)
```

**Component Details:**

**CommentSection** (Server Component)
- Props: `entityType`, `entityId`
- Fetches comments with user relations via Supabase
- Permission check: Can user view this entity?
- Renders CommentList + CommentForm
- Uses existing permission hook pattern

**CommentList** (Server Component)
- Props: `comments` array with user relations
- Timeline display (newest first)
- Empty state when no comments
- Maps to CommentItem components

**CommentItem** (Server/Client Hybrid)
- Server: Renders comment content, user info, timestamp
- Client: CommentActions for delete/edit (interactive)
- Props: `comment`, `canEdit` (from permission check)
- Avatar/name from user relation (loaded server-side)
- Relative time display ("2 hours ago")

**CommentForm** (Client Component)
- Textarea for comment input
- Character limit (500-1000 chars)
- Submit button with loading state
- Toast feedback on success/error
- Uses existing `useToast()` hook
- Revalidates parent page after submit

**CommentActions** (Client Component)
- Delete button (soft delete)
- Confirmation dialog before delete
- Uses existing Dialog component
- Permission-based visibility

**Integration Points:**

1. **Detail Pages**: Add CommentSection to tabs
   - QMRL detail: `/app/(dashboard)/qmrl/[id]/page.tsx`
   - QMHQ detail: `/app/(dashboard)/qmhq/[id]/page.tsx`
   - PO detail: `/app/(dashboard)/po/[id]/page.tsx`
   - Invoice detail: `/app/(dashboard)/invoice/[id]/page.tsx`

2. **Tab Structure**: Add "Comments" tab after existing tabs
   ```tsx
   <Tabs defaultValue="details">
     <TabsList>
       <TabsTrigger value="details">Details</TabsTrigger>
       <TabsTrigger value="history">History</TabsTrigger>
       <TabsTrigger value="comments">Comments</TabsTrigger> {/* NEW */}
     </TabsList>
     <TabsContent value="comments">
       <CommentSection entityType="qmrl" entityId={id} />
     </TabsContent>
   </Tabs>
   ```

### Audit Integration

**Pattern:** Audit triggers for all create/update/delete operations

```sql
-- Trigger for comment audit logs
CREATE TRIGGER comments_audit_trigger
  AFTER INSERT OR UPDATE OR DELETE ON public.comments
  FOR EACH ROW
  EXECUTE FUNCTION public.create_audit_log();
```

**Audit Log Entries:**
- Action `create`: New comment posted
- Action `update`: Comment edited (if edit feature added)
- Action `delete`: Comment soft-deleted
- Summary: "User [Name] commented on [Entity Type] [Entity ID]"
- Links to comment and parent entity

**Design Rationale:**
- Uses existing `create_audit_log()` function (migration 026)
- Follows same trigger pattern as other entities
- Audit logs accessible via History tab

---

## 2. Responsive Typography

### CSS Approach

**Pattern:** Tailwind utility classes with responsive variants

The existing `tailwind.config.ts` already includes custom font size scale (lines 84-92):
- `display-2xl` through `display-xs` with line-height and letter-spacing
- Font family with Inter variable font
- Mono font for numbers/currency

**Enhancement Strategy:**

1. **Extend Existing Scale** with responsive modifiers:
   ```js
   // tailwind.config.ts - extend fontSize
   fontSize: {
     // Existing display scale (lines 84-92)
     "display-2xl": ["4.5rem", { lineHeight: "1.1", letterSpacing: "-0.02em" }],
     // ... existing scales

     // NEW: Responsive heading scale
     "heading-lg": ["clamp(1.75rem, 4vw, 2.25rem)", { lineHeight: "1.2" }],
     "heading-md": ["clamp(1.5rem, 3vw, 1.875rem)", { lineHeight: "1.25" }],
     "heading-sm": ["clamp(1.25rem, 2.5vw, 1.5rem)", { lineHeight: "1.3" }],

     // NEW: Responsive body scale
     "body-lg": ["clamp(1.125rem, 1.5vw, 1.25rem)", { lineHeight: "1.6" }],
     "body-md": ["clamp(1rem, 1.25vw, 1.125rem)", { lineHeight: "1.6" }],
     "body-sm": ["clamp(0.875rem, 1vw, 1rem)", { lineHeight: "1.5" }],
   }
   ```

2. **Component-Level Responsive Classes**:
   - Page titles: `text-heading-lg md:text-display-sm`
   - Section headers: `text-heading-md`
   - Card titles: `text-heading-sm`
   - Body text: `text-body-md`
   - Labels: `text-body-sm`

3. **Breakpoint Strategy**:
   - Mobile-first (base styles for small screens)
   - Tablet: `md:` prefix (768px+)
   - Desktop: `lg:` prefix (1024px+)
   - Wide: `xl:` prefix (1280px+)

### Component Changes

**Components Requiring Updates:**

1. **Page Headers** (all detail pages):
   ```tsx
   // Before
   <h1 className="text-2xl font-semibold text-slate-200">

   // After (responsive)
   <h1 className="text-heading-lg font-semibold text-slate-200">
   ```

2. **Card Headers**:
   ```tsx
   // Before
   <h3 className="text-lg font-medium">

   // After
   <h3 className="text-heading-sm font-medium">
   ```

3. **CurrencyDisplay Component** (already has size prop):
   ```tsx
   // components/ui/currency-display.tsx
   // Existing size variants: sm, md, lg (lines 61-74)
   // Add responsive variants:
   const sizeStyles = {
     sm: { primary: "text-sm md:text-base", secondary: "text-xs" },
     md: { primary: "text-base md:text-lg", secondary: "text-sm" },
     lg: { primary: "text-lg md:text-xl lg:text-2xl", secondary: "text-sm md:text-base" },
   };
   ```

4. **Table Headers**:
   ```tsx
   // Before
   <th className="text-sm font-medium">

   // After
   <th className="text-body-sm md:text-body-md font-medium">
   ```

**Files to Update:**
- `tailwind.config.ts` - Add responsive font scale
- `components/ui/currency-display.tsx` - Responsive size variants
- All page headers in `app/(dashboard)/**/**/page.tsx`
- Card components in `components/cards/*`
- Table components in `components/tables/*`

**Design Rationale:**
- Uses CSS `clamp()` for fluid typography (no JavaScript)
- Maintains existing component API (size prop still works)
- Backward compatible (existing classes still valid)
- Mobile-first approach (improves mobile UX significantly)

---

## 3. Two-Step Selector Components

### Component Design

**Pattern:** Enhanced version of InlineCreateSelect with two-step flow

Existing `InlineCreateSelect` (lines 42-425 of `components/forms/inline-create-select.tsx`) provides:
- Searchable dropdown with [+] button
- Inline creation form
- Create & Select workflow

**New Component: TwoStepSelect**

**Use Cases:**
1. **Item Selection**: Category → Item (PO line items, QMHQ item route)
2. **Warehouse Selection**: Location → Warehouse (stock operations)
3. **User Selection**: Department → User (assignment fields)

**Component Structure:**

```tsx
// components/forms/two-step-select.tsx

interface TwoStepSelectProps {
  // Step 1: Primary filter
  primaryValue: string;
  onPrimaryChange: (value: string) => void;
  primaryOptions: Array<{ id: string; name: string; }>;
  primaryLabel: string;
  primaryPlaceholder: string;

  // Step 2: Secondary selector (dependent on step 1)
  secondaryValue: string;
  onSecondaryChange: (value: string) => void;
  secondaryOptions: Array<{ id: string; name: string; }>;
  secondaryLabel: string;
  secondaryPlaceholder: string;
  secondaryDisabled?: boolean;

  // Display
  required?: boolean;
  disabled?: boolean;
}

export function TwoStepSelect({ ... }: TwoStepSelectProps) {
  // Step 1: Primary selector (always enabled)
  // Step 2: Secondary selector (enabled after step 1 selected)
  // Uses InlineCreateSelect pattern for searchable dropdowns
  // Visual connection between steps (arrow or line)
  // Secondary options filtered by primary selection
}
```

**Specific Implementations:**

**CategoryItemSelect** (for PO line items):
```tsx
interface CategoryItemSelectProps {
  categoryId: string;
  onCategoryChange: (id: string) => void;
  itemId: string;
  onItemChange: (id: string) => void;
  // Optionally support inline item creation
  allowCreateItem?: boolean;
}

// Usage in PO line item form:
<CategoryItemSelect
  categoryId={categoryId}
  onCategoryChange={setCategoryId}
  itemId={itemId}
  onItemChange={setItemId}
  allowCreateItem={true}
/>
```

**DepartmentUserSelect** (for assignments):
```tsx
// Step 1: Department → Step 2: Users in that department
<DepartmentUserSelect
  departmentId={departmentId}
  onDepartmentChange={setDepartmentId}
  userId={userId}
  onUserChange={setUserId}
/>
```

**LocationWarehouseSelect** (for inventory):
```tsx
// Step 1: Location/Region → Step 2: Warehouses in that location
<LocationWarehouseSelect
  locationId={locationId}
  onLocationChange={setLocationId}
  warehouseId={warehouseId}
  onWarehouseChange={setWarehouseId}
/>
```

### State Management

**Pattern:** Component-local state with controlled inputs

```tsx
// Parent component (e.g., PO line item form)
const [categoryId, setCategoryId] = useState("");
const [itemId, setItemId] = useState("");
const [items, setItems] = useState<Item[]>([]);

// Fetch items when category changes
useEffect(() => {
  if (!categoryId) {
    setItems([]);
    setItemId("");
    return;
  }

  const fetchItems = async () => {
    const { data } = await supabase
      .from("items")
      .select("*")
      .eq("category_id", categoryId)
      .eq("is_active", true)
      .order("name");
    setItems(data || []);
  };

  fetchItems();
}, [categoryId]);

// Pass to TwoStepSelect
<CategoryItemSelect
  categoryId={categoryId}
  onCategoryChange={setCategoryId}
  itemId={itemId}
  onItemChange={setItemId}
  items={items}
/>
```

**Design Rationale:**
- No global state needed (component-local with useState)
- Parent controls fetching (allows custom filtering logic)
- Resets secondary when primary changes
- Uses existing Supabase client patterns

### Visual Design

**Layout Pattern:**

```
┌─────────────────────────────────────────────┐
│ Step 1: Category *                    [+]  │
│ [🔍 Select category...              ▼]     │
└─────────────────────────────────────────────┘
                     ↓
┌─────────────────────────────────────────────┐
│ Step 2: Item *                        [+]  │
│ [🔍 Select item...                  ▼]     │
│ Disabled until category selected            │
└─────────────────────────────────────────────┘
```

**Visual Indicators:**
- Step numbers (1, 2) for clarity
- Arrow or connecting line between steps
- Secondary selector disabled state when primary empty
- Subtle animation when secondary becomes enabled
- Badge showing count of available options ("12 items")

**Reused Components:**
- Popover (from `components/ui/popover.tsx`)
- Search input (inline in popover)
- Button (from `components/ui/button.tsx`)
- Uses same styling as InlineCreateSelect

---

## 4. Currency Unification/Cascade

### Schema Changes

**Current State Analysis:**

From `supabase/migrations/011_qmhq.sql` (lines 40-46):
```sql
-- QMHQ table already has:
amount DECIMAL(15,2),
currency TEXT DEFAULT 'MMK',
exchange_rate DECIMAL(10,4) DEFAULT 1.0000,
amount_eusd DECIMAL(15,2) GENERATED ALWAYS AS (
  CASE WHEN exchange_rate > 0 THEN amount / exchange_rate ELSE 0 END
) STORED,
```

**Problem:** Money-out transactions and PO creation currently require manual currency/exchange rate entry, even when the parent QMHQ already has currency set from money-in.

**Required Schema Changes:**

**None.** Schema already supports currency cascade. Changes are UI/UX only.

**Data Flow:**

```
QMHQ (PO route)
  ├─ Money-In Transaction #1 (USD, rate 1.0)
  ├─ Money-In Transaction #2 (USD, rate 1.0)
  └─ PO (should inherit USD + rate from QMHQ)
      └─ Invoice (independent currency - as designed)

QMHQ (Expense route)
  ├─ Money-In Transaction (MMK, rate 1350)
  └─ Money-Out Transaction (should default to MMK + rate 1350)
```

**Validation Rules:**

From `supabase/migrations/020_block_po_money_out.sql`:
- PO route blocks money-out transactions (trigger enforced)
- Expense route allows both money-in and money-out
- PO spending happens through Purchase Orders only

### UI Changes

**Component Updates:**

1. **MoneyInForm** (establishes currency):
   ```tsx
   // app/(dashboard)/qmhq/[id]/money-in/page.tsx
   // Current: User selects currency + exchange rate
   // Change: NONE (first money-in sets the currency)
   ```

2. **MoneyOutForm** (inherits currency):
   ```tsx
   // app/(dashboard)/qmhq/[id]/money-out/page.tsx
   // NEW: Pre-populate currency from first money-in transaction

   const [defaultCurrency, setDefaultCurrency] = useState("MMK");
   const [defaultRate, setDefaultRate] = useState(1.0);

   useEffect(() => {
     // Fetch first money-in transaction
     const fetchDefaults = async () => {
       const { data } = await supabase
         .from("financial_transactions")
         .select("currency, exchange_rate")
         .eq("qmhq_id", qmhqId)
         .eq("transaction_type", "money_in")
         .order("created_at")
         .limit(1)
         .single();

       if (data) {
         setDefaultCurrency(data.currency);
         setDefaultRate(data.exchange_rate);
       }
     };
     fetchDefaults();
   }, [qmhqId]);

   // Pre-populate form
   const [currency, setCurrency] = useState(defaultCurrency);
   const [exchangeRate, setExchangeRate] = useState(defaultRate);
   ```

3. **POCreateForm** (inherits from QMHQ):
   ```tsx
   // app/(dashboard)/po/new/page.tsx
   // NEW: Pre-populate currency from parent QMHQ

   const [qmhq, setQmhq] = useState<QMHQ | null>(null);

   useEffect(() => {
     // When QMHQ selected, inherit currency
     if (selectedQmhqId) {
       const fetchQmhq = async () => {
         const { data } = await supabase
           .from("qmhq")
           .select("currency, exchange_rate")
           .eq("id", selectedQmhqId)
           .single();

         if (data) {
           setCurrency(data.currency);
           setExchangeRate(data.exchange_rate);
         }
       };
       fetchQmhq();
     }
   }, [selectedQmhqId]);
   ```

**Visual Indicators:**

1. **Inherited Currency Badge**:
   ```tsx
   {currencyInherited && (
     <div className="flex items-center gap-2 text-sm text-amber-500">
       <InfoIcon className="h-4 w-4" />
       <span>Currency inherited from parent QMHQ</span>
     </div>
   )}
   ```

2. **Allow Override** (with warning):
   ```tsx
   <Checkbox
     checked={allowCurrencyOverride}
     onCheckedChange={setAllowCurrencyOverride}
   />
   <Label>Use different currency</Label>

   {allowCurrencyOverride && (
     <div className="text-sm text-yellow-500">
       ⚠️ Changing currency may complicate reconciliation
     </div>
   )}
   ```

**Existing Components to Reuse:**
- `AmountInput` (lines 1-78 of components/ui/amount-input.tsx)
- `ExchangeRateInput` (existing in components/ui/)
- `CurrencyDisplay` (lines 1-142 of components/ui/currency-display.tsx)
- No new currency components needed

**Design Rationale:**
- Reduces data entry errors (user doesn't manually enter rate)
- Maintains consistency (all transactions in same currency)
- Allows override for edge cases (checkbox + warning)
- No schema changes (backward compatible)
- Uses existing form components

---

## Suggested Build Order

Recommended phase structure based on dependencies and complexity:

### Phase 1: Comments Foundation (3 steps)
**Why first:** No dependencies, adds value immediately, establishes pattern for other features

1. **Database & RLS**
   - Migration: comments table with polymorphic reference
   - RLS policies mirroring parent entity permissions
   - Audit trigger for comment logs
   - Test RLS with different user roles

2. **Comment Components**
   - CommentSection (server component with fetch)
   - CommentList (timeline display)
   - CommentItem (individual comment card)
   - CommentForm (client component for create)
   - CommentActions (delete with confirmation)

3. **Integration & Polish**
   - Add "Comments" tab to QMRL, QMHQ, PO, Invoice detail pages
   - Empty state when no comments
   - Loading states and error handling
   - Toast notifications for actions

**Success Criteria:** User can comment on any entity and see comments timeline

---

### Phase 2: Responsive Typography (2 steps)
**Why second:** Low risk, improves mobile UX, no dependencies on Phase 1

1. **Tailwind Configuration**
   - Extend fontSize with responsive scale (heading-lg, heading-md, body-md, etc.)
   - Test clamp() values at different viewport sizes
   - Document new utility classes

2. **Component Updates**
   - Update CurrencyDisplay with responsive size variants
   - Apply responsive classes to page headers, card titles, table headers
   - Test on mobile (375px), tablet (768px), desktop (1440px)
   - Verify no layout breaks

**Success Criteria:** All text scales smoothly from mobile to desktop

---

### Phase 3: Two-Step Selectors (3 steps)
**Why third:** Depends on Category data, more complex state management

1. **Base TwoStepSelect Component**
   - Generic two-step selector with searchable popover
   - Visual design (steps, arrow, disabled states)
   - Animation when secondary becomes enabled
   - Reuse InlineCreateSelect patterns

2. **Specific Implementations**
   - CategoryItemSelect (PO line items, QMHQ item route)
   - DepartmentUserSelect (assignment fields)
   - Parent component state management pattern

3. **Integration**
   - Replace single-step selectors in PO create form
   - Replace item selector in QMHQ item route form
   - Test filtering (secondary options update on primary change)
   - Error states and validation

**Success Criteria:** User selects category then item in two clear steps

---

### Phase 4: Currency Cascade (2 steps)
**Why last:** Depends on financial transaction flow understanding, requires careful UX

1. **Money-Out Inheritance**
   - Fetch first money-in currency/rate
   - Pre-populate money-out form
   - Add "inherited currency" indicator
   - Allow override with checkbox + warning

2. **PO Currency Inheritance**
   - Inherit currency from parent QMHQ
   - Pre-populate PO create form
   - Add inherited badge
   - Test edge cases (no money-in yet, multiple currencies)

**Success Criteria:** Currency cascades from money-in to money-out and PO with clear UX

---

## Integration Points Summary

| Feature | Database | RLS | Components | Integration Points |
|---------|----------|-----|------------|-------------------|
| Comments | New table | New policies | 5 new components | QMRL, QMHQ, PO, Invoice detail tabs |
| Responsive Typography | None | None | Update existing | All pages, CurrencyDisplay, headers |
| Two-Step Selectors | None | None | 2 new components | PO create, QMHQ item route, assignments |
| Currency Cascade | None | None | Update 2 forms | Money-out form, PO create form |

---

## Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Comments RLS policy too permissive | Low | High | Copy file_attachments policies exactly, test with all roles |
| Responsive typography breaks layout | Medium | Medium | Test at breakpoints 375px, 768px, 1024px, 1440px |
| Two-step selector confusing UX | Low | Medium | Clear step indicators, disable state, helper text |
| Currency cascade edge cases | Medium | Low | Allow override, show warning, test no-money-in case |
| Comments performance with many records | Low | Low | Index on entity + created_at, paginate if >50 comments |

---

## New Components Required

| Component | Type | Dependencies | Complexity |
|-----------|------|--------------|------------|
| `comment-section.tsx` | Server | Supabase, permissions | Medium |
| `comment-list.tsx` | Server | None | Low |
| `comment-item.tsx` | Server/Client | Relative time util | Low |
| `comment-form.tsx` | Client | Toast, Supabase | Medium |
| `comment-actions.tsx` | Client | Dialog, Toast | Low |
| `two-step-select.tsx` | Client | Popover, Search | Medium |
| `category-item-select.tsx` | Client | TwoStepSelect | Low |
| `department-user-select.tsx` | Client | TwoStepSelect | Low |

**Total:** 8 new components, all following existing patterns

---

## Modified Components Required

| Component | Change | Risk |
|-----------|--------|------|
| `currency-display.tsx` | Add responsive size variants | Low |
| `tailwind.config.ts` | Extend fontSize scale | Low |
| Detail pages (4 files) | Add Comments tab | Low |
| `money-out form` | Pre-populate currency | Low |
| `po create form` | Pre-populate currency | Low |
| Page headers (10+ files) | Apply responsive classes | Low |

**Total:** ~20 file modifications, all low-risk additive changes

---

## Confidence Assessment

| Area | Confidence | Reason |
|------|------------|--------|
| Comments Schema | HIGH | Mirrors proven file_attachments pattern |
| Comments RLS | HIGH | Reuses existing helper functions, same policy structure |
| Responsive Typography | HIGH | Standard Tailwind approach, clamp() well-supported |
| Two-Step Selectors | MEDIUM | New pattern, needs UX validation |
| Currency Cascade | MEDIUM | Edge cases exist (no money-in yet), needs thorough testing |

**Overall Confidence:** HIGH (4 of 5 areas high confidence)

---

## Open Questions

1. **Comments Pagination:** If entity has >50 comments, should we paginate or infinite scroll?
   - **Recommendation:** Start with "Load More" button, add infinite scroll if needed

2. **Comment Editing:** Should users be able to edit comments after posting?
   - **Recommendation:** No edit for v1.5 (audit trail clarity), consider for v1.6

3. **Comment Notifications:** Should users be notified of new comments?
   - **Recommendation:** Out of scope for v1.5, requires notification system

4. **Two-Step Selector Reset:** When user changes step 1, should step 2 clear or preserve if still valid?
   - **Recommendation:** Always clear step 2 (simpler, more predictable)

5. **Currency Override Frequency:** How often do users need different currency per transaction?
   - **Recommendation:** Gather usage data, may simplify to force same currency in v1.6

---

*Research Complete: 2026-02-07*
*Researcher: GSD Project Research Agent*
*Confidence: HIGH*
