# Requirements Document

## Introduction

This feature extends the Aurix organization and RBAC system with full member management controls. It enables org members to leave voluntarily, allows admins to remove or ban members, supports unbanning, enforces a strict role hierarchy for all actions, provides real-time UI updates via Supabase Realtime, and handles all edge cases safely. All enforcement is performed server-side.

## Glossary

- **Organization_Member**: A user who belongs to an organization, tracked in the `organization_members` table.
- **Role_Hierarchy**: The ordered ranking of roles from highest to lowest: `superadmin > admin > manager > member > client`.
- **Power_Level**: A numeric value assigned to each role representing its rank in the hierarchy; higher value = higher authority.
- **Membership_Manager**: The backend service responsible for executing leave, remove, ban, and unban operations.
- **Ban_Registry**: The `banned_members` database table storing records of banned users per organization (`id`, `user_id`, `org_id`, `banned_by`, `created_at`).
- **Realtime_Channel**: The Supabase Realtime subscription that pushes membership change events to connected frontend clients.
- **Requester**: The authenticated user initiating a membership management action.
- **Target**: The user upon whom a membership management action is being performed.
- **Owner**: An organization member with the `superadmin` role who is the sole owner of the organization.
- **Team_Page**: The frontend page (`src/pages/Team.tsx`) displaying the list of organization members with role badges and action controls.
- **Danger_Zone**: The section in Profile/Org Settings that contains destructive account actions such as leaving an organization.

---

## Requirements

### Requirement 1: Leave Organization

**User Story:** As an organization member, I want to leave my organization, so that I can voluntarily remove myself from a workspace I no longer need access to.

#### Acceptance Criteria

1. WHEN an authenticated Organization_Member submits a leave request, THE Membership_Manager SHALL remove the member from the `organization_members` table and revoke their org access immediately.
2. WHEN an Organization_Member submits a leave request and that member is the sole Owner of the organization, THE Membership_Manager SHALL reject the request with an error message indicating that ownership must be transferred before leaving.
3. WHEN a leave request is successfully processed, THE Membership_Manager SHALL return a success response and trigger a Realtime_Channel event to update all connected clients.
4. IF the leave operation fails due to a database error, THEN THE Membership_Manager SHALL return a descriptive error response and leave the member's record unchanged.
5. THE Team_Page SHALL display a "Leave Organization" button in the Danger_Zone section of the org settings for all authenticated Organization_Members.
6. WHEN a user successfully leaves an organization, THE Team_Page SHALL redirect the user to the login screen or an org-selection screen and clear their org session state.

---

### Requirement 2: Remove Member

**User Story:** As an admin, I want to remove a member from my organization, so that I can revoke access for users who should no longer be part of the workspace.

#### Acceptance Criteria

1. WHEN a Requester with `admin` or `superadmin` role submits a remove request for a Target, THE Membership_Manager SHALL verify that the Target's Power_Level is strictly lower than the Requester's Power_Level before proceeding.
2. IF the Target's Power_Level is equal to or higher than the Requester's Power_Level, THEN THE Membership_Manager SHALL reject the request with a `403 Forbidden` response.
3. WHEN a remove request passes all authorization checks, THE Membership_Manager SHALL remove the Target from the `organization_members` table and revoke their org access immediately.
4. IF the Requester attempts to remove themselves via the remove endpoint, THEN THE Membership_Manager SHALL reject the request with a `400 Bad Request` response.
5. WHEN a member is successfully removed, THE Membership_Manager SHALL trigger a Realtime_Channel event so that the Team_Page updates the member list without a manual refresh.
6. WHEN the removed user is the currently authenticated session user on another client, THE Team_Page SHALL detect the removal event and redirect that user to the login or org-selection screen.
7. THE Team_Page SHALL display a "Remove" action in the member actions dropdown only for members whose Power_Level is strictly lower than the current user's Power_Level.

---

### Requirement 3: Ban Member

**User Story:** As an admin, I want to ban a member from my organization, so that I can permanently prevent a disruptive user from rejoining.

#### Acceptance Criteria

1. WHEN a Requester with `admin` or `superadmin` role submits a ban request for a Target, THE Membership_Manager SHALL verify that the Target's Power_Level is strictly lower than the Requester's Power_Level before proceeding.
2. IF the Target's Power_Level is equal to or higher than the Requester's Power_Level, THEN THE Membership_Manager SHALL reject the request with a `403 Forbidden` response.
3. WHEN a ban request passes all authorization checks, THE Membership_Manager SHALL insert a record into the Ban_Registry containing `user_id`, `org_id`, `banned_by`, and `created_at`, and remove the Target from `organization_members`.
4. WHEN a user attempts to accept an invitation to an organization, THE Membership_Manager SHALL query the Ban_Registry and, IF a matching ban record exists, THEN THE Membership_Manager SHALL reject the join attempt with a message indicating the user is banned.
5. WHEN a user attempts to join an organization via any join flow, THE Membership_Manager SHALL query the Ban_Registry and, IF a matching ban record exists, THEN THE Membership_Manager SHALL block the join and return a descriptive error.
6. WHEN a member is successfully banned, THE Membership_Manager SHALL trigger a Realtime_Channel event so that the Team_Page removes the member from the list immediately.
7. THE Team_Page SHALL display a "Ban" action in the member actions dropdown only for members whose Power_Level is strictly lower than the current user's Power_Level.

---

### Requirement 4: Unban Member

**User Story:** As an admin, I want to unban a previously banned user, so that I can restore their ability to rejoin the organization.

#### Acceptance Criteria

