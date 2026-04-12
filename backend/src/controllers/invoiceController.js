import { z } from 'zod';
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

/** Round to 2 decimal places — eliminates floating point drift */
const round2 = (n) => Math.round(n * 100) / 100;

const ItemSchema = z.object({
  description: z.string().min(1, 'Item description is required'),
  quantity:    z.number().positive('Quantity must be greater than 0'),
  unit_price:  z.number().min(0, 'Unit price cannot be negative'),
});

const TaxRefSchema = z.object({
  id:         z.string().uuid(),
  name:       z.string().min(1),
  percentage: z.number().min(0).max(100),
  // amount is intentionally NOT accepted from frontend — recomputed server-side
});

const CreateInvoiceSchema = z.object({
  client_id:    z.string().uuid(),
  project_id:   z.string().uuid().optional().nullable(),
  due_date:     z.string().min(1, 'Due date is required'),
  description:  z.string().optional().nullable(),
  status:       z.enum(['pending','paid','overdue','on_hold','cancelled']).default('pending'),
  tax_snapshot: z.array(TaxRefSchema).optional().default([]),
  items:        z.array(ItemSchema).min(1, 'At least one item is required'),
});

export async function createInvoice(req, res) {
  try {
    const { orgId, id: userId } = req.user;

    const data = CreateInvoiceSchema.parse(req.body);

    // Validate due_date >= issue_date (today)
    if (data.due_date) {
      const due      = new Date(data.due_date + 'T00:00:00');
      if (isNaN(due.getTime())) return badRequest(res, 'Invalid due_date format. Use YYYY-MM-DD');
      const issueDate = new Date(new Date().toISOString().slice(0, 10) + 'T00:00:00');
      if (due < issueDate) return badRequest(res, 'due_date cannot be before the issue date (today)');
    }

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

    // ── Server-side financial computation (never trust frontend totals) ──
    // 1. Compute each item's amount independently, rounded to 2dp
    const computedItems = data.items.map(item => ({
      description: item.description,
      quantity:    item.quantity,
      unit_price:  round2(item.unit_price),
      amount:      round2(item.quantity * item.unit_price),
    }));

    // 2. Subtotal = sum of item amounts (already rounded individually)
    const subtotal = round2(computedItems.reduce((s, i) => s + i.amount, 0));

    // 3. Recompute each tax amount from subtotal × percentage (ignore frontend amount)
    const computedTaxes = data.tax_snapshot.map(t => ({
      id:         t.id,
      name:       t.name,
      percentage: t.percentage,
      amount:     round2(subtotal * t.percentage / 100),
    }));

    // 4. Total = subtotal + sum of tax amounts
    const taxTotal    = round2(computedTaxes.reduce((s, t) => s + t.amount, 0));
    const finalAmount = round2(subtotal + taxTotal);

    // Direct insert when Redis is disabled
    const issueDate = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
    const { data: invoice, error } = await supabase
      .from('invoices')
      .insert({
        client_id:    data.client_id,
        project_id:   data.project_id || null,
        amount:       finalAmount,
        issue_date:   issueDate,
        due_date:     data.due_date,
        status:       data.status,
        description:  data.description || null,
        tax_snapshot: computedTaxes,
        org_id:       orgId,
        created_by:   userId,
        currency,
      })
      .select().single();

    if (error) throw error;

    // Insert line items with server-computed amounts
    await supabase.from('invoice_items').insert(
      computedItems.map(item => ({ ...item, invoice_id: invoice.id }))
    );

    logAudit({ orgId, actorId: userId, action: 'invoice.created', targetType: 'invoice', targetId: invoice.id, metadata: { amount: finalAmount, subtotal, items: computedItems.length } });

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
      .select('*, invoice_items(*), client:clients(id, name, company, email, phone, address), project:projects(id, title)')
      .eq('org_id', orgId)
      .order('created_at', { ascending: false });

    // Clients only see their own invoices
    if (role === 'client') {
      const { data: client } = await supabase
        .from('clients').select('id').eq('user_id', userId).eq('org_id', orgId).maybeSingle();
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

export async function updateInvoice(req, res) {
  try {
    const { orgId, id: userId, role } = req.user;
    const { id } = req.params;
    const { status } = req.body;

    if (!['admin', 'super_admin', 'manager'].includes(role)) {
      return forbidden(res, 'Insufficient permissions to update invoices');
    }

    const VALID_STATUSES = ['pending', 'paid', 'overdue', 'on_hold', 'cancelled'];
    if (status && !VALID_STATUSES.includes(status)) {
      return badRequest(res, `Invalid status. Must be one of: ${VALID_STATUSES.join(', ')}`);
    }

    const { data: existing } = await supabase
      .from('invoices').select('id').eq('id', id).eq('org_id', orgId).maybeSingle();
    if (!existing) return notFound(res, 'Invoice not found');

    const { data: invoice, error } = await supabase
      .from('invoices')
      .update({ status, updated_at: new Date().toISOString() })
      .eq('id', id).eq('org_id', orgId)
      .select().single();

    if (error) throw error;

    logAudit({ orgId, actorId: userId, action: 'invoice.updated', targetType: 'invoice', targetId: id, metadata: { status } });
    return ok(res, invoice, 'Invoice updated');
  } catch (err) {
    logger.error('updateInvoice error', { err: err.message });
    return serverError(res, err.message);
  }
}

export async function cancelInvoice(req, res) {
  try {
    const { orgId, id: userId, role } = req.user;
    const { id } = req.params;

    if (!['admin', 'super_admin', 'manager'].includes(role)) {
      return forbidden(res, 'Insufficient permissions to cancel invoices');
    }

    const { data: existing } = await supabase
      .from('invoices').select('id, status').eq('id', id).eq('org_id', orgId).maybeSingle();
    if (!existing) return notFound(res, 'Invoice not found');
    if (existing.status === 'cancelled') return badRequest(res, 'Invoice is already cancelled');

    const { data: invoice, error } = await supabase
      .from('invoices')
      .update({ status: 'cancelled', updated_at: new Date().toISOString() })
      .eq('id', id).eq('org_id', orgId)
      .select().single();

    if (error) throw error;

    logAudit({ orgId, actorId: userId, action: 'invoice.cancelled', targetType: 'invoice', targetId: id });
    return ok(res, invoice, 'Invoice cancelled');
  } catch (err) {
    logger.error('cancelInvoice error', { err: err.message });
    return serverError(res, err.message);
  }
}

export async function deleteInvoice(req, res) {
  try {
    const { orgId, id: userId, role } = req.user;
    const { id } = req.params;

    if (!['admin', 'super_admin'].includes(role)) {
      return forbidden(res, 'Only admins can delete invoices');
    }

    const { data: existing } = await supabase
      .from('invoices').select('id').eq('id', id).eq('org_id', orgId).maybeSingle();
    if (!existing) return notFound(res, 'Invoice not found');

    // Delete line items first
    await supabase.from('invoice_items').delete().eq('invoice_id', id);

    // Null out any quotation references to avoid FK constraint violation
    await supabase.from('quotations')
      .update({ invoice_id: null })
      .eq('invoice_id', id);

    const { error } = await supabase.from('invoices').delete().eq('id', id).eq('org_id', orgId);
    if (error) throw error;

    logAudit({ orgId, actorId: userId, action: 'invoice.deleted', targetType: 'invoice', targetId: id });
    return ok(res, null, 'Invoice deleted');
  } catch (err) {
    logger.error('deleteInvoice error', { err: err.message });
    return serverError(res, err.message);
  }
}

export async function sendInvoiceByEmail(req, res) {
  try {
    const { orgId, role } = req.user;
    const { id } = req.params;

    if (!['admin', 'super_admin', 'manager'].includes(role)) {
      return forbidden(res, 'Insufficient permissions');
    }

    const { data: invoice } = await supabase
      .from('invoices').select('id, amount, currency, issue_date, due_date, client_id, org_id')
      .eq('id', id).eq('org_id', orgId).maybeSingle();
    if (!invoice) return notFound(res, 'Invoice not found');

    const [{ data: client }, { data: org }] = await Promise.all([
      supabase.from('clients').select('name, email').eq('id', invoice.client_id).single(),
      supabase.from('organizations').select('name').eq('id', orgId).single(),
    ]);

    if (!client?.email) return badRequest(res, 'Client has no email address');

    const { sendInvoiceEmail } = await import('../services/mailService.js');
    await sendInvoiceEmail({
      toEmail:    client.email,
      clientName: client.name,
      orgName:    org?.name || 'Your Agency',
      invoiceId:  invoice.id,
      amount:     invoice.amount,
      currency:   invoice.currency,
      dueDate:    invoice.due_date,
      appUrl:     process.env.APP_URL,
    });

    logAudit({ orgId, actorId: req.user.id, action: 'invoice.emailed', targetType: 'invoice', targetId: id });
    return ok(res, null, `Invoice sent to ${client.email}`);
  } catch (err) {
    logger.error('sendInvoiceByEmail error', { err: err.message });
    return serverError(res, err.message);
  }
}
