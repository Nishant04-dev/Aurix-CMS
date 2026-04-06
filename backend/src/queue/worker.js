import 'dotenv/config';
import { supabase } from '../config/supabase.js';
import { logger } from '../utils/logger.js';

// Worker only runs when Redis is available
if (process.env.REDIS_ENABLED !== 'true' || !process.env.REDIS_URL) {
  logger.warn('Worker: Redis not enabled — worker process exiting (not needed without Redis)');
  process.exit(0);
}

const { redis } = await import('../config/redis.js');

if (!redis) {
  logger.error('Worker: Redis connection failed — exiting');
  process.exit(1);
}

const { Worker } = await import('bullmq');

const workerOpts = {
  connection: redis,
  concurrency: parseInt(process.env.QUEUE_CONCURRENCY || '5'),
};

// ── Project Worker ────────────────────────────────────────────
const projectWorker = new Worker('projects', async (job) => {
  const { type, data, userId, orgId } = job.data;
  logger.info(`[projects] Processing job ${job.id}`, { type, orgId });

  if (type === 'create') {
    const { error } = await supabase.from('projects').insert({ ...data, org_id: orgId });
    if (error) throw new Error(error.message);
    await supabase.from('notifications').insert({
      user_id: userId,
      title: 'Project Created',
      message: `Project "${data.title}" has been created successfully.`,
    });
  }
  if (type === 'update') {
    const { error } = await supabase.from('projects').update(data).eq('id', data.id).eq('org_id', orgId);
    if (error) throw new Error(error.message);
  }
  if (type === 'delete') {
    const { error } = await supabase.from('projects').delete().eq('id', data.id).eq('org_id', orgId);
    if (error) throw new Error(error.message);
  }
}, workerOpts);

// ── File Worker ───────────────────────────────────────────────
const fileWorker = new Worker('files', async (job) => {
  const { type, data, userId, orgId } = job.data;
  if (type === 'register') {
    const { error } = await supabase.from('files').insert({ ...data, org_id: orgId, uploaded_by: userId });
    if (error) throw new Error(error.message);
  }
  if (type === 'delete') {
    if (data.storage_path) {
      await supabase.storage.from('project-files').remove([data.storage_path]);
    }
    const { error } = await supabase.from('files').delete().eq('id', data.id).eq('org_id', orgId);
    if (error) throw new Error(error.message);
  }
}, workerOpts);

// ── Invitation Worker ─────────────────────────────────────────
const inviteWorker = new Worker('invitations', async (job) => {
  const { displayId, roleName, type } = job.data;
  const { data, error } = await supabase.rpc('send_invitation', {
    p_display_id: displayId,
    p_role_name:  roleName,
    p_type:       type,
  });
  if (error) throw new Error(error.message);
  if (data?.error) throw new Error(data.error);
}, workerOpts);

// ── Invoice Worker ────────────────────────────────────────────
const invoiceWorker = new Worker('invoices', async (job) => {
  const { type, data, orgId } = job.data;
  if (type === 'create') {
    const { data: inv, error } = await supabase
      .from('invoices').insert({ ...data, org_id: orgId }).select().single();
    if (error) throw new Error(error.message);
    if (data.items?.length) {
      await supabase.from('invoice_items').insert(
        data.items.map((item) => ({ ...item, invoice_id: inv.id }))
      );
    }
  }
  if (type === 'update_status') {
    const { error } = await supabase.from('invoices')
      .update({ status: data.status }).eq('id', data.id).eq('org_id', orgId);
    if (error) throw new Error(error.message);
  }
}, workerOpts);

// ── Notification Worker ───────────────────────────────────────
const notifyWorker = new Worker('notifications', async (job) => {
  const { userId, title, message } = job.data;
  await supabase.from('notifications').insert({ user_id: userId, title, message });
}, workerOpts);

// ── Error handlers ────────────────────────────────────────────
[projectWorker, fileWorker, inviteWorker, invoiceWorker, notifyWorker].forEach(w => {
  w.on('completed', (job) => logger.info(`Job ${job.id} completed [${w.name}]`));
  w.on('failed',    (job, err) => logger.error(`Job ${job?.id} failed [${w.name}]`, { err: err.message }));
});

logger.info('All workers started');
