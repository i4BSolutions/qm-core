# Phase 26: Currency Unification - Research

**Researched:** 2026-02-08
**Domain:** Financial transaction UI, currency inheritance, form validation
**Confidence:** HIGH

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

#### Currency Inheritance
- Currency for money-in and money-out comes from QMHQ route (expense/po), not from first transaction
- QMHQ expense/po route always has currency defined - no edge case for missing currency
- Money-in currency: locked to QMHQ currency (read-only)
- Money-out currency: locked to QMHQ currency (read-only)
- Money-in exchange rate: editable per transaction (default from QMHQ)
- Money-out exchange rate: editable per transaction (default from QMHQ)
- PO created from QMHQ: currency defaults from QMHQ but user can choose differently
- Show visual indicator (lock icon or label) on form fields to indicate inherited currency

#### Balance Display
- No changes from earlier milestone - balance shown in existing "Balance in Hand" card on QMHQ detail page
- Money-out form shows static current balance (no real-time update as user types)
- Balance in Hand card shows both org currency and EUSD (using CurrencyDisplay pattern)
- Zero balance shows as "0.00" with no special visual state

#### Validation Behavior
- "Exceeds balance" validation triggers on submit only
- Warning only, not hard block (allows edge cases)
- Detailed message format: "Amount exceeds balance by X (Available: Y)"
- UI validation only, no database constraint

#### Dual Currency Display
- Use existing CurrencyDisplay component (two-line format: org primary, EUSD secondary)
- All QMHQ amounts show dual currency: money-in total, money-out total, balance, budget
- Money-in/money-out transaction tables show dual currency per row
- Use compact formatting (K/M/B) from Phase 24 with same thresholds

### Claude's Discretion
- Exact lock icon design and placement
- Precise formatting of warning message
- Table column layout for dual currency in transaction rows

### Deferred Ideas (OUT OF SCOPE)
None - discussion stayed within phase scope

</user_constraints>

## Summary

This phase implements currency unification for QMHQ financial transactions, ensuring money-in and money-out transactions inherit their currency from the parent QMHQ. The implementation is primarily a UI change to the existing `TransactionDialog` component, with additional updates to display dual currency amounts throughout the QMHQ detail page.

The codebase already has all the foundational pieces in place:
- `CurrencyDisplay` component with compact formatting (Phase 24)
- Financial transactions table with currency/exchange_rate fields
- Balance in Hand calculation via database trigger on QMHQ table
- Lock icon pattern established in QMHQ creation workflow

**Primary recommendation:** Modify `TransactionDialog` to fetch QMHQ currency on mount, lock the currency field, default exchange rate from QMHQ, and add balance validation warning on submit.

## Standard Stack

The phase uses existing codebase patterns with no new dependencies.

### Core Components (Already Exist)
| Component | Location | Purpose | Reuse |
|-----------|----------|---------|-------|
| CurrencyDisplay | `/components/ui/currency-display.tsx` | Dual currency display with compact formatting | Use directly |
| TransactionDialog | `/components/qmhq/transaction-dialog.tsx` | Money-in/out form | Modify |
| ExchangeRateInput | `/components/ui/exchange-rate-input.tsx` | 4 decimal exchange rate input | Use directly |
| Lock icon | `lucide-react` | Visual indicator for locked fields | Use directly |

### Supporting (Already Exist)
| Component | Location | Purpose | When to Use |
|-----------|----------|---------|-------------|
| AmountInput | `/components/ui/amount-input.tsx` | 2 decimal amount input | Already in form |
| formatCurrency | `/lib/utils` | Format currency values | For warning messages |
| calculateEUSD | `/lib/utils` | Calculate EUSD from amount/rate | For validation |

### No New Libraries Needed
This phase is purely UI modifications to existing components with no new dependencies.

## Architecture Patterns

### Pattern 1: Locked Field with Visual Indicator

The QMHQ creation workflow already establishes the pattern for locked fields:

```typescript
// Source: app/(dashboard)/qmhq/new/page.tsx lines 350-384
<Label htmlFor="qmrl_id" className="data-label flex items-center gap-2">
  Parent QMRL <span className="text-red-400">*</span>
  {isQmrlLocked && (
    <span className="flex items-center gap-1 text-xs text-amber-500 font-normal">
      <Lock className="h-3 w-3" />
      Locked
    </span>
  )}
</Label>
<Select
  value={formData.qmrl_id}
  onValueChange={(value) => setFormData({ ...formData, qmrl_id: value })}
  disabled={isQmrlLocked}
>
  <SelectTrigger className={`bg-slate-800/50 border-slate-700 ${isQmrlLocked ? "opacity-70 cursor-not-allowed" : ""}`}>
    ...
  </SelectTrigger>
</Select>
<p className="text-xs text-slate-400">
  {isQmrlLocked
    ? "This QMHQ is being created from the parent QMRL"
    : "This QMHQ will be linked to the selected QMRL"}
</p>
```

