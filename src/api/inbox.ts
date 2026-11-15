import api from './client';

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

/**
 * The folders, in the order they are shown. All is first because it is the one
 * the screen opens on, and a selected chip that starts in the middle of the row
 * reads as though something has already been filtered away.
 *
 * `needs_reply` is labelled "Unread": one word, and it is what the folder means
 * to the person reading it — conversations where the last word was theirs, not
 * ours. The key stays `needs_reply` because that is the folder name the backend
 * and the web both use (spyder-backend/src/routes/inbox.ts).
 */
export const INBOX_FOLDERS: { key: InboxFolder; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'needs_reply', label: 'Unread' },
  { key: 'mine', label: 'Mine' },
  { key: 'flagged', label: 'Flagged' },
  { key: 'closed', label: 'Closed' },
];

const actionPath = (contact: string, action: string) =>
  `/inbox/${encodeURIComponent(contact)}/${action}`;

/** The server's MAX_LIMIT for /inbox (spyder-backend/src/routes/inbox.ts). */
export const INBOX_MAX_LIMIT = 100;

export const inboxApi = {
  list: ({ folder, q = '', limit = INBOX_PAGE_SIZE, offset = 0 }: InboxListParams) =>
    api.get<InboxPage>('/inbox', { params: { folder, q, limit, offset } }).then((res) => res.data),

  /**
   * How many conversations have an unread reply, for the tab bar badge.
   *
   * `counts` has no unread total: the backend derives unread per thread, from
   * whether the latest inbound message is newer than this user's last read. So
   * this counts the threads itself, over one page of at most MAX_LIMIT. An
   * organization with more unread conversations than that would undercount,
   * which is the same ceiling the web badge works to.
   */
  unreadCount: () =>
    api
      .get<InboxPage>('/inbox', {
        params: { folder: 'all', q: '', limit: INBOX_MAX_LIMIT, offset: 0 },
      })
      .then((res) => res.data.threads.filter((thread) => thread.unread).length),
  read: (contact: string) => api.post(actionPath(contact, 'read')).then(() => undefined),
  close: (contact: string) => api.post(actionPath(contact, 'close')).then(() => undefined),
  reopen: (contact: string) => api.post(actionPath(contact, 'reopen')).then(() => undefined),
  /** Needs the team_inbox feature; `null` unassigns. */
  assign: (contact: string, userId: string | null) =>
    api.post(actionPath(contact, 'assign'), { userId }).then(() => undefined),
  /**
   * The one thread for an address, or null when there is no conversation yet.
   *
   * There is no endpoint for a single thread, so this searches: `q` matches
   * `phone_number` among other columns (`matched` in
   * spyder-backend/src/services/inboxQuery.ts), and the exact address is then
   * picked out of the page, because a substring match can return more than one
   * — "555" matches every number containing it.
   *
   * The conversation screen needs it for the thread's flagged, closed, opted-out
   * and assigned state, none of which is in the chat messages.
   */
  findByAddress: (address: string) =>
    api
      .get<InboxPage>('/inbox', {
        params: { folder: 'all', q: address, limit: INBOX_PAGE_SIZE, offset: 0 },
      })
      .then(
        (res) =>
          res.data.threads.find(
            (thread) =>
              thread.phone_number === address ||
              thread.contact === address.trim().toLowerCase()
          ) ?? null
      ),
};

/** react-query key for one conversation's thread state, by address. */
export const INBOX_THREAD_QUERY_KEY = 'inbox-thread';
