import { z } from 'zod';
import { checkLimit } from '../services/permissionService.js';
import { supabase } from '../config/supabase.js';
import { ok, created, badRequest, forbidden, notFound, serverError } from '../utils/response.js';
import { logger } from '../utils/logger.js';
import { logAudit } from '../utils/auditLogger.js';

const REDIS_ENABLED = process.env.REDIS_ENABLED === 'true';

async function getInvoiceQueue() {
  if (!REDIS_ENABLED) return null;
  const { invoiceQueue } = await import('../queue/queues.js');
  return invoiceQueue;
}

const CreateInvoiceSchema = z.object({
  client_id: z.string().uuid(),
  amount:    z.number().positive(),
  due_date:  z.string(),
  status:    z.enum(['pending','paid','overdue','on_hold','cancelled']).default('pending'),
  items:     z.array(z.object({ description: z.string(), amount: z.number() })).optional(),
});

export async function createInvoice(req, res) {
  try {
    const { orgId, id: userId } = req.user;

    const limit = await checkLimit(orgId, 'invoice');
    if (!limit.allowed) return forbidden(res, limit.reason);

    const data = CreateInvoiceSchema.parse(req.body);

    // Validate client belongs to org
    const { data: client } = await supabase
      .from('clients').select('id').eq('id', data.client_id).eq('org_id', orgId).single();
    if (!client) return badRequest(res, 'Client not found in your organization');

    // Fetch org currency
    const { data: org } = await supabase
      .from('organizations').select('currency').eq('id', orgId).single();
    const currency = org?.currency || 'INR';

    const queue = await getInvoiceQueue();
    if (queue) {
      const job = await queue.add('create-invoice', { type: 'create', data: { ...data, currency }, orgId, userId });
      return created(res, { jobId: job.id }, 'Invoice creation queued');
    }

    // Direct insert when Redis is disabled
    const { data: invoice, error } = await supabase
      .from('invoices')
      .insert({
        client_id:  data.client_id,
        amount:     data.amount,
        due_date:   data.due_date,
        status:     data.status,
        org_id:     orgId,
        created_by: userId,
        currency,
      })
      .select().single();

    if (error) throw error;

    // Insert line items if provided
    if (data.items?.length) {
      await supabase.from('invoice_items').insert(
        data.items.map(item => ({ ...item, invoice_id: invoice.id }))
      );
    }

    logAudit({ orgId, actorId: userId, action: 'invoice.created', targetType: 'invoice', targetId: invoice.id, metadata: { amount: data.amount } });

    return created(res, invoice, 'Invoice created');
  } catch (err) {
    if (err.name === 'ZodError') return badRequest(res, err.errors.map(e => e.message).join('; '));
    logger.error('createInvoice error', { err: err.message });
    return serverError(res, err.message);
  }
}

export async function getInvoices(req, res) {
  try {
    const { orgId, role, id: userId } = req.user;

    // Staff (developer/support) cannot see invoices
    if (role === 'developer' || role === 'support') {
      return ok(res, []);
    }

    let query = supabase
      .from('invoices')
      .select('*, invoice_items(*)')
      .eq('org_id', orgId)
      .order('created_at', { ascending: false });

    // Clients only see their own invoices
    if (role === 'client') {
      const { data: client } = await supabase
        .from('clients').select('id').eq('user_id', userId).eq('org_id', orgId).single();
      if (!client) return ok(res, []);
      query = query.eq('client_id', client.id);
    }

    const { data, error } = await query;
    if (error) throw error;
    return ok(res, data ?? []);
  } catch (err) {
    logger.error('getInvoices error', { err: err.message });
    return serverError(res, err.message);
  }
}
