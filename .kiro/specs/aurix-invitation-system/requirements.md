# Requirements: Aurix Invitation System Upgrade

## Introduction

This document defines the functional and non-functional requirements for the Aurix Invitation System Upgrade. The feature covers database schema hardening, real-time invite delivery, email notifications, token-based invite links, expiry enforcement, multi-org switching, advanced RBAC, billing scaffolding, polished invitation UI, and critical bug fixes.

---

## Requirements

### 1. Database Schema

#### 1.1 Invitations Table Final Structure
**User Story**: As a developer, I need the invitations table to have a well-defined schema so that invitation data is consistent and queryable.

**Acceptance Criteria**:
- The `invitations` table MUST have columns: `id` (uuid PK), `org_id` (uuid FK→organizations), `invited_user_id` (uuid FK→profiles), `invited_by` (uuid FK→profiles), `role` (text), `status` (text with CHECK constraint), `token` (text UNIQUE), `expires_at` (timestamptz), `created_at` (timestamptz)
- The `status` column MUST have a CHECK constraint allowing only: `pending`, `accepted`, `rejected`, `expired`
- The `token` column MUST have a UNIQUE constraint
- `expires_at` MUST default to `now() + interval '24 hours'`
- All three foreign keys MUST use ON DELETE CASCADE for `org_id` and `invited_user_id`

#### 1.2 Organization Members Table
**User Story**: As a user, I need to belong to multiple organizations so that I can work across different agency accounts.

**Acceptance Criteria**:
- The `organization_members` table MUST have columns: `id` (uuid PK), `user_id` (uuid FK→profiles), `org_id` (uuid FK→organizations), `role` (text), `created_at` (timestamptz)
- A UNIQUE constraint MUST exist on `(user_id, org_id)` to prevent duplicate memberships
- Both `user_id` and `org_id` MUST have ON DELETE CASCADE foreign keys

#### 1.3 RBAC Tables
**User Story**: As an admin, I need granular permission tables so that I can control exactly what each role can do.

**Acceptance Criteria**:
- A `permissions` table MUST exist with columns: `id` (uuid PK), `key` (text UNIQUE), `description` (text)
- The `permissions` table MUST be seeded with at minimum: `manage_clients`, `manage_projects`, `view_invoices`, `invite_users`, `manage_roles`, `manage_users`, `upload_files`, `view_file`, `view_client`, `view_project`, `create_project`, `edit_project`, `delete_project`
- The `role_permissions` table MUST have a UNIQUE constraint on `(role_id, permission_key)`

#### 1.4 Subscriptions Table (Billing Scaffold)
**User Story**: As a platform owner, I need a subscriptions table structure so that billing integration can be added later without schema changes.

**Acceptance Criteria**:
- A `subscriptions` table MUST exist with columns: `org_id` (uuid FK→organizations), `plan` (text), `status` (text), `stripe_customer_id` (text nullable), `stripe_subscription_id` (text nullable), `created_at`, `updated_at`
- The `status` column MUST have a CHECK constraint: `active`, `trialing`, `past_due`, `canceled`
- No Stripe API calls MUST be made — structure only

---

### 2. Real-Time Invitations

#### 2.1 Realtime Subscription
**User Story**: As an invited user, I want to see new invitations appear instantly without refreshing the page.

**Acceptance Criteria**:
- The frontend MUST subscribe to Supabase Realtime `postgres_changes` on the `invitations` table filtered by `invited_user_id = eq.{currentUserId}`
- The subscription MUST be established when the user is authenticated and `userId` is available
- The subscription MUST be cleaned up (channel removed) when the component unmounts

#### 2.2 Badge and Refetch on Change
**User Story**: As an invited user, I want the notification badge to update immediately when I receive an invitation.

**Acceptance Criteria**:
- On any INSERT or UPDATE event from the realtime subscription, the invitations query MUST be refetched
- The pending invitation count badge MUST update within 2 seconds of the DB change
- A toast notification MUST be shown: "You have a new invitation"

---

### 3. Email System

#### 3.1 nodemailer SMTP Configuration
**User Story**: As an admin, I want invitation emails to be sent reliably so that invited users receive a link to join.

**Acceptance Criteria**:
- The backend MUST use nodemailer with SMTP host `smtp.hostinger.com`, port `465`, `secure: true`
- SMTP credentials MUST be read from environment variables (`SMTP_USER`, `SMTP_PASS`)
- The email service MUST be in `backend/src/services/emailService.js`

#### 3.2 Invitation Email Content
**User Story**: As an invited user, I want the invitation email to contain all relevant information so that I know who invited me and what role I'll have.

