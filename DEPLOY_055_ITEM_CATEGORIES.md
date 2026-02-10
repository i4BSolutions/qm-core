# Deploy Migration 055: Item Categories

## Issue
Category selector on Stock-Out Request page (`/inventory/stock-out-requests/new`) is non-functional because the database has no item categories.

## Root Cause
Migrations 017 and 018 were added to `run_all_migrations.sql` but never executed against the production database. The `categories` table is missing rows with `entity_type = 'item'`.

## Fix
Run migration `055_deploy_item_categories.sql` which:
1. Adds `'item'` to the `entity_type` enum (if not exists)
2. Adds `category_id` column to `items` table (if not exists)
3. Seeds 6 default item categories

## Deployment Steps

### Option 1: Supabase CLI (Recommended)
```bash
# From project root
npx supabase db push
```

### Option 2: Supabase Dashboard SQL Editor
1. Open [Supabase Dashboard](https://supabase.com/dashboard)
2. Navigate to **SQL Editor**
3. Create new query
4. Copy entire contents of `supabase/migrations/055_deploy_item_categories.sql`
5. Paste and **Run** the query
6. Check output for verification message: "Item categories created: 6"

## Verification

After deployment, verify the fix:

### 1. Database Check
Run this query in SQL Editor:
```sql
SELECT entity_type, name, color, display_order
FROM categories
WHERE entity_type = 'item'
ORDER BY display_order;
```

Expected result: 6 rows
- Equipment (#3B82F6)
- Consumable (#10B981)
- Uniform (#8B5CF6)
- Office Supplies (#F59E0B)
- Electronics (#EC4899)
- Other (#6B7280)

### 2. UI Check
1. Navigate to `/inventory/stock-out-requests/new`
2. Click the **Category** dropdown (first selector)
3. Verify 6 categories appear
4. Select a category
5. Verify the **Item** dropdown becomes enabled

## Safety
This migration is **idempotent** - safe to run multiple times. It uses `IF NOT EXISTS` checks and `ON CONFLICT DO NOTHING` to prevent errors if already applied.

## Rollback (if needed)
```sql
-- Remove item categories (use with caution)
DELETE FROM categories WHERE entity_type = 'item';

-- Remove item entity type from enum (requires manual ALTER TYPE)
-- Not recommended unless absolutely necessary
```

## Files Changed
- ✅ `supabase/migrations/055_deploy_item_categories.sql` (created)
- ✅ Committed in: 35dbddb

## Status
⚠️ **AWAITING DEPLOYMENT** - Migration committed but not yet executed against production database.
