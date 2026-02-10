-- ============================================================
-- QM System - Combined Database Migrations
-- Run this file in Supabase SQL Editor
-- https://supabase.com/dashboard/project/vfmodxydmunqgbkjolpz/sql
-- ============================================================

-- ============================================================
-- Migration 001: Departments
-- ============================================================

CREATE TABLE IF NOT EXISTS public.departments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  parent_id UUID REFERENCES public.departments(id) ON DELETE SET NULL,
  description TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT departments_name_unique UNIQUE (name)
);

CREATE INDEX IF NOT EXISTS idx_departments_parent ON public.departments(parent_id);
CREATE INDEX IF NOT EXISTS idx_departments_active ON public.departments(is_active) WHERE is_active = true;

-- Updated_at trigger function (reusable)
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_departments_updated_at ON public.departments;
CREATE TRIGGER trg_departments_updated_at
  BEFORE UPDATE ON public.departments
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Seed default departments
INSERT INTO public.departments (name, description) VALUES
  ('Headquarters', 'Main headquarters'),
  ('Field Operations', 'Field operations department'),
  ('Finance', 'Finance and accounting'),
  ('Logistics', 'Supply chain and logistics'),
  ('Administration', 'Administrative department')
ON CONFLICT (name) DO NOTHING;

-- ============================================================
-- Migration 002: Users
-- ============================================================

-- Create role enum type
DO $$ BEGIN
  CREATE TYPE public.user_role AS ENUM (
    'admin',
    'quartermaster',
    'finance',
    'inventory',
    'proposal',
    'frontline',
    'requester'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- Users table
CREATE TABLE IF NOT EXISTS public.users (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT UNIQUE NOT NULL,
  full_name TEXT NOT NULL,
  role public.user_role NOT NULL DEFAULT 'requester',
  department_id UUID REFERENCES public.departments(id) ON DELETE SET NULL,
  phone TEXT,
  avatar_url TEXT,
  is_active BOOLEAN DEFAULT true,
  created_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  updated_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_users_email ON public.users(email);
CREATE INDEX IF NOT EXISTS idx_users_role ON public.users(role);
CREATE INDEX IF NOT EXISTS idx_users_department ON public.users(department_id);
CREATE INDEX IF NOT EXISTS idx_users_active ON public.users(is_active) WHERE is_active = true;

DROP TRIGGER IF EXISTS trg_users_updated_at ON public.users;
CREATE TRIGGER trg_users_updated_at
  BEFORE UPDATE ON public.users
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Add audit columns to departments
ALTER TABLE public.departments
  ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS updated_by UUID REFERENCES public.users(id) ON DELETE SET NULL;

-- Function to handle new user signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.users (id, email, full_name, role)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
    'requester'
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- Helper functions for RLS
CREATE OR REPLACE FUNCTION public.get_user_role()
RETURNS public.user_role AS $$
  SELECT role FROM public.users WHERE id = auth.uid();
$$ LANGUAGE sql SECURITY DEFINER STABLE;

CREATE OR REPLACE FUNCTION public.has_role(required_role public.user_role)
RETURNS BOOLEAN AS $$
DECLARE
  user_role public.user_role;
BEGIN
  SELECT role INTO user_role FROM public.users WHERE id = auth.uid();

  CASE user_role
    WHEN 'admin' THEN RETURN true;
    WHEN 'quartermaster' THEN
      RETURN required_role IN ('quartermaster', 'finance', 'inventory', 'proposal', 'frontline', 'requester');
    WHEN 'finance' THEN
      RETURN required_role IN ('finance', 'requester');
    WHEN 'inventory' THEN
      RETURN required_role IN ('inventory', 'requester');
    WHEN 'proposal' THEN
      RETURN required_role IN ('proposal', 'frontline', 'requester');
    WHEN 'frontline' THEN
      RETURN required_role IN ('frontline', 'requester');
    WHEN 'requester' THEN
      RETURN required_role = 'requester';
    ELSE RETURN false;
  END CASE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- ============================================================
-- Migration 003: Status Config
-- ============================================================

DO $$ BEGIN
  CREATE TYPE public.entity_type AS ENUM ('qmrl', 'qmhq');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE public.status_group AS ENUM ('to_do', 'in_progress', 'done');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS public.status_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type public.entity_type NOT NULL,
  status_group public.status_group NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  color TEXT,
  display_order INTEGER DEFAULT 0,
  is_default BOOLEAN DEFAULT false,
  is_active BOOLEAN DEFAULT true,
  created_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  updated_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT status_config_entity_name_unique UNIQUE (entity_type, name)
);

CREATE INDEX IF NOT EXISTS idx_status_config_entity ON public.status_config(entity_type, is_active);
CREATE INDEX IF NOT EXISTS idx_status_config_group ON public.status_config(entity_type, status_group);
CREATE INDEX IF NOT EXISTS idx_status_config_default ON public.status_config(entity_type, is_default) WHERE is_default = true;

DROP TRIGGER IF EXISTS trg_status_config_updated_at ON public.status_config;
CREATE TRIGGER trg_status_config_updated_at
  BEFORE UPDATE ON public.status_config
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Ensure single default status
CREATE OR REPLACE FUNCTION public.ensure_single_default_status()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.is_default = true THEN
    UPDATE public.status_config
    SET is_default = false
    WHERE entity_type = NEW.entity_type
      AND status_group = NEW.status_group
      AND id != NEW.id
      AND is_default = true;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_status_config_single_default ON public.status_config;
CREATE TRIGGER trg_status_config_single_default
  BEFORE INSERT OR UPDATE ON public.status_config
  FOR EACH ROW
  WHEN (NEW.is_default = true)
  EXECUTE FUNCTION public.ensure_single_default_status();

-- Seed QMRL statuses
INSERT INTO public.status_config (entity_type, status_group, name, description, color, display_order, is_default) VALUES
  ('qmrl', 'to_do', 'Draft', 'Initial draft state', '#9CA3AF', 1, true),
  ('qmrl', 'to_do', 'Pending Review', 'Awaiting review', '#F59E0B', 2, false),
  ('qmrl', 'in_progress', 'Under Processing', 'Being processed', '#3B82F6', 3, false),
  ('qmrl', 'in_progress', 'Awaiting Approval', 'Pending final approval', '#8B5CF6', 4, false),
  ('qmrl', 'done', 'Completed', 'Successfully completed', '#10B981', 5, false),
  ('qmrl', 'done', 'Rejected', 'Request rejected', '#EF4444', 6, false)
ON CONFLICT (entity_type, name) DO NOTHING;

-- Seed QMHQ statuses
INSERT INTO public.status_config (entity_type, status_group, name, description, color, display_order, is_default) VALUES
  ('qmhq', 'to_do', 'Not Started', 'Not yet started', '#9CA3AF', 1, true),
  ('qmhq', 'to_do', 'Pending', 'Pending action', '#F59E0B', 2, false),
  ('qmhq', 'in_progress', 'Processing', 'Being processed', '#3B82F6', 3, false),
  ('qmhq', 'in_progress', 'Awaiting Delivery', 'Waiting for delivery', '#8B5CF6', 4, false),
  ('qmhq', 'done', 'Completed', 'Successfully completed', '#10B981', 5, false),
  ('qmhq', 'done', 'Cancelled', 'Cancelled', '#EF4444', 6, false)
ON CONFLICT (entity_type, name) DO NOTHING;

CREATE OR REPLACE FUNCTION public.get_default_status_id(p_entity_type public.entity_type)
RETURNS UUID AS $$
  SELECT id FROM public.status_config
  WHERE entity_type = p_entity_type
    AND is_default = true
    AND is_active = true
  LIMIT 1;
$$ LANGUAGE sql STABLE;

-- ============================================================
-- Migration 004: Categories
-- ============================================================

CREATE TABLE IF NOT EXISTS public.categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type public.entity_type NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  color TEXT,
  display_order INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  updated_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT categories_entity_name_unique UNIQUE (entity_type, name)
);

