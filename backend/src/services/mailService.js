import nodemailer from 'nodemailer';
import { logger } from '../utils/logger.js';

/** Timezone-safe date formatter — matches frontend formatDate() */
function formatDate(date) {
  if (!date) return 'N/A';
  try {
    const iso = String(date).length > 10 ? String(date).slice(0, 10) : String(date);
    const d = new Date(iso + 'T00:00:00');
    if (isNaN(d.getTime())) return 'N/A';
    return new Intl.DateTimeFormat('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }).format(d);
  } catch { return 'N/A'; }
}

const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, APP_URL } = process.env;
const smtpConfigured = Boolean(SMTP_HOST && SMTP_PORT && SMTP_USER && SMTP_PASS);

logger.info('SMTP CONFIG', { host: SMTP_HOST, port: SMTP_PORT, user: SMTP_USER ? 'yes' : 'no' });

let transporter = null;
if (smtpConfigured) {
  transporter = nodemailer.createTransport({
    host: SMTP_HOST,
    port: Number(SMTP_PORT),
    secure: Number(SMTP_PORT) === 465,
    auth: {
      user: SMTP_USER,
      pass: SMTP_PASS,
    },
  });

  transporter.verify((err) => {
    if (err) {
      logger.warn('SMTP connection failed', { error: err.message });
    } else {
      logger.info('SMTP READY ✓');
    }
  });
} else {
  logger.warn('SMTP not configured - email delivery disabled');
}

/**
 * Send a generic email
 */
export async function sendMail({ to, subject, html, text }) {
  if (!transporter) {
    logger.warn('sendMail skipped because SMTP is not configured', { to, subject });
    return Promise.resolve();
  }

  return transporter.sendMail({
    from: `"Aurix" <${SMTP_USER}>`,
    to,
    subject,
    html,
    text,
  });
}

/**
 * Org rejected notification
 */
export async function sendOrgRejectedEmail(toEmail, orgName) {
  return sendMail({
    to: toEmail,
    subject: 'Your Organization Request Was Rejected',
    html: `
      <div style="font-family:sans-serif;max-width:480px;margin:0 auto">
        <h2 style="color:#e11d48">Organization Request Rejected</h2>
        <p>Hello,</p>
        <p>Your organization <strong>${orgName}</strong> request has been rejected by Aurix.</p>
        <p>You no longer have access to this workspace.</p>
        <p>If you believe this was a mistake, please <a href="${APP_URL}/support">contact support</a>.</p>
        <br/>
        <p>— Aurix Team</p>
      </div>
    `,
    text: `Your organization "${orgName}" request has been rejected. Contact support if you believe this was a mistake.`,
  });
}

/**
 * Org banned / deleted notification
 */
export async function sendOrgBannedEmail(toEmail, orgName) {
  return sendMail({
    to: toEmail,
    subject: 'Your Organization Has Been Removed',
    html: `
      <div style="font-family:sans-serif;max-width:480px;margin:0 auto">
        <h2 style="color:#e11d48">Organization Removed</h2>
        <p>Hello,</p>
        <p>Your organization <strong>${orgName}</strong> has been removed from Aurix.</p>
        <p>All associated data has been permanently deleted.</p>
        <p>You may apply again if needed via <a href="${APP_URL}">Aurix</a>.</p>
        <br/>
        <p>— Aurix Team</p>
      </div>
    `,
    text: `Your organization "${orgName}" has been removed from Aurix. All data has been deleted.`,
  });
}

/**
 * Org suspended notification
 */
export async function sendOrgSuspendedEmail(toEmail, orgName) {
  return sendMail({
    to: toEmail,
    subject: 'Your Organization Has Been Suspended',
    html: `
      <div style="font-family:sans-serif;max-width:480px;margin:0 auto">
        <h2 style="color:#f59e0b">Organization Suspended</h2>
        <p>Hello,</p>
        <p>Your organization <strong>${orgName}</strong> has been temporarily suspended.</p>
        <p>Please <a href="${APP_URL}/support">contact support</a> to resolve this.</p>
        <br/>
        <p>— Aurix Team</p>
      </div>
    `,
    text: `Your organization "${orgName}" has been suspended. Contact support to resolve this.`,
  });
}

/**
 * Invitation email
 */
export async function sendInvitationEmail(toEmail, orgName, inviterName, role) {
  return sendMail({
    to: toEmail,
    subject: `You've been invited to join ${orgName} on Aurix`,
    html: `
      <div style="font-family:sans-serif;max-width:480px;margin:0 auto">
        <h2>You're Invited!</h2>
        <p><strong>${inviterName}</strong> has invited you to join <strong>${orgName}</strong> as <strong>${role}</strong>.</p>
        <p><a href="${APP_URL}/invitations" style="background:#6366f1;color:white;padding:10px 20px;border-radius:6px;text-decoration:none;display:inline-block;margin-top:12px">Accept Invitation</a></p>
        <br/>
        <p>— Aurix Team</p>
      </div>
    `,
    text: `${inviterName} invited you to join ${orgName} as ${role}. Visit ${APP_URL}/invitations to accept.`,
  });
}

