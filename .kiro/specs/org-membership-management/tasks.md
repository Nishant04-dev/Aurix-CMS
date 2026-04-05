# Tasks: Org Membership Management

## Task List

- [x] 1. Database migrations
  - [x] 1.1 Create `banned_members` table with UNIQUE(user_id, org_id), indexes, and FK references
  - [x] 1.2 Create `membership_audit_log` table with org_id index
  - [x] 1.3 Add `status` column to `organizations` if not present

- [x] 2. Shared power-level utility
  - [x] 2.1 Create `src/lib/powerLevel.ts` with ROLE_POWER map, getPowerLevel(), canActOn()
  - [x] 2.2 Create `src/types/membership.ts` with BannedMember and MembershipAction interfaces

- [x] 3. Backend: membershipController.js
  - [x] 3.1 Implement `leaveOrganization` — sole-owner guard, transaction, audit log
  - [x] 3.2 Implement `removeMember` — self-remove guard, cross-org guard, power level check, transaction
  - [x] 3.3 Implement `banMember` — duplicate ban guard, power level check, ban registry insert + member removal
  - [x] 3.4 Implement `unbanMember` — 404 if no ban record, delete ban record, audit log
  - [x] 3.5 Implement `getBannedMembers` — query banned_members joined with profiles

- [x] 4. Backend: routes and ban check
  - [x] 4.1 Add membership routes to `backend/src/routes/index.js`
  - [x] 4.2 Add ban check to `respondToInvitation` in `invitationController.js`

- [x] 5. Frontend: hooks
  - [x] 5.1 Create `src/hooks/use-membership.ts` with useLeaveOrganization, useRemoveMember, useBanMember, useUnbanMember, useBannedMembers
  - [x] 5.2 Create `src/hooks/use-org-members-realtime.ts` with Supabase Realtime subscription

- [x] 6. Frontend: Team.tsx upgrades
  - [x] 6.1 Add Remove and Ban actions to member actions dropdown (power-level gated)
  - [x] 6.2 Add RemoveMemberDialog and BanMemberDialog confirmation AlertDialogs
  - [x] 6.3 Add BannedMembersTab section with Unban button per row
  - [x] 6.4 Add DangerZone section with Leave Organization button + confirmation dialog
  - [x] 6.5 Wire useOrgMembersRealtime into Team.tsx with self-removal redirect

- [x] 7. Frontend: Profile page Leave Organization button
  - [x] 7.1 Add Danger Zone section to Profile.tsx with Leave Organization button