CREATE INDEX IF NOT EXISTS idx_categories_entity ON public.categories(entity_type, is_active);
CREATE INDEX IF NOT EXISTS idx_categories_display_order ON public.categories(entity_type, display_order);

DROP TRIGGER IF EXISTS trg_categories_updated_at ON public.categories;
CREATE TRIGGER trg_categories_updated_at
  BEFORE UPDATE ON public.categories
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Seed QMRL categories
INSERT INTO public.categories (entity_type, name, description, color, display_order) VALUES
  ('qmrl', 'Operations', 'Operational requests', '#3B82F6', 1),
  ('qmrl', 'Logistics', 'Logistics and supply chain', '#10B981', 2),
  ('qmrl', 'Equipment', 'Equipment requests', '#F59E0B', 3),
  ('qmrl', 'Personnel', 'Personnel related requests', '#8B5CF6', 4),
  ('qmrl', 'Emergency', 'Emergency requests', '#EF4444', 5)
ON CONFLICT (entity_type, name) DO NOTHING;

-- Seed QMHQ categories
INSERT INTO public.categories (entity_type, name, description, color, display_order) VALUES
  ('qmhq', 'Purchase', 'Purchase items', '#3B82F6', 1),
  ('qmhq', 'Service', 'Service requests', '#10B981', 2),
  ('qmhq', 'Travel', 'Travel expenses', '#F59E0B', 3),
  ('qmhq', 'Maintenance', 'Maintenance and repairs', '#8B5CF6', 4),
  ('qmhq', 'Other', 'Other categories', '#6B7280', 5)
