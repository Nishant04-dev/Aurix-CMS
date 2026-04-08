import { z } from 'zod';
import { supabase } from '../config/supabase.js';
import { ok, badRequest, forbidden, notFound, serverError } from '../utils/response.js';
import { logger } from '../utils/logger.js';

const UpdateOrgSchema = z.object({
  name:       z.string().min(1).max(200).optional(),
  logo_url:   z.string().url().optional().nullable(),
  website:    z.string().url().optional().nullable(),
  gst_number: z.string().max(50).optional().nullable(),
  address:    z.string().max(500).optional().nullable(),
  phone:      z.string().max(30).optional().nullable(),
  currency:   z.enum(['USD','INR','EUR','GBP','AED','CAD','AUD','SGD','JPY']).optional(),
  timezone:   z.string().max(100).optional(),
});

export async function getOrganization(req, res) {
  try {
    const { orgId, isPlatformOwner } = req.user;
    if (!orgId) return notFound(res, 'No organization');

    const { data, error } = await supabase
      .from('organizations')
      .select('id, name, logo_url, website, gst_number, address, phone, currency, timezone, plan, status, created_at')
      .eq('id', orgId)
      .single();
    if (error) throw error;
    return ok(res, data);
  } catch (err) {
    logger.error('getOrganization error', { err: err.message });
    return serverError(res, err.message);
  }
}

export async function updateOrganization(req, res) {
  try {
    const { orgId, role, isPlatformOwner } = req.user;
    if (!isPlatformOwner && !['admin', 'super_admin'].includes(role)) {
      return forbidden(res, 'Only admins can update organization settings');
    }
    const data = UpdateOrgSchema.parse(req.body);
    const { data: updated, error } = await supabase
      .from('organizations')
      .update(data)
      .eq('id', orgId)
      .select('id, name, logo_url, website, gst_number, address, phone, currency, timezone, plan, status')
      .single();
    if (error) throw error;
    return ok(res, updated, 'Organization updated');
  } catch (err) {
    if (err.name === 'ZodError') return badRequest(res, err.errors.map(e => e.message).join('; '));
    logger.error('updateOrganization error', { err: err.message });
    return serverError(res, err.message);
  }
}

/**
 * Returns all orgs the user has an active membership in.
 * Uses the memberships table — not invitations.
 */
export async function getUserOrganizations(req, res) {
  try {
    const { id: userId, isPlatformOwner } = req.user;

    // Platform owner: return all approved orgs
    if (isPlatformOwner) {
      const { data, error } = await supabase
        .from('organizations')
        .select('id, name, logo_url, plan, owner_id')
        .in('status', ['approved', 'pending'])
        .order('name');
      if (error) throw error;
      return ok(res, (data ?? []).map(o => ({
        org_id:   o.id,
        org_name: o.name,
        org_logo: o.logo_url,
        org_plan: o.plan,
        role:     'super_admin',
        is_owner: o.owner_id === userId,
      })));
    }

    // Regular user: query memberships
    const { data: memberships, error } = await supabase
      .from('memberships')
      .select('id, role, org_id')
      .eq('user_id', userId)
      .eq('status', 'active');

    if (error) throw error;

    // Fetch orgs manually
    const orgIds = (memberships ?? []).map(m => m.org_id).filter(Boolean);
    let orgMap = {};
    if (orgIds.length > 0) {
      const { data: orgs } = await supabase
        .from('organizations')
        .select('id, name, logo_url, plan, owner_id, status')
        .in('id', orgIds);
      orgMap = Object.fromEntries((orgs ?? []).map(o => [o.id, o]));
    }

    const orgs = (memberships ?? [])
      .filter(m => orgMap[m.org_id] && ['approved', 'pending'].includes(orgMap[m.org_id].status))
      .map(m => ({
        org_id:   m.org_id,
        org_name: orgMap[m.org_id]?.name,
        org_logo: orgMap[m.org_id]?.logo_url,
        org_plan: orgMap[m.org_id]?.plan,
        role:     m.role,
        is_owner: orgMap[m.org_id]?.owner_id === userId,
      }));

    return ok(res, orgs);
  } catch (err) {
    logger.error('getUserOrganizations error', { err: err.message });
    return serverError(res, err.message);
  }
}

/**
 * Switch active organization.
 * Validates membership exists and is active.
 * Platform owners can switch to any org.
 */
export async function switchOrganization(req, res) {
  try {
    const { id: userId, isPlatformOwner } = req.user;
    const { org_id } = req.body;
    if (!org_id) return badRequest(res, 'org_id is required');

    // Verify org exists and is active
    const { data: org } = await supabase
      .from('organizations')
      .select('id, status, name')
      .eq('id', org_id)
      .single();

    if (!org) return notFound(res, 'Organization not found');
    if (!['approved', 'pending'].includes(org.status)) {
      return forbidden(res, 'Organization is not active');
    }

    // Platform owner can switch to any org
    if (!isPlatformOwner) {
      // Verify active membership
      const { data: membership } = await supabase
        .from('memberships')
        .select('id, status')
        .eq('user_id', userId)
        .eq('org_id', org_id)
        .eq('status', 'active')
        .maybeSingle();

      if (!membership) {
        return forbidden(res, 'You do not have an active membership in this organization');
      }
    }

    // Update profile org_id
    const { error } = await supabase
      .from('profiles')
      .update({ org_id })
      .eq('id', userId);

    if (error) throw error;

    // Ensure membership record exists for platform owner
    if (isPlatformOwner) {
      await supabase
        .from('memberships')
        .upsert({ user_id: userId, org_id, role: 'super_admin', status: 'active' }, { onConflict: 'user_id,org_id' });
    }

    logger.info('Organization switched', { userId, org_id, orgName: org.name });
    return ok(res, { org_id, org_name: org.name }, 'Switched organization');
  } catch (err) {
    logger.error('switchOrganization error', { err: err.message });
    return serverError(res, err.message);
  }
}
