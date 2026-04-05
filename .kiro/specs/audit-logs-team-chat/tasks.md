# Implementation Plan: Audit Logs & Team Chat System

## Overview

Implement a structured audit log system and real-time team chat system for the Aurix platform. The audit log records all critical org-level actions for admin review; the chat system provides channel-based messaging with Supabase Realtime. Both are org-scoped and RBAC-gated.

## Tasks

- [x] 1. Create DB migration — audit_logs, chat_channels, channel_members, messages + RLS
  - Create SQL migration file at `backend/migrations/` (or Supabase dashboard SQL) with all four tables, indexes, and RLS policies as defined in the design
  - `audit_logs`: id, org_id (FK→organizations CASCADE), actor_id (FK→profiles SET NULL), action, target_type, target_id, metadata jsonb default '{}', created_at; indexes on org_id, actor_id, action, created_at DESC
  - `chat_channels`: id, org_id (FK→organizations CASCADE), name, created_by (FK→profiles SET NULL), created_at; UNIQUE(org_id, name); index on org_id
  - `channel_members`: id, channel_id (FK→chat_channels CASCADE), user_id (FK→profiles CASCADE), joined_at; UNIQUE(channel_id, user_id); indexes on channel_id, user_id
  - `messages`: id, channel_id (FK→chat_channels CASCADE), sender_id (FK→profiles SET NULL), content text CHECK(char_length BETWEEN 1 AND 4000), attachments text[] default '{}', created_at; indexes on channel_id, created_at DESC
  - RLS: enable on all four tables; audit_logs SELECT for admin/super_admin same org, INSERT service-role only; chat_channels SELECT for same org; channel_members SELECT for members of that channel; messages SELECT/INSERT for channel_members
  - _Requirements: 1.1–1.7, 5.1–5.8, 11.1–11.10_

- [x] 2. Implement auditLogger.js helper
  - [x] 2.1 Create `backend/src/utils/auditLogger.js`
    - Export `logAudit({ orgId, actorId, action, targetType, targetId, metadata })` function
    - Fire-and-forget insert into `audit_logs` via supabase client
    - Catch all errors, call `logger.warn()` with error details, never throw
    - _Requirements: 2.1, 2.2, 2.3, 2.4_

  - [ ]* 2.2 Write property test for logAudit never throws (Property 2)
    - **Property 2: logAudit never throws**
    - Use fast-check to simulate DB failures; assert the function always resolves
    - **Validates: Requirements 2.3, 2.4, 9.10**

- [-] 3. Implement auditLogsController.js
  - [x] 3.1 Create `backend/src/controllers/auditLogsController.js`
    - Export `getAuditLogs(req, res)` handler
    - Require admin/super_admin role (403 otherwise)
    - Scope query to `req.user.orgId`
    - Support query params: `action`, `actor_id`, `from`, `to`, `page` (default 1), `limit` (default 50, max 200 — clamp if exceeded)
    - Join `profiles` to resolve `actor_name` and `actor_email`
    - Order by `created_at DESC`
    - Return `{ data: AuditLogEntry[], total }` with pagination
    - _Requirements: 3.1–3.8_

  - [ ]* 3.2 Write property test for audit log org scoping (Property 4)
    - **Property 4: Audit log results are always org-scoped**
    - Mock DB with rows from multiple orgs; assert response contains only rows matching requester's orgId
    - **Validates: Requirements 3.3**

  - [ ]* 3.3 Write property test for audit log filters (Property 5)
    - **Property 5: Audit log filters are correctly applied**
    - For any combination of filter params, assert all returned entries satisfy every filter predicate
    - **Validates: Requirements 3.4**