ON CONFLICT (entity_type, name) DO NOTHING;

CREATE OR REPLACE FUNCTION public.get_categories(p_entity_type public.entity_type)
RETURNS SETOF public.categories AS $$
  SELECT * FROM public.categories
  WHERE entity_type = p_entity_type
    AND is_active = true
  ORDER BY display_order, name;
$$ LANGUAGE sql STABLE;

-- ============================================================
-- 017: Add 'item' to entity_type enum and update items table
-- ============================================================

-- Add 'item' to the entity_type enum
ALTER TYPE public.entity_type ADD VALUE IF NOT EXISTS 'item';

-- Add category_id column (foreign key to categories table)
ALTER TABLE public.items ADD COLUMN IF NOT EXISTS category_id UUID REFERENCES public.categories(id);

-- Create index for category_id
CREATE INDEX IF NOT EXISTS idx_items_category_id ON public.items(category_id);

COMMENT ON COLUMN public.items.category_id IS 'Reference to categories table for item classification';

-- ============================================================
-- 018: Seed default item categories
-- ============================================================

INSERT INTO public.categories (entity_type, name, description, color, display_order) VALUES
  ('item', 'Equipment', 'Tools, machinery, and equipment', '#3B82F6', 1),
  ('item', 'Consumable', 'Items that are used up', '#10B981', 2),
  ('item', 'Uniform', 'Clothing and uniforms', '#8B5CF6', 3),
  ('item', 'Office Supplies', 'Stationery and office items', '#F59E0B', 4),
  ('item', 'Electronics', 'Electronic devices and components', '#EC4899', 5),
  ('item', 'Other', 'Miscellaneous items', '#6B7280', 6)
ON CONFLICT (entity_type, name) DO NOTHING;

-- ============================================================
-- Verification Queries (Optional - run to verify)
-- ============================================================

-- SELECT * FROM public.departments;
-- SELECT * FROM public.status_config ORDER BY entity_type, display_order;
-- SELECT * FROM public.categories ORDER BY entity_type, display_order;

-- ============================================================
-- Migration 052: Stock-out requests tables
-- ============================================================

-- Line item status enum
DO $$ BEGIN
  CREATE TYPE sor_line_item_status AS ENUM (
    'pending',
    'approved',
    'rejected',
    'cancelled',
    'partially_executed',
    'executed'
  );
EXCEPTION WHEN duplicate_object THEN null;
END $$;

-- Computed request status enum
DO $$ BEGIN
  CREATE TYPE sor_request_status AS ENUM (
    'pending',
    'partially_approved',
    'approved',
    'rejected',
    'cancelled',
    'partially_executed',
    'executed'
  );
EXCEPTION WHEN duplicate_object THEN null;
END $$;

-- Stock-out requests table
CREATE TABLE IF NOT EXISTS stock_out_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_number TEXT UNIQUE,
  status sor_request_status NOT NULL DEFAULT 'pending',
  reason stock_out_reason NOT NULL,
  notes TEXT,
  qmhq_id UUID REFERENCES qmhq(id) ON DELETE SET NULL,
  requester_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  is_active BOOLEAN DEFAULT true,
  created_by UUID REFERENCES users(id),
  updated_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Stock-out line items table
CREATE TABLE IF NOT EXISTS stock_out_line_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id UUID NOT NULL REFERENCES stock_out_requests(id) ON DELETE CASCADE,
  item_id UUID NOT NULL REFERENCES items(id) ON DELETE RESTRICT,
  requested_quantity DECIMAL(15,2) NOT NULL CHECK (requested_quantity > 0),
  status sor_line_item_status NOT NULL DEFAULT 'pending',
  item_name TEXT,
  item_sku TEXT,
  is_active BOOLEAN DEFAULT true,
  created_by UUID REFERENCES users(id),
  updated_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Stock-out approvals table
CREATE TABLE IF NOT EXISTS stock_out_approvals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  line_item_id UUID NOT NULL REFERENCES stock_out_line_items(id) ON DELETE CASCADE,
  approval_number TEXT UNIQUE,
  approved_quantity DECIMAL(15,2) NOT NULL CHECK (approved_quantity > 0),
  decision TEXT NOT NULL CHECK (decision IN ('approved', 'rejected')),
  rejection_reason TEXT,
  warehouse_id UUID REFERENCES warehouses(id) ON DELETE RESTRICT,
  decided_by UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  decided_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  is_active BOOLEAN DEFAULT true,
  created_by UUID REFERENCES users(id),
  updated_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT rejection_reason_required CHECK (decision != 'rejected' OR rejection_reason IS NOT NULL)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_sor_status ON stock_out_requests(status);
