/**
 * Turns a sheet's headers and rows into contacts.
 *
 * The web's ImportDialog asks the user to map every column by hand. On a phone
 * that is a lot of pickers, so the headers are matched by name instead and the
 * result is shown before anything is sent. Anything unrecognised becomes a
 * custom field, which is what the web's "field" mapping does, so no column is
 * silently dropped.
 */
import type { ContactInput, SheetTable } from '../api/contacts';

/** What a column was taken to mean. */
export type ColumnTarget =
  | 'phone'
  | 'email'
  | 'first_name'
  | 'last_name'
  | 'name'
  | 'tags'
  | 'field';

/** Header spellings we accept, in the order they are tried. */
const PATTERNS: { target: Exclude<ColumnTarget, 'field'>; match: RegExp }[] = [
  { target: 'phone', match: /^(phone|phone.?number|mobile|cell|tel|telephone|number)$/ },
  { target: 'email', match: /^(e.?mail|email.?address)$/ },
  { target: 'first_name', match: /^(first.?name|given.?name|first)$/ },
  { target: 'last_name', match: /^(last.?name|surname|family.?name|last)$/ },
  { target: 'name', match: /^(name|full.?name|contact|contact.?name)$/ },
  { target: 'tags', match: /^(tags?|labels?|segments?)$/ },
];

/** Compares header names ignoring case, spaces, underscores and dashes. */
function normalise(header: string): string {
  return header.trim().toLowerCase().replace(/[\s_-]+/g, '');
}

function targetFor(header: string): ColumnTarget {
  const key = normalise(header);
  if (key === '') return 'field';
  for (const { target, match } of PATTERNS) {
    // The patterns are written with separators, so compare against those removed.
    if (match.test(key) || match.test(key.replace(/[^a-z]/g, ''))) return target;
  }
  return 'field';
}

/** Splits "a, b" or "a; b" into tags. */
function splitTags(value: string): string[] {
  return value
    .split(/[,;]/)
    .map((tag) => tag.trim())
    .filter(Boolean);
}

/** "Jordan Diaz" -> first "Jordan", last "Diaz". */
function splitName(value: string): { first?: string; last?: string } {
  const parts = value.trim().split(/\s+/);
  if (parts.length === 0 || parts[0] === '') return {};
  if (parts.length === 1) return { first: parts[0] };
  return { first: parts.slice(0, -1).join(' '), last: parts[parts.length - 1] };
}

export interface MappedSheet {
  /** Rows that had a phone number or an email, ready to send. */
  rows: ContactInput[];
  /** Which header filled which contact field, for showing the user. */
  matched: { header: string; target: ColumnTarget }[];
}

/**
 * The sheet's rows as contacts. Rows with neither a phone number nor an email
 * are left out: the server counts them as invalid, so there is no reason to
 * send them.
 */
export function mapSheetRows(table: SheetTable): MappedSheet {
  const matched = table.headers.map((header) => ({ header, target: targetFor(header) }));
  const rows: ContactInput[] = [];

  for (const cells of table.rows) {
    const input: ContactInput = {};
    const fields: Record<string, string> = {};

    matched.forEach(({ header, target }, index) => {
      const value = (cells[index] ?? '').trim();
      if (value === '') return;

      switch (target) {
        case 'phone':
          input.phone = value;
          break;
        case 'email':
          input.email = value;
          break;
        case 'first_name':
          input.first_name = value;
          break;
        case 'last_name':
          input.last_name = value;
          break;
        case 'name': {
          // An explicit first/last column wins over a combined one.
          const { first, last } = splitName(value);
          if (first && !input.first_name) input.first_name = first;
          if (last && !input.last_name) input.last_name = last;
          break;
        }
        case 'tags':
          input.tags = [...(input.tags ?? []), ...splitTags(value)];
          break;
        case 'field':
          fields[header.trim() || `column_${index + 1}`] = value;
          break;
      }
    });

    if (Object.keys(fields).length > 0) input.fields = fields;
    if (input.phone || input.email) rows.push(input);
  }

  return { rows, matched };
}

const LABELS: Record<ColumnTarget, string> = {
  phone: 'phone',
  email: 'email',
  first_name: 'first name',
  last_name: 'last name',
  name: 'name',
  tags: 'tags',
  field: 'custom field',
};

/** "phone, email and first name. 2 more kept as custom fields." */
export function describeMapping(matched: { header: string; target: ColumnTarget }[]): string {
  const known = matched.filter((column) => column.target !== 'field');
  const extras = matched.length - known.length;

  if (known.length === 0) {
    return 'No column looked like a phone number or an email.';
  }

  const names = known.map((column) => LABELS[column.target]);
  const list =
    names.length === 1
      ? names[0]
      : `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`;

  const tail =
    extras > 0
      ? ` ${extras} other ${extras === 1 ? 'column' : 'columns'} kept as custom fields.`
      : '';
  return `Matched ${list}.${tail}`;
}
