import api from './client';

/** Mirrors spyder-web/src/api/inbox.ts. Keep the two in step. */

export type InboxFolder = 'needs_reply' | 'mine' | 'all' | 'closed' | 'flagged';

export interface InboxThread {
  /** Normalised key of the conversation; use it for the inbox actions only. */
  contact: string;
  /** Raw address of the latest message; use it for the chat and for sending. */
  phone_number: string;
  display_name: string | null;
  last_text: string | null;
  last_at: string | null;
  last_direction: 'in' | 'out';
  unread: boolean;
  assigned_user_id: string | null;
  closed: boolean;
  line_name: string | null;
  campaign_name: string | null;
  tag: 'opted_out' | null;
  /** The contact with this key is flagged in Contacts. */
  flagged: boolean;
}

export type InboxCounts = Record<InboxFolder, number>;

export interface InboxPage {
  threads: InboxThread[];
  counts: InboxCounts;
  pagination: { limit: number; offset: number; total: number; hasMore: boolean };
}

export interface InboxListParams {
  folder: InboxFolder;
  q?: string;
  limit?: number;
  offset?: number;
}

export const INBOX_QUERY_KEY = 'inbox';
export const INBOX_BADGE_QUERY_KEY = 'inbox-badge';
export const INBOX_PAGE_SIZE = 25;

export const INBOX_FOLDERS: { key: InboxFolder; label: string }[] = [
  { key: 'needs_reply', label: 'Needs reply' },
  { key: 'mine', label: 'Mine' },
  { key: 'all', label: 'All' },
  { key: 'flagged', label: 'Flagged' },
  { key: 'closed', label: 'Closed' },
];

const actionPath = (contact: string, action: string) =>
  `/inbox/${encodeURIComponent(contact)}/${action}`;

export const inboxApi = {
  list: ({ folder, q = '', limit = INBOX_PAGE_SIZE, offset = 0 }: InboxListParams) =>
    api.get<InboxPage>('/inbox', { params: { folder, q, limit, offset } }).then((res) => res.data),
  read: (contact: string) => api.post(actionPath(contact, 'read')).then(() => undefined),
  close: (contact: string) => api.post(actionPath(contact, 'close')).then(() => undefined),
  reopen: (contact: string) => api.post(actionPath(contact, 'reopen')).then(() => undefined),
  /** Needs the team_inbox feature; `null` unassigns. */
  assign: (contact: string, userId: string | null) =>
    api.post(actionPath(contact, 'assign'), { userId }).then(() => undefined),
};