CREATE INDEX IF NOT EXISTS idx_sor_reason ON stock_out_requests(reason);
CREATE INDEX IF NOT EXISTS idx_sor_requester ON stock_out_requests(requester_id);
CREATE INDEX IF NOT EXISTS idx_sor_is_active ON stock_out_requests(is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_sor_created_at ON stock_out_requests(created_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS idx_stock_out_requests_qmhq_unique ON stock_out_requests(qmhq_id) WHERE qmhq_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_sor_li_request ON stock_out_line_items(request_id);
CREATE INDEX IF NOT EXISTS idx_sor_li_item ON stock_out_line_items(item_id);
CREATE INDEX IF NOT EXISTS idx_sor_li_status ON stock_out_line_items(status);
CREATE INDEX IF NOT EXISTS idx_sor_li_is_active ON stock_out_line_items(is_active) WHERE is_active = true;

CREATE INDEX IF NOT EXISTS idx_sor_approval_line_item ON stock_out_approvals(line_item_id);
CREATE INDEX IF NOT EXISTS idx_sor_approval_decided_by ON stock_out_approvals(decided_by);
CREATE INDEX IF NOT EXISTS idx_sor_approval_decision ON stock_out_approvals(decision);
CREATE INDEX IF NOT EXISTS idx_sor_approval_is_active ON stock_out_approvals(is_active) WHERE is_active = true;

-- Triggers - Updated_at
DROP TRIGGER IF EXISTS update_sor_updated_at ON stock_out_requests;
CREATE TRIGGER update_sor_updated_at
  BEFORE UPDATE ON stock_out_requests
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_sor_li_updated_at ON stock_out_line_items;
CREATE TRIGGER update_sor_li_updated_at
  BEFORE UPDATE ON stock_out_line_items
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_sor_approval_updated_at ON stock_out_approvals;
CREATE TRIGGER update_sor_approval_updated_at
  BEFORE UPDATE ON stock_out_approvals
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ID Generation Functions
CREATE OR REPLACE FUNCTION generate_sor_request_number()
RETURNS TRIGGER AS $$
DECLARE
  current_year TEXT;
  next_number INT;
BEGIN
  current_year := EXTRACT(YEAR FROM CURRENT_DATE)::TEXT;
  SELECT COALESCE(MAX(
    CAST(SUBSTRING(request_number FROM 'SOR-' || current_year || '-(\d+)') AS INT)
  ), 0) + 1
  INTO next_number
  FROM stock_out_requests
  WHERE request_number LIKE 'SOR-' || current_year || '-%';

  NEW.request_number := 'SOR-' || current_year || '-' || LPAD(next_number::TEXT, 5, '0');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_generate_sor_request_number ON stock_out_requests;
CREATE TRIGGER trg_generate_sor_request_number
  BEFORE INSERT ON stock_out_requests
  FOR EACH ROW
  WHEN (NEW.request_number IS NULL OR NEW.request_number = '')
  EXECUTE FUNCTION generate_sor_request_number();

CREATE OR REPLACE FUNCTION generate_sor_approval_number()
RETURNS TRIGGER AS $$
DECLARE
  parent_request_number TEXT;
  next_seq INT;
BEGIN
  SELECT r.request_number
  INTO parent_request_number
  FROM stock_out_requests r
  JOIN stock_out_line_items li ON li.request_id = r.id
  WHERE li.id = NEW.line_item_id;

  SELECT COALESCE(MAX(
    CAST(SUBSTRING(a.approval_number FROM '.*-A(\d+)$') AS INT)
  ), 0) + 1
  INTO next_seq
  FROM stock_out_approvals a
  JOIN stock_out_line_items li ON a.line_item_id = li.id
  JOIN stock_out_requests r ON li.request_id = r.id
  WHERE r.request_number = parent_request_number;

  NEW.approval_number := parent_request_number || '-A' || LPAD(next_seq::TEXT, 2, '0');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_generate_sor_approval_number ON stock_out_approvals;
CREATE TRIGGER trg_generate_sor_approval_number
  BEFORE INSERT ON stock_out_approvals
  FOR EACH ROW
  WHEN (NEW.approval_number IS NULL OR NEW.approval_number = '')
  EXECUTE FUNCTION generate_sor_approval_number();

-- Item snapshot trigger
CREATE OR REPLACE FUNCTION snapshot_sor_line_item()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.item_name IS NULL OR NEW.item_sku IS NULL THEN
    SELECT name, sku
    INTO NEW.item_name, NEW.item_sku
    FROM items
    WHERE id = NEW.item_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_snapshot_sor_line_item ON stock_out_line_items;
CREATE TRIGGER trg_snapshot_sor_line_item
  BEFORE INSERT ON stock_out_line_items
  FOR EACH ROW
  EXECUTE FUNCTION snapshot_sor_line_item();

-- Computed request status trigger
CREATE OR REPLACE FUNCTION compute_sor_request_status()
RETURNS TRIGGER AS $$
DECLARE
  total_count INT;
  pending_count INT;
  cancelled_count INT;
  rejected_count INT;
  approved_count INT;
  partially_executed_count INT;
  executed_count INT;
  new_status sor_request_status;
  parent_request_id UUID;
BEGIN
  IF TG_TABLE_NAME = 'stock_out_line_items' THEN
    parent_request_id := COALESCE(NEW.request_id, OLD.request_id);
  ELSIF TG_TABLE_NAME = 'stock_out_approvals' THEN
    SELECT li.request_id INTO parent_request_id
    FROM stock_out_line_items li
    WHERE li.id = COALESCE(NEW.line_item_id, OLD.line_item_id);
  END IF;

  IF parent_request_id IS NULL THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  SELECT
    COUNT(*),
    COUNT(*) FILTER (WHERE status = 'pending'),
    COUNT(*) FILTER (WHERE status = 'cancelled'),
    COUNT(*) FILTER (WHERE status = 'rejected'),
    COUNT(*) FILTER (WHERE status = 'approved'),
    COUNT(*) FILTER (WHERE status = 'partially_executed'),
    COUNT(*) FILTER (WHERE status = 'executed')
  INTO total_count, pending_count, cancelled_count, rejected_count,
       approved_count, partially_executed_count, executed_count
  FROM stock_out_line_items
  WHERE request_id = parent_request_id AND is_active = true;

  IF total_count = 0 OR pending_count = total_count THEN
    new_status := 'pending';
  ELSIF cancelled_count = total_count THEN
    new_status := 'cancelled';
  ELSIF rejected_count + cancelled_count = total_count THEN
    new_status := 'rejected';
  ELSIF executed_count = total_count THEN
    new_status := 'executed';
  ELSIF partially_executed_count > 0 OR (executed_count > 0 AND executed_count < total_count) THEN
    new_status := 'partially_executed';
  ELSIF approved_count > 0 AND pending_count > 0 THEN
    new_status := 'partially_approved';
  ELSIF approved_count > 0 AND pending_count = 0 THEN
    new_status := 'approved';
  ELSE
    new_status := 'partially_approved';
  END IF;

  UPDATE stock_out_requests
  SET status = new_status,
      updated_at = NOW()
  WHERE id = parent_request_id
    AND status IS DISTINCT FROM new_status;

  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_compute_sor_status_from_li ON stock_out_line_items;
CREATE TRIGGER trg_compute_sor_status_from_li
  AFTER INSERT OR UPDATE OF status, is_active OR DELETE ON stock_out_line_items
  FOR EACH ROW
  EXECUTE FUNCTION compute_sor_request_status();

-- Note: QMHQ single-line-item enforcement was removed in migration 20260210075851
-- QMHQ-linked stock-out requests can now have multiple line items

GRANT USAGE ON TYPE sor_line_item_status TO authenticated;
GRANT USAGE ON TYPE sor_request_status TO authenticated;

-- ============================================================
-- Migration 053: Stock-out validation functions
-- ============================================================

-- Get total stock for an item across ALL warehouses
CREATE OR REPLACE FUNCTION get_total_item_stock(p_item_id UUID)
RETURNS DECIMAL(15,2) AS $$
BEGIN
  RETURN (
    SELECT COALESCE(SUM(
      CASE
        WHEN movement_type = 'inventory_in' THEN quantity
        WHEN movement_type = 'inventory_out' THEN -quantity
        ELSE 0
      END
    ), 0)
    FROM inventory_transactions
    WHERE item_id = p_item_id
      AND is_active = true
      AND status = 'completed'
  );
END;
$$ LANGUAGE plpgsql STABLE;

-- Validate stock at line item creation
CREATE OR REPLACE FUNCTION validate_sor_line_item_creation()
RETURNS TRIGGER AS $$
DECLARE
  available_stock DECIMAL(15,2);
BEGIN
  IF TG_OP != 'INSERT' THEN
    RETURN NEW;
  END IF;

  available_stock := get_total_item_stock(NEW.item_id);

  IF NEW.requested_quantity > available_stock THEN
    RAISE EXCEPTION 'Insufficient stock. Requested: %, Available across all warehouses: %',
      NEW.requested_quantity, available_stock;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_validate_sor_li_creation ON stock_out_line_items;
CREATE TRIGGER trg_validate_sor_li_creation
  BEFORE INSERT ON stock_out_line_items
  FOR EACH ROW
  EXECUTE FUNCTION validate_sor_line_item_creation();

-- Validate approval quantity constraints
CREATE OR REPLACE FUNCTION validate_sor_approval()
RETURNS TRIGGER AS $$
DECLARE
  li_requested_quantity DECIMAL(15,2);
  li_item_id UUID;
  total_already_approved DECIMAL(15,2);
  available_stock DECIMAL(15,2);
BEGIN
  SELECT requested_quantity, item_id
  INTO li_requested_quantity, li_item_id
  FROM stock_out_line_items
  WHERE id = NEW.line_item_id;

  IF NEW.decision = 'approved' THEN
    SELECT COALESCE(SUM(approved_quantity), 0)
    INTO total_already_approved
    FROM stock_out_approvals
    WHERE line_item_id = NEW.line_item_id
      AND decision = 'approved'
      AND is_active = true
      AND id != COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000');

    IF (total_already_approved + NEW.approved_quantity) > li_requested_quantity THEN
      RAISE EXCEPTION 'Total approved quantity (% + %) exceeds requested quantity (%)',
        total_already_approved, NEW.approved_quantity, li_requested_quantity;
    END IF;

    available_stock := get_total_item_stock(li_item_id);

    IF NEW.approved_quantity > available_stock THEN
      RAISE EXCEPTION 'Approved quantity (%) exceeds available stock across all warehouses (%)',
        NEW.approved_quantity, available_stock;
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_validate_sor_approval ON stock_out_approvals;
CREATE TRIGGER trg_validate_sor_approval
  BEFORE INSERT ON stock_out_approvals
  FOR EACH ROW
  EXECUTE FUNCTION validate_sor_approval();

-- Update line item status on approval
CREATE OR REPLACE FUNCTION update_line_item_status_on_approval()
RETURNS TRIGGER AS $$
DECLARE
  li_requested_quantity DECIMAL(15,2);
  total_approved DECIMAL(15,2);
  total_rejected INT;
  total_approvals INT;
BEGIN
  SELECT requested_quantity INTO li_requested_quantity
  FROM stock_out_line_items
  WHERE id = NEW.line_item_id;

  IF NEW.decision = 'approved' THEN
    UPDATE stock_out_line_items
    SET status = 'approved',
        updated_by = NEW.decided_by,
        updated_at = NOW()
    WHERE id = NEW.line_item_id
      AND status = 'pending';
  ELSIF NEW.decision = 'rejected' THEN
    SELECT COUNT(*) FILTER (WHERE decision = 'approved'),
           COUNT(*)
    INTO total_approved, total_approvals
    FROM stock_out_approvals
    WHERE line_item_id = NEW.line_item_id
      AND is_active = true;

    IF total_approved = 0 THEN
      UPDATE stock_out_line_items
      SET status = 'rejected',
          updated_by = NEW.decided_by,
          updated_at = NOW()
      WHERE id = NEW.line_item_id
        AND status = 'pending';
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_update_li_status_on_approval ON stock_out_approvals;
CREATE TRIGGER trg_update_li_status_on_approval
  AFTER INSERT ON stock_out_approvals
  FOR EACH ROW
  EXECUTE FUNCTION update_line_item_status_on_approval();

-- Line item status transition enforcement
CREATE OR REPLACE FUNCTION validate_sor_line_item_status_transition()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.status = NEW.status THEN
    RETURN NEW;
  END IF;

  IF OLD.status = 'approved' THEN
    IF NEW.status NOT IN ('partially_executed', 'executed') THEN
      RAISE EXCEPTION 'Cannot change line item status from approved to %', NEW.status;
    END IF;
  END IF;

  IF OLD.status = 'rejected' THEN
    RAISE EXCEPTION 'Cannot change status of rejected line item';
  END IF;

  IF OLD.status = 'cancelled' THEN
    RAISE EXCEPTION 'Cannot change status of cancelled line item';
  END IF;

  IF NEW.status = 'cancelled' AND OLD.status != 'pending' THEN
    RAISE EXCEPTION 'Can only cancel pending line items, current status: %', OLD.status;
  END IF;

  IF OLD.status = 'partially_executed' AND NEW.status != 'executed' THEN
    RAISE EXCEPTION 'Partially executed line items can only transition to executed';
  END IF;

  IF OLD.status = 'executed' THEN
    RAISE EXCEPTION 'Cannot change status of fully executed line item';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_validate_sor_li_status_transition ON stock_out_line_items;
CREATE TRIGGER trg_validate_sor_li_status_transition
  BEFORE UPDATE OF status ON stock_out_line_items
  FOR EACH ROW
  EXECUTE FUNCTION validate_sor_line_item_status_transition();

-- Add nullable FK to link fulfillment inventory_out to the approval that authorized it
ALTER TABLE inventory_transactions
  ADD COLUMN IF NOT EXISTS stock_out_approval_id UUID REFERENCES stock_out_approvals(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_inventory_transactions_sor_approval
  ON inventory_transactions(stock_out_approval_id) WHERE stock_out_approval_id IS NOT NULL;

-- Over-execution blocking
CREATE OR REPLACE FUNCTION validate_sor_fulfillment()
RETURNS TRIGGER AS $$
DECLARE
  approval_qty DECIMAL(15,2);
  total_executed DECIMAL(15,2);
  approval_decision TEXT;
BEGIN
  IF NEW.movement_type != 'inventory_out' THEN
    RETURN NEW;
  END IF;

  IF NEW.stock_out_approval_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT approved_quantity, decision
  INTO approval_qty, approval_decision
  FROM stock_out_approvals
  WHERE id = NEW.stock_out_approval_id
    AND is_active = true;

  IF approval_qty IS NULL THEN
    RAISE EXCEPTION 'Stock-out approval not found';
  END IF;

  IF approval_decision != 'approved' THEN
    RAISE EXCEPTION 'Cannot fulfill a rejected stock-out approval';
  END IF;

  SELECT COALESCE(SUM(quantity), 0)
  INTO total_executed
  FROM inventory_transactions
  WHERE stock_out_approval_id = NEW.stock_out_approval_id
    AND movement_type = 'inventory_out'
    AND is_active = true
    AND status = 'completed'
    AND id != COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000');

  IF (total_executed + NEW.quantity) > approval_qty THEN
    RAISE EXCEPTION 'Over-execution blocked. Approved: %, Already executed: %, Attempting: %',
      approval_qty, total_executed, NEW.quantity;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_validate_sor_fulfillment ON inventory_transactions;
CREATE TRIGGER trg_validate_sor_fulfillment
  BEFORE INSERT OR UPDATE ON inventory_transactions
  FOR EACH ROW
  EXECUTE FUNCTION validate_sor_fulfillment();

-- Auto-update line item execution status on fulfillment
CREATE OR REPLACE FUNCTION update_sor_line_item_execution_status()
RETURNS TRIGGER AS $$
DECLARE
  approval_record RECORD;
  total_executed DECIMAL(15,2);
  total_approved_for_li DECIMAL(15,2);
  total_executed_for_li DECIMAL(15,2);
  li_id UUID;
BEGIN
  IF NEW.movement_type != 'inventory_out' OR NEW.stock_out_approval_id IS NULL THEN
    RETURN NEW;
  END IF;
  IF NEW.status != 'completed' THEN
    RETURN NEW;
  END IF;

  SELECT a.id, a.line_item_id, a.approved_quantity
  INTO approval_record
  FROM stock_out_approvals a
  WHERE a.id = NEW.stock_out_approval_id;

  li_id := approval_record.line_item_id;

  SELECT COALESCE(SUM(approved_quantity), 0)
  INTO total_approved_for_li
  FROM stock_out_approvals
  WHERE line_item_id = li_id
    AND decision = 'approved'
    AND is_active = true;

  SELECT COALESCE(SUM(it.quantity), 0)
  INTO total_executed_for_li
  FROM inventory_transactions it
  JOIN stock_out_approvals a ON it.stock_out_approval_id = a.id
  WHERE a.line_item_id = li_id
    AND it.movement_type = 'inventory_out'
    AND it.is_active = true
    AND it.status = 'completed';

  IF total_executed_for_li >= total_approved_for_li AND total_approved_for_li > 0 THEN
    UPDATE stock_out_line_items
    SET status = 'executed', updated_at = NOW()
    WHERE id = li_id AND status IN ('approved', 'partially_executed');
  ELSIF total_executed_for_li > 0 THEN
    UPDATE stock_out_line_items
    SET status = 'partially_executed', updated_at = NOW()
    WHERE id = li_id AND status = 'approved';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_update_sor_li_execution_status ON inventory_transactions;
CREATE TRIGGER trg_update_sor_li_execution_status
  AFTER INSERT OR UPDATE ON inventory_transactions
  FOR EACH ROW
  EXECUTE FUNCTION update_sor_line_item_execution_status();

GRANT EXECUTE ON FUNCTION get_total_item_stock(UUID) TO authenticated;

-- ============================================================
-- Migration 054: Stock-out RLS policies and audit triggers
-- ============================================================

ALTER TABLE stock_out_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE stock_out_line_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE stock_out_approvals ENABLE ROW LEVEL SECURITY;

-- Helper: check if user can view a stock-out request
CREATE OR REPLACE FUNCTION public.can_view_sor_request(p_request_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
  req_requester_id UUID;
  user_role public.user_role;
BEGIN
  user_role := public.get_user_role();

  IF user_role IN ('admin', 'quartermaster', 'inventory') THEN
    RETURN TRUE;
  END IF;

  SELECT requester_id INTO req_requester_id
  FROM stock_out_requests
  WHERE id = p_request_id;

  RETURN req_requester_id = auth.uid();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- Helper: check if user can view an approval (via line item -> request)
CREATE OR REPLACE FUNCTION public.can_view_sor_approval(p_line_item_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
  parent_request_id UUID;
BEGIN
  SELECT request_id INTO parent_request_id
  FROM stock_out_line_items
  WHERE id = p_line_item_id;

  RETURN public.can_view_sor_request(parent_request_id);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- STOCK_OUT_REQUESTS RLS POLICIES
DROP POLICY IF EXISTS sor_select ON stock_out_requests;
CREATE POLICY sor_select ON stock_out_requests
  FOR SELECT USING (
    public.get_user_role() IN ('admin', 'quartermaster', 'inventory')
    OR requester_id = auth.uid()
  );

DROP POLICY IF EXISTS sor_insert ON stock_out_requests;
CREATE POLICY sor_insert ON stock_out_requests
  FOR INSERT WITH CHECK (
    public.get_user_role() IN ('admin', 'quartermaster', 'inventory')
  );

DROP POLICY IF EXISTS sor_update ON stock_out_requests;
CREATE POLICY sor_update ON stock_out_requests
  FOR UPDATE USING (
    public.get_user_role() = 'admin'
    OR requester_id = auth.uid()
  );

DROP POLICY IF EXISTS sor_delete ON stock_out_requests;
CREATE POLICY sor_delete ON stock_out_requests
  FOR DELETE USING (
    public.get_user_role() = 'admin'
  );

-- STOCK_OUT_LINE_ITEMS RLS POLICIES
DROP POLICY IF EXISTS sor_li_select ON stock_out_line_items;
CREATE POLICY sor_li_select ON stock_out_line_items
  FOR SELECT USING (
    public.can_view_sor_request(request_id)
  );

DROP POLICY IF EXISTS sor_li_insert ON stock_out_line_items;
CREATE POLICY sor_li_insert ON stock_out_line_items
  FOR INSERT WITH CHECK (
    public.get_user_role() IN ('admin', 'quartermaster', 'inventory')
  );

DROP POLICY IF EXISTS sor_li_update ON stock_out_line_items;
CREATE POLICY sor_li_update ON stock_out_line_items
  FOR UPDATE USING (
    public.get_user_role() IN ('admin', 'quartermaster', 'inventory')
  );

DROP POLICY IF EXISTS sor_li_delete ON stock_out_line_items;
CREATE POLICY sor_li_delete ON stock_out_line_items
  FOR DELETE USING (
    public.get_user_role() = 'admin'
  );

-- STOCK_OUT_APPROVALS RLS POLICIES
DROP POLICY IF EXISTS sor_approval_select ON stock_out_approvals;
CREATE POLICY sor_approval_select ON stock_out_approvals
  FOR SELECT USING (
    public.can_view_sor_approval(line_item_id)
  );

DROP POLICY IF EXISTS sor_approval_insert ON stock_out_approvals;
CREATE POLICY sor_approval_insert ON stock_out_approvals
  FOR INSERT WITH CHECK (
    public.get_user_role() = 'admin'
  );

DROP POLICY IF EXISTS sor_approval_update ON stock_out_approvals;
CREATE POLICY sor_approval_update ON stock_out_approvals
  FOR UPDATE USING (
    public.get_user_role() = 'admin'
  );

DROP POLICY IF EXISTS sor_approval_delete ON stock_out_approvals;
CREATE POLICY sor_approval_delete ON stock_out_approvals
  FOR DELETE USING (
    public.get_user_role() = 'admin'
  );

-- AUDIT TRIGGERS
DROP TRIGGER IF EXISTS audit_stock_out_requests ON stock_out_requests;
CREATE TRIGGER audit_stock_out_requests
  AFTER INSERT OR UPDATE OR DELETE ON stock_out_requests
  FOR EACH ROW EXECUTE FUNCTION public.create_audit_log();

DROP TRIGGER IF EXISTS audit_stock_out_line_items ON stock_out_line_items;
CREATE TRIGGER audit_stock_out_line_items
  AFTER INSERT OR UPDATE OR DELETE ON stock_out_line_items
  FOR EACH ROW EXECUTE FUNCTION public.create_audit_log();

DROP TRIGGER IF EXISTS audit_stock_out_approvals ON stock_out_approvals;
CREATE TRIGGER audit_stock_out_approvals
  AFTER INSERT OR UPDATE OR DELETE ON stock_out_approvals
  FOR EACH ROW EXECUTE FUNCTION public.create_audit_log();

GRANT EXECUTE ON FUNCTION public.can_view_sor_request(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_view_sor_approval(UUID) TO authenticated;

-- ============================================================
-- Migration Complete!
-- ============================================================
