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

/** What a first message to an address will do, from GET /contacts/send-preview. */
export interface SendPreview {
  opted_out: boolean;
  first_contact: boolean;
  /** ISO time a first message waits for (quiet hours); null when it goes out right away. */
  quiet_until: string | null;
}

/** What one message to a selection of contacts did, from POST /contacts/send. */
export interface QuickSendResult {
  campaign_id: string;
  recipients: number;
  skipped_opted_out: number;
  /** Contacts with an email but no phone number are left out of a quick send. */
  skipped_no_phone: number;
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
  /**
   * What sending to this address would do, before anything is sent: whether it
   * has opted out, whether it is a first contact, and when a first message
   * would actually go out.
   *
   * Worth asking because a first message to a new contact is held for quiet
   * hours, so without this the app would say "sent" and nothing would appear
   * for hours.
   */
  sendPreview: (to: string) =>
    api.get<SendPreview>('/contacts/send-preview', { params: { to } }).then((res) => res.data),
  /**
   * One plain-text message to the chosen contacts, as a campaign the server
   * creates. 400 `no_recipients`, 403 `{ code }` when sending is blocked.
   *
   * The result names what it skipped, which the caller has to show: "sent to 40
   * of 50" with no reason is the kind of thing that gets debugged twice.
   */
  send: (contactIds: string[], message: string) =>
    api
      .post<QuickSendResult>('/contacts/send', { contact_ids: contactIds, message })
      .then((res) => res.data),
};

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_CHARS = /^[\d\s()+\-.]+$/;

/**
 * Whether an address can be sent to: a phone number of 7 to 15 digits in any
 * common format, or an email address. Ported from `isSendableAddress` in
 * spyder-web/src/pages/inbox/NewMessageDialog.tsx.
 *
 * Deliberately loose. The server normalises and has the final say; this only
 * decides when to enable the Send button, so it must not reject something the
 * server would have accepted.
 */
export function isSendableAddress(value: string): boolean {
  const address = value.trim();
  if (EMAIL.test(address)) return true;
  if (!PHONE_CHARS.test(address)) return false;
  const digits = address.replace(/\D/g, '').length;
  return digits >= 7 && digits <= 15;
}
