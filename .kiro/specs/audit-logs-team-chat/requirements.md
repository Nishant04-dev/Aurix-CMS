# Requirements Document

## Introduction

This document defines requirements for the Audit Logs & Team Chat System on the Aurix platform. The system adds two capabilities scoped to organizations: a structured, tamper-evident audit log that records all critical org-level actions for admin review, and a real-time team chat system enabling org members to communicate through persistent channels. Both features integrate with the existing membership and invitation lifecycle, are gated by RBAC, and enforce org-level data isolation.

## Glossary

- **Audit_Log_System**: The backend and frontend subsystem responsible for recording and displaying org-level audit events.
- **Chat_System**: The backend and frontend subsystem responsible for channel-based real-time messaging.
- **logAudit**: The shared backend helper function that writes a row to `audit_logs`. It is fire-and-forget and never throws.
- **audit_logs**: The Postgres table storing all audit events.
- **chat_channels**: The Postgres table storing channel definitions scoped to an org.
- **channel_members**: The Postgres table storing the many-to-many relationship between channels and users.
- **messages**: The Postgres table storing chat messages.
- **AuditAction**: An enumerated set of string values representing recordable events (e.g., `member.removed`, `invite.sent`).
- **Actor**: The authenticated user who performed an action that generated an audit event.
- **Target**: The entity (user, org, invitation, role, or channel) that an audit event refers to.
- **Channel**: A named, org-scoped conversation thread in the Chat_System.
- **Org_Admin**: A user whose role is `admin` or `super_admin` within an organization.
- **Active_Member**: A user whose `profiles.org_id` matches the current org and who is not banned.
- **Supabase_Realtime**: The Supabase WebSocket-based broadcast mechanism used to push new messages to subscribed clients.
- **RLS**: Row-Level Security policies enforced by Postgres/Supabase to restrict data access at the database layer.

---

## Requirements

### Requirement 1: Audit Log Database Table and Indexes

**User Story:** As a platform engineer, I want a dedicated `audit_logs` table with appropriate indexes, so that audit events can be stored and queried efficiently without degrading application performance.

#### Acceptance Criteria

1. THE Audit_Log_System SHALL create an `audit_logs` table with columns: `id` (uuid, primary key), `org_id` (uuid, FK to `organizations`, ON DELETE CASCADE), `actor_id` (uuid, FK to `profiles`, ON DELETE SET NULL), `action` (text, not null), `target_type` (text, not null), `target_id` (uuid, nullable), `metadata` (jsonb, default `{}`), `created_at` (timestamptz, default `now()`).
2. THE Audit_Log_System SHALL create an index on `audit_logs(org_id)` to support org-scoped queries.
3. THE Audit_Log_System SHALL create an index on `audit_logs(actor_id)` to support actor-filtered queries.
4. THE Audit_Log_System SHALL create an index on `audit_logs(action)` to support action-type-filtered queries.
5. THE Audit_Log_System SHALL create an index on `audit_logs(created_at DESC)` to support time-ordered pagination.
6. WHEN an organization is deleted, THE Audit_Log_System SHALL cascade-delete all associated `audit_logs` rows.
7. WHEN an actor's profile is deleted, THE Audit_Log_System SHALL set `actor_id` to NULL on associated `audit_logs` rows rather than deleting them.

---

### Requirement 2: logAudit Helper

**User Story:** As a backend developer, I want a centralized `logAudit` helper, so that any controller can record audit events without duplicating logic or risking unhandled exceptions.

#### Acceptance Criteria

1. THE logAudit helper SHALL accept a `LogAuditParams` object containing: `orgId`, `actorId`, `action` (one of the defined `AuditAction` values), `targetType` (one of `user`, `org`, `invitation`, `role`, `channel`), `targetId`, and an optional `metadata` object.
2. WHEN logAudit is called, THE logAudit helper SHALL insert a row into `audit_logs` with the provided parameters.
3. IF the `audit_logs` insert fails for any reason, THEN THE logAudit helper SHALL log the error via `logger.warn()` and return without throwing.
4. THE logAudit helper SHALL never cause the calling controller's request to fail due to an audit write error.
5. THE logAudit helper SHALL replace the existing `auditLog()` function in `membershipController.js`.

---

### Requirement 3: Audit Log API Endpoint

**User Story:** As an org admin, I want a paginated, filterable API endpoint for audit logs, so that I can programmatically retrieve the audit trail for my organization.

