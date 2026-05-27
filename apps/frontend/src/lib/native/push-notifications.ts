// ──────────────────────────────────────────────
// Push Notifications 服务 — Firebase FCM / APNs
// ──────────────────────────────────────────────

import { PushNotifications } from '@capacitor/push-notifications';
import type { PushNotificationsAPI, PushNotificationPayload, PushNotificationAction } from './types';
import { isNative } from './platform';

let _token: string | null = null;

class PushNotificationsService implements PushNotificationsAPI {
  async register(): Promise<string> {
    if (!isNative()) { console.log('[PushNotification] Web — push not available'); return ''; }

    return new Promise((resolve, reject) => {
      PushNotifications.addListener('registration', (token: { value: string }) => {
        _token = token.value;
        console.log('[PushNotification] token:', token.value);
        resolve(token.value);
      });
      PushNotifications.addListener('registrationError', (err: { error: string }) => {
        console.error('[PushNotification] registration error:', err.error);
        reject(new Error(err.error));
      });
      PushNotifications.requestPermissions().then((result) => {
        if (result.receive === 'denied') reject(new Error('Permission denied'));
        else PushNotifications.register();
      });
    });
  }

  async getToken(): Promise<string | null> {
    return _token;
  }

  async unregister(): Promise<void> {
    if (!isNative()) return;
    await PushNotifications.removeAllListeners();
    _token = null;
  }

  onPushReceived(callback: (n: PushNotificationPayload) => void): void {
    if (!isNative()) return;
    PushNotifications.addListener('pushNotificationReceived', (n: any) => {
      callback({ title: n.title, body: n.body, data: n.data });
    });
  }

  onPushActionPerformed(callback: (a: PushNotificationAction) => void): void {
    if (!isNative()) return;
    PushNotifications.addListener('pushNotificationActionPerformed', (result: any) => {
      callback({
        notification: { title: result.notification?.title, body: result.notification?.body, data: result.notification?.data },
        actionId: result.actionId,
      });
    });
  }
}

export const pushNotifications: PushNotificationsAPI = new PushNotificationsService();
