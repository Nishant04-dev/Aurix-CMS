import { Router } from 'express';
import { authenticate, requireOrg, requirePermission, requireRole, requirePlatformOwner } from '../middlewares/auth.js';
import { rateLimiter, writeLimiter } from '../middlewares/rateLimiter.js';
import multer from 'multer';

import { getProfile, updateProfile }                                 from '../controllers/profileController.js';
import { getOrganization, updateOrganization, getUserOrganizations, switchOrganization } from '../controllers/organizationController.js';
import { createProject, getProjects, updateProject, deleteProject }  from '../controllers/projectController.js';
import { getTasks, createTask, updateTask, deleteTask }              from '../controllers/taskController.js';
import { getMessages, sendMessage, getLastMessages }               from '../controllers/messageController.js';
import { registerFile, deleteFile, getFiles }                        from '../controllers/fileController.js';
import { uploadFile, getPublicUrl, createSignedUrl, deleteFile as deleteStorageFile } from '../controllers/storageController.js';
import { sendInvitation, respondToInvitation, getMyInvitations, lookupUserByDisplayId } from '../controllers/invitationController.js';
import { createInvoice, getInvoices, updateInvoice, cancelInvoice, deleteInvoice, sendInvoiceByEmail } from '../controllers/invoiceController.js';
import { getQuotations, createQuotation, updateQuotation, convertToInvoice, deleteQuotation, getTemplates, sendQuotationByEmail } from '../controllers/quotationController.js';
import { getTaxes, createTax, deleteTax } from '../controllers/taxController.js';
import { getClients, createClient, updateClient, deleteClient }      from '../controllers/clientController.js';
import { getUsers, updateUser, deleteUser }                          from '../controllers/userController.js';
import { getRoles, createRole, updateRole, deleteRole }                          from '../controllers/roleController.js';
import { leaveOrganization, removeMember, banMember, unbanMember, getBannedMembers } from '../controllers/membershipController.js';
import { getAuditLogs, writeAuditLog }                               from '../controllers/auditLogsController.js';
import { createChannel, deleteChannel, addChannelMember, removeChannelMember, getChannels, sendMessage as sendChatMessage, getMessages as getChatMessages } from '../controllers/chatController.js';
import { setOrgStatus }                                              from '../controllers/orgController.js';
import { getPlanLimits, getPlans }                                   from '../controllers/planController.js';
import { getNotifications, markNotificationRead, markAllRead }       from '../controllers/notificationController.js';
import { provisionOrganization }                                     from '../controllers/onboardingController.js';
import { upgradeAccount }                                            from '../controllers/upgradeController.js';
import { changeUserRole }                                            from '../controllers/userController.js';
import { recoverPlatformOwnerAccess, getPlatformOwnerStatus }       from '../controllers/recoveryController.js';
import {
  getPlatformStats, getAllOrganizations, setPlatformOrgStatus,
  getSubscriptions, updateSubscription,
  getFeatureFlags, updateFeatureFlag,
  getPlatformTeam, addPlatformMember, removePlatformMember,
  getSupportConversations, createSupportConversation,
  getSupportMessages, sendSupportMessage, closeSupportConversation,
  getPlatformAuditLogs, getPlatformPermissions,
  getAllUsers, updateUserStatus,
} from '../controllers/platformController.js';

const router = Router();
const upload = multer({ storage: multer.memoryStorage() });

// All API routes require authentication + rate limiting
router.use(authenticate);
router.use(rateLimiter);

// ── Profile ───────────────────────────────────────────────────
router.get  ('/profile',       getProfile);
router.patch('/profile',       writeLimiter, updateProfile);

// ── Organizations ─────────────────────────────────────────────
router.get  ('/organizations',           requireOrg, getOrganization);
router.patch('/organizations',           requireOrg, writeLimiter, updateOrganization);
router.get  ('/organizations/mine',      getUserOrganizations);
router.post ('/organizations/switch',    writeLimiter, switchOrganization);

// ── Projects ──────────────────────────────────────────────────
router.get   ('/projects',        requireOrg, getProjects);
router.post  ('/projects',        requireOrg, writeLimiter, requirePermission('create_project'), createProject);
router.patch ('/projects/:id',    requireOrg, writeLimiter, requirePermission('edit_project'),   updateProject);
router.delete('/projects/:id',    requireOrg, writeLimiter, requirePermission('delete_project'), deleteProject);

// ── Tasks ─────────────────────────────────────────────────────
router.get   ('/tasks',           requireOrg, getTasks);
router.post  ('/tasks',           requireOrg, writeLimiter, createTask);
router.patch ('/tasks/:id',       requireOrg, writeLimiter, updateTask);
router.delete('/tasks/:id',       requireOrg, writeLimiter, deleteTask);

