# Phase 9: Manual Stock-In Enhancement - Research

**Researched:** 2026-01-30
**Domain:** Frontend form enhancement with currency/EUSD calculations
**Confidence:** HIGH

## Summary

Phase 9 is a **frontend-only** enhancement to the existing manual stock-in form. The database layer (Phase 8) already supports currency codes (USD, MMK, CNY, THB), exchange rate validation (positive, USD=1.0), and the WAC trigger handles currency/exchange_rate from inventory_transactions.

The task is to enhance `/app/(dashboard)/inventory/stock-in/page.tsx` to add currency selection, exchange rate input, and real-time EUSD calculation display. The existing codebase has established patterns for this from QMHQ expense forms and invoice creation.

**Primary recommendation:** Reuse existing patterns from QMHQ expense route form (lines 543-637 of `/app/(dashboard)/qmhq/new/[route]/page.tsx`) for currency selector, exchange rate input, and EUSD calculation panel.

## Standard Stack

### Core (Already in Project)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| React | 18.x | UI framework | Next.js App Router |
| Next.js | 14.x | Full-stack framework | Project standard |
| @/components/ui | custom | UI components (Select, Input) | Project standard |
| @/lib/utils | custom | formatCurrency, calculateEUSD | Already implemented |

### Supporting (Already Available)
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| lucide-react | 0.x | Icons (Calculator, DollarSign) | EUSD display panel |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Inline currencies array | Shared currency config | Consistency vs. simplicity |

**Installation:** No new packages needed.

## Architecture Patterns

### Recommended Project Structure
No new files required. Modify existing file:
```
app/
├── (dashboard)/
│   └── inventory/
│       └── stock-in/
│           └── page.tsx  # Modify manual mode section
```

### Pattern 1: String State for Number Inputs
**What:** Store numeric input values as strings, convert on submission
**When to use:** Exchange rate input (allows empty placeholder, 4 decimal precision)
**Example:**
```typescript
// Source: Existing pattern from qmhq/new/[route]/page.tsx:91-92
const [exchangeRate, setExchangeRate] = useState("1");

// On change
setExchangeRate(e.target.value);

// On submit
exchange_rate: parseFloat(exchangeRate) || 1,
```

### Pattern 2: Real-time EUSD Calculation with useMemo
**What:** Calculate EUSD equivalent as user types, display in highlighted panel
**When to use:** Any form with amount + exchange rate
**Example:**
```typescript
// Source: Existing pattern from qmhq/new/[route]/page.tsx:94-100
const calculatedEusd = useMemo(() => {
  const amountNum = parseFloat(amount) || 0;
  const rateNum = parseFloat(exchangeRate) || 1;
  if (rateNum <= 0) return 0;
  // Round to 2 decimal places to avoid floating point precision issues
  return Math.round((amountNum / rateNum) * 100) / 100;
}, [amount, exchangeRate]);
```

### Pattern 3: Currency Selection with USD Rate Lock
**What:** When USD selected, auto-set exchange rate to 1.0 and disable input
**When to use:** Phase 8 constraint requires USD exchange_rate = 1.0
**Example:**
```typescript
// New pattern for this phase
const handleCurrencyChange = (value: string) => {
  setCurrency(value);
  if (value === 'USD') {
    setExchangeRate('1');
  }
};
```

### Pattern 4: EUSD Calculation Panel
**What:** Colored panel showing formula and result
**When to use:** Display EUSD equivalent prominently
**Example:**
```tsx
// Source: qmhq/new/[route]/page.tsx:604-619
<div className="p-4 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
  <div className="flex items-center justify-between">
    <div className="flex items-center gap-2">
      <Calculator className="h-5 w-5 text-emerald-400" />
      <span className="text-sm text-slate-300">Calculated EUSD Amount</span>
    </div>
    <div className="flex items-center gap-1">
      <span className="text-2xl font-mono font-bold text-emerald-400">
        {formatCurrency(calculatedEusd)}
      </span>
      <span className="text-emerald-400 font-medium">EUSD</span>
    </div>
  </div>
  <p className="text-xs text-slate-400 mt-2">
    Formula: {formatCurrency(totalValue)} {currency} ÷ {exchangeRate || "1"} = {formatCurrency(calculatedEusd)} EUSD
  </p>
</div>
```

### Anti-Patterns to Avoid
- **Hardcoding different currencies in UI vs database:** Database allows USD, MMK, CNY, THB only. UI must match.
- **Using type="number" without string state:** Causes issues with placeholder display and decimal precision.
- **Calculating EUSD on every render:** Use useMemo to avoid unnecessary recalculations.

## Don't Hand-Roll

Problems that look simple but have existing solutions:

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Currency formatting | Custom formatter | `formatCurrency()` from lib/utils | Consistent 2-decimal display |
| EUSD calculation | Custom division | `calculateEUSD()` from lib/utils | Handles edge cases |
| Exchange rate formatting | Custom formatter | `formatExchangeRate()` from lib/utils/inventory | 4-decimal display |
| Number input styling | Custom CSS | Existing Input classes with `[appearance:textfield]` | Hides browser spinners |

**Key insight:** All currency/EUSD patterns already exist in the codebase. This phase is assembly, not creation.

## Common Pitfalls

