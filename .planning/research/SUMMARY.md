# Research Summary: v1.5 UX Polish & Collaboration

**Project:** QM System v1.5 Enhancement
**Domain:** Internal Ticket/Inventory Management Platform
**Researched:** 2026-02-07
**Confidence:** HIGH

## Executive Summary

v1.5 adds four polish features to an existing system with mature RLS policies, audit logging, and polymorphic patterns. Research reveals **minimal stack additions needed** (only cmdk for searchable selectors) and **high integration risk** from the established architecture's complexity (50+ migrations, polymorphic associations, RLS performance sensitivity).

The four features are well-researched domains: comments (leverage existing polymorphic pattern from file_attachments), responsive typography (CSS-only solution), two-step selectors (enhance existing searchable select pattern), and currency unification (UI logic changes, minimal schema impact). The critical finding is that **naive implementation will cause RLS performance degradation** as the comments table grows, requiring LEAKPROOF functions and proper indexing from day one.

**Recommended approach:** Phase database work first (RLS + audit strategy), then UI components (leveraging existing patterns), ending with currency cascade (least risk). The system already handles polymorphic relationships, so comments integration is architecturally sound but requires careful RLS design to avoid 5000ms+ query times. All features can ship in a single milestone if RLS performance is validated with 10K+ comment test data.

## Key Findings

### Recommended Stack

v1.5 requires **only one new dependency**: cmdk (v1.1.1) for searchable combobox pattern. All other features work with existing Tailwind CSS, Radix UI, and Supabase stack.

**Stack additions:**
- **cmdk (^1.1.1)**: Searchable combobox for two-step selector — Radix UI Select lacks native search; cmdk is headless, actively maintained, battle-tested
- **Optional: @tailwindcss/container-queries**: Only if responsive typography needs complex card-level breakpoints — start without, use CSS clamp() first

