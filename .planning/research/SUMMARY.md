# Project Research Summary

**Project:** QM System v1.3 UX & Bug Fixes
**Domain:** Internal ticket, expense, inventory management system
**Researched:** 2026-02-02
**Confidence:** MEDIUM-HIGH

## Executive Summary

v1.3 is a **debugging and polishing milestone** for the existing QM System, not a feature development sprint. The research confirms that all 7 issues have well-understood solutions using established patterns within the existing Next.js 14 + Supabase architecture. No new libraries or frameworks are required.

The recommended approach is to tackle fixes in three waves: (1) verify already-deployed fixes (RLS policy, stock-out tab), (2) execute low-risk UI standardization (currency display, number inputs), and (3) carefully implement the audit notes feature which requires trigger modification. The architecture research revealed that 2 of the 7 fixes are already complete in the codebase (RLS policy via migration 036, stock-out tab via lines 712-837 in QMHQ detail page), reducing actual work to 5 items.

Key risks center on the audit notes feature (status change notes not appearing in History tab), which requires coordinating changes between the UI layer and database trigger. The pitfalls research identified that trigger conditional logic order matters critically, and notes must be explicitly passed from UI to database since triggers only capture OLD/NEW row state. Mitigation involves manual audit log insertion with deduplication checks to avoid duplicate entries.

## Key Findings

### Recommended Stack

No stack changes required. All fixes use existing technologies:

**Core technologies (unchanged):**
- **Next.js 14+ App Router**: Server Components for pages, Client Components for interactivity
- **Supabase**: PostgreSQL database with RLS policies, audit triggers already in place
- **React 18**: Controlled input patterns need standardization, not replacement
- **TypeScript**: Strict mode continues to catch errors early

**Pattern corrections needed:**
- Use string state + blur formatting for number inputs instead of immediate parseFloat
- Use centralized formatCurrency/formatAmount utilities consistently
- Pass notes through status update flow to reach audit trigger

### Expected Features

**Must have (table stakes) - These are bugs, not features:**
- Delete attachments working for authorized users (owner + admin)
- Number inputs preserve entered values on blur
- Status change notes visible in History tab
- Consistent currency display (Original + EUSD only)
- Edit capability from all detail pages

**Should have (differentiators):**
- Quantity tracking for QMHQ item route partial fulfillment
- Standardized decimal formatting (2 for amounts, 4 for exchange rates)
- Permission-based delete button visibility (hide if user cannot delete)

**Defer (post-v1.3):**
- Batch status changes
- Advanced file management (rename, folders)
- Currency conversion calculator
- Fulfillment scheduling

### Architecture Approach

All fixes integrate with the existing v1.2 architecture without introducing new patterns. The database layer receives one new migration (audit trigger deduplication). The frontend layer requires standardizing existing patterns rather than creating new ones.

**Major components affected:**
1. **Status Change Flow**: StatusChangeDialog + clickable-status-badge + audit trigger
2. **Number Inputs**: All form components with controlled numeric inputs
3. **Currency Display**: 15-20 files with financial data rendering
4. **File Attachments**: RLS policy (already fixed in migration 036)

### Critical Pitfalls

1. **Missing WITH CHECK in RLS UPDATE Policies** — Always pair WITH CHECK with USING clause; verify SELECT policy exists for tables with UPDATE/INSERT policies. Already handled in migration 036.

2. **Notes Not Passed to Audit Log** — User-entered notes live in UI state, never reach database triggers. Solution: manual audit log INSERT before entity UPDATE, with trigger deduplication to prevent duplicates.

3. **Trigger Conditional Logic Order** — Specific checks (status_change, void) must come BEFORE generic UPDATE check. Wrong order causes status changes to log as generic updates, losing notes.

4. **Controlled Number Input onBlur Timing** — Use separate displayValue and internalValue state. Format on blur only, not during onChange. Test in Firefox (onBlur timing differs).

5. **Soft Delete Breaks Referential Queries** — Remember to filter `WHERE is_active = true` in all queries, especially aggregates (SUM, COUNT).

## Implications for Roadmap

Based on research, suggested phase structure:

### Phase 1: Verification (No Coding)
**Rationale:** Architecture research revealed 2 fixes are already complete. Verify before coding.
**Delivers:** Confirmation that RLS policy and stock-out tab work correctly.
**Addresses:** Fix 1 (attachment delete), Fix 7 partial (QMHQ stock-out tab exists)
**Avoids:** Unnecessary rework of completed features.

**Verification tasks:**
- Test attachment deletion with admin, quartermaster, and owner roles
- Confirm QMHQ item route shows Stock Out tab with Issue Items button
- Document any gaps if features don't work as expected

### Phase 2: Currency & Number Input Standardization
**Rationale:** Low-risk, high-impact presentation layer fixes. Independent of each other.
**Delivers:** Consistent number input behavior and currency display across all forms.
**Uses:** Existing formatCurrency(), formatAmount(), formatEUSD() utilities
**Implements:** Controlled input pattern with string state + blur formatting