**Recommendation for Currency Field:**
- Add Lock icon next to label: "Currency" + Lock icon + "Inherited" badge
- Disable the Select component
- Add helper text: "Currency is set by the parent QMHQ"
- Use `opacity-70 cursor-not-allowed` for visual feedback

### Pattern 2: Pre-fetching Parent Data on Dialog Open

Current TransactionDialog receives only `qmhqId`. Modify to fetch QMHQ data on open:

```typescript
// Recommended pattern
const [qmhqData, setQmhqData] = useState<{ currency: string; exchange_rate: number; balance_in_hand: number } | null>(null);

useEffect(() => {
  if (open && qmhqId) {
    const fetchQmhqData = async () => {
      const supabase = createClient();
      const { data } = await supabase
        .from('qmhq')
        .select('currency, exchange_rate, balance_in_hand')
        .eq('id', qmhqId)
        .single();
      if (data) {
        setQmhqData(data);
        setCurrency(data.currency || 'MMK');
        setExchangeRate(String(data.exchange_rate || 1));
      }
    };
    fetchQmhqData();
  }
}, [open, qmhqId]);
```

### Pattern 3: Soft Validation Warning on Submit

Per user decision, exceeds-balance is a warning, not a hard block:

```typescript
// In handleSubmit
const handleSubmit = async () => {
  // Calculate balance warning
  if (transactionType === 'money_out' && qmhqData) {
    const availableBalance = qmhqData.balance_in_hand ?? 0;
    if (calculatedEusd > availableBalance) {
      const excessAmount = calculatedEusd - availableBalance;
      toast({
        title: "Balance Warning",
        description: `Amount exceeds balance by ${formatCurrency(excessAmount)} EUSD (Available: ${formatCurrency(availableBalance)} EUSD)`,
        variant: "warning", // Amber/yellow, not destructive
      });
      // Continue with submission - this is a warning, not a block
    }
  }

  // ... rest of submit logic
};
```

### Pattern 4: Dual Currency in Transaction Table

The QMHQ detail page already shows transactions. Update to use CurrencyDisplay:

```typescript
// Current pattern (QMHQ detail page line ~1005-1014)
<p className={`text-lg font-mono font-bold ${...}`}>
  {tx.transaction_type === "money_in" ? "+" : "-"}{formatCurrency(tx.amount_eusd ?? 0)} EUSD
</p>
<p className="text-xs text-slate-400">
  {formatCurrency(tx.amount ?? 0)} {tx.currency}
</p>

// Recommended replacement
<CurrencyDisplay
  amount={tx.amount}
  currency={tx.currency || "MMK"}
  amountEusd={tx.amount_eusd}
  size="md"
  align="right"
  context="card"
/>
```

### Anti-Patterns to Avoid

- **Real-time balance update:** User decided static balance display - don't update as user types
- **Hard block on exceed:** Use warning toast, allow submission to proceed
- **Database constraint:** Validation is UI-only, no database CHECK constraint
- **Alternative currencies:** Currency is locked/inherited, don't show currency dropdown

## Don't Hand-Roll

This phase reuses existing patterns. No new hand-rolling needed.

| Problem | Existing Solution | Location |
|---------|-------------------|----------|
| Dual currency display | CurrencyDisplay | `/components/ui/currency-display.tsx` |
| Compact number formatting | formatCompactCurrency | `/lib/utils/format-compact.ts` |
| Lock icon indicator | Lock from lucide-react | Already in use across codebase |
| Exchange rate input | ExchangeRateInput | `/components/ui/exchange-rate-input.tsx` |

**Key insight:** All building blocks exist. This phase is composition and modification, not creation.

## Common Pitfalls

### Pitfall 1: Currency Field Still Editable
**What goes wrong:** Currency dropdown remains functional despite "locked" styling
**Why it happens:** Forgot to add `disabled` prop to Select component
**How to avoid:** Always pair visual indicators with actual disabled state
**Warning signs:** User can click and change currency in test

### Pitfall 2: Exchange Rate Not Defaulting
**What goes wrong:** Exchange rate field is empty when dialog opens
**Why it happens:** `useEffect` doesn't run or data fetch fails silently
**How to avoid:** Add loading state, fallback to 1.0000 if fetch fails
**Warning signs:** Exchange rate shows placeholder instead of QMHQ value

### Pitfall 3: Balance Calculation Off by Decimals
**What goes wrong:** Warning shows incorrect excess amount
**Why it happens:** Floating point precision issues in JavaScript
**How to avoid:** Round to 2 decimal places before comparison and display
**Warning signs:** Balance shows values like 0.0000001

### Pitfall 4: Dialog State Not Resetting
**What goes wrong:** Previous transaction's currency/rate persists when opening for new transaction
**Why it happens:** State not reset in `resetForm` or on close
**How to avoid:** Reset all state in `resetForm`, re-fetch on each open
**Warning signs:** Second transaction shows first transaction's values

