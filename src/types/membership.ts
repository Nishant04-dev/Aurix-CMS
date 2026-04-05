export interface BannedMember {
  id: string;
  userId: string;
  orgId: string;
  bannedBy: string;
  bannedByName?: string;
  reason?: string;
  createdAt: string;
  name?: string;
  email?: string;
}

export interface MembershipAction {
  targetUserId: string;
  reason?: string;
}
