import { z } from 'zod';
import { supabase } from '../config/supabase.js';
import { ok, created, badRequest, forbidden, notFound, serverError } from '../utils/response.js';
import { logger } from '../utils/logger.js';
import { logAudit } from '../utils/auditLogger.js';

const ItemSchema = z.object({
  description: z.string().min(1),
  quantity:    z.number().positive().default(1),
  unit_price:  z.number().min(0),
});

const CreateQuotationSchema = z.object({
  client_id:   z.string().uuid(),
  template_id: z.string().uuid().optional().nullable(),
  title:       z.string().min(1).max(200).default('Quotation'),
  due_date:    z.string().optional().nullable(),
  notes:       z.string().max(2000).optional().nullable(),
  items:       z.array(ItemSchema).min(1),
});

// ── Get all quotations ────────────────────────────────────────
export async function getQuotations(req, res) {
  try {
    const { orgId, role, id: userId } = req.user;

    if (role === 'developer' || role === 'support') return ok(res, []);

    let query = supabase
      .from('quotations')
      .select('*, quotation_items(*)')
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
    return ok(res, data ?? []);
  } catch (err) {
    logger.error('getQuotations error', { err: err.message });
    return serverError(res, err.message);
  }
}

// ── Create quotation ──────────────────────────────────────────
export async function createQuotation(req, res) {
  try {
    const { orgId, id: userId, role } = req.user;

    if (!['admin', 'super_admin', 'manager'].includes(role)) {
      return forbidden(res, 'Insufficient permissions to create quotations');
    }

    const data = CreateQuotationSchema.parse(req.body);

    const { data: client } = await supabase
      .from('clients').select('id').eq('id', data.client_id).eq('org_id', orgId).single();
    if (!client) return badRequest(res, 'Client not found in your organization');

    // Validate template access if provided
    if (data.template_id) {
      const { data: org } = await supabase.from('organizations').select('plan').eq('id', orgId).single();
      const { data: tmpl } = await supabase.from('templates').select('plan_required').eq('id', data.template_id).single();
      if (tmpl) {
        const planOrder = { free: 0, pro: 1, enterprise: 2 };
        const orgPlan = org?.plan || 'free';
        if ((planOrder[tmpl.plan_required] ?? 0) > (planOrder[orgPlan] ?? 0)) {
          return forbidden(res, `Template requires ${tmpl.plan_required} plan. Upgrade to use it.`);
        }
      }
    }

    const { data: org } = await supabase.from('organizations').select('currency').eq('id', orgId).single();
    const currency = org?.currency || 'INR';
    const total = data.items.reduce((s, i) => s + i.quantity * i.unit_price, 0);

    const { data: quotation, error } = await supabase
      .from('quotations')
      .insert({
        org_id:      orgId,
        client_id:   data.client_id,
        template_id: data.template_id || null,
        title:       data.title,
        due_date:    data.due_date || null,
        notes:       data.notes || null,
        amount:      total,
        currency,
        created_by:  userId,
      })
      .select().single();

    if (error) throw error;

    await supabase.from('quotation_items').insert(
      data.items.map(i => ({ quotation_id: quotation.id, description: i.description, quantity: i.quantity, unit_price: i.unit_price }))
    );

    logAudit({ orgId, actorId: userId, action: 'quotation.created', targetType: 'quotation', targetId: quotation.id });
    return created(res, quotation, 'Quotation created');
  } catch (err) {
    if (err.name === 'ZodError') return badRequest(res, err.errors.map(e => e.message).join('; '));
    logger.error('createQuotation error', { err: err.message });
    return serverError(res, err.message);
  }
}

// ── Update quotation status ───────────────────────────────────
export async function updateQuotation(req, res) {
  try {
    const { orgId, id: userId, role } = req.user;
    const { id } = req.params;

    if (!['admin', 'super_admin', 'manager'].includes(role)) {
      return forbidden(res, 'Insufficient permissions');
    }

    const { status, title, notes, due_date } = req.body;
    const VALID = ['draft','sent','accepted','rejected'];
    if (status && !VALID.includes(status)) return badRequest(res, 'Invalid status');

    const { data: existing } = await supabase
      .from('quotations').select('id, status').eq('id', id).eq('org_id', orgId).maybeSingle();
    if (!existing) return notFound(res, 'Quotation not found');
    if (existing.status === 'converted') return badRequest(res, 'Converted quotations cannot be edited');

    const updates = { updated_at: new Date().toISOString() };
    if (status)   updates.status   = status;
    if (title)    updates.title    = title;
    if (notes !== undefined) updates.notes = notes;
    if (due_date !== undefined) updates.due_date = due_date;

    const { data, error } = await supabase
      .from('quotations').update(updates).eq('id', id).eq('org_id', orgId).select().single();
    if (error) throw error;

    logAudit({ orgId, actorId: userId, action: 'quotation.updated', targetType: 'quotation', targetId: id });
    return ok(res, data, 'Quotation updated');
  } catch (err) {
    logger.error('updateQuotation error', { err: err.message });
    return serverError(res, err.message);
  }
}

