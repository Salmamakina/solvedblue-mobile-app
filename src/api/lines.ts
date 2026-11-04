import api from './client';
import type { LineHealth } from './home';

/** Mirrors spyder-web/src/api/lines.ts. */

export interface LineEntry {
  id: string;
  name: string;
  /** 'android' for text fallback lines; anything else is an iMessage (Mac) line. */
  platform: string;
  status: 'online' | 'offline';
  last_seen: string | null;
  apple_id_masked: string | null;
  used_today: number;
  cap: number;
  warmup: { day: number; complete: boolean };
  health: LineHealth;
  reply_rate_7d: number;
  /** Set while the line is paused (auto-pause or an operator). */
  paused_reason: string | null;
}

export const LINES_QUERY_KEY = 'lines';

export const linesApi = {
  list: () => api.get<{ lines: LineEntry[] }>('/lines').then((res) => res.data.lines),
};
