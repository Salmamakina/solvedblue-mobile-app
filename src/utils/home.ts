/**
 * Home's text and setup logic, ported from spyder-web/src/pages/home/Home.tsx
 * and sendStep.ts so the mobile Home reads the same as the web dashboard.
 */
import type { HomeSetup } from '../api/home';

export function greetingFor(hour: number): string {
  if (hour >= 5 && hour < 12) return 'Good morning';
  if (hour >= 12 && hour < 17) return 'Good afternoon';
  return 'Good evening';
}

/** jordan.diaz@x -> Jordan: the first segment of the local part, capitalised. */
export function firstName(email: string | undefined | null): string {
  const first = (email ?? '').split('@')[0].trim().split(/[._-]/)[0];
  return first ? first.charAt(0).toUpperCase() + first.slice(1) : '';
}

/** "Saturday, 7 November", matching the web header. */
export function formatHomeDate(now: Date): string {
  const weekday = now.toLocaleDateString('en-US', { weekday: 'long' });
  const month = now.toLocaleDateString('en-US', { month: 'long' });
  return `${weekday}, ${now.getDate()} ${month}`;
}

export function deltaNote(today: number, yesterday: number): string {
  const diff = today - yesterday;
  if (diff === 0) return 'Same as yesterday';
  return `${diff > 0 ? '+' : '−'}${Math.abs(diff)} vs yesterday`;
}

export function healthDeltaNote(delta: number): string {
  if (delta === 0) return 'Same as last week';
  return `${delta > 0 ? '+' : '−'}${Math.abs(delta)} vs last week`;
}

/** A 0-to-1 fraction with one decimal, the way the web tiles show rates. */
export function rate(fraction: number): string {
  return `${(fraction * 100).toFixed(1)}%`;
}

export interface SendStep {
  todo: string;
  /** Where the to-do goes; null while there is nothing the customer can do. */
  to: string | null;
}

/** Whether sending can start: no plan first, then no line yet. Null when open. */
export function sendBlock(setup: Pick<HomeSetup, 'plan_active' | 'line_ready'>): SendStep | null {
  if (!setup.plan_active) return { todo: 'Choose a plan on Account', to: '/(tabs)/account' };
  if (!setup.line_ready) return { todo: 'Your line is being set up', to: null };
  return null;
}

export function sendStep(setup: Pick<HomeSetup, 'plan_active' | 'line_ready'>): SendStep {
  return sendBlock(setup) ?? { todo: 'Pick a contact and say hello', to: '/(tabs)/contacts' };
}

export type SetupKey = 'contacts_imported' | 'first_message' | 'first_reply';

export interface SetupStep extends SendStep {
  key: SetupKey;
  title: string;
  /** Shown instead of the to-do once the step is done. */
  done: string;
}

/** The same three steps the web shows, in the same order. */
export function setupSteps(setup: HomeSetup): SetupStep[] {
  return [
    {
      key: 'contacts_imported',
      title: 'Import contacts',
      done: 'Your contacts are in',
      todo: 'Add a spreadsheet or Google Sheet',
      to: '/(tabs)/contacts',
    },
    {
      key: 'first_message',
      title: 'Send your first message',
      done: 'Your first message is out',
      ...sendStep(setup),
    },
    {
      key: 'first_reply',
      title: 'Get your first reply',
      done: 'Your first reply is in',
      todo: 'Usually within a day',
      to: '/(tabs)/inbox',
    },
  ];
}

/** Customers never see lines or devices, so the capacity factor is reworded. */
export const HEALTH_FACTOR_LABELS: Record<string, string> = {
  delivery: 'Delivery',
  replies: 'Replies',
  opt_outs: 'Opt-outs',
  lines: 'Sending capacity',
};

/** 80% of the daily cap or more is "near the limit", same as the web and backend. */
export const NEAR_CAP = 0.8;
