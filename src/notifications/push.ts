import Constants, { ExecutionEnvironment } from 'expo-constants';
import * as Notifications from 'expo-notifications';
// Named rather than reached through the namespace: expo-notifications re-exports
// it with `export *`, which the import linter cannot follow.
import { AndroidImportance } from 'expo-notifications';
import { Platform } from 'react-native';
import { accountApi } from '../api/account';

/**
 * Push notifications for replies.
 *
 * The web app hears a reply over a websocket. A phone in someone's pocket has
 * no socket open, so without this the only way a reply is noticed on mobile is
 * the app polling while it happens to be in the foreground — 60s for the tab
 * badge, 15s inside an open thread.
 *
 * Delivery goes through the Expo Push Service: the handset registers an
 * ExpoPushToken with our backend, and the backend posts to exp.host when a
 * reply lands (spyder-backend/src/services/pushNotifications.ts). Expo holds
 * the APNs key and the FCM credentials, so the backend holds neither.
 *
 * Every function here fails quietly. Notifications are an improvement on
 * polling, not a requirement for it: a refused permission, a missing projectId
 * or an emulator with no Play services must leave the inbox working exactly as
 * it did before.
 */

/**
 * How a notification behaves while the app is open. No banner: if you are
 * already looking at the inbox, a card sliding over it tells you nothing the
 * list is not about to show. The badge and the notification list still update,
 * so what arrived is not lost, and the sound is what actually gets attention.
 */
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: false,
    shouldShowList: true,
  }),
});

/** The data a reply notification carries. Set by notifyNewReply on the backend. */
export interface ReplyNotificationData {
  type?: string;
  /** The conversation to open: the route parameter of app/chat/[phone].tsx. */
  phone?: string;
  reply_id?: string;
}

/**
 * The token this handset last registered, so sign-out can tell the backend to
 * stop sending to it. One module-level value because there is one handset.
 */
let registeredToken: string | null = null;

export function currentPushToken(): string | null {
  return registeredToken;
}

/**
 * Expo Go dropped remote push notifications in SDK 53, so asking for a token
 * there throws. A development build or a store build is required, which is
 * also true of the native notification entitlements themselves.
 */
function inExpoGo(): boolean {
  return Constants.executionEnvironment === ExecutionEnvironment.StoreClient;
}

/**
 * The Expo project this token is attributed to. Written into app.json by
 * `eas init`; until that has been run there is nothing to register with.
 */
function projectId(): string | undefined {
  const fromConfig = (Constants.expoConfig?.extra as { eas?: { projectId?: string } } | undefined)?.eas
    ?.projectId;
  return fromConfig ?? Constants.easConfig?.projectId ?? undefined;
}

/**
 * Android shows a notification only through a channel, and one created after
 * the first notification arrives is too late. Named `default` to match the
 * channelId the backend sends.
 */
async function ensureAndroidChannel(): Promise<void> {
  if (Platform.OS !== 'android') return;
  await Notifications.setNotificationChannelAsync('default', {
    name: 'Replies',
    importance: AndroidImportance.HIGH,
    vibrationPattern: [0, 250, 250, 250],
    lightColor: '#0A84FF',
  });
}

export type PushRegistrationOutcome =
  | { status: 'registered'; token: string }
  | { status: 'denied' }
  | { status: 'unavailable'; reason: string };

/**
 * Asks for permission if it has not been asked for already, then registers this
 * handset's token with the backend.
 *
 * Permission is only ever requested once by the system: calling this again
 * after a refusal re-reads the answer rather than nagging.
 */
export async function registerForPushNotifications(): Promise<PushRegistrationOutcome> {
  if (inExpoGo()) {
    return { status: 'unavailable', reason: 'Push notifications need a development build, not Expo Go.' };
  }

  const id = projectId();
  if (!id) {
    return { status: 'unavailable', reason: 'No EAS projectId in the app config yet.' };
  }

  try {
    await ensureAndroidChannel();

    const existing = await Notifications.getPermissionsAsync();
    const granted =
      existing.granted || (existing.canAskAgain && (await Notifications.requestPermissionsAsync()).granted);
    if (!granted) return { status: 'denied' };

    const { data: token } = await Notifications.getExpoPushTokenAsync({ projectId: id });

    await accountApi.registerPushToken({
      token,
      platform: Platform.OS === 'ios' ? 'ios' : 'android',
      device_name: Constants.deviceName ?? undefined,
    });

    registeredToken = token;
    return { status: 'registered', token };
  } catch (error) {
    // A simulator without push support, an emulator with no Play services, or
    // the backend being unreachable. None of them is worth interrupting anyone.
    return {
      status: 'unavailable',
      reason: (error as { message?: string } | null)?.message ?? 'Could not register for notifications.',
    };
  }
}

/**
 * Tells the backend to stop sending to this handset, on sign-out. Called before
 * the session is cleared, because the request needs the token that is about to
 * be thrown away.
 *
 * Failure is ignored: signing out must never be blocked by it, and the backend
 * retires a token Apple or Google later reports as gone anyway.
 */
export async function unregisterPushNotifications(): Promise<void> {
  const token = registeredToken;
  registeredToken = null;
  if (!token) return;
  await accountApi.removePushToken(token).catch(() => undefined);
  await Notifications.setBadgeCountAsync(0).catch(() => undefined);
}

/** The conversation a notification points at, or null when it is not a reply. */
export function conversationFrom(
  notification: Notifications.NotificationResponse | null
): string | null {
  const data = notification?.notification.request.content.data as ReplyNotificationData | undefined;
  return typeof data?.phone === 'string' && data.phone ? data.phone : null;
}