// ── Messages (project chat) ───────────────────────────────────
router.get  ('/messages',         requireOrg, getMessages);
router.get  ('/messages/last',    requireOrg, getLastMessages);
router.post ('/messages',         requireOrg, writeLimiter, sendMessage);

// ── Clients ───────────────────────────────────────────────────
router.get   ('/clients',         requireOrg, getClients);
router.post  ('/clients',         requireOrg, writeLimiter, requirePermission('manage_clients'), createClient);
router.patch ('/clients/:id',     requireOrg, writeLimiter, requirePermission('manage_clients'), updateClient);
router.delete('/clients/:id',     requireOrg, writeLimiter, requirePermission('manage_clients'), deleteClient);

// ── Files ─────────────────────────────────────────────────────
router.get   ('/files',           requireOrg, getFiles);
router.post  ('/files/upload',    requireOrg, writeLimiter, requirePermission('upload_files'),   registerFile);
router.delete('/files/:file_id',  requireOrg, writeLimiter, deleteFile);

// ── Invoices ──────────────────────────────────────────────────
router.get   ('/invoices',              requireOrg, getInvoices);
router.post  ('/invoices',              requireOrg, writeLimiter, createInvoice);
router.patch ('/invoices/:id',          requireOrg, writeLimiter, updateInvoice);
router.patch ('/invoices/:id/cancel',   requireOrg, writeLimiter, cancelInvoice);
router.delete('/invoices/:id',          requireOrg, writeLimiter, deleteInvoice);
router.post  ('/invoices/:id/send',     requireOrg, writeLimiter, sendInvoiceByEmail);

// ── Templates ─────────────────────────────────────────────────
router.get('/templates', requireOrg, getTemplates);

// ── Taxes ─────────────────────────────────────────────────────
router.get   ('/taxes',     requireOrg, getTaxes);
router.post  ('/taxes',     requireOrg, writeLimiter, createTax);
router.delete('/taxes/:id', requireOrg, writeLimiter, deleteTax);

// ── Quotations ────────────────────────────────────────────────
router.get   ('/quotations',                  requireOrg, getQuotations);
router.post  ('/quotations',                  requireOrg, writeLimiter, createQuotation);
router.patch ('/quotations/:id',              requireOrg, writeLimiter, updateQuotation);
router.post  ('/quotations/:id/convert',      requireOrg, writeLimiter, convertToInvoice);
router.delete('/quotations/:id',              requireOrg, writeLimiter, deleteQuotation);
router.post  ('/quotations/:id/send',         requireOrg, writeLimiter, sendQuotationByEmail);

// ── Roles ─────────────────────────────────────────────────────
router.get   ('/roles',           requireOrg, requirePermission('manage_roles'), getRoles);
router.post  ('/roles',           requireOrg, writeLimiter, requirePermission('manage_roles'), createRole);
router.patch ('/roles/:id',       requireOrg, writeLimiter, requirePermission('manage_roles'), updateRole);
router.delete('/roles/:id',       requireOrg, writeLimiter, requireRole('admin', 'super_admin'), deleteRole);

// ── Team / Users ──────────────────────────────────────────────
router.get   ('/users',           requireOrg, requirePermission('manage_users'), getUsers);
router.patch ('/users/:id',       requireOrg, writeLimiter, requirePermission('manage_users'), updateUser);
router.delete('/users/:id',       requireOrg, writeLimiter, requirePermission('manage_users'), deleteUser);
router.post  ('/users/:id/role',  requireOrg, writeLimiter, requireRole('admin','super_admin'), changeUserRole);

// ── Invitations ───────────────────────────────────────────────
router.get   ('/invitations',          getMyInvitations);
router.get   ('/invitations/lookup',   lookupUserByDisplayId);
router.post  ('/invitations/send',     requireOrg, writeLimiter, sendInvitation);
router.post  ('/invitations/respond',  respondToInvitation);

// ── Membership management ─────────────────────────────────────
router.post('/members/leave',   requireOrg, writeLimiter, leaveOrganization);
router.post('/members/remove',  requireOrg, writeLimiter, requireRole('admin', 'super_admin'), removeMember);
router.post('/members/ban',     requireOrg, writeLimiter, requireRole('admin', 'super_admin'), banMember);
router.post('/members/unban',   requireOrg, writeLimiter, requireRole('admin', 'super_admin'), unbanMember);
router.get ('/members/banned',  requireOrg, requireRole('admin', 'super_admin'), getBannedMembers);

