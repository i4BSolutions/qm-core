# Domain Pitfalls: v1.3 UX & Bug Fixes

**Domain:** Internal ticket, expense, inventory management system (QM)
**Researched:** 2026-02-02
**Focus:** Bug fixes and UX improvements for existing features

## Executive Summary

This research focuses on common pitfalls when fixing five specific bug categories in the QM system:
1. RLS policy fixes (file_attachments delete policy)
2. Number input behavior fixes (onBlur value changes)
3. Audit display fixes (status change notes not appearing)
4. Currency standardization (inconsistent EUSD display)
5. Stock-out workflow enhancement (QMHQ detail page)

These are "second-order" bugs — fixes that can introduce new bugs if not carefully implemented. The research identifies warning signs, prevention strategies, and which phases need deeper attention.

---

## Critical Pitfalls

Mistakes that cause rewrites, security vulnerabilities, or major data integrity issues.

### Pitfall 1: Missing WITH CHECK in RLS UPDATE Policies

**What goes wrong:**
RLS UPDATE policies require both `USING` (to check if you can access the row) and `WITH CHECK` (to validate the new row state). Missing `WITH CHECK` causes:
- Silent failures where updates appear to work in app but fail at database level
- Error: "new row violates row-level security policy"
- Users with valid permissions unable to perform legitimate updates

**Why it happens:**
- PostgreSQL defaults to using `USING` clause for `WITH CHECK` if not specified, but this creates security gaps
- Developers assume `USING` is sufficient for read+write checks
- Documentation examples often show only `USING` clause

**Consequences:**
- Admin cannot soft-delete files even with correct role
- UPDATE operations fail with cryptic RLS errors
- Security vulnerability: users might update rows they shouldn't based on new state

**Prevention:**
```sql
-- WRONG: Only USING clause
CREATE POLICY file_attachments_update ON public.file_attachments
  FOR UPDATE
  USING (public.get_user_role() IN ('admin', 'quartermaster'));

-- CORRECT: Both USING and WITH CHECK
CREATE POLICY file_attachments_update ON public.file_attachments
  FOR UPDATE
  USING (
    -- Can I access this row in its current state?
    public.get_user_role() IN ('admin', 'quartermaster')
    OR uploaded_by = auth.uid()
  )
  WITH CHECK (
    -- Is the new row state valid?
    public.get_user_role() IN ('admin', 'quartermaster')
    OR uploaded_by = auth.uid()
  );
```

**Detection:**
- UPDATE operations fail with "new row violates row-level security policy"
- Users report "permission denied" even with correct roles
- Soft-delete operations (setting `is_active = false`) fail unexpectedly