#### Acceptance Criteria

1. THE Audit_Log_System SHALL expose a `GET /api/audit-logs` endpoint.
2. WHEN a request is made to `GET /api/audit-logs`, THE Audit_Log_System SHALL require the requesting user to have role `admin` or `super_admin`, returning `403 Forbidden` otherwise.
3. WHEN a request is made to `GET /api/audit-logs`, THE Audit_Log_System SHALL scope results to `req.user.orgId`, returning no rows from other organizations.
4. THE Audit_Log_System SHALL support the following optional query parameters: `action` (filter by AuditAction), `actor_id` (filter by actor UUID), `from` (ISO date string, inclusive lower bound on `created_at`), `to` (ISO date string, inclusive upper bound on `created_at`), `page` (integer, default 1), `limit` (integer, default 50, maximum 200).
5. WHEN `limit` exceeds 200, THE Audit_Log_System SHALL clamp it to 200.
6. THE Audit_Log_System SHALL join `profiles` to include `actor_name` and `actor_email` in each returned entry.
7. THE Audit_Log_System SHALL return results ordered by `created_at` descending.
8. THE Audit_Log_System SHALL return a response body containing: an array of `AuditLogEntry` objects and a `total` count for pagination.

---

### Requirement 4: Audit Log Frontend Page

**User Story:** As an org admin, I want a dedicated audit log page at `/org/audit-logs`, so that I can review all org-level actions through a clear, filterable UI.

#### Acceptance Criteria

1. THE Audit_Log_System SHALL render the audit log page at the route `/org/audit-logs`.
2. WHEN a non-admin user navigates to `/org/audit-logs`, THE Audit_Log_System SHALL redirect them to `/`.
3. THE Audit_Log_System SHALL display audit log entries in a table with columns: Actor (name + email), Action (styled badge), Target, and Timestamp.
4. THE Audit_Log_System SHALL provide a filter bar with: an action-type dropdown, a user/actor search field, and date range pickers for `from` and `to`.
5. WHEN a filter value changes, THE Audit_Log_System SHALL re-fetch audit log entries with the updated filter parameters.
6. WHEN a table row is expanded, THE Audit_Log_System SHALL display the `metadata` field as formatted JSON.
7. THE Audit_Log_System SHALL paginate results at 50 entries per page and provide navigation controls.
8. THE Audit_Log_System SHALL use TanStack Query via a `useAuditLogs` hook to fetch and cache audit log data.

---

### Requirement 5: Chat Database Tables

**User Story:** As a platform engineer, I want the chat database schema with proper constraints and indexes, so that channel and message data is stored reliably and queries are performant.

#### Acceptance Criteria

1. THE Chat_System SHALL create a `chat_channels` table with columns: `id` (uuid, primary key), `org_id` (uuid, FK to `organizations`, ON DELETE CASCADE), `name` (text, not null), `created_by` (uuid, FK to `profiles`, ON DELETE SET NULL), `created_at` (timestamptz, default `now()`), and a UNIQUE constraint on `(org_id, name)`.
2. THE Chat_System SHALL enforce that `chat_channels.name` contains only lowercase alphanumeric characters and hyphens, with a length between 1 and 50 characters.
3. THE Chat_System SHALL create an index on `chat_channels(org_id)`.
4. THE Chat_System SHALL create a `channel_members` table with columns: `id` (uuid, primary key), `channel_id` (uuid, FK to `chat_channels`, ON DELETE CASCADE), `user_id` (uuid, FK to `profiles`, ON DELETE CASCADE), `joined_at` (timestamptz, default `now()`), and a UNIQUE constraint on `(channel_id, user_id)`.
5. THE Chat_System SHALL create indexes on `channel_members(channel_id)` and `channel_members(user_id)`.
6. THE Chat_System SHALL create a `messages` table with columns: `id` (uuid, primary key), `channel_id` (uuid, FK to `chat_channels`, ON DELETE CASCADE), `sender_id` (uuid, FK to `profiles`, ON DELETE SET NULL), `content` (text, not null, length between 1 and 4000 characters), `attachments` (text[], default `{}`), `created_at` (timestamptz, default `now()`).
7. THE Chat_System SHALL create indexes on `messages(channel_id)` and `messages(created_at DESC)`.
8. WHEN a `chat_channels` row is deleted, THE Chat_System SHALL cascade-delete all associated `channel_members` and `messages` rows.

