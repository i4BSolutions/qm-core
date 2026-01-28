# Phase 7: UX Polish - Research

**Researched:** 2026-01-29
**Domain:** React form inputs (date pickers, number inputs, validation)
**Confidence:** HIGH

## Summary

Phase 7 fixes UX inconsistencies in transaction forms: replacing native date input with DatePicker component, improving number input behavior for direct typing, and adding validation to prevent invalid values. The codebase already has all necessary components and libraries - this is a consistency pass, not new feature development.

**Key findings:**
- Transaction dialog uses native `<Input type="date">` instead of the established `<DatePicker>` component
- DatePicker component already has DD/MM/YYYY format (`format(date, "dd/MM/yyyy")`) and Monday week start
- Number inputs use numeric default values that interfere with direct typing (e.g., `exchangeRate = 1`)
- CONTEXT.md requires month/year dropdown navigation - Calendar component currently uses arrows
- Validation for negatives/zero uses only `min` attribute which doesn't prevent keyboard input

**Primary recommendation:** Replace native date input with DatePicker in transaction-dialog.tsx, update Calendar to use month/year dropdowns, and fix number inputs to use empty string state with placeholder display.

## Standard Stack

No new dependencies needed. All libraries already integrated:

### Core Components (Already Exist)
| Component | Location | Status | Change Needed |
|-----------|----------|--------|---------------|
| DatePicker | `/components/ui/date-picker.tsx` | Working | Use in transaction dialog |
| Calendar | `/components/ui/calendar.tsx` | Working | Add month/year dropdowns |
| Input | `/components/ui/input.tsx` | Working | No changes |
| react-day-picker | v8.10.1 (package.json) | Installed | Use captionLayout prop |
| date-fns | v3.6.0 (package.json) | Installed | Already used for formatting |

### Date Formatting (Verified)
| Format String | date-fns | Example Output |
|---------------|----------|----------------|
| `dd/MM/yyyy` | Day/Month/Year | 29/01/2026 |
| `dd` | Zero-padded day | 01, 15, 31 |
| `MM` | Zero-padded month | 01, 12 |
| `yyyy` | 4-digit year | 2026 |

**Source:** Existing usage in `/components/ui/date-picker.tsx` line 61: `format(date, "dd/MM/yyyy")`

## Architecture Patterns

### Pattern 1: Replace Native Date Input with DatePicker

**What:** Transaction dialog uses `<Input type="date">` which shows browser-native format (varies by browser/locale)
**Problem location:** `/components/qmhq/transaction-dialog.tsx` lines 388-398
**Current code:**
```typescript
<Input
  id="transaction_date"
  type="date"
  value={transactionDate}
  onChange={(e) => setTransactionDate(e.target.value)}
  className="bg-slate-800/50 border-slate-700 text-slate-200"
/>
```

**Solution:** Replace with DatePicker component
```typescript
import { DatePicker } from "@/components/ui/date-picker";

// Change state from string to Date
const [transactionDate, setTransactionDate] = useState<Date>(new Date());

// In JSX:
<DatePicker
  date={transactionDate}
  onDateChange={(date) => date && setTransactionDate(date)}
/>

// When submitting, format for database:
transaction_date: transactionDate.toISOString().split("T")[0]
```

**Why this works:** DatePicker already uses `format(date, "dd/MM/yyyy")` for display, matching the system standard.

### Pattern 2: Month/Year Dropdown Navigation

**What:** CONTEXT.md requires "Month/year navigation via dropdowns (not arrows)"
**Why:** Allows jumping to distant dates quickly (e.g., backdating a transaction 6 months)
**Implementation:** react-day-picker v8 supports `captionLayout` prop

```typescript
// In /components/ui/calendar.tsx
<DayPicker
  captionLayout="dropdown-buttons"  // Shows month AND year dropdowns
  fromYear={2020}                   // Earliest year in dropdown
  toYear={2030}                     // Latest year in dropdown
  // ... other existing props
/>
```

**Available options for `captionLayout`:**
- `"buttons"` - Navigation arrows only (current behavior)
- `"dropdown"` - Month/year dropdowns only
- `"dropdown-buttons"` - Dropdowns + navigation arrows (recommended)

**Source:** react-day-picker documentation (props reference)

