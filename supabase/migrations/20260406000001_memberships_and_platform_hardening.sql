-- ============================================================
-- AURIX CMS — Membership System Hardening
-- Migration: 20260406000001
-- ============================================================

-- ── 1. MEMBERSHIPS TABLE ─────────────────────────────────────
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
CREATE INDEX IF NOT EXISTS idx_memberships_status  ON public.memberships(user_id, status);

ALTER TABLE public.memberships ENABLE ROW LEVEL SECURITY;

-- Service role bypasses RLS; anon/authenticated see nothing directly
CREATE POLICY "memberships_service_only" ON public.memberships
  USING (false);

-- updated_at trigger
CREATE TRIGGER memberships_updated_at
  BEFORE UPDATE ON public.memberships
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


-- ── 2. MIGRATE EXISTING MEMBERS ──────────────────────────────
-- Anyone who currently has an org_id in profiles gets an active membership
INSERT INTO public.memberships (user_id, org_id, role, status)
SELECT
  p.id,
  p.org_id,
  COALESCE(p.role, 'client'),
  'active'
FROM public.profiles p
WHERE p.org_id IS NOT NULL
ON CONFLICT (user_id, org_id) DO NOTHING;

-- Migrate accepted invitations that aren't already covered
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


-- ── 3. PLATFORM OWNER PROTECTION TRIGGER ─────────────────────
CREATE OR REPLACE FUNCTION public.protect_platform_owner()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- If the row being updated IS a platform owner, lock critical fields
  IF OLD.is_platform_owner = true THEN
    -- Prevent stripping platform owner flag
    IF NEW.is_platform_owner = false OR NEW.is_platform_owner IS NULL THEN
      RAISE EXCEPTION 'Cannot remove platform owner status';
    END IF;
    -- Force role to super_admin
    NEW.role        := 'super_admin';
    NEW.power_level := 100;
    -- Prevent deletion via status change
    IF NEW.status = 'banned' OR NEW.status = 'disabled' THEN
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


-- ── 4. PLATFORM OWNER MEMBERSHIP GUARANTEE ───────────────────
-- Ensure platform owner always has an active membership in their org
CREATE OR REPLACE FUNCTION public.ensure_platform_owner_membership()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.is_platform_owner = true AND NEW.org_id IS NOT NULL THEN
    INSERT INTO public.memberships (user_id, org_id, role, status)
    VALUES (NEW.id, NEW.org_id, 'super_admin', 'active')
    ON CONFLICT (user_id, org_id)
    DO UPDATE SET role = 'super_admin', status = 'active', updated_at = now();
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS ensure_platform_owner_membership_trigger ON public.profiles;
CREATE TRIGGER ensure_platform_owner_membership_trigger
  AFTER INSERT OR UPDATE OF org_id, is_platform_owner ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.ensure_platform_owner_membership();


-- ── 5. MEMBERSHIP SYNC TRIGGER ───────────────────────────────
-- When profiles.org_id changes, keep memberships in sync
CREATE OR REPLACE FUNCTION public.sync_membership_on_profile_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- User left or was removed from org
  IF OLD.org_id IS NOT NULL AND (NEW.org_id IS NULL OR NEW.org_id != OLD.org_id) THEN
    UPDATE public.memberships
    SET status = 'left', updated_at = now()
    WHERE user_id = OLD.id AND org_id = OLD.org_id AND status = 'active';
  END IF;

  -- User joined a new org
  IF NEW.org_id IS NOT NULL AND (OLD.org_id IS NULL OR NEW.org_id != OLD.org_id) THEN
    INSERT INTO public.memberships (user_id, org_id, role, status)
    VALUES (NEW.id, NEW.org_id, COALESCE(NEW.role, 'client'), 'active')
    ON CONFLICT (user_id, org_id)
    DO UPDATE SET status = 'active', role = COALESCE(NEW.role, 'client'), updated_at = now();
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS sync_membership_trigger ON public.profiles;
CREATE TRIGGER sync_membership_trigger
  AFTER UPDATE OF org_id ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.sync_membership_on_profile_change();


-- ── 6. get_user_organizations — REWRITE ──────────────────────
-- Returns all orgs a user has active membership in
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


-- ── 7. get_active_membership — NEW HELPER ────────────────────
-- Returns the active membership for a user in a specific org
-- Returns NULL if no valid membership exists
CREATE OR REPLACE FUNCTION public.get_active_membership(p_user_id UUID, p_org_id UUID)
RETURNS TABLE (
  membership_id UUID,
  role          TEXT,
  role_id       UUID,
  org_status    TEXT
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    m.id          AS membership_id,
    m.role        AS role,
    m.role_id     AS role_id,
    o.status      AS org_status
  FROM public.memberships m
  JOIN public.organizations o ON o.id = m.org_id
  WHERE m.user_id = p_user_id
    AND m.org_id  = p_org_id
    AND m.status  = 'active'
  LIMIT 1;
$$;


-- ── 8. ENSURE PLATFORM OWNER MEMBERSHIP NOW ──────────────────
-- Run immediately for existing platform owner
DO $$
DECLARE
  v_owner RECORD;
BEGIN
  FOR v_owner IN
    SELECT id, org_id FROM public.profiles
    WHERE is_platform_owner = true AND org_id IS NOT NULL
  LOOP
    INSERT INTO public.memberships (user_id, org_id, role, status)
    VALUES (v_owner.id, v_owner.org_id, 'super_admin', 'active')
    ON CONFLICT (user_id, org_id)
    DO UPDATE SET role = 'super_admin', status = 'active', updated_at = now();

    -- Also ensure role and power_level are correct
    UPDATE public.profiles
    SET role = 'super_admin', power_level = 100
    WHERE id = v_owner.id
      AND (role != 'super_admin' OR power_level != 100);
  END LOOP;
END;
$$;


-- ── 9. BANNED MEMBERS SYNC ───────────────────────────────────
-- When a user is banned, mark their membership as banned too
CREATE OR REPLACE FUNCTION public.sync_ban_to_membership()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.memberships
    SET status = 'banned', updated_at = now()
    WHERE user_id = NEW.user_id AND org_id = NEW.org_id;
  ELSIF TG_OP = 'DELETE' THEN
    -- Unban: restore to active only if profile still has this org
    UPDATE public.memberships
    SET status = 'active', updated_at = now()
    WHERE user_id = OLD.user_id AND org_id = OLD.org_id
      AND EXISTS (
        SELECT 1 FROM public.profiles
        WHERE id = OLD.user_id AND org_id = OLD.org_id
      );
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS sync_ban_membership_trigger ON public.banned_members;
CREATE TRIGGER sync_ban_membership_trigger
  AFTER INSERT OR DELETE ON public.banned_members
  FOR EACH ROW EXECUTE FUNCTION public.sync_ban_to_membership();