**Acceptance Criteria**:
- The email MUST include: organization name, inviter's name, assigned role, and an accept link
- The accept link MUST be in the format: `${APP_URL}/invite/${token}`
- The token MUST be generated with `nanoid(32)` before DB insert
- Email sending MUST be non-blocking — invitation creation MUST succeed even if email fails
- SMTP errors MUST be logged but MUST NOT cause the API to return an error response

---

### 4. Invite Link System

#### 4.1 Token Route
**User Story**: As an invited user, I want to click a link in my email and be taken to an accept/reject page.

**Acceptance Criteria**:
- A route `/invite/:token` MUST exist in the React app
- The page MUST fetch the invitation from Supabase using the token value
- The page MUST be accessible without authentication (public route)

#### 4.2 Invitation Validation
**User Story**: As an invited user, I want clear feedback if an invitation link is invalid or expired.

**Acceptance Criteria**:
- If no invitation matches the token, the page MUST show an "Invalid invitation" state
- If `status !== 'pending'`, the page MUST show the appropriate state (accepted/rejected/expired)
- If `expires_at < now()`, the page MUST show an "Invitation expired" state and update the DB status to `expired`
- The page MUST never show the accept/reject UI for a non-pending invitation

#### 4.3 Accept via Token
**User Story**: As an invited user, I want to accept an invitation from the email link so that I can join the organization.

**Acceptance Criteria**:
- Clicking Accept MUST call the `accept_invitation` Supabase RPC with the invitation id
- On success, a row MUST be inserted into `organization_members` with `(user_id, org_id, role)` from the invitation
- The invitation `status` MUST be updated to `accepted`
- The user MUST be redirected to the dashboard after successful acceptance

---

### 5. Expiry System

#### 5.1 Backend Expiry Enforcement
**User Story**: As a security-conscious admin, I want expired invitations to be blocked so that old links cannot be used.

**Acceptance Criteria**:
- The `accept_invitation` RPC MUST check `expires_at > now()` before processing
- If expired, the RPC MUST return `{ error: 'Invitation has expired' }` and update status to `expired`
- The backend controller MUST also check expiry before inserting a new invitation (no re-use of expired tokens)

#### 5.2 Automatic Expiry Marking
**User Story**: As a platform operator, I want expired invitations to be automatically marked so that the database stays clean.

**Acceptance Criteria**:
- A cron job MUST run on server startup and every hour thereafter
- The cron MUST UPDATE all rows where `status='pending' AND expires_at < now()` to `status='expired'`
- The cron MUST log the count of rows updated

---

### 6. Multi-Org Switching

#### 6.1 Multiple Org Membership
**User Story**: As a user, I want to belong to multiple organizations so that I can switch between client accounts.

**Acceptance Criteria**:
- A user MAY have multiple rows in `organization_members` with different `org_id` values
- The `OrgContext` MUST fetch all `organization_members` rows for the current user on mount
- Each membership MUST include the joined `organizations` row (name, logo_url)

#### 6.2 Active Org Persistence
**User Story**: As a user, I want my active organization to be remembered across page refreshes.

**Acceptance Criteria**:
- The active org MUST be stored in `localStorage` under the key `active_org`
- On app load, `OrgContext` MUST restore `activeOrgId` from `localStorage` if the stored org is still in the user's membership list
- If the stored org is no longer valid, MUST fall back to the first org in the list

#### 6.3 Org Switcher Dropdown
**User Story**: As a multi-org user, I want a dropdown in the navbar to switch between my organizations.

**Acceptance Criteria**:
- The navbar MUST show an org switcher dropdown when the user belongs to more than one organization
- The dropdown MUST list all orgs with their logo/avatar and the user's role in each
- Selecting an org MUST update `OrgContext.activeOrgId` and `localStorage`
- All data queries MUST use `activeOrgId` as the org filter after switching

---

### 7. Advanced RBAC

#### 7.1 Permission Tables
**User Story**: As an admin, I need a permission system backed by database tables so that roles can be customized per organization.

**Acceptance Criteria**:
- The `roles`, `permissions`, and `role_permissions` tables MUST exist as defined in the design
- The `requirePermission` middleware MUST check `role_permissions` table for the user's `role_id`
- Super admins and platform owners MUST bypass all permission checks

#### 7.2 hasPermission Helper
**User Story**: As a frontend developer, I need a `hasPermission` utility so that I can conditionally render UI elements based on permissions.

