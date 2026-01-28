# Feature Landscape: Inventory Transaction Dashboards & WAC Display

**Domain:** Inventory management transaction visibility and financial accuracy
**Researched:** 2026-01-28
**Context:** v1.2 milestone adding enhanced inventory visibility to existing QM System

## Table Stakes

Features users expect in inventory transaction management systems. Missing these = incomplete feature.

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Transaction history list | Core audit requirement - all inventory systems show transaction logs | Low | Already exists in system, enhancing to dashboard view |
| Date range filtering | Standard in all financial/inventory systems - users need historical views | Low | WebSearch: Industry standard for transaction queries |
| Transaction type grouping | Separate stock-in from stock-out for clarity | Low | Follows existing QMRL/QMHQ status grouping pattern |
| Total value calculations | Financial systems always show aggregate values alongside counts | Medium | Requires SUM aggregation with EUSD conversion |
| Per-warehouse filtering | Multi-location businesses need location-specific views | Low | Existing warehouse structure supports this |
| WAC display per item | When showing inventory value, users expect cost basis | Medium | WAC already calculated, needs per-warehouse breakdown |
| Transaction count KPIs | Dashboard KPIs show volume (not just value) | Low | Simple COUNT aggregation |
| Real-time/frequent refresh | Users expect current data for operational decisions | Low | Existing useInterval pattern from dashboard |
| View-only transaction details | Click transaction to see full details (audit integrity) | Low | Follows existing modal pattern from money in/out |
| Date consistency (DD/MM/YYYY) | Once set, all dates should follow same format | Low | v1.1 established DD/MM/YYYY, now extending to money in/out |
| Multi-currency stock-in | International operations need to record costs in local currency | Medium | Similar to existing PO/Invoice currency handling |
| Exchange rate in manual stock-in | Currency conversion requires exchange rate input | Low | Pattern exists in financial transactions |

## Differentiators

Features that set product apart. Not expected, but highly valued.

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Invoice void cascade recalculation | Automatic financial accuracy - competitors often require manual reconciliation | High | WebSearch: Modern systems use continuous weighted average engines for real-time updates |
| Warehouse inventory breakdown with WAC | Per-item valuation by location - most systems only show aggregate | Medium | Creates transparency for multi-warehouse operations |
| Stock movement reason tracking | Visibility into why items moved (consumption, damage, transfer) - aids inventory optimization | Low | Already exists, exposing in dashboard view |
| Balance in Hand recalculation on void | PO route financials auto-update when invoice voided | Medium | Maintains financial integrity automatically |
| Transaction source linking | Show which invoice/PO triggered stock movement | Low | Relationship exists, exposing in UI |
| EUSD alongside all values | Normalized currency for international comparison | Low | Already project standard, maintaining consistency |
| User audit trail in transactions | Who created each transaction, with full history | Low | Existing audit system, exposing in transaction view |
| Warehouse transfer visibility | Dedicated view for inter-warehouse movements | Low | Reason='transfer' already captured |
| Low stock alerts with transaction context | Alerts link to recent out transactions | Medium | Dashboard already has alerts, adding context |
| Total value EUSD dashboard card | Normalized view of total inventory worth | Low | Powerful for international operations |

## Anti-Features

Features to explicitly NOT build. Common mistakes in this domain.

