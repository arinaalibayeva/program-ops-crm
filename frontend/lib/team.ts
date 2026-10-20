// Who can sign in to the CRM. Everything goes through the backend: invitations
// need real accounts, so sample-data mode has no team to manage.

export type TeamRole = "manager" | "admin";

export const ROLE_LABELS: Record<TeamRole, string> = {
  manager: "Manager",
  admin: "Team member",
};

export interface TeamMember {
  id: string;
  name: string;
  email: string;
  role: TeamRole;
  status: "active" | "invited" | "expired";
}

export interface InviteLink {
  member: TeamMember;
  /** Shown once: the database only keeps a hash of it. */
  token: string;
}

export interface InviteInfo {
  name: string;
  email: string;
  programName?: string;
  /** The person already has a password and is replacing it. */
  isReset: boolean;
  invitedBy?: string;
}
