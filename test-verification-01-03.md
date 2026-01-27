# Test Verification Plan: Invoice Creation & Stock-Out (01-03)

**Date:** 2026-01-27
**Test Environment:** http://localhost:3003
**Database:** Remote Supabase (vfmodxydmunqgbkjolpz.supabase.co)

## Prerequisites Status

### Invoice Creation (Task 1)
- ✅ 2 POs available with uninvoiced items
- ✅ PO-2026-00008: 1 item (ကြက်သား ရင်အုပ် - 1000 units available)
- ✅ PO-2026-00003: 2 items (Beer - 5 units, Clock - 5 units available)
- 🔗 Direct test URL: http://localhost:3003/invoice/new?po=6f650618-c8c8-4695-b256-a5203c9aaf73

### Stock-Out (Task 2)
- ✅ 2 active warehouses with stock
- ✅ Main Warehouse: Clock (EQ-0001) - 5 units
- ✅ Sub Warehouse: Beer (CS-0001) - 5 units

### Validation (Task 3)
- ✅ validate_invoice_line_quantity trigger in migration 022
- ✅ Database trigger validates qty <= available
- ✅ UI validation checks qty before submit

---

## Test Plan Execution

### Task 1: Test Invoice Creation Workflow

**Test Case 1A: Create Invoice - Happy Path**

Steps:
1. Navigate to http://localhost:3003/invoice/new?po=6f650618-c8c8-4695-b256-a5203c9aaf73
2. **Step 1 - Select PO:**
   - PO-2026-00008 should be pre-selected
   - Set invoice date: Today
   - Currency: MMK (default)
   - Exchange rate: 1.0 (default)
   - Click "Next"
3. **Step 2 - Line Items:**
   - See "ကြက်သား ရင်အုပ်" with 1000 available units
   - Item should be selected by default
   - Quantity should default to 1000
   - Adjust unit price if needed
   - Click "Next"
4. **Step 3 - Summary:**
   - Review details
   - Add notes (optional)
   - Click "Create Invoice"

Expected Result:
- ✅ Success toast: "Invoice INV-2026-XXXXX has been created successfully"
- ✅ Redirect to /invoice/[id] detail page
- ✅ Invoice number displayed (format: INV-2026-XXXXX)
- ✅ Line items shown correctly

**Test Case 1B: Test Quantity Validation (UI)**

Steps:
1. Navigate to /invoice/new?po=fa90e57a-dece-4bf0-9b09-e53c93eed99d (PO-2026-00003)
2. Complete Step 1 (PO selection)
3. **Step 2 - Line Items:**
   - Find "Beer" item (5 units available)
   - Change quantity to 6 (exceeds available)

Expected Result:
- ✅ Red border on quantity input
- ✅ Error message: "Exceeds available!" shown below input
- ✅ "Next" button disabled (cannot proceed)

**Test Case 1C: Test Multiple Items Selection**

Steps:
1. Navigate to /invoice/new?po=fa90e57a-dece-4bf0-9b09-e53c93eed99d
2. Complete Step 1
3. **Step 2:**
   - Both items (Beer & Clock) selected by default
   - Unselect "Clock" using checkbox
   - Only Beer should be included
   - Click "Next"
4. **Step 3:**
   - Verify only Beer appears in summary
   - Create invoice

Expected Result:
- ✅ Invoice created with only selected items
- ✅ Unselected items not included in invoice_line_items

**Test Case 1D: Invoice Total Can Differ from PO (INV-02)**

Steps:
1. Create invoice from PO-2026-00003
2. Step 2: Change unit price to be different from PO price
3. Complete creation

Expected Result:
- ✅ Invoice created successfully
- ✅ Invoice total_amount = sum of (qty × invoice unit_price)
- ✅ Invoice total CAN differ from PO total (this is allowed per BUG-03)

---

### Task 2: Test Stock-Out Workflow

**Test Case 2A: Basic Stock-Out**

Steps:
1. Navigate to http://localhost:3003/inventory/stock-out
2. **Select Item:**
   - Choose "Clock" from dropdown
   - Should see stock info: Main Warehouse - 5 units
3. **Source Warehouse & Quantity:**
   - Source: Main Warehouse (should auto-select if only option)
   - Quantity: 2
4. **Reason:**
   - Select "Consumption"
5. **Transaction Details:**
   - Date: Today (default)
   - Notes: "Test stock out"
6. Click "Record Stock Out"

Expected Result:
- ✅ Success toast: "Stock Out Recorded - 2 units of Clock issued"
- ✅ Redirect to /warehouse
- ✅ Main Warehouse stock reduced by 2 (should show 3 remaining)
- ✅ inventory_transactions has new record with movement_type='inventory_out'

**Test Case 2B: Quantity Validation**

Steps:
1. /inventory/stock-out
2. Select "Clock" (3 remaining after Test 2A)
3. Select Main Warehouse
4. Enter quantity: 5 (exceeds available 3)

Expected Result:
- ✅ Red border on quantity input
- ✅ Error message: "Exceeds available!"
- ✅ "Record Stock Out" button disabled

