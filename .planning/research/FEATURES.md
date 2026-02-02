# Feature Landscape: UX Patterns & Bug Fixes

**Domain:** Internal management system UX refinement and bug fixes
**Researched:** 2026-02-02
**Context:** v1.3 milestone fixing critical UX issues in existing QM System after v1.2 shipped

## Table Stakes

Features users expect to work correctly. These are bugs masquerading as missing features - the functionality exists but doesn't behave as expected.

| Feature | Why Expected | Current State | User Expectation |
|---------|--------------|---------------|------------------|
| Delete attachments | File management systems always allow deletion | RLS policy blocks all users | Delete button with confirmation modal, only owner or admin can delete |
| Number input stability | Form inputs preserve entered values | Value changes unexpectedly on blur | Value stays as typed until user explicitly changes it |
| Status change notes visible | Audit trail shows why status changed | Notes saved but not displayed in History | Status change entry shows note/comment explaining why |
| Original currency display | Financial systems show transaction currency | Shows MMK when original was USD | Display original currency (e.g., USD 100.00) + EUSD equivalent |
| Consistent number formatting | All number inputs behave the same | Mixed behavior across forms | All amount/qty/rate inputs format consistently on blur |
| Edit from detail pages | Detail pages should allow editing | Some entities missing edit button | Edit button on all QMRL, QMHQ, PO, Invoice detail pages |
| Item route fulfillment | QMHQ item route should fulfill request | No stock-out mechanism from QMHQ | Stock-out button on QMHQ detail page with qty validation |

### 1. File Attachment Deletion UX

**What users expect:**

