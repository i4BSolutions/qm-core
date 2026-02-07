---
status: resolved
trigger: "comments-schema-cache"
created: 2026-02-07T00:00:00Z
updated: 2026-02-07T00:00:00Z
---

## Current Focus

hypothesis: Migration 051_comments.sql was not applied to the remote database (only exists in local migration files)
test: Check if migration needs to be pushed to remote Supabase project
expecting: Running migration on remote database will create the table and fix error
next_action: Push migration to remote database using supabase db push

## Symptoms

expected: Comment should be inserted into comments table successfully
actual: Error "cannot find the table public.comments in schema cache"
errors: Schema cache error - table not found
reproduction: Try to add a comment on any detail page (QMRL, QMHQ, PO, Invoice)
started: Started after Phase 23 implementation (comments feature just deployed)

## Eliminated

## Evidence

- timestamp: 2026-02-07T00:01:00Z
  checked: Migration file and types
  found: Migration 051_comments.sql exists and defines comments table correctly. TypeScript types in /types/database.ts already include comments table definition (lines 83-100)
  implication: The migration exists and types are generated. Problem is not missing types.

- timestamp: 2026-02-07T00:02:00Z
  checked: Supabase client configuration
  found: Both browser client (/lib/supabase/client.ts) and server client (/lib/supabase/server.ts) are properly typed with Database type from /types/database.ts
  implication: Client is typed correctly with comments table schema

- timestamp: 2026-02-07T00:03:00Z
  checked: Comment insertion code
  found: CommentInput component (line 40) and CommentsSection (line 29) both use .from("comments") correctly
  implication: Code is using correct table name

- timestamp: 2026-02-07T00:04:00Z
  checked: Docker and local database
  found: Docker daemon is not running. Cannot verify if migration was applied to local database.
  implication: If testing locally, the database may not have the comments table even though migration file exists

- timestamp: 2026-02-07T00:05:00Z
  checked: Error message meaning
  found: "cannot find the table public.comments in schema cache" is a RUNTIME database error, not a TypeScript compilation error. This means the code compiles (types are fine) but the database itself doesn't have the table.
  implication: Migration file exists locally but was never applied to the actual database being used (remote Supabase)

- timestamp: 2026-02-07T00:06:00Z
  checked: Supabase project linkage
  found: Project is linked to vfmodxydmunqgbkjolpz. Migration file 051_comments.sql exists in supabase/migrations/ (created Feb 7 13:59)
  implication: Migration file was created but not pushed to remote database

## Resolution

root_cause: Migration file 051_comments.sql was created locally but never pushed to the remote Supabase database (vfmodxydmunqgbkjolpz). The TypeScript types were manually added to types/database.ts, allowing the code to compile successfully. However, at runtime, when the Supabase client tries to execute INSERT/SELECT on the comments table, the actual database doesn't have this table, causing the "cannot find the table public.comments in schema cache" error.

fix: Apply the migration to remote database using ONE of these methods:

METHOD 1 - Using Supabase CLI (requires credentials):
```bash
# Set database password (get from Supabase dashboard > Settings > Database)
export SUPABASE_DB_PASSWORD=your-db-password

# Push all pending migrations
npx supabase db push
```

METHOD 2 - Using Supabase Dashboard (recommended if CLI access issue):
1. Go to https://supabase.com/dashboard/project/vfmodxydmunqgbkjolpz/sql
2. Copy contents of /Users/thihaaung/qm-core/supabase/migrations/051_comments.sql
3. Paste into SQL Editor and click "Run"

METHOD 3 - Using direct database connection:
```bash
# Get connection string from Supabase dashboard, then:
npx supabase db push --db-url "postgresql://postgres:[PASSWORD]@[HOST]:[PORT]/postgres"
```

verification: After applying migration, test adding a comment on any detail page (QMRL, QMHQ, PO, Invoice) - should succeed without error
files_changed: []
