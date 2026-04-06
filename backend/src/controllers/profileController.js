import { z } from 'zod';
import { supabase } from '../config/supabase.js';
import { ok, badRequest, forbidden, serverError } from '../utils/response.js';
import { logger } from '../utils/logger.js';

const UpdateProfileSchema = z.object({
  name:         z.string().min(1).max(200).optional(),
  phone:        z.string().max(30).optional().nullable(),
  avatar_url:   z.string().url().optional().nullable(),
  account_type: z.enum(['user', 'business']).optional(),
});

export async function getProfile(req, res) {
  try {
    const { id } = req.user;
    const { data, error } = await supabase
      .from('profiles')
      .select('id, name, email, role, org_id, power_level, is_platform_owner, display_id, avatar_url, phone, account_type, onboarding_complete, status, created_at')
      .eq('id', id)
      .single();
    if (error) throw error;
    return ok(res, data);
  } catch (err) {
    logger.error('getProfile error', { err: err.message });
    return serverError(res, err.message);
  }
}

export async function updateProfile(req, res) {
  try {
    const { id, isPlatformOwner } = req.user;

    // Strip any attempt to modify protected fields
    const raw = { ...req.body };
    delete raw.role;
    delete raw.power_level;
    delete raw.is_platform_owner;
    delete raw.org_id;
    delete raw.status;

    const data = UpdateProfileSchema.parse(raw);

    // Platform owner cannot change their own account_type
    if (isPlatformOwner && data.account_type) {
      delete data.account_type;
    }

    if (Object.keys(data).length === 0) {
      return badRequest(res, 'No valid fields to update');
    }

    const { data: updated, error } = await supabase
      .from('profiles')
      .update(data)
      .eq('id', id)
      .select('id, name, email, role, avatar_url, phone, account_type, org_id')
      .single();

    if (error) throw error;
    return ok(res, updated, 'Profile updated');
  } catch (err) {
    if (err.name === 'ZodError') return badRequest(res, err.errors.map(e => e.message).join('; '));
    logger.error('updateProfile error', { err: err.message });
    return serverError(res, err.message);
  }
}
