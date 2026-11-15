/**
 * Calls, mirroring spyder-web/src/api/calls.ts.
 *
 * Only the parts a conversation needs are here: what a call was, and how to
 * play its recording or voicemail. Placing and answering calls in the app is
 * not built — the web does that with @twilio/voice-sdk in a browser, which has
 * no React Native equivalent without a native SDK and a new development build.
 */
import { useAuthStore } from '../stores/authStore';
import { apiBaseUrl } from './client';

export type CallStatus =
  | 'ringing'
  | 'in_progress'
  | 'completed'
  | 'no_answer'
  | 'busy'
  | 'failed'
  | 'canceled'
  | 'missed'
  | 'voicemail';

/**
 * Where a call's recording lives, with the session token attached.
 *
 * `GET /api/calls/:id/recording` is behind customer auth, unlike
 * `/api/media/:id`, which is public by its random id. So this URL cannot be
 * handed to a player on its own, and the web does not try: it fetches the file
 * as a blob through its API client and plays an object URL
 * (`recordingBlob` in spyder-web/src/api/calls.ts).
 *
 * A phone has a better option. expo-audio's `AudioSource` takes `headers`, so
 * the player makes the authenticated request itself and streams the answer —
 * no download, no temporary file to clean up. Returns null with no session,
 * which is the one case where there is no token to send.
 */
export function callRecordingSource(
  callId: string
): { uri: string; headers: Record<string, string> } | null {
  const token = useAuthStore.getState().token;
  if (!token) return null;
  return {
    uri: `${apiBaseUrl}/calls/${encodeURIComponent(callId)}/recording`,
    headers: { Authorization: `Bearer ${token}` },
  };
}
