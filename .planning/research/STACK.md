# Technology Stack: v1.3 UX & Bug Fixes

**Milestone:** v1.3 UX & Bug Fixes
**Researched:** 2026-02-02
**Focus:** Debugging and fixing patterns for existing Next.js/Supabase app

## Executive Summary

This is a **debugging and polishing milestone** for an existing application. The stack remains unchanged (Next.js 14+, Supabase, TypeScript), but this research focuses on specific patterns needed to fix four critical issues:

1. **RLS Policy Debugging** - Attachment delete fails despite correct user permissions
2. **Controlled Input Patterns** - Number inputs change values on blur (5 becomes 4)
3. **Audit Log Context** - Status change notes not captured in audit trail
4. **Currency Display Standardization** - Simplify to original + EUSD only

**No new libraries required.** All fixes use existing stack with corrected patterns.

---

## Issue 1: RLS Policy for Attachment Delete

### Problem

Users (even admins) cannot soft-delete file attachments. Error: "new row violates row-level security policy". The existing RLS UPDATE policy has both USING and WITH CHECK clauses correctly configured, yet the operation fails.

### Root Cause Pattern

**Supabase RLS UPDATE operations perform 4 checks:**
1. SELECT (find target rows) using SELECT policy
2. UPDATE validation using USING clause
3. WITH CHECK validation on updated row
4. SELECT again to return updated row

**The bug:** If your SELECT policy excludes soft-deleted records (e.g., `WHERE deleted_at IS NULL`), then when you UPDATE to set `deleted_at = NOW()`, the row fails the final SELECT check and the operation is rejected.

**Evidence from codebase:**
- Migration 037 allows users to delete their own uploads: `uploaded_by = auth.uid()`
- Migration 036 requires both USING and WITH CHECK for admin/quartermaster
- But if SELECT policy excludes `deleted_at IS NOT NULL`, the updated row becomes invisible

### Solution Pattern

**Option A: Time-Window Pattern**
Allow SELECT to see recently-deleted records for 5 seconds after deletion:

```sql
-- SELECT policy modification
CREATE POLICY file_attachments_select ON public.file_attachments
  FOR SELECT
  USING (
    -- Normal records
    deleted_at IS NULL
    OR
    -- Recently deleted records (5-second window for update confirmation)
    (deleted_at IS NOT NULL AND deleted_at > NOW() - INTERVAL '5 seconds')
  );
```

**Rationale:** The 5-second window allows the UPDATE transaction to complete and return the updated row without violating SELECT policy.

**Option B: Separate Soft-Delete Function**
Use a PostgreSQL function that bypasses row-level checks for the return value:

```sql
CREATE OR REPLACE FUNCTION soft_delete_attachment(attachment_id UUID)
RETURNS VOID
SECURITY DEFINER
AS $$
BEGIN
  UPDATE file_attachments
  SET deleted_at = NOW(),
      deleted_by = auth.uid()
  WHERE id = attachment_id
    AND (
      -- Permission check inline
      get_user_role() IN ('admin', 'quartermaster')
      OR uploaded_by = auth.uid()
    );
END;
$$ LANGUAGE plpgsql;
```

**Rationale:** SECURITY DEFINER functions run with elevated privileges and don't re-check SELECT policies on return values.

**Recommendation:** Use Option A (time-window) for simplicity and consistency with existing RLS patterns in the codebase.

### Debugging Checklist

When RLS UPDATE fails with "new row violates policy":

- [ ] Check if SELECT policy would exclude the updated row
- [ ] Verify both USING and WITH CHECK are defined
- [ ] Test with direct SQL (bypasses client-side checks)
- [ ] Add temporary logging to see which check fails
- [ ] Use `EXPLAIN (ANALYZE, VERBOSE)` to see policy evaluation

### Sources

