import { z } from 'zod';
import { supabase } from '../config/supabase.js';
import { ok, created, badRequest, forbidden, notFound, serverError } from '../utils/response.js';
import { logger } from '../utils/logger.js';
import { logAudit } from '../utils/auditLogger.js';

const RoleSchema = z.object({
  name:        z.string().min(1).max(100),
  power_level: z.number().int().min(1).max(100),
  permissions: z.array(z.string()).optional(),
});

export async function getRoles(req, res) {
  try {
    const { orgId } = req.user;

    const { data: roles, error } = await supabase
      .from('roles')
      .select('id, name, power_level, is_system, created_at, org_id')
      .eq('org_id', orgId)
      .order('power_level', { ascending: false });

    if (error) throw error;
    if (!roles?.length) return ok(res, []);

    // Fetch permissions manually — no implicit join
    const roleIds = roles.map(r => r.id);
    const { data: perms } = await supabase
      .from('role_permissions')
      .select('role_id, permission_key')
      .in('role_id', roleIds);

    const permMap = {};
    for (const p of perms ?? []) {
      if (!permMap[p.role_id]) permMap[p.role_id] = {};
      permMap[p.role_id][p.permission_key] = true;
    }

    const enriched = roles.map(r => ({
      ...r,
      permissions: permMap[r.id] ?? {},
      role_permissions: (perms ?? []).filter(p => p.role_id === r.id),
    }));

    return ok(res, enriched);
  } catch (err) {
    logger.error('getRoles error', { err: err.message });
    return serverError(res, err.message);
  }
}

export async function createRole(req, res) {
  try {
    const { orgId, powerLevel: requesterPower, role: requesterRole } = req.user;

    const { name, power_level, permissions = [] } = RoleSchema.parse(req.body);

    // Cannot create a role with power >= own level (unless super_admin)
    if (power_level >= requesterPower && requesterRole !== 'super_admin') {
      return forbidden(res, 'Cannot create a role with power level equal to or higher than your own');
    }

    const { data: existing } = await supabase
      .from('roles').select('id').eq('org_id', orgId).ilike('name', name).single();
    if (existing) return badRequest(res, 'A role with this name already exists');

    const { data: role, error } = await supabase
      .from('roles')
      .insert({ name, power_level, org_id: orgId })
      .select()
      .single();

    if (error) throw error;

    // Insert permissions
    if (permissions.length > 0) {
      await supabase.from('role_permissions').insert(
        permissions.map(p => ({ role_id: role.id, permission_key: p, org_id: orgId }))
      );
    }

    logger.info('Role created', { roleId: role.id, orgId });
    return created(res, role, 'Role created');
  } catch (err) {
    if (err.name === 'ZodError') return badRequest(res, err.errors.map(e => e.message).join('; '));
    logger.error('createRole error', { err: err.message });
    return serverError(res, err.message);
  }
}

export async function updateRole(req, res) {
  try {
    const { orgId, powerLevel: requesterPower, role: requesterRole } = req.user;
    const { id } = req.params;

    const { data: existing } = await supabase
      .from('roles').select('id, power_level').eq('id', id).eq('org_id', orgId).single();
    if (!existing) return notFound(res, 'Role not found');

    if (existing.power_level >= requesterPower && requesterRole !== 'super_admin') {
      return forbidden(res, 'Cannot modify a role with equal or higher power level');
    }

    const { name, power_level, permissions } = RoleSchema.partial().parse(req.body);

    if (power_level !== undefined && power_level >= requesterPower && requesterRole !== 'super_admin') {
      return forbidden(res, 'Cannot set power level equal to or higher than your own');
    }

    const updates = {};
    if (name)        updates.name        = name;
    if (power_level) updates.power_level = power_level;

    const { data: role, error } = await supabase
      .from('roles').update(updates).eq('id', id).eq('org_id', orgId).select().single();

    if (error) throw error;

    // Replace permissions if provided
    if (permissions !== undefined) {
      await supabase.from('role_permissions').delete().eq('role_id', id);
      if (permissions.length > 0) {
        await supabase.from('role_permissions').insert(
          permissions.map(p => ({ role_id: id, permission_key: p, org_id: orgId }))
        );
      }
    }

    return ok(res, role, 'Role updated');
  } catch (err) {
    if (err.name === 'ZodError') return badRequest(res, err.errors.map(e => e.message).join('; '));
    logger.error('updateRole error', { err: err.message });
    return serverError(res, err.message);
  }
}

export async function deleteRole(req, res) {
  try {
    const { orgId, id: userId, role: requesterRole, powerLevel: requesterPower, isPlatformOwner } = req.user;
    const { id } = req.params;

    // Only admin / super_admin / platform owner can delete roles
    if (!isPlatformOwner && !['admin', 'super_admin'].includes(requesterRole)) {
      return forbidden(res, 'Only admins can delete roles');
    }

    // Fetch the role — must belong to this org
    const { data: existing } = await supabase
      .from('roles')
      .select('id, name, power_level, is_system')
      .eq('id', id)
      .eq('org_id', orgId)
      .maybeSingle();

    if (!existing) return notFound(res, 'Role not found');

    // Block system roles
    if (existing.is_system) {
      return forbidden(res, 'System roles cannot be deleted');
    }

    // Block deleting a role with equal or higher power (unless super_admin / platform owner)
    if (!isPlatformOwner && requesterRole !== 'super_admin' && existing.power_level >= requesterPower) {
      return forbidden(res, 'Cannot delete a role with equal or higher power level than your own');
    }

    // Block if any user currently has this role assigned
    const { count } = await supabase
      .from('profiles')
      .select('id', { count: 'exact', head: true })
      .eq('role_id', id)
      .eq('org_id', orgId);

    if ((count ?? 0) > 0) {
      return badRequest(res, `Role is in use by ${count} user${count === 1 ? '' : 's'}. Reassign them before deleting.`);
    }

    // Delete permissions first, then the role
    await supabase.from('role_permissions').delete().eq('role_id', id);
    const { error } = await supabase.from('roles').delete().eq('id', id).eq('org_id', orgId);
    if (error) throw error;

    logAudit({ orgId, actorId: userId, action: 'role.deleted', targetType: 'role', targetId: id, metadata: { name: existing.name } });
    logger.info('Role deleted', { roleId: id, orgId, deletedBy: userId });

    return ok(res, null, `Role "${existing.name}" deleted`);
  } catch (err) {
    logger.error('deleteRole error', { err: err.message });
    return serverError(res, err.message);
  }
}
