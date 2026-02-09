# Features Research: Stock-Out Approval, Deletion Protection & Context Panels

**Domain:** Internal ticket/inventory management platform
**Researched:** 2026-02-09
**Context:** Adding stock-out approval workflow, entity deletion protection, user deactivation, and context side sliders to existing QM System

---

## Stock-Out Approval Workflow

### Table Stakes

Features users expect from inventory withdrawal request/approval systems. Missing these would make the feature feel incomplete.

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| **Request creation with reason** | Users must justify withdrawal; standard accountability practice | Low | Status field + reason dropdown/text field |
| **Approval status tracking** | Users need visibility into request state (pending, approved, rejected, cancelled) | Low | Status enum: pending, approved, rejected, cancelled |
| **Single approver per request** | Clear accountability for approval decisions | Low | Admin-only approval matches existing permission model |
| **Approval/rejection with comments** | Approvers need to provide justification for decisions | Medium | Leverage existing comment system or add notes field |
| **Requestor notification** | Users must know when their request is approved/rejected | Medium | Depends on notification system (email/in-app) |
| **Audit trail** | All state changes tracked for compliance | Low | Leverage existing audit_logs infrastructure |
| **Cancel own pending request** | Requestors should be able to withdraw pending requests | Low | Only if status is pending, by requestor only |
| **Stock-out executes on approval** | Approved request automatically creates inventory transaction | Medium | Workflow: approve → create inventory_transaction → update stock |
| **Quantity validation** | Cannot request more than available stock | Medium | Check warehouse stock levels at creation and approval time |
| **Link to parent entity** | Stock-out request tied to QMHQ item route or standalone | Medium | Polymorphic reference or specific QMHQ link |

### Differentiators

Features that enhance the experience beyond basic expectations.

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| **Partial approval** | Approve less than requested quantity if insufficient stock | High | Requires split workflow: approve X of Y requested, creates transaction for X only |
| **Batch approval UI** | Admin selects multiple pending requests, approves all at once | Medium | Improves efficiency when many requests queue up |
| **Approval delegation** | Admin can temporarily delegate approval rights to others | High | Defer to future; adds role/permission complexity |
| **Auto-approval thresholds** | Small quantities (<10 units?) auto-approve without admin review | Medium | Business rule engine; risky for accountability; consider carefully |
| **Priority/urgency levels** | Mark requests as urgent/emergency for faster review | Low | Priority enum: normal, high, emergency |
| **Request history view** | See all past requests by user/item/warehouse | Low | Filter existing requests table |
| **Expiration/timeout** | Pending requests expire after N days | Medium | Scheduled job to auto-cancel stale requests |
| **Stock reservation on request** | Reserve stock when request created, release if rejected | High | Prevents overselling but adds complexity; likely overkill for internal tool |
| **Admin override/force approve** | Emergency bypass for critical situations with justification | Low | Admin can approve even if stock insufficient, with warning and mandatory reason |
| **Multi-level approval** | Large quantities require multiple approvers | High | Defer to future; current system is admin-only single-tier |

### Anti-Features

Features to deliberately NOT build based on research.

| Anti-Feature | Why Avoid | What to Do Instead |
|--------------|-----------|-------------------|
| **Edit approved requests** | Breaks audit integrity; approved = immutable | Delete and create new request if changes needed |
| **Anonymous requests** | Internal tool requires accountability | Always track requestor |
| **Requester can approve own request** | Violates separation of duties | Only admin role can approve |
| **Automatic rejection** | Surprising behavior; human judgment required | Admin must explicitly reject with reason |
| **Complex multi-currency handling** | Stock-out is inventory, not financial | Stock quantities are currency-agnostic |
| **Stock-out without request** | Circumvents approval workflow | Remove or restrict direct stock-out form; force through request/approval |

### Dependencies on Existing Features

