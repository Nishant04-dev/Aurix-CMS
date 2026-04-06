import { supabase } from '../config/supabase.js';
import { ok, badRequest, forbidden, serverError } from '../utils/response.js';
import { sendOrgRejectedEmail, sendOrgBannedEmail, sendOrgSuspendedEmail } from '../services/mailService.js';
import { logger } from '../utils/logger.js';

const VALID_STATUSES = ['approved', 'rejected', 'pending', 'suspended', 'banned'];

export async function setOrgStatus(req, res) {
  try {
    const { org_id, status } = req.body;

    if (!org_id || !status) return badRequest(res, 'org_id and status are required');
    if (!VALID_STATUSES.includes(status)) return badRequest(res, 'Invalid status');

    // Fetch org + owner email before updating
    const { data: org, error: orgErr } = await supabase
      .from('organizations')
      .select('id, name, owner_id, status')
      .eq('id', org_id)
      .maybeSingle();

    if (orgErr || !org) return badRequest(res, 'Organization not found');

    // Get owner email
    const { data: owner } = await supabase
      .from('profiles')
      .select('email, name')
      .eq('id', org.owner_id)
      .maybeSingle();

    // Update status via RPC (handles member cleanup)
    const { error } = await supabase.rpc('set_org_status', {
      p_org_id: org_id,
      p_status: status,
    });
    if (error) throw error;

    // Send email notification
    if (owner?.email) {
      try {
        if (status === 'rejected') {
          await sendOrgRejectedEmail(owner.email, org.name);
        } else if (status === 'banned') {
          await sendOrgBannedEmail(owner.email, org.name);
        } else if (status === 'suspended') {
          await sendOrgSuspendedEmail(owner.email, org.name);
        }
      } catch (mailErr) {
        logger.warn('Email send failed (non-fatal):', mailErr.message);
      }
    }

    logger.info('Org status updated', { org_id, status, by: req.user?.id });
    return ok(res, { org_id, status }, `Organization ${status} successfully`);
  } catch (err) {
    logger.error('setOrgStatus error', { err: err.message });
    return serverError(res, err.message);
  }
}
