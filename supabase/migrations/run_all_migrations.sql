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
-- Migration Complete!
-- ============================================================
