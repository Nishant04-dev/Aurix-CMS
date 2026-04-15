-- ============================================================
-- AURIX CMS — Permissions System
-- Migration: 20260415000001
-- Creates permissions and role_permissions tables
-- ============================================================

-- ── STEP 1: Create permissions table ─────────────────────────
CREATE TABLE IF NOT EXISTS public.permissions (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key         TEXT NOT NULL UNIQUE,
  name        TEXT NOT NULL,
  description TEXT,
  category    TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_permissions_key ON public.permissions(key);
CREATE INDEX IF NOT EXISTS idx_permissions_category ON public.permissions(category);

-- ── STEP 2: Seed core permissions ────────────────────────────
-- These permissions MUST exist before role_permissions can reference them
INSERT INTO public.permissions (key, name, description, category) VALUES
  -- User Management
  ('manage_users', 'Manage Users', 'Create, edit, and remove users', 'users'),
  ('view_users', 'View Users', 'View user list and profiles', 'users'),
  ('invite_users', 'Invite Users', 'Send invitations to new users', 'users'),
  
  -- Role Management
  ('manage_roles', 'Manage Roles', 'Create, edit, and delete roles', 'roles'),
  ('view_roles', 'View Roles', 'View roles and permissions', 'roles'),
  
  -- Project Management
  ('manage_projects', 'Manage Projects', 'Create, edit, and delete projects', 'projects'),
  ('view_projects', 'View Projects', 'View project details', 'projects'),
  ('create_project', 'Create Project', 'Create new projects', 'projects'),
  ('edit_project', 'Edit Project', 'Edit existing projects', 'projects'),
  ('delete_project', 'Delete Project', 'Delete projects', 'projects'),
  
  -- Client Management
  ('manage_clients', 'Manage Clients', 'Create, edit, and delete clients', 'clients'),
  ('view_clients', 'View Clients', 'View client list and details', 'clients'),
  ('view_client', 'View Client', 'View individual client details', 'clients'),
  
  -- Invoice Management
  ('manage_invoices', 'Manage Invoices', 'Create, edit, and delete invoices', 'invoices'),
  ('view_invoices', 'View Invoices', 'View invoice list and details', 'invoices'),
  ('create_invoice', 'Create Invoice', 'Create new invoices', 'invoices'),
  ('edit_invoice', 'Edit Invoice', 'Edit existing invoices', 'invoices'),
  ('delete_invoice', 'Delete Invoice', 'Delete invoices', 'invoices'),
  
  -- File Management
  ('upload_files', 'Upload Files', 'Upload files to projects', 'files'),
  ('view_files', 'View Files', 'View and download files', 'files'),
  ('delete_files', 'Delete Files', 'Delete files', 'files'),
  ('view_file', 'View File', 'View individual file details', 'files'),
  
  -- Task Management
  ('manage_tasks', 'Manage Tasks', 'Create, edit, and delete tasks', 'tasks'),
  ('view_tasks', 'View Tasks', 'View task list and details', 'tasks'),
  
  -- Organization Settings
  ('manage_organization', 'Manage Organization', 'Edit organization settings', 'organization'),
  ('view_organization', 'View Organization', 'View organization details', 'organization')
ON CONFLICT (key) DO NOTHING;

-- ── STEP 3: Create role_permissions table ────────────────────
CREATE TABLE IF NOT EXISTS public.role_permissions (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  role_id        UUID NOT NULL REFERENCES public.roles(id) ON DELETE CASCADE,
  permission_key TEXT NOT NULL REFERENCES public.permissions(key) ON DELETE CASCADE,
  org_id         UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (role_id, permission_key)
);

CREATE INDEX IF NOT EXISTS idx_role_permissions_role_id ON public.role_permissions(role_id);
CREATE INDEX IF NOT EXISTS idx_role_permissions_permission_key ON public.role_permissions(permission_key);
CREATE INDEX IF NOT EXISTS idx_role_permissions_org_id ON public.role_permissions(org_id);

-- ── STEP 4: Enable RLS ────────────────────────────────────────
ALTER TABLE public.permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.role_permissions ENABLE ROW LEVEL SECURITY;

-- Permissions are globally readable
CREATE POLICY "permissions_readable_by_authenticated" ON public.permissions
  FOR SELECT TO authenticated USING (true);

-- Role permissions follow role access
CREATE POLICY "role_permissions_service_only" ON public.role_permissions
  USING (false);

-- ── STEP 5: Seed default role permissions ────────────────────
-- Super Admin roles get all permissions
INSERT INTO public.role_permissions (role_id, permission_key, org_id)
SELECT r.id, p.key, r.org_id
FROM public.roles r
CROSS JOIN public.permissions p
WHERE r.power_level >= 100 OR r.name ILIKE '%super%admin%'
ON CONFLICT (role_id, permission_key) DO NOTHING;

-- Admin roles get most permissions (except manage_roles and manage_organization)
INSERT INTO public.role_permissions (role_id, permission_key, org_id)
SELECT r.id, p.key, r.org_id
FROM public.roles r
CROSS JOIN public.permissions p
WHERE (r.power_level >= 90 AND r.power_level < 100 OR r.name ILIKE '%admin%')
  AND r.name NOT ILIKE '%super%admin%'
  AND p.key NOT IN ('manage_roles', 'manage_organization')
ON CONFLICT (role_id, permission_key) DO NOTHING;

-- Manager roles get project and client management
INSERT INTO public.role_permissions (role_id, permission_key, org_id)
SELECT r.id, p.key, r.org_id
FROM public.roles r
CROSS JOIN public.permissions p
WHERE (r.power_level >= 70 AND r.power_level < 90 OR r.name ILIKE '%manager%')
  AND r.name NOT ILIKE '%admin%'
  AND p.category IN ('projects', 'clients', 'tasks', 'files')
ON CONFLICT (role_id, permission_key) DO NOTHING;

-- Developer roles get project and task access
INSERT INTO public.role_permissions (role_id, permission_key, org_id)
SELECT r.id, p.key, r.org_id
FROM public.roles r
CROSS JOIN public.permissions p
WHERE (r.power_level >= 50 AND r.power_level < 70 OR r.name ILIKE '%developer%')
  AND r.name NOT ILIKE '%manager%'
  AND r.name NOT ILIKE '%admin%'
  AND p.key IN ('view_projects', 'view_tasks', 'manage_tasks', 'upload_files', 'view_files')
ON CONFLICT (role_id, permission_key) DO NOTHING;

-- Client roles get view-only access
INSERT INTO public.role_permissions (role_id, permission_key, org_id)
SELECT r.id, p.key, r.org_id
FROM public.roles r
CROSS JOIN public.permissions p
WHERE r.power_level < 50
  AND r.name NOT ILIKE '%developer%'
  AND r.name NOT ILIKE '%manager%'
  AND r.name NOT ILIKE '%admin%'
  AND p.key IN ('view_projects', 'view_tasks', 'view_files', 'view_invoices')
ON CONFLICT (role_id, permission_key) DO NOTHING;

-- ── STEP 6: Helper function to check permissions ─────────────
CREATE OR REPLACE FUNCTION public.user_has_permission(p_user_id UUID, p_permission_key TEXT)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles pr
    JOIN public.role_permissions rp ON rp.role_id = pr.role_id
    WHERE pr.id = p_user_id
      AND rp.permission_key = p_permission_key
  );
$$;

-- ── STEP 7: Verification ──────────────────────────────────────
-- Show permissions count
SELECT 'Permissions seeded' AS status, COUNT(*) AS count FROM public.permissions;

-- Show role_permissions count
SELECT 'Role permissions created' AS status, COUNT(*) AS count FROM public.role_permissions;
