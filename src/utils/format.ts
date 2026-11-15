import { differenceInCalendarDays, format, formatDistanceToNowStrict, isToday } from 'date-fns';

/**
 * When a row in a list happened: "8:02 AM" today, "Yesterday", the weekday
 * within the past week, then "Oct 19". Empty string for no date.
 *
 * Ported from `formatListTime` in spyder-web/src/pages/inbox/ThreadList.tsx,
 * thresholds and wording included, so the two apps never label the same row
 * differently.
 *
 * It replaces `shortTime` in every list. That one printed the weekday for
 * anything under seven days old, so a message from last Tuesday read "Tue"
 * with nothing to tell it from this Tuesday, and yesterday was a weekday name
 * rather than the word. Both are the cases this spells out.
 */
export function listTime(value: string | null | undefined, now: Date = new Date()): string {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';

  // Calendar days apart, not elapsed hours: 11pm to 1am is "Yesterday", not today.
  const days = differenceInCalendarDays(now, date);
  if (days <= 0) return format(date, 'p');
  if (days === 1) return 'Yesterday';
  if (days < 7) return format(date, 'EEEE');
  return format(date, 'd MMM');
}

/**
 * When a message inside a conversation happened: "Today 8:02 AM",
 * "Yesterday 4:05 PM", then "Mon, 20 Oct at 4:05 PM".
 *
 * Ported from `formatStamp` in spyder-web/src/pages/inbox/Thread.tsx. Fuller
 * than `listTime` because a stamp in a thread is shown rarely, between runs of
 * messages, so it has to stand on its own rather than be read against a column
 * of other times.
 */
export function stampTime(value: string | null | undefined, now: Date = new Date()): string {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';

  const days = differenceInCalendarDays(now, date);
  if (days <= 0) return `Today ${format(date, 'p')}`;
  if (days === 1) return `Yesterday ${format(date, 'p')}`;
  return format(date, "EEE, d MMM 'at' p");
}

/** How long between messages before a thread shows a fresh stamp. Matches the web. */
export const STAMP_GAP_MS = 60 * 60 * 1000;

/** "4:21 PM" today, "Tue" this week, "14 Mar" beyond. Empty string for no date. */
export function shortTime(value: string | null | undefined): string {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';

  if (isToday(date)) return format(date, 'p');
  const days = Math.abs(differenceInCalendarDays(new Date(), date));
  if (days < 7) return format(date, 'EEE');
  return format(date, 'd MMM');
}

/** "3 minutes ago". Empty string for no date. */
export function relativeTime(value: string | null | undefined): string {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return `${formatDistanceToNowStrict(date)} ago`;
}

/** A 0-to-1 fraction as a whole percentage, the way the web dashboard shows rates. */
export function percent(fraction: number | null | undefined): string {
  if (fraction === null || fraction === undefined || Number.isNaN(fraction)) return '—';
  return `${Math.round(fraction * 100)}%`;
}

/**
 * +1 (805) 215-2331 for an 11-digit US number, +1... for other E.164 input,
 * and anything else (an email, a short code) unchanged.
 */
export function prettyPhone(value: string | null | undefined): string {
  if (!value) return '';
  if (value.includes('@')) return value;

  const digits = value.replace(/\D/g, '');
  if (digits.length === 11 && digits.startsWith('1')) {
    return `+1 (${digits.slice(1, 4)}) ${digits.slice(4, 7)}-${digits.slice(7)}`;
  }
  if (digits.length === 10) {
    return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
  }
  return value;
}

/** The name to show for a conversation: the display name, else the formatted address. */
export function threadTitle(displayName: string | null, address: string): string {
  return displayName?.trim() || prettyPhone(address);
}