- [-] 4. Implement chatController.js
  - [ ] 4.1 Create `backend/src/controllers/chatController.js` with channel CRUD
    - `createChannel(req, res)`: require admin/super_admin; validate name `^[a-z0-9-]{1,50}$`; insert into `chat_channels` scoped to orgId; call `logAudit` with `action: 'channel.created'`; return 201
    - `deleteChannel(req, res)`: require admin/super_admin; verify channel belongs to orgId; delete row (cascade handles members/messages); call `logAudit` with `action: 'channel.deleted'`; return 200
    - `addChannelMember(req, res)`: require admin/super_admin; verify channel is in orgId; verify target user is active org member; insert into `channel_members`; return 201
    - `removeChannelMember(req, res)`: require admin/super_admin; verify channel is in orgId; delete from `channel_members`; return 200
    - _Requirements: 6.1–6.13, 9.8, 9.9_

  - [ ] 4.2 Add `sendMessage(req, res)` to chatController.js
    - Verify sender is in `channel_members` for the given `channel_id` (403 "You are not a member of this channel" if not)
    - Verify sender is active org member via `requireOrg` (already enforced by middleware)
    - Validate content length 1–4000 (400 if not)
    - Insert into `messages`; return 201
    - _Requirements: 7.1–7.6_

  - [ ]* 4.3 Write property test for channel name validation (Property 13)
    - **Property 13: Valid channel names accepted; invalid names rejected**
    - Use fast-check to generate arbitrary strings; assert validator accepts only `^[a-z0-9-]{1,50}$`
    - **Validates: Requirements 5.2, 6.3, 6.4**

  - [ ]* 4.4 Write property test for message content length (Property 17)
    - **Property 17: Message content length is enforced**
    - For content length 1–4000 assert 201; for length 0 or >4000 assert 400
    - **Validates: Requirements 7.4, 7.5**

- [ ] 5. Add routes for audit logs and chat
  - Update `backend/src/routes/index.js`:
    - Import `getAuditLogs` from `auditLogsController.js`
    - Import channel/message handlers from `chatController.js`
    - Add `GET /audit-logs` → `requireRole('admin','super_admin'), getAuditLogs`
    - Add `POST /chat/channels` → `requireRole('admin','super_admin'), createChannel`
    - Add `POST /chat/channels/:channelId/members` → `requireRole('admin','super_admin'), addChannelMember`
    - Add `DELETE /chat/channels/:channelId/members/:userId` → `requireRole('admin','super_admin'), removeChannelMember`
    - Add `DELETE /chat/channels/:channelId` → `requireRole('admin','super_admin'), deleteChannel`
    - Add `POST /chat/messages` → `requireOrg, sendMessage`
    - _Requirements: 3.1, 6.1, 6.5, 6.8, 6.10, 7.1_

- [ ] 6. Update membershipController to use logAudit + cascade channel member removal
  - Import `logAudit` from `../utils/auditLogger.js`
  - Replace the existing inline `auditLog()` helper with calls to `logAudit()`
  - In `removeMember`, `banMember`, and `leaveOrganization`: after updating `profiles.org_id = null`, delete all `channel_members` rows where `user_id = targetUserId` and channel's `org_id = orgId` (subquery or join); wrap in try/catch and log error without failing the request
  - Update `logAudit` call signatures to match new interface: `{ orgId, actorId, action, targetType: 'user', targetId, metadata }`
  - _Requirements: 2.5, 9.1–9.4, 10.1–10.4_

- [ ] 7. Update invitationController to call logAudit
  - Import `logAudit` from `../utils/auditLogger.js`
  - In `sendInvitation` after successful queue enqueue: call `logAudit({ orgId, actorId: userId, action: 'invite.sent', targetType: 'invitation', targetId: target.id, metadata: { role_name, type } })`
  - In `respondToInvitation` after successful RPC: call `logAudit` with `action: 'invite.accepted'` or `'invite.rejected'` based on `action` param; use `inv.org_id` and `userId`
  - _Requirements: 9.5, 9.6, 9.7, 9.10_

- [ ] 8. Checkpoint — backend complete
  - Ensure all backend routes respond correctly, logAudit integrations are wired, and cascade removal works. Ask the user if questions arise.

