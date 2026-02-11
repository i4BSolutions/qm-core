# Features Research: UI Standardization, Flow Tracking & RBAC Simplification

**Domain:** Internal ticket, expense, and inventory management platform
**Researched:** 2026-02-11
**Context:** Adding UI component consistency audit, admin-only QMRL flow tracking page, and RBAC role consolidation (7 roles → 3 roles) to existing QM System

---

## UI Standardization & Component Consistency Audit

### Table Stakes

Features users expect from internal management tool UI consistency. Missing these makes the interface feel unprofessional or confusing.

| Feature | Why Expected | Complexity | Dependencies on Existing |
|---------|--------------|------------|--------------------------|
| **Consistent button styles** | Users learn once, apply everywhere; cognitive load reduction | Low | Existing shadcn/ui Button component; verify variants used consistently |
| **Uniform spacing system** | Visual rhythm and professional appearance | Low | Tailwind spacing tokens; audit for hardcoded px values |
| **Color palette consistency** | Brand identity and visual hierarchy | Low | Existing status/category colors; ensure semantic colors (danger/success/warning) match across forms |
| **Typography scale adherence** | Readable hierarchy (h1, h2, body, caption) | Low | Tailwind text utilities; check for inline styles overriding |
| **Form input consistency** | All inputs look/behave the same (height, border, focus state) | Low | Existing Input/Select/Textarea components; ensure not bypassed with native HTML |
| **Icon usage standards** | Same icon library throughout (Lucide/Heroicons), consistent sizing | Low | Check for mixed icon sources |
| **Loading state patterns** | Spinners, skeletons, disabled states match | Medium | Existing Skeleton component; verify used everywhere data loads |
| **Error message display** | Validation errors, API errors shown consistently (toast, inline, modal) | Medium | Existing toast system; check form validation consistency |
| **Empty state patterns** | "No data" displays consistent (icon + message + action) | Low | Audit list/table empty states |
| **Responsive behavior** | Breakpoints and mobile layouts consistent | Medium | Tailwind breakpoints; check custom media queries |

