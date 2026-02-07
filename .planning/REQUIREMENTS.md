# Requirements: QM System v1.5

**Defined:** 2026-02-07
**Core Value:** Users can reliably create purchase orders, receive inventory, and track request status with full documentation and audit trails.

## v1.5 Requirements

Requirements for v1.5 UX Polish & Collaboration milestone. Each maps to roadmap phases.

### Comments

- [x] **COMM-01**: User can add comments on QMRL detail page
- [x] **COMM-02**: User can add comments on QMHQ detail page
- [x] **COMM-03**: User can add comments on PO detail page
- [x] **COMM-04**: User can add comments on Invoice detail page
- [x] **COMM-05**: User can reply to a comment (one level only)
- [x] **COMM-06**: User can delete own comments (soft delete)
- [x] **COMM-07**: Comment displays author name and timestamp
- [x] **COMM-08**: Comments ordered chronologically (oldest first)
- [x] **COMM-09**: Comments follow existing entity RLS visibility rules

### Responsive Typography

- [x] **TYPO-01**: Large amounts on cards use fluid font scaling (CSS clamp)
- [x] **TYPO-02**: Very large numbers (1M+) abbreviate with K/M/B and show full value on hover
- [x] **TYPO-03**: Amount display responsive on mobile breakpoints

### Two-Step Selector

- [x] **SLCT-01**: PO line item creation shows category selector first
- [x] **SLCT-02**: Item selector filters by selected category
- [x] **SLCT-03**: Category selector is searchable
- [x] **SLCT-04**: Item selector is searchable
- [x] **SLCT-05**: Changing category resets item selection
- [x] **SLCT-06**: Item selector shows loading state while fetching
- [x] **SLCT-07**: Item selector shows empty state when no items in category

### Currency Unification

- [ ] **CURR-01**: Money-out currency inherits from first money-in transaction
- [ ] **CURR-02**: Money-out exchange rate inherits from first money-in transaction
- [ ] **CURR-03**: QMHQ detail page shows Org + EUSD amounts
- [ ] **CURR-04**: QMHQ list cards show Org + EUSD amounts
- [ ] **CURR-05**: Money-out form shows remaining balance (money_in - sum of money_out)
- [ ] **CURR-06**: Validation prevents money-out exceeding available balance

## Future Requirements

Deferred to later milestones. Tracked but not in current roadmap.

### Comments Enhancements

- **COMM-10**: Real-time comment updates via Supabase subscriptions
- **COMM-11**: Comment count badge on detail page tabs
- **COMM-12**: @mention users in comments with notifications

### Typography Enhancements

- **TYPO-04**: Number abbreviation (K/M/B) with toggle option

### Selector Enhancements

- **SLCT-08**: Recently used categories shown at top of list

### Currency Enhancements

- **CURR-07**: Inherited currency indicator badge on form fields

## Out of Scope

Explicitly excluded. Documented to prevent scope creep.

| Feature | Reason |
|---------|--------|
| Multi-level comment threading | Visual complexity, harder to follow discussions |
| Edit comments | Breaks audit integrity, could hide context of replies |
| @mention notifications | Requires notification system infrastructure (defer to v1.6+) |
| Comment reactions/upvotes | Not relevant for internal management tool |
| Auto-abbreviation without toggle | Loses trust in financial context |
| Manual currency override on money-out | Defeats unification purpose, complicates balance calculation |
| Inline item creation from two-step selector | Breaks selector focus, inline creation exists elsewhere |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| COMM-01 | Phase 23 | Complete |
| COMM-02 | Phase 23 | Complete |
| COMM-03 | Phase 23 | Complete |
| COMM-04 | Phase 23 | Complete |
| COMM-05 | Phase 23 | Complete |
| COMM-06 | Phase 23 | Complete |
| COMM-07 | Phase 23 | Complete |
| COMM-08 | Phase 23 | Complete |
| COMM-09 | Phase 23 | Complete |
| TYPO-01 | Phase 24 | Complete |
| TYPO-02 | Phase 24 | Complete |
| TYPO-03 | Phase 24 | Complete |
| SLCT-01 | Phase 25 | Complete |
| SLCT-02 | Phase 25 | Complete |
| SLCT-03 | Phase 25 | Complete |
| SLCT-04 | Phase 25 | Complete |
| SLCT-05 | Phase 25 | Complete |
| SLCT-06 | Phase 25 | Complete |
| SLCT-07 | Phase 25 | Complete |
| CURR-01 | Phase 26 | Pending |
| CURR-02 | Phase 26 | Pending |
| CURR-03 | Phase 26 | Pending |
| CURR-04 | Phase 26 | Pending |
| CURR-05 | Phase 26 | Pending |
| CURR-06 | Phase 26 | Pending |

**Coverage:**
- v1.5 requirements: 25 total
- Mapped to phases: 25 (100% coverage)
- Unmapped: 0

---
*Requirements defined: 2026-02-07*
*Last updated: 2026-02-08 - Phase 25 (Two-Step Selectors) requirements complete*
