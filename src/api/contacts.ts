import api from './client';

/** Mirrors spyder-web/src/api/contacts.ts (read and light edits; import stays web-only). */

export type ContactSource = 'manual' | 'file' | 'google_sheet' | 'inbox' | 'send' | 'campaign';
export type ContactFilter = 'all' | 'flagged' | 'opted_out';

export interface ContactRow {
  id: string;
  /** The inbox's key for this contact: the normalised phone number, or the lower-cased email. */
  contact_key: string;
  phone: string | null;
  email: string | null;
  first_name: string | null;
  last_name: string | null;
  tags: string[];
  fields: Record<string, string>;
  source: ContactSource;
  flagged: boolean;
  opted_out: boolean;
  last_message_at: string | null;
  created_at: string;
}

export interface ContactInput {
  phone?: string;
  email?: string;
  first_name?: string;
  last_name?: string;
  tags?: string[];
  fields?: Record<string, string>;
}

/** A name set to '' clears it; tags replace the list. */
export interface ContactPatch {
  flagged?: boolean;
  first_name?: string;
  last_name?: string;
  tags?: string[];
}

export type ContactCounts = Record<ContactFilter, number>;

export interface ContactsPage {
  contacts: ContactRow[];
  counts: ContactCounts;
  pagination: { limit: number; offset: number; total: number; hasMore: boolean };
}

export interface ContactsListParams {
  filter?: ContactFilter;
  q?: string;
  limit?: number;
  offset?: number;
}

export const CONTACTS_QUERY_KEY = 'contacts';
export const CONTACTS_PAGE_SIZE = 25;

export const OPTED_OUT_MESSAGE = 'This contact has opted out';

export const CONTACT_FILTERS: { key: ContactFilter; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'flagged', label: 'Flagged' },
  { key: 'opted_out', label: 'Opted out' },
];

/** True for the 409 the server sends when an address has opted out. */
export function isOptedOutError(error: unknown): boolean {
  const response = (error as { response?: { status?: number; data?: { code?: unknown } } } | null)
    ?.response;
  return response?.status === 409 && response.data?.code === 'opted_out';
}

/** The name to show for a contact, falling back to the address. */
export function contactName(contact: ContactRow): string {
  const name = [contact.first_name, contact.last_name].filter(Boolean).join(' ').trim();
  return name || contact.phone || contact.email || contact.contact_key;
}

export const contactsApi = {
  list: ({ filter = 'all', q = '', limit = CONTACTS_PAGE_SIZE, offset = 0 }: ContactsListParams = {}) =>
    api.get<ContactsPage>('/contacts', { params: { filter, q, limit, offset } }).then((res) => res.data),
  /** Adds a contact by hand, or fills in the blanks of the one with the same key. 409 `opted_out` when blocked. */
  create: (input: ContactInput) => api.post<ContactRow>('/contacts', input).then((res) => res.data),
  update: (id: string, patch: ContactPatch) =>
    api.patch<ContactRow>(`/contacts/${id}`, patch).then((res) => res.data),
  /** Flags a conversation by its address (a phone number or email), creating the contact if needed. */
  flag: (address: string, flagged: boolean) =>
    api.post<ContactRow>('/contacts/flag', { address, flagged }).then((res) => res.data),
};
