# Phase 6: Status & Transaction UX - Research

**Researched:** 2026-01-28
**Domain:** React UI patterns (inline dropdowns, clickable badges, modal dialogs, debouncing)
**Confidence:** HIGH

## Summary

Phase 6 implements quick inline status changes via clickable badges on QMRL/QMHQ detail pages and a view-only transaction detail modal. The codebase already uses Radix UI primitives (@radix-ui/react-dialog, @radix-ui/react-select, @radix-ui/react-popover), react-day-picker 8.10, and has established patterns for toast notifications, permission checks, and audit logging.

**Key findings:**
- Existing UI components (Dialog, Select, Toast, DatePicker) already follow Radix UI patterns and dark theme
- Permission system (`usePermissions` hook) already established with role-based checks
- Audit log system (`history-tab.tsx`) has `status_change` action type with old→new value tracking
- Status config table uses `status_group` for grouping (to_do, in_progress, done)
- Transaction dialog already exists (`transaction-dialog.tsx`) but creates transactions—need view-only variant
- Debouncing pattern needed to prevent duplicate async operations during status saves

**Primary recommendation:** Build inline status dropdown using controlled state with Radix Select positioned below badge, confirmation dialog with note field, debounced save to prevent race conditions, and permission-gated click handlers.

## Standard Stack

The project already uses these libraries—no new dependencies needed:

### Core UI Primitives
| Library | Version | Purpose | Already Integrated |
|---------|---------|---------|-------------------|
| @radix-ui/react-dialog | ^1.1.15 | Modal confirmation dialogs | Yes - `/components/ui/dialog.tsx` |
| @radix-ui/react-select | ^2.2.6 | Dropdown for status selection | Yes - `/components/ui/select.tsx` |
| @radix-ui/react-popover | ^1.1.15 | Positioning container (if needed) | Yes - used in DatePicker |
| @radix-ui/react-toast | ^1.2.15 | Success/error notifications | Yes - `/components/ui/toast.tsx` |
| react-day-picker | ^8.10.1 | Date picker calendar | Yes - `/components/ui/calendar.tsx` |
| lucide-react | ^0.447.0 | Icons (spinner, status icons) | Yes - used throughout |

### State Management
| Library | Version | Purpose | Pattern |
|---------|---------|---------|---------|
| React hooks | 18.3.1 | useState, useCallback, useRef | Standard async state management |
| Supabase client | ^2.50.0 | Database updates | `/lib/supabase/client.ts` |

### Date Handling
| Library | Version | Purpose | Already Used |
|---------|---------|---------|--------------|
| date-fns | ^3.6.0 | Date formatting | Yes - imported in DatePicker |

**No new installations required.** All primitives already in package.json and integrated.

## Architecture Patterns

### Pattern 1: Inline Dropdown Below Badge (Status Change)

**What:** Clickable badge that reveals Select dropdown positioned directly below it
**When to use:** Detail pages only (not list views), for users with update permission
**Implementation approach:**

```typescript
// Controlled open/close state with click handler
const [dropdownOpen, setDropdownOpen] = useState(false);
const [isUpdating, setIsUpdating] = useState(false);

// Permission check gates interactivity
const { can } = usePermissions();
const canUpdate = can('update', 'qmrl'); // or 'qmhq'

// Badge wrapper becomes clickable button
<button
  onClick={() => canUpdate && !isUpdating && setDropdownOpen(true)}
  disabled={isUpdating}
  className={canUpdate ? "cursor-pointer hover:opacity-80" : "cursor-default"}
>
  <StatusBadge status={currentStatus} />
  {isUpdating && <Loader2 className="animate-spin" />}
</button>

// Select dropdown below (not floating popover)
{dropdownOpen && (
  <Select
    value={currentStatus.id}
    onValueChange={handleStatusSelect}
    open={dropdownOpen}
    onOpenChange={setDropdownOpen}
  >
    <SelectContent>
      {/* Group by status_group */}
      <SelectLabel>To Do</SelectLabel>
      {toDoStatuses.map(s => <SelectItem value={s.id}>{s.name}</SelectItem>)}
      <SelectSeparator />
      <SelectLabel>In Progress</SelectLabel>
      {/* ... */}
    </SelectContent>
  </Select>
)}
```