### Pitfall 5: Warning Toast Wrong Variant
**What goes wrong:** Toast shows red/destructive instead of amber/warning
**Why it happens:** Using `variant: "destructive"` instead of `"warning"`
**How to avoid:** Verify toast variant is "warning" (amber color)
**Warning signs:** Toast is red, implying hard error

## Code Examples

### Example 1: Locked Currency Field

```typescript
// Source: Pattern from app/(dashboard)/qmhq/new/page.tsx, adapted for TransactionDialog
<div className="grid gap-2">
  <Label htmlFor="currency" className="text-slate-300 flex items-center gap-2">
    Currency
    <span className="flex items-center gap-1 text-xs text-amber-500 font-normal">
      <Lock className="h-3 w-3" />
      Inherited
    </span>
  </Label>
  <Select
    value={currency}
    onValueChange={() => {}} // No-op since locked
    disabled={true}
  >
    <SelectTrigger className="bg-slate-800/50 border-slate-700 opacity-70 cursor-not-allowed">
      <SelectValue />
    </SelectTrigger>
    <SelectContent>
      {currencies.map((c) => (
        <SelectItem key={c.value} value={c.value}>
          {c.value}
        </SelectItem>
      ))}
    </SelectContent>
  </Select>
  <p className="text-xs text-slate-400">Currency is set by the parent QMHQ</p>
</div>
```

### Example 2: Balance Warning on Submit

```typescript
// Add to TransactionDialog handleSubmit
const handleSubmit = async () => {
  // Existing validation...

  // Balance warning for money-out
  if (transactionType === 'money_out') {
    const balance = qmhqData?.balance_in_hand ?? 0;
    const eusdAmount = calculatedEusd;

    if (eusdAmount > balance) {
      const excess = Math.round((eusdAmount - balance) * 100) / 100;
      const available = Math.round(balance * 100) / 100;

      toast({
        title: "Balance Warning",
        description: `Amount exceeds balance by ${formatCurrency(excess)} EUSD (Available: ${formatCurrency(available)} EUSD)`,
        variant: "warning",
      });
      // Note: Intentionally NOT returning here - warning only, not block
    }
  }

  // Continue with existing submit logic...
  setIsSubmitting(true);
  // ...
};
```

### Example 3: Balance Display with Dual Currency

```typescript
// For Balance in Hand card on QMHQ detail page
// Note: balance_in_hand is stored in EUSD (from total_money_in - total_po_committed)
<div className="text-center p-4 rounded-lg bg-purple-500/10 border border-purple-500/20">
  <p className="text-xs text-purple-400 uppercase tracking-wider mb-2">
    Balance in Hand
  </p>
  <CurrencyDisplay
    amount={qmhq.balance_in_hand ?? 0}
    currency="EUSD"
    size="lg"
    context="card"
    fluid
    className="text-purple-400"
  />
</div>
```

### Example 4: Transaction Table with Dual Currency

```typescript
// In transaction list on QMHQ detail page
{transactions.map((tx) => (
  <div key={tx.id} className={`p-4 rounded-lg border ${...}`}>
    <div className="flex items-center justify-between">
      {/* Left side content... */}
      <div className="text-right">
        <CurrencyDisplay
          amount={tx.amount}
          currency={tx.currency || "MMK"}
          amountEusd={tx.amount_eusd}
          size="md"
          align="right"
          context="card"
        />
      </div>
    </div>
    {/* Meta row... */}
  </div>
))}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| User selects currency per transaction | Currency inherited from QMHQ | Phase 26 | Prevents currency mismatch |
| Single currency display | Dual currency (org + EUSD) | Phase 24 | Always show EUSD equivalent |
| No balance validation | Soft warning on exceed | Phase 26 | User awareness without blocking |

**No deprecated patterns:** This phase extends existing patterns without deprecating anything.

## Open Questions

All questions resolved in CONTEXT.md discussion. No open questions remain.

## Sources

### Primary (HIGH confidence)
- `/components/ui/currency-display.tsx` - Existing dual currency component, verified in codebase
- `/components/qmhq/transaction-dialog.tsx` - Current dialog implementation, lines 1-493
- `/app/(dashboard)/qmhq/new/page.tsx` - Lock icon pattern, lines 350-384
- `/supabase/migrations/011_qmhq.sql` - QMHQ schema with balance_in_hand column
- `/supabase/migrations/012_financial_transactions.sql` - Transaction schema with currency/exchange_rate

### Secondary (MEDIUM confidence)
- `/lib/utils/format-compact.ts` - Compact formatting utility from Phase 24
- `/app/(dashboard)/qmhq/[id]/page.tsx` - Current QMHQ detail page displaying transactions

### Tertiary (LOW confidence)
None - all patterns verified in codebase.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - All components exist in codebase and verified
- Architecture: HIGH - Patterns established in prior phases (QMHQ creation, Phase 24)
- Pitfalls: MEDIUM - Based on common React/form patterns, not production incidents

**Research date:** 2026-02-08
**Valid until:** 2026-03-08 (30 days - stable internal patterns)