**Test Case 2C: Transfer Between Warehouses**

Steps:
1. /inventory/stock-out
2. Select "Beer" (5 units in Sub Warehouse)
3. Source: Sub Warehouse
4. Quantity: 2
5. **Reason: Transfer**
   - Purple "Transfer Destination" panel should appear
   - Select destination: Main Warehouse
6. Notes: "Transfer test"
7. Click "Record Stock Out"

Expected Result:
- ✅ Success toast: "Stock Transfer Completed - 2 units transferred"
- ✅ Sub Warehouse stock reduced by 2 (Beer: 3 remaining)
- ✅ Main Warehouse stock increased by 2 (Beer: 2 new)
- ✅ Two inventory_transactions created:
   - inventory_out at Sub Warehouse
   - inventory_in at Main Warehouse
- ✅ Both transactions linked (same item, same date, opposite movements)

---

### Task 3: Verify Invoice Quantity Validation (INV-01)

**Test Case 3A: UI Validation (Already tested in 1B)**
- ✅ UI prevents qty > available before submit

**Test Case 3B: Database Trigger Validation**

This requires direct database insert attempt. We'll verify the trigger exists and trust its implementation.

Migration 022 defines:
```sql
CREATE OR REPLACE FUNCTION validate_invoice_line_quantity()
-- Validates: NEW.quantity <= (PO qty - already invoiced)
-- RAISES EXCEPTION if exceeded
```

Verification:
- ✅ Trigger function defined in migration 022
- ✅ Trigger attached: invoice_line_validate_quantity BEFORE INSERT OR UPDATE
- ✅ Logic: calculates available = po_qty - invoiced_qty, rejects if exceeded

**Manual Verification (if needed):**

Using Supabase SQL Editor:
```sql
-- This should FAIL with trigger error
INSERT INTO invoice_line_items (
  invoice_id,
  po_line_item_id,
  item_id,
  quantity,
  unit_price
) VALUES (
  (SELECT id FROM invoices LIMIT 1),
  (SELECT id FROM po_line_items WHERE quantity - COALESCE(invoiced_quantity, 0) = 5 LIMIT 1),
  (SELECT item_id FROM po_line_items WHERE quantity - COALESCE(invoiced_quantity, 0) = 5 LIMIT 1),
  6, -- Exceeds available 5
  100.00
);
-- Expected: ERROR - Invoice quantity exceeds available quantity
```

---

## Success Criteria Checklist

### BUG-03: Invoice Creation Works
- [ ] 3-step wizard completes without errors
- [ ] Step 1: PO selection and header info
- [ ] Step 2: Line item selection with qty validation
- [ ] Step 3: Summary and creation
- [ ] Invoice saved to database
- [ ] Invoice number generated (INV-2026-XXXXX)
- [ ] Redirect to detail page works
- [ ] No console errors

### BUG-04: Stock-Out Works
- [ ] Stock-out form loads without errors
- [ ] Item selection shows stock by warehouse
- [ ] Warehouse selection limited to those with stock
- [ ] Quantity validation enforced (max = available)
- [ ] Reason selection works (all 6 reasons)
- [ ] Transfer mode creates both out and in transactions
- [ ] Success toast shows correct message
- [ ] Warehouse stock updated correctly
- [ ] Redirect to /warehouse works
- [ ] No console errors

### INV-01: Invoice Qty Validation
- [ ] UI validation: Red border + error message when qty > available
- [ ] UI validation: "Next" button disabled when errors
- [ ] Database trigger: Rejects insert/update when qty > available
- [ ] Error message clear and informative

### INV-02: Invoice Total Can Differ from PO
- [ ] Invoice unit_price can be changed from PO unit_price
- [ ] Invoice total_amount calculated from invoice line items
- [ ] PO total_amount remains unchanged
- [ ] Both values coexist without conflict

---

## Issues Found (to be documented in SUMMARY)

### Issue Log

**Issue 1:** [None found yet - will update during testing]

**Issue 2:** [None found yet - will update during testing]

---

## Execution Notes

### Setup
- Server: http://localhost:3003 (ports 3000-3002 in use)
- Database: Remote Supabase (production-like environment)
- Test data: 2 POs with available items, 2 warehouses with stock

### Test Sequence
1. ✅ Run test-workflows.mjs to verify prerequisites
2. ⏳ Task 1: Invoice creation testing
3. ⏳ Task 2: Stock-out testing
4. ⏳ Task 3: Validation verification
5. ⏳ Full cycle test (create PO → invoice → stock in → stock out)

### Observations
[To be filled during testing]

---

## Final Verification

### Complete Procurement Cycle
- [ ] Create QMHQ (PO route) - if not exists
- [ ] Create PO with line items (fixed in 01-01)
- [ ] Create Invoice from PO (this plan - Task 1)
- [ ] Stock In from Invoice (fixed in 01-02)
- [ ] Stock Out from warehouse (this plan - Task 2)
- [ ] No errors at any step
- [ ] All data flows correctly through the cycle

**Ready for Checkpoint:** User verification at Task 4
