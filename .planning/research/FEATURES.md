# Feature Landscape

**Domain:** Purchase Order Lifecycle Management, Cancellation/Void Guards, and Receipt PDF Export
**Researched:** 2026-02-12

## Table Stakes

Features users expect. Missing = product feels incomplete.

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| **6-State PO Status Engine** | Industry standard for procurement tracking (not_started, partially_invoiced, awaiting_delivery, partially_received, closed, cancelled) | Medium | Auto-calculated based on 3-way matching. Already in PRD but needs proper state machine implementation. |
| **Status Priority Rules** | When PO has both invoicing and receiving progress, users need clear status | Low | "Partially Invoiced" wins over "Partially Received" per project requirements. Industry varies (some use "Open"), but conflict resolution is mandatory. |
| **Lock Mechanism for Closed POs** | Closed = matched = no further changes allowed | Medium | Read-only state prevents data corruption. Admin-only unlock is table stakes. Jira, Salesforce use similar patterns. |
| **Cannot Cancel PO with Invoices** | Once invoiced, cancellation would break financial chain | Low | Database trigger + UI validation. All enterprise systems (SAP, Oracle, Dynamics) enforce this. |
| **Cannot Void Invoice with Stock-In** | Voiding invoice after goods received breaks inventory-finance alignment | Medium | Cascade validation: Invoice → Stock-In transactions. Sage, QuickBooks enforce this. Alternative: reversal instead of void. |
| **Invoice Receipts (PDF)** | Users expect printable/emailable proof of financial transactions | Medium | Invoice = core financial document. Must include: invoice header, line items, totals, EUSD equivalent, supplier info, company branding. |
| **GRN/Stock-In Receipts (PDF)** | Warehouse teams need proof of delivery for 3-way matching | Medium | Goods Received Note standard in procurement. Must include: item details, quantities, warehouse, PO reference, inspection notes, signature line. |
| **Company Branding on PDFs** | Professional appearance, official documentation | Low | Logo, colors, fonts matching app UI. Standard in all invoice generators (Canva, Invoice Simple, Jotform). |

## Differentiators

Features that set product apart. Not expected, but valued.

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| **Stock-Out Request Receipts (PDF)** | Internal requisition proof for audit trail | Low | Not common in basic procurement systems. Adds accountability for warehouse stock movements. Already have SOR flow in app. |
| **QMHQ Money-Out Receipts (PDF)** | Expense reimbursement proof for requester | Low | Accounting systems have this (Expensify, Bill.com), but integrated procurement systems often skip it. Useful for petty cash tracking. |
| **Real-time Status Updates** | UI auto-updates status when invoice/stock-in created | Medium-High | Requires database triggers + UI reactivity. Modern procurement platforms (Coupa, Ariba) have this. Elevates UX above manual refresh. |
| **Audit Trail in PDF Footer** | PDF includes: created by, created at, export timestamp | Low | Tamper-evidence, compliance-friendly. Not standard in template libraries but easy to add. |
| **Cascading Void Prevention** | UI shows WHY void is blocked with dependency chain | Low | Error messages like "Cannot void: 3 stock-in transactions exist". Better than generic "Cannot void". |
| **Status History Timeline** | Visual representation of PO lifecycle progression | Medium | Already have History tab. Could add status-focused timeline with duration in each state. Useful for bottleneck analysis. |
| **Balance in Hand Validation** | Block PO creation if insufficient balance (for PO route QMHQ) | Low | Already have balance_in_hand calculation. Adding UI validation prevents overspend. |

## Anti-Features

Features to explicitly NOT build.

| Anti-Feature | Why Avoid | What to Do Instead |
|--------------|-----------|-------------------|
| **Partially Cancel PO** | Complexity: tracking which line items cancelled vs active. Creates confusion with partially_invoiced status. | Close entire PO when complete. If need to reduce quantity, create adjustment workflow in V2. |
| **Reopen Closed PO** | Breaks 3-way matching integrity. If reopened, what happens to closed invoices and stock-in? | Admin-only unlock for exceptional cases (e.g., data correction). Never allow requester/finance to reopen. |
| **Delete Invoices** | Audit nightmare. Financial regulations require paper trail. | Void only. Already in PRD (INV-06). Voided invoices excluded from PO status calculations. |
| **Edit Invoiced Quantities** | After invoice created, changing quantities breaks stock-in linkage. | No edit. Void and recreate if mistake. Or create credit memo in V2. |
| **Stock-In Before Invoice** | PRD specifies invoice-first flow. Stock-in from invoice auto-populates quantities. | Maintain invoice → stock-in order. Manual stock-in exists but doesn't affect PO status. |
| **Multi-Template PDF System** | Users selecting from 5 different invoice templates adds cognitive load. | Single consistent template matching app UI. Branding via config (logo, colors), not template selection. |
| **PDF Download + Email in One Action** | Feature creep. Email requires SMTP config, recipient management, email templates. | Download PDF only. User handles email via their client. V2 can add email integration. |

