# Pitfalls Research: v1.5 Feature Additions

**Project:** QM System v1.5
**Domain:** Adding comments, responsive typography, two-step selectors, and currency unification to existing internal management system
**Researched:** 2026-02-07
**Overall Confidence:** HIGH

---

## Executive Summary

Adding features to an existing system with RLS policies, audit logging, and polymorphic patterns requires careful integration planning. The four features in v1.5 each have specific pitfalls that are amplified by QM System's architectural constraints:

1. **Comments System** - Polymorphic pattern integration with existing audit/RLS infrastructure
2. **Responsive Typography** - Large financial numbers requiring overflow handling without data loss
3. **Two-Step Selectors** - Cascading state management in existing form flows
4. **Currency Unification** - Decimal precision and cascade inheritance in multi-table system

**Critical Finding:** The existing system already uses polymorphic associations (file_attachments) and has 50+ migrations with complex RLS policies. Adding comments naively will cause performance degradation and audit log explosions.

---

## 1. Comments System Pitfalls

### Pitfall 1.1: Polymorphic RLS Performance Degradation

**What goes wrong:**
RLS policies on polymorphic comments table cause sequential scans instead of index usage, degrading from <50ms to >5000ms queries as comment count grows.

**Why it happens:**
- Comments table uses `entity_type` + `entity_id` (no foreign key constraint)
- RLS policy must join to parent table (qmrl/qmhq) to check ownership
- Non-LEAKPROOF functions in RLS prevent index usage
- PostgreSQL forces RLS filtering before index optimization

**Warning signs:**
- Query EXPLAIN shows Seq Scan on comments table
- Response time increases linearly with total comment count (not per-entity count)
- Database CPU spikes when loading entity detail pages

**Prevention strategy:**
```sql
-- WRONG: This RLS policy prevents index usage
CREATE POLICY comments_select ON comments FOR SELECT USING (
  CASE entity_type
    WHEN 'qmrl' THEN EXISTS (SELECT 1 FROM qmrl WHERE id = entity_id AND can_view_qmrl(id))
    WHEN 'qmhq' THEN EXISTS (SELECT 1 FROM qmhq WHERE id = entity_id AND can_view_qmhq(id))
  END
);

-- RIGHT: Use LEAKPROOF helper functions + partial indexes
CREATE FUNCTION can_view_comment(comment_id UUID) RETURNS BOOLEAN AS $$
  -- Complex logic here
$$ LANGUAGE plpgsql STABLE LEAKPROOF;

CREATE INDEX idx_comments_qmrl
  ON comments(entity_id)
  WHERE entity_type = 'qmrl' AND deleted_at IS NULL;

CREATE INDEX idx_comments_qmhq
  ON comments(entity_id)
  WHERE entity_type = 'qmhq' AND deleted_at IS NULL;
```

**Phase to address:** Phase 2 (Database Schema) - Must design RLS correctly from the start

