import nodemailer from 'nodemailer';
import { logger } from '../utils/logger.js';

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
        <p>You may apply again if needed via <a href="${APP_URL}">aurixcloud.in</a>.</p>
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
