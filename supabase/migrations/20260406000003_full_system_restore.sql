-- ============================================================
-- AURIX CMS — Full System Restore
-- Migration: 20260406000003
-- Run this in Supabase SQL Editor
-- ============================================================

-- ── STEP 1: Create memberships table if it doesn't exist ─────
-- (Safe to run even if it already exists)
CREATE TABLE IF NOT EXISTS public.memberships (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  org_id     UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  role       TEXT NOT NULL DEFAULT 'client',
  role_id    UUID REFERENCES public.roles(id) ON DELETE SET NULL,
  status     TEXT NOT NULL DEFAULT 'active'
               CHECK (status IN ('active', 'left', 'removed', 'banned')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, org_id)
);

CREATE INDEX IF NOT EXISTS idx_memberships_user_id ON public.memberships(user_id);
CREATE INDEX IF NOT EXISTS idx_memberships_org_id  ON public.memberships(org_id);
CREATE INDEX IF NOT EXISTS idx_memberships_active  ON public.memberships(user_id, status);

-- ── STEP 2: Ensure update_updated_at_column function exists ──
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Trigger for memberships
DROP TRIGGER IF EXISTS memberships_updated_at ON public.memberships;
CREATE TRIGGER memberships_updated_at
  BEFORE UPDATE ON public.memberships
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ── STEP 3: HARD RESET — Platform owner profile ──────────────
UPDATE public.profiles
SET
  role              = 'super_admin',
  power_level       = 100,
  is_platform_owner = true,
  status            = 'active',
  account_type      = 'business'
WHERE email = 'info.nishantchauhan@gmail.com';

-- ── STEP 4: Find the platform owner's org ────────────────────
-- First try: org they own
-- Second try: any org they're in
DO $$
DECLARE
  v_user_id  UUID;
  v_org_id   UUID;
BEGIN
  -- Get user id
  SELECT id INTO v_user_id
  FROM public.profiles
  WHERE email = 'info.nishantchauhan@gmail.com'
  LIMIT 1;

  IF v_user_id IS NULL THEN
    RAISE NOTICE 'User not found: info.nishantchauhan@gmail.com';
    RETURN;
  END IF;

  -- Try to find org they own
  SELECT id INTO v_org_id
  FROM public.organizations
  WHERE owner_id = v_user_id
  ORDER BY created_at ASC
  LIMIT 1;

  -- If no owned org, try org from profile
  IF v_org_id IS NULL THEN
    SELECT org_id INTO v_org_id
    FROM public.profiles
    WHERE id = v_user_id AND org_id IS NOT NULL;
  END IF;

  -- If still no org, try any org named "Aurix"
  IF v_org_id IS NULL THEN
    SELECT id INTO v_org_id
    FROM public.organizations
    WHERE name ILIKE '%aurix%'
    ORDER BY created_at ASC
    LIMIT 1;
  END IF;

  IF v_org_id IS NULL THEN
    RAISE NOTICE 'No organization found for platform owner. They need to create one via onboarding.';
    RETURN;
  END IF;

  RAISE NOTICE 'Found org_id: %', v_org_id;

  -- STEP 5: Approve the org
  UPDATE public.organizations
  SET status = 'approved'
  WHERE id = v_org_id;

  -- STEP 6: Set profile.org_id
  UPDATE public.profiles
  SET org_id = v_org_id
  WHERE id = v_user_id;

  -- STEP 7: Ensure roles exist for this org
  -- super_admin role
  INSERT INTO public.roles (org_id, name, power_level)
  VALUES (v_org_id, 'super_admin', 100)
  ON CONFLICT (org_id, name) DO UPDATE SET power_level = 100;

  -- admin role
  INSERT INTO public.roles (org_id, name, power_level)
  VALUES (v_org_id, 'admin', 90)
  ON CONFLICT (org_id, name) DO NOTHING;

  -- manager role
  INSERT INTO public.roles (org_id, name, power_level)
  VALUES (v_org_id, 'manager', 70)
  ON CONFLICT (org_id, name) DO NOTHING;

  -- developer role
  INSERT INTO public.roles (org_id, name, power_level)
  VALUES (v_org_id, 'developer', 50)
  ON CONFLICT (org_id, name) DO NOTHING;

  -- support role
  INSERT INTO public.roles (org_id, name, power_level)
  VALUES (v_org_id, 'support', 50)
  ON CONFLICT (org_id, name) DO NOTHING;

  -- client role
  INSERT INTO public.roles (org_id, name, power_level)
  VALUES (v_org_id, 'client', 10)
  ON CONFLICT (org_id, name) DO NOTHING;

  -- STEP 8: Assign super_admin role_id to platform owner
  UPDATE public.profiles p
  SET role_id = r.id
  FROM public.roles r
  WHERE p.id      = v_user_id
    AND r.org_id  = v_org_id
    AND r.name    = 'super_admin';

  -- STEP 9: Create/restore active membership
  INSERT INTO public.memberships (user_id, org_id, role, status)
  VALUES (v_user_id, v_org_id, 'super_admin', 'active')
  ON CONFLICT (user_id, org_id)
  DO UPDATE SET
    role       = 'super_admin',
    status     = 'active',
    updated_at = now();

  -- STEP 10: Update membership role_id
  UPDATE public.memberships m
  SET role_id = r.id
  FROM public.roles r
  WHERE m.user_id = v_user_id
    AND m.org_id  = v_org_id
    AND r.org_id  = v_org_id
    AND r.name    = 'super_admin';

  RAISE NOTICE 'Platform owner fully restored. user_id=%, org_id=%', v_user_id, v_org_id;