**Scope:**
- Fix 2: Number input blur behavior (6 form files)
- Fix 4: Currency display standardization (15-20 files)
- Fix 5: Consistent decimal formatting (same as Fix 2/4)

**Approach:**
- Grep codebase for toFixed, Intl.NumberFormat, MMK, EUSD patterns
- Replace ad-hoc formatting with centralized utilities
- Standardize useState initialization to empty string for all inputs
- Format on blur, not during typing

### Phase 3: Edit Capability
**Rationale:** Pure UI addition, edit forms already exist for all entities.
**Delivers:** Edit button on QMRL, QMHQ, PO, Invoice detail pages.
**Addresses:** Fix 7 partial (edit from detail pages)
**Avoids:** No database changes, no new forms needed.

**Scope:**
- Add Edit button to each detail page header
- Route to existing edit form with entity ID
- Maintain audit trail on save (already works via existing triggers)

### Phase 4: Audit Notes Feature
**Rationale:** Most complex fix, requires UI + database coordination. Separate phase for focused testing.
**Delivers:** Status change notes appear in History tab.
**Addresses:** Fix 3 (status change notes not appearing)
**Avoids:** Pitfall 3 (trigger conditional order) and Pitfall 4 (notes not passed to trigger)

**Implementation approach:**
1. Create migration 043 with trigger deduplication check
2. Modify StatusChangeDialog to pass note to onConfirm callback
3. Modify clickable-status-badge to insert audit log manually with note
4. Test with and without notes, verify no duplicate logs

### Phase Ordering Rationale

- **Phase 1 first:** Prevents wasted effort on already-complete features
- **Phase 2 second:** Low risk, can run in parallel, high visible impact
- **Phase 3 third:** Simple UI additions, existing forms handle save logic
- **Phase 4 last:** Highest complexity, requires careful testing, isolated from other fixes

This ordering ensures quick wins (Phases 1-3) deliver visible progress while the complex fix (Phase 4) gets dedicated attention without blocking other work.

### Research Flags

**Phases with standard patterns (skip additional research):**
- **Phase 1 (Verification):** Just testing, no implementation
- **Phase 2 (Currency/Number):** Well-documented React patterns, utilities already exist
- **Phase 3 (Edit Capability):** UI pattern only, forms already implemented

**Phases that may need attention during implementation:**
- **Phase 4 (Audit Notes):** Trigger deduplication logic needs careful testing. Race condition possible if manual INSERT and trigger fire simultaneously. Consider wrapping in transaction.

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | No changes needed, existing stack is correct |
| Features | HIGH | Clear bug definitions with observable symptoms |
| Architecture | HIGH | Research found 2 fixes already complete, clear integration points for remainder |
| Pitfalls | HIGH | Official PostgreSQL/Supabase docs + verified against existing codebase migrations |

**Overall confidence:** MEDIUM-HIGH

The MEDIUM modifier reflects one uncertainty: the audit notes feature requires careful coordination between UI and trigger. The pattern is proven, but the specific implementation needs testing for edge cases (rapid status changes, concurrent users).

### Gaps to Address

- **Audit log deduplication timing:** Research suggests 5-second window for trigger to check if manual log exists. May need tuning based on actual database latency.

- **Firefox onBlur timing:** Number input fix should be tested specifically in Firefox where onBlur/onChange ordering differs from Chrome.

- **Edit button permissions:** Research didn't clarify which entities are editable in which states. Assume: QMRL/QMHQ editable unless in "done" status; PO editable unless closed; Invoice not editable (void instead). Validate with product owner.

## Sources

### Primary (HIGH confidence)
- [Row Level Security | Supabase Docs](https://supabase.com/docs/guides/database/postgres/row-level-security) — RLS UPDATE patterns
- [PostgreSQL CREATE POLICY Documentation](https://www.postgresql.org/docs/current/sql-createpolicy.html) — USING/WITH CHECK semantics
- [Understanding React Controlled Inputs](https://dmitripavlutin.com/controlled-inputs-using-react-hooks/) — Number input patterns

### Secondary (MEDIUM confidence)
- [Postgres Audit Logging Guide](https://www.bytebase.com/blog/postgres-audit-logging/) — Audit trigger patterns
- [The UX of Currency Display](https://medium.com/workday-design/the-ux-of-currency-display-whats-in-a-sign-6447cbc4fb88) — Currency formatting standards
- [onBlur vs onChange for React Inputs](https://linguinecode.com/post/onblur-vs-onchange-react-text-inputs) — Input timing behavior

### Tertiary (Referenced in research)
- GitHub issues on Supabase RLS and react-hook-form onBlur behavior
- UX design articles on destructive action modals and inventory fulfillment workflows

---
*Research completed: 2026-02-02*
*Ready for roadmap: yes*