- **Inventory transactions table**: Approved request creates `inventory_out` transaction
- **Warehouse stock levels**: Real-time availability check before approval
- **Audit logging**: Request state changes trigger audit logs
- **User permissions**: Admin role enforcement for approval actions
- **QMHQ item route**: May link stock-out request to parent QMHQ
- **Comment system (if v1.5 built)**: Reuse for approval notes; otherwise add notes field

### Integration Points

**Two stock-out paths to unify:**
1. **QMHQ item route**: Creates stock-out request automatically when QMHQ line created
2. **Manual warehouse stock-out**: User initiates stock-out request from inventory page

**Workflow:**
```
Request Created (pending)
  → Admin Reviews
    → Approved: Creates inventory_transaction (type: inventory_out)
    → Rejected: Request closed with reason
    → Cancelled: Requestor withdraws
```

---

## Entity Deletion Protection

### Table Stakes

Essential features for preventing data loss in relational databases.

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| **Foreign key RESTRICT constraint** | Database-level protection; prevents delete if referenced | Low | PostgreSQL ON DELETE RESTRICT (or NO ACTION default) |
| **User-friendly error messages** | Database error translated to helpful UI message | Low | "Cannot delete: X items reference this category" |
| **"Where used" display** | Show list of entities referencing this record before delete attempt | Medium | Query foreign key relationships and display count/list |
| **Soft delete for users** | Preserve user data for audit trail when employee leaves | Low | `is_active` flag already exists; enhance with user deactivation |
| **Cascade delete for owned children** | Parent deletion removes orphaned children (e.g., QMRL deletes QMHQ lines) | Medium | ON DELETE CASCADE for dependent entities |
| **Admin-only deletion** | Restrict delete operations to admin role | Low | Permission check in UI and RLS policy |
| **Confirmation dialog** | Two-step delete with explicit confirmation | Low | "Are you sure? This cannot be undone." modal |
| **Audit log on delete** | Track what was deleted, by whom, when | Low | Leverage existing audit_logs system |

### Differentiators

Features that enhance deletion protection beyond basics.

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| **Cascading impact preview** | Show what else will be deleted before confirming | High | Recursive query to find all dependent records; complex UI |
| **Deactivation instead of deletion** | For master data (items, suppliers, categories), hide but preserve | Low | Add `is_active` flag if not present; filter in queries |
| **Archive and restore** | Move deleted data to archive table for recovery | Medium | Separate archive schema; adds maintenance burden |
| **Bulk deactivation** | Select multiple entities, deactivate all at once | Low | Useful for cleaning up unused items/categories |
| **"Replace and delete" workflow** | Reassign references to different entity before delete | High | Complex UI: "Delete category X, move all items to category Y" |
| **Deletion request/approval** | Non-admin requests deletion, admin approves | High | Adds workflow layer; likely overkill |
| **GDPR-compliant hard delete** | For user data, provide true deletion option | Medium | Legal requirement in some jurisdictions; hard delete with cascade |
| **Scheduled deletion** | Mark for deletion, remove after grace period | Medium | Soft delete + background job; allows recovery window |

### Anti-Features

Features to deliberately avoid.

| Anti-Feature | Why Avoid | What to Do Instead |
|--------------|-----------|-------------------|
| **Silent deletion failures** | Confusing and frustrating for users | Always show clear error with reason |
| **Hard delete as default** | Data loss risk; irreversible | Default to soft delete (is_active = false); hard delete admin-only with confirmation |
| **Cascade delete without warning** | Surprising data loss; users don't expect children to disappear | Show "This will also delete X related records" before confirming |
| **Undo after hard delete** | Technically impossible; false promise | Use soft delete if undo needed; hard delete is permanent |
| **Complex permission matrix for deletion** | Over-engineering; admin-only is sufficient for internal tool | Keep simple: admin can delete, others cannot |

### Dependencies on Existing Features

- **Soft delete (`is_active` flag)**: Already implemented system-wide
- **Audit logging**: Delete events already tracked
- **RLS policies**: Admin role permissions already defined
- **Foreign key relationships**: Database schema has FKs defined