- [Bug Report: RLS WITH CHECK Clause Fails for Soft Delete](https://github.com/supabase/supabase-js/issues/1941)
- [Fixing Supabase RLS 403 Error: Policy Conflict During UPDATE](https://medium.com/@bloodturtle/fixing-supabase-rls-403-error-policy-conflict-during-update-e2b7c4cb29d6)
- [Row Level Security | Supabase Docs](https://supabase.com/docs/guides/database/postgres/row-level-security)
- [Supabase RLS Troubleshooting Simplified](https://supabase.com/docs/guides/troubleshooting/rls-simplified-BJTcS8)

---

## Issue 2: Number Input On-Blur Value Changes

### Problem

Number inputs with `type="number"` change their displayed value on blur. Example: User types "5", input shows "4" after blur. This happens when `parseFloat(e.target.value)` is called in `onChange`.

**Current buggy pattern (from `po-line-items-table.tsx`):**
```tsx
<Input
  type="number"
  value={item.unit_price}
  onChange={(e) =>
    onUpdateItem(
      item.id,
      "unit_price",
      parseFloat(e.target.value) || 0  // BUG: Immediate parse loses intermediate states
    )
  }
/>
```

### Root Cause Pattern

**Why this fails:**
1. User types "5" → `onChange` fires → `parseFloat("5")` = 5
2. React reconciles: DOM has "5", state has 5, re-renders
3. User blurs → Browser normalizes `type="number"` with `value={5}`
4. If there's any rounding or precision mismatch, browser "corrects" the display

**Additional cursor jumping issue:**
- When `parseFloat` changes the value format (e.g., "5.0" → 5), React updates the DOM
- This resets the cursor position to the end
- Makes editing middle of numbers impossible

### Solution Pattern

**Controlled Input with String State + Numeric Validation**

```tsx
// Component state
const [inputValue, setInputValue] = useState<string>("");  // Display value as string
const [numericValue, setNumericValue] = useState<number>(0); // Validated numeric

// Display value (for input)
<Input
  type="number"
  value={inputValue}
  onChange={(e) => {
    // Accept any string during typing (allows "5.", "-", "0.0", etc.)
    setInputValue(e.target.value);
  }}
  onBlur={(e) => {
    // Parse and validate only on blur
    const parsed = parseFloat(e.target.value);
    const validated = isNaN(parsed) ? 0 : Math.max(0, parsed); // Prevent negative

    setNumericValue(validated);
    setInputValue(validated.toString()); // Normalize display

    // Persist to database/parent state
    onUpdateItem(item.id, "unit_price", validated);
  }}
/>
```

**Rationale:**
- **During typing:** Keep as string, allow intermediate states like "5.", "0.0", "-"
- **On blur:** Validate, normalize, persist
- **Avoids cursor jumping:** String value doesn't change format during typing
- **Single source of truth:** `numericValue` is the validated state, `inputValue` is the display

**Simpler Alternative (if no intermediate states needed):**

```tsx
<Input
  type="number"
  value={item.unit_price}
  onChange={(e) => {
    // Store the raw string, don't parse yet
    const rawValue = e.target.value;
    if (rawValue === "" || rawValue === "-") {
      onUpdateItem(item.id, "unit_price", 0);
    } else {
      const parsed = parseFloat(rawValue);
      if (!isNaN(parsed)) {
        onUpdateItem(item.id, "unit_price", parsed);
      }
    }
  }}
/>
```

**Rationale:** Simpler, but less control over intermediate states.

### Recommended Pattern for QM System

**Use the full controlled pattern for financial inputs** (amounts, exchange rates):
- Amounts need 2 decimal places
- Exchange rates need 4 decimal places
- Users need to type intermediate values like "1500." or "0.00"

**Use the simpler pattern for integer inputs** (quantities):
- Quantities are whole numbers
- No intermediate decimal states needed

### Implementation Checklist

- [ ] Identify all `type="number"` inputs across codebase
- [ ] Separate into two categories: financial (decimal) and quantity (integer)
- [ ] Apply full controlled pattern to financial inputs
- [ ] Apply simpler pattern to quantity inputs
- [ ] Add `step` attribute: `step="0.01"` for amounts, `step="0.0001"` for exchange rates
- [ ] Test: Type partial numbers, blur, verify value preserved

### Sources

- [A number input will always have left pad 0 though parseFloat value in onChange](https://github.com/facebook/react/issues/9402)
- [Cursor jumps to end of controlled input](https://github.com/facebook/react/issues/955)
- [Solving Caret Jumping in React Inputs](https://dev.to/kwirke/solving-caret-jumping-in-react-inputs-36ic)
- [Data formatting / Cursor Positioning in React](https://medium.com/@prijuly2000/data-formatting-cursor-positioning-in-react-86c52008d0fc)
- [The difference between onBlur vs onChange for React text inputs](https://linguinecode.com/post/onblur-vs-onchange-react-text-inputs)

---

## Issue 3: Status Change Notes Not in History Tab

### Problem

Users can add optional notes when changing status (via `StatusChangeDialog`), but these notes don't appear in the History tab. The dialog captures the note, but it's not persisted to the audit log.

**Current flow:**
1. User clicks status badge → opens dropdown
2. Selects new status → `StatusChangeDialog` opens
3. User enters optional note in textarea
4. Clicks "Confirm" → calls `onConfirm()` in `clickable-status-badge.tsx`
5. `onConfirm` updates the entity status directly via Supabase
6. Audit trigger captures the status change automatically
7. **Note is lost** — never passed to audit system

### Root Cause Pattern

**The audit trigger only captures database changes** (old value → new value). The `StatusChangeDialog` note lives in UI state, never reaches the database.

**Evidence from codebase:**
- `status-change-dialog.tsx` line 37: `const [note, setNote] = useState("")` — local state only
- `clickable-status-badge.tsx` line 92-98: Direct UPDATE via Supabase, no note parameter
- `history-tab.tsx` line 346-351: Displays `log.notes` from audit_logs table, but it's always NULL

### Solution Pattern

**Option A: Pass Note Through Update Call (Recommended)**

Modify the status update to include a note field:

```tsx
// In clickable-status-badge.tsx
const handleConfirm = async (note?: string) => {
  // ... existing code ...

  const { error } = await supabase
    .from(tableName)
    .update({
      status_id: selectedStatus.id,
      updated_at: new Date().toISOString(),
      updated_by: user.id,
      status_change_note: note || null,  // NEW: Temporary field for note
    })
    .eq("id", entityId);
};

// In status-change-dialog.tsx
const handleConfirm = async () => {
  await onConfirm(note);  // Pass note to parent
};
```

**Then capture in audit trigger:**

```sql
-- Modify audit trigger function
CREATE OR REPLACE FUNCTION create_audit_log()
RETURNS TRIGGER AS $$
DECLARE
  v_notes TEXT := NULL;
BEGIN
  -- For status changes, extract note from NEW row if available
  IF TG_OP = 'UPDATE' AND NEW.status_id IS DISTINCT FROM OLD.status_id THEN
    v_notes := NEW.status_change_note;

    -- Clear the note field (it's just a pass-through)
    NEW.status_change_note := NULL;
  END IF;

  INSERT INTO audit_logs (
    entity_type,
    entity_id,
    action,
    field_name,
    old_value,
    new_value,
    notes,  -- Store the captured note
    changed_by,
    changed_at
  ) VALUES (
    TG_TABLE_NAME,
    NEW.id,
    'status_change',
    'status_id',
    OLD.status_id,
    NEW.status_id,
    v_notes,  -- NEW: Include note in audit log
    NEW.updated_by,
    NOW()
  );

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
```

**Rationale:**
- Uses temporary field `status_change_note` to pass note through UPDATE
- Audit trigger extracts note and stores in audit_logs
- Note field is cleared after extraction (doesn't persist on entity)
- No additional API calls, single transaction

**Option B: Direct Audit Log Insert**

Insert audit log entry manually after status update:

```tsx
const handleConfirm = async (note?: string) => {
  // Update status
  await supabase.from(tableName).update({ status_id: selectedStatus.id });

  // Insert audit log with note
  if (note) {
    await supabase.from("audit_logs").insert({
      entity_type: entityType,
      entity_id: entityId,
      action: "status_change",
      field_name: "status_id",
      old_value: status.id,
      new_value: selectedStatus.id,
      notes: note,
      changed_by: user.id,
      changed_at: new Date().toISOString(),
    });
  }
};
```

**Rationale:** Simple, no schema changes needed. But requires two database calls and may not be atomic.

### Recommendation

**Use Option A** because:
- Single transaction (atomic)
- Consistent with existing audit trigger pattern
- Easier to maintain (all audit logic in one place)
- Temporary field pattern is well-established in PostgreSQL

### Implementation Checklist

- [ ] Add `status_change_note` TEXT column to `qmrl` and `qmhq` tables (nullable)
- [ ] Modify `StatusChangeDialog` to pass note to `onConfirm` callback
- [ ] Update `handleConfirm` in `clickable-status-badge.tsx` to accept note parameter
- [ ] Modify audit trigger to extract and clear `status_change_note`
- [ ] Test: Change status with note → verify note appears in History tab
- [ ] Test: Change status without note → verify no NULL notes displayed

### Sources

- [PostgreSQL Trigger-Based Audit Log](https://medium.com/israeli-tech-radar/postgresql-trigger-based-audit-log-fd9d9d5e412c)
- [Working with Postgres Audit Triggers](https://www.enterprisedb.com/postgres-tutorials/working-postgres-audit-triggers)
- [Audit trigger - PostgreSQL wiki](https://wiki.postgresql.org/wiki/Audit_trigger)
- [Postgres Audit Logging Guide](https://www.bytebase.com/blog/postgres-audit-logging/)

---

## Issue 4: Currency Display Standardization

### Problem

Inconsistent currency display across the application. Some places show:
- Original currency only
- Original + MMK conversion + EUSD
- Only EUSD

**Target:** Standardize to **Original + EUSD only** everywhere. Remove MMK conversion display.

### Solution Pattern

**Create a standardized currency display component:**

```tsx
// components/ui/currency-display.tsx
interface CurrencyDisplayProps {
  amount: number;
  currency: string;
  amountEusd: number;
  className?: string;
}

export function CurrencyDisplay({
  amount,
  currency,
  amountEusd,
  className
}: CurrencyDisplayProps) {
  return (
    <div className={cn("flex items-baseline gap-2", className)}>
      <span className="font-mono text-base">
        {amount.toFixed(2)} {currency}
      </span>
      <span className="text-sm text-slate-400">
        ({amountEusd.toFixed(2)} EUSD)
      </span>
    </div>
  );
}
```

**Usage across components:**
```tsx
// Instead of custom formatting everywhere:
<CurrencyDisplay
  amount={transaction.amount}
  currency={transaction.currency}
  amountEusd={transaction.amount_eusd}
/>
```

### Implementation Checklist

- [ ] Create `CurrencyDisplay` component
- [ ] Add variants for: inline, card, table cell
- [ ] Grep codebase for currency display patterns
- [ ] Replace with `CurrencyDisplay` component
- [ ] Remove all MMK conversion logic
- [ ] Update any lingering `.toLocaleString()` calls to `.toFixed(2)`

### Rationale

**Why Original + EUSD only:**
- EUSD is the normalized reference currency (stored in database)
- Original currency shows the actual transaction amount
- MMK adds visual noise without business value
- Consistency improves readability across all pages

**Why a component:**
- Single source of truth for formatting
- Easy to adjust spacing/styling globally
- Enforces 2-decimal precision for amounts
- Can add thousand separators consistently later

---

## Integration with Existing Stack

### No New Dependencies Required

All fixes use existing stack:
- **Next.js 14+ with TypeScript** - No changes
- **Supabase** - RLS policy fixes, schema migration for note field
- **React** - Better controlled input patterns
- **Tailwind CSS** - Consistent styling via `CurrencyDisplay` component

### Migration Strategy

**Database Changes:**
1. Add `status_change_note` TEXT to `qmrl` and `qmhq` (migration 038)
2. Update `file_attachments_select` RLS policy with time-window pattern (migration 039)
3. Modify audit trigger to capture status change notes (migration 040)

**Code Changes:**
1. Replace all `type="number"` inputs with controlled pattern
2. Update `StatusChangeDialog` and `clickable-status-badge` to pass notes
3. Create and deploy `CurrencyDisplay` component
4. Grep and replace currency display patterns

**Testing Priority:**
1. RLS policy fix - Test with different user roles (admin, requester, etc.)
2. Number inputs - Test with decimals, edge cases (empty, negative)
3. Status notes - Test with and without notes
4. Currency display - Visual QA across all pages

---

## Quality Gates

**Before considering v1.3 complete:**

- [ ] Attachment delete works for all authorized users
- [ ] Number inputs preserve typed values on blur
- [ ] Status change notes appear in History tab
- [ ] Currency displays as Original + EUSD everywhere (no MMK)
- [ ] All changes tested with realistic data
- [ ] No regressions in existing features

---

## Confidence Assessment

| Area | Confidence | Reason |
|------|------------|--------|
| RLS Fix | HIGH | Documented Supabase bug with known workarounds |
| Number Input | HIGH | Standard React controlled input pattern |
| Audit Notes | MEDIUM | Temporary field pattern is proven, but requires coordination between UI and trigger |
| Currency Display | HIGH | Simple component replacement, no business logic changes |

---

## Open Questions

**None.** All fixes are well-understood patterns with clear implementation paths. The research found authoritative sources for each issue.

---

## Summary

This milestone requires **no new libraries or frameworks**. All fixes use existing Next.js/Supabase patterns, corrected with:

1. **RLS time-window pattern** for soft-delete operations
2. **Controlled input pattern** with string state and blur validation
3. **Temporary field pattern** for passing UI context through database triggers
4. **Reusable component** for consistent currency display

Each fix is independently deployable. Recommended implementation order:
1. Currency display (lowest risk, highest visible impact)
2. Number inputs (medium risk, requires thorough testing)
3. Audit notes (low risk, single migration)
4. RLS policy (highest risk, test extensively with different roles)