## Feature Dependencies

```
PO Status Engine
├─ Lock Mechanism (depends on status = 'closed')
├─ Cancellation Guards (depends on status calculation)
└─ Invoice Creation Block (depends on status != 'closed'|'cancelled')

Void Guards
├─ Invoice Void (depends on stock-in transaction check)
└─ Cascading Void Prevention UI (depends on void guard logic)

PDF Export
├─ Invoice Receipt (independent, references invoice data)
├─ GRN Receipt (independent, references stock-in data)
├─ SOR Receipt (independent, references stock-out request data)
├─ QMHQ Money-Out Receipt (independent, references financial transaction data)
└─ Company Branding (config table or env vars)
```

## MVP Recommendation

Prioritize:

1. **6-State PO Status Engine** - Core business logic. Must be correct before lock/guards work.
2. **Lock Mechanism** - Prevents data corruption. Critical for closed POs.
3. **Cannot Cancel PO with Invoices** - Financial integrity guard.
4. **Cannot Void Invoice with Stock-In** - Inventory-finance integrity guard.
5. **Invoice Receipt PDF** - Table stakes financial document.
6. **GRN Receipt PDF** - Table stakes warehouse document.

Defer:

- **Stock-Out Request Receipts**: Nice-to-have. SOR workflow already exists without PDF.
- **QMHQ Money-Out Receipts**: Nice-to-have. Manual expense tracking acceptable for V1.
- **Real-time Status Updates**: UX polish. Page refresh works for MVP.
- **Status History Timeline**: Analysis feature, not operational necessity.
- **Audit Trail in PDF Footer**: Compliance enhancement for V2.

## Implementation Insights

### PO Status Engine

**Expected behavior:**
- Status auto-calculates on every invoice create/void, stock-in create.
- Database trigger or stored procedure pattern (already familiar from WAC calculation).
- UI displays status badge with color-coding.

**Edge cases:**
- PO has 10 units ordered. Invoice 1 = 5 units, Invoice 2 (voided) = 3 units. Stock-in = 5 units.
  - Expected: total_invoiced = 5 (excludes voided), total_received = 5, status = 'closed' if total_ordered = 5.
- PO ordered 10 units. Invoiced 10 units. Received 7 units.
  - Expected: status = 'partially_received' (not 'awaiting_delivery').
- PO ordered 10 units. Invoiced 7 units. Received 7 units.
  - Expected: status = 'partially_invoiced' (conflict resolution: invoicing wins).

**User expectations:**
- Status badge on PO list (card/list view).
- Status badge on PO detail page.
- Status NOT editable by user (calculated field).
- Tooltip/help text explaining what each status means.

### Lock Mechanism

**Expected behavior:**
- When status = 'closed', PO detail page shows lock icon.
- All input fields disabled (read-only mode).
- "Edit" button hidden or replaced with "Unlock (Admin Only)" button.
- Linked invoices also read-only (cannot void if PO closed).

**Edge cases:**
- Admin unlocks PO. Status recalculates to 'partially_received' because user voids an invoice.
  - Expected: PO auto-unlocks when status changes from 'closed'.
- User tries to create new invoice for closed PO.
  - Expected: UI hides closed POs from selection dropdown. Database trigger blocks insert (already in PRD).

**User expectations:**
- Visual indicator (lock icon, "Closed" badge).
- Explanation why locked ("Fully matched: PO = Invoice = Stock").
- Admin-only unlock doesn't permanently disable lock (re-locks when status returns to 'closed').

### Cancellation Guards

**Expected behavior:**
- PO with 0 invoices → Cancel button visible.
- PO with ≥1 invoice → Cancel button hidden or disabled with tooltip "Cannot cancel: invoices exist".
- Cancel action sets status = 'cancelled', not soft delete (is_active = false).
- Cancelled POs excluded from Balance in Hand calculation (already in PRD: total_po_committed excludes cancelled).

**Edge cases:**
- PO has 1 invoice, then invoice is voided. Can PO be cancelled now?
  - Industry standard: NO. Voided invoice still exists (audit trail). Use "Close" instead of "Cancel".
  - QM System decision: Follow industry standard (cannot cancel if any invoices, even voided).

**User expectations:**
- Clear error message if cancel blocked.
- Option to "Close" PO instead (manually set to closed without full matching).

### Void Guards