---

### Requirement 6: Chat Channels API

**User Story:** As an org admin, I want API endpoints to create, manage, and delete chat channels, so that I can organize team communication.

#### Acceptance Criteria

1. THE Chat_System SHALL expose a `POST /api/chat/channels` endpoint to create a new channel.
2. WHEN `POST /api/chat/channels` is called, THE Chat_System SHALL require the requesting user to have role `admin` or `super_admin`, returning `403 Forbidden` otherwise.
3. WHEN `POST /api/chat/channels` is called with a valid `name`, THE Chat_System SHALL insert a row into `chat_channels` scoped to `req.user.orgId` and return `201 Created`.
4. IF a channel with the same `name` already exists in the org, THEN THE Chat_System SHALL return `400 Bad Request`.
5. THE Chat_System SHALL expose a `POST /api/chat/channels/:channelId/members` endpoint to add a member to a channel.
6. WHEN `POST /api/chat/channels/:channelId/members` is called, THE Chat_System SHALL require the requesting user to have role `admin` or `super_admin`, returning `403 Forbidden` otherwise.
7. WHEN adding a member, THE Chat_System SHALL verify the target user is an Active_Member of the same org, returning `403 Forbidden` if not.
8. THE Chat_System SHALL expose a `DELETE /api/chat/channels/:channelId/members/:userId` endpoint to remove a member from a channel.
9. WHEN `DELETE /api/chat/channels/:channelId/members/:userId` is called, THE Chat_System SHALL require the requesting user to have role `admin` or `super_admin`, returning `403 Forbidden` otherwise.
10. THE Chat_System SHALL expose a `DELETE /api/chat/channels/:channelId` endpoint to delete a channel.
11. WHEN `DELETE /api/chat/channels/:channelId` is called, THE Chat_System SHALL require the requesting user to have role `admin` or `super_admin`, returning `403 Forbidden` otherwise.
12. WHEN a channel is deleted, THE Chat_System SHALL rely on database CASCADE to remove all associated `messages` and `channel_members` rows.
13. ALL channel endpoints SHALL be scoped to `req.user.orgId` and SHALL return `403 Forbidden` if the channel belongs to a different org.

---

### Requirement 7: Messages API

**User Story:** As an org member, I want to send messages to channels I belong to, so that I can communicate with my team in real time.

#### Acceptance Criteria

1. THE Chat_System SHALL expose a `POST /api/chat/messages` endpoint to send a message.
2. WHEN `POST /api/chat/messages` is called, THE Chat_System SHALL verify the sender is listed in `channel_members` for the specified `channel_id`, returning `403 Forbidden` with the message "You are not a member of this channel" if not.
3. WHEN `POST /api/chat/messages` is called, THE Chat_System SHALL verify the sender is an Active_Member of the org (i.e., `profiles.org_id` is set and not banned), returning `403 Forbidden` otherwise.
4. WHEN a valid message is submitted, THE Chat_System SHALL insert a row into `messages` with `channel_id`, `sender_id`, `content`, and optional `attachments`, returning `201 Created`.
5. IF `content` is empty or exceeds 4000 characters, THEN THE Chat_System SHALL return `400 Bad Request`.
6. THE Chat_System SHALL rely on Supabase_Realtime to broadcast new message rows to subscribed clients.

---

### Requirement 8: Chat Frontend Page

**User Story:** As an org member, I want a full-page chat UI at `/org/chat`, so that I can browse channels and exchange messages with my team in real time.

#### Acceptance Criteria

1. THE Chat_System SHALL render the chat page at the route `/org/chat`.
2. THE Chat_System SHALL display a left sidebar listing all channels the current user is a member of, with the active channel highlighted.
3. WHEN a channel has unread messages, THE Chat_System SHALL display an unread badge on that channel in the sidebar.
4. WHERE the current user is an Org_Admin, THE Chat_System SHALL display a "New Channel" button in the sidebar.
5. THE Chat_System SHALL display messages for the active channel in the main area, ordered chronologically.
6. WHEN new messages arrive via Supabase_Realtime, THE Chat_System SHALL append them to the message list and auto-scroll to the bottom.
7. THE Chat_System SHALL provide a message input area where pressing Enter sends the message and Shift+Enter inserts a newline.
8. WHEN the active channel changes, THE Chat_System SHALL unsubscribe from the previous Supabase_Realtime subscription and subscribe to the new channel.
9. WHEN the active channel is deleted by an admin, THE Chat_System SHALL auto-select the first available channel or display an empty state with a "Channel was deleted" message.
10. WHEN a user is removed from a channel while viewing it, THE Chat_System SHALL remove the channel from the sidebar and display an appropriate message.
11. THE Chat_System SHALL use a `useChannels` hook and a `useMessages` hook backed by TanStack Query for data fetching.

