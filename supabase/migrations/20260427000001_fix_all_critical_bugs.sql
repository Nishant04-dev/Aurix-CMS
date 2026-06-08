-- ============================================================================
-- CRITICAL BUG FIXES MIGRATION
-- Date: 2026-04-27
-- Description: Fixes all critical bugs identified in comprehensive audit
-- ============================================================================

BEGIN;

-- ============================================================================
-- BUG-001: Add Missing Permissions
-- ============================================================================

INSERT INTO public.permissions (key, name, category) VALUES
  ('cancel_project', 'Cancel Project', 'projects'),
  ('create_client', 'Create Client', 'clients'),
  ('delete_client', 'Delete Client', 'clients'),
  ('edit_client', 'Edit Client', 'clients'),
  ('delete_user', 'Delete User', 'users'),
  ('edit_user', 'Edit User', 'users'),
  ('invite_user', 'Invite User', 'users'),
  ('upload_file', 'Upload File', 'files'),
  ('view_project', 'View Project', 'projects')
ON CONFLICT (key) DO NOTHING;

-- ============================================================================
-- BUG-002: Add Unique Constraint on roles(org_id, name)
-- ============================================================================

-- First, clean up existing duplicates
DELETE FROM public.roles a
USING public.roles b
WHERE a.id < b.id
  AND a.org_id = b.org_id
  AND LOWER(a.name) = LOWER(b.name);

-- Add unique constraint (case-insensitive)
CREATE UNIQUE INDEX IF NOT EXISTS roles_org_id_name_key 
ON public.roles (org_id, LOWER(name));

-- ============================================================================
-- BUG-003: Make provision_new_organization Idempotent
-- ============================================================================

CREATE OR REPLACE FUNCTION public.provision_new_organization(
  p_org_name TEXT,
  p_user_id UUID
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
DECLARE
  v_org_id UUID;
  v_role_sa_id UUID;
  v_role_admin_id UUID;
  v_role_manager_id UUID;
  v_role_member_id UUID;
  v_role_client_id UUID;
  v_role_count INT;
BEGIN
  -- ============================================================================
  -- IDEMPOTENCY CHECK: Return existing org if already initialized
  -- ============================================================================
  SELECT id INTO v_org_id
  FROM public.organizations
  WHERE owner_id = p_user_id
    AND name = p_org_name
    AND is_initialized = true;

  IF v_org_id IS NOT NULL THEN
    RAISE NOTICE 'Organization already exists and is initialized: %', v_org_id;
    RETURN v_org_id;
  END IF;

  -- ============================================================================
  -- VALIDATION: Ensure user profile exists
  -- ============================================================================
  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = p_user_id) THEN
    RAISE EXCEPTION 'User profile not found: %', p_user_id;
  END IF;

  -- ============================================================================
  -- STEP 1: Create Organization (or get existing uninitialized one)
  -- ============================================================================
  INSERT INTO public.organizations (name, plan, status, owner_id, currency, timezone, is_initialized)
  VALUES (p_org_name, 'free', 'approved', p_user_id, 'INR', 'Asia/Kolkata', false)
  ON CONFLICT (owner_id, name) DO UPDATE SET updated_at = now()
  RETURNING id INTO v_org_id;

  -- ============================================================================
  -- STEP 2: Create Subscription
  -- ============================================================================
  INSERT INTO public.subscriptions (org_id, plan, status, currency)
  VALUES (v_org_id, 'free', 'active', 'INR')
  ON CONFLICT (org_id) DO NOTHING;

  -- ============================================================================
  -- STEP 3: Create System Roles (with unique constraint handling)
  -- ============================================================================
  INSERT INTO public.roles (org_id, name, power_level, is_system)
  VALUES
    (v_org_id, 'Super Admin', 100, true),
    (v_org_id, 'Admin', 90, true),
    (v_org_id, 'Manager', 70, true),
    (v_org_id, 'Member', 50, true),
    (v_org_id, 'Client', 10, true)
  ON CONFLICT (org_id, LOWER(name)) DO NOTHING;

  -- Get role IDs
  SELECT id INTO v_role_sa_id FROM public.roles WHERE org_id = v_org_id AND LOWER(name) = 'super admin';
  SELECT id INTO v_role_admin_id FROM public.roles WHERE org_id = v_org_id AND LOWER(name) = 'admin';
  SELECT id INTO v_role_manager_id FROM public.roles WHERE org_id = v_org_id AND LOWER(name) = 'manager';
  SELECT id INTO v_role_member_id FROM public.roles WHERE org_id = v_org_id AND LOWER(name) = 'member';
  SELECT id INTO v_role_client_id FROM public.roles WHERE org_id = v_org_id AND LOWER(name) = 'client';

  -- Validate all roles were created
  SELECT COUNT(*) INTO v_role_count FROM public.roles WHERE org_id = v_org_id AND is_system = true;
  IF v_role_count < 5 THEN
    RAISE EXCEPTION 'Failed to create all system roles. Expected 5, got %', v_role_count;
  END IF;

  -- ============================================================================
  -- STEP 4: Assign Permissions to Roles (only existing permissions)
  -- ============================================================================
  -- Super Admin: ALL permissions
  INSERT INTO public.role_permissions (role_id, permission_key, org_id)
  SELECT v_role_sa_id, key, v_org_id
  FROM public.permissions
  ON CONFLICT (role_id, permission_key) DO NOTHING;

  -- Admin: Most permissions (exclude platform-level)
  INSERT INTO public.role_permissions (role_id, permission_key, org_id)
  SELECT v_role_admin_id, key, v_org_id
  FROM public.permissions
  WHERE category IN ('users', 'roles', 'projects', 'clients', 'invoices', 'files', 'tasks', 'organization')
  ON CONFLICT (role_id, permission_key) DO NOTHING;

  -- Manager: Project and client management
  INSERT INTO public.role_permissions (role_id, permission_key, org_id)
  SELECT v_role_manager_id, key, v_org_id
  FROM public.permissions
  WHERE key IN (
    'view_users', 'invite_users',
    'manage_projects', 'view_projects', 'create_project', 'edit_project', 'view_project',
    'manage_clients', 'view_clients', 'view_client', 'create_client', 'edit_client',
    'manage_invoices', 'view_invoices', 'create_invoice', 'edit_invoice',
    'upload_files', 'view_files', 'view_file', 'upload_file',
    'manage_tasks', 'view_tasks'
  )
  ON CONFLICT (role_id, permission_key) DO NOTHING;

  -- Member: View and basic operations
  INSERT INTO public.role_permissions (role_id, permission_key, org_id)
  SELECT v_role_member_id, key, v_org_id
  FROM public.permissions
  WHERE key IN (
    'view_projects', 'view_project',
    'view_clients', 'view_client',
    'view_files', 'view_file', 'upload_file',
    'view_tasks'
  )
  ON CONFLICT (role_id, permission_key) DO NOTHING;

  -- Client: View only
  INSERT INTO public.role_permissions (role_id, permission_key, org_id)
  SELECT v_role_client_id, key, v_org_id
  FROM public.permissions
  WHERE key IN (
    'view_projects', 'view_project',
    'view_invoices',
    'view_files', 'view_file'
  )
  ON CONFLICT (role_id, permission_key) DO NOTHING;

  -- ============================================================================
  -- STEP 5: Create Owner Membership (source of truth)
  -- ============================================================================
  INSERT INTO public.memberships (user_id, org_id, role, role_id, status)
  VALUES (p_user_id, v_org_id, 'super_admin', v_role_sa_id, 'active')
  ON CONFLICT (user_id, org_id) DO UPDATE SET
    role = 'super_admin',
    role_id = v_role_sa_id,
    status = 'active',
    updated_at = now();

  -- ============================================================================
  -- STEP 6: Update Profile (secondary sync)
  -- ============================================================================
  UPDATE public.profiles
  SET org_id = v_org_id,
      role = 'super_admin',
      role_id = v_role_sa_id,
      power_level = 100,
      onboarding_complete = true
  WHERE id = p_user_id;

  -- ============================================================================
  -- STEP 7: Mark Organization as Initialized
  -- ============================================================================
  UPDATE public.organizations
  SET is_initialized = true
  WHERE id = v_org_id;

  -- ============================================================================
  -- SUCCESS: Return org_id
  -- ============================================================================
  RETURN v_org_id;