### Entities Requiring Protection

| Entity | Protection Strategy | Rationale |
|--------|-------------------|-----------|
| **Items** | RESTRICT + soft delete | Referenced by POs, invoices, inventory transactions, QMHQ |
| **Statuses** | RESTRICT | Referenced by QMRL, QMHQ; critical to workflow |
| **Categories** | RESTRICT + soft delete | Referenced by QMRL, QMHQ, items |
| **Departments** | RESTRICT | Referenced by users, QMRL; organizational structure |
| **Contact Persons** | RESTRICT | Referenced by QMRL, suppliers |
| **Suppliers** | RESTRICT + soft delete | Referenced by POs, contact persons |
| **Users** | Soft delete only (is_active) | Referenced everywhere; must preserve for audit trail |
| **Warehouses** | RESTRICT | Referenced by inventory transactions; can't delete with stock |

---

## User Deactivation

### Table Stakes

Essential features for employee lifecycle management.

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| **Deactivate vs delete** | Deactivation preserves data, allows reactivation | Low | Use existing `is_active` flag on users table |
| **Deactivated user cannot login** | Prevent access to system | Low | Auth middleware checks `is_active` |
| **Preserve historical data** | Past actions (QMRL, QMHQ, audit logs) remain attributed to user | Low | Don't delete or anonymize; user record stays |
| **Remove from active user lists** | Deactivated users don't appear in assignment dropdowns | Low | Filter WHERE is_active = true in queries |
| **Admin-only deactivation** | Only admin can deactivate users | Low | Permission check in UI and API |
| **Reactivation option** | Bring user back if they return to company | Low | Set is_active = true again |
| **Deactivation timestamp** | Track when user was deactivated | Low | Add `deactivated_at` field |
| **Deactivation reason** | Document why user left (resignation, termination, etc.) | Low | Add `deactivation_reason` text field |

### Differentiators

Features that enhance user deactivation beyond basics.

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| **Reassign open tasks** | When deactivating, prompt to reassign pending QMRL/QMHQ | Medium | Query open items assigned to user, bulk reassign UI |
| **Deactivation checklist** | Ensure all user's responsibilities transferred before deactivation | Medium | Show count of open assignments, force review |
| **Auto-deactivation scheduling** | Set future date for deactivation (e.g., last day of employment) | Medium | Scheduled job; useful for planned departures |
| **Partial deactivation (read-only)** | User can view but not create/edit during notice period | High | Adds permission layer complexity |
| **Deactivation notification** | Email user and admin when deactivation occurs | Low | If notification system exists |
| **Bulk deactivation** | Select multiple users, deactivate all | Low | Useful for seasonal staff turnover |
| **Hard delete for never-active users** | If user created but never logged in, allow deletion | Low | Check if any audit logs exist; if not, safe to delete |

### Anti-Features

Features to deliberately avoid.

| Anti-Feature | Why Avoid | What to Do Instead |
|--------------|-----------|-------------------|
| **Anonymize user data** | Breaks audit trail; defeats accountability purpose | Deactivate but preserve attribution |
| **Delete user with reassignment** | Complex and risky; partial data loss | Deactivate, keep user record intact |
| **Self-deactivation** | Security risk; users could lock themselves out by accident | Admin-only deactivation |
| **Automatic deactivation on inactivity** | Surprising; legitimate users on leave | Manual deactivation only |
| **Remove user from historical records** | Falsifies history; compliance violation | Keep user attribution forever |

### Dependencies on Existing Features

- **Users table `is_active` flag**: Already exists
- **Auth middleware**: Add `is_active` check in session validation
- **RLS policies**: Filter deactivated users from assignment queries
- **Audit logs**: Preserve `created_by`/`updated_by` even if user deactivated

---

## Context Side Sliders / Panels

### Table Stakes