END;
$$;

-- ── STEP 11: Migrate ALL existing profiles to memberships ─────
-- Anyone with an org_id gets an active membership
INSERT INTO public.memberships (user_id, org_id, role, status)
SELECT
  p.id,
  p.org_id,
  COALESCE(p.role, 'client'),
  'active'
FROM public.profiles p
WHERE p.org_id IS NOT NULL
  AND p.status NOT IN ('banned', 'disabled')
ON CONFLICT (user_id, org_id) DO NOTHING;

-- ── STEP 12: Migrate accepted invitations → memberships ───────
INSERT INTO public.memberships (user_id, org_id, role, status)
SELECT
  i.target_user_id,
  i.org_id,
  COALESCE(i.role_name, 'client'),
  'active'
FROM public.invitations i
WHERE i.status = 'accepted'
  AND i.target_user_id IS NOT NULL
  AND i.org_id IS NOT NULL
ON CONFLICT (user_id, org_id) DO NOTHING;

-- ── STEP 13: Clean up duplicate/orphan invitations ────────────
-- Remove duplicate pending invitations (keep newest)
DELETE FROM public.invitations a
USING public.invitations b
WHERE a.id < b.id
  AND a.org_id = b.org_id
  AND a.target_user_id = b.target_user_id
  AND a.status = 'pending'
  AND b.status = 'pending';

-- ── STEP 14: Add platform owner protection trigger ────────────
CREATE OR REPLACE FUNCTION public.protect_platform_owner()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF OLD.is_platform_owner = true THEN
    -- Cannot remove platform owner flag
    IF NEW.is_platform_owner = false OR NEW.is_platform_owner IS NULL THEN
      RAISE EXCEPTION 'Cannot remove platform owner status';
    END IF;
    -- Force correct role and power
    NEW.role        := 'super_admin';
    NEW.power_level := 100;
    -- Cannot ban or disable
    IF NEW.status IN ('banned', 'disabled') THEN
      RAISE EXCEPTION 'Cannot ban or disable the platform owner';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS protect_platform_owner_trigger ON public.profiles;
CREATE TRIGGER protect_platform_owner_trigger
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.protect_platform_owner();

-- ── STEP 15: Rewrite get_user_organizations ───────────────────
CREATE OR REPLACE FUNCTION public.get_user_organizations(p_user_id UUID)
RETURNS TABLE (
  org_id    UUID,
  org_name  TEXT,
  org_logo  TEXT,
  org_plan  TEXT,
  role      TEXT,
  is_owner  BOOLEAN
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    o.id          AS org_id,
    o.name        AS org_name,
    o.logo_url    AS org_logo,
    o.plan        AS org_plan,
    m.role        AS role,
    (o.owner_id = p_user_id) AS is_owner
  FROM public.memberships m
  JOIN public.organizations o ON o.id = m.org_id
  WHERE m.user_id = p_user_id
    AND m.status  = 'active'
    AND o.status  IN ('approved', 'pending')
  ORDER BY o.name;
$$;

-- ── STEP 16: FINAL VERIFICATION ──────────────────────────────
SELECT
  p.id,
  p.email,
  p.name,
  p.role,
  p.power_level,
  p.is_platform_owner,
  p.org_id,
  p.role_id,
  p.status,
  p.account_type,
  o.name        AS org_name,
  o.status      AS org_status,
  m.status      AS membership_status,
  m.role        AS membership_role,
  r.name        AS role_name_from_roles
FROM public.profiles p
LEFT JOIN public.organizations o ON o.id = p.org_id
LEFT JOIN public.memberships m   ON m.user_id = p.id AND m.org_id = p.org_id
LEFT JOIN public.roles r         ON r.id = p.role_id
WHERE p.email = 'info.nishantchauhan@gmail.com';