// ── Convert quotation → invoice ───────────────────────────────
export async function convertToInvoice(req, res) {
  try {
    const { orgId, id: userId, role } = req.user;
    const { id } = req.params;

    if (!['admin', 'super_admin', 'manager'].includes(role)) {
      return forbidden(res, 'Insufficient permissions');
    }

    const { data: quotation } = await supabase
      .from('quotations')
      .select('*, quotation_items(*)')
      .eq('id', id).eq('org_id', orgId).maybeSingle();

    if (!quotation) return notFound(res, 'Quotation not found');
    if (quotation.status === 'converted') return badRequest(res, 'Already converted to invoice');
    if (quotation.status === 'rejected')  return badRequest(res, 'Rejected quotations cannot be converted');

    // Create invoice from quotation
    const { data: invoice, error: invErr } = await supabase
      .from('invoices')
      .insert({
        org_id:     orgId,
        client_id:  quotation.client_id,
        amount:     quotation.amount,
        currency:   quotation.currency,
        due_date:   quotation.due_date,
        status:     'pending',
        created_by: userId,
      })
      .select().single();

    if (invErr) throw invErr;

    // Copy items
    if (quotation.quotation_items?.length) {
      await supabase.from('invoice_items').insert(
        quotation.quotation_items.map(i => ({
          invoice_id:  invoice.id,
          description: i.description,
          amount:      i.amount,
        }))
      );
    }

    // Mark quotation as converted
    await supabase.from('quotations')
      .update({ status: 'converted', invoice_id: invoice.id, updated_at: new Date().toISOString() })
      .eq('id', id).eq('org_id', orgId);

    logAudit({ orgId, actorId: userId, action: 'quotation.converted', targetType: 'quotation', targetId: id, metadata: { invoice_id: invoice.id } });
    return created(res, { quotation_id: id, invoice }, 'Quotation converted to invoice');
  } catch (err) {
    logger.error('convertToInvoice error', { err: err.message });
    return serverError(res, err.message);
  }
}

// ── Delete quotation ──────────────────────────────────────────
export async function deleteQuotation(req, res) {
  try {
    const { orgId, id: userId, role } = req.user;
    const { id } = req.params;

    if (!['admin', 'super_admin'].includes(role)) {
      return forbidden(res, 'Only admins can delete quotations');
    }

    const { data: existing } = await supabase
      .from('quotations').select('id').eq('id', id).eq('org_id', orgId).maybeSingle();
    if (!existing) return notFound(res, 'Quotation not found');

    await supabase.from('quotation_items').delete().eq('quotation_id', id);
    await supabase.from('quotations').delete().eq('id', id).eq('org_id', orgId);

    logAudit({ orgId, actorId: userId, action: 'quotation.deleted', targetType: 'quotation', targetId: id });
    return ok(res, null, 'Quotation deleted');
  } catch (err) {
    logger.error('deleteQuotation error', { err: err.message });
    return serverError(res, err.message);
  }
}

// ── Get templates (plan-filtered) ─────────────────────────────
export async function getTemplates(req, res) {
  try {
    const { orgId } = req.user;
    const { data: org } = await supabase.from('organizations').select('plan').eq('id', orgId).single();
    const orgPlan = org?.plan || 'free';
    const planOrder = { free: 0, pro: 1, enterprise: 2 };
    const orgLevel = planOrder[orgPlan] ?? 0;

    const { data, error } = await supabase.from('templates').select('*').order('plan_required');
    if (error) throw error;

    // Mark each template as accessible or locked
    const templates = (data ?? []).map(t => ({
      ...t,
      locked: (planOrder[t.plan_required] ?? 0) > orgLevel,
    }));

    return ok(res, templates);
  } catch (err) {
    logger.error('getTemplates error', { err: err.message });
    return serverError(res, err.message);
  }
}
