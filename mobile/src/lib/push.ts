import { PermissionsAndroid, Platform } from 'react-native';
import { getApps } from '@react-native-firebase/app';
import {
  AuthorizationStatus,
  deleteToken,
  getInitialNotification,
  getMessaging,
  getToken,
  onMessage,
  onNotificationOpenedApp,
  onTokenRefresh,
  requestPermission,
} from '@react-native-firebase/messaging';
import { api } from '../api/client';
import { prefs } from './storage';

/** Firebase is optional — without google-services.json / GoogleService-Info.plist push is simply off. */
function messaging() {
  try {
    return getApps().length > 0 ? getMessaging() : null;
  } catch {
    return null;
  }
}

async function ensurePermission(): Promise<boolean> {
  const m = messaging();
  if (!m) return false;
  if (Platform.OS === 'android') {
    if (Number(Platform.Version) >= 33) {
      const result = await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS);
      return result === PermissionsAndroid.RESULTS.GRANTED;
    }
    return true;
  }
  const status = await requestPermission(m);
  return status === AuthorizationStatus.AUTHORIZED || status === AuthorizationStatus.PROVISIONAL;
}

/** Ask once after sign-in, then register this device's FCM token with the backend. */
export async function registerForPush(): Promise<() => void> {
  const m = messaging();
  if (!m) return () => {};
  try {
    if (!(await ensurePermission())) return () => {};
    const token = await getToken(m);
    if (token) {
      await api.post('/api/mobile/push-token', { token });
      await prefs.set('pushToken', token);
    }
    return onTokenRefresh(m, async (next) => {
      await api.post('/api/mobile/push-token', { token: next }).catch(() => {});
      await prefs.set('pushToken', next);
    });
  } catch {
    return () => {};
  }
}

export async function unregisterPush(): Promise<void> {
  const m = messaging();
  const token = await prefs.get('pushToken');
  if (token) await api.delete('/api/mobile/push-token', { token }).catch(() => {});
  await prefs.remove('pushToken');
  if (m) await deleteToken(m).catch(() => {});
}

type Handler = (data: Record<string, unknown>, title?: string, body?: string) => void;

/** Foreground messages → in-app toast; taps on a notification → navigate. */
export function listenForPush(onForeground: Handler, onOpen: Handler): () => void {
  const m = messaging();
  if (!m) return () => {};
  const unsubs = [
    onMessage(m, (message) =>
      onForeground(message.data ?? {}, message.notification?.title, message.notification?.body)
    ),
    onNotificationOpenedApp(m, (message) => onOpen(message.data ?? {})),
  ];
  getInitialNotification(m)
    .then((message) => message && onOpen(message.data ?? {}))
    .catch(() => {});
  return () => unsubs.forEach((unsub) => unsub());
}