### Pattern 3: Number Input with Empty Initial State

**What:** Number inputs should start empty, showing placeholder, allowing direct typing
**Problem:** Current pattern uses numeric default like `useState(1)` which displays "1" in input
**User expectation:** Click input, type "500", see "500" (not have to delete "1" first)

**Current problematic pattern:**
```typescript
// PO form - lines 70, 76
const [exchangeRate, setExchangeRate] = useState(1);
const [lineItems, setLineItems] = useState([
  { quantity: 1, unit_price: 0 }  // 0 displays as "0"
]);
```

**Solution - String state with empty default:**
```typescript
const [exchangeRate, setExchangeRate] = useState<string>("");

// Input with placeholder
<Input
  type="number"
  value={exchangeRate}
  onChange={(e) => setExchangeRate(e.target.value)}
  placeholder="1.0000"  // Shows when empty
/>

// Parse when using:
const rate = parseFloat(exchangeRate) || 1;  // Default to 1 if empty/invalid
```

**Alternative - Select-all on focus:**
```typescript
<Input
  type="number"
  value={exchangeRate}
  onFocus={(e) => e.target.select()}  // Select all text on focus
  onChange={(e) => setExchangeRate(parseFloat(e.target.value) || 1)}
/>
```

**Recommendation:** Use string state with empty default for amount/exchange rate fields. This matches the existing pattern in transaction-dialog.tsx which already uses `useState("")` for amount.

### Pattern 4: Preventing Negative Values in Number Inputs

**What:** UX-03 requires number fields to reject negative values and zero where inappropriate
**Problem:** `min="0"` attribute only affects spinner arrows, not keyboard input

**Multi-layer validation approach:**

```typescript
// 1. HTML attributes (spinner + form validation)
<Input
  type="number"
  min="0.01"         // Minimum value
  step="0.01"        // Step increment
/>

// 2. onChange handler (real-time filtering)
onChange={(e) => {
  const val = e.target.value;
  // Allow empty for typing
  if (val === "") {
    setAmount("");
    return;
  }
  // Prevent negative
  const num = parseFloat(val);
  if (!isNaN(num) && num >= 0) {
    setAmount(val);
  }
}}

// 3. onKeyDown prevention (blocks minus key)
onKeyDown={(e) => {
  if (e.key === "-" || e.key === "e") {
    e.preventDefault();
  }
}}

// 4. onPaste prevention (blocks pasting negatives)
onPaste={(e) => {
  const pasted = e.clipboardData.getData("text");
  if (pasted.includes("-")) {
    e.preventDefault();
  }
}}
```

**Validation timing (Claude's discretion per CONTEXT.md):**
- **Real-time (onChange):** Better UX, immediate feedback, recommended
- **On blur:** Less intrusive but delayed feedback

**Recommendation:** Use real-time onChange validation with onKeyDown for minus/e key blocking.

### Anti-Patterns to Avoid

1. **Don't use `value={0}` for empty state** - Displays "0" which user must delete
2. **Don't rely only on `min` attribute** - Doesn't prevent keyboard input of negatives
3. **Don't convert to number immediately in onChange** - Breaks decimal input (user types "5." and it becomes "5")
4. **Don't redesign the calendar** - CONTEXT.md says "keep existing calendar style consistent"

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Date picker | Custom input with format parsing | Existing DatePicker component | Already styled, tested, DD/MM/YYYY formatted |
| Month/year navigation | Custom dropdown components | react-day-picker `captionLayout` prop | Built-in, handles all edge cases |
| Number formatting | Manual string manipulation | Browser's `type="number"` with validation handlers | Native spinner, step, keyboard handling |
| Negative value blocking | Complex regex validation | Simple onKeyDown + onChange guards | Minimal code, covers all cases |

**Key insight:** This phase is about using existing components correctly, not building new ones.

## Common Pitfalls

### Pitfall 1: Date String Format Mismatch
**What goes wrong:** Database expects `YYYY-MM-DD`, UI shows `DD/MM/YYYY`, confusion during save
**Why it happens:** Mixing display format with storage format
**How to avoid:**
- DatePicker uses Date objects internally
- Convert to ISO string only when saving: `date.toISOString().split("T")[0]`
- Never parse the display string directly
**Warning signs:** Dates appearing incorrectly after save, month/day swapped

### Pitfall 2: Number Input Losing Decimal Point
**What goes wrong:** User types "5." and it immediately becomes "5"
**Why it happens:** Parsing to number in onChange removes trailing decimal
**How to avoid:**
- Keep state as string during editing
- Parse to number only when using the value (calculations, submit)
- Example: `const rate = parseFloat(exchangeRate) || 1;`
**Warning signs:** Can't type decimal numbers smoothly

### Pitfall 3: Breaking Existing Form Functionality
**What goes wrong:** Changing state type from number to string breaks calculations
**Why it happens:** Other code expects numeric state
**How to avoid:**
- Search for all usages of state variable before changing
- Update calculations to use `parseFloat(value) || defaultValue`
- Test form submission end-to-end
**Warning signs:** NaN appearing in calculations, form validation failing

### Pitfall 4: Calendar Year Range Too Narrow
**What goes wrong:** User can't select date from 2019 (dropdown doesn't show it)
**Why it happens:** `fromYear`/`toYear` props too restrictive
**How to avoid:**
- Set reasonable range: `fromYear={2020}` to `toYear={2030}`
- Consider business context (how far back might users need to go?)
**Warning signs:** Users complaining they can't select historical dates

