-- ============================================
-- COMBINED MIGRATIONS 030-033 for QM System V1.1
-- Run this in Supabase Dashboard > SQL Editor
-- ============================================

-- ============================================
-- 030: FILE_ATTACHMENTS TABLE
-- ============================================

CREATE TABLE IF NOT EXISTS public.file_attachments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type TEXT NOT NULL CHECK (entity_type IN ('qmrl', 'qmhq')),
  entity_id UUID NOT NULL,
  filename TEXT NOT NULL,
  storage_path TEXT NOT NULL UNIQUE,
  file_size BIGINT NOT NULL,
  mime_type TEXT NOT NULL,
  uploaded_by UUID NOT NULL REFERENCES public.users(id),
  uploaded_at TIMESTAMPTZ DEFAULT NOW(),
  deleted_at TIMESTAMPTZ,
  deleted_by UUID REFERENCES public.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_file_attachments_entity
  ON public.file_attachments(entity_type, entity_id)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_file_attachments_storage_path
  ON public.file_attachments(storage_path);

CREATE INDEX IF NOT EXISTS idx_file_attachments_uploaded_by
  ON public.file_attachments(uploaded_by);

CREATE OR REPLACE FUNCTION public.update_file_attachments_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at := NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS file_attachments_update_timestamp ON public.file_attachments;
CREATE TRIGGER file_attachments_update_timestamp
  BEFORE UPDATE ON public.file_attachments
  FOR EACH ROW
  EXECUTE FUNCTION public.update_file_attachments_updated_at();

ALTER TABLE public.file_attachments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS file_attachments_select ON public.file_attachments;
DROP POLICY IF EXISTS file_attachments_insert ON public.file_attachments;
DROP POLICY IF EXISTS file_attachments_update ON public.file_attachments;
DROP POLICY IF EXISTS file_attachments_delete ON public.file_attachments;

CREATE POLICY file_attachments_select ON public.file_attachments
  FOR SELECT USING (
    deleted_at IS NULL
    AND (
      public.get_user_role() IN ('admin', 'quartermaster', 'finance', 'inventory', 'proposal', 'frontline')
      OR (
        public.get_user_role() = 'requester'
        AND entity_type = 'qmrl'
        AND public.owns_qmrl(entity_id)
      )
      OR (
        public.get_user_role() = 'requester'
        AND entity_type = 'qmhq'
        AND public.owns_qmhq(entity_id)
      )
    )
  );

CREATE POLICY file_attachments_insert ON public.file_attachments
  FOR INSERT WITH CHECK (
    public.get_user_role() IN ('admin', 'quartermaster')
    OR (
      public.get_user_role() IN ('proposal', 'frontline')
      AND entity_type IN ('qmrl', 'qmhq')
    )
    OR (
      public.get_user_role() = 'requester'
      AND entity_type = 'qmrl'
      AND public.owns_qmrl(entity_id)
    )
  );

CREATE POLICY file_attachments_update ON public.file_attachments
  FOR UPDATE USING (
    public.get_user_role() IN ('admin', 'quartermaster')
  );

CREATE POLICY file_attachments_delete ON public.file_attachments
  FOR DELETE USING (
    public.get_user_role() = 'admin'
  );

-- ============================================
-- 031: STORAGE BUCKET AND RLS
-- ============================================

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'attachments',
  'attachments',
  false,
  26214400,
  ARRAY[
    'image/jpeg',
    'image/png',
    'image/gif',
    'image/webp',
    'application/pdf',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'application/msword',
    'application/vnd.ms-excel',
    'application/vnd.ms-powerpoint'
  ]
)
ON CONFLICT (id) DO UPDATE SET
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS storage_attachments_select ON storage.objects;
DROP POLICY IF EXISTS storage_attachments_insert ON storage.objects;
DROP POLICY IF EXISTS storage_attachments_update ON storage.objects;
DROP POLICY IF EXISTS storage_attachments_delete ON storage.objects;

CREATE POLICY storage_attachments_select ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'attachments'
    AND EXISTS (
      SELECT 1 FROM public.file_attachments fa
      WHERE fa.storage_path = name
        AND fa.deleted_at IS NULL
        AND (
          public.get_user_role() IN ('admin', 'quartermaster', 'finance', 'inventory', 'proposal', 'frontline')
          OR (
            public.get_user_role() = 'requester'
            AND fa.entity_type = 'qmrl'
            AND public.owns_qmrl(fa.entity_id)
          )
          OR (
            public.get_user_role() = 'requester'
            AND fa.entity_type = 'qmhq'
            AND public.owns_qmhq(fa.entity_id)
          )
        )
    )
  );

CREATE POLICY storage_attachments_insert ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'attachments'
    AND (
      public.get_user_role() IN ('admin', 'quartermaster')
      OR (
        public.get_user_role() IN ('proposal', 'frontline')
        AND (storage.foldername(name))[1] IN ('qmrl', 'qmhq')
      )
      OR (
        public.get_user_role() = 'requester'
        AND (storage.foldername(name))[1] = 'qmrl'
        AND public.owns_qmrl(((storage.foldername(name))[2])::uuid)
      )
    )
  );

CREATE POLICY storage_attachments_update ON storage.objects
  FOR UPDATE TO authenticated
  USING (
    bucket_id = 'attachments'
    AND public.get_user_role() IN ('admin', 'quartermaster')
  );

