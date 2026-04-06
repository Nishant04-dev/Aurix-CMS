import { z } from 'zod';
import { supabase } from '../config/supabase.js';
import { ok, badRequest, forbidden, notFound, serverError } from '../utils/response.js';
import { logger } from '../utils/logger.js';

const UpdateUserSchema = z.object({
  name:        z.string().min(1).max(200).optional(),
  role_id:     z.string().uuid().optional(),
  power_level: z.number().int().min(1).max(100).optional(),
});

export async function getUsers(req, res) {
  try {
    const { orgId, role } = req.user;

    if (role === 'client') return forbidden(res, 'Access denied');

    const { data, error } = await supabase
      .from('profiles')
      .select('id, name, email, role, role_id, power_level, display_id, created_at')
      .eq('org_id', orgId)
      .order('name');

    if (error) throw error;
    return ok(res, data);
  } catch (err) {
    logger.error('getUsers error', { err: err.message });
    return serverError(res, err.message);
  }
}

export async function updateUser(req, res) {
  try {
    const { orgId, id: requesterId, powerLevel: requesterPower, role: requesterRole } = req.user;
    const { id } = req.params;

    // Cannot modify yourself via this endpoint
    if (id === requesterId) return badRequest(res, 'Use profile settings to update your own account');

    // Fetch target user
    const { data: target } = await supabase
      .from('profiles')
      .select('id, org_id, power_level, role')
      .eq('id', id)
      .single();

    if (!target) return notFound(res, 'User not found');

    // Must be in same org
    if (target.org_id !== orgId) return forbidden(res, 'Cannot modify users outside your organization');

    // Power level hierarchy: cannot modify equal or higher
    if (!['super_admin'].includes(requesterRole) && target.power_level >= requesterPower) {
      return forbidden(res, 'Cannot modify a user with equal or higher power level');
    }

    const data = UpdateUserSchema.parse(req.body);

    // If assigning a new role, validate the role's power level
    if (data.role_id) {
      const { data: newRole } = await supabase
        .from('roles')
        .select('power_level')
        .eq('id', data.role_id)
        .eq('org_id', orgId)
        .single();

      if (!newRole) return badRequest(res, 'Role not found in your organization');
      if (newRole.power_level >= requesterPower && requesterRole !== 'super_admin') {
        return forbidden(res, 'Cannot assign a role equal to or higher than your own');
      }
    }

    const { data: updated, error } = await supabase
      .from('profiles')
      .update(data)
      .eq('id', id)
      .eq('org_id', orgId)
      .select('id, name, email, role, role_id, power_level')
      .single();

    if (error) throw error;
    logger.info('User updated', { targetId: id, requesterId, orgId });
    return ok(res, updated, 'User updated');
  } catch (err) {
    if (err.name === 'ZodError') return badRequest(res, err.errors.map(e => e.message).join('; '));
    logger.error('updateUser error', { err: err.message });
    return serverError(res, err.message);
  }
}

export async function deleteUser(req, res) {
  try {
    const { orgId, id: requesterId, powerLevel: requesterPower, role: requesterRole } = req.user;
    const { id } = req.params;

    if (id === requesterId) return badRequest(res, 'Cannot delete your own account');

    if (!['admin', 'super_admin'].includes(requesterRole)) {
      return forbidden(res, 'Only admins can remove users');
    }

    const { data: target } = await supabase
      .from('profiles')
      .select('id, org_id, power_level')
      .eq('id', id)
      .single();

    if (!target) return notFound(res, 'User not found');
    if (target.org_id !== orgId) return forbidden(res, 'Cannot remove users outside your organization');

    if (target.power_level >= requesterPower && requesterRole !== 'super_admin') {
      return forbidden(res, 'Cannot remove a user with equal or higher power level');
    }

    // Remove from org (set org_id to null rather than deleting auth user)
    const { error } = await supabase
      .from('profiles')
      .update({ org_id: null, role: 'inactive' })
      .eq('id', id)
      .eq('org_id', orgId);

    if (error) throw error;
    logger.info('User removed from org', { targetId: id, requesterId, orgId });
    return ok(res, null, 'User removed from organization');
  } catch (err) {
    logger.error('deleteUser error', { err: err.message });
    return serverError(res, err.message);
  }
}

export async function changeUserRole(req, res) {
  try {
    const { orgId, id: requesterId } = req.user;
    const { id } = req.params;
    const { role } = req.body;
    if (!role) return badRequest(res, 'role is required');

    const { data, error } = await supabase.rpc('safe_change_role', {
      target_user_id: id,
      new_role: role,
    });
    if (error) throw error;
    if (data?.error) return forbidden(res, data.error);

    logger.info('Role changed', { targetId: id, role, requesterId, orgId });
    return ok(res, data, 'Role updated');
  } catch (err) {
    logger.error('changeUserRole error', { err: err.message });
    return serverError(res, err.message);
  }
}
