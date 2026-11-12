import api from './client';

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

/** Where an import's rows came from. The server rejects any other source. */
export type ImportSource = 'file' | 'google_sheet';

/** What /contacts/import did with the rows it was given. */
export interface ImportResult {
  added: number;
  updated: number;
  /** Rows with neither a usable phone number nor an email. */
  invalid: number;
  /** Rows skipped because the address has opted out. */
  opted_out: number;
}

/** A sheet shared by link, as headers plus rows, ready to map to contacts. */
export interface SheetTable {
  headers: string[];
  rows: string[][];
}

export const CONTACTS_QUERY_KEY = 'contacts';
export const CONTACTS_PAGE_SIZE = 25;

/** The server's cap for one import (spyder-backend/src/routes/contacts.ts). */
export const MAX_IMPORT_ROWS = 10_000;

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
  /** One contact, for the detail screen. 404 for an id outside the organization. */
  get: (id: string) => api.get<ContactRow>(`/contacts/${id}`).then((res) => res.data),
  /** Adds a contact by hand, or fills in the blanks of the one with the same key. 409 `opted_out` when blocked. */
  create: (input: ContactInput) => api.post<ContactRow>('/contacts', input).then((res) => res.data),
  update: (id: string, patch: ContactPatch) =>
    api.patch<ContactRow>(`/contacts/${id}`, patch).then((res) => res.data),
  /** Flags a conversation by its address (a phone number or email), creating the contact if needed. */
  flag: (address: string, flagged: boolean) =>
    api.post<ContactRow>('/contacts/flag', { address, flagged }).then((res) => res.data),

  /**
   * Adds many contacts at once. The rows are already mapped to contact fields,
   * the same way the web maps a spreadsheet's columns before sending them.
   */
  import: (source: ImportSource, rows: ContactInput[]) =>
    api
      .post<ImportResult>('/contacts/import', { source, rows })
      .then((res) => res.data),

  /**
   * Reads a Google Sheet shared by link, for the caller to map and pass to
   * `import`. The sheet must be shared as "anyone with the link can view";
   * the server answers 422 when it is not.
   */
  googleSheet: (url: string) =>
    api.post<SheetTable>('/contacts/google-sheet', { url }).then((res) => res.data),
};