Essential features for collapsible context panels showing related data.

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| **Slide-in from right** | Standard pattern for detail/context panels | Low | Overlays main content, pushes it left or overlays |
| **Open/close toggle** | User controls visibility | Low | Button to show/hide panel |
| **Overlay backdrop** | Dim main content when panel open on mobile | Low | Focus attention on panel; accessibility |
| **Responsive behavior** | Full-width on mobile, 30-40% width on desktop | Medium | Tailwind breakpoints; existing QMRL context panel pattern |
| **Smooth animation** | Slide transition (300ms) feels polished | Low | CSS transition or Framer Motion |
| **Close on outside click** | Click backdrop to close panel | Low | Standard modal/drawer behavior |
| **Close on ESC key** | Keyboard accessibility | Low | Event listener for ESC keypress |
| **Focus trap** | Tab navigation stays within panel when open | Medium | Accessibility requirement; prevents tabbing to background |
| **Scroll within panel** | Long content scrolls inside panel, not main page | Low | Overflow-y-auto on panel container |

### Differentiators

Features that enhance side panels beyond basics.

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| **Resizable width** | User drags edge to adjust panel size | Medium | Nice-to-have; adds complexity; defer to v1.6 |
| **Multiple panels (stack)** | Open second panel on top of first (e.g., QMRL → QMHQ → Item) | High | Breadcrumb navigation; complex state management |
| **Panel content routing** | Panel URL updates, supports back/forward | Medium | Useful for shareable links; Next.js query params |
| **Lazy load panel content** | Load data only when panel opened | Low | Performance optimization; fetch on expand |
| **Pinned/docked mode** | Keep panel permanently open if user prefers | Medium | Local storage preference; split-pane layout |
| **Panel presets (small/medium/large)** | Quick size adjustment buttons | Low | Predefined width options |
| **Collapsible sections within panel** | Accordion-style sections for dense content | Low | Reuse existing accordion component if exists |
| **Print-friendly view** | Option to print panel content | Low | Separate print stylesheet |

### Anti-Features

Features to deliberately avoid.

| Anti-Feature | Why Avoid | What to Do Instead |
|--------------|-----------|-------------------|
| **Slide from left** | Conflicts with sidebar navigation | Always right-side panels; left is for primary nav |
| **Multiple simultaneous panels** | Confusing; screen real estate limited | One panel at a time; replace content if opening another |
| **Auto-open on hover** | Jarring; user didn't request it | Explicit click/tap to open only |
| **Panel within panel (nesting)** | Overwhelming; difficult to navigate back | Use tabs or sections within single panel |
| **Persistent open state on navigation** | Confusing; context changes | Close panel when user navigates to different page |

### Dependencies on Existing Features

- **QMRL context panel during QMHQ creation**: Pattern already exists; reuse component structure
- **Tailwind CSS**: Responsive breakpoints and transitions
- **shadcn/ui Sheet component**: Consider using if available; standard drawer/sheet pattern
- **Next.js App Router**: URL state management for panel routing (optional)

### Use Cases in QM System

| Context | Trigger | Panel Content |
|---------|---------|---------------|
| **QMHQ creation** | User creating QMHQ line | Show parent QMRL details (already implemented) |
| **Stock-out request** | View item details | Show item info, stock levels, recent transactions |
| **Approval review** | Admin reviewing request | Show requestor history, item details, warehouse stock |
| **Entity "where used"** | Before deleting item/category | Show list of entities referencing this record |
| **User detail** | View user profile | Show user's open assignments, recent activity |
| **Warehouse detail** | View warehouse info | Show current stock, recent transactions |

---

## Summary: Complexity & Priority Assessment

### Overall Complexity by Feature Area

| Feature Area | Overall Complexity | Implementation Risk |
|--------------|-------------------|---------------------|
| **Stock-Out Approval Workflow** | Medium | Medium - new workflow layer, but follows existing patterns |
| **Entity Deletion Protection** | Low | Low - mostly database constraints and error handling |
| **User Deactivation** | Low | Low - extends existing `is_active` flag functionality |
| **Context Side Sliders** | Low-Medium | Low - reuse QMRL context panel pattern |