### Pitfall 5: Transaction Dialog State Reset Issue
**What goes wrong:** After replacing date input, dialog opens with wrong date
**Why it happens:** Reset function doesn't update to use Date object
**How to avoid:**
- Check `resetForm()` function in transaction-dialog.tsx
- Update: `setTransactionDate(new Date())` not `setTransactionDate(new Date().toISOString().split("T")[0])`
**Warning signs:** Dialog shows stale date, date doesn't reset after closing

## Code Examples

### Forms That Need Date Picker Fix

**Transaction Dialog** (`/components/qmhq/transaction-dialog.tsx`):
```typescript
// Current (line 71-72) - string state
const [transactionDate, setTransactionDate] = useState(
  new Date().toISOString().split("T")[0]
);

// Fix - Date object state
const [transactionDate, setTransactionDate] = useState<Date>(new Date());

// Current JSX (lines 388-398) - native input
<Input id="transaction_date" type="date" value={transactionDate} ... />

// Fix - DatePicker component
<DatePicker
  date={transactionDate}
  onDateChange={(date) => date && setTransactionDate(date)}
/>

// Reset function (line 91) - update
setTransactionDate(new Date());

// Submit (line 195) - format for database
transaction_date: transactionDate.toISOString().split("T")[0],
```

### Number Input with Validation

```typescript
// Component for reusable validated number input
interface ValidatedNumberInputProps {
  value: string;
  onChange: (value: string) => void;
  min?: number;
  placeholder?: string;
  step?: string;
}

function ValidatedNumberInput({
  value,
  onChange,
  min = 0,
  placeholder = "0.00",
  step = "0.01"
}: ValidatedNumberInputProps) {
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    if (val === "") {
      onChange("");
      return;
    }
    const num = parseFloat(val);
    if (!isNaN(num) && num >= min) {
      onChange(val);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    // Block minus and scientific notation
    if (e.key === "-" || e.key === "e" || e.key === "E") {
      e.preventDefault();
    }
  };

  return (
    <Input
      type="number"
      min={min}
      step={step}
      value={value}
      onChange={handleChange}
      onKeyDown={handleKeyDown}
      placeholder={placeholder}
      className="font-mono [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
    />
  );
}
```

### Calendar with Month/Year Dropdowns

```typescript
// /components/ui/calendar.tsx
function Calendar({
  className,
  classNames,
  showOutsideDays = true,
  ...props
}: CalendarProps) {
  return (
    <DayPicker
      showOutsideDays={showOutsideDays}
      weekStartsOn={1}              // Monday
      captionLayout="dropdown-buttons"  // NEW: Month/year dropdowns
      fromYear={2020}               // NEW: Earliest year
      toYear={2030}                 // NEW: Latest year
      className={cn("p-3", className)}
      classNames={{
        // ... existing classNames
        dropdown: "bg-slate-800 border-slate-700 text-slate-200 rounded px-2 py-1",
        dropdown_month: "mr-2",
        dropdown_year: "",
        // ... rest of classNames
      }}
      // ... rest of component
    />
  );
}
```