**Acceptance Criteria**:
- The `usePermissions` hook MUST expose a `can(permission: string): boolean` function
- `can()` MUST return `true` if the permission key exists in `role_permissions` for the user's role OR in the JSONB `permissions` field
- `can()` MUST return `true` for any permission if the role has `{ all: true }` in its permissions JSONB

#### 7.3 Permission-Gated UI
**User Story**: As a user without invite permissions, I should not see the Send Invite button so that the UI reflects my actual capabilities.

**Acceptance Criteria**:
- The Send Invite button MUST only render when `can('invite_users')` returns `true`
- The Sent tab in Invitations MUST only render when `can('invite_users')` returns `true`
- The Team nav item MUST only show when `can('invite_user')` returns `true`

---

### 8. Invitation UI

#### 8.1 Received Invitations
**User Story**: As an invited user, I want a clear UI showing who invited me and what role I'll have so that I can make an informed decision.

**Acceptance Criteria**:
- Each received invitation card MUST show: org logo (with letter fallback), org name, inviter's name, role badge with color coding, invitation date, expiry date (if pending)
- Pending invitations MUST show Accept and Decline buttons
- Accept button MUST call `accept_invitation` RPC; Decline MUST call `reject_invitation` RPC
- Past invitations (accepted/rejected/expired) MUST be shown in a History section with status badge

#### 8.2 Sent Invitations
**User Story**: As an admin, I want to see all invitations I've sent so that I can track their status and resend if needed.

**Acceptance Criteria**:
- The Sent tab MUST show: target user's name/email, display_id, role badge, sent date, status badge
- Pending sent invitations MUST have Resend and Cancel action buttons
- Resend MUST cancel the existing invitation and create a new one with a fresh token and expiry
- Cancel MUST call `cancel_invitation` RPC and update status

---

### 9. Notifications

#### 9.1 Invite Received Notification
**User Story**: As an invited user, I want a notification when I receive an invitation so that I don't miss it.

**Acceptance Criteria**:
- When a new invitation INSERT is detected via Realtime, a toast notification MUST be shown
- A row MUST be inserted into the `notifications` table with title "New Invitation" and relevant message
- The notification badge in the navbar MUST increment

#### 9.2 Notification Navigation
**User Story**: As a user, I want to click a notification and be taken to the invitations page.

**Acceptance Criteria**:
- Invitation-related notifications in the NotificationsPanel MUST be clickable
- Clicking an invitation notification MUST navigate to `/invitations`

---

### 10. Bug Fixes

#### 10.1 Fix "Unknown Organization"
**User Story**: As a user, I should always see the correct organization name in invitations so that I know which org is inviting me.

**Acceptance Criteria**:
- All invitation queries MUST JOIN the `organizations` table to fetch `name` and `logo_url`
- The fallback "Unknown Organization" MUST only appear if the org row is genuinely missing (deleted)
- The Supabase select MUST use `organizations!inner` or equivalent to ensure the join always executes

#### 10.2 Fix Invite Not Showing
**User Story**: As an invited user, I should always see invitations sent to me so that I can respond to them.

**Acceptance Criteria**:
- The backend MUST resolve `display_id` to the profile's UUID before inserting `invited_user_id`
- The frontend query MUST filter by `invited_user_id = user.id` where `user.id` is the UUID from Supabase Auth
- A migration MUST be provided to fix any existing rows where `invited_user_id` is not a valid UUID

#### 10.3 Fix Infinite Loading
**User Story**: As a user, I should never see an infinite loading spinner so that I can always access the app.

**Acceptance Criteria**:
- `AuthContext` MUST set `loading=false` immediately after `getSession()` resolves, before profile enrichment
- A `minimalUser` object MUST be set from session data to unblock the UI
- A 4-second failsafe timeout MUST force `loading=false` regardless of profile fetch status

#### 10.4 Fix Signup Race Condition
**User Story**: As a new user, my account type should be correctly set even if the profile row isn't immediately available after signup.

**Acceptance Criteria**:
- `finalizeAccountType` MUST retry up to 5 times with 500ms delay between attempts
- Each retry MUST check if the profile row exists before attempting the update
- If all retries fail, the error MUST be logged and the function MUST resolve gracefully (no throw)

#### 10.5 Fix Status Constraint Errors
**User Story**: As a developer, invitation status updates should never fail due to invalid status values.

**Acceptance Criteria**:
- The string `'cancelled'` MUST NOT appear anywhere in invitation status logic (frontend or backend)
- All code paths MUST only use: `pending`, `accepted`, `rejected`, `expired`
- The `STATUS_STYLES` map in `Invitations.tsx` MUST only contain keys for the four allowed values
- The DB CHECK constraint MUST be the single source of truth for allowed status values