/**
 * Send invoice to client
 */
export async function sendInvoiceEmail({ toEmail, clientName, orgName, invoiceId, amount, currency, dueDate, appUrl }) {
  const fmt = (n) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: currency || 'INR' }).format(n);
  const due = formatDate(dueDate);
  const ref = invoiceId.slice(0, 8).toUpperCase();
  return sendMail({
    to: toEmail,
    subject: `Invoice #${ref} from ${orgName}`,
    html: `
      <div style="font-family:sans-serif;max-width:520px;margin:0 auto;color:#1e293b">
        <div style="background:#6366f1;padding:24px 32px;border-radius:12px 12px 0 0">
          <h1 style="color:#fff;margin:0;font-size:22px">${orgName}</h1>
          <p style="color:#c7d2fe;margin:4px 0 0">Invoice</p>
        </div>
        <div style="background:#f8fafc;padding:32px;border-radius:0 0 12px 12px;border:1px solid #e2e8f0;border-top:none">
          <p>Hi <strong>${clientName}</strong>,</p>
          <p>Please find your invoice details below:</p>
          <table style="width:100%;border-collapse:collapse;margin:16px 0">
            <tr><td style="padding:8px 0;color:#64748b">Invoice #</td><td style="padding:8px 0;font-weight:600">${ref}</td></tr>
            <tr><td style="padding:8px 0;color:#64748b">Amount</td><td style="padding:8px 0;font-weight:700;color:#6366f1;font-size:18px">${fmt(amount)}</td></tr>
            <tr><td style="padding:8px 0;color:#64748b">Due Date</td><td style="padding:8px 0">${due}</td></tr>
          </table>
          <a href="${appUrl || APP_URL}/invoices" style="display:inline-block;background:#6366f1;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:600;margin-top:8px">View Invoice</a>
          <p style="margin-top:24px;color:#94a3b8;font-size:12px">— ${orgName} via Aurix</p>
        </div>
      </div>
    `,
    text: `Invoice #${ref} from ${orgName}. Amount: ${fmt(amount)}. Due: ${due}. View at ${appUrl || APP_URL}/invoices`,
  });
}

/**
 * Send quotation to client
 */
export async function sendQuotationEmail({ toEmail, clientName, orgName, quotationId, title, amount, currency, dueDate, appUrl }) {
  const fmt = (n) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: currency || 'INR' }).format(n);
  const due = formatDate(dueDate);
  const ref = quotationId.slice(0, 8).toUpperCase();
  return sendMail({
    to: toEmail,
    subject: `Quotation #${ref} from ${orgName}`,
    html: `
      <div style="font-family:sans-serif;max-width:520px;margin:0 auto;color:#1e293b">
        <div style="background:#0ea5e9;padding:24px 32px;border-radius:12px 12px 0 0">
          <h1 style="color:#fff;margin:0;font-size:22px">${orgName}</h1>
          <p style="color:#bae6fd;margin:4px 0 0">Quotation — ${title || 'Proposal'}</p>
        </div>
        <div style="background:#f8fafc;padding:32px;border-radius:0 0 12px 12px;border:1px solid #e2e8f0;border-top:none">
          <p>Hi <strong>${clientName}</strong>,</p>
          <p>Please review the quotation below:</p>
          <table style="width:100%;border-collapse:collapse;margin:16px 0">
            <tr><td style="padding:8px 0;color:#64748b">Reference #</td><td style="padding:8px 0;font-weight:600">${ref}</td></tr>
            <tr><td style="padding:8px 0;color:#64748b">Total</td><td style="padding:8px 0;font-weight:700;color:#0ea5e9;font-size:18px">${fmt(amount)}</td></tr>
            <tr><td style="padding:8px 0;color:#64748b">Valid Until</td><td style="padding:8px 0">${due}</td></tr>
          </table>
          <a href="${appUrl || APP_URL}/quotations" style="display:inline-block;background:#0ea5e9;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:600;margin-top:8px">View Quotation</a>
          <p style="margin-top:24px;color:#94a3b8;font-size:12px">— ${orgName} via Aurix</p>
        </div>
      </div>
    `,
    text: `Quotation #${ref} from ${orgName}. Total: ${fmt(amount)}. Valid until: ${due}. View at ${appUrl || APP_URL}/quotations`,
  });
}
