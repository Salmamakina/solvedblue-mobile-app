/**
 * Mirrors spyder-web/src/api/organizations.ts: the members of an organization
 * and its pending invites.
 *
 * Everything here is scoped to the caller's own organization. Listing is open
 * to any member; inviting, revoking, changing a role and removing someone are
 * admin-only on the server (requireOrgAdmin), so the UI hides those controls
 * rather than offering buttons that would 403.
 */
import api from './client';

/** The roles an invite or a role change may use. */
export type MemberRole = 'admin' | 'member' | 'viewer';

export const MEMBER_ROLES: { key: MemberRole; label: string; hint: string }[] = [
  { key: 'admin', label: 'Admin', hint: 'Can invite people and change billing.' },
  { key: 'member', label: 'Member', hint: 'Can send and reply.' },
  { key: 'viewer', label: 'Viewer', hint: 'Can read, but not send.' },
];

export interface Member {
  id: string;
  email: string;
  created_at: string;
  role_id: string | null;
  role_name: string | null;
  role_display_name: string | null;
}

export interface Invite {
  email: string;
  role: MemberRole | string;
  created_at?: string;
  invited_by?: string | null;
  expires_at?: string | null;
}

export const MEMBERS_QUERY_KEY = 'org-members';
export const INVITES_QUERY_KEY = 'org-invites';

/** How many of each list the Account tab shows before "See all". */
export const PREVIEW_COUNT = 3;

/** The label for a member's role; an unset role is a plain member. */
export function roleLabel(member: Pick<Member, 'role_name' | 'role_display_name'>): string {
  return member.role_display_name ?? member.role_name ?? 'Member';
}

export const organizationsApi = {
  members: (orgId: string) =>
    api
      .get<{ users: Member[] }>(`/organizations/${orgId}/users`)
      .then((res) => res.data.users),

  invites: (orgId: string) =>
    api
      .get<{ invites: Invite[] }>(`/organizations/${orgId}/invites`)
      .then((res) => res.data.invites),

  /** Admin only. An existing user joins straight away; a new email is invited. */
  invite: (orgId: string, email: string, role: MemberRole) =>
    api
      .post<{ invite: Invite }>(`/organizations/${orgId}/invites`, { email, role })
      .then((res) => res.data.invite),

  /** Admin only. */
  revokeInvite: (orgId: string, email: string) =>
    api
      .delete(`/organizations/${orgId}/invites/${encodeURIComponent(email)}`)
      .then(() => undefined),

  /** Admin only. */
  changeRole: (orgId: string, userId: string, role: MemberRole) =>
    api
      .patch<{ user: Member }>(`/organizations/${orgId}/users/${userId}`, { role })
      .then((res) => res.data.user),

  /** Admin only. The person moves to a fresh organization of their own. */
  removeMember: (orgId: string, userId: string) =>
    api.delete(`/organizations/${orgId}/users/${userId}`).then(() => undefined),
};