**References:**
- [Postgres RLS Implementation Guide](https://www.permit.io/blog/postgres-rls-implementation-guide)
- [PostgreSQL CREATE POLICY Documentation](https://www.postgresql.org/docs/current/sql-createpolicy.html)
- [Supabase RLS Guide](https://supabase.com/docs/guides/database/postgres/row-level-security)

---

### Pitfall 2: UPDATE and INSERT Policies Require SELECT Policies

**What goes wrong:**
Even with correct UPDATE/INSERT policies, operations fail if user cannot SELECT the rows. PostgreSQL needs to:
- For UPDATE: SELECT the row before updating it
- For INSERT: SELECT the newly inserted row to return it to client

**Why it happens:**
- Documentation emphasizes CRUD operations separately
- Developers assume UPDATE policy is sufficient for updates
- Implicit SELECT requirement not obvious from error messages

**Consequences:**
- UPDATE operations fail silently or return empty results
- INSERT operations succeed but client receives empty response
- Users see "no data" even though data was modified

**Prevention:**
```sql
-- Ensure SELECT policy exists alongside UPDATE/INSERT
CREATE POLICY file_attachments_select ON public.file_attachments
  FOR SELECT USING (
    public.get_user_role() IN ('admin', 'quartermaster', 'inventory')
    OR uploaded_by = auth.uid()
  );

CREATE POLICY file_attachments_update ON public.file_attachments
  FOR UPDATE
  USING (...)
  WITH CHECK (...);
```

**Detection:**
- UPDATE queries return `[]` instead of updated row
- INSERT operations succeed but client sees no data
- RLS-enabled tables show different behavior than RLS-disabled tables

**References:**
- [UPDATE RLS policy requires SELECT RLS policy too](https://github.com/supabase/supabase/issues/28559)
- [Failing to update data because of row level security](https://github.com/PostgREST/postgrest/discussions/1844)

---

### Pitfall 3: Trigger Conditional Logic Order Matters

**What goes wrong:**
In audit trigger functions with multiple conditional branches, the order of IF statements determines which action gets logged. Wrong order causes:
- Status changes logged as generic updates
- Notes field not captured for status changes
- Cascade effects not visible in audit trail

**Why it happens:**
- First matching condition wins, subsequent checks skipped
- Generic UPDATE check comes before specific action checks
- Developers add new conditions at bottom of function

**Consequences:**
- Status change notes disappear (captured in wrong branch)
- Audit history shows "Updated qmrl" instead of "Status changed from X to Y"
- Users cannot see why status changed

**Prevention:**
```sql
-- WRONG: Generic UPDATE first
IF TG_OP = 'UPDATE' THEN
  -- This catches EVERYTHING, including status changes
  audit_action := 'update';
  -- ... log generic update
END IF;

IF OLD.status_id IS DISTINCT FROM NEW.status_id THEN
  -- Never reached because previous IF already handled it
  audit_action := 'status_change';
END IF;

-- CORRECT: Specific checks first, generic last
IF TG_OP = 'UPDATE' THEN
  -- Check for soft delete
  IF OLD.is_active = TRUE AND NEW.is_active = FALSE THEN
    audit_action := 'delete';
    -- ... log soft delete
    RETURN NEW;
  END IF;

  -- Check for void
  IF (OLD.is_voided = FALSE) AND NEW.is_voided = TRUE THEN
    audit_action := 'void';
    -- ... log void with reason
    RETURN NEW;
  END IF;

  -- Check for status change
  IF OLD.status_id IS DISTINCT FROM NEW.status_id THEN
    audit_action := 'status_change';
    -- ... log status change with notes
    RETURN NEW;
  END IF;

  -- LAST: Generic UPDATE for everything else
  audit_action := 'update';
  -- ... log generic update
END IF;
```

**Detection:**
- Status changes appear as generic "Updated qmrl" entries
- Notes field empty in history even though user entered notes
- Specific action types (void, status_change, assignment_change) not appearing

**References:**
- [PostgreSQL Triggers in 2026: Design, Performance, and Production Reality](https://thelinuxcode.com/postgresql-triggers-in-2026-design-performance-and-production-reality/)
- [PostgreSQL Trigger Functions Documentation](https://www.postgresql.org/docs/current/plpgsql-trigger.html)

---

### Pitfall 4: Notes Not Passed to Audit Log Insert

**What goes wrong:**
User enters notes in status change dialog, but notes don't appear in audit log history. The note is collected in UI but never passed to the database UPDATE statement.

**Why it happens:**
- Status change happens via direct UPDATE to entity table
- Audit trigger captures OLD/NEW state but not UI form data
- No mechanism to pass user-provided notes from UI to trigger

**Consequences:**
- Users cannot explain why they changed status
- Audit trail lacks context for important decisions
- Compliance/debugging requires asking users "why did you do this?"

**Prevention:**

**Option A: Add notes column to entity tables**
```sql
-- Add notes column to qmrl, qmhq, etc.
ALTER TABLE qmrl ADD COLUMN status_change_notes TEXT;

-- Update includes notes
UPDATE qmrl SET
  status_id = $1,
  status_change_notes = $2,
  updated_by = $3
WHERE id = $4;

-- Trigger captures status_change_notes
IF OLD.status_id IS DISTINCT FROM NEW.status_id THEN
  INSERT INTO audit_logs (..., notes)
  VALUES (..., NEW.status_change_notes);
END IF;
```

**Option B: Separate audit_log INSERT from UI**
```sql
-- Update entity
UPDATE qmrl SET status_id = $1 WHERE id = $2;

-- Explicitly insert audit log entry with notes
INSERT INTO audit_logs (
  entity_type, entity_id, action,
  field_name, old_value, new_value,
  changes_summary, notes,
  changed_by, changed_by_name, changed_at
) VALUES (
  'qmrl', $2, 'status_change',
  'status_id', $3, $1,
  'Status changed from "..." to "..."', $4, -- $4 is user notes
  $5, $6, NOW()
);
```

**Option C: Use JSONB context in trigger**
```sql
-- Pass context via session variable
SET LOCAL app.status_change_notes = 'User explanation here';

-- Trigger reads from session
CREATE FUNCTION create_audit_log() AS $$
DECLARE
  user_notes TEXT;
BEGIN
  user_notes := current_setting('app.status_change_notes', true);

  INSERT INTO audit_logs (..., notes)
  VALUES (..., user_notes);
END;
$$;
```

**Detection:**
- Notes field in StatusChangeDialog but notes empty in HistoryTab
- User reports "I entered a note but it's not showing"
- Audit log entries have NULL notes even for important changes

**References:**
- [Postgres Audit Logging Guide](https://www.bytebase.com/blog/postgres-audit-logging/)
- [Working with Postgres Audit Triggers](https://www.enterprisedb.com/postgres-tutorials/working-postgres-audit-triggers)

---

## Moderate Pitfalls

Mistakes that cause delays, inconsistent UX, or technical debt.

### Pitfall 5: Controlled Number Input onBlur Timing Issues

**What goes wrong:**
Number inputs formatted on blur can overwrite user-entered values due to React state update timing. User types "1000", blur triggers, value becomes "1,000" or "1000.00", but state update conflicts with previous onChange.

**Why it happens:**
- onBlur fires before final onChange in some browsers (Firefox)
- Formatting logic uses stale state value
- parseFloat/toFixed applied to display value, not raw value

**Consequences:**
- User types "100", blur changes it to "0" or "100.00" unexpectedly
- Cursor position jumps during typing if formatting on onChange
- Value disappears or resets when switching fields

**Prevention:**

**Strategy 1: Store raw value, format for display only**
```tsx
// WRONG: Format on every change
const [amount, setAmount] = useState("");
<Input
  value={amount}
  onChange={(e) => setAmount(parseFloat(e.target.value).toFixed(2))}
/>

// CORRECT: Store raw, format on blur or display
const [amount, setAmount] = useState(""); // raw string
const [displayAmount, setDisplayAmount] = useState("");

<Input
  value={displayAmount || amount}
  onChange={(e) => {
    setAmount(e.target.value); // raw value
    setDisplayAmount(e.target.value);
  }}
  onBlur={() => {
    const num = parseFloat(amount);
    if (!isNaN(num)) {
      setDisplayAmount(num.toFixed(2));
    }
  }}
  onFocus={() => setDisplayAmount(amount)} // Show raw on focus
/>
```

**Strategy 2: Debounce formatting**
```tsx
const [amount, setAmount] = useState("");
const debouncedFormat = useMemo(
  () => debounce((val: string) => {
    const num = parseFloat(val);
    if (!isNaN(num)) setAmount(num.toFixed(2));
  }, 500),
  []
);

<Input
  value={amount}
  onChange={(e) => {
    setAmount(e.target.value);
    debouncedFormat(e.target.value);
  }}
/>
```

**Strategy 3: No formatting in controlled input**
```tsx
// Let database handle precision
const [amount, setAmount] = useState("");

<Input
  type="number"
  step="0.01"
  value={amount}
  onChange={(e) => setAmount(e.target.value)}
  // Format only for display outside input
/>

<div>Preview: {formatCurrency(parseFloat(amount))}</div>
```

**Detection:**
- User reports "number keeps changing when I click away"
- Value becomes "0.00" after entering then leaving field
- Cursor jumps to end while typing decimal values

**References:**
- [The difference between onBlur vs onChange for React text inputs](https://linguinecode.com/post/onblur-vs-onchange-react-text-inputs)
- [Set formatted number value to a Controlled input](https://github.com/orgs/react-hook-form/discussions/9161)
- [useController onBlur overwrites onChange value](https://github.com/react-hook-form/react-hook-form/issues/7007)

---

### Pitfall 6: Inconsistent Currency Display Across Contexts

**What goes wrong:**
EUSD display appears in some places but not others. Exchange rates formatted with different decimal places (sometimes 2, sometimes 4). Currency symbols used inconsistently ($, USD, MMK vs Myanmar Kyat).

**Why it happens:**
- Multiple developers implementing similar features
- No central formatCurrency utility enforcing standards
- Copy-paste from different parts of codebase
- Business rules unclear (when to show EUSD vs local currency)

**Consequences:**
- Users confused about actual vs equivalent amounts
- Financial reports inconsistent
- Audit trail shows different precision (2 vs 4 decimals)
- International users see wrong currency conventions

**Prevention:**

**Strategy 1: Centralized formatting utility**
```typescript
// lib/utils/currency.ts
export function formatAmount(amount: number, decimals: number = 2): string {
  return amount.toLocaleString('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

export function formatCurrency(amount: number, currency: string = 'MMK'): string {
  return `${formatAmount(amount, 2)} ${currency}`;
}

export function formatExchangeRate(rate: number): string {
  return formatAmount(rate, 4); // Always 4 decimals
}

export function formatWithEUSD(
  amount: number,
  currency: string,
  exchangeRate: number
): string {
  const eusd = amount / exchangeRate;
  return `${formatCurrency(amount, currency)} (${formatAmount(eusd, 2)} EUSD)`;
}
```

**Strategy 2: Consistent component pattern**
```tsx
// components/currency/currency-display.tsx
interface CurrencyDisplayProps {
  amount: number;
  currency: string;
  exchangeRate: number;
  showEUSD?: boolean; // default true
}

export function CurrencyDisplay({
  amount,
  currency,
  exchangeRate,
  showEUSD = true
}: CurrencyDisplayProps) {
  const eusd = amount / exchangeRate;

  return (
    <div className="currency-display">
      <span className="amount">{formatCurrency(amount, currency)}</span>
      {showEUSD && (
        <span className="eusd">({formatAmount(eusd, 2)} EUSD)</span>
      )}
    </div>
  );
}
```

**Strategy 3: Database-enforced precision**
```sql
-- Schema enforces precision
amount DECIMAL(15,2), -- Always 2 decimals
exchange_rate DECIMAL(10,4), -- Always 4 decimals
amount_eusd DECIMAL(15,2) GENERATED ALWAYS AS (
  ROUND(amount / exchange_rate, 2)
) STORED
```

**Strategy 4: Design system tokens**
```typescript
// Enforce in component library
const CURRENCY_RULES = {
  amount: { decimals: 2, display: 'always' },
  exchangeRate: { decimals: 4, display: 'always' },
  eusd: { decimals: 2, display: 'always', label: 'EUSD' },
} as const;
```

**Detection:**
- Same amount displayed as "1000.00" in one place, "1,000" in another
- Exchange rates show "1.5" vs "1.5000" inconsistently
- EUSD missing from transaction details but present in list view
- Currency symbols vary ($ vs USD vs dollar icon)

**References:**
- [The UX of Currency Display — What's in a $ Sign?](https://medium.com/workday-design/the-ux-of-currency-display-whats-in-a-sign-6447cbc4fb88)
- [The UX of currency conventions for a global audience](https://bootcamp.uxdesign.cc/the-ux-of-currency-conventions-for-a-global-audience-4098ff66b6ed)
- [Mastering Currency Formats in UX Writing](https://www.numberanalytics.com/blog/ultimate-guide-currency-formats-ux-writing)

---

### Pitfall 7: Stock-Out from Detail Page Context Loss

**What goes wrong:**
Adding stock-out action to QMHQ detail page without proper context leads to:
- User must re-enter item (already shown on page)
- Warehouse not pre-selected even though QMHQ has warehouse
- Quantity defaults to 0 instead of QMHQ quantity
- No link back to originating QMHQ after stock-out completes

**Why it happens:**
- Stock-out form designed for standalone use (inventory page)
- Form doesn't accept URL parameters for pre-fill
- No "return to QMHQ" flow after completing stock-out
- Context (QMHQ ID, item, warehouse) not passed to stock-out page

**Consequences:**
- Poor UX: users re-enter information already on screen
- Data entry errors: wrong item/quantity selected
- Lost context: users unsure how to get back to QMHQ
- Slow workflow: extra clicks and typing

**Prevention:**

**Strategy 1: Modal dialog on same page**
```tsx
// QMHQ detail page
function QMHQDetailPage() {
  const [showStockOut, setShowStockOut] = useState(false);

  return (
    <>
      <Button onClick={() => setShowStockOut(true)}>
        Stock Out
      </Button>

      <StockOutDialog
        open={showStockOut}
        onClose={() => setShowStockOut(false)}
        // Pre-fill from QMHQ context
        itemId={qmhq.item_id}
        warehouseId={qmhq.warehouse_id}
        quantity={qmhq.quantity}
        qmhqId={qmhq.id} // Link back
        onSuccess={() => {
          setShowStockOut(false);
          refreshQMHQ();
        }}
      />
    </>
  );
}
```

**Strategy 2: URL parameters for pre-fill**
```tsx
// Navigate with context
router.push(`/inventory/stock-out?` + new URLSearchParams({
  itemId: qmhq.item_id,
  warehouseId: qmhq.warehouse_id,
  quantity: qmhq.quantity.toString(),
  qmhqId: qmhq.id,
  returnUrl: `/qmhq/${qmhq.id}`,
}));

// Stock-out page reads params
function StockOutPage() {
  const searchParams = useSearchParams();
  const [itemId, setItemId] = useState(searchParams.get('itemId') || '');
  const returnUrl = searchParams.get('returnUrl');

  // After success
  if (returnUrl) router.push(returnUrl);
}
```

**Strategy 3: Breadcrumb context**
```tsx
// Stock-out page shows origin
<Breadcrumb>
  <BreadcrumbItem href="/inventory">Inventory</BreadcrumbItem>
  {qmhqId && (
    <BreadcrumbItem href={`/qmhq/${qmhqId}`}>
      QMHQ-2025-00042
    </BreadcrumbItem>
  )}
  <BreadcrumbItem>Stock Out</BreadcrumbItem>
</Breadcrumb>
```

**Detection:**
- User complains "why do I have to enter the item again?"
- High error rate on stock-out (wrong item/warehouse selected)
- Users click back button instead of using return link
- Support tickets: "I did stock-out but can't find the QMHQ"

**References:**
- [How to Handle Out-of-Stock Products for eComm](https://thegray.company/blog/permanently-temporarily-out-of-stock-products-ecommerce-seo-ux)
- [How to Optimize Out of Stock Product Pages](https://cxl.com/blog/out-of-stock-product-pages/)
- [Boost Sales: Tackling Out-of-Stock Issues with UX Experiments](https://www.quantummetric.com/blog/out-of-stock-ux-conducting-experiments-and-addressing-oos-retail)

---

## Minor Pitfalls

Mistakes that cause annoyance but are easily fixable.

### Pitfall 8: IS DISTINCT FROM vs = for NULL Comparisons

**What goes wrong:**
Trigger conditions use `=` or `!=` for comparisons, missing changes when values are NULL. `NULL = NULL` is `NULL` (not TRUE), so condition never matches.

**Why it happens:**
- SQL beginners use `=` habitually from other languages
- NULL behavior counterintuitive
- Copy-paste from examples that don't handle NULL

**Consequences:**
- Status changes not logged when old status is NULL (initial state)
- Assignment changes missed when unassigning (new value NULL)
- Audit trail incomplete for NULL transitions

**Prevention:**
```sql
-- WRONG: Misses NULL cases
IF OLD.status_id != NEW.status_id THEN
  -- Never true if either is NULL
END IF;

-- CORRECT: Handles NULL properly
IF OLD.status_id IS DISTINCT FROM NEW.status_id THEN
  -- True if values differ OR one is NULL
END IF;
```

**Detection:**
- Initial status changes not appearing in history
- "Unassigned" actions not logged
- Audit logs missing entries for specific transitions

---

### Pitfall 9: Soft Delete Breaks Referential Queries

**What goes wrong:**
Setting `is_active = false` (soft delete) but queries still join to soft-deleted records. User sees:
- Deleted statuses appearing in dropdowns
- Voided transactions in totals
- Inactive items in inventory counts

**Why it happens:**
- Queries written before soft-delete implemented
- Developer forgets to add `WHERE is_active = true`
- Aggregate queries (SUM, COUNT) don't filter soft-deleted

**Consequences:**
- Financial totals include voided transactions
- Status dropdowns show deleted statuses
- Inventory counts include deleted items

**Prevention:**
```sql
-- WRONG: Includes soft-deleted
SELECT SUM(amount) FROM financial_transactions WHERE qmhq_id = $1;

-- CORRECT: Exclude soft-deleted
SELECT SUM(amount)
FROM financial_transactions
WHERE qmhq_id = $1
  AND is_active = true
  AND (is_voided IS NULL OR is_voided = false);
```

**Detection:**
- User reports "deleted status still showing in dropdown"
- Financial totals don't match after voiding transaction
- Items with 0 stock still appearing in warehouse list

---

### Pitfall 10: Exchange Rate Defaults to 0 Instead of 1

**What goes wrong:**
New transaction forms initialize exchange rate to 0, causing:
- Division by zero in EUSD calculation
- Error: "exchange rate must be greater than 0"
- NaN or Infinity displayed

**Why it happens:**
- useState("") or useState(0) for numeric fields
- Form validation triggers before user enters value
- Backend expects number but receives empty string

**Consequences:**
- User sees "Invalid EUSD" immediately on opening form
- Cannot calculate preview until exchange rate entered
- Confusion: "I haven't entered anything yet, why is it erroring?"

**Prevention:**
```tsx
// WRONG: Defaults to 0 or empty
const [exchangeRate, setExchangeRate] = useState("");
const eusd = amount / (parseFloat(exchangeRate) || 0); // Division by zero

// CORRECT: Default to 1 for same-currency
const [exchangeRate, setExchangeRate] = useState("1.0000");
const eusd = amount / (parseFloat(exchangeRate) || 1); // Safe fallback

// Better: Intelligent default based on currency
const [currency, setCurrency] = useState("MMK");
const [exchangeRate, setExchangeRate] = useState(
  getDefaultExchangeRate(currency) // 1.0000 for MMK, fetch for others
);
```

**Detection:**
- Form shows "0 EUSD" or "NaN EUSD" on load
- Console errors: "Cannot divide by zero"
- Users must enter exchange rate even for same-currency transactions

---

## Phase-Specific Warnings

| Phase Topic | Likely Pitfall | Mitigation |
|-------------|---------------|------------|
| RLS Policy Fixes | Missing WITH CHECK clause, no SELECT policy | Audit all UPDATE policies, add WITH CHECK mirroring USING. Verify SELECT policy exists for all tables with UPDATE/INSERT policies. |
| Number Input Fixes | onBlur overwrites onChange, formatting timing | Use separate display vs raw value state. Format only on blur or display, not during typing. Test in Firefox (onBlur timing differs). |
| Audit Display Fixes | Trigger conditional order, notes not captured | Place specific checks (status_change, void) before generic UPDATE. Verify notes flow from UI → UPDATE → trigger → audit_logs. |
| Currency Standardization | Inconsistent decimals, missing EUSD | Create centralized formatCurrency utilities. Use CurrencyDisplay component. Enforce precision in database schema. Add Storybook examples. |
| Stock-Out Enhancement | Context loss, no pre-fill, no return link | Use dialog on same page OR pass URL params. Pre-fill item/warehouse/quantity from QMHQ. Add "Return to QMHQ" breadcrumb/link. |

---

## Quality Checklist

Before merging any fix in this milestone:

**RLS Policy Changes:**
- [ ] UPDATE policy has both USING and WITH CHECK
- [ ] WITH CHECK conditions mirror USING (or stricter)
- [ ] SELECT policy exists for tables with UPDATE/INSERT
- [ ] Test with non-admin user role
- [ ] Verify soft-delete works (is_active = false)

**Number Input Changes:**
- [ ] Separate raw value from display value
- [ ] Format on blur or display, not onChange
- [ ] Prevent negative numbers with onKeyDown
- [ ] Test in Firefox (onBlur timing differs)
- [ ] Default exchange rate to 1.0, not 0

**Audit/Trigger Changes:**
- [ ] Specific checks (status_change, void) before generic UPDATE
- [ ] Use IS DISTINCT FROM for NULL-safe comparisons
- [ ] Verify notes flow from UI to audit_logs
- [ ] Test with NULL values (initial state, unassign)
- [ ] Check trigger ordering (zz_ prefix for last)

**Currency Display Changes:**
- [ ] Use centralized formatCurrency utility
- [ ] Amount: 2 decimals, Exchange Rate: 4 decimals
- [ ] Show EUSD alongside every financial amount
- [ ] Consistent currency symbols (MMK not Myanmar Kyat)
- [ ] Test with various currencies (MMK, USD, THB)

**Stock-Out Workflow Changes:**
- [ ] Pre-fill item, warehouse, quantity from QMHQ
- [ ] Add "Return to QMHQ" link/breadcrumb
- [ ] Link inventory transaction back to QMHQ
- [ ] Show QMHQ context in stock-out form
- [ ] Test round-trip: QMHQ → stock-out → back to QMHQ

---

## Research Confidence

| Area | Confidence | Notes |
|------|------------|-------|
| RLS Pitfalls | HIGH | Official PostgreSQL docs + Supabase guides + verified against existing migrations |
| Number Input Pitfalls | MEDIUM | React-specific, multiple form library patterns. Verified against existing transaction-dialog.tsx code. |
| Audit Trigger Pitfalls | HIGH | Verified against existing create_audit_log() function, trigger ordering confirmed in migrations |
| Currency Standardization | MEDIUM | UX best practices, verified against existing formatCurrency usage. Database schema confirms 2/4 decimal pattern. |
| Stock-Out UX | MEDIUM | General inventory UX patterns. Verified QMHQ detail page has item route but no stock-out action yet. |

---

## Sources

### RLS and PostgreSQL Policies
- [Postgres RLS Implementation Guide - Best Practices, and Common Pitfalls](https://www.permit.io/blog/postgres-rls-implementation-guide)
- [PostgreSQL: Documentation: CREATE POLICY](https://www.postgresql.org/docs/current/sql-createpolicy.html)
- [Row Level Security | Supabase Docs](https://supabase.com/docs/guides/database/postgres/row-level-security)
- [UPDATE RLS policy requires SELECT RLS policy too](https://github.com/supabase/supabase/issues/28559)
- [Failing to update data because of row level security returns [] as response body](https://github.com/PostgREST/postgrest/discussions/1844)

### React Number Inputs
- [The difference between onBlur vs onChange for React text inputs](https://linguinecode.com/post/onblur-vs-onchange-react-text-inputs)
- [Set formatted number value to a Controlled input](https://github.com/orgs/react-hook-form/discussions/9161)
- [useController onBlur overwrites onChange value when used in same render](https://github.com/react-hook-form/react-hook-form/issues/7007)

### PostgreSQL Triggers and Audit Logging
- [PostgreSQL Triggers in 2026: Design, Performance, and Production Reality](https://thelinuxcode.com/postgresql-triggers-in-2026-design-performance-and-production-reality/)
- [PostgreSQL: Documentation: Trigger Functions](https://www.postgresql.org/docs/current/plpgsql-trigger.html)
- [Postgres Audit Logging Guide](https://www.bytebase.com/blog/postgres-audit-logging/)
- [Working with Postgres Audit Triggers](https://www.enterprisedb.com/postgres-tutorials/working-postgres-audit-triggers)

### Currency Display Standards
- [The UX of Currency Display — What's in a $ Sign?](https://medium.com/workday-design/the-ux-of-currency-display-whats-in-a-sign-6447cbc4fb88)
- [The UX of currency conventions for a global audience](https://bootcamp.uxdesign.cc/the-ux-of-currency-conventions-for-a-global-audience-4098ff66b6ed)
- [Mastering Currency Formats in UX Writing](https://www.numberanalytics.com/blog/ultimate-guide-currency-formats-ux-writing)

### Inventory UX Patterns
- [How to Handle Permanently & Temporarily Out-of-Stock Products for eComm](https://thegray.company/blog/permanently-temporarily-out-of-stock-products-ecommerce-seo-ux)
- [How to Optimize Out of Stock Product Pages](https://cxl.com/blog/out-of-stock-product-pages/)
- [Boost Sales: Tackling Out-of-Stock Issues with UX Experiments](https://www.quantummetric.com/blog/out-of-stock-ux-conducting-experiments-and-addressing-oos-retail)
