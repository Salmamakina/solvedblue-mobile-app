/**
 * Mirrors spyder-web/src/api/landing.ts (the demo booking part of it).
 *
 * Uses a bare axios call rather than the shared client: /api/landing is public,
 * and the shared client attaches the session token to everything it sends.
 */
import axios from 'axios';
import { apiBaseUrl } from './client';

export interface DemoLink {
  configured: boolean;
  /** Canonical link, the one to open in a browser. */
  url: string | null;
  /** The same link tuned for embedding. Unused on mobile, kept to match the web shape. */
  embedUrl: string | null;
}

const NOT_CONFIGURED: DemoLink = { configured: false, url: null, embedUrl: null };

export const DEMO_LINK_QUERY_KEY = 'demo-link';

/**
 * The demo booking URL, or configured:false when the backend has no
 * DEMO_BOOKING_URL set. Never invents a destination, so the UI can say booking
 * is unavailable instead of opening something wrong.
 */
export async function fetchDemoLink(): Promise<DemoLink> {
  try {
    const { data } = await axios.get<DemoLink>(`${apiBaseUrl}/landing/demo-link`, {
      timeout: 10000,
    });
    return data;
  } catch {
    return NOT_CONFIGURED;
  }
}