**Source:** React inline dropdown patterns from [LogRocket dropdown guide](https://blog.logrocket.com/how-create-dropdown-menu-react/), adapted to Radix Select primitives.

### Pattern 2: Confirmation Dialog with Preview and Note

**What:** Two-stage status change (select → confirm with note → save)
**Why:** Prevents accidental changes, captures user context for audit log
**Implementation:**

```typescript
// Stage 1: Select from dropdown
const handleStatusSelect = (newStatusId: string) => {
  const newStatus = statuses.find(s => s.id === newStatusId);
  setSelectedStatus(newStatus);
  setDropdownOpen(false);
  setConfirmDialogOpen(true); // Open confirmation
};

// Stage 2: Confirm dialog
<Dialog open={confirmDialogOpen} onOpenChange={setConfirmDialogOpen}>
  <DialogContent>
    <DialogHeader>
      <DialogTitle>Confirm Status Change</DialogTitle>
      <DialogDescription>
        Change status from <StatusBadge status={currentStatus} />
        to <StatusBadge status={selectedStatus} />?
      </DialogDescription>
    </DialogHeader>

    {/* Optional note field */}
    <Textarea
      value={note}
      onChange={(e) => setNote(e.target.value)}
      placeholder="Add note (optional)"
    />

    <DialogFooter>
      <Button onClick={handleConfirmSave}>Confirm</Button>
    </DialogFooter>
  </DialogContent>
</Dialog>
```

**Source:** Existing dialog pattern from `/components/ui/dialog.tsx` and `/components/files/delete-file-dialog.tsx`.

### Pattern 3: Debounced Async Save

**What:** Prevent duplicate status updates if user clicks rapidly
**Why:** Async operations can race, causing duplicate audit entries or UI inconsistencies
**Implementation:**

```typescript
const [isUpdating, setIsUpdating] = useState(false);
const updateTimeoutRef = useRef<NodeJS.Timeout | null>(null);

const handleConfirmSave = useCallback(async () => {
  if (isUpdating) return; // Block if already saving

  setIsUpdating(true);
  const supabase = createClient();

  try {
    const { error } = await supabase
      .from('qmrl') // or 'qmhq'
      .update({
        status_id: selectedStatus.id,
        updated_by: userId,
        updated_at: new Date().toISOString()
      })
      .eq('id', entityId);

    if (error) throw error;

    toast({
      title: "Status Updated",
      description: `Changed to ${selectedStatus.name}`,
      variant: "success"
    });

    // Refresh data
    await refetchData();
  } catch (err) {
    toast({
      title: "Update Failed",
      description: err.message,
      variant: "destructive"
    });
  } finally {
    setIsUpdating(false);
    setConfirmDialogOpen(false);
  }
}, [selectedStatus, entityId, userId]);
```

**Source:** React debounce patterns from [Developer Way guide](https://www.developerway.com/posts/debouncing-in-react) and [Dmitri Pavlutin article](https://dmitripavlutin.com/react-throttle-debounce/).

### Pattern 4: View-Only Transaction Modal

**What:** Display-only modal for transaction details (no edits)
**Why:** Audit integrity requires transactions to be immutable after creation
**Implementation:**

```typescript
// Triggered by explicit View button (not row click)
<Button onClick={() => setModalOpen(true)} variant="ghost" size="sm">
  View
</Button>

// Modal layout (~500px centered)
<Dialog open={modalOpen} onOpenChange={setModalOpen}>
  <DialogContent className="sm:max-w-[500px]">
    <DialogHeader>
      <DialogTitle>
        {transaction.transaction_type === 'money_in' ? 'Money In' : 'Money Out'}
      </DialogTitle>
    </DialogHeader>

    {/* Display fields - no inputs */}
    <div className="space-y-4">
      <div>
        <Label>Amount</Label>
        <div className="text-2xl font-bold">{formatCurrency(transaction.amount)} {transaction.currency}</div>
        <div className="text-sm text-slate-400">{formatCurrency(transaction.amount_eusd)} EUSD</div>
      </div>

      <div>
        <Label>Exchange Rate</Label>
        <div className="font-mono">{transaction.exchange_rate.toFixed(4)}</div>
      </div>

      {/* Other read-only fields */}
    </div>

    <DialogFooter>
      <Button onClick={() => setModalOpen(false)}>Close</Button>
    </DialogFooter>
  </DialogContent>
</Dialog>
```

**Source:** Adapted from existing `/components/qmhq/transaction-dialog.tsx` (create mode) to view-only display.

### Pattern 5: Audit Log Integration for Status Changes

**What:** Status changes appear in history timeline with distinct icon
**Why:** Provides audit trail of who changed what and when
**Implementation:**

The audit trigger in `026_audit_triggers.sql` already handles status changes:

```sql
-- Existing trigger detects status_id changes
IF (NEW.status_id IS DISTINCT FROM OLD.status_id) THEN
  audit_action := 'status_change';

  INSERT INTO public.audit_logs (
    entity_type, entity_id, action,
    field_name, old_value, new_value,
    notes, -- User note from confirmation dialog
    changed_by, changed_by_name, changed_at
  ) VALUES (
    TG_TABLE_NAME, NEW.id, audit_action,
    'status_id',
    (SELECT name FROM status_config WHERE id = OLD.status_id),
    (SELECT name FROM status_config WHERE id = NEW.status_id),
    note_text, -- Passed from application
    audit_user_id, audit_user_name, NOW()
  );
END IF;
```

**Note field from confirmation dialog:** Pass as part of update RPC or store in session variable for trigger access.

**Source:** Existing audit trigger pattern in `/supabase/migrations/026_audit_triggers.sql` and display in `/components/history/history-tab.tsx`.

## Don't Hand-Roll

Problems that have existing solutions in the codebase or Radix UI:

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Dropdown positioning | Custom absolute positioning logic | Radix Select with position="popper" | Handles collision detection, alignment, viewport boundaries automatically |
| Click-outside detection | document.addEventListener + cleanup | Radix Dialog/Select's built-in onOpenChange | Manages focus trap, escape key, outside click natively |
| Toast notifications | Custom notification system | Existing `useToast` hook from `/components/ui/use-toast.tsx` | Already styled, handles queue, auto-dismiss |
| Permission checks | Inline role checks | `usePermissions()` hook from `/lib/hooks/use-permissions.ts` | Centralized permission matrix, type-safe |
| Loading spinners | Custom CSS animations | `<Loader2 className="animate-spin" />` from lucide-react | Consistent with existing UI |
| Date formatting | Manual date string parsing | `date-fns` functions (already used in DatePicker) | Locale-aware, timezone-safe |
| Debouncing | Custom setTimeout logic | `useRef` + `useCallback` pattern (see Pattern 3) | Avoids stale closures, cleanup handled by React |

**Key insight:** The codebase has already established patterns for all required interactions. Don't introduce new libraries (like lodash debounce or custom dropdown components)—use existing Radix primitives and React hooks.

## Common Pitfalls

### Pitfall 1: Race Conditions from Rapid Status Changes
**What goes wrong:** User clicks badge multiple times quickly, triggering parallel database updates that resolve out of order
**Why it happens:** Async operations don't block subsequent clicks
**How to avoid:**
- Use `isUpdating` state to disable badge during save
- Check `if (isUpdating) return;` at start of save handler
- Show spinner on badge during update
**Warning signs:** Duplicate audit log entries, UI showing wrong status after update

**Source:** [React async states documentation](https://incepter.github.io/react-async-states/docs/intro/) on race condition prevention.

### Pitfall 2: Stale Closures in Debounced Handlers
**What goes wrong:** Debounced function captures old props/state values, saving outdated data
**Why it happens:** Function closure formed at initial render doesn't update
**How to avoid:**
- Use `useCallback` with proper dependencies: `[selectedStatus, entityId, userId]`
- Store refs for values that change: `const statusRef = useRef(selectedStatus); statusRef.current = selectedStatus;`
- Prefer stateless handlers that read from latest refs
**Warning signs:** Status saves using previous selection instead of current one

**Source:** [Dmitri Pavlutin's article](https://dmitripavlutin.com/react-throttle-debounce/) on stale closures in React.

### Pitfall 3: Permission Check Only in UI (No Server-Side Validation)
**What goes wrong:** Malicious user bypasses UI checks via browser console or API calls
**Why it happens:** Permission gates in UI are cosmetic—database RLS policies enforce security
**How to avoid:**
- UI checks (`can('update', 'qmrl')`) for UX only (hide buttons)
- **Database RLS policies** in `027_rls_policies.sql` are the real enforcement
- Ensure RLS policies check `auth.uid()` matches `updated_by` or role permissions
**Detection:** Audit log shows unexpected updates from users without permission

**Source:** Existing permission pattern in `/lib/hooks/use-permissions.ts` (lines 34-47 show permission matrix is advisory for UI).

### Pitfall 4: Badge Not Clickable in List Views (Scope Confusion)
**What goes wrong:** Developer adds click handler to badges in list/card views when requirement is detail page only
**Why it happens:** Misreading CONTEXT.md which explicitly states "Detail page only"
**How to avoid:**
- Check component location: `/qmrl/[id]/page.tsx` vs `/qmrl/page.tsx`
- Pass `clickable={false}` prop to badge component in list views
- Document in badge component: `// Only clickable on detail pages per Phase 6 CONTEXT.md`
**Detection:** Clicking badges in list view doesn't match spec

**Source:** Phase CONTEXT.md decision: "Detail page only — badge not clickable in list views or cards"

### Pitfall 5: Confirmation Dialog Doesn't Show Status Preview
**What goes wrong:** User approves status change without seeing new badge appearance
**Why it happens:** Confirmation dialog only shows text labels, not visual badge
**How to avoid:**
- Render `<StatusBadge status={newStatus} />` in dialog description
- Use existing badge component from `/components/po/po-status-badge.tsx` pattern
- Show old → new side-by-side with arrow icon
**Detection:** User confusion about which status they're selecting

**Source:** CONTEXT.md requirement: "Confirmation dialog shows preview of new status badge appearance"

### Pitfall 6: Date Picker Inconsistencies Across Forms
**What goes wrong:** Different date formats or calendar styles in QMRL forms vs transaction modal
**Why it happens:** Multiple calendar implementations or format strings
**How to avoid:**
- Use single `<DatePicker>` component from `/components/ui/date-picker.tsx`
- Consistent format: `format(date, "dd/MM/yyyy")` from date-fns
- Same calendar props: `showOutsideDays={true}`, no week numbers
**Detection:** Visual inconsistency in calendar popups

**Source:** CONTEXT.md requirement: "Date picker consistency - Calendar popup style across all forms"

## Code Examples

Verified patterns from codebase:

### Permission-Gated Badge Click
```typescript
// Source: Adapted from /lib/hooks/use-permissions.ts usage
import { usePermissions } from "@/lib/hooks/use-permissions";

export function StatusBadge({
  status,
  entityType, // 'qmrl' or 'qmhq'
  onStatusChange,
  isUpdating = false
}: StatusBadgeProps) {
  const { can } = usePermissions();
  const canUpdate = can('update', entityType);

  return (
    <button
      onClick={() => canUpdate && !isUpdating && onStatusChange()}
      disabled={isUpdating || !canUpdate}
      className={cn(
        "inline-flex items-center gap-2 rounded border px-2.5 py-1",
        canUpdate && "cursor-pointer hover:opacity-80 transition-opacity",
        !canUpdate && "cursor-default",
        isUpdating && "opacity-50"
      )}
      style={{
        backgroundColor: status.color + '20', // 20% opacity
        borderColor: status.color,
        color: status.color
      }}
    >
      <span className="text-xs font-medium uppercase">{status.name}</span>
      {isUpdating && <Loader2 className="h-3 w-3 animate-spin" />}
    </button>
  );
}
```

### Status Dropdown with Grouping
```typescript
// Source: Adapted from /components/ui/select.tsx usage
import { Select, SelectContent, SelectGroup, SelectLabel, SelectItem, SelectSeparator } from "@/components/ui/select";

// Group statuses by status_group (from database)
const groupedStatuses = {
  to_do: statuses.filter(s => s.status_group === 'to_do'),
  in_progress: statuses.filter(s => s.status_group === 'in_progress'),
  done: statuses.filter(s => s.status_group === 'done')
};

<Select value={currentStatus.id} onValueChange={handleSelect}>
  <SelectContent>
    <SelectGroup>
      <SelectLabel>To Do</SelectLabel>
      {groupedStatuses.to_do.map(s => (
        <SelectItem
          key={s.id}
          value={s.id}
          disabled={s.id === currentStatus.id} // Disable current
        >
          {s.name}
        </SelectItem>
      ))}
    </SelectGroup>

    <SelectSeparator />

    <SelectGroup>
      <SelectLabel>In Progress</SelectLabel>
      {groupedStatuses.in_progress.map(s => (
        <SelectItem key={s.id} value={s.id} disabled={s.id === currentStatus.id}>
          {s.name}
        </SelectItem>
      ))}
    </SelectGroup>

    <SelectSeparator />

    <SelectGroup>
      <SelectLabel>Done</SelectLabel>
      {groupedStatuses.done.map(s => (
        <SelectItem key={s.id} value={s.id} disabled={s.id === currentStatus.id}>
          {s.name}
        </SelectItem>
      ))}
    </SelectGroup>
  </SelectContent>
</Select>
```

### Toast Notification Pattern
```typescript
// Source: /components/ui/use-toast.tsx (lines 139-189)
import { useToast } from "@/components/ui/use-toast";

const { toast } = useToast();

// Success toast
toast({
  title: "Status Updated",
  description: `Changed from ${oldStatus.name} to ${newStatus.name}`,
  variant: "success"
});

// Error toast
toast({
  title: "Update Failed",
  description: error.message,
  variant: "destructive"
});
```

### Transaction View Modal
```typescript
// Source: Adapted from /components/qmhq/transaction-dialog.tsx (view-only mode)
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { formatCurrency } from "@/lib/utils";

export function TransactionViewModal({
  transaction,
  open,
  onOpenChange
}: TransactionViewModalProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>
            {transaction.transaction_type === 'money_in' ? 'Money In' : 'Money Out'}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Amount - prominent display */}
          <div>
            <Label className="text-slate-400">Amount</Label>
            <div className="text-2xl font-bold text-slate-100">
              {formatCurrency(transaction.amount)} {transaction.currency}
            </div>
            <div className="text-sm text-slate-400">
              {formatCurrency(transaction.amount_eusd)} EUSD
            </div>
          </div>

          {/* Exchange Rate */}
          <div>
            <Label className="text-slate-400">Exchange Rate</Label>
            <div className="font-mono text-slate-200">
              {transaction.exchange_rate.toFixed(4)}
            </div>
          </div>

          {/* Date */}
          <div>
            <Label className="text-slate-400">Transaction Date</Label>
            <div className="text-slate-200">
              {format(new Date(transaction.transaction_date), 'dd/MM/yyyy')}
            </div>
          </div>

          {/* QMHQ Reference (text only, no link) */}
          <div>
            <Label className="text-slate-400">QMHQ</Label>
            <div className="text-slate-200">{transaction.qmhq_id}</div>
          </div>

          {/* Notes */}
          {transaction.notes && (
            <div>
              <Label className="text-slate-400">Notes</Label>
              <div className="text-slate-200 whitespace-pre-wrap">
                {transaction.notes}
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Full edit form for status changes | Inline badge click → confirmation | Phase 6 (2026-01) | Faster UX, reduces navigation |
| Editable transaction dates/notes | View-only transaction modal | Phase 6 (2026-01) | Preserves audit integrity |
| Multiple date picker styles | Single DatePicker component | Iteration 4 (2025) | Consistent UX across forms |
| react-day-picker v7 | react-day-picker v8.10.1 | Upgrade in 2024-2025 | Requires date-fns peer dependency, renamed props |

**Deprecated/outdated:**
- **react-day-picker `todayButton` prop:** Removed in v8. Use custom button in popover if needed.
- **react-day-picker `initialMonth` prop:** Renamed to `defaultMonth` in v8.
- **Inline transaction editing:** Originally scoped (UX-06, UX-07) but deferred in CONTEXT.md for audit integrity.

**Source:** [React DayPicker v8 upgrading guide](https://daypicker.dev/v8/upgrading) and package.json showing v8.10.1.

## Open Questions

Things that couldn't be fully resolved:

1. **Audit Log Note Field Integration**
   - What we know: Confirmation dialog has note field, audit_logs table has `notes` column
   - What's unclear: How to pass note from client to trigger (session variable vs RPC function parameter)
   - Recommendation: Use RPC function that accepts `note_text` parameter, stores in session var for trigger access
   - **Action:** Check if existing audit trigger supports notes parameter

2. **Status Change Icon in Audit History**
   - What we know: `history-tab.tsx` has `status_change` action type with ArrowRightLeft icon
   - What's unclear: Whether to use different icon for status changes vs generic updates
   - Recommendation: Keep ArrowRightLeft icon (already distinct from Pencil update icon)
   - **Action:** Verify icon is visually distinct in UI testing

3. **Week Start Day (Monday vs Sunday)**
   - What we know: CONTEXT.md lists this under "Claude's Discretion"
   - What's unclear: Regional preference (Myanmar context)
   - Recommendation: Default to Monday (ISO 8601 standard, aligns with business week)
   - **Action:** Confirm with stakeholder if not specified
   - **Implementation:** `weekStartsOn={1}` in Calendar component (Monday = 1, Sunday = 0)

4. **"Today" Button in Calendar**
   - What we know: react-day-picker v8 removed `todayButton` prop
   - What's unclear: Whether to add custom "Today" button
   - Recommendation: Add "Today" button in popover footer for UX convenience
   - **Action:** Implement as custom button that calls `onDateChange(new Date())`

## Sources

### Primary (HIGH confidence)
- **Codebase analysis:**
  - `/components/ui/dialog.tsx` - Radix Dialog usage
  - `/components/ui/select.tsx` - Radix Select with grouping
  - `/components/ui/toast.tsx` - Toast notification system
  - `/components/ui/use-toast.tsx` - Toast hook implementation
  - `/components/ui/date-picker.tsx` - DatePicker with react-day-picker v8
  - `/components/ui/calendar.tsx` - Calendar component configuration
  - `/lib/hooks/use-permissions.ts` - Permission checking system
  - `/components/history/history-tab.tsx` - Audit log display with status_change action
  - `/supabase/migrations/026_audit_triggers.sql` - Audit trigger for status changes
  - `/types/database.ts` - Status config types with status_group
  - `package.json` - Confirmed library versions

### Secondary (MEDIUM confidence)
- [Radix UI Dropdown Menu documentation](https://www.radix-ui.com/primitives/docs/components/dropdown-menu) - Positioning and collision handling
- [React DayPicker v8 documentation](https://daypicker.dev/v8) - Configuration options
- [Developer Way: Debouncing in React](https://www.developerway.com/posts/debouncing-in-react) - Debounce patterns
- [Dmitri Pavlutin: React Throttle Debounce](https://dmitripavlutin.com/react-throttle-debounce/) - Stale closure prevention
- [React Async States](https://incepter.github.io/react-async-states/docs/intro/) - Race condition handling

### Tertiary (LOW confidence)
- [LogRocket: Create Dropdown Menu in React](https://blog.logrocket.com/how-create-dropdown-menu-react/) - General dropdown patterns (adapted to Radix)
- [Interactive Dropdown Menus with Radix UI](https://www.joshuawootonn.com/radix-interactive-dropdown) - Radix usage examples

## Metadata

**Confidence breakdown:**
- Standard stack: **HIGH** - All libraries already in package.json with versions verified
- Architecture patterns: **HIGH** - Based on existing codebase patterns (Dialog, Select, Toast, permissions)
- Common pitfalls: **MEDIUM** - Race conditions and stale closures are general React concerns, applied to this context
- Audit integration: **HIGH** - Existing trigger handles status_change action type

**Research date:** 2026-01-28
**Valid until:** 2026-04-28 (90 days - stack is stable, React patterns don't change rapidly)

**Note:** Phase 6 has clear CONTEXT.md decisions that constrain research scope. No exploration of alternative dropdown libraries or animation frameworks needed—Radix UI primitives already established in codebase.
