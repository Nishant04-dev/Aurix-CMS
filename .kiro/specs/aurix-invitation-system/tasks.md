# Tasks: Aurix Invitation System Upgrade

## Task List

- [ ] 1. Database Schema Migrations
  - [ ] 1.1 Write SQL migration to finalize `invitations` table: add `token` (text UNIQUE), `invited_user_id` (uuid FK→profiles), `invited_by` (uuid FK→profiles), fix `status` CHECK constraint to only allow `pending/accepted/rejected/expired`, add `expires_at` defaulting to `now()+24h`
  - [ ] 1.2 Write SQL migration to create `organization_members` table with `id`, `user_id` (FK→profiles), `org_id` (FK→organizations), `role`, `created_at`, and UNIQUE(user_id, org_id)
  - [ ] 1.3 Write SQL migration to create `permissions` table and seed with standard permission keys (`manage_clients`, `manage_projects`, `view_invoices`, `invite_users`, etc.)
  - [ ] 1.4 Write SQL migration to create `subscriptions` table scaffold with `org_id`, `plan`, `status` (CHECK constraint), `stripe_customer_id`, `stripe_subscription_id`
  - [ ] 1.5 Write migration script to fix existing `invitations` rows where `invited_user_id` is not a valid UUID (resolve from display_id)

- [ ] 2. Backend: Email Service
  - [ ] 2.1 Install `nodemailer` and `nanoid` in backend (`npm install nodemailer nanoid`)
  - [ ] 2.2 Create `backend/src/services/emailService.js` with nodemailer transporter using `smtp.hostinger.com:465`, `secure: true`, credentials from `SMTP_USER`/`SMTP_PASS` env vars
  - [ ] 2.3 Implement `sendInvitationEmail({ to, orgName, inviterName, role, acceptLink })` function with HTML email template showing org name, inviter, role, and accept link button
  - [ ] 2.4 Add `SMTP_USER`, `SMTP_PASS`, and `APP_URL` to `backend/.env` (with placeholder values) and document in README

- [ ] 3. Backend: Invitation Controller Upgrade
  - [ ] 3.1 Update `sendInvitation` controller to generate `nanoid(32)` token, set `expires_at = now()+24h`, store `invited_user_id` as UUID (resolve from display_id), and insert directly into DB (bypass queue for token generation)
  - [ ] 3.2 Call `emailService.sendInvitationEmail` after DB insert — non-blocking (`.catch(logger.error)`)
  - [ ] 3.3 Add check: if target user is already in `organization_members` for this org, return 400 "User is already a member"
  - [ ] 3.4 Add `GET /api/invitations/by-token/:token` endpoint (public, no auth required) that returns invitation with joined org and inviter profile

- [ ] 4. Backend: Expiry Cron Job
  - [ ] 4.1 Create `backend/src/jobs/expireInvitations.js` that runs `UPDATE invitations SET status='expired' WHERE status='pending' AND expires_at < now()`
  - [ ] 4.2 Register the cron in `backend/src/index.js`: run on startup and every hour via `setInterval(expireInvitations, 60 * 60 * 1000)`

- [ ] 5. Frontend: OrgContext
  - [ ] 5.1 Create `src/contexts/OrgContext.tsx` that fetches all `organization_members` rows for the current user (with joined `organizations` name and logo_url) on mount
  - [ ] 5.2 Implement `activeOrgId` state: restore from `localStorage('active_org')` if valid, else default to first org
  - [ ] 5.3 Implement `setActiveOrg(orgId)` that updates state and `localStorage`
  - [ ] 5.4 Wrap `AuthProvider` children with `OrgProvider` in `src/main.tsx` or `App.tsx`

- [ ] 6. Frontend: Org Switcher Dropdown
  - [ ] 6.1 Create `src/components/OrgSwitcher.tsx` — a dropdown showing all user orgs with logo/avatar, org name, and role badge; highlights active org
  - [ ] 6.2 Add `OrgSwitcher` to `AppLayout.tsx` header, visible only when user has more than one org membership
  - [ ] 6.3 On org selection, call `OrgContext.setActiveOrg(orgId)` and invalidate all TanStack Query caches so queries re-run with new org