**Sources:**
- [PostgreSQL RLS Performance Pitfalls](https://www.permit.io/blog/postgres-rls-implementation-guide)
- [Optimizing Postgres RLS](https://scottpierce.dev/posts/optimizing-postgres-rls/)

---

### Pitfall 1.2: Audit Log Explosion with High-Frequency Comments

**What goes wrong:**
Audit triggers on comments table generate 1 audit log entry per comment action, causing audit_logs table to grow 10x faster than business data, eventually degrading all queries.

**Why it happens:**
- Generic audit trigger (existing in QM System) logs every INSERT/UPDATE/DELETE
- Comments are high-frequency: users post multiple replies per discussion
- Audit log queries become slow (no partitioning in place)
- Existing audit queries like "show history for qmrl" start timing out

**Warning signs:**
- audit_logs table grows >100MB per month
- History tab pagination becomes slow
- Database storage alerts trigger frequently

**Prevention strategy:**
```sql
-- DON'T blindly apply generic audit trigger to comments
-- CREATE TRIGGER comments_audit AFTER INSERT OR UPDATE OR DELETE...

-- INSTEAD: Selective audit logging
CREATE TRIGGER comments_audit_significant_only
  AFTER INSERT OR UPDATE OR DELETE ON comments
  FOR EACH ROW
  WHEN (
    -- Only log creates and deletes, not every edit
    TG_OP IN ('INSERT', 'DELETE')
    OR (TG_OP = 'UPDATE' AND OLD.deleted_at IS NULL AND NEW.deleted_at IS NOT NULL)
  )
  EXECUTE FUNCTION create_audit_log();

-- OR: Use separate comments_audit_logs table with retention policy
CREATE TABLE comments_audit_logs (
  -- Lightweight schema, auto-purge after 90 days
) PARTITION BY RANGE (created_at);
```

**Phase to address:** Phase 2 (Database Schema) - Design audit strategy upfront

**Sources:**
- [Audit Trigger Performance](https://www.techtarget.com/searchdatamanagement/tip/Pros-and-cons-of-using-SQL-Server-audit-triggers-for-DBAs)
- [PostgreSQL Triggers in 2026](https://thelinuxcode.com/postgresql-triggers-in-2026-design-performance-and-production-reality/)

---

### Pitfall 1.3: Soft Delete Conflicts with Unique Constraints on Nested Replies

**What goes wrong:**
Users delete a comment, then try to post another reply to the same parent. Database rejects with unique constraint violation even though previous comment is soft-deleted.

**Why it happens:**
- QM System uses soft delete pattern (`deleted_at IS NULL` = active)
- Comments may have unique constraint on `(parent_id, created_by)` to prevent duplicate replies
- Soft-deleted rows still occupy constraint space
- Existing file_attachments table has similar pattern but doesn't have this issue (no uniqueness needed)

**Warning signs:**
- Error: `duplicate key value violates unique constraint "comments_unique_reply"`
- User reports "I deleted my comment but can't reply again"
- Database has soft-deleted comments with same parent_id + created_by

**Prevention strategy:**
```sql
-- WRONG: Naive unique constraint
ALTER TABLE comments ADD CONSTRAINT comments_unique_reply
  UNIQUE (parent_id, created_by);

-- RIGHT: Partial unique index excluding soft-deleted
CREATE UNIQUE INDEX comments_unique_active_reply
  ON comments(parent_id, created_by)
  WHERE deleted_at IS NULL;
```

**Phase to address:** Phase 2 (Database Schema) - Design soft-delete-aware constraints

**Sources:**
- [Why Soft Delete Can Backfire](https://dev.to/mrakdon/why-soft-delete-can-backfire-on-data-consistency-4epl)
- [Soft Delete Best Practices](https://www.martyfriedel.com/blog/deleting-data-soft-hard-or-audit)

---

### Pitfall 1.4: N+1 Query Problem with Nested Comment Replies

**What goes wrong:**
Loading a QMRL detail page with 50 comments makes 150+ database queries (1 for comments list + 1 per comment for reply count + 1 per comment for user info), causing 2-3 second page load times.

**Why it happens:**
- React component loops through comments and fetches replies for each
- Supabase client doesn't automatically batch requests
- Nested comment structure encourages recursive fetching

**Warning signs:**
- Browser DevTools Network tab shows 100+ Supabase requests for single page load
- Page load time increases linearly with comment count
- Database shows connection pool exhaustion during peak usage

**Prevention strategy:**
```typescript
// WRONG: Fetch comments, then fetch replies in loop
const comments = await supabase.from('comments').select('*').eq('entity_id', qmrlId);
for (const comment of comments) {
  const replies = await supabase.from('comments').select('*').eq('parent_id', comment.id);
}

// RIGHT: Use nested select to fetch in single query
const { data } = await supabase
  .from('comments')
  .select(`
    *,
    user:created_by(full_name, email),
    replies:comments!parent_id(
      *,
      user:created_by(full_name, email)
    )
  `)
  .eq('entity_id', qmrlId)
  .is('parent_id', null)
  .order('created_at', { ascending: false });

// ALTERNATIVE: Use recursive CTE view for deep nesting
CREATE VIEW comments_with_replies AS
WITH RECURSIVE comment_tree AS (
  -- Base case: top-level comments
  SELECT *, 0 as depth, ARRAY[id] as path
  FROM comments WHERE parent_id IS NULL
  UNION ALL
  -- Recursive case: replies
  SELECT c.*, ct.depth + 1, ct.path || c.id
  FROM comments c
  JOIN comment_tree ct ON c.parent_id = ct.id
  WHERE ct.depth < 3 -- Limit nesting to prevent infinite recursion
)
SELECT * FROM comment_tree;
```

**Phase to address:** Phase 3 (UI Components) - Design data fetching pattern correctly

**Sources:**
- [PostgreSQL Nested Comments Performance](https://www.slingacademy.com/article/postgresql-efficiently-store-comments-nested-comments/)
- [Scaling Threaded Comments at Disqus](https://cra.mr/2010/05/30/scaling-threaded-comments-on-django-at-disqus/)

---

### Pitfall 1.5: React Key Prop Mistakes Causing Comment State Bugs

**What goes wrong:**
User posts new comment, UI shows wrong commenter name or reply button doesn't work. Deleting a comment causes adjacent comment to lose its state.

**Why it happens:**
- Using array index as React key: `comments.map((c, idx) => <Comment key={idx} />)`
- When new comment inserted at top, all indexes shift
- React reconciliation reuses component instances incorrectly
- Component state (expanded replies, edit mode) attached to wrong comment

**Warning signs:**
- UI shows wrong user avatar after posting new comment
- Reply textarea appears under wrong comment
- "Edit" button edits different comment than clicked
- Issue only appears after adding/removing comments, not on initial load

**Prevention strategy:**
```tsx
// WRONG: Array index as key
{comments.map((comment, index) => (
  <CommentCard key={index} comment={comment} />
))}

// WRONG: Random keys (causes remount on every render)
{comments.map(comment => (
  <CommentCard key={Math.random()} comment={comment} />
))}

// RIGHT: Stable unique ID from database
{comments.map(comment => (
  <CommentCard key={comment.id} comment={comment} />
))}

// RIGHT: For optimistic UI before DB insert, use temp ID
const tempId = `temp_${Date.now()}_${Math.random()}`;
const optimisticComment = { id: tempId, ... };
```

**Phase to address:** Phase 3 (UI Components) - Code review checklist item

**Sources:**
- [React Key Prop Best Practices](https://www.developerway.com/posts/react-key-attribute)
- [Missing Key Prop Mistakes](https://medium.com/@chanukachandrayapa/react-key-prop-best-practices-from-state-mismanagement-to-optimized-rendering-cb85c62287f6)

---

## 2. Responsive Typography Pitfalls

### Pitfall 2.1: Large Financial Numbers Overflow on Mobile Without Detection

**What goes wrong:**
Invoice amount "12,475,937.47 MMK" displays as "12,475,93..." on mobile, truncating actual number. User approves invoice thinking it's 12M when it's actually 124M.

**Why it happens:**
- Fixed font size + `overflow: hidden` + `text-overflow: ellipsis`
- Ellipsis appears at end, making "12,475,937.47" → "12,475,93..." look plausible
- Financial numbers in QM System can be 15 digits (DECIMAL(15,2))
- No visual indicator that truncation occurred (no tooltip, no warning color)

**Warning signs:**
- User reports "approved wrong amount"
- QA finds mobile screenshots with "..." in financial fields
- Accessibility audit flags missing tooltips on truncated text

**Prevention strategy:**
```tsx
// WRONG: Blind truncation
<div className="text-base overflow-hidden text-ellipsis whitespace-nowrap">
  {formatCurrency(amount, currency)}
</div>

// RIGHT: Responsive font size with clamp() + tooltip for full value
<div className="relative group">
  <div
    className="whitespace-nowrap overflow-hidden text-ellipsis"
    style={{ fontSize: 'clamp(0.75rem, 2.5vw, 1rem)' }}
    title={`${formatCurrency(amount, currency)} (${formatCurrency(amountEusd, 'EUSD')})`}
  >
    {formatCurrency(amount, currency)}
  </div>
  {/* Always show full value on hover/tap */}
  <div className="absolute z-10 hidden group-hover:block bg-gray-900 text-white px-2 py-1 rounded text-sm whitespace-nowrap">
    {formatCurrency(amount, currency)} = {formatCurrency(amountEusd, 'EUSD')}
  </div>
</div>

// ALTERNATIVE: Line-clamp with expansion button for very large numbers
{amount.toString().length > 12 && (
  <button onClick={() => setExpanded(!expanded)}>
    {expanded ? 'Collapse' : 'Show full'}
  </button>
)}
```

**Phase to address:** Phase 4 (Responsive Typography) - Design financial display component

**Sources:**
- [CSS Clamp for Responsive Typography](https://css-tricks.com/linearly-scale-font-size-with-css-clamp-based-on-the-viewport/)
- [Design for Truncation](https://medium.com/design-bootcamp/design-for-truncation-946951d5b6b8)

---

### Pitfall 2.2: EUSD Calculation Display Mismatch Due to Font Size Scaling

**What goes wrong:**
PO shows "2,500,000 MMK = 1,190 EUSD" on desktop but "2,500,000 MMK = " on mobile (EUSD completely hidden). User loses critical equivalent amount information.

**Why it happens:**
- QM System design: always show amount + EUSD together
- Layout uses `flex` with `justify-between` for "MMK" | "EUSD"
- On mobile, container width collapses, EUSD pushed off-screen
- Responsive font sizing doesn't help if entire element is hidden

**Warning signs:**
- Mobile screenshots missing EUSD values
- User reports "can't see USD equivalent on phone"
- Lighthouse accessibility audit flags hidden content

**Prevention strategy:**
```tsx
// WRONG: Side-by-side layout that breaks on mobile
<div className="flex justify-between gap-4">
  <span className="text-lg">{formatCurrency(amount, currency)}</span>
  <span className="text-sm text-gray-600">{formatCurrency(amountEusd, 'EUSD')}</span>
</div>

// RIGHT: Vertical stack on mobile, horizontal on desktop
<div className="flex flex-col sm:flex-row sm:items-baseline sm:gap-4">
  <span className="font-semibold" style={{ fontSize: 'clamp(0.875rem, 2.5vw, 1.125rem)' }}>
    {formatCurrency(amount, currency)}
  </span>
  <span className="text-gray-600" style={{ fontSize: 'clamp(0.75rem, 2vw, 0.875rem)' }}>
    ≈ {formatCurrency(amountEusd, 'EUSD')}
  </span>
</div>

// ALTERNATIVE: Always inline with separator
<span className="whitespace-nowrap">
  {formatCurrency(amount, currency)}
  <span className="mx-2 text-gray-400">≈</span>
  {formatCurrency(amountEusd, 'EUSD')}
</span>
```

**Phase to address:** Phase 4 (Responsive Typography) - Test on real mobile devices

**Sources:**
- [Tailwind Text Overflow](https://tailwindcss.com/docs/text-overflow)
- [Overflow Content Patterns](https://carbondesignsystem.com/patterns/overflow-content/)

---

### Pitfall 2.3: Accessibility Failure for Screen Readers with Truncated Numbers

**What goes wrong:**
Screen reader announces "twelve million four hundred seventy-five thousand nine hundred thirty-seven point four seven" for visual "12,475,93..." but user hears full number, creating disconnect between visual and auditory UX.

**Why it happens:**
- `text-overflow: ellipsis` is purely visual CSS
- Screen readers read full DOM text content
- No semantic indication of truncation
- Blind users get different information than sighted users

**Warning signs:**
- Accessibility audit fails WCAG 2.1 AA
- Screen reader testing reveals inconsistency
- Low vision users with zoom enabled can't read truncated text

**Prevention strategy:**
```tsx
// WRONG: No accessibility consideration
<div className="overflow-hidden text-ellipsis">
  {amount.toLocaleString()}
</div>

// RIGHT: Proper ARIA labels + visually hidden full value
<div className="relative">
  <div
    className="overflow-hidden text-ellipsis"
    aria-label={`Amount: ${amount.toLocaleString()} ${currency}, equivalent to ${amountEusd.toLocaleString()} EUSD`}
  >
    <span aria-hidden="true">{formatCurrency(amount, currency)}</span>
  </div>
  <span className="sr-only">
    {amount.toLocaleString()} {currency} equals {amountEusd.toLocaleString()} EUSD
  </span>
</div>

// BEST: Avoid truncation for critical financial data
// Use responsive font sizing that always shows full number
```

**Phase to address:** Phase 4 (Responsive Typography) + Phase 7 (Accessibility QA)

**Sources:**
- [The Ballad of Text Overflow](https://www.tpgi.com/the-ballad-of-text-overflow/)
- [Font Size Requirements WCAG 2.1](https://font-converters.com/accessibility/font-size-requirements)

---

## 3. Two-Step Selector Pitfalls

### Pitfall 3.1: Form State Race Condition When Parent Selector Changes

**What goes wrong:**
User selects "Purchase Order PO-2025-00042" in first dropdown, child dropdown populates with 5 line items, user selects "Item: Laptop". Then user changes parent to "PO-2025-00043", but form still shows "Item: Laptop" (which doesn't exist in the new PO). Form submits with invalid data.

**Why it happens:**
- React Hook Form doesn't automatically clear child field when parent changes
- `useWatch` triggers child data fetch but doesn't reset child value
- Validation only checks "is a line item selected" not "is it from current PO"

**Warning signs:**
- Database foreign key violation on form submit
- User reports "selected item disappeared after changing PO"
- Form validation passes but API returns 400 error

**Prevention strategy:**
```tsx
// WRONG: Child field not cleared on parent change
const selectedPO = watch('purchase_order_id');

useEffect(() => {
  if (selectedPO) {
    fetchLineItems(selectedPO);
  }
}, [selectedPO]);

// RIGHT: Reset child field when parent changes
const selectedPO = watch('purchase_order_id');
const previousPO = useRef(selectedPO);

useEffect(() => {
  if (selectedPO !== previousPO.current) {
    setValue('line_item_id', null); // Clear child selection
    previousPO.current = selectedPO;
  }

  if (selectedPO) {
    fetchLineItems(selectedPO);
  }
}, [selectedPO, setValue]);

// ALTERNATIVE: Use React Hook Form's built-in dependencies
register('line_item_id', {
  validate: (value) => {
    if (!value) return 'Please select a line item';
    const lineItem = lineItems.find(li => li.id === value);
    return lineItem?.purchase_order_id === selectedPO || 'Invalid line item for selected PO';
  }
});
```

**Phase to address:** Phase 5 (Two-Step Selector) - Form component implementation

**Sources:**
- [React Hook Form Cascading Dropdown](https://github.com/orgs/react-hook-form/discussions/5068)
- [Build Dynamic Dependent Dropdown](https://dev.to/jps27cse/build-dynamic-dependent-dropdown-using-react-js-3d9c)

---

### Pitfall 3.2: Disabled State Not Obvious Enough for Second Dropdown

**What goes wrong:**
User opens invoice creation form, second dropdown (line items) appears enabled but empty. User clicks it, nothing happens. User reports "line items dropdown is broken."

**Why it happens:**
- First dropdown (PO) starts empty, no selection
- Second dropdown enabled state based on `selectedPO !== null`
- Visual disabled state too subtle (slightly grayed out vs fully disabled)
- No helper text explaining dependency

**Warning signs:**
- User support tickets: "dropdown won't open" or "no items to select"
- UX testing shows users clicking disabled dropdowns repeatedly
- Accessibility audit flags unclear disabled states

**Prevention strategy:**
```tsx
// WRONG: Subtle disabled state with no explanation
<Select
  disabled={!selectedPO}
  options={lineItems}
  placeholder="Select line item"
/>

// RIGHT: Obvious disabled state + helper text
<div className="space-y-1">
  <Select
    disabled={!selectedPO}
    options={lineItems}
    placeholder={selectedPO ? "Select line item" : "Select a PO first"}
    className={!selectedPO ? "opacity-50 cursor-not-allowed" : ""}
  />
  {!selectedPO && (
    <p className="text-sm text-amber-600 flex items-center gap-1">
      <InfoIcon className="h-4 w-4" />
      Select a purchase order above to load available line items
    </p>
  )}
</div>

// ALTERNATIVE: Hide second dropdown until parent selected
{selectedPO && (
  <Select
    label="Line Item *"
    options={lineItems}
    {...register('line_item_id')}
  />
)}
```

**Phase to address:** Phase 5 (Two-Step Selector) - UX design

**Sources:**
- [Cascading Dropdown in React](https://cluemediator.com/cascading-dropdown-in-react)
- [How to Build Dependent Dropdowns](https://www.freecodecamp.org/news/how-to-build-dependent-dropdowns-in-react/)

---

### Pitfall 3.3: Loading State Confusion When Fetching Child Options

**What goes wrong:**
User selects PO in first dropdown, second dropdown shows old line items from previous PO for 500ms while new data fetches, then suddenly swaps to new items. User already clicked wrong item.

**Why it happens:**
- `useEffect` fetches child data asynchronously
- UI doesn't show loading state during fetch
- Stale data remains visible until new data arrives
- React batching delays re-render

**Warning signs:**
- User reports "selected item but it changed to something else"
- Race condition bugs in production logs
- Form submissions with mismatched parent-child IDs

**Prevention strategy:**
```tsx
// WRONG: No loading state, stale data visible
const [lineItems, setLineItems] = useState([]);

useEffect(() => {
  if (selectedPO) {
    fetchLineItems(selectedPO).then(setLineItems);
  }
}, [selectedPO]);

// RIGHT: Show loading state, clear stale data immediately
const [lineItems, setLineItems] = useState([]);
const [isLoadingLineItems, setIsLoadingLineItems] = useState(false);

useEffect(() => {
  if (selectedPO) {
    setIsLoadingLineItems(true);
    setLineItems([]); // Clear immediately
    setValue('line_item_id', null); // Clear selection

    fetchLineItems(selectedPO)
      .then(setLineItems)
      .finally(() => setIsLoadingLineItems(false));
  } else {
    setLineItems([]);
  }
}, [selectedPO, setValue]);

return (
  <Select
    disabled={isLoadingLineItems || !selectedPO}
    options={lineItems}
    placeholder={isLoadingLineItems ? "Loading..." : "Select line item"}
    isLoading={isLoadingLineItems}
  />
);
```

**Phase to address:** Phase 5 (Two-Step Selector) - Error handling and UX

**Sources:**
- [React Hook Form Form State](https://www.react-hook-form.com/api/useform/formstate/)
- [Managing Forms with React Hook Form](https://claritydev.net/blog/managing-forms-with-react-hook-form)

---

### Pitfall 3.4: Edit Mode Initialization Timing Issue

**What goes wrong:**
User opens "Edit Invoice" page with existing PO and line item selected. First dropdown shows correct PO, but second dropdown is empty. Changing PO makes line items appear.

**Why it happens:**
- Form initializes with `setValue('purchase_order_id', existingPO)` and `setValue('line_item_id', existingItem)`
- `useEffect` watches `selectedPO` but initial value set before component mount doesn't trigger effect
- Line items never fetched for pre-selected PO

**Warning signs:**
- Edit forms show empty child dropdowns on load
- Creating works, editing broken
- Browser console shows "useEffect ran 0 times" on edit page load

**Prevention strategy:**
```tsx
// WRONG: useEffect doesn't run on initial value
const selectedPO = watch('purchase_order_id');

useEffect(() => {
  if (selectedPO) {
    fetchLineItems(selectedPO); // Never runs if selectedPO set before mount
  }
}, [selectedPO]);

// RIGHT: Separate initial fetch + watch for changes
const selectedPO = watch('purchase_order_id');
const isEditMode = !!initialData;

// Initial fetch for edit mode
useEffect(() => {
  if (isEditMode && initialData.purchase_order_id) {
    fetchLineItems(initialData.purchase_order_id);
  }
}, [isEditMode, initialData.purchase_order_id]);

// Watch for subsequent changes
useEffect(() => {
  if (!isEditMode && selectedPO) {
    fetchLineItems(selectedPO);
  }
}, [selectedPO, isEditMode]);

// ALTERNATIVE: Use defaultValues + separate effect
const { control, setValue } = useForm({
  defaultValues: async () => {
    if (invoiceId) {
      const data = await fetchInvoice(invoiceId);
      const lineItems = await fetchLineItems(data.purchase_order_id);
      setLineItems(lineItems); // Pre-populate child options
      return data;
    }
    return {};
  }
});
```

**Phase to address:** Phase 5 (Two-Step Selector) - Edit mode testing

**Sources:**
- [Cascading Dropdown Edit Mode](https://github.com/orgs/react-hook-form/discussions/5068)
- [React Hook Form Advanced Usage](https://www.react-hook-form.com/advanced-usage/)

---

## 4. Currency Unification Pitfalls

### Pitfall 4.1: Floating Point Precision Loss in Currency Calculations

**What goes wrong:**
User enters "9.95 USD" with exchange rate "1350.00". System calculates EUSD as "0.0073703703703..." then rounds to "0.01 EUSD". Later recalculation shows "0.00 EUSD". Financial reports don't match.

**Why it happens:**
- JavaScript uses IEEE 754 floating point: `0.1 + 0.2 !== 0.3`
- QM System uses DECIMAL(15,2) in database but JavaScript numbers in frontend
- Intermediate calculations (`amount / exchange_rate`) lose precision
- Multiple round-trips between DB and frontend compound errors

**Warning signs:**
- Financial totals off by 0.01 - 0.05
- "Sum of EUSD doesn't match total EUSD" in reports
- Database has `9.949999999` or `10.0000001` instead of `10.00`

**Prevention strategy:**
```typescript
// WRONG: JavaScript floating point math
const amountEusd = (amount / exchangeRate).toFixed(2);
// 9.95 / 1350 = 0.007370370370370371 → "0.01"
// But next calculation might give "0.00" due to rounding

// WRONG: PostgreSQL DECIMAL but JS calculations
const result = await db.query(
  `SELECT ${amount} / ${exchangeRate} as amount_eusd` // Uses DECIMAL math
);
const displayValue = result.amount_eusd * 1.1; // Converts to JS float, loses precision

// RIGHT: Use integer-based currency (cents/smallest unit)
// Store 995 cents instead of 9.95 dollars
const amountCents = 995;
const exchangeRate = 1350;
const amountEusdCents = Math.round((amountCents * 10000) / exchangeRate);
// 995 * 10000 / 1350 = 7370 → 0.7370 EUSD

// RIGHT: Use Decimal.js library for JavaScript calculations
import Decimal from 'decimal.js';

Decimal.set({ precision: 20, rounding: Decimal.ROUND_HALF_UP });
const amountEusd = new Decimal(amount)
  .dividedBy(new Decimal(exchangeRate))
  .toDecimalPlaces(2)
  .toNumber();

// BEST: Do ALL calculations in PostgreSQL, never in JavaScript
const { data } = await supabase.rpc('calculate_eusd', {
  p_amount: amount,
  p_currency: currency,
  p_exchange_rate: exchangeRate
});
// PostgreSQL function uses NUMERIC type, maintains precision
```

**Phase to address:** Phase 6 (Currency Unification) - Architecture decision

**Sources:**
- [Floats Don't Work for Storing Cents](https://www.moderntreasury.com/journal/floats-dont-work-for-storing-cents)
- [Why Never Use Float for Money](https://dzone.com/articles/never-use-float-and-double-for-monetary-calculatio)

---

### Pitfall 4.2: Currency Cascade Breaking Existing Invoice Independence

**What goes wrong:**
Invoice created with "USD 2100.00" at rate "7.14" (15,000 MMK equivalent). Later, PO currency changed to "EUR" and rate updated to "8.50". Existing invoice recalculates, now shows wrong EUSD equivalent.

**Why it happens:**
- QM System PRD states: "Invoice currency and exchange rate are independent from PO"
- V1.5 currency unification introduces cascade/inheritance from parent
- Existing invoices have NULL currency (inherited from PO before)
- Migration adds `currency` column with DEFAULT from parent → overwrites intentional independence

**Warning signs:**
- Audit reports show currency values changing on old invoices
- User complaints: "My approved invoice amount changed"
- Database migration fails constraint checks

**Prevention strategy:**
```sql
-- WRONG: Naively add currency cascade
ALTER TABLE invoices ADD COLUMN currency TEXT;
UPDATE invoices SET currency = (
  SELECT currency FROM purchase_orders WHERE id = invoices.purchase_order_id
); -- This overwrites independence!

-- RIGHT: Preserve existing independence, only cascade for new records
-- Step 1: Add column with NULL allowed
ALTER TABLE invoices ADD COLUMN currency TEXT;

-- Step 2: Backfill ONLY if invoice truly inherited (created before currency tracking)
UPDATE invoices
SET currency = po.currency
FROM purchase_orders po
WHERE invoices.purchase_order_id = po.id
  AND invoices.created_at < '2025-01-15' -- Before v1.4 currency independence
  AND invoices.currency IS NULL;

-- Step 3: For newer invoices, keep their explicit currency
-- (Don't update rows where currency should have been set explicitly)

-- Step 4: Add constraint for future inserts
ALTER TABLE invoices
  ALTER COLUMN currency SET NOT NULL; -- Only after backfill
```

**Phase to address:** Phase 6 (Currency Unification) - Migration design + regression testing

---

### Pitfall 4.3: Exchange Rate Inheritance Overriding User Intent

**What goes wrong:**
User creates invoice from PO with exchange rate "1350 MMK/USD". Before submitting invoice, exchange rate changes to "1355 MMK/USD" (daily market rate update). Form auto-refreshes, replaces user's entered rate, calculations change, user doesn't notice.

**Why it happens:**
- Currency unification implements "inherit from parent" as live/reactive
- Form watches parent entity, re-fetches on any change
- User entered rate gets overwritten by inherited rate
- No confirmation dialog when external change overwrites user input

**Warning signs:**
- User reports "I entered one rate but invoice saved with different rate"
- Financial audits show invoices with today's rate despite being created yesterday
- Unit tests pass but E2E tests fail with timing issues

**Prevention strategy:**
```tsx
// WRONG: Always inherit parent rate reactively
const selectedPO = watch('purchase_order_id');

useEffect(() => {
  if (selectedPO) {
    const po = purchaseOrders.find(p => p.id === selectedPO);
    setValue('currency', po.currency); // Overwrites user choice
    setValue('exchange_rate', po.exchange_rate);
  }
}, [selectedPO]);

// RIGHT: Inherit only on initial selection, warn on conflicts
const selectedPO = watch('purchase_order_id');
const [userModifiedRate, setUserModifiedRate] = useState(false);

useEffect(() => {
  if (selectedPO && !userModifiedRate) {
    const po = purchaseOrders.find(p => p.id === selectedPO);
    setValue('currency', po.currency);
    setValue('exchange_rate', po.exchange_rate, { shouldDirty: false });
  }
}, [selectedPO, userModifiedRate]);

// Mark as user-modified when manual edit
<Input
  {...register('exchange_rate', {
    onChange: () => setUserModifiedRate(true)
  })}
/>

// Show warning if PO rate differs from user's entered rate
{userModifiedRate && poExchangeRate !== currentRate && (
  <Alert variant="warning">
    Your rate ({currentRate}) differs from PO rate ({poExchangeRate}).
    <button onClick={() => setValue('exchange_rate', poExchangeRate)}>
      Use PO rate instead
    </button>
  </Alert>
)}
```

**Phase to address:** Phase 6 (Currency Unification) - UX design for inheritance behavior

**Sources:**
- [Cascading Failures in Financial Systems](https://www.sciencedirect.com/science/article/pii/S0167637724000580)
- [Commercial Spreads Hidden Errors](https://www.besmartee.com/blog/commercial-spreads-hidden-errors/)

---

### Pitfall 4.4: EUSD Recalculation Cascade Without Audit Trail

**What goes wrong:**
Admin updates exchange rate for "MMK" from 1350 to 1360. System recalculates all `amount_eusd` columns across 500 invoices, 200 POs, 1000 line items. Audit log shows 1700 "update" actions with full JSONB diff, making audit_logs table explode in size. No way to distinguish "recalculation" from "user edited amount."

**Why it happens:**
- QM System uses generated columns: `amount_eusd GENERATED ALWAYS AS (amount / exchange_rate)`
- Currency unification changes this to function-based: `UPDATE items SET amount_eusd = calculate_eusd(amount, currency)`
- Generic audit trigger logs every UPDATE
- No distinction between "data change" vs "calculation change"

**Warning signs:**
- Audit table grows 10x after exchange rate update
- History tab shows "Updated financial_transaction" for every row even though user only changed rate once
- Database storage alert triggers

**Prevention strategy:**
```sql
-- WRONG: Trigger cascading updates that audit everything
CREATE FUNCTION update_all_eusd_for_currency(p_currency TEXT, p_new_rate DECIMAL)
RETURNS VOID AS $$
BEGIN
  UPDATE invoices SET exchange_rate = p_new_rate WHERE currency = p_currency;
  -- Triggers audit log for every invoice! 500 audit entries
END;
$$ LANGUAGE plpgsql;

-- RIGHT: Use generated columns (no audit) or single audit entry for cascade
CREATE FUNCTION update_all_eusd_for_currency(p_currency TEXT, p_new_rate DECIMAL)
RETURNS VOID AS $$
BEGIN
  -- Single audit entry for the exchange rate change
  INSERT INTO audit_logs (entity_type, action, changes_summary)
  VALUES ('exchange_rates', 'update',
    format('Updated %s rate to %s, affecting %s invoices',
      p_currency, p_new_rate,
      (SELECT COUNT(*) FROM invoices WHERE currency = p_currency)
    )
  );

  -- Update without triggering per-row audits
  ALTER TABLE invoices DISABLE TRIGGER invoices_audit;
  UPDATE invoices SET exchange_rate = p_new_rate WHERE currency = p_currency;
  ALTER TABLE invoices ENABLE TRIGGER invoices_audit;
END;
$$ LANGUAGE plpgsql;

-- BEST: Keep GENERATED columns, never recalculate old records
-- amount_eusd always reflects historical rate at time of transaction
```

**Phase to address:** Phase 6 (Currency Unification) - Audit strategy design

---

## 5. Integration Pitfalls (System-Wide)

### Pitfall 5.1: Polymorphic Comments Breaking Existing RLS Helper Functions

**What goes wrong:**
Adding comments table with RLS policy that calls `owns_qmrl(entity_id)` helper function. Existing QMRL detail page loads slow (2-3s), query EXPLAIN shows function called 10x per query.

**Why it happens:**
- QM System has 6 existing RLS helper functions: `get_user_role()`, `owns_qmrl()`, `owns_qmhq()`, etc.
- New comments table RLS policy adds CASE statement calling these functions
- PostgreSQL query planner can't optimize function calls in RLS (not LEAKPROOF)
- Each page load: 1 query for qmrl + 1 for comments = 2 policy evaluations = 20 function calls

**Warning signs:**
- Database CPU usage doubles after comments deployment
- Query planner shows nested loop with function calls
- `pg_stat_statements` shows `owns_qmrl()` called 10,000 times per hour

**Prevention strategy:**
```sql
-- EXISTING: Helper function (not LEAKPROOF)
CREATE FUNCTION owns_qmrl(qmrl_id UUID) RETURNS BOOLEAN AS $$
  SELECT requester_id = auth.uid() FROM qmrl WHERE id = qmrl_id;
$$ LANGUAGE sql STABLE;

-- NEW COMMENTS RLS: Naive approach (slow)
CREATE POLICY comments_select ON comments FOR SELECT USING (
  (entity_type = 'qmrl' AND owns_qmrl(entity_id))
  OR (entity_type = 'qmhq' AND owns_qmhq(entity_id))
);

-- BETTER: Inline RLS logic, avoid function calls
CREATE POLICY comments_select ON comments FOR SELECT USING (
  deleted_at IS NULL AND (
    get_user_role() IN ('admin', 'quartermaster', 'proposal', 'frontline')
    OR (
      entity_type = 'qmrl' AND EXISTS (
        SELECT 1 FROM qmrl WHERE id = entity_id AND requester_id = auth.uid()
      )
    )
    OR (
      entity_type = 'qmhq' AND EXISTS (
        SELECT 1 FROM qmhq q
        JOIN qmrl r ON q.qmrl_id = r.id
        WHERE q.id = entity_id AND r.requester_id = auth.uid()
      )
    )
  )
);

-- BEST: Mark helper functions as LEAKPROOF (requires careful security review)
CREATE FUNCTION owns_qmrl(qmrl_id UUID) RETURNS BOOLEAN AS $$
  SELECT requester_id = auth.uid() FROM qmrl WHERE id = qmrl_id;
$$ LANGUAGE sql STABLE LEAKPROOF; -- Only if security reviewed!
```

**Phase to address:** Phase 2 (Database Schema) - RLS performance testing before deployment

**Sources:**
- [Common Postgres RLS Footguns](https://www.bytebase.com/blog/postgres-row-level-security-footguns/)
- [PostgreSQL RLS Limitations](https://www.bytebase.com/blog/postgres-row-level-security-limitations-and-alternatives/)

---

### Pitfall 5.2: Adding Currency Fields to 15+ Tables Without Migration Rollback Plan

**What goes wrong:**
Migration 051 adds `currency` and `exchange_rate` columns to invoices, line_items, financial_transactions, items, etc. Migration fails on line_items table (constraint violation). Rollback script doesn't exist. Production database stuck in partial state.

**Why it happens:**
- Currency unification touches many tables simultaneously
- Migration script assumes all data is clean (some rows have NULL amounts)
- No dry-run testing on production-like dataset
- No rollback script prepared

**Warning signs:**
- Migration takes >5 minutes (should be <30s)
- Production deploy fails halfway through migration
- Cannot rollback without manual SQL intervention

**Prevention strategy:**
```bash
# WRONG: Single migration file, no rollback
# 051_currency_unification.sql (3000 lines)
ALTER TABLE invoices ADD COLUMN currency TEXT;
ALTER TABLE line_items ADD COLUMN currency TEXT;
-- ... 15 more tables
-- No down migration!

# RIGHT: Incremental migrations with explicit rollbacks
# 051_currency_invoices.sql
ALTER TABLE invoices ADD COLUMN currency TEXT;

# 051_currency_invoices_down.sql
ALTER TABLE invoices DROP COLUMN currency;

# 052_currency_line_items.sql (separate file)
ALTER TABLE line_items ADD COLUMN currency TEXT;

# Test rollback in staging BEFORE production deploy
psql staging_db < 051_currency_invoices.sql
psql staging_db < 052_currency_line_items.sql
# Rollback test
psql staging_db < 052_currency_line_items_down.sql
psql staging_db < 051_currency_invoices_down.sql

# BEST: Feature flags for gradual rollout
ALTER TABLE invoices ADD COLUMN currency TEXT; -- Deploy
-- Don't use in app yet, behind feature flag
-- Week 1: Enable for test department
-- Week 2: Enable for all departments
-- Week 3: Make NOT NULL after data validated
```

**Phase to address:** Phase 6 (Currency Unification) - Migration planning

---

### Pitfall 5.3: Two-Step Selectors Reusing Wrong Data Fetching Hooks

**What goes wrong:**
Invoice form uses new two-step selector (PO → Line Items). Developer copies code from existing PO create form which fetches "open POs only." Invoice creation fails because user wants to invoice a closed PO (edge case: void invoice, re-invoice).

**Why it happens:**
- QM System has existing hooks: `useOpenPurchaseOrders()`, `useWarehouses()`, etc.
- New two-step selector copies pattern without understanding filter logic
- Business rule mismatch: PO create needs "open POs", Invoice needs "all POs with uninvoiced items"

**Warning signs:**
- User reports "Can't select my PO in invoice form"
- Filter shows 5 POs but user has 10 POs
- E2E test fails: "Expected PO-2025-00042 in dropdown, not found"

**Prevention strategy:**
```typescript
// WRONG: Reuse existing hook without checking filters
import { useOpenPurchaseOrders } from '@/lib/hooks/usePurchaseOrders';

function InvoiceForm() {
  const { data: purchaseOrders } = useOpenPurchaseOrders(); // Only open POs!
  // ...
}

// RIGHT: Create specific hook with correct business logic
function useInvoiceablePurchaseOrders() {
  return useQuery(['invoiceable-pos'], async () => {
    const { data } = await supabase
      .from('purchase_orders')
      .select(`
        *,
        line_items:po_line_items(quantity, invoiced_quantity)
      `)
      .not('status', 'eq', 'cancelled') // Allow closed POs if partially invoiced
      .order('created_at', { ascending: false });

    // Filter to POs with uninvoiced quantities
    return data?.filter(po => {
      const totalQuantity = po.line_items.reduce((sum, li) => sum + li.quantity, 0);
      const invoicedQuantity = po.line_items.reduce((sum, li) => sum + li.invoiced_quantity, 0);
      return invoicedQuantity < totalQuantity;
    }) || [];
  });
}
```

**Phase to address:** Phase 5 (Two-Step Selector) - Requirements review

---

### Pitfall 5.4: Responsive Typography Breaking Existing Table Layouts

**What goes wrong:**
Invoice list table shows "Amount", "EUSD", "Status" columns. After adding responsive font sizing with `clamp()`, "EUSD" column text overlaps with "Status" column on tablets (768px width).

**Why it happens:**
- Existing table uses fixed column widths
- New responsive font sizing makes text grow on certain viewport widths
- CSS `clamp(0.75rem, 2.5vw, 1rem)` hits 2.5vw = 19.2px at 768px (larger than expected)
- No responsive table testing in QA process

**Warning signs:**
- Tablet screenshots show overlapping text
- Horizontal scroll appears on mobile (table too wide)
- Column alignment broken on certain viewport widths only

**Prevention strategy:**
```tsx
// WRONG: Apply responsive font sizing without testing layout impact
<td className="px-4 py-2" style={{ fontSize: 'clamp(0.75rem, 2.5vw, 1rem)' }}>
  {formatCurrency(amountEusd, 'EUSD')}
</td>

// RIGHT: Test on real devices + use container queries
<table className="@container">
  <td className="px-2 py-2 @md:px-4">
    <span className="block @md:inline" style={{ fontSize: 'clamp(0.75rem, 1.5vw, 0.875rem)' }}>
      {formatCurrency(amountEusd, 'EUSD')}
    </span>
  </td>
</table>

// ALTERNATIVE: Use Tailwind responsive classes instead of clamp
<td className="px-2 py-2 text-xs sm:text-sm md:text-base">
  {formatCurrency(amountEusd, 'EUSD')}
</td>

// QA Checklist:
// - Test on real iPhone SE (375px)
// - Test on real iPad (768px)
// - Test on desktop (1920px)
// - Test with Chrome DevTools device emulation is NOT sufficient
```

**Phase to address:** Phase 4 (Responsive Typography) - QA on real devices

---

### Pitfall 5.5: Comments Notification Spam from Audit System

**What goes wrong:**
Every comment post triggers audit log entry. Admin has email notification enabled for all audit logs. Users post 50 comments in busy day. Admin receives 50 emails: "New audit log: Created new comment."

**Why it happens:**
- Existing system: audit logs trigger email notifications for admins
- Comments are high-frequency, not business-critical
- No differentiation between "critical audit event" (invoice voided) vs "routine event" (comment posted)

**Warning signs:**
- Admin complaints: "Too many emails"
- Notification system rate-limited or flagged as spam
- Important audit notifications buried in comment noise

**Prevention strategy:**
```sql
-- WRONG: Treat all audit events equally
CREATE TRIGGER comments_audit AFTER INSERT ON comments
FOR EACH ROW EXECUTE FUNCTION create_audit_log();
-- Sends notification for every comment!

-- RIGHT: Categorize audit events by importance
ALTER TABLE audit_logs ADD COLUMN severity TEXT
  CHECK (severity IN ('critical', 'important', 'routine'));

CREATE FUNCTION create_audit_log_with_severity(severity_level TEXT)
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO audit_logs (entity_type, action, severity, ...)
  VALUES (TG_TABLE_NAME, ..., severity_level, ...);
END;
$$ LANGUAGE plpgsql;

-- Comments are routine
CREATE TRIGGER comments_audit AFTER INSERT ON comments
FOR EACH ROW EXECUTE FUNCTION create_audit_log_with_severity('routine');

-- Invoices are critical
CREATE TRIGGER invoices_audit AFTER INSERT OR UPDATE ON invoices
FOR EACH ROW EXECUTE FUNCTION create_audit_log_with_severity('critical');

-- Notification logic filters by severity
-- Only send email for 'critical' and 'important', not 'routine'
```

**Phase to address:** Phase 3 (Comments UI) - Notification strategy design

---

## Summary and Recommendations

### Phase-Specific Risk Matrix

| Phase | High-Risk Pitfalls | Mitigation |
|-------|-------------------|------------|
| **Phase 2: Database Schema** | 1.1 (RLS Performance), 1.2 (Audit Explosion), 4.1 (Float Precision), 5.1 (RLS Integration) | Design RLS correctly first time, use LEAKPROOF functions, test with 10K+ comments, use DECIMAL not float |
| **Phase 3: Comments UI** | 1.4 (N+1 Queries), 1.5 (React Keys), 5.5 (Notification Spam) | Use nested selects, stable keys, audit severity levels |
| **Phase 4: Responsive Typography** | 2.1 (Number Overflow), 2.2 (EUSD Hidden), 2.3 (A11y), 5.4 (Table Layout) | Test on real devices, always show EUSD, add tooltips |
| **Phase 5: Two-Step Selector** | 3.1 (Race Condition), 3.3 (Loading State), 3.4 (Edit Mode), 5.3 (Wrong Hooks) | Clear child on parent change, show loading, test edit mode |
| **Phase 6: Currency Unification** | 4.1 (Precision Loss), 4.2 (Breaking Independence), 4.3 (Rate Override), 4.4 (Recalc Cascade), 5.2 (Migration Rollback) | Use Decimal.js, preserve independence, warn on conflicts, incremental migrations |

### Testing Requirements

**Must-Have Tests Before Production:**
1. RLS performance test with 10,000+ comments
2. Responsive typography on real devices (iPhone SE, iPad, desktop)
3. Two-step selector edit mode initialization
4. Currency precision: round-trip DB → JS → DB maintains 2 decimals
5. Migration rollback on staging environment

### Open Research Questions

1. **Comments Depth Limit:** Should replies be limited to 2 levels (Reddit-style) or unlimited (Slack-style)?
   - **Impact on:** Query performance, UI complexity
   - **Research needed:** User behavior analysis, competitor benchmarking

2. **Currency Historical Rates:** Should system store exchange rate snapshots for old transactions?
   - **Impact on:** Migration complexity, report accuracy
   - **Research needed:** Financial audit requirements, compliance needs

3. **Responsive Typography Breakpoints:** Are Tailwind defaults sufficient or does QM need custom breakpoints?
   - **Impact on:** Design system consistency
   - **Research needed:** Analytics on user device distribution

---

## Sources

### Comments System
- [Polymorphic Associations Database Design](https://patrickkarsh.medium.com/polymorphic-associations-database-design-basics-17faf2eb313)
- [PostgreSQL Nested Comments Performance](https://www.slingacademy.com/article/postgresql-efficiently-store-comments-nested-comments/)
- [Scaling Threaded Comments at Disqus](https://cra.mr/2010/05/30/scaling-threaded-comments-on-django-at-disqus/)
- [PostgreSQL RLS Implementation Guide](https://www.permit.io/blog/postgres-rls-implementation-guide)
- [Common Postgres RLS Footguns](https://www.bytebase.com/blog/postgres-row-level-security-footguns/)
- [Why Soft Delete Can Backfire](https://dev.to/mrakdon/why-soft-delete-can-backfire-on-data-consistency-4epl)
- [React Key Prop Best Practices](https://www.developerway.com/posts/react-key-attribute)

### Responsive Typography
- [CSS Clamp for Financial Numbers](https://css-tricks.com/linearly-scale-font-size-with-css-clamp-based-on-the-viewport/)
- [Design for Truncation](https://medium.com/design-bootcamp/design-for-truncation-946951d5b6b8)
- [The Ballad of Text Overflow](https://www.tpgi.com/the-ballad-of-text-overflow/)
- [Font Size Requirements WCAG](https://font-converters.com/accessibility/font-size-requirements)

### Two-Step Selectors
- [How to Build Dependent Dropdowns in React](https://www.freecodecamp.org/news/how-to-build-dependent-dropdowns-in-react/)
- [React Hook Form Cascading Dropdown](https://github.com/orgs/react-hook-form/discussions/5068)
- [Managing Forms with React Hook Form](https://claritydev.net/blog/managing-forms-with-react-hook-form)

### Currency Unification
- [Floats Don't Work for Storing Cents](https://www.moderntreasury.com/journal/floats-dont-work-for-storing-cents)
- [Never Use Float for Money](https://dzone.com/articles/never-use-float-and-double-for-monetary-calculatio)
- [Cascading Failures in Financial Systems](https://www.sciencedirect.com/science/article/pii/S0167637724000580)
- [Commercial Spreads Hidden Errors](https://www.besmartee.com/blog/commercial-spreads-hidden-errors/)

### PostgreSQL & Performance
- [PostgreSQL Triggers in 2026](https://thelinuxcode.com/postgresql-triggers-in-2026-design-performance-and-production-reality/)
- [Audit Trigger Performance](https://www.techtarget.com/searchdatamanagement/tip/Pros-and-cons-of-using-SQL-Server-audit-triggers-for-DBAs)
- [Optimizing Postgres RLS](https://scottpierce.dev/posts/optimizing-postgres-rls/)