| Anti-Feature | Why Avoid | What to Do Instead |
|--------------|-----------|-------------------|
| Transaction editing post-creation | Breaks audit integrity, creates reconciliation nightmares | View-only with void/reversal pattern for invoices |
| Real-time WebSocket updates | Overkill for inventory - 30s polling sufficient, adds complexity | Continue useInterval pattern from v1.1 |
| Per-item low stock thresholds | Over-configuration burden, rarely maintained | Global threshold (10 units) with dashboard visibility |
| Manual WAC adjustment | Invites financial manipulation, breaks traceability | WAC auto-calculated from stock-in unit costs only |
| Transaction deletion | Audit trail gaps, regulatory issues | Soft-delete with is_active flag (existing pattern) |
| Batch transaction editing | Complex UI, high error risk | Individual transactions only |
| Custom dashboard layouts | Maintenance burden, role-based views sufficient | Fixed dashboard per role (Admin/Quartermaster) |
| Export to Excel with formulas | Security risk, version control nightmare | Export as static CSV if needed (future) |
| Stock alerts via email/SMS | Infrastructure overhead, notification fatigue | In-dashboard alerts sufficient for internal tool |
| Predictive inventory analytics | V1 scope creep - get transaction visibility right first | Consider for v2+ after usage patterns emerge |
| Inter-warehouse transfer approval workflow | Over-process for internal tool | Direct transfer with reason and audit log |
| Multi-step invoice void | Slows correction, creates process friction | Single void action with reason (keep simple) |

## Feature Dependencies

### Existing Foundation (Already Built in v1.0/v1.1)
```
WAC Valuation (v1.0)
  ↓
Inventory Transactions (v1.0)
  ↓
Warehouse Structure (v1.0)
  ↓
Audit Logging (v1.0)
  ↓
Dashboard Pattern (v1.1)
  ↓
Role-Based Access (v1.0)
```

### V1.2 New Features Build Order
```
Transaction Date Picker Fix (standalone)
  ↓
Stock In/Out Dashboard
  ├─→ Transaction Counts
  ├─→ Total Values (EUSD)
  ├─→ Date Range Filtering
  └─→ Warehouse Filtering
  ↓
Warehouse Detail Enhancement
  ├─→ Per-Item WAC Display
  └─→ Stock Movement by Item
  ↓
Manual Stock-In Enhancement
  ├─→ Currency Selection
  ├─→ Exchange Rate Input
  └─→ WAC Recalculation
  ↓
Invoice Void Cascade
  ├─→ PO Status Recalculation
  ├─→ Balance in Hand Update
  ├─→ WAC Recalculation (if stock-in voided)
  └─→ Transaction Audit Log
```

## MVP Recommendation

For v1.2 milestone, prioritize these in order:

### Phase 1: Transaction Visibility (Foundation)
1. **Transaction date picker consistency** - Low-hanging fruit, completes v1.1 standardization
2. **Stock in/out dashboard** - Core visibility feature
   - Transaction list with date range filter
   - Warehouse filter
   - Type grouping (in/out)
   - Basic KPI cards (counts, values)

### Phase 2: Detailed Views (Insight)
3. **Warehouse detail enhancement** - Per-item WAC breakdown
   - Table showing each item in warehouse
   - Current stock, WAC amount, WAC currency, EUSD value
   - Link to item detail page
4. **Manual stock-in currency** - Multi-currency support
   - Currency dropdown (existing currencies from system)
   - Exchange rate input (4 decimals)
   - EUSD calculation display
   - WAC factors in converted cost

### Phase 3: Financial Accuracy (Integrity)
5. **Invoice void cascade** - Critical for financial accuracy
   - Void invoice triggers:
     - PO status recalculation (smart status engine)
     - Balance in Hand update (restore committed amount)
     - Stock-in reversal consideration (if goods received)
   - Audit log for cascade effects
   - Admin/Finance role only

## Defer to Post-V1.2

Features that are valuable but not critical for this milestone:

- **Stock movement analytics** - Trends over time, velocity calculations
  - Reason: Get basic visibility working first, analytics are enhancement
- **Advanced filtering** - User, reason, source entity filtering
  - Reason: Date + warehouse sufficient for v1.2
- **CSV export** - Download transaction history
  - Reason: Internal tool, dashboard view sufficient
- **Warehouse transfer workflow** - Dedicated inter-warehouse UI
  - Reason: Current reason='transfer' works, low volume
- **Item reorder suggestions** - Based on consumption patterns
  - Reason: Requires historical data analysis
- **Stock value snapshots** - Point-in-time inventory valuation
  - Reason: Complex feature, current WAC sufficient