Based on [UX best practices for file deletion](https://www.leemunroe.com/best-practice-deleting-records/) and [destructive action modal design](https://uxpsychology.substack.com/p/how-to-design-better-destructive):

- **Delete button visible** - Universal trash can icon next to each attachment
- **Confirmation dialog** - "Are you sure you want to delete [filename]?" prevents accidental clicks
- **Button placement** - Modal buttons right-aligned: Cancel (left), Delete (right, red)
- **Focus on Cancel** - Autofocus on Cancel button to prevent accidental deletion
- **Permission-based** - Only file owner or admin can see delete button
- **Immediate feedback** - File removed from list after successful deletion
- **Error handling** - Clear message if deletion fails ("You don't have permission")

**Current bug:** RLS policy blocks ALL users from deleting, even admins and owners.

**Fix approach:**
- RLS policy: `created_by = auth.uid() OR user_role = 'admin'`
- Delete button with trash icon, visible only when permission exists
- Native HTML dialog with "Cancel" and "Delete" buttons
- Success toast: "File deleted"
- Error toast: "Cannot delete file: [reason]"

### 2. Number Input Blur Behavior

**What users expect:**

Based on [React number input best practices](https://blog.logrocket.com/understanding-react-handles-input-state/) and [onBlur vs onChange patterns](https://linguinecode.com/post/onblur-vs-onchange-react-text-inputs):

- **onChange** - Update state on every keystroke for real-time validation
- **onBlur** - Format display (add commas, decimals) only after user finishes
- **No surprise changes** - Value should not change unless user explicitly edited it
- **Validation** - Show errors on blur, hide immediately after correction starts
- **Decimal formatting** -
  - Amount: 2 decimals (100.00, 0.50)
  - Quantity: 2 decimals (10.00, 0.25)
  - Exchange rate: 4 decimals (1.0000, 0.0126)

**Current bug:** Controlled component with state management causing value to change unexpectedly on blur.

**Fix approach:**
- Use separate `displayValue` and `internalValue` state
- onChange: Update both immediately
- onBlur: Format `displayValue` only if valid, don't change `internalValue`
- Validation on blur, not on every keystroke
- Use `Intl.NumberFormat` for locale-aware formatting

### 3. Status Change Notes in History

**What users expect:**

Based on [audit trail best practices](https://www.salesforceben.com/field-history-tracking-vs-setup-audit-trail-monitoring-changes-in-salesforce/) and [activity log patterns](https://alguidelines.dev/docs/navpatterns/patterns/activity-log/):

- **Change summary** - "Status changed from [old] to [new]"
- **Who and when** - User name and timestamp
- **Why (optional)** - Note/comment explaining reason for change
- **Chronological order** - Most recent changes at top
- **Visual distinction** - Status changes should stand out from other activity

**Display format:**
```
[User] changed status from "Draft" to "Pending Review"
Note: "All required documents attached and verified"
2 hours ago
```

**Current bug:** Status change notes are saved to database but not displayed in History tab.

**Fix approach:**
- Audit log entry includes `summary` field with full text including note
- History tab renders note in separate paragraph below change description
- Note displayed only if present (not all status changes require notes)
- Styling: Note text in muted color, slightly indented

### 4. Multi-Currency Display

**What users expect:**

Based on [multi-currency display best practices](https://www.netsuite.com/portal/resource/articles/accounting/multi-currency-accounting.shtml) and [currency formatting standards](https://www.acumatica.com/blog/multi-currency-accounting/):

- **Original currency first** - USD 100.00 (the transaction currency)
- **Base currency second** - (25,000 EUSD) in parentheses or muted text
- **ISO code before amount** - "USD 100.00" not "$100" (removes ambiguity)
- **Consistent across system** - Same format everywhere
- **Preserve original value** - Don't continuously update with current exchange rate

**Display examples:**
```
PO total: USD 1,250.00 (312,500 EUSD)
Invoice amount: THB 50,000.00 (62,500 EUSD)
WAC unit cost: MMK 10,000.00 (5.00 EUSD)
```

**Current bug:** System shows MMK when original currency was USD, inconsistent display.

**Fix approach:**
- All financial amounts store: `amount`, `currency`, `exchange_rate`, `amount_eusd`
- Display component: `<CurrencyDisplay amount={} currency={} amountEusd={} />`
- Format: `{currency} {amount.toFixed(2)} ({amountEusd.toFixed(2)} EUSD)`
- Gray text for EUSD portion to de-emphasize

### 5. QMHQ Item Route Stock-Out

**What users expect:**

Based on [order fulfillment workflows](https://retalon.com/blog/order-fulfillment-process) and [inventory allocation patterns](https://www.shopify.com/enterprise/blog/inventory-allocation):

- **Fulfill from detail page** - Not from separate inventory page
- **Quantity validation** - Cannot exceed requested quantity
- **Warehouse selection** - Choose which warehouse to fulfill from
- **Stock availability check** - Show current stock, prevent overselling
- **Partial fulfillment** - Can fulfill 5 of 10 requested
- **Status update** - Auto-complete QMHQ when fully fulfilled
- **Audit trail** - Stock-out transaction linked to QMHQ

**Workflow:**
1. Open QMHQ detail page (item route)
2. See "Requested: 10 units, Fulfilled: 3 units, Remaining: 7 units"
3. Click "Fulfill Stock" button
4. Modal: Select warehouse, enter quantity (max 7)
5. Submit creates inventory_out transaction
6. QMHQ detail updates quantities
7. History shows "Fulfilled 5 units from [warehouse]"

**Current state:** No fulfillment mechanism from QMHQ detail page.

**Fix approach:**
- Add `quantity_fulfilled` column to `qmhq` table
- Fulfill button visible when `route_type = 'item'` and `quantity_fulfilled < item_quantity`
- Modal with warehouse dropdown, quantity input (max = remaining)
- Create inventory_out transaction with `source_type = 'qmhq'`, `source_id = qmhq.id`
- Update `qmhq.quantity_fulfilled`
- Auto-change status to "Completed" when fully fulfilled

## Differentiators

Polish features that elevate user experience beyond basic functionality.

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Consistent decimal formatting | Professional appearance, reduces data entry errors | Low | WebSearch: Modern financial software uses locale-aware formatting |
| Inline edit from detail pages | Faster workflow, fewer clicks | Low | Standard pattern in modern CRUD applications |
| Permission-based delete button visibility | Cleaner UI, prevents confusion | Low | Show action only when user can perform it |
| Real-time form validation | Immediate feedback, prevents submission errors | Low | Validate on blur, show errors immediately |
| Accessible confirmation dialogs | Native HTML dialog, better keyboard navigation | Low | 2026 best practice: Use native dialog element |
| Status change with optional note | Context for future reference without forcing input | Low | Note field optional, encourages but doesn't require documentation |
| Quantity tracking on QMHQ | Visibility into partial fulfillment | Medium | Most systems treat fulfillment as binary (done/not done) |
| Linked audit trail | Click stock-out to see originating QMHQ | Low | Adds context to inventory transactions |

## Anti-Features

Features to explicitly NOT implement. These would harm the user experience or violate system integrity.

| Anti-Feature | Why Avoid | What to Do Instead |
|--------------|-----------|-------------------|
| Delete without confirmation | Accidental deletions, user frustration | Always confirm destructive actions with dialog |
| Auto-format while typing | Disruptive, interferes with input flow | Format only on blur after user finishes typing |
| Edit transaction amounts post-creation | Breaks audit integrity | View-only with void/reversal for corrections |
| Bulk file deletion | High risk, accidental data loss | Individual deletion with confirmation per file |
| Status change without audit log | Compliance issues, no accountability | Always log who, when, old value, new value |
| Force status change note | Friction, users enter garbage text | Make note optional, encourage with UX prompts |
| Complex fulfillment workflow | Over-process for internal tool | Simple: select warehouse, enter quantity, done |
| Partial fulfillment approval | Slows operations, unnecessary bureaucracy | Direct fulfillment with audit trail |
| Edit exchange rates post-transaction | Financial manipulation risk | Exchange rate immutable after creation |
| Show MMK for all amounts | Loses original transaction context | Always show original currency + EUSD |
| Different number formats per form | Inconsistent, confusing | Standardize: amounts (2 decimals), rates (4 decimals) |
| Auto-complete on partial fulfillment | Premature closure, hides remaining work | Auto-complete only when fully fulfilled |

## Feature Dependencies

### Existing Foundation (v1.0 - v1.2)
```
Supabase Storage (v1.1)
  ↓
File Attachments (v1.1)
  ↓
RLS Policies (v1.0)
  └─→ Need update for deletion

Status System (v1.0)
  ↓
Quick Status Change (v1.1)
  ↓
Audit Logging (v1.0)
  └─→ Note display missing

Multi-Currency (v1.0)
  ↓
Financial Transactions (v1.0)
  └─→ Display inconsistent

Number Inputs (v1.0)
  └─→ Blur behavior buggy

QMHQ Item Route (v1.0)
  └─→ Fulfillment mechanism missing
```

### V1.3 Fix Dependencies
```
1. Attachment Delete Fix (standalone)
   └─→ RLS policy update only

2. Number Input Fix (affects all forms)
   ├─→ Amount inputs (PO, Invoice, QMHQ Expense)
   ├─→ Quantity inputs (PO lines, Invoice lines, QMHQ Item)
   └─→ Exchange rate inputs (PO, Invoice, Stock-In)

3. Status Change Note Display (standalone)
   └─→ History tab component update

4. Currency Display Standardization (affects all financial views)
   ├─→ PO list and detail
   ├─→ Invoice list and detail
   ├─→ QMHQ expense route
   ├─→ Financial transaction cards
   └─→ Dashboard KPIs

5. QMHQ Item Route Stock-Out (new feature)
   ├─→ Database: quantity_fulfilled column
   ├─→ UI: Fulfill button and modal
   ├─→ Inventory: Create stock-out transaction
   └─→ Audit: Link transaction to QMHQ

6. Edit from Detail Pages (per-entity)
   ├─→ QMRL detail
   ├─→ QMHQ detail
   ├─→ PO detail
   └─→ Invoice detail (or clarify no-edit policy)
```

## Implementation Patterns

### Pattern 1: Controlled Number Input with Blur Formatting

**Problem:** Value changes unexpectedly on blur, disrupts user input flow.

**Solution:** Separate display value from internal value.

```typescript
const [internalValue, setInternalValue] = useState<number | null>(null);
const [displayValue, setDisplayValue] = useState<string>('');

const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
  const raw = e.target.value;
  setDisplayValue(raw);
  const parsed = parseFloat(raw);
  if (!isNaN(parsed)) {
    setInternalValue(parsed);
  }
};

const handleBlur = () => {
  if (internalValue !== null) {
    // Format for display only, don't change internal value
    const formatted = internalValue.toFixed(decimalPlaces);
    setDisplayValue(formatted);
  }
};
```

**Key principle:** `onChange` updates state, `onBlur` formats display only.

### Pattern 2: Permission-Based Action Visibility

**Problem:** Showing actions users can't perform creates confusion and error messages.

**Solution:** Render action only when user has permission.

```typescript
const canDelete = attachment.created_by === userId || userRole === 'admin';

return (
  <div>
    {canDelete && (
      <button onClick={handleDelete}>
        <TrashIcon /> Delete
      </button>
    )}
  </div>
);
```

**Key principle:** Hide action, don't disable it. If user can't do it, don't show it.

### Pattern 3: Confirmation Dialog for Destructive Actions

**Problem:** Accidental deletions cause data loss and frustration.

**Solution:** Native HTML dialog with focus on Cancel button.

```typescript
<dialog ref={dialogRef}>
  <h2>Delete {filename}?</h2>
  <p>This action cannot be undone.</p>
  <div className="buttons">
    <button ref={cancelRef} onClick={closeDialog}>Cancel</button>
    <button className="destructive" onClick={confirmDelete}>Delete</button>
  </div>
</dialog>
```

**Key principle:** Cancel button gets autofocus, Delete button is red, right-aligned.

### Pattern 4: Status Change with Optional Note

**Problem:** Forcing notes creates friction, but missing notes lose context.

**Solution:** Make note field prominent but optional, show in history when present.

```typescript
// Status change modal
<textarea
  placeholder="Add a note explaining this change (optional)"
  value={note}
  onChange={(e) => setNote(e.target.value)}
/>

// Audit log entry
{
  action: 'status_change',
  summary: `Status changed from "${oldStatus}" to "${newStatus}"`,
  metadata: {
    old_value: oldStatus,
    new_value: newStatus,
    note: note || null
  }
}

// History display
<div className="history-entry">
  <p>{entry.summary}</p>
  {entry.metadata.note && (
    <p className="note">{entry.metadata.note}</p>
  )}
  <span className="timestamp">{formatTimestamp(entry.created_at)}</span>
</div>
```

**Key principle:** Encourage notes with UX (large textarea, placeholder), but don't require.

### Pattern 5: Multi-Currency Display Component

**Problem:** Inconsistent currency display confuses users, loses transaction context.

**Solution:** Reusable component that always shows original + EUSD.

```typescript
interface CurrencyDisplayProps {
  amount: number;
  currency: string;
  amountEusd: number;
  showEusd?: boolean;
}

const CurrencyDisplay = ({ amount, currency, amountEusd, showEusd = true }: CurrencyDisplayProps) => {
  return (
    <span>
      <span className="original-currency">
        {currency} {amount.toFixed(2)}
      </span>
      {showEusd && (
        <span className="eusd-equivalent text-gray-500">
          {' '}({amountEusd.toFixed(2)} EUSD)
        </span>
      )}
    </span>
  );
};
```

**Key principle:** Original currency prominent, EUSD de-emphasized but always present.

### Pattern 6: Quantity Tracking with Fulfillment

**Problem:** No visibility into partial fulfillment, binary completed/not completed.

**Solution:** Track requested vs fulfilled quantities, show progress.

```typescript
// Database
qmhq.item_quantity (requested)
qmhq.quantity_fulfilled (fulfilled so far)

// Display
const remaining = itemQuantity - quantityFulfilled;
const progress = (quantityFulfilled / itemQuantity) * 100;

// UI
<div className="fulfillment-status">
  <div className="quantities">
    Requested: {itemQuantity} units
    Fulfilled: {quantityFulfilled} units
    Remaining: {remaining} units
  </div>
  <ProgressBar value={progress} />
  {remaining > 0 && (
    <button onClick={openFulfillModal}>Fulfill Stock</button>
  )}
</div>
```

**Key principle:** Make progress visible, enable partial fulfillment, auto-complete when done.

## MVP Recommendation

For v1.3 milestone, prioritize fixes in this order:

### Phase 1: Critical Bugs (Blockers)
1. **Attachment delete RLS fix** - Users cannot delete files at all
   - Update RLS policy: owner or admin
   - Test with different roles
   - Add confirmation dialog

2. **Number input blur fix** - Forms behave unpredictably
   - Refactor controlled input pattern
   - Apply to all number inputs (amount, qty, rate)
   - Test with various input sequences

3. **Status change note display** - Lost context in history
   - Update History component to show notes
   - Test with status changes that have/lack notes
   - Ensure chronological order

### Phase 2: Consistency (Polish)
4. **Currency display standardization** - Professional appearance
   - Create CurrencyDisplay component
   - Replace all currency displays system-wide
   - Verify original currency + EUSD pattern

5. **Consistent number input formatting** - Unified behavior
   - 2 decimals for amounts and quantities
   - 4 decimals for exchange rates
   - Format on blur, validate on submit

### Phase 3: Feature Completion (New)
6. **QMHQ item route stock-out** - Complete fulfillment workflow
   - Add quantity_fulfilled column
   - Create fulfill modal
   - Link inventory_out transaction
   - Auto-complete status when fulfilled

7. **Edit from detail pages** - Workflow efficiency
   - Add edit button to all detail pages
   - Route to edit form with pre-filled data
   - Maintain audit trail on save

## Defer to Post-V1.3

Features that would be valuable but are not critical for this milestone:

- **Batch status changes** - Select multiple entities, change status at once
  - Reason: Increases complexity, individual changes work for current volume
- **Advanced file management** - Rename, move, organize in folders
  - Reason: Basic upload/preview/delete/download sufficient for internal tool
- **Decimal place configuration** - Per-currency decimal settings
  - Reason: Standard 2/4 decimals work for current currencies
- **Currency conversion calculator** - Inline EUSD calculation tool
  - Reason: Conversions display automatically, no need for separate tool
- **Fulfillment scheduling** - Schedule future stock-out
  - Reason: Immediate fulfillment sufficient for internal operations
- **Partial fulfillment approval** - Require approval for incomplete fulfillment
  - Reason: Over-process, direct fulfillment with audit trail works

## Complexity Assessment

| Feature Category | Overall Complexity | Risk Factors |
|------------------|-------------------|--------------|
| Attachment Delete Fix | Low | RLS policy update only, straightforward |
| Number Input Fix | Medium | Affects multiple forms, requires consistent pattern |
| Status Note Display | Low | Component update only, data already saved |
| Currency Display | Medium | System-wide change, many touchpoints |
| QMHQ Stock-Out | High | New database column, transaction creation, status logic |
| Edit from Detail | Low | UI change only, edit forms already exist |

### High-Risk Areas (Need Careful Testing)

1. **Number Input Refactor**
   - Risk: Breaks existing form behavior if not applied consistently
   - Mitigation: Test all forms (PO, Invoice, QMHQ, Stock-In) thoroughly
   - Edge cases: Empty value, zero, negative, too many decimals

2. **Currency Display System-Wide**
   - Risk: Miss some currency displays, inconsistent appearance
   - Mitigation: Search codebase for all currency rendering, use component
   - Edge cases: MMK (base currency), null amounts, zero values

3. **QMHQ Stock-Out Status Logic**
   - Risk: Status doesn't update correctly, inventory quantity mismatch
   - Mitigation: Transaction atomicity, validate available stock
   - Edge cases: Multiple partial fulfillments, warehouse insufficient stock

4. **RLS Policy Update**
   - Risk: Break existing upload/view functionality
   - Mitigation: Test all CRUD operations with all roles
   - Edge cases: Service role bypass, deleted users, shared attachments

## Testing Strategy

Each fix requires different testing approaches:

### Attachment Delete
- [ ] Admin can delete any file
- [ ] Owner can delete own file
- [ ] Non-owner cannot delete (button hidden)
- [ ] Confirmation dialog appears before delete
- [ ] File removed from list after deletion
- [ ] Error shown if deletion fails

### Number Input
- [ ] Type "100" → blur → shows "100.00"
- [ ] Type "100.5" → blur → shows "100.50"
- [ ] Type "0.1" → blur → shows "0.10"
- [ ] Type "abc" → blur → shows error
- [ ] Exchange rate: "1.5" → blur → shows "1.5000"
- [ ] All forms (PO, Invoice, QMHQ, Stock-In) behave consistently

### Status Change Notes
- [ ] Change status with note → note appears in History
- [ ] Change status without note → only status change in History
- [ ] Note text wraps properly
- [ ] Note styled differently from change summary

### Currency Display
- [ ] PO shows original currency + EUSD
- [ ] Invoice shows original currency + EUSD
- [ ] QMHQ expense shows original currency + EUSD
- [ ] Dashboard KPIs show EUSD (or original if specified)
- [ ] No instances of "MMK" for non-MMK transactions

### QMHQ Stock-Out
- [ ] Fulfill button only appears for item route
- [ ] Cannot fulfill more than remaining quantity
- [ ] Cannot fulfill from warehouse with insufficient stock
- [ ] Partial fulfillment updates quantities correctly
- [ ] Full fulfillment auto-completes QMHQ
- [ ] Inventory transaction linked to QMHQ in history

### Edit from Detail
- [ ] Edit button visible on all detail pages
- [ ] Click edit opens form with pre-filled data
- [ ] Save updates entity and shows in History
- [ ] Cancel returns to detail page unchanged

## Success Criteria

V1.3 milestone complete when:

- [ ] All users with permission can delete attachments without RLS errors
- [ ] Number inputs format consistently on blur without changing values unexpectedly
- [ ] Status change notes visible in History tab when present
- [ ] All currency displays show original currency + EUSD (no MMK surprises)
- [ ] All number inputs follow decimal standards (2 for amounts, 4 for rates)
- [ ] QMHQ item route can be fulfilled from detail page with quantity tracking
- [ ] All entity detail pages have edit capability
- [ ] All changes logged in audit trail with proper context

## Sources

### File Deletion UX
- [UX best practices for file uploader | Uploadcare](https://uploadcare.com/blog/file-uploader-ux-best-practices/)
- [A better user experience for deleting records](https://www.leemunroe.com/best-practice-deleting-records/)
- [How to design better destructive action modals - UX Psychology](https://uxpsychology.substack.com/p/how-to-design-better-destructive)
- [Delete with simple confirmation - Cloudscape Design System](https://cloudscape.design/patterns/resource-management/delete/delete-with-simple-confirmation/)
- [Do you follow best UI practices for delete buttons? | SSW.Rules](https://www.ssw.com.au/rules/destructive-button-ui-ux)

### Number Input Behavior
- [Understanding how React handles input state - LogRocket Blog](https://blog.logrocket.com/understanding-react-handles-input-state/)
- [The difference between onBlur vs onChange for React text inputs](https://linguinecode.com/post/onblur-vs-onchange-react-text-inputs)
- [How to Use React Controlled Inputs](https://dmitripavlutin.com/controlled-inputs-using-react-hooks/)
- [Number input | Mantine](https://mantine.dev/core/number-input/)
- [JavaScript Currency Validation: Complete Guide with 2026 Best Practices](https://copyprogramming.com/howto/currency-validation)

### Audit Trail and Status Changes
- [Field History Tracking vs. Setup Audit Trail: Monitoring Changes in Salesforce | Salesforce Ben](https://www.salesforceben.com/field-history-tracking-vs-setup-audit-trail-monitoring-changes-in-salesforce/)
- [Audit Trail: Tracking & Change Records | HybridForms](https://www.hybridforms.net/en/audit-trail/)
- [Activity Log patterns | alguidelines.dev](https://alguidelines.dev/docs/navpatterns/patterns/activity-log/)
- [Audit Logging: What It Is & How It Works | Datadog](https://www.datadoghq.com/knowledge-center/audit-logging/)

### Multi-Currency Display
- [The Multi-Currency Accounting Guide | NetSuite](https://www.netsuite.com/portal/resource/articles/accounting/multi-currency-accounting.shtml)
- [Multicurrency Accounting: An Essential Guide | Acumatica Cloud ERP](https://www.acumatica.com/blog/multi-currency-accounting/)
- [Multi-currency Ecommerce: Benefits and How to Use (2025) - Shopify](https://www.shopify.com/enterprise/blog/multi-currency)
- [Currency Management | Acumatica Cloud ERP](https://www.acumatica.com/cloud-erp-software/financial-management/currency-management/)
- [Formatting localized currency — Shopify Polaris React](https://polaris-react.shopify.com/foundations/formatting-localized-currency)

### Inventory Fulfillment Workflow
- [The Order Fulfillment Process in 2026 | Retalon](https://retalon.com/blog/order-fulfillment-process)
- [Inventory Allocation: 6 Strategies & Best Practices for 2026 - Shopify](https://www.shopify.com/enterprise/blog/inventory-allocation)
- [Inventory management UI that speeds up discrepancy verification and resolution](https://cieden.com/inventory-management-ui)
- [Store Inventory and Fulfillment Software - Retail Order Fulfillment | Manhattan](https://www.manh.com/solutions/omnichannel-software-solutions/store-inventory-fulfillment)

### Row-Level Security
- [Row-Level Security | Supabase Docs](https://supabase.com/docs/guides/database/postgres/row-level-security)
- [PostgreSQL: Documentation: Row Security Policies](https://www.postgresql.org/docs/current/ddl-rowsecurity.html)
- [Supabase Storage RLS Policy Violation on Admin Upload](https://www.technetexperts.com/supabase-storage-rls-admin-upload-fix/)

### Form Design Best Practices
- [React onBlur Event - GeeksforGeeks](https://www.geeksforgeeks.org/reactjs/react-onblur-event/)
- [How to handle invalid user inputs in React forms for UX design best practices | Medium](https://medium.com/web-dev-survey-from-kyoto/how-to-handle-invalid-user-inputs-in-react-forms-for-ux-design-best-practices-e3108ef8a793)
- [UX writing: an effective 'Cancel' dialog confirmation on Web | Medium](https://medium.com/@joaopegb/ux-writing-an-effective-cancel-dialog-confirmation-on-web-539b73a39929)

## Confidence Assessment

| Area | Level | Reason |
|------|-------|--------|
| Attachment Delete UX | HIGH | Multiple authoritative sources (Cloudscape, UX Psychology, SSW Rules) confirm patterns |
| Number Input Behavior | HIGH | React documentation and LogRocket patterns are current and comprehensive |
| Status Change History | MEDIUM | WebSearch found audit trail patterns, specific note display is implementation detail |
| Currency Display | HIGH | ERP systems (NetSuite, Acumatica) document multi-currency best practices clearly |
| QMHQ Fulfillment | MEDIUM | General fulfillment patterns found, but inline fulfillment is less documented |
| RLS Policies | HIGH | Supabase official documentation provides clear guidance |

## Open Questions for Implementation

When implementing specific fixes, consider:

1. **Attachment Delete**
   - Should we allow undoing deletion (restore from trash)?
   - Should deletion require reason (like invoice void)?
   - What if file is referenced elsewhere (e.g., in audit log)?

2. **Number Input**
   - Should we allow negative values in any context?
   - Should we show thousands separators (1,000.00)?
   - What's max allowed value (prevent overflow)?

3. **Status Change Notes**
   - Should we enforce notes for certain transitions (e.g., rejection)?
   - Should notes support markdown or rich text?
   - Max length for note field?

4. **Currency Display**
   - Should we show currency symbol ($) or ISO code (USD)?
   - What if EUSD is base currency (hide redundant display)?
   - Rounding: always 2 decimals or currency-specific?

5. **QMHQ Stock-Out**
   - Can we fulfill from multiple warehouses in one action?
   - Should partial fulfillment change status (e.g., to "Partially Fulfilled")?
   - What if requested item not in any warehouse (substitute mechanism)?

6. **Edit Capability**
   - Should some fields be immutable even in edit (e.g., created_by)?
   - Should edit require reason/note in audit log?
   - Can we edit after certain status transitions (e.g., locked after completion)?