### Recommended MVP Scope

**Include in Milestone:**

**Stock-Out Approval:**
- ✅ Request creation with status (pending/approved/rejected/cancelled)
- ✅ Admin-only approval/rejection
- ✅ Approval notes field (or leverage comments)
- ✅ Quantity validation against stock
- ✅ Audit trail for state changes
- ✅ Approved request creates inventory_out transaction
- ✅ Cancel own pending request
- ⚠️ Partial approval (if admin-required; mark HIGH complexity)
- ❌ Batch approval UI (defer to future if time-constrained)

**Deletion Protection:**
- ✅ Foreign key RESTRICT constraints
- ✅ User-friendly error messages
- ✅ "Where used" display (show count of references)
- ✅ Soft delete for items, suppliers, categories (add `is_active` if missing)
- ✅ Admin-only deletion permissions
- ✅ Confirmation dialogs
- ✅ Audit log on delete

**User Deactivation:**
- ✅ Deactivate user (set `is_active = false`)
- ✅ Prevent deactivated user login
- ✅ Filter from active user dropdowns
- ✅ Preserve historical data attribution
- ✅ Reactivation option
- ✅ Deactivation timestamp and reason fields
- ⚠️ Reassign open tasks (nice-to-have; may be manual process)

**Context Sliders:**
- ✅ Reuse existing QMRL context panel component
- ✅ Apply to stock-out request (show item details)
- ✅ Apply to "where used" display (show references before delete)
- ✅ Responsive behavior (mobile full-width, desktop 30-40%)
- ✅ Smooth slide animation
- ✅ Close on ESC, outside click
- ✅ Focus trap for accessibility

**Defer to Future:**
- Stock-out: Auto-approval thresholds, approval delegation, stock reservation, multi-level approval
- Deletion: Cascading impact preview, replace-and-delete workflow, GDPR hard delete
- Deactivation: Auto-deactivation scheduling, partial deactivation (read-only), bulk deactivation
- Sliders: Resizable width, multiple stacked panels, URL routing for panels

### Cross-Feature Integration Points

1. **Stock-Out Approval + Audit System**: Request state changes trigger audit logs
2. **Stock-Out Approval + Inventory Transactions**: Approved request creates `inventory_out` record
3. **Stock-Out Approval + QMHQ Item Route**: QMHQ line creation triggers stock-out request
4. **Stock-Out Approval + Context Slider**: Show item/warehouse details in side panel during review
5. **Deletion Protection + Context Slider**: Display "where used" list in side panel
6. **User Deactivation + Assignment Dropdowns**: Filter `WHERE is_active = true`
7. **User Deactivation + Auth Middleware**: Block login if `is_active = false`
8. **Context Slider + Existing QMRL Panel**: Reuse component architecture

### Technical Recommendations

**Database Schema Changes:**
- `stock_out_requests` table: id, qmhq_id (nullable), item_id, warehouse_id, requested_quantity, approved_quantity (nullable), status, requestor_id, approver_id (nullable), approval_notes, requested_at, approved_at, created_at, updated_at
- `users` table: Add `deactivated_at`, `deactivation_reason` (if not already present)
- Master data tables: Ensure `is_active` flag exists on items, suppliers, categories
- Foreign keys: Add ON DELETE RESTRICT to items, statuses, categories, departments, contact_persons, suppliers, warehouses

**UI Components to Build/Enhance:**
- `StockOutRequestForm`: Create request with reason dropdown
- `StockOutApprovalCard`: Admin approval UI (approve/reject/partial)
- `ContextSlider`: Reusable side panel component (or use shadcn/ui Sheet)
- `WhereUsedPanel`: Show entities referencing a record before delete
- `UserDeactivationDialog`: Deactivate user with reason field
- `DeleteConfirmationDialog`: Enhanced with "where used" warning