1. WHEN a Requester with `admin` or `superadmin` role submits an unban request for a Target, THE Membership_Manager SHALL verify that a ban record for the Target exists in the Ban_Registry for the specified organization.
2. IF no ban record exists for the Target in the specified organization, THEN THE Membership_Manager SHALL return a `404 Not Found` response.
3. WHEN an unban request is valid, THE Membership_Manager SHALL delete the matching record from the Ban_Registry.
4. WHEN a user is successfully unbanned, THE Membership_Manager SHALL return a success response confirming the unban.
5. THE Team_Page SHALL provide an interface (e.g., a "Banned Members" list or tab) where admins can view banned users and trigger an unban action.

---

### Requirement 5: Role Hierarchy Enforcement

**User Story:** As a platform operator, I want all membership actions to respect the role hierarchy, so that lower-ranked users cannot take actions against higher-ranked users.

#### Acceptance Criteria

1. THE Membership_Manager SHALL define the Role_Hierarchy as: `superadmin` (highest) > `admin` > `manager` > `member` > `client` (lowest), mapped to descending Power_Level values.
2. WHEN any remove or ban action is requested, THE Membership_Manager SHALL compare the Requester's Power_Level against the Target's Power_Level and SHALL only permit the action if the Requester's Power_Level is strictly greater than the Target's Power_Level.
3. THE Membership_Manager SHALL enforce role hierarchy checks on the backend for every remove, ban, and unban request, independent of any frontend validation.
4. IF a request arrives without a valid authenticated session, THEN THE Membership_Manager SHALL reject the request with a `401 Unauthorized` response.
5. IF a request arrives from a user without `admin` or `superadmin` role for remove/ban/unban operations, THEN THE Membership_Manager SHALL reject the request with a `403 Forbidden` response.

---

### Requirement 6: Frontend Member Management UI

**User Story:** As an admin, I want a clear and accessible UI on the Team page, so that I can manage members efficiently without navigating away.

#### Acceptance Criteria

1. THE Team_Page SHALL display each organization member in a table row containing the member's name, email, role badge, and an actions dropdown.
2. THE Team_Page SHALL render role badges using visually distinct styles per role (color-coded with icon) consistent with the existing `roleStyles` configuration.
3. WHEN the current user has `admin` or `superadmin` role, THE Team_Page SHALL include "Remove" and "Ban" options in the actions dropdown for eligible members.
4. WHEN the current user has `admin` or `superadmin` role, THE Team_Page SHALL include a "Change Role" option in the actions dropdown for eligible members.
5. WHEN a user selects a destructive action (Remove, Ban, Leave), THE Team_Page SHALL display a confirmation dialog before executing the action.
6. THE Team_Page SHALL display a "Leave Organization" button in the Danger_Zone section accessible to all authenticated Organization_Members.
7. WHEN an action is in progress, THE Team_Page SHALL display a loading indicator and disable the action button to prevent duplicate submissions.

---

### Requirement 7: Real-Time UI Updates

**User Story:** As a team member, I want the member list to update instantly when membership changes occur, so that I always see an accurate view of who is in the organization.

#### Acceptance Criteria

1. WHEN a member is removed, banned, or leaves the organization, THE Realtime_Channel SHALL broadcast a membership change event to all connected clients in the same organization.
2. WHEN THE Team_Page receives a membership change event via the Realtime_Channel, THE Team_Page SHALL update the displayed member list without requiring a manual page refresh.
3. WHEN the currently authenticated user's own membership is revoked (via remove or ban), THE Team_Page SHALL detect the event and redirect the user to the login or org-selection screen within 2 seconds of the event being received.
4. WHILE a Realtime_Channel subscription is active, THE Team_Page SHALL maintain the subscription and reconnect automatically if the connection is interrupted.

---

### Requirement 8: Edge Case Handling

**User Story:** As a platform operator, I want all edge cases to be handled gracefully, so that the system remains consistent and users receive clear feedback.

#### Acceptance Criteria

1. WHEN the sole Owner of an organization attempts to leave, THE Membership_Manager SHALL block the action and return an error message: "You are the only owner. Transfer ownership before leaving."
2. WHEN an organization's last member leaves or is removed, THE Membership_Manager SHALL mark the organization as inactive rather than deleting it, preserving data integrity.
3. WHEN a banned user attempts to accept an invitation or join an organization, THE Membership_Manager SHALL return an error message: "You are banned from this organization."
4. IF a remove or ban request targets a user who is no longer a member of the organization, THEN THE Membership_Manager SHALL return a `404 Not Found` response.
5. WHEN the currently authenticated user is removed from the organization by an admin, THE Team_Page SHALL detect the event via the Realtime_Channel and log the user out or redirect them to an org-selection screen.

---

### Requirement 9: Security and Backend Enforcement

**User Story:** As a security-conscious operator, I want all membership rules enforced on the backend, so that client-side bypasses cannot compromise org integrity.

#### Acceptance Criteria

1. THE Membership_Manager SHALL validate the Requester's authentication token on every request using the existing `authenticate` middleware before executing any membership operation.
2. THE Membership_Manager SHALL validate org membership of the Requester using the existing `requireOrg` middleware before executing any membership operation.
3. THE Membership_Manager SHALL enforce role and Power_Level checks server-side for every remove, ban, and unban operation, regardless of what the frontend sends.
4. THE Membership_Manager SHALL validate that the Target belongs to the same organization as the Requester before executing any remove or ban operation.
5. WHEN a ban check is performed during an invite or join flow, THE Membership_Manager SHALL query the Ban_Registry using both `user_id` and `org_id` to ensure the check is scoped to the correct organization.
6. THE Membership_Manager SHALL log all membership change events (leave, remove, ban, unban) including the Requester's ID, Target's ID, org ID, action type, and timestamp for audit purposes.
