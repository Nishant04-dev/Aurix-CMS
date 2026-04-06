import { z } from 'zod';
import { invoiceQueue } from '../queue/queues.js';
import { checkLimit } from '../services/permissionService.js';
import { supabase } from '../config/supabase.js';
import { ok, created, badRequest, forbidden, serverError } from '../utils/response.js';
import { logger } from '../utils/logger.js';

const CreateInvoiceSchema = z.object({
  client_id:   z.string().uuid(),
  amount:      z.number().positive(),
  due_date:    z.string(),
  status:      z.enum(['pending','paid','overdue','on_hold','cancelled']).default('pending'),
  items:       z.array(z.object({ description: z.string(), amount: z.number() })).optional(),
});

export async function createInvoice(req, res) {
  try {
    const { orgId, id: userId } = req.user;

    const limit = await checkLimit(orgId, 'invoice');
    if (!limit.allowed) return forbidden(res, limit.reason);

    const data = CreateInvoiceSchema.parse(req.body);

    // Validate client belongs to org
    const { data: client } = await supabase
      .from('clients')
      .select('id')
      .eq('id', data.client_id)
      .eq('org_id', orgId)
      .single();

    if (!client) return badRequest(res, 'Client not found in your organization');

    const job = await invoiceQueue.add('create-invoice', { type: 'create', data, orgId, userId });
    return created(res, { jobId: job.id }, 'Invoice creation queued');
  } catch (err) {
    if (err.name === 'ZodError') return badRequest(res, err.errors.map(e => e.message).join('; '));
    logger.error('createInvoice error', { err: err.message });
    return serverError(res, err.message);
  }
}

export async function getInvoices(req, res) {
  try {
    const { orgId, role, id: userId } = req.user;

    if (role === 'developer' || role === 'support') {
      return ok(res, []);
    }

    let query = supabase
      .from('invoices')
      .select('*, invoice_items(*)')
      .eq('org_id', orgId)
      .order('created_at', { ascending: false });

    if (role === 'client') {
      const { data: client } = await supabase
        .from('clients').select('id').eq('user_id', userId).eq('org_id', orgId).single();
      if (!client) return ok(res, []);
      query = query.eq('client_id', client.id);
    }

    const { data, error } = await query;
    if (error) throw error;
    return ok(res, data);
  } catch (err) {
    return serverError(res, err.message);
  }
}
