import { useQueryClient } from '@tanstack/react-query';
import * as Notifications from 'expo-notifications';
import { useRouter } from 'expo-router';
import { useEffect, useRef } from 'react';
import { INBOX_BADGE_QUERY_KEY, INBOX_QUERY_KEY } from '../api/inbox';
import { useAuthStore } from '../stores/authStore';
import { conversationFrom, registerForPushNotifications } from './push';

/**
 * Wires push notifications into the app: registers the handset once there is a
 * session, refreshes the inbox when one arrives, and opens the conversation
 * when one is tapped.
 *
 * Mounted once, in the root layout, for the same reason the auth guard lives
 * there: a listener per screen would fire several times for one notification.
 */
export function usePushNotifications(): void {
  const router = useRouter();
  const queryClient = useQueryClient();
  const token = useAuthStore((s) => s.token);
  const userId = useAuthStore((s) => s.user?.id);

  /**
   * The account the handset is currently registered for. Registration is keyed
   * on it rather than run once, so signing in as someone else moves the token
   * to that account instead of leaving the previous one's replies arriving here.
   */
  const registeredFor = useRef<string | null>(null);

  useEffect(() => {
    if (!token) {
      registeredFor.current = null;
      return;
    }
    const owner = userId ?? token;
    if (registeredFor.current === owner) return;
    registeredFor.current = owner;

    void registerForPushNotifications().then((outcome) => {
      // Not surfaced to the user. A refusal is their decision and polling still
      // covers the inbox; the rest is a build or device limitation they cannot
      // act on from here.
      if (outcome.status !== 'registered') {
        console.log(`Push notifications off: ${outcome.status === 'denied' ? 'permission refused' : outcome.reason}`);
      }
    });
  }, [token, userId]);

  // A notification arriving while the app is open means a reply landed. The
  // inbox polls on its own, but between two polls the list is stale and we
  // already know better.
  useEffect(() => {
    const received = Notifications.addNotificationReceivedListener(() => {
      void queryClient.invalidateQueries({ queryKey: [INBOX_QUERY_KEY] });
      void queryClient.invalidateQueries({ queryKey: [INBOX_BADGE_QUERY_KEY] });
    });
    return () => received.remove();
  }, [queryClient]);

  // Tapping a notification opens that conversation. Two cases: the app was
  // already running, and the app was launched by the tap — the second delivers
  // no event, so the last response has to be read once at startup.
  useEffect(() => {
    if (!token) return;
    let active = true;

    const open = (phone: string) => {
      if (active) router.push({ pathname: '/chat/[phone]', params: { phone } });
    };

    const responded = Notifications.addNotificationResponseReceivedListener((response) => {
      const phone = conversationFrom(response);
      if (phone) open(phone);
    });

    void Notifications.getLastNotificationResponseAsync()
      .then((response) => {
        const phone = conversationFrom(response);
        if (phone) open(phone);
      })
      .catch(() => undefined);

    return () => {
      active = false;
      responded.remove();
    };
  }, [router, token]);
}