EXCEPTION
  WHEN OTHERS THEN
    -- Log error and re-raise
    RAISE EXCEPTION 'Organization provisioning failed: %', SQLERRM;
END;
$function$;

-- ============================================================================
-- BUG-007: Add org_id Filtering Indexes
-- ============================================================================

-- Add indexes for org_id filtering (if not exists)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_projects_org_id ON public.projects(org_id) WHERE deleted_at IS NULL;
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_clients_org_id ON public.clients(org_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_invoices_org_id ON public.invoices(org_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_tasks_org_id ON public.tasks(org_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_memberships_org_id ON public.memberships(org_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_roles_org_id ON public.roles(org_id);

-- ============================================================================
-- BUG-016: Add Soft Delete Columns
-- ============================================================================

-- Add deleted_at columns to critical tables
ALTER TABLE public.projects ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

-- Add indexes for soft delete queries
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_projects_deleted_at ON public.projects(deleted_at) WHERE deleted_at IS NULL;
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_clients_deleted_at ON public.clients(deleted_at) WHERE deleted_at IS NULL;
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_invoices_deleted_at ON public.invoices(deleted_at) WHERE deleted_at IS NULL;
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_tasks_deleted_at ON public.tasks(deleted_at) WHERE deleted_at IS NULL;

-- ============================================================================
-- BUG-019: Add Missing Foreign Key Indexes
-- ============================================================================

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_projects_client_id ON public.projects(client_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_projects_created_by ON public.projects(created_by);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_tasks_project_id ON public.tasks(project_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_tasks_assigned_to_id ON public.tasks(assigned_to_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_invoices_client_id ON public.invoices(client_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_invoices_project_id ON public.invoices(project_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_messages_project_id ON public.messages(project_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_messages_sender_id ON public.messages(sender_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_memberships_user_id ON public.memberships(user_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_memberships_role_id ON public.memberships(role_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_role_permissions_role_id ON public.role_permissions(role_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_role_permissions_permission_key ON public.role_permissions(permission_key);

COMMIT;