**Expected behavior:**
- Invoice with 0 stock-in transactions → Void button visible.
- Invoice with ≥1 stock-in → Void button hidden or disabled with tooltip "Cannot void: goods received (3 transactions)".
- Void sets is_voided = true, voided_at, voided_by, void_reason (already in PRD schema).
- Voided invoices excluded from PO status calculation (already in PRD logic).

**Edge cases:**
- Invoice has 3 line items. Stock-in created for 1 line item. Can invoice be voided?
  - Expected: NO. Any stock-in blocks entire invoice void (not per-line-item void).
- Stock-in transaction is manually deleted (admin action). Can invoice be voided now?
  - Expected: YES. System re-checks stock-in count, allows void if count = 0.

**User expectations:**
- Void requires void_reason (free text or dropdown: "Duplicate", "Incorrect Amount", "Supplier Credit", "Other").
- Voided invoices visually distinct (strikethrough, "VOIDED" watermark on detail page).
- Void action is permanent (no "Unvoid"). Alternative: reversal invoice in V2.

### PDF Export

**Expected behavior (Invoice Receipt):**
- Download button on invoice detail page.
- PDF filename: `INV-2025-00001_[Supplier Name]_[Date].pdf`
- Content: Invoice header (invoice no, date, due date, supplier), line items table (item, qty, unit price, subtotal), totals (subtotal, tax if applicable, total in local currency, total in EUSD), company info (logo, name, address), footer (page numbers, export timestamp).

**Expected behavior (GRN Receipt):**
- Download button on stock-in transaction detail or list.
- PDF filename: `GRN-[Warehouse]-[Date]-[Reference].pdf`
- Content: GRN header (date, warehouse, PO reference, invoice reference if from invoice), item table (item name, quantity, unit cost for WAC, condition notes), totals (total units, total value), signature lines (received by, verified by), footer (export timestamp).

**Edge cases:**
- Invoice has 50 line items (multi-page PDF).
  - Expected: Pagination with page numbers, repeated header/footer.
- Company logo not uploaded yet.
  - Expected: PDF still generates with company name text instead of logo.
- EUSD calculation results in very long decimal (e.g., 1234.567890123).
  - Expected: Round to 2 decimals for display (already PRD standard).

**User expectations:**
- PDF opens in new tab (not auto-download, gives user preview).
- PDF styling matches app UI (colors, fonts, spacing).
- Print-friendly (no dark backgrounds, high contrast).
- Professional appearance (not template-looking).

## Technology Recommendations

### PO Status Engine
- **Implementation:** PostgreSQL stored function `calculate_po_status(po_id UUID)` triggered on invoice/stock-in insert/update/delete.
- **Rationale:** Already using triggers for WAC calculation. Consistent pattern. Performance: status calculation is fast (simple SUM queries).

### Lock Mechanism
- **Implementation:** React hook `usePOLockState(poStatus)` returns `{ isLocked, canUnlock }`. Conditional rendering based on lock state.
- **Rationale:** Client-side lock (no DB flag). Lock is derived from status, not stored. Prevents stale lock state.

### Cancellation/Void Guards
- **Implementation:** Database triggers + UI validation. Trigger: `BEFORE UPDATE` on purchase_orders checks invoice count. UI: Hide/disable buttons based on entity counts.
- **Rationale:** Defense in depth. UI prevents user confusion. DB trigger prevents API bypass.