- **Void reason categorization** - Structured reasons beyond free text
  - Reason: Simple void_reason text field works for v1

## Complexity Assessment

| Feature Category | Overall Complexity | Risk Factors |
|------------------|-------------------|--------------|
| Transaction Dashboard | Low-Medium | Aggregation queries may be slow on large datasets |
| Warehouse Detail WAC | Medium | JOIN complexity across items, warehouses, transactions |
| Multi-Currency Stock-In | Low | Pattern already exists in PO/Invoice |
| Invoice Void Cascade | High | Multiple dependent calculations, edge cases, atomicity |

### High-Risk Areas (Need Deeper Research in Phase Planning)

1. **Invoice Void Cascade Logic**
   - What if goods already received? Reverse inventory or just financials?
   - What if PO has multiple invoices and one is voided?
   - What if invoice void affects WAC of items already issued out?
   - Transaction atomicity - all calculations must succeed or roll back
   - Audit log should capture before/after states for transparency

2. **WAC Recalculation Performance**
   - Per-warehouse WAC requires aggregate calculation on each page load
   - May need materialized view or cached calculation for large inventories
   - Test with 1000+ items across 10+ warehouses

3. **Date Range Query Performance**
   - Transaction history may grow large (10K+ transactions)
   - Indexes on transaction_date critical
   - Consider pagination beyond simple limit/offset

## Sources

Research conducted 2026-01-28 using WebSearch and official documentation:

### Dashboard Best Practices
- [11 Most Important Inventory Management KPIs in 2026 | MRPeasy](https://www.mrpeasy.com/blog/inventory-management-kpis/)
- [Inventory dashboards | Microsoft Learn](https://learn.microsoft.com/en-us/dynamics365/intelligent-order-management/inventory-dashboards)
- [6 Ways Inventory Dashboards Maximize Visibility & Profitability | NetSuite](https://www.netsuite.com/portal/resource/articles/inventory-management/6-ways-inventory-dashboards-maximize-visibility-profitability.shtml)
- [Inventory Dashboard Example | Geckoboard](https://www.geckoboard.com/dashboard-examples/operations/inventory-dashboard/)

### WAC Valuation Display
- [Weighted Average Cost - Accounting Inventory Valuation Method](https://corporatefinanceinstitute.com/resources/accounting/weighted-average-cost-method/)
- [Weighted Average Costs (WAC) in Inventory Valuation – Uphance](https://www.uphance.com/blog/weighted-average-costs-wac/)
- [What is Weighted Average Cost (WAC)? — Katana](https://katanamrp.com/blog/weighted-average-cost/)
- [WAC:: Knowledge Base | Zoho Inventory](https://www.zoho.com/us/inventory/kb/items/inventory-wac-report.html)

### Cascade Recalculation Patterns
- [Cascade Update of Cost on Inventory Transactions](https://ifs-train.westsidecorporation.com/ifsdoc/documentation/en/MaintainInventory/AboutCascadeUpdateofInvTrans.htm)
- [Invoice Inventory Software: How to Streamline Billing and Stock Management](https://www.handifox.com/handifox-blog/invoice-inventory-software-2026)
- [Inventory close - Supply Chain Management | Dynamics 365 | Microsoft Learn](https://learn.microsoft.com/en-us/dynamics365/supply-chain/cost-management/inventory-close)
- [Navigating Inventory Recalculation in D365 F&O: Insights and Best Practices](https://www.d365withbrittany.com/blog/navigating-inventory-recalculation-in-d365-fo-insights-and-best-practices)

### Transaction History UI Patterns
- [Inventory Movement Report: Guide in 2026](https://www.hashmicro.com/blog/inventory-movement-report/)
- [Where to find stock movement history | Katana](https://support.katanamrp.com/en/articles/5966097-where-to-find-stock-movement-history)
- [How to view the movement or transaction history for products - inFlow Inventory](https://www.inflowinventory.com/support/cloud/how-do-i-see-the-movement-or-transaction-history/)
- [Inventory Management Dashboard | UI Bakery templates](https://uibakery.io/templates/inventory-management-dashboard)

### Audit Trail Best Practices
- [What Is an Audit Trail? Everything You Need to Know](https://auditboard.com/blog/what-is-an-audit-trail)
- [Payments with Audit Trails Guide 2026 | InfluenceFlow](https://influenceflow.io/resources/payments-with-audit-trails-complete-guide-for-2026/)
- [Audit Trail: Audit Trails: Tracking Your Inventory's Journey - FasterCapital](https://www.fastercapital.com/content/Audit-Trail--Audit-Trails--Tracking-Your-Inventory-s-Journey.html)
- [How the Inventory Audit Trail Works – Quartzy Support](https://support.quartzy.com/hc/en-us/articles/26276073436955-How-the-Inventory-Audit-Trail-Works)

### Multi-Currency Inventory
- [Best Inventory Management Software with Multi-Currency 2025 | GetApp](https://www.getapp.com/operations-management-software/inventory-management/f/multi-currency/)
- [Multi-Currency Accounting and Inventory Software](https://www.bluelinkerp.com/blog/why-multi-currency-accounting-and-inventory-software-is-critical-for-global-growth/)
- [5 Best Multi-Currency Reporting Tools for SMEs in 2026](https://giddh.com/blog/multi-currency-reporting-tools-smes)

### Invoice Void Best Practices
- [Best Practice: Voiding invoices](https://portal.paladinpos.com/knowledge-base/best-practice-voiding-invoices/)
- [Invoice Reconciliation: What It Is and How to Do It Right](https://precoro.com/blog/invoice-reconciliation/)
- [Inventory Valuation Methods: Complete Guide to FIFO, LIFO, and Weighted Average](https://www.finaleinventory.com/accounting-and-inventory-software/inventory-valuation-methods)

### Warehouse-Specific Reporting
- [Inventory and warehouse reports and analytics - Business Central | Microsoft Learn](https://learn.microsoft.com/en-us/dynamics365/business-central/inventory-wms-reports)
- [5 Essential Warehouse Management Reports | Top 10 Guides - Zoho Inventory](https://www.zoho.com/us/inventory/essential-warehouse-management-reports/)
- [Inventory by Warehouse Summary - Sellercloud Help](https://help.sellercloud.com/omnichannel-ecommerce/inventory-by-warehouse-summary/)

## Confidence Assessment

| Area | Level | Reason |
|------|-------|--------|
| Dashboard KPIs | HIGH | Multiple authoritative sources (Microsoft, NetSuite, MRPeasy) confirm standard patterns |
| WAC Display | HIGH | Accounting standards and multiple inventory systems document this clearly |
| Transaction History UI | MEDIUM | WebSearch found patterns, but specific implementation varies |
| Cascade Recalculation | MEDIUM | Microsoft D365 and IFS document patterns, but edge cases need phase-specific research |
| Multi-Currency Stock-In | HIGH | Similar to existing PO/Invoice pattern, well-documented |
| Date Filtering | HIGH | Standard SQL/database pattern, widely implemented |

## Open Questions for Phase Planning

When planning specific phases, investigate:

1. **Invoice Void Edge Cases**
   - If invoice is voided but goods already received, do we reverse stock-in?
   - If items from voided invoice were already issued out, what happens to WAC?
   - Should void require reason categorization (error/duplicate/cancelled order)?

2. **Performance Optimization**
   - At what transaction volume does aggregation become slow?
   - Should we pre-calculate warehouse totals in materialized view?
   - Index strategy for transaction_date range queries?

3. **Currency Handling in Manual Stock-In**
   - Which currencies should be available? (All from system or predefined list?)
   - Should exchange rate auto-populate from recent transactions?
   - Validation: exchange rate must be > 0?

4. **Transaction Modal Details**
   - What fields to show in view-only transaction detail?
   - Show related entities (invoice, PO, item)?
   - Include audit log within modal or separate tab?
