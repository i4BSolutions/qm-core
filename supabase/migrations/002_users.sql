-- Migration: 002_users
-- Description: Create users table linked to Supabase Auth
-- Date: 2025-01-21

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

-- Users table (extends auth.users)
CREATE TABLE IF NOT EXISTS public.users (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT UNIQUE NOT NULL,
  full_name TEXT NOT NULL,
  role public.user_role NOT NULL DEFAULT 'requester',
  department_id UUID REFERENCES public.departments(id) ON DELETE SET NULL,
  phone TEXT,
  avatar_url TEXT,
  is_active BOOLEAN DEFAULT true,

  -- Audit fields
  created_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  updated_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_users_email ON public.users(email);
CREATE INDEX IF NOT EXISTS idx_users_role ON public.users(role);
CREATE INDEX IF NOT EXISTS idx_users_department ON public.users(department_id);
CREATE INDEX IF NOT EXISTS idx_users_active ON public.users(is_active) WHERE is_active = true;

-- Updated_at trigger
CREATE TRIGGER trg_users_updated_at
  BEFORE UPDATE ON public.users
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Add audit columns to departments now that users table exists
ALTER TABLE public.departments
  ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS updated_by UUID REFERENCES public.users(id) ON DELETE SET NULL;

-- Function to handle new user signup (creates profile in public.users)
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

-- Trigger to auto-create user profile on auth signup
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- Function to get current user's role (for RLS policies)
CREATE OR REPLACE FUNCTION public.get_user_role()
RETURNS public.user_role AS $$
  SELECT role FROM public.users WHERE id = auth.uid();
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- Function to check if current user has a specific role or higher
CREATE OR REPLACE FUNCTION public.has_role(required_role public.user_role)
RETURNS BOOLEAN AS $$
DECLARE
  user_role public.user_role;
  role_hierarchy INTEGER[];
BEGIN
  SELECT role INTO user_role FROM public.users WHERE id = auth.uid();

  -- Define role hierarchy (higher index = more permissions)
  -- admin(6) > quartermaster(5) > finance(4) > inventory(3) > proposal(2) > frontline(1) > requester(0)
  CASE user_role
    WHEN 'admin' THEN RETURN true; -- Admin has all permissions
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

-- Comments
COMMENT ON TABLE public.users IS 'User profiles extending Supabase Auth';
COMMENT ON COLUMN public.users.role IS 'User role for RBAC: admin, quartermaster, finance, inventory, proposal, frontline, requester';
COMMENT ON FUNCTION public.get_user_role IS 'Returns current authenticated user role';
COMMENT ON FUNCTION public.has_role IS 'Checks if current user has required role or higher';
