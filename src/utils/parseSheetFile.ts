/**
 * Reads the first sheet of a CSV, XLSX or XLS file into the same
 * `{ headers, rows }` shape `/contacts/google-sheet` returns, so one mapping
 * path (`mapSheetRows`) serves a file and a link alike.
 *
 * Ported from spyder-web/src/pages/contacts/parseFile.ts, on the same SheetJS
 * version (0.20.3) the web pins, so a spreadsheet that imports on one imports
 * the same way on the other.
 *
 * Where it differs: the web is handed a `File` from a drop or a file input and
 * reads `.text()` or `.arrayBuffer()` off it. Here a picker gives back a
 * `file://` URI, so the bytes come from expo-file-system. Binary workbooks go
 * in as base64, which is the route SheetJS documents for React Native and
 * avoids relying on a TextDecoder under Hermes.
 */
import { File } from 'expo-file-system';
import * as XLSX from 'xlsx';
import { MAX_IMPORT_ROWS, type SheetTable } from '../api/contacts';

/**
 * The web refuses a file over 5 MB before reading it
 * (MAX_FILE_BYTES in spyder-web/src/pages/contacts/columnGuess.ts). Same limit:
 * a sheet this size is already well past the row cap, and reading a large file
 * into memory on a phone is worse than on a desktop.
 */
export const MAX_FILE_BYTES = 5 * 1024 * 1024;

export const FILE_LIMIT_MESSAGE = `Up to ${MAX_IMPORT_ROWS.toLocaleString()} rows and 5 MB`;

/** What the picker is allowed to return, and what the parser can read. */
export const SHEET_EXTENSIONS = ['csv', 'tsv', 'txt', 'xlsx', 'xls'] as const;

/** The MIME types for those, for the document picker's filter. */
export const SHEET_MIME_TYPES = [
  'text/csv',
  'text/comma-separated-values',
  'text/tab-separated-values',
  'text/plain',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
];

/** A file we cannot read, or one too big to try. */
export class SheetFileError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SheetFileError';
  }
}

const extensionOf = (name: string) => name.split('?')[0].split('.').pop()?.toLowerCase() ?? '';

/** Whether this is a delimited text file rather than a binary workbook. */
function isTextFile(name: string, mimeType?: string | null): boolean {
  if (/^(csv|tsv|txt)$/.test(extensionOf(name))) return true;
  return (mimeType ?? '').startsWith('text/');
}

export interface PickedSheet {
  /** A `file://` URI from the document picker. */
  uri: string;
  name: string;
  mimeType?: string | null;
  size?: number | null;
}

/**
 * The first sheet of a picked file.
 *
 * Stops one row past the cap so a huge sheet is never built in full, then
 * refuses it — the same guard, and the same message, as the web.
 */
export async function parseSheetFile(picked: PickedSheet): Promise<SheetTable> {
  if (picked.size != null && picked.size > MAX_FILE_BYTES) {
    throw new SheetFileError(`That file is too large. ${FILE_LIMIT_MESSAGE}.`);
  }

  const extension = extensionOf(picked.name);
  if (!(SHEET_EXTENSIONS as readonly string[]).includes(extension)) {
    throw new SheetFileError('Choose a CSV, XLSX or XLS file.');
  }

  const file = new File(picked.uri);
  // Header row, the cap, and one more so "too many" can be told from "exactly
  // the cap".
  const sheetRows = MAX_IMPORT_ROWS + 2;

  let workbook: XLSX.WorkBook;
  try {
    if (isTextFile(picked.name, picked.mimeType)) {
      // raw: true so SheetJS does not reinterpret cells it reads as text; the
      // numeric pass below is what recovers full-precision numbers.
      workbook = XLSX.read(await file.text(), { type: 'string', raw: true, sheetRows });
    } else {
      workbook = XLSX.read(await file.base64(), { type: 'base64', sheetRows });
    }
  } catch {
    throw new SheetFileError("Couldn't read that file. Check it opens in a spreadsheet app.");
  }

  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  if (!sheet) throw new SheetFileError('That file has no sheets.');

  const options = { header: 1 as const, defval: '', blankrows: false };
  // Two passes, for the reason the web gives: formatted text keeps dates
  // looking the way the sheet shows them, but a long number comes out as
  // 4.47911E+11 with its last digits rounded away. Numeric cells are taken
  // from the raw pass instead, so a phone number keeps every digit.
  const formatted = XLSX.utils.sheet_to_json<unknown[]>(sheet, { ...options, raw: false });
  const values = XLSX.utils.sheet_to_json<unknown[]>(sheet, { ...options, raw: true });

  const [headerRow, ...dataRows] = formatted;
  if (!headerRow) throw new SheetFileError('That file is empty.');
  if (dataRows.length > MAX_IMPORT_ROWS) {
    throw new SheetFileError(
      `That is more than ${MAX_IMPORT_ROWS.toLocaleString()} rows. Split the file and import it in parts.`
    );
  }

  const headers = headerRow.map((cell) => String(cell ?? '').trim());
  const rows = dataRows.map((row, index) =>
    headers.map((_, column) => {
      const value = values[index + 1]?.[column];
      return typeof value === 'number' ? String(value) : String(row[column] ?? '');
    })
  );

  return { headers, rows };
}