### PDF Export
- **Library:** `@react-pdf/renderer` (15,900 stars, 860K weekly downloads, React-first approach).
- **Rationale:**
  - Server-side rendering compatible with Next.js API routes.
  - JSX-based templates (familiar for React devs).
  - Styling similar to CSS (easier to match app UI than jsPDF's imperative API).
  - Active maintenance (updated 2025).
- **Alternative:** `jsPDF` if need to draw complex graphics. But for receipts (tables, text, logos), react-pdf is superior DX.
- **Deployment:** Next.js API route `/api/pdf/invoice/[id]`, `/api/pdf/grn/[id]`. Client calls API, receives PDF blob, opens in new tab.

### Company Branding
- **Implementation:** Add `company_config` table or use existing Supabase storage for logo upload. Env vars for company name, address.
- **Rationale:** Single source of truth for branding. PDF templates fetch from config. Admin page for updating logo/colors in V2.

## Complexity Assessment

| Feature | Complexity | Dev Time Estimate | Risk |
|---------|------------|-------------------|------|
| 6-State PO Status Engine | Medium | 2-3 days | Medium (edge cases in conflict resolution) |
| Lock Mechanism | Low-Medium | 1-2 days | Low (derived from status) |
| Cannot Cancel PO with Invoices | Low | 0.5 day | Low (simple check) |
| Cannot Void Invoice with Stock-In | Low | 0.5 day | Low (simple check) |
| Invoice Receipt PDF | Medium | 2-3 days | Low (well-documented library) |
| GRN Receipt PDF | Medium | 2-3 days | Low (similar to invoice PDF) |
| SOR Receipt PDF | Low | 1 day | Low (defer to V2 if time-constrained) |
| QMHQ Money-Out Receipt PDF | Low | 1 day | Low (defer to V2 if time-constrained) |
| Real-time Status Updates | Medium-High | 2-3 days | Medium (requires WebSocket or polling) |
| Status History Timeline | Medium | 1-2 days | Low (UI component over existing audit data) |

**Total MVP estimate:** 8-12 days (excluding deferred features)

## Sources

**Procurement Lifecycle:**
- [Purchase Order Life Cycle - Oracle](https://docs.oracle.com/en/cloud/saas/procurement/25c/oaprc/purchase-order-life-cycle.html)
- [Procurement Process Flow & How to Optimize (The 2026 Guide)](https://kissflow.com/procurement/procurement-process/)
- [The 16 Stages of the Procurement Lifecycle - NetSuite](https://www.netsuite.com/portal/resource/articles/accounting/procurement-life-cycle.shtml)

**PO Cancellation Rules:**
- [Cancel a Purchase Requisition or Purchase Order (PO) - Stanford](https://fingate.stanford.edu/purchasing-contracts/how-to/cancel-purchase-requisition-or-purchase-order-po)
- [Canceling a PO vs Closing a PO - Boston University](https://www.bu.edu/sourcing/canceling-a-po-vs-closing-a-po/)
- [Approve and confirm purchase orders - Dynamics 365](https://learn.microsoft.com/en-us/dynamics365/supply-chain/procurement/purchase-order-approval-confirmation)

**Invoice Void Validation:**
- [Void or Reverse an Invoice - Agvance Help Center](https://helpcenter.agvance.net/home/void-reverse-invoice)
- [What Are Reimbursement Receipts and How To Manage Them - Bill.com](https://www.bill.com/learning/reimbursement-receipts)

**3-Way Matching:**
- [What Is Three-Way Matching & Why Is It Important? - NetSuite](https://www.netsuite.com/portal/resource/articles/accounting/three-way-matching.shtml)
- [What's a Three-Way Match in AP & Procurement? - Tradogram](https://www.tradogram.com/blog/three-way-match-accounts-payable)
- [3-Way Invoice Matching in Accounts Payable - DocuWare](https://start.docuware.com/blog/document-management/3-way-invoice-matching)

**Goods Received Notes:**
- [What Is Goods Received Note (GRN): Importance & Best Practices - HighRadius](https://www.highradius.com/resources/Blog/goods-received-note/)
- [Guide to Goods Received Note (GRN) in Procurement - Zycus](https://www.zycus.com/blog/source-to-pay/goods-received-note-procurement)
- [Goods Received Note: Meaning, Importance, and Uses - Tipalti](https://tipalti.com/resources/learn/goods-received-note-explained/)

**PDF Generation:**
- [Top 6 Open-Source PDF Libraries for React Developers](https://blog.react-pdf.dev/6-open-source-pdf-generation-and-modification-libraries-every-react-dev-should-know-in-2025)
- [Building a PDF generation service using Nextjs and React PDF - Medium](https://03balogun.medium.com/building-a-pdf-generation-service-using-nextjs-and-react-pdf-78d5931a13c7)
- [How to Generate Invoice PDF with React.js - Expressa](https://www.expressa.io/blog/generate-invoice-pdf-reactjs)

**Procurement Automation:**
- [Procurement automation best practices for enterprises (2026) - Amazon Business](https://business.amazon.com/en/blog/procurement-automation)
- [Procurement Management System: Complete Guide for 2026 - Zapro](https://zapro.ai/procurement/procurement-management-system/)
- [Real-Time PO Matching - oAppsNet](https://www.oappsnet.com/2026/01/real-time-po-matching-closing-the-loop-between-procurement-and-payables/)

**Status Management:**
- [Purchase order overview - Dynamics 365](https://learn.microsoft.com/en-us/dynamics365/supply-chain/procurement/purchase-order-overview)
- [What do the different PO statuses mean? - ProcurementExpress](https://faq.procurementexpress.com/po-statuses)
- [iO Purchase Order and Invoice Statuses - Rice University](https://procurement.rice.edu/PO-invoice-statuses)

**Locking and Immutability:**
- [Disabling edits in closed issues for Jira tickets - Atlassian](https://support.atlassian.com/jira/kb/disabling-edits-in-closed-issues-for-jira-tickets/)
- [How to automatically lock closed business meetings - Salesforce](https://arakan.blog/en/salesforce-lock-closed-opportunities/)
