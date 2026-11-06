import { differenceInCalendarDays, format, formatDistanceToNowStrict, isToday } from 'date-fns';

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