- [ ] 7. Frontend: useInviteRealtime Hook
  - [ ] 7.1 Create `src/hooks/use-invite-realtime.ts` that subscribes to `postgres_changes` on `invitations` table with filter `invited_user_id=eq.{userId}`
  - [ ] 7.2 On INSERT or UPDATE event, call the provided `onNewInvite` callback
  - [ ] 7.3 Clean up channel on unmount using `supabase.removeChannel(channel)`

- [ ] 8. Frontend: Invite Token Page
  - [ ] 8.1 Create `src/pages/InviteToken.tsx` — fetches invitation by token from `GET /api/invitations/by-token/:token` or direct Supabase query
  - [ ] 8.2 Implement state machine: `loading → valid | expired | invalid | accepted | rejected`
  - [ ] 8.3 Render accept/reject UI for `valid` state showing org logo, org name, inviter name, role badge, expiry date
  - [ ] 8.4 On Accept: call `accept_invitation` RPC, on success redirect to `/` (dashboard)
  - [ ] 8.5 Add route `/invite/:token` to `App.tsx` as a public route (outside `AppLayout`, accessible without auth)

- [ ] 9. Frontend: Invitations Page Upgrade
  - [ ] 9.1 Wire `useInviteRealtime` hook into `Invitations.tsx` — on new invite, refetch received list and show toast
  - [ ] 9.2 Fix query to use `invited_user_id` column (not `target_user_id`) and JOIN organizations table inline
  - [ ] 9.3 Remove `'cancelled'` from `STATUS_STYLES` map — keep only `pending`, `accepted`, `rejected`, `expired`
  - [ ] 9.4 Update `loadReceived` to always fetch org data via JOIN (fix "Unknown Organization" bug)

- [ ] 10. Frontend: Notifications Enhancement
  - [ ] 10.1 Update `NotificationsPanel.tsx` to make invitation notifications clickable — clicking navigates to `/invitations` using `useNavigate`
  - [ ] 10.2 When `useInviteRealtime` fires, insert a row into `notifications` table: `{ user_id, title: 'New Invitation', message: 'You have been invited to join {orgName}' }`

- [ ] 11. Bug Fixes
  - [ ] 11.1 Fix `AuthContext.tsx`: ensure `loading=false` is set immediately after `getSession()` resolves (before `fetchProfile` completes) — `minimalUser` pattern already in place, verify it's correct
  - [ ] 11.2 Fix `finalizeAccountType` in `src/lib/accountTypeSetup.ts`: add retry loop (up to 5 attempts, 500ms delay) before attempting profile update
  - [ ] 11.3 Audit all invitation-related code for any use of `status='cancelled'` and replace with `status='expired'` or remove

- [ ] 12. Testing
  - [ ] 12.1 Write unit test for `emailService.sendInvitationEmail` — mock nodemailer transporter, verify called with correct `to`, `orgName`, `inviterName`, `role`, `acceptLink` containing the token
  - [ ] 12.2 Write unit test for `expireInvitations` cron — mock Supabase client, verify UPDATE called with `status='pending' AND expires_at < now()`
  - [ ] 12.3 Write unit test for `useInviteRealtime` hook — mock Supabase channel, verify subscription created with correct filter and cleanup on unmount
  - [ ] 12.4 Write property test (fast-check): for any `expires_at` in the past, `InviteTokenPage` state always resolves to `'expired'` — never `'valid'`
  - [ ] 12.5 Write property test (fast-check): for any `orgId` in user's org list, `setActiveOrg(orgId)` always results in `activeOrgId === orgId` and `localStorage.getItem('active_org') === orgId`
  - [ ] 12.6 Write property test (fast-check): for any user with permission P in `role_permissions`, `can(P)` always returns `true`; for any user without P, `can(P)` always returns `false` (unless `all: true`)
