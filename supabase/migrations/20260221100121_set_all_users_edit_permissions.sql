-- Migration: Set all existing users to Edit on all 16 permissions
-- Reason: All current users should have full Edit access.
--         The original migration assigned role-based permissions (edit/view/block),
--         but the team wants all existing users to start with Edit on everything.
--         New users created via the UI will have admin-configured permissions.

BEGIN;

UPDATE public.user_permissions
SET level = 'edit'::public.permission_level,
    updated_at = NOW()
WHERE level != 'edit';

-- Validation: confirm every user still has exactly 16 rows
DO $$
DECLARE
  user_count    INTEGER;
  perm_count    INTEGER;
  expected      INTEGER;
BEGIN
  SELECT COUNT(*) INTO user_count FROM public.users;
  SELECT COUNT(*) INTO perm_count FROM public.user_permissions;
  expected := user_count * 16;

  IF perm_count != expected THEN
    RAISE EXCEPTION
      'Unexpected permission count: expected % rows (% users × 16), got %.',
      expected, user_count, perm_count;
  END IF;

  RAISE NOTICE 'All permissions set to edit: % users × 16 resources = % rows.',
    user_count, expected;
END $$;

COMMIT;