### Pitfall 1: Currency Mismatch Between UI and Database
**What goes wrong:** UI offers EUR, SGD but database constraint only allows USD, MMK, CNY, THB
**Why it happens:** QMHQ expense form has outdated currency list not aligned with Phase 8 constraints
**How to avoid:** Use currencies matching database constraint: `['USD', 'MMK', 'CNY', 'THB']`
**Warning signs:** Database error "violates check constraint" on insert

### Pitfall 2: USD Exchange Rate Not 1.0
**What goes wrong:** User selects USD and enters different exchange rate, database rejects
**Why it happens:** Phase 8 added constraint: USD must have exchange_rate = 1.0
**How to avoid:** Auto-set and disable exchange rate input when USD selected
**Warning signs:** Database error mentioning "usd_rate_one" constraint

### Pitfall 3: Floating Point Display Issues
**What goes wrong:** EUSD shows as 123.456789 instead of 123.46
**Why it happens:** JavaScript floating point arithmetic
**How to avoid:** Use `Math.round((value) * 100) / 100` before display
**Warning signs:** Long decimal numbers in UI

### Pitfall 4: Empty Exchange Rate Submission
**What goes wrong:** User clears exchange rate, form submits null or 0
**Why it happens:** String to number conversion without fallback
**How to avoid:** Use `parseFloat(exchangeRate) || 1` as fallback
**Warning signs:** Database error "exchange_rate must be positive"

## Code Examples

Verified patterns from existing codebase:

### Currency Options Constant (UPDATED for Phase 8 constraints)
```typescript
// Aligned with database constraint: CHECK (currency IN ('USD', 'MMK', 'CNY', 'THB'))
const SUPPORTED_CURRENCIES = [
  { value: 'MMK', label: 'MMK - Myanmar Kyat' },
  { value: 'USD', label: 'USD - US Dollar' },
  { value: 'CNY', label: 'CNY - Chinese Yuan' },
  { value: 'THB', label: 'THB - Thai Baht' },
];
```

### Form State Additions
```typescript
// Add to existing manual mode state section (around line 104-105)
const [currency, setCurrency] = useState('MMK');
const [exchangeRate, setExchangeRate] = useState('1');
```

### EUSD Calculation
```typescript
// Add useMemo for real-time calculation
const calculatedEusd = useMemo(() => {
  const cost = parseFloat(manualUnitCost) || 0;
  const qty = parseFloat(manualQuantity) || 0;
  const rate = parseFloat(exchangeRate) || 1;
  const total = cost * qty;
  if (rate <= 0) return 0;
  return Math.round((total / rate) * 100) / 100;
}, [manualUnitCost, manualQuantity, exchangeRate]);
```

### Currency Change Handler
```typescript
const handleCurrencyChange = (value: string) => {
  setCurrency(value);
  if (value === 'USD') {
    setExchangeRate('1');
  }
};
```

### Database Insert (modified from existing)
```typescript
// Update existing manual mode insert (around line 345-361)
const { error: insertError } = await supabase
  .from("inventory_transactions")
  .insert({
    movement_type: "inventory_in",
    item_id: manualItemId,
    warehouse_id: warehouseId,
    quantity: qty,
    unit_cost: cost,
    currency: currency,                           // Changed from hardcoded "MMK"
    exchange_rate: parseFloat(exchangeRate) || 1, // Changed from hardcoded 1
    transaction_date: transactionDate.toISOString().split("T")[0],
    notes: notes || null,
    status: "completed",
    created_by: user.id,
  });
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Hardcoded MMK currency | User-selectable currency | Phase 9 | Multi-currency support |
| Hardcoded 1.0 exchange rate | User-entered rate (4 decimals) | Phase 9 | Accurate EUSD calculations |
| No EUSD display | Real-time EUSD panel | Phase 9 | Financial visibility |

**Deprecated/outdated:**
- EUR, SGD currencies: Not supported by database constraints (Phase 8 decision)

## Open Questions

Things that couldn't be fully resolved:

1. **Should currency selector be shared component?**
   - What we know: Multiple places use currency selection (QMHQ expense, transaction dialog, now stock-in)
   - What's unclear: Whether to create shared CurrencySelect component now or continue with inline arrays
   - Recommendation: Continue with inline array for now, create shared component in future cleanup phase

2. **Exchange rate auto-populate from recent transactions?**
   - What we know: Discussed in .planning/research/FEATURES.md line 260
   - What's unclear: Not specified in Phase 9 requirements
   - Recommendation: Out of scope for Phase 9. User enters rate manually each time.

## Sources

### Primary (HIGH confidence)
- `/app/(dashboard)/inventory/stock-in/page.tsx` - Existing form to modify
- `/app/(dashboard)/qmhq/new/[route]/page.tsx` lines 42-48, 543-637 - Currency/EUSD patterns
- `/supabase/migrations/038_currency_constraints.sql` - Database constraints
- `/supabase/migrations/024_inventory_wac_trigger.sql` - WAC calculation

### Secondary (MEDIUM confidence)
- `/lib/utils/index.ts` - formatCurrency, calculateEUSD utilities
- `/lib/utils/inventory.ts` - formatExchangeRate utility
- `.planning/phases/08-database-foundation/08-CONTEXT.md` - Currency decisions

### Tertiary (LOW confidence)
- None

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - All libraries already in use
- Architecture: HIGH - Patterns verified in existing code
- Pitfalls: HIGH - Constraints documented in Phase 8

**Research date:** 2026-01-30
**Valid until:** 30 days (stable patterns, no external dependencies)