---

### Requirement 9: Integration with Existing Controllers

**User Story:** As a platform engineer, I want the existing membership and invitation controllers to call `logAudit`, so that all critical org-level actions are automatically recorded in the audit trail.

#### Acceptance Criteria

1. WHEN `membershipController.removeMember` completes successfully, THE Audit_Log_System SHALL record an audit event with `action: 'member.removed'`, `targetType: 'user'`, and the removed user's ID as `targetId`.
2. WHEN `membershipController.banMember` completes successfully, THE Audit_Log_System SHALL record an audit event with `action: 'member.banned'`.
3. WHEN `membershipController.unbanMember` completes successfully, THE Audit_Log_System SHALL record an audit event with `action: 'member.unbanned'`.
4. WHEN `membershipController.leaveOrganization` completes successfully, THE Audit_Log_System SHALL record an audit event with `action: 'member.left'`.
5. WHEN `invitationController.sendInvitation` completes successfully, THE Audit_Log_System SHALL record an audit event with `action: 'invite.sent'`.
6. WHEN `invitationController.respondToInvitation` is accepted, THE Audit_Log_System SHALL record an audit event with `action: 'invite.accepted'`.
7. WHEN `invitationController.respondToInvitation` is rejected, THE Audit_Log_System SHALL record an audit event with `action: 'invite.rejected'`.
8. WHEN `chatController` creates a channel, THE Audit_Log_System SHALL record an audit event with `action: 'channel.created'`.
9. WHEN `chatController` deletes a channel, THE Audit_Log_System SHALL record an audit event with `action: 'channel.deleted'`.
10. IF any `logAudit` call fails, THEN THE Audit_Log_System SHALL not affect the outcome of the parent controller operation.

---

### Requirement 10: Cascade — User Removed from Org

**User Story:** As a platform engineer, I want a user's removal from an org to automatically remove them from all org channels, so that access is fully revoked without manual cleanup.

#### Acceptance Criteria

1. WHEN a user is removed from an organization (via `removeMember`, `banMember`, or `leaveOrganization`), THE Chat_System SHALL delete all `channel_members` rows where `user_id` equals the removed user and the channel's `org_id` equals the org.
2. WHEN a user is removed from an organization, THE Chat_System SHALL perform the `channel_members` cleanup in the same request handler, before returning the response.
3. IF the `channel_members` cleanup fails, THEN THE Chat_System SHALL log the error and still return a successful response for the membership operation.
4. WHEN a removed user's active chat session attempts to send a message, THE Chat_System SHALL return `403 Forbidden` because `requireOrg` will reject the request.

---

### Requirement 11: RLS Policies

**User Story:** As a security engineer, I want Row-Level Security policies on all new tables, so that database-layer access control prevents unauthorized data access even if application logic is bypassed.

#### Acceptance Criteria

1. THE Audit_Log_System SHALL enable RLS on the `audit_logs` table.
2. WHEN a user queries `audit_logs`, THE Audit_Log_System SHALL allow SELECT only if the user's profile `org_id` matches `audit_logs.org_id` AND the user's role is `admin` or `super_admin`.
3. THE Audit_Log_System SHALL allow INSERT on `audit_logs` only from the service role (backend), not from authenticated client sessions.
4. THE Chat_System SHALL enable RLS on the `chat_channels` table.
5. WHEN a user queries `chat_channels`, THE Chat_System SHALL allow SELECT only if the user's profile `org_id` matches `chat_channels.org_id`.
6. THE Chat_System SHALL enable RLS on the `channel_members` table.
7. WHEN a user queries `channel_members`, THE Chat_System SHALL allow SELECT only if the user is listed as a member of that channel.
8. THE Chat_System SHALL enable RLS on the `messages` table.
9. WHEN a user queries `messages`, THE Chat_System SHALL allow SELECT only if the user is listed in `channel_members` for the message's `channel_id`.
10. THE Chat_System SHALL restrict INSERT on `messages` to users who are listed in `channel_members` for the target `channel_id`.
