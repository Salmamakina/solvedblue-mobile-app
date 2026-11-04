import api from './client';

/** Mirrors spyder-web/src/api/home.ts. Keep the two in step. */

export type LineHealth = 'healthy' | 'attention' | 'offline';

export interface HomeSetup {
  plan_active: boolean;
  line_ready: boolean;
  contacts_imported: boolean;
  first_message: boolean;
  first_reply: boolean;
}

export interface HomeLine {
  id: string;
  name: string;
  /** 'android' for text fallback lines; anything else is an iMessage (Mac) line. */
  platform: string;
  status: string;
  last_seen: string | null;
  apple_id_masked: string | null;
  used_today: number;
  cap: number;
  warmup: { day: number; complete: boolean };
  health: LineHealth;
  reply_rate_7d: number;
}

export interface HomeStats {
  sent_today: number;
  replies_today: number;
  sent_yesterday: number;
  replies_yesterday: number;
  /** Fractions from 0 to 1. */
  reply_rate_7d: number;
  optout_rate_7d: number;
}

export interface HomeWaiting {
  contact: string;
  phone_number: string;
  display_name: string | null;
  last_text: string | null;
  last_at: string | null;
  last_direction: string | null;
  unread: boolean | number;
  assigned_user_id: string | null;
  closed: boolean;
  line_name: string | null;
  campaign_name: string | null;
  tag: 'opted_out' | null;
}

export interface HomeCampaign {
  id: string;
  name: string;
  status: 'active' | 'scheduled' | string;
  sent: number;
  total: number;
  replies: number;
  next_send_at: string | null;
}

export interface HomePaused {
  reason: 'paused' | 'platform';
  message: string;
  since: string | null;
}

export type HealthKey = 'delivery' | 'replies' | 'opt_outs' | 'lines';

export interface HealthFactor {
  key: HealthKey;
  /** 0 to 100 */
  score: number;
  hint: string;
}

export interface HomeHealth {
  /** 0 to 100, or null with fewer than 20 messages sent in the last 7 days. */
  score: number | null;
  word: 'Healthy' | 'Watch' | 'At risk' | null;
  /** Points gained or lost against the previous 7 days; null when either week has no score. */
  delta: number | null;
  factors: HealthFactor[];
}

export interface HomeSummary {
  setup: HomeSetup;
  lines: HomeLine[];
  stats: HomeStats;
  waiting: HomeWaiting[];
  campaigns: HomeCampaign[];
  /** Set while Solvedblue has paused this organization or the whole platform. */
  paused: HomePaused | null;
  health: HomeHealth;
}

/** Today's new contacts against the plan's daily allowance, summed over the lines. */
export function dailyUsage(lines: Pick<HomeLine, 'used_today' | 'cap'>[]) {
  const used = lines.reduce((sum, line) => sum + line.used_today, 0);
  const cap = lines.reduce((sum, line) => sum + line.cap, 0);
  return { used, cap, left: Math.max(cap - used, 0) };
}

export const HOME_QUERY_KEY = 'home-summary';

export const homeApi = {
  summary: () => api.get<HomeSummary>('/home/summary').then((res) => res.data),
};