CREATE POLICY storage_attachments_delete ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'attachments'
    AND public.get_user_role() IN ('admin', 'quartermaster')
  );

-- ============================================
-- 032: CASCADE CLEANUP FUNCTIONS
-- ============================================

CREATE OR REPLACE FUNCTION public.cascade_soft_delete_files()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.is_active = true AND NEW.is_active = false THEN
    UPDATE public.file_attachments
    SET
      deleted_at = NOW(),
      deleted_by = auth.uid(),
      updated_at = NOW()
    WHERE
      entity_type = TG_ARGV[0]
      AND entity_id = NEW.id
      AND deleted_at IS NULL;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS qmrl_cascade_soft_delete_files ON public.qmrl;
CREATE TRIGGER qmrl_cascade_soft_delete_files
  AFTER UPDATE OF is_active ON public.qmrl
  FOR EACH ROW
  EXECUTE FUNCTION public.cascade_soft_delete_files('qmrl');

DROP TRIGGER IF EXISTS qmhq_cascade_soft_delete_files ON public.qmhq;
CREATE TRIGGER qmhq_cascade_soft_delete_files
  AFTER UPDATE OF is_active ON public.qmhq
  FOR EACH ROW
  EXECUTE FUNCTION public.cascade_soft_delete_files('qmhq');

CREATE OR REPLACE FUNCTION public.get_expired_file_paths()
RETURNS TABLE(id UUID, storage_path TEXT) AS $$
BEGIN
  RETURN QUERY
  SELECT fa.id, fa.storage_path
  FROM public.file_attachments fa
  WHERE fa.deleted_at IS NOT NULL
    AND fa.deleted_at < NOW() - INTERVAL '30 days';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.purge_expired_file_metadata()
RETURNS INTEGER AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  DELETE FROM public.file_attachments
  WHERE deleted_at IS NOT NULL
    AND deleted_at < NOW() - INTERVAL '30 days';
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.cascade_soft_delete_files() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_expired_file_paths() TO authenticated;
GRANT EXECUTE ON FUNCTION public.purge_expired_file_metadata() TO authenticated;

-- ============================================
-- 033: DASHBOARD RPC FUNCTIONS
-- ============================================

CREATE OR REPLACE FUNCTION public.get_qmrl_status_counts()
RETURNS TABLE(
  status_group text,
  count bigint
) AS $$
  SELECT
    sc.status_group::text,
    COUNT(q.id) as count
  FROM public.status_config sc
  LEFT JOIN public.qmrl q ON q.status_id = sc.id AND q.is_active = true
  WHERE sc.entity_type = 'qmrl' AND sc.is_active = true
  GROUP BY sc.status_group
  ORDER BY
    CASE sc.status_group
      WHEN 'to_do' THEN 1
      WHEN 'in_progress' THEN 2
      WHEN 'done' THEN 3
    END;
$$ LANGUAGE sql STABLE SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.get_qmhq_status_counts()
RETURNS TABLE(
  status_group text,
  count bigint
) AS $$
  SELECT
    sc.status_group::text,
    COUNT(q.id) as count
  FROM public.status_config sc
  LEFT JOIN public.qmhq q ON q.status_id = sc.id AND q.is_active = true
  WHERE sc.entity_type = 'qmhq' AND sc.is_active = true
  GROUP BY sc.status_group
  ORDER BY
    CASE sc.status_group
      WHEN 'to_do' THEN 1
      WHEN 'in_progress' THEN 2
      WHEN 'done' THEN 3
    END;
$$ LANGUAGE sql STABLE SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.get_low_stock_alerts(threshold integer DEFAULT 10)
RETURNS TABLE(
  item_id uuid,
  item_name text,
  item_sku text,
  warehouse_id uuid,
  warehouse_name text,
  current_stock numeric,
  severity text
) AS $$
  WITH stock_levels AS (
    SELECT
      it.item_id,
      it.warehouse_id,
      SUM(CASE WHEN it.movement_type = 'inventory_in' THEN it.quantity ELSE 0 END) -
      SUM(CASE WHEN it.movement_type = 'inventory_out' THEN it.quantity ELSE 0 END) as stock
    FROM public.inventory_transactions it
    WHERE it.status = 'completed' AND it.is_active = true
    GROUP BY it.item_id, it.warehouse_id
  )
  SELECT
    i.id as item_id,
    i.name as item_name,
    i.sku as item_sku,
    w.id as warehouse_id,
    w.name as warehouse_name,
    sl.stock as current_stock,
    CASE
      WHEN sl.stock = 0 THEN 'out_of_stock'
      WHEN sl.stock <= 4 THEN 'critical'
      WHEN sl.stock <= threshold THEN 'warning'
      ELSE 'normal'
    END as severity
  FROM stock_levels sl
  JOIN public.items i ON i.id = sl.item_id
  JOIN public.warehouses w ON w.id = sl.warehouse_id
  WHERE sl.stock <= threshold AND i.is_active = true AND w.is_active = true
  ORDER BY
    CASE
      WHEN sl.stock = 0 THEN 1
      WHEN sl.stock <= 4 THEN 2
      ELSE 3
    END,
    i.name;
$$ LANGUAGE sql STABLE SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.get_qmrl_status_counts() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_qmhq_status_counts() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_low_stock_alerts(integer) TO authenticated;

-- ============================================
-- DONE! All migrations applied.
-- ============================================