**Source:** [Design System Checklist | Figma](https://www.figma.com/community/file/875222888436956377/design-system-checklist), [Design System Audit: Enhancing Design Foundations | DOOR3](https://www.door3.com/blog/design-system-audit)

### Differentiators

Features that elevate UI consistency beyond basic expectations.

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| **Automated consistency linting** | Catch violations at build time (e.g., detect hardcoded colors) | Medium | Tools like Figma Design System Linting widget can flag unbound properties |
| **Component usage analytics** | Track which components used where, identify orphans | High | Requires code parsing; shows "Button used 247 times, CustomButton used 3 times" |
| **Visual regression testing** | Screenshots prevent accidental UI breaks | High | Percy, Chromatic integration; overkill for internal tool unless frequent breaks |
| **Accessibility audit checklist** | WCAG 2.1 AA compliance (contrast, ARIA, keyboard nav) | Medium | Component library accessibility audit for color contrast, focus indicators |
| **Interactive style guide** | Storybook/similar showing all components with props | Medium | Valuable for onboarding, but maintenance overhead |
| **Design tokens documentation** | Single source of truth for colors, spacing, typography | Low | Document Tailwind config as design system reference |
| **Migration guide for deprecated patterns** | When fixing inconsistencies, guide devs to new patterns | Low | "Replace <CustomInput> with <Input> from @/components/ui" |
| **Before/after screenshots** | Visual proof of consistency improvements | Low | Screenshots of inconsistent vs fixed UI for stakeholder buy-in |

**Source:** [Design System Component Audit and Linting | Figma](https://www.figma.com/community/widget/1532072013420297079/design-system-component-audit-and-linting), [UX Design System Audit Guide - Aufait UX](https://www.aufaitux.com/blog/ui-ux-design-system-audit/)

### Anti-Features

Features to deliberately NOT build.

| Anti-Feature | Why Avoid | What to Do Instead |
|--------------|-----------|-------------------|
| **100% automated fixing** | Context matters; some "inconsistencies" intentional | Manual review + guidelines, not blind find/replace |
| **Overly strict enforcement** | Blocks legitimate exceptions (e.g., emergency red button should look different) | Define when to break rules in style guide |
| **New design system from scratch** | Already using shadcn/ui + Tailwind; rewriting wastes time | Audit existing, document gaps, incrementally fix |
| **Pixel-perfect obsession** | Internal tool; 1px differences don't matter | Focus on functional consistency (spacing tiers, not exact px) |
| **Complex component versioning** | Overkill for small team; confusing | Use Git for versioning, document breaking changes |

### Implementation Approach

**Phase 1: Audit (Manual)**
1. **Screenshot grid**: Take screenshots of all buttons, forms, cards, tables across pages
2. **Group visually**: Cluster screenshots to identify variants (e.g., "5 different button heights found")
3. **Document findings**: List inconsistencies (priority: high/medium/low)
4. **Create checklist**: "Pages to fix" with specific violations per page

**Phase 2: Fix (Incremental)**
1. **Component consolidation**: Ensure all pages use shadcn/ui components, not custom HTML
2. **Spacing audit**: Replace hardcoded `px` with Tailwind scale (`p-4`, `gap-6`)
3. **Color audit**: Replace inline colors with Tailwind semantic classes (`text-destructive`, `bg-primary`)
4. **Typography audit**: Ensure headings use consistent classes (`text-2xl font-semibold`)

**Phase 3: Document**
1. **Style guide page**: Document standard components, spacing, colors (can be simple Markdown in `/docs` or Storybook if ambitious)
2. **PR checklist**: Add "UI consistency" item to PR template

**Tool reference:** [Design system component audit and linting | Figma](https://www.figma.com/community/widget/1532072013420297079/design-system-component-audit-and-linting) shows visual clustering approach.

**Complexity:** Low to Medium. Manual audit is low complexity, fixing depends on number of violations found. Existing shadcn/ui + Tailwind foundation makes this easier than building from scratch.

---

## End-to-End Request Flow Tracking Page

### Table Stakes

Features users expect from request/workflow tracking dashboards in internal tools.

| Feature | Why Expected | Complexity | Dependencies on Existing |
|---------|--------------|------------|--------------------------|
| **Parent-child hierarchy visualization** | Users need to see QMRL → QMHQ(s) relationships at a glance | Medium | Existing QMRL, QMHQ tables with parent_qmrl_id FK |
| **Search by QMRL ID** | Primary use case: "Where is QMRL-2025-00123?" | Low | Search input + query filter |
| **Status indicators at each level** | QMRL status, QMHQ status, PO status, execution status | Low | Existing status_config, smart PO status |
| **Route-specific downstream display** | Show different data for Item/Expense/PO routes | Medium | QMHQ route_type field determines what to display |
| **Timeline/chronological view** | See progression over time (requested → processed → fulfilled) | Medium | Date fields: request_date, created_at, completed_at |
| **Admin-only access** | Sensitive operational overview; not for all users | Low | Permission check in route, hide from non-admin nav |
| **Direct links to detail pages** | Click QMRL ID → open QMRL detail in new tab/slider | Low | Links to existing /qmrl/[id], /qmhq/[id] pages |
| **Summary counts** | "5 QMHQs, 3 POs, 2 completed" | Low | Aggregate counts from child records |
| **Empty state for no results** | "No QMRL found for ID X" | Low | Standard empty state pattern |
| **Responsive layout** | Works on mobile/tablet (admin might check on phone) | Medium | Collapsible tree or stacked cards on small screens |

**Source:** [Freshservice: Create reports to track Parent-Child ticket associations](https://support.freshservice.com/support/solutions/articles/50000010738-create-reports-to-track-parent-child-ticket-associations), [How to Visualize Dependencies in Jira - Ricksoft](https://www.ricksoft-inc.com/post/how-to-visualize-dependencies-in-jira/)

### Differentiators

Features that enhance flow tracking beyond basic expectations.

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| **Tree/graph visualization** | Visual lines connecting parent → children | High | D3.js, React Flow, or Mermaid diagram; impressive but high maintenance |
| **Expandable/collapsible nodes** | Start with QMRL collapsed, expand to see QMHQs, expand QMHQ to see POs | Medium | Accordion or tree component (shadcn Collapsible) |
| **Progress percentage** | "QMRL 60% complete" based on child completion | Medium | Calculate from QMHQ statuses (done/total) |
| **Bottleneck highlighting** | Flag stuck QMHQs (e.g., pending >7 days) | Medium | Compare created_at to now, highlight if exceeds threshold |
| **Financial summary** | Total budget, total spent, balance across all QMHQs | Medium | Sum expense/PO amounts, show EUSD totals |
| **Inventory summary** | Items requested vs fulfilled across Item routes | Medium | Aggregate quantities from stock-out executions |
| **Filtering by route type** | "Show only PO route QMHQs" | Low | Dropdown filter |
| **Filtering by status** | "Show only pending QMHQs" | Low | Multi-select status filter |
| **Export to PDF/Excel** | Admin prints flow for meetings/reports | Medium | Requires export library; nice-to-have |
| **Real-time updates** | Auto-refresh when data changes (WebSocket/polling) | High | Overkill for internal tool; page refresh sufficient |
| **Historical snapshot** | "How did this QMRL look on 2025-01-15?" | High | Requires audit log reconstruction; defer to future |
| **Bulk status updates** | Select multiple QMHQs, change status | Medium | Useful but risky; permission-gated |

**Source:** [Tree View for CRM Relationships Visualization](https://www.inogic.com/blog/2026/01/tree-view-for-crm-relationships-visualization-the-new-upgrades-of-2026/), [Grafana: Traces in Explore](https://grafana.com/docs/grafana/latest/visualizations/explore/trace-integration/)

### Anti-Features

Features to deliberately avoid.

| Anti-Feature | Why Avoid | What to Do Instead |
|--------------|-----------|-------------------|
| **Edit from tracking page** | Tracking is read-only overview; editing belongs on detail pages | Link to detail page for editing |
| **Complex filtering UI** | Too many filters overwhelm; this is lookup, not reporting | Keep filters simple: QMRL ID search + status/route filters |
| **Public/external access** | Internal operational data; confidential | Admin-only, never expose outside auth |
| **Real-time collaboration** | No multi-user editing needed here | Standard page refresh |
| **Gantt chart / timeline** | Over-engineering for simple flow view; Gantt implies scheduling | Use simple chronological list or tree |
| **Drag-and-drop reordering** | QMRL flow is historical, not editable | Display only |

### Implementation Approach

**UI Layout Options:**

**Option A: Tree View (Recommended)**
```
QMRL-2025-00123 [Status: Under Processing] [Requester: John]
  └─ QMHQ-2025-00456 [Item Route] [Status: Processing]
      └─ Stock-Out Request [Pending Approval]
  └─ QMHQ-2025-00457 [PO Route] [Status: Awaiting Delivery]
      └─ PO-2025-00089 [Status: Partially Received]
          └─ INV-2025-00123 [Invoiced: 50/100 units]
          └─ Stock-In [Received: 30/100 units]
  └─ QMHQ-2025-00458 [Expense Route] [Status: Completed]
      └─ Financial Transaction [Money In: $1,000]
```

**Option B: Card-Based (Mobile-Friendly)**
```
┌─────────────────────────────────────────┐
│ QMRL-2025-00123                         │
│ Status: Under Processing                │
│ Requester: John | Date: 2025-01-15      │
│                                         │
│ ┌─────────────────────────────────────┐ │
│ │ QMHQ-2025-00456 [Item Route]       │ │
│ │ Stock-Out: Pending Approval         │ │
│ └─────────────────────────────────────┘ │
│ ┌─────────────────────────────────────┐ │
│ │ QMHQ-2025-00457 [PO Route]         │ │
│ │ PO-2025-00089: 30/100 units rcv'd   │ │
│ └─────────────────────────────────────┘ │
│ ┌─────────────────────────────────────┐ │
│ │ QMHQ-2025-00458 [Expense Route]    │ │
│ │ $1,000 (Completed)                  │ │
│ └─────────────────────────────────────┘ │
└─────────────────────────────────────────┘
```

**Option C: Table View (Simplest)**
Flat table with columns: QMRL ID, QMHQ ID, Route, QMHQ Status, Downstream (PO/Stock/Transaction), Status

**Recommendation:** Start with **Option B (Card-Based)** for v1 — simpler than tree, responsive, shows hierarchy clearly. Upgrade to tree view (Option A) if users request more visual clarity.

**Route-Specific Display Logic:**

| Route | Show Downstream |
|-------|-----------------|
| **Item** | Stock-Out Request status (Pending/Approved/Rejected/Executed) + Quantity + Warehouse |
| **Expense** | Financial Transactions (Money In/Out) + Amount (EUSD) + Date |
| **PO** | POs (ID, Status, Progress: X/Y invoiced, X/Y received) + Invoices (ID, Amount) + Stock-Ins (Quantity) |

**Complexity:** Medium. Data fetching is straightforward (JOIN queries), UI complexity depends on layout choice. Tree view = high, card view = medium, table = low.

**Source:** [Parent-child ticket relationships](https://support.freshservice.com/support/solutions/articles/50000010738-create-reports-to-track-parent-child-ticket-associations) shows common patterns for hierarchical request tracking.

---

## RBAC Role Consolidation (7 → 3 Roles)

### Table Stakes

Features users expect when simplifying role-based access control.

| Feature | Why Expected | Complexity | Dependencies on Existing |
|---------|--------------|------------|--------------------------|
| **Clear role definitions** | Users understand what each role can do | Low | Document permissions per role |
| **Migration path for existing users** | Existing users automatically mapped to new roles | Medium | Migration script: map old roles to new |
| **Backward compatibility during transition** | System works with both old and new roles during migration | Medium | Code checks both old and new role fields during rollout |
| **Permission preservation** | Users don't lose access they had before | High | Careful mapping: ensure no permission downgrade |
| **Role hierarchy** | Higher roles inherit lower role permissions | Low | Admin > QMHQ > QMRL (as described) |
| **Audit trail** | Track role changes in audit logs | Low | Existing audit_logs system |
| **Admin-only role assignment** | Only admin can change user roles | Low | Existing permission model |
| **Graceful degradation** | If permission denied, show helpful message (not cryptic error) | Low | UI permission checks with fallback text |

**Source:** [Role-Based Access Control Best Practices](https://www.techprescient.com/blogs/role-based-access-control-best-practices/), [RBAC Implementation in 5 Steps](https://www.osohq.com/learn/rbac-role-based-access-control-implementation)

### Differentiators

Features that enhance role consolidation beyond basics.

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| **Role simulation/preview** | Admin sees what user with role X can access (test before assigning) | Medium | Switch to user's permission context, show UI as they see it |
| **Granular permission overrides** | "User has QMRL role but also needs PO access" → custom permissions | High | Moves away from pure RBAC to RBAC + attribute-based; adds complexity |
| **Permission templates** | Pre-defined sets for common scenarios ("Field Staff" = QMRL + limited QMHQ) | Low | Dropdown with templates, sets role on select |
| **Role usage analytics** | "15 users have Admin, 3 actually use admin features" | Medium | Track feature usage by role, identify over-privileged users |
| **Automatic role suggestion** | System suggests role based on user's department/activity | High | ML-based or rule-based; likely overkill |
| **Temporary elevated access** | User requests admin access for 24h, auto-reverts | High | Adds workflow layer; defer to future unless critical |
| **Approval stacking inheritance** | Admin inherits QMHQ approval rights, QMHQ inherits QMRL rights | Low | Simplifies: Admin can approve stock-outs (currently admin-only anyway) |

**Source:** [Role Hierarchies in RBAC](https://medium.com/@heyambujsingh/master-role-based-access-control-rbac-patterns-like-a-pro-a258fdb02d67), [Three-tier RBAC pattern](https://docs.cloud.f5.com/docs-v2/platform/concepts/rbac)

### Anti-Features

Features to deliberately avoid.

| Anti-Feature | Why Avoid | What to Do Instead |
|--------------|-----------|-------------------|
| **User self-selection of role** | Security risk; privilege escalation | Admin assigns roles |
| **Dynamic role switching** | "Switch to QMRL view" confusing; should have one role | Assign role once, user sees their permissions |
| **Complex nested role hierarchies** | 7 → 3 is simplification; don't create sub-roles | Flat 3-tier: Admin, QMHQ, QMRL |
| **Per-entity permissions** | "User can edit QMRL-123 but not QMRL-124" | Use role-based + ownership (user can edit own QMRLs) |
| **Permission marketplace** | Users request permissions individually | Roles bundle permissions; request role change, not individual perms |
| **Role expiration** | Roles don't expire; users deactivated when leaving | User deactivation handles access removal |

### Proposed Role Mapping

**Current (7 Roles) → New (3 Roles)**

| Old Role | New Role | Rationale |
|----------|----------|-----------|
| **Admin** | **Admin** | No change; full CRUD + approvals |
| **Quartermaster** | **Admin** | Quartermaster approves, manages inventory → Admin responsibilities |
| **Finance** | **QMHQ** | Finance creates PO/invoices (QMHQ downstream), views QMRLs read-only |
| **Inventory** | **QMHQ** | Inventory manages stock (QMHQ downstream), views QMRLs read-only |
| **Proposal** | **QMHQ** | Proposal creates QMHQ, processes requests → QMHQ core responsibility |
| **Frontline** | **QMRL** | Frontline validates drafts → QMRL level access |
| **Requester** | **QMRL** | Requester creates QMRLs → QMRL role |

**Permission Matrix (New)**

| Resource | Admin | QMHQ | QMRL |
|----------|-------|------|------|
| **Users** | CRUD | - | - |
| **QMRL** | CRUD | R (all) | CR (own), R (all) |
| **QMHQ** | CRUD | CRUD | R (read-only) |
| **Financial Trans.** | CRUD | CRUD | - |
| **Inventory Trans.** | CRUD | CRUD | R (summary) |
| **PO** | CRUD | CRUD | - |
| **Invoice** | CRUD | CRUD | - |
| **Items/Suppliers** | CRUD | RU | R |
| **Stock-Out Approval** | Approve/Reject | - | - |

**Key Changes:**
- **Stock-out approval** remains **Admin-only** (was Quartermaster, now Admin absorbs Quartermaster)
- **QMHQ role** consolidates Finance, Inventory, Proposal → can create QMHQ, PO, invoices, stock transactions
- **QMRL role** consolidates Frontline, Requester → can create/view QMRLs, read-only on downstream

**Hierarchy:**
- **Admin > QMHQ > QMRL** (higher roles inherit lower role permissions + additional CRUD/approval rights)

**Source:** [Three-tier RBAC pattern](https://budibase.com/blog/app-building/role-based-access-control/) describes admin/power user/read-only hierarchy, which maps to Admin/QMHQ/QMRL in this context.

### Implementation Approach

**Phase 1: Schema Update**
1. Add `new_role` column to `users` table (enum: `admin`, `qmhq`, `qmrl`)
2. Create migration script to map old roles → new roles (see table above)
3. Run migration on staging, verify all users mapped correctly

**Phase 2: Code Update**
1. Update permission checks: `if (user.new_role === 'admin')` alongside existing `if (user.role === 'admin' || user.role === 'quartermaster')`
2. Add feature flag: `USE_NEW_ROLES` (default false), test new role system
3. Update RLS policies to check `new_role` column
4. Update UI (user management, assignment dropdowns) to use new role labels

**Phase 3: Rollout**
1. Enable `USE_NEW_ROLES` flag in production
2. Monitor for permission errors (log when access denied)
3. After 1 week stable, remove old `role` column references
4. Drop old `role` column in final migration

**Phase 4: Documentation**
1. Update CLAUDE.md, PRD.md with new 3-role model
2. Notify users: "Your role changed from Quartermaster to Admin (same permissions)"
3. Update onboarding docs

**Complexity:** Medium to High. Schema migration is straightforward, but ensuring no permission regressions requires thorough testing. Parallel role system (old + new) during transition adds temporary complexity.

**Source:** [RBAC Migration Patterns](https://www.osohq.com/learn/rbac-best-practices) emphasizes testing with existing users before fully switching over.

---

## Feature Dependencies

**Cross-Feature Dependencies:**

| Feature | Depends On | Blocks |
|---------|------------|--------|
| **UI Audit** | Existing shadcn/ui components, Tailwind config | None (can run in parallel) |
| **Flow Tracking** | QMRL, QMHQ, PO, Invoice schemas; admin role check | None |
| **RBAC Consolidation** | User table, RLS policies, permission checks throughout app | Flow Tracking (admin-only check needs new role) |

**Recommended Order:**
1. **UI Audit** (Phase 1: Audit findings, Phase 2: Fixes) — Independent, improves developer experience for other features
2. **RBAC Consolidation** (Schema + migration + parallel system) — Sets foundation for simplified permissions
3. **Flow Tracking Page** (Uses new Admin role check) — Leverages cleaned-up permission model

---

## MVP Recommendation

**Prioritize:**

### UI Audit (Highest ROI, Low Complexity)
1. **Manual screenshot audit** (1-2 days)
2. **Fix top 10 inconsistencies** (spacing, button variants, colors)
3. **Document standards** (simple Markdown guide)

**Defer:** Automated linting, Storybook, visual regression tests (nice-to-have, high setup cost)

### Flow Tracking (Core Admin Feature)
1. **Card-based layout** (simpler than tree)
2. **Search by QMRL ID + basic filters** (route, status)
3. **Route-specific downstream display** (Item/Expense/PO logic)
4. **Admin-only access**

**Defer:** Tree visualization, progress percentages, financial summaries (v2 enhancements)

### RBAC Consolidation (Foundation for Scale)
1. **7 → 3 role mapping** (Admin, QMHQ, QMRL)
2. **Migration script** with old role preservation during transition
3. **Permission matrix update** (Admin inherits stock-out approval)
4. **UI updates** (user management, dropdowns)

**Defer:** Role simulation, permission templates, granular overrides (advanced features)

---

## Complexity Summary

| Feature Area | Overall Complexity | Effort Estimate | Risk Level |
|--------------|-------------------|-----------------|------------|
| **UI Audit** | Low-Medium | 3-5 days | Low (non-breaking, incremental fixes) |
| **Flow Tracking** | Medium | 5-7 days | Low (new page, read-only, no schema changes) |
| **RBAC Consolidation** | Medium-High | 7-10 days | Medium (permission regressions possible, thorough testing required) |

**Total:** ~15-22 days for MVP implementation across all three features.

---

## Sources

- [Internal Tools Development in 2026: A Complete Guide](https://www.weweb.io/blog/internal-tools-development-complete-guide)
- [Design System Checklist | Figma](https://www.figma.com/community/file/875222888436956377/design-system-checklist)
- [Design System Audit: Enhancing Design Foundations | DOOR3](https://www.door3.com/blog/design-system-audit)
- [Design System Component Audit and Linting | Figma](https://www.figma.com/community/widget/1532072013420297079/design-system-component-audit-and-linting)
- [UX Design System Audit Guide - Aufait UX](https://www.aufaitux.com/blog/ui-ux-design-system-audit/)
- [Freshservice: Create reports to track Parent-Child ticket associations](https://support.freshservice.com/support/solutions/articles/50000010738-create-reports-to-track-parent-child-ticket-associations)
- [How to Visualize Dependencies in Jira - Ricksoft](https://www.ricksoft-inc.com/post/how-to-visualize-dependencies-in-jira/)
- [Tree View for CRM Relationships Visualization](https://www.inogic.com/blog/2026/01/tree-view-for-crm-relationships-visualization-the-new-upgrades-of-2026/)
- [Workflow Patterns Home Page](http://www.workflowpatterns.com/)
- [Role-Based Access Control Best Practices](https://www.techprescient.com/blogs/role-based-access-control-best-practices/)
- [10 RBAC Best Practices You Should Know](https://www.osohq.com/learn/rbac-best-practices)
- [RBAC Implementation in 5 Steps](https://www.osohq.com/learn/rbac-role-based-access-control-implementation)
- [Master Role-Based Access Control (RBAC) Patterns Like a Pro](https://medium.com/@heyambujsingh/master-role-based-access-control-rbac-patterns-like-a-pro-a258fdb02d67)
- [Role-Based Access Control | Ultimate Guide](https://budibase.com/blog/app-building/role-based-access-control/)
- [Role-Based Access Control Concepts | F5](https://docs.cloud.f5.com/docs-v2/platform/concepts/rbac)