// ── Audit logs ────────────────────────────────────────────────
router.get ('/audit-logs', requireOrg, requireRole('admin', 'super_admin'), getAuditLogs);
router.post('/audit-logs', requireOrg, writeLimiter, writeAuditLog);

// ── Chat channels ─────────────────────────────────────────────
router.get   ('/chat/channels',                              requireOrg, getChannels);
router.post  ('/chat/channels',                              requireOrg, writeLimiter, requireRole('admin','super_admin'), createChannel);
router.delete('/chat/channels/:channelId',                   requireOrg, writeLimiter, requireRole('admin','super_admin'), deleteChannel);
router.post  ('/chat/channels/:channelId/members',           requireOrg, writeLimiter, requireRole('admin','super_admin'), addChannelMember);
router.delete('/chat/channels/:channelId/members/:memberId', requireOrg, writeLimiter, requireRole('admin','super_admin'), removeChannelMember);
router.get   ('/chat/channels/:channelId/messages',          requireOrg, getChatMessages);
router.post  ('/chat/messages',                              requireOrg, writeLimiter, sendChatMessage);

// ── Plan limits & plans ───────────────────────────────────────
router.get('/plan/limits', requireOrg, getPlanLimits);
router.get('/plans',       getPlans);

// ── Notifications ─────────────────────────────────────────────
router.get  ('/notifications',          getNotifications);
router.patch('/notifications/:id/read', writeLimiter, markNotificationRead);
router.post ('/notifications/read-all', writeLimiter, markAllRead);

// ── Platform admin (org status) ───────────────────────────────
router.post('/platform/org-status', requirePlatformOwner, writeLimiter, setOrgStatus);

// ── Onboarding ────────────────────────────────────────────────
router.post('/onboarding/provision', writeLimiter, provisionOrganization);

// ── Upgrade (single atomic endpoint — preferred over /onboarding/provision) ──
router.post('/upgrade', writeLimiter, upgradeAccount);

// ── Platform owner recovery ───────────────────────────────────
router.get ('/recovery/status',  requirePlatformOwner, getPlatformOwnerStatus);
router.post('/recovery/restore', requirePlatformOwner, writeLimiter, recoverPlatformOwnerAccess);

// ── Platform admin routes (platform owner only) ───────────────
router.get  ('/platform/stats',                    requirePlatformOwner, getPlatformStats);
router.get  ('/platform/organizations',            requirePlatformOwner, getAllOrganizations);
router.post ('/platform/organizations/status',     requirePlatformOwner, writeLimiter, setPlatformOrgStatus);
router.get  ('/platform/subscriptions',            requirePlatformOwner, getSubscriptions);
router.patch('/platform/subscriptions/:id',        requirePlatformOwner, writeLimiter, updateSubscription);
router.get  ('/platform/feature-flags',            requirePlatformOwner, getFeatureFlags);
router.patch('/platform/feature-flags/:id',        requirePlatformOwner, writeLimiter, updateFeatureFlag);
router.get  ('/platform/team',                     requirePlatformOwner, getPlatformTeam);
router.post ('/platform/team',                     requirePlatformOwner, writeLimiter, addPlatformMember);
router.delete('/platform/team/:id',                requirePlatformOwner, writeLimiter, removePlatformMember);
router.get  ('/platform/support',                  requirePlatformOwner, getSupportConversations);
router.post ('/platform/support',                  writeLimiter, createSupportConversation);
router.get  ('/platform/support/messages',         requirePlatformOwner, getSupportMessages);
router.post ('/platform/support/messages',         writeLimiter, sendSupportMessage);
router.patch('/platform/support/:id/close',        requirePlatformOwner, writeLimiter, closeSupportConversation);
router.get  ('/platform/permissions',              getPlatformPermissions);
router.get  ('/platform/audit-logs',               requirePlatformOwner, getPlatformAuditLogs);

// ── Platform users ────────────────────────────────────────────
router.get  ('/platform/users',           requirePlatformOwner, getAllUsers);
router.patch('/platform/users/:id/status', requirePlatformOwner, writeLimiter, updateUserStatus);

// ── Storage ───────────────────────────────────────────────────
router.post('/storage/upload',     requireOrg, writeLimiter, upload.single('file'), uploadFile);
router.get ('/storage/public-url', requireOrg, getPublicUrl);
router.post('/storage/signed-url', requireOrg, writeLimiter, createSignedUrl);
router.post('/storage/delete',     requireOrg, writeLimiter, deleteStorageFile);

export default router;
