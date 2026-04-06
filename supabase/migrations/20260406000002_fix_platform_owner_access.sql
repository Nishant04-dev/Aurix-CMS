-- ============================================================
-- AURIX CMS — Platform Owner Access Recovery
-- Migration: 20260406000002
-- Run this in Supabase SQL Editor
-- ============================================================

-- ── STEP 1: Fix platform owner profile ───────────────────────
-- Ensures info.nishantchauhan@gmail.com has correct role/power
UPDATE public.profiles
SET
  role             = 'super_admin',
  power_level      = 100,
  is_platform_owner = true,
  status           = 'active',
  account_type     = 'business'
WHERE email = 'info.nishantchauhan@gmail.com';

-- ── STEP 2: Ensure org "Aurix Development" is approved ───────
-- Find the org owned by the platform owner and approve it
UPDATE public.organizations o
SET status = 'approved'
FROM public.profiles p
WHERE p.email    = 'info.nishantchauhan@gmail.com'
  AND o.owner_id = p.id
  AND o.status  != 'approved';

-- ── STEP 3: Ensure profile.org_id points to their org ────────
UPDATE public.profiles p
SET org_id = o.id
FROM public.organizations o
WHERE p.email    = 'info.nishantchauhan@gmail.com'
  AND o.owner_id = p.id
  AND (p.org_id IS NULL OR p.org_id != o.id);

-- ── STEP 4: Ensure active membership exists ──────────────────
INSERT INTO public.memberships (user_id, org_id, role, status)
SELECT p.id, p.org_id, 'super_admin', 'active'
FROM public.profiles p
WHERE p.email   = 'info.nishantchauhan@gmail.com'
  AND p.org_id IS NOT NULL
ON CONFLICT (user_id, org_id)
DO UPDATE SET
  role       = 'super_admin',
  status     = 'active',
  updated_at = now();

-- ── STEP 5: Assign correct role_id from roles table ──────────
-- Find the super_admin role in their org and assign it
UPDATE public.profiles p
SET role_id = r.id
FROM public.organizations o
JOIN public.roles r ON r.org_id = o.id
WHERE p.email    = 'info.nishantchauhan@gmail.com'
  AND o.owner_id = p.id
  AND r.name ILIKE '%super%admin%'
  AND p.role_id IS DISTINCT FROM r.id;

-- If no super_admin role exists in their org, create one
INSERT INTO public.roles (org_id, name, power_level)
SELECT o.id, 'super_admin', 100
FROM public.profiles p
JOIN public.organizations o ON o.owner_id = p.id
WHERE p.email = 'info.nishantchauhan@gmail.com'
  AND NOT EXISTS (
    SELECT 1 FROM public.roles r2
    WHERE r2.org_id = o.id
      AND r2.name ILIKE '%super%admin%'
  );

-- Now assign the role_id (covers both existing and newly created)
UPDATE public.profiles p
SET role_id = r.id
FROM public.organizations o
JOIN public.roles r ON r.org_id = o.id
WHERE p.email    = 'info.nishantchauhan@gmail.com'
  AND o.owner_id = p.id
  AND r.name ILIKE '%super%admin%'
  AND p.role_id IS DISTINCT FROM r.id;

-- ── STEP 6: Update membership role_id too ────────────────────
UPDATE public.memberships m
SET role_id = r.id
FROM public.profiles p
JOIN public.organizations o ON o.owner_id = p.id
JOIN public.roles r ON r.org_id = o.id AND r.name ILIKE '%super%admin%'
WHERE p.email  = 'info.nishantchauhan@gmail.com'
  AND m.user_id = p.id
  AND m.org_id  = o.id;

-- ── STEP 7: Verify — show final state ────────────────────────
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
  o.name  AS org_name,
  o.status AS org_status,
  m.status AS membership_status,
  m.role   AS membership_role
FROM public.profiles p
LEFT JOIN public.organizations o ON o.id = p.org_id
LEFT JOIN public.memberships m   ON m.user_id = p.id AND m.org_id = p.org_id
WHERE p.email = 'info.nishantchauhan@gmail.com';
