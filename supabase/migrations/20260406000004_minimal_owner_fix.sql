-- ============================================================
-- AURIX CMS — Minimal Platform Owner Fix
-- Run this DIRECTLY in Supabase SQL Editor
-- This script avoids all function conflicts
-- ============================================================

-- STEP 1: Create memberships table (safe if exists)
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

-- STEP 2: Hard reset platform owner profile
UPDATE public.profiles
SET
  role              = 'super_admin',
  power_level       = 100,
  is_platform_owner = true,
  status            = 'active',
  account_type      = 'business'
WHERE email = 'info.nishantchauhan@gmail.com';

-- STEP 3: Approve their org
UPDATE public.organizations o
SET status = 'approved'
FROM public.profiles p
WHERE p.email = 'info.nishantchauhan@gmail.com'
  AND o.owner_id = p.id;

-- STEP 4: Fix profile.org_id (set to their owned org)
UPDATE public.profiles p
SET org_id = o.id
FROM public.organizations o
WHERE p.email    = 'info.nishantchauhan@gmail.com'
  AND o.owner_id = p.id;

-- STEP 5: Ensure roles exist (ignore conflicts)
INSERT INTO public.roles (org_id, name, power_level)
SELECT o.id, 'super_admin', 100
FROM public.profiles p
JOIN public.organizations o ON o.owner_id = p.id
WHERE p.email = 'info.nishantchauhan@gmail.com'
ON CONFLICT (org_id, name) DO UPDATE SET power_level = 100;

INSERT INTO public.roles (org_id, name, power_level)
SELECT o.id, 'admin', 90
FROM public.profiles p
JOIN public.organizations o ON o.owner_id = p.id
WHERE p.email = 'info.nishantchauhan@gmail.com'
ON CONFLICT (org_id, name) DO NOTHING;

INSERT INTO public.roles (org_id, name, power_level)
SELECT o.id, 'manager', 70
FROM public.profiles p
JOIN public.organizations o ON o.owner_id = p.id
WHERE p.email = 'info.nishantchauhan@gmail.com'
ON CONFLICT (org_id, name) DO NOTHING;

INSERT INTO public.roles (org_id, name, power_level)
SELECT o.id, 'developer', 50
FROM public.profiles p
JOIN public.organizations o ON o.owner_id = p.id
WHERE p.email = 'info.nishantchauhan@gmail.com'
ON CONFLICT (org_id, name) DO NOTHING;

INSERT INTO public.roles (org_id, name, power_level)
SELECT o.id, 'client', 10
FROM public.profiles p
JOIN public.organizations o ON o.owner_id = p.id
WHERE p.email = 'info.nishantchauhan@gmail.com'
ON CONFLICT (org_id, name) DO NOTHING;

-- STEP 6: Assign role_id to platform owner
UPDATE public.profiles p
SET role_id = r.id
FROM public.organizations o
JOIN public.roles r ON r.org_id = o.id AND r.name = 'super_admin'
WHERE p.email    = 'info.nishantchauhan@gmail.com'
  AND o.owner_id = p.id;

-- STEP 7: Create active membership
INSERT INTO public.memberships (user_id, org_id, role, status)
SELECT p.id, p.org_id, 'super_admin', 'active'
FROM public.profiles p
WHERE p.email   = 'info.nishantchauhan@gmail.com'
  AND p.org_id IS NOT NULL
ON CONFLICT (user_id, org_id)
DO UPDATE SET role = 'super_admin', status = 'active', updated_at = now();

-- STEP 8: Migrate all other profiles to memberships
INSERT INTO public.memberships (user_id, org_id, role, status)
SELECT p.id, p.org_id, COALESCE(p.role, 'client'), 'active'
FROM public.profiles p
WHERE p.org_id IS NOT NULL
  AND p.status NOT IN ('banned', 'disabled')
ON CONFLICT (user_id, org_id) DO NOTHING;

-- STEP 9: Verify — check the result
SELECT
  p.email,
  p.role,
  p.power_level,
  p.is_platform_owner,
  p.status,
  p.account_type,
  p.org_id,
  o.name   AS org_name,
  o.status AS org_status,
  m.role   AS membership_role,
  m.status AS membership_status
FROM public.profiles p
LEFT JOIN public.organizations o ON o.id = p.org_id
LEFT JOIN public.memberships m   ON m.user_id = p.id AND m.org_id = p.org_id
WHERE p.email = 'info.nishantchauhan@gmail.com';