- [x] 9. Implement useAuditLogs hook
  - Create `src/hooks/use-audit-logs.ts`
  - Export `useAuditLogs(filters: AuditFilters)` using TanStack Query `useQuery`
  - Query key: `['audit-logs', filters]` so any filter change triggers re-fetch
  - Fetch `GET /api/audit-logs` with filters as query params via the existing API client
  - Return `{ data, total, isLoading, error }`
  - _Requirements: 4.5, 4.8_

- [ ] 10. Implement AuditLogs.tsx page
  - Create `src/pages/AuditLogs.tsx`
  - On mount, check `isAdmin` from `usePermissions()`; if false, `<Navigate to="/" replace />`
  - Filter bar: action-type `<Select>`, actor search `<Input>`, date range pickers for `from`/`to` using shadcn Calendar/Popover
  - Table (shadcn `<Table>`) with columns: Actor (name + email), Action (styled `<Badge>`), Target, Timestamp
  - Expandable row: clicking a row toggles a detail panel showing `metadata` as `<pre>{JSON.stringify(metadata, null, 2)}</pre>`
  - Pagination controls: prev/next buttons, current page display; 50 entries per page
  - Use `useAuditLogs(filters)` hook; show skeleton while loading
  - _Requirements: 4.1–4.8_

- [ ] 11. Implement useChat hook
  - Create `src/hooks/use-chat.ts`
  - Export `useChannels()`: TanStack Query fetching user's channels from Supabase `channel_members` join `chat_channels` filtered by current user
  - Export `useMessages(channelId)`: TanStack Query fetching last 50 messages for `channelId` ordered by `created_at ASC`
  - Export `useRealtimeMessages(channelId, onNewMessage)`: subscribes to Supabase Realtime on `messages` table filtered by `channel_id=eq.{channelId}`; unsubscribes and resubscribes when `channelId` changes; calls `onNewMessage` callback on INSERT events
  - _Requirements: 8.2, 8.5, 8.8, 8.11_

- [ ] 12. Implement Chat.tsx page
  - Create `src/pages/Chat.tsx`
  - Left sidebar: list channels from `useChannels()`; highlight active channel; show unread badge (track last-seen message id in state); "New Channel" button visible only to admins (calls `POST /api/chat/channels` then invalidates channels query)
  - Main area: message list from `useMessages(activeChannelId)` ordered chronologically; auto-scroll to bottom on new message using `useEffect` + `ref`
  - Wire `useRealtimeMessages` to append new messages to local state and auto-scroll
  - Message input: `<textarea>` with `onKeyDown` — Enter sends (calls `POST /api/chat/messages`), Shift+Enter inserts newline
  - On channel switch: update `activeChannelId` state (realtime hook handles unsubscribe/resubscribe)
  - Handle deleted channel: if active channel disappears from channels list, auto-select first available or show "Channel was deleted" empty state
  - _Requirements: 8.1–8.11_

- [ ] 13. Wire routes and nav items
  - In `src/App.tsx`: import `AuditLogs` and `Chat` pages; add routes:
    - `<Route path="/org/audit-logs" element={isAdmin ? <AuditLogs /> : <Navigate to="/" replace />} />`
    - `<Route path="/org/chat" element={<Chat />} />`
  - In `src/components/AppLayout.tsx`: add nav items to `NAV_ITEMS`:
    - `{ label: 'Audit Logs', icon: ClipboardList, path: '/org/audit-logs', perm: null, adminOnly: true }`
    - `{ label: 'Team Chat', icon: Hash, path: '/org/chat', perm: null, superAdminOnly: false }`
  - Import `ClipboardList` and `Hash` from `lucide-react`
  - Filter audit-logs nav item to show only for admin/super_admin roles
  - _Requirements: 4.1, 8.1_

- [ ] 14. Final checkpoint — Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties defined in the design document
- The design uses no pseudocode — implementation language is JavaScript (backend) and TypeScript/React (frontend), matching the existing codebase
