import { supabase } from '../config/supabase.js';
import { ok, badRequest, serverError } from '../utils/response.js';
import { logger } from '../utils/logger.js';

export async function provisionOrganization(req, res) {
  try {
    const { id: userId } = req.user;
    const { org_name } = req.body;
    if (!org_name?.trim()) return badRequest(res, 'org_name is required');

    const { data, error } = await supabase.rpc('provision_new_organization', {
      p_org_name: org_name.trim(),
      p_user_id:  userId,
    });
    if (error) throw error;

    logger.info('Organization provisioned', { orgId: data, userId });
    return ok(res, { org_id: data }, 'Organization created');
  } catch (err) {
    logger.error('provisionOrganization error', { err: err.message });
    return serverError(res, err.message);
  }
}