**Workflow State Machine (Stock-Out):**
```
pending → approved → inventory_out created (success)
pending → rejected (with reason)
pending → cancelled (by requestor)
```

---

## Sources

### Stock-Out Approval Workflow Research
- [Inventory Management Guide 2026: Key Insights](https://kissflow.com/procurement/inventory-management/inventory-management-guide/)
- [The ultimate inventory replenishment workflow guide](https://www.moxo.com/blog/inventory-replenishment-workflow)
- [10 Key Steps To Build A Purchase Order Workflow In 2026](https://www.spendflo.com/blog/streamlining-your-purchase-order-workflow-key-steps-and-best-practices)
- [Purchase Requisition Approval Workflow Guide 2026](https://www.order.co/blog/procurement/purchase-requisition-approval-workflow-2026/)
- [Warehouse Transaction Approval Cycles | WMS Inventory System](https://asapsystems.com/warehouse-management/inventory-features/transaction-approval-cycles/)
- [Inventory journal approval workflows - Dynamics 365](https://learn.microsoft.com/en-us/dynamics365/supply-chain/inventory/inventory-journal-workflow)
- [Inventory System | Secure Your Workflow With Approval Cycles](https://asapsystems.com/products/inventory-system/system-features/approval-cycles/)
- [Approve or reject documents in workflows - Business Central](https://learn.microsoft.com/en-us/dynamics365/business-central/across-how-use-approval-workflows)
- [Request and Approval Workflows](https://help.xtontech.com/content/administrators-and-power-users/workflow/request-and-approval-workflows.htm)
- [Configuring Jira Service Management approvals](https://confluence.atlassian.com/adminjiraserver/configuring-jira-service-management-approvals-938847527.html)

### Entity Deletion Protection Research
- [Cascade Delete - EF Core | Microsoft Learn](https://learn.microsoft.com/en-us/ef/core/saving/cascade-delete)
- [Cascade Deletes | Supabase Docs](https://supabase.com/docs/guides/database/postgres/cascade-deletes)
- [SQL ON DELETE RESTRICT: Prevent Accidental Data Loss](https://www.datacamp.com/tutorial/sql-on-delete-restrict)
- [PostgreSQL: Documentation: Constraints](https://www.postgresql.org/docs/current/ddl-constraints.html)
- [The Delete Button Dilemma: When to Soft Delete vs Hard Delete](https://dev.to/akarshan/the-delete-button-dilemma-when-to-soft-delete-vs-hard-delete-3a0i)
- [Soft Deletion Probably Isn't Worth It](https://brandur.org/soft-deletion)
- [Soft and Hard Delete: everything you need to know](https://oscmarb.com/blog/soft-delete-and-hard-delete-everything-you-need-to-know/)
- [So you want Soft Deletes? | DoltHub Blog](https://www.dolthub.com/blog/2022-11-03-soft-deletes/)
- [To Delete or to Soft Delete, That is the Question!](https://www.jmix.io/blog/to-delete-or-to-soft-delete-that-is-the-question/)
- [Understanding Soft Delete and Hard Delete in Software Development](https://surajsinghbisht054.medium.com/understanding-soft-delete-and-hard-delete-in-software-development-best-practices-and-importance-539a935d71b5)

### User Deactivation Research
- [Users and Organizations – AuthKit – WorkOS Docs](https://workos.com/docs/user-management/users-organizations/organizations/when-to-use-deletion-vs-deactivation)
- [Should I choose to deactivate or delete a user to remove them from my account?](https://support.zendesk.com/hc/en-us/articles/4408830727194-Should-I-choose-to-deactivate-or-delete-a-user-to-remove-them-from-my-account)
- [User Deletion vs. Deactivation – Wrike Help Center](https://help.wrike.com/hc/en-us/articles/1500008058701-User-Deletion-vs-Deactivation)
- [Best Practices for Disabling, Deleting & Locking Down Past Employee Accounts](https://copperbandtech.com/best-practices-for-disabling-deleting-locking-down-past-employee-accounts/)
- [Terminating vs. deleting an employee](https://portal.wfo.telusinternational.com/OnlineHelp/en_US/wfm/fw_UserAdmin_User_Management/fw_UserAdmin_Terminating_or_deleting_employees.htm)
- [Deactivating users vs deleting users](https://community.docebo.com/product-q-a-7/deactivating-users-vs-deleting-users-431)

### Context Panel / Side Slider Research
- [Side Drawer UI: A Guide to Smarter Navigation](https://www.designmonks.co/blog/side-drawer-ui)
- [Drawer UI Design: Best practices, Design variants & Examples](https://mobbin.com/glossary/drawer)
- [PatternFly • Drawer](https://www.patternfly.org/components/drawer/design-guidelines/)
- [Case Study. Master/Detail Pattern Revisited](https://medium.com/@lucasurbas/case-study-master-detail-pattern-revisited-86c0ed7fc3e)
- [Sheet - shadcn/ui](https://ui.shadcn.com/docs/components/radix/sheet)
- [Drawer - shadcn/ui](https://ui.shadcn.com/docs/components/radix/drawer)
- [Exploring Drawer and Sheet Components in shadcn UI](https://medium.com/@enayetflweb/exploring-drawer-and-sheet-components-in-shadcn-ui-cf2332e91c40)
- [State Management in 2026: Redux, Context API, and Modern Patterns](https://www.nucamp.co/blog/state-management-in-2026-redux-context-api-and-modern-patterns)
- [react-sliding-side-panel - npm](https://www.npmjs.com/package/react-sliding-side-panel)

### Audit Trail & Workflow Research
- [Audit trail: Track every action and stay compliance-ready](https://www.nutrient.io/blog/audit-trail/)
- [What is a document audit trail and how it work](https://fynk.com/en/blog/document-audit-trail/)
- [What Is an Audit Trail? Definition and Best Practices](https://trullion.com/blog/audit-trail-guide/)
- [Audit Trails in Workflow Management](https://www.cflowapps.com/glossary/audit-trails-in-workflow-management/)

### Batch Approval & Parallel Workflows
- [Create parallel approval workflows - Power Automate](https://learn.microsoft.com/en-us/power-automate/parallel-modern-approvals)
- [Manage sequential approvals with Power Automate](https://learn.microsoft.com/en-us/power-automate/sequential-modern-approvals)
- [Request approvals with workflows | Smartsheet](https://help.smartsheet.com/articles/2479276-request-approval-from-stakeholders)
- [How to set multiple approvers in Microsoft Power Automate](https://www.jotform.com/blog/power-automate-approval-workflow-multiple-approvers/)

### Display Mode Toggle Research
- [Card View | PatternFly](https://pf3.patternfly.org/v3/pattern-library/content-views/card-view/)
- [PatternFly • Card view](https://www.patternfly.org/patterns/card-view/design-guidelines/)
- [Table vs List vs Cards: When to Use Each Data Display Pattern](https://uxpatterns.dev/pattern-guide/table-vs-list-vs-cards)
- [Toggle Between Grid and List View in React](https://medium.com/@layne_celeste/toggle-between-grid-and-list-view-in-react-731df62b829e)

---

**Confidence Level: HIGH**

All feature areas are well-documented in industry research and enterprise system best practices. Stock-out approval workflows are standard in warehouse management systems. Deletion protection patterns are well-established database design principles. User deactivation vs deletion is a mature HR system pattern. Context side sliders are ubiquitous in modern web applications. Table stakes, differentiators, and anti-features are clearly categorized based on current best practices, research findings, and the specific context of the QM System internal tool.

**Key Insight**: The QM System already has strong foundations (audit logging, soft delete, polymorphic associations, QMRL context panel). This milestone extends existing patterns rather than introducing new paradigms, reducing implementation risk significantly.