## Audit: Forms Requiring Number Input Fixes

Based on codebase grep, these forms have number inputs that may need attention:

| File | Field | Current Default | Issue | Fix Needed |
|------|-------|-----------------|-------|------------|
| `transaction-dialog.tsx` | amount | `""` | OK (already empty) | No |
| `transaction-dialog.tsx` | exchangeRate | `"1"` | Shows "1" in input | String empty + placeholder |
| `po/new/page.tsx` | exchangeRate | `1` (number) | Shows "1" in input | String empty + placeholder |
| `invoice/new/page.tsx` | exchangeRate | `1` (number) | Shows "1" in input | String empty + placeholder |
| `stock-in/page.tsx` | manualQuantity | `1` (number) | Shows "1" in input | String empty + placeholder |
| `stock-in/page.tsx` | manualUnitCost | `0` (number) | Shows "0" in input | String empty + placeholder |
| `stock-out/page.tsx` | quantity | `1` (number) | Shows "1" in input | String empty + placeholder |
| `qmhq/new/[route]/page.tsx` | amount | `""` | OK (already empty) | No |
| `qmhq/new/[route]/page.tsx` | exchangeRate | `""` | OK (already empty) | No |

**Priority for UX-02 (empty placeholder instead of default values):**
1. `transaction-dialog.tsx` - exchangeRate (transaction forms are phase focus)
2. Other forms - lower priority, can be done for consistency

## State of the Art

| Old Approach | Current Approach | Change Date | Impact |
|--------------|------------------|-------------|--------|
| Native `<input type="date">` | DatePicker component | v1.1 (Phase 6) | DD/MM/YYYY consistency |
| Arrow-only calendar navigation | Month/year dropdowns | Phase 7 (now) | Faster date selection |
| Numeric default values | Empty string + placeholder | Phase 7 (now) | Direct typing UX |
| `min` attribute only | onKeyDown + onChange guards | Phase 7 (now) | Full negative prevention |

**Already deprecated in codebase:**
- Native date inputs in most forms (replaced with DatePicker in v1.1)
- Hard-coded status dropdowns (replaced with dynamic status_config)

## Open Questions

1. **Line item table number inputs**
   - What we know: PO and Invoice line item tables have quantity/price inputs
   - What's unclear: Whether these should also get empty defaults
   - Recommendation: Audit during implementation, apply same pattern if problematic

2. **Admin forms (status/category)**
   - What we know: These have `display_order` number inputs
   - What's unclear: Whether admin forms are in scope for UX-02
   - Recommendation: Focus on transaction forms per phase scope, admin forms are edge case

## Sources

### Primary (HIGH confidence)
- **Codebase analysis:**
  - `/components/ui/date-picker.tsx` - Current DatePicker implementation with DD/MM/YYYY
  - `/components/ui/calendar.tsx` - Calendar with react-day-picker v8
  - `/components/qmhq/transaction-dialog.tsx` - Form to update
  - `package.json` - react-day-picker 8.10.1, date-fns 3.6.0
  - Phase 6 research - Date picker patterns already documented

### Secondary (MEDIUM confidence)
- [MDN: Input type number](https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/input/number) - HTML number input behavior
- [W3Docs: Positive Numbers Only](https://www.w3docs.com/snippets/html/how-to-allow-only-positive-numbers-in-the-input-number-type.html) - Validation approaches
- react-day-picker GitHub discussions - captionLayout prop usage

### Tertiary (LOW confidence)
- Various React number input blog posts - General patterns confirmed against official docs

## Metadata

**Confidence breakdown:**
- Date picker fix: **HIGH** - Straightforward component replacement, pattern established in v1.1
- Calendar dropdowns: **HIGH** - react-day-picker prop documented, simple addition
- Number input UX: **HIGH** - Pattern from existing transaction-dialog.tsx amount field
- Validation approach: **MEDIUM** - Multiple approaches exist, recommended pattern is standard

**Research date:** 2026-01-29
**Valid until:** 2026-04-29 (90 days - no expected changes to react-day-picker or date-fns)

**Note:** Phase 7 CONTEXT.md provides clear decisions (picker-only, DD/MM/YYYY, Monday start, month/year dropdowns). Research focuses on implementation patterns, not alternative exploration.