**No additional libraries needed for:**
- **Comments**: Build custom with Supabase + React (one-level replies, delete-only, simple CRUD doesn't need library)
- **Responsive typography**: Tailwind CSS with clamp() function (pure CSS solution)
- **Currency unification**: Refactor existing CurrencyDisplay component (pure logic change)

**Why minimal additions work:** System already has polymorphic pattern (file_attachments), searchable selects (status/category), and currency display components. New features extend existing patterns rather than introduce new paradigms.

### Expected Features

Research identifies table stakes, differentiators, and anti-features for each enhancement.

#### Comments (Must Have)
- One-level threading (parent-child only)
- Visual hierarchy (indentation/borders for replies)
- Author + timestamp display
- Delete own comments (soft delete with 7-day recovery)
- Polymorphic entity reference (QMRL, QMHQ, PO, Invoice)
- Role-based visibility (follow existing RLS)
- Real-time updates via Supabase subscriptions
- Chronological ordering (newest/oldest toggle)

**Anti-features (deliberately exclude):**
- Multi-level threading (>1 level) — creates visual complexity
- Edit comments — breaks audit integrity
- Upvoting/reactions — not relevant for internal tool
- @mention notifications — requires notification system (defer to v1.6)

#### Responsive Typography (Must Have)
- CSS clamp() for fluid scaling (min/max bounds)
- Relative units (rem/em) for WCAG AA compliance
- Truncation with ellipsis for long numbers
- Non-breaking spaces for number groups
- Mobile-first breakpoints
- Full number on hover/focus (tooltip)

**Anti-features:**
- Auto-abbreviation without user control — loses trust in finance context
- Fixed pixel font sizes — breaks accessibility
- Truncation without hover reveal — frustrating UX

#### Two-Step Selector (Must Have)
- Parent selection filters child dropdown
- Search within both steps
- Clear visual dependency indication
- Reset child when parent changes
- Loading state for child options
- Empty state handling ("No items in category")

**Anti-features:**
- Auto-select category based on item search — breaks mental model
- Multi-select category — items belong to single category
- Inline item creation from selector — breaks focus

#### Currency Unification (Must Have)
- Auto-populate currency from money-in to money-out
- Auto-populate exchange rate from money-in
- Display org currency + EUSD together
- Prevent currency mismatch (validation)
- Show inherited values clearly (disabled field with helper text)
- Calculate remaining balance (money_in - SUM(money_out))

**Anti-features:**
- Manual currency override — defeats unification purpose
- Currency conversion on-the-fly — adds unnecessary complexity
- Multiple currencies per QMHQ — creates balance calculation confusion

### Architecture Approach

All features integrate cleanly with existing QM System architecture. No architectural changes required—only additions following established patterns.

**Integration points:**
1. **Comments** → Reuse polymorphic pattern from file_attachments, mirror RLS policies, leverage existing audit triggers
2. **Responsive Typography** → Extend Tailwind config with responsive font scale, update CurrencyDisplay component size variants
3. **Two-Step Selectors** → Enhance existing InlineCreateSelect pattern with parent-child filtering, use existing form validation
4. **Currency Unification** → Pre-populate forms with parent entity currency/rate, use existing CurrencyDisplay component

**Major components:**
1. **Comments System** — 5 new components (CommentSection, CommentList, CommentItem, CommentForm, CommentActions) following server/client hybrid pattern
2. **Responsive Font Scale** — Tailwind config extension with clamp() utilities, no new components
3. **TwoStepSelect Component** — Generic parent-child selector + specific implementations (CategoryItemSelect, DepartmentUserSelect)
4. **Currency Form Logic** — Enhance existing money-out and PO create forms with inheritance + override capability

**Data flow patterns:**
- Comments: Server component fetches with Supabase → RLS filters visibility → Client component handles create/delete
- Typography: CSS-only scaling, no runtime logic
- Two-step selector: Parent selection triggers child data fetch via useEffect → Reset child on parent change
- Currency cascade: Money-in sets QMHQ currency → Money-out/PO forms inherit on load → Allow override with warning

### Critical Pitfalls

Research identified 20+ pitfalls across 5 categories. Top 7 critical risks:

1. **RLS Performance Degradation (Comments)** — Polymorphic RLS policies cause sequential scans instead of index usage, degrading from <50ms to >5000ms queries as comments grow. **Prevention:** Use LEAKPROOF helper functions, create partial indexes per entity_type (idx_comments_qmrl, idx_comments_qmhq), inline RLS logic to avoid function calls.

2. **Audit Log Explosion (Comments)** — Generic audit trigger logs every comment create/delete, causing audit_logs table to grow 10x faster than business data. **Prevention:** Selective audit logging (only log creates/deletes, not edits), or separate comments_audit_logs table with 90-day retention.

3. **Floating Point Precision Loss (Currency)** — JavaScript floating point arithmetic loses precision in currency calculations (9.95 / 1350 rounds inconsistently). **Prevention:** Use Decimal.js library for all JS calculations, or do ALL calculations in PostgreSQL NUMERIC type, never in JavaScript.

4. **N+1 Query Problem (Comments)** — Loading QMRL with 50 comments makes 150+ database queries (1 for list + 1 per comment for reply count + 1 per comment for user). **Prevention:** Use nested select to fetch in single query, or create recursive CTE view for deep nesting.

5. **Form State Race Condition (Two-Step Selector)** — User changes parent dropdown, child dropdown populates, user selects child item, then changes parent again but child selection not cleared—form submits invalid data. **Prevention:** Reset child field when parent changes using useRef to track previous value, add validation to check child belongs to current parent.

6. **Responsive Typography Overflow (Financial Numbers)** — Invoice amount "12,475,937.47 MMK" truncates to "12,475,93..." on mobile without visual indicator, user approves wrong amount. **Prevention:** Use clamp() with tooltip showing full value, always display EUSD alongside org currency, test on real devices.

7. **Currency Cascade Breaking Invoice Independence (Migration)** — PRD states "Invoice currency independent from PO" but v1.5 cascade introduces inheritance—migration naively backfills currency column, overwriting intentional independence. **Prevention:** Preserve existing independence in migration (only backfill for pre-v1.4 invoices), test rollback on staging before production.

## Implications for Roadmap

Based on combined research, recommended phase structure addresses dependencies, minimizes risk, and leverages existing patterns.

### Phase 1: Comments System Foundation
**Rationale:** No dependencies on other v1.5 features, adds value immediately, establishes pattern for audit logging strategy that other phases need.

**Delivers:**
- comments table with polymorphic entity reference
- RLS policies with LEAKPROOF functions (prevents Pitfall 1.1)
- Selective audit trigger (prevents Pitfall 1.2)
- Partial indexes per entity_type
- 5 comment components (CommentSection, CommentList, CommentItem, CommentForm, CommentActions)
- Integration with QMRL, QMHQ, PO, Invoice detail pages

**Addresses features:**
- One-level threading
- Role-based visibility
- Soft delete (7-day recovery)
- Author/timestamp display
- Comments tab on all detail pages

**Avoids pitfalls:**
- 1.1: RLS performance degradation (design LEAKPROOF functions from start)
- 1.2: Audit log explosion (selective logging only creates/deletes)
- 1.4: N+1 queries (use nested select with user relations)
- 1.5: React key mistakes (use stable DB IDs, not array indexes)

**Research flag:** LOW — Pattern already established by file_attachments, RLS helpers exist, just need performance optimization

---

### Phase 2: Responsive Typography
**Rationale:** Low risk CSS-only changes, improves mobile UX across entire system, no dependencies on Phase 1.

**Delivers:**
- Tailwind config extended with responsive font scale (heading-lg, heading-md, body-md using clamp())
- CurrencyDisplay component with responsive size variants
- All page headers, card titles, table headers updated with responsive classes
- Mobile testing on real devices (iPhone SE, iPad, desktop)

**Addresses features:**
- CSS clamp() for fluid scaling
- Mobile-first breakpoints
- WCAG AA compliance (rem/em units)
- Truncation with hover reveal for long financial numbers

**Avoids pitfalls:**
- 2.1: Number overflow without detection (tooltip with full value)
- 2.2: EUSD display hidden on mobile (vertical stack on mobile, horizontal on desktop)
- 2.3: Accessibility failure for screen readers (proper ARIA labels)
- 5.4: Breaking existing table layouts (test on real devices, use container queries)

**Research flag:** LOW — Standard Tailwind approach, clamp() well-supported, design system already has typography utilities

---

### Phase 3: Two-Step Selectors
**Rationale:** Depends on category data being stable, more complex state management than typography, benefits from responsive typography for dropdown content.

**Delivers:**
- TwoStepSelect generic component with searchable popover
- CategoryItemSelect for PO line items and QMHQ item route
- DepartmentUserSelect for assignment fields
- Visual design (step numbers, arrow, disabled states, loading indicators)
- Integration with React Hook Form validation

**Addresses features:**
- Parent selection filters child dropdown
- Search within both steps
- Reset child when parent changes
- Loading state and empty state handling
- Edit mode initialization

**Avoids pitfalls:**
- 3.1: Form state race condition (reset child field with useRef tracking)
- 3.2: Disabled state not obvious (helper text + obvious visual disabled)
- 3.3: Loading state confusion (clear stale data immediately, show spinner)
- 3.4: Edit mode initialization timing (separate initial fetch + watch for changes)
- 5.3: Reusing wrong data fetching hooks (create specific hooks with correct business logic)

**Research flag:** MEDIUM — New pattern for system, needs UX validation for disabled states and loading feedback

---

### Phase 4: Currency Unification
**Rationale:** Depends on financial transaction flow understanding, least architectural risk but requires careful UX for inheritance behavior.

**Delivers:**
- Money-out form pre-populated with currency/rate from first money-in
- PO create form inheriting currency from parent QMHQ
- Inherited currency indicator badge
- Override checkbox with warning ("may complicate reconciliation")
- Balance calculation (money_in - SUM(money_out)) with validation

**Addresses features:**
- Auto-populate currency and exchange rate
- Display org currency + EUSD together
- Prevent currency mismatch
- Calculate remaining balance
- Show inherited values clearly

**Avoids pitfalls:**
- 4.1: Floating point precision loss (use Decimal.js or PostgreSQL calculations)
- 4.2: Breaking invoice independence (migration preserves pre-v1.4 independence)
- 4.3: Exchange rate override without user intent (track user modifications, show warning on conflicts)
- 4.4: EUSD recalculation cascade without audit (use generated columns, single audit entry for rate changes)
- 5.2: Migration rollback plan (incremental migrations with explicit rollback scripts)

**Research flag:** MEDIUM — Edge cases exist (no money-in yet, multiple currencies), needs thorough testing and careful migration design

---

### Phase Ordering Rationale

**Why this order:**
1. **Comments first** — No dependencies, validates RLS performance strategy that informs other phases, establishes audit logging approach
2. **Typography second** — CSS-only changes, immediate UX improvement, low risk, can run parallel to Phase 1 development
3. **Two-step selectors third** — Benefits from responsive typography (dropdown content scales), more complex state management needs Phase 1/2 stability
4. **Currency last** — Most edge cases, requires understanding full financial flow, least architectural risk but highest UX complexity

**Dependency chain:**
- Phase 1 → None (can start immediately)
- Phase 2 → None (can start immediately, parallel to Phase 1)
- Phase 3 → Phase 2 (benefits from responsive dropdown content)
- Phase 4 → None (independent but benefits from team familiarity with form patterns from Phase 3)

**Grouping logic:**
- **Database-heavy work (Phase 1):** RLS + audit + schema changes with testing
- **CSS-heavy work (Phase 2):** Design system extension, low risk
- **Component-heavy work (Phase 3):** New interaction patterns, state management
- **Form logic work (Phase 4):** Business rule implementation, edge case handling

**Risk mitigation:**
- Phase 1 tackles highest technical risk first (RLS performance)
- Phase 2 provides quick wins (mobile UX improvement)
- Phase 3 addresses UX complexity with established patterns from Phase 1/2
- Phase 4 deferred to last (edge cases need time for discovery)

### Research Flags

**Phases needing deeper research during planning:**
- **Phase 3 (Two-Step Selectors):** UX validation for disabled states and loading feedback — sparse documentation on best practices for dependent dropdowns in forms, may need usability testing
- **Phase 4 (Currency Cascade):** Edge case mapping for multi-currency scenarios — need to clarify business rules when QMHQ has multiple money-in transactions in different currencies

**Phases with standard patterns (skip research-phase):**
- **Phase 1 (Comments):** Polymorphic pattern already proven by file_attachments, RLS helpers exist
- **Phase 2 (Responsive Typography):** Standard Tailwind CSS approach, clamp() well-documented

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | cmdk actively maintained (v1.1.1, Feb 2025), Tailwind CSS approach validated with official docs, no experimental dependencies |
| Features | HIGH | All four feature domains well-researched with multiple authoritative sources, table stakes clearly defined from UX best practices |
| Architecture | HIGH | All features integrate with existing patterns (polymorphic references, RLS, audit, form validation), no architectural changes needed |
| Pitfalls | HIGH | 20+ pitfalls identified from production postmortems and technical deep-dives, mitigation strategies validated against official PostgreSQL docs |

**Overall confidence:** HIGH

### Gaps to Address

**Minor gaps requiring validation during implementation:**

1. **Comment pagination strategy:** Research recommends "Load More" button vs infinite scroll for >50 comments, but user behavior unknown. **Handle during Phase 1 by implementing simple pagination first, gather usage data, optimize later.**

2. **Two-step selector reset behavior:** When user changes step 1 (category), should step 2 (item) clear immediately or preserve if still valid in new category? **Handle during Phase 3 UX design—recommendation is always clear (simpler, more predictable), but needs user testing.**

3. **Currency override frequency:** Unknown how often users need different currency per transaction within same QMHQ. **Handle during Phase 4 by allowing override with warning, gather usage data, may simplify to force same currency in v1.6 based on findings.**

4. **Responsive typography breakpoints:** Are Tailwind defaults (768px, 1024px) sufficient or does QM need custom breakpoints based on actual user device distribution? **Handle during Phase 2 by checking analytics for device breakdown—if >30% users between 600-768px, consider custom breakpoint.**

5. **RLS function LEAKPROOF safety:** Existing `owns_qmrl()` and `owns_qmhq()` helper functions not currently marked LEAKPROOF. **Handle during Phase 1 by security reviewing functions for information leakage before marking LEAKPROOF—critical for RLS performance optimization.**

**No critical gaps:** All features have clear implementation paths, research provides sufficient detail for roadmap planning.

## Sources

### Primary Sources (HIGH confidence)

**Stack Research:**
- [cmdk GitHub Repository](https://github.com/dip/cmdk) — Active maintenance, v1.1.1 published Feb 2025
- [Tailwind CSS Official Docs: Font Size](https://tailwindcss.com/docs/font-size) — CSS clamp() approach
- [Radix UI Primitives Issues #1334, #1342](https://github.com/radix-ui/primitives) — Select search limitations, Combobox feature request

**Features Research:**
- [Uxcel Common Patterns: Comments Best Practices](https://app.uxcel.com/courses/common-patterns/comments-best-practices-499) — One-level threading rationale
- [Modern Fluid Typography Using CSS Clamp | Smashing Magazine](https://www.smashingmagazine.com/2022/01/modern-fluid-typography-css-clamp/) — Responsive typography techniques
- [How To Create a Cascading Dropdown | W3Schools](https://www.w3schools.com/howto/howto_js_cascading_dropdown.asp) — Two-step selector pattern
- [WCAG 2.1 Font Size Requirements Guide](https://font-converters.com/accessibility/font-size-requirements) — Accessibility compliance

**Architecture Research:**
- [PostgreSQL Nested Comments Performance](https://www.slingacademy.com/article/postgresql-efficiently-store-comments-nested-comments/) — Recursive CTE for threading
- [Polymorphic Associations Database Design](https://patrickkarsh.medium.com/polymorphic-associations-database-design-basics-17faf2eb313) — entity_type + entity_id pattern
- [React Hook Form Official Docs: Advanced Usage](https://www.react-hook-form.com/advanced-usage/) — Form state management

**Pitfalls Research:**
- [PostgreSQL RLS Implementation Guide | Permit.io](https://www.permit.io/blog/postgres-rls-implementation-guide) — LEAKPROOF functions, performance optimization
- [Common Postgres RLS Footguns | Bytebase](https://www.bytebase.com/blog/postgres-row-level-security-footguns/) — Sequential scan issues
- [Floats Don't Work for Storing Cents | Modern Treasury](https://www.moderntreasury.com/journal/floats-dont-work-for-storing-cents) — Currency precision
- [Scaling Threaded Comments at Disqus](https://cra.mr/2010/05/30/scaling-threaded-comments-on-django-at-disqus/) — N+1 query prevention

### Secondary Sources (MEDIUM confidence)

- [Web Discussions: Flat by Design | Coding Horror](https://blog.codinghorror.com/web-discussions-flat-by-design/) — Multi-level threading complexity
- [Design for Truncation | Medium](https://medium.com/design-bootcamp/design-for-truncation-946951d5b6b8) — Responsive number display
- [Build Dynamic Dependent Dropdown | Dev.to](https://dev.to/jps27cse/build-dynamic-dependent-dropdown-using-react-js-3d9c) — React cascading dropdown patterns
- [React Key Prop Best Practices | Developer Way](https://www.developerway.com/posts/react-key-attribute) — React reconciliation issues

### Tertiary Sources (Context only)

- [15 Best Comment Designs Trends 2026 | Result First](https://www.resultfirst.com/blog/web-design/15-best-comment-designs-trends-for-web-designers/) — UI inspiration
- [Different Abbreviations for Thousand, Million, Billion | YourDictionary](https://www.yourdictionary.com/articles/abbreviations-million-thousand-billion) — Financial number formatting conventions

---

**Research completed:** 2026-02-07
**Ready for roadmap:** Yes
**Next step:** Orchestrator proceeds to requirements definition using this summary as foundation
