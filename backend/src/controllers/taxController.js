import { z } from 'zod';
import { supabase } from '../config/supabase.js';
import { ok, created, badRequest, forbidden, notFound, serverError } from '../utils/response.js';
import { logger } from '../utils/logger.js';

const TaxSchema = z.object({
  name:       z.string().min(1).max(100),
  percentage: z.number().min(0).max(100),
});

export async function getTaxes(req, res) {
  try {
    const { orgId } = req.user;
    const { data, error } = await supabase
      .from('taxes').select('*').eq('org_id', orgId).order('created_at');
    if (error) throw error;
    return ok(res, data ?? []);
  } catch (err) {
    logger.error('getTaxes error', { err: err.message });
    return serverError(res, err.message);
  }
}

export async function createTax(req, res) {
  try {
    const { orgId, role } = req.user;
    if (!['admin', 'super_admin'].includes(role)) {
      return forbidden(res, 'Only admins can manage taxes');
    }
    const data = TaxSchema.parse(req.body);
    const { data: tax, error } = await supabase
      .from('taxes').insert({ ...data, org_id: orgId }).select().single();
    if (error) throw error;
    return created(res, tax, 'Tax created');
  } catch (err) {
    if (err.name === 'ZodError') return badRequest(res, err.errors.map(e => e.message).join('; '));
    logger.error('createTax error', { err: err.message });
    return serverError(res, err.message);
  }
}

export async function deleteTax(req, res) {
  try {
    const { orgId, role } = req.user;
    const { id } = req.params;
    if (!['admin', 'super_admin'].includes(role)) {
      return forbidden(res, 'Only admins can manage taxes');
    }
    const { data: existing } = await supabase
      .from('taxes').select('id').eq('id', id).eq('org_id', orgId).maybeSingle();
    if (!existing) return notFound(res, 'Tax not found');
    await supabase.from('taxes').delete().eq('id', id).eq('org_id', orgId);
    return ok(res, null, 'Tax deleted');
  } catch (err) {
    logger.error('deleteTax error', { err: err.message });
    return serverError(res, err.message);
  }
}
