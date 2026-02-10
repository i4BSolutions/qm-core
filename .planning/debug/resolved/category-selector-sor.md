---
status: resolved
trigger: "category-selector-sor - User cannot select a category in the item category selector (CategoryItemSelector component) on the New Stock-Out Request page"
created: 2026-02-10T00:00:00Z
updated: 2026-02-10T00:06:00Z
---

## Current Focus

hypothesis: Fix applied - migrations 017 and 018 added to run_all_migrations.sql
test: Deploy migration and verify item categories appear in the selector
expecting: CategoryItemSelector will show 6 item categories (Equipment, Consumable, Uniform, Office Supplies, Electronics, Other)
next_action: Push migration to remote and verify in production

## Symptoms

expected: User should be able to select a category from the CategoryItemSelector, which then filters items within that category for selection
actual: Category selection does not work — user cannot select a category
errors: No specific error messages reported — it's a UI interaction failure
reproduction: Go to /inventory/stock-out-requests/new and try to select a category in the CategoryItemSelector component
started: This is a newly built page from Phase 28. May never have worked correctly

## Eliminated

## Evidence

- timestamp: 2026-02-10T00:01:00Z
  checked: Stock-out request page and CategoryItemSelector component
  found: CategoryItemSelector queries categories table with `entity_type = 'item'` (line 122)
  implication: Need to verify if entity_type enum includes 'item'

- timestamp: 2026-02-10T00:02:00Z
  checked: Database migrations 003_status_config.sql, 004_categories.sql, 007_items.sql, 017_item_categories.sql
  found: Migration 017 adds 'item' to entity_type enum and adds category_id column to items table. Migration 018_item_categories_seed.sql adds 6 default item categories.
  implication: Need to verify if these migrations are in run_all_migrations.sql

- timestamp: 2026-02-10T00:03:00Z
  checked: run_all_migrations.sql for migration 017 and 018 content
  found: Neither "ADD VALUE 'item'" nor the item category seed data ("Equipment.*Tools, machinery") exist in run_all_migrations.sql
  implication: Migrations 017 and 018 have NOT been included in run_all_migrations.sql, so they were never deployed to production

## Resolution

root_cause: Migrations 017_item_categories.sql and 018_item_categories_seed.sql exist but are NOT included in run_all_migrations.sql. The database has no item categories (entity_type='item'), so CategoryItemSelector loads an empty array and displays no options to select.

fix: Added migrations 017 and 018 content to run_all_migrations.sql:
- ALTER TYPE entity_type ADD VALUE 'item'
- ALTER TABLE items ADD COLUMN category_id UUID REFERENCES categories(id)
- INSERT 6 default item categories (Equipment, Consumable, Uniform, Office Supplies, Electronics, Other)

verification: Migration file updated. Needs to be deployed via Supabase CLI or CI/CD pipeline. After deployment, verify item categories appear in selector at /inventory/stock-out-requests/new

files_changed: [supabase/migrations/run_all_migrations.sql]
