# Deletion Protection Deployment Instructions

## Issue
Migration 057 (deletion protection triggers) was never deployed to production database because it wasn't included in `run_all_migrations.sql`.

## Root Cause
The file `supabase/migrations/057_deletion_protection.sql` exists but was not added to the consolidated `run_all_migrations.sql` file that gets executed in the Supabase SQL Editor.

## Fix Applied
Added migration 057 content to `run_all_migrations.sql` (lines 1064-1450).

## Deployment Steps

### Option 1: Run Full Migration File (RECOMMENDED)
1. Open Supabase SQL Editor: https://supabase.com/dashboard/project/vfmodxydmunqgbkjolpz/sql
2. Open the file: `supabase/migrations/run_all_migrations.sql`
3. Copy the ENTIRE file contents
4. Paste into SQL Editor
5. Click "RUN"
6. Verify no errors in output

**Note:** This is safe to run multiple times because:
- All triggers use `DROP TRIGGER IF EXISTS` before creation
- All functions use `CREATE OR REPLACE FUNCTION`
- All indexes use `CREATE INDEX IF NOT EXISTS`

### Option 2: Run Only Migration 057 (FASTER)
1. Open Supabase SQL Editor: https://supabase.com/dashboard/project/vfmodxydmunqgbkjolpz/sql
2. Open the file: `supabase/migrations/057_deletion_protection.sql`
3. Copy the entire file contents
4. Paste into SQL Editor
5. Click "RUN"
6. Verify no errors in output

## Verification Test Plan

After deployment, test each entity type:

### Test 1: Status Protection
1. Go to `/admin/statuses`
2. Identify a status that's assigned to a QMRL or QMHQ
3. Try to delete it
4. **Expected:** Error toast "Cannot delete: this item is in use"
5. **Before fix:** Status deleted successfully

### Test 2: Category Protection
1. Go to `/admin/categories`
2. Identify a category used by a QMRL, QMHQ, or item
3. Try to delete it
4. **Expected:** Error toast "Cannot delete: this item is in use"
5. **Before fix:** Category deleted successfully

### Test 3: Item Protection
1. Go to `/item`
2. Identify an item that has:
   - QMHQ assignments, OR
   - PO line items, OR
   - Inventory transactions, OR
   - Stock-out requests
3. Try to delete it
4. **Expected:** Error toast "Cannot delete: this item is in use"
5. **Before fix:** Item deleted successfully

### Test 4: Department Protection
1. Go to `/admin/departments`
2. Try to delete a department that has:
   - Active users assigned, OR
   - QMRLs assigned, OR
   - Contact persons assigned
3. **Expected:** Error toast "Cannot delete: this item is in use"
4. **Before fix:** Department deleted successfully

### Test 5: Contact Person Protection
1. Go to `/admin/contacts`
2. Find a contact person assigned to a QMRL or QMHQ
3. Try to delete it
4. **Expected:** Error toast "Cannot delete: this item is in use"
5. **Before fix:** Contact deleted successfully

### Test 6: Supplier Protection
1. Go to `/admin/suppliers`
2. Find a supplier that has active purchase orders
3. Try to delete it
4. **Expected:** Error toast "Cannot delete: this item is in use"
5. **Before fix:** Supplier deleted successfully

### Test 7: Unreferenced Entity (Should Still Work)
1. Create a new test status/category/item that's NOT used anywhere
2. Try to delete it
3. **Expected:** Deletion succeeds with success toast
4. This confirms triggers only block when references exist

## What the Fix Does

The migration creates 6 trigger functions and 6 triggers:

1. **Items:** Checks qmhq, qmhq_items, po_line_items, inventory_transactions, stock_out_line_items
2. **Statuses:** Checks qmrl, qmhq
3. **Categories:** Checks qmrl, qmhq, items
4. **Departments:** Checks users, qmrl, contact_persons
5. **Contact Persons:** Checks qmrl, qmhq
6. **Suppliers:** Checks purchase_orders

All triggers:
- Fire BEFORE UPDATE
- Only when `OLD.is_active = true AND NEW.is_active = false` (soft delete)
- Check for active references (WHERE is_active = true)
- RAISE EXCEPTION with message "Cannot delete: this item is in use"
- Use 'aa_' prefix to fire before audit triggers

## Rollback (if needed)

If issues occur, you can disable triggers:

```sql
-- Disable all deletion protection triggers
DROP TRIGGER IF EXISTS aa_block_item_deactivation ON items;
DROP TRIGGER IF EXISTS aa_block_status_deactivation ON status_config;
DROP TRIGGER IF EXISTS aa_block_category_deactivation ON categories;
DROP TRIGGER IF EXISTS aa_block_department_deactivation ON departments;
DROP TRIGGER IF EXISTS aa_block_contact_person_deactivation ON contact_persons;
DROP TRIGGER IF EXISTS aa_block_supplier_deactivation ON suppliers;
```

## Files Changed
- `/home/yaungni/qm-core/supabase/migrations/run_all_migrations.sql`

## Next Steps After Verification
1. Test all 7 scenarios above
2. If all tests pass, mark debug session as resolved
3. Consider adding E2E tests for deletion protection
4. Document this issue in Phase 29 completion notes
