import { io, Socket } from 'socket.io-client';
import { getBearerToken } from '@/features/auth/client';

export type PresencePayload = {
  type: 'presence';
  userId: string;
  online: boolean;
  socketCount: number;
  onlineCount: number;
};

let socket: Socket | null = null;
const notificationListeners = new Map<
  (notificationId: string) => void,
  (data: { type: string; notificationId: string }) => void
>();
const presenceListeners = new Map<
  (payload: PresencePayload) => void,
  (payload: PresencePayload) => void
>();

export function connectNotificationSocket() {
  if (socket?.connected) return socket;
  socket?.disconnect();

  const wsBase = import.meta.env.VITE_WS_URL || window.location.origin;
  socket = io(`${wsBase}/notifications`, {
    auth: { token: getBearerToken() },
    transports: ['websocket', 'polling'],
    reconnection: true,
    reconnectionDelay: 3000,
  });

  socket.on('connect', () => {
    console.log('[NotificationSocket] connected');
  });

  socket.on('disconnect', () => {
    console.log('[NotificationSocket] disconnected');
  });

  return socket;
}

export function getNotificationSocket() {
  return socket;
}

export function disconnectNotificationSocket() {
  if (socket) {
    socket.removeAllListeners();
    socket.disconnect();
    socket = null;
  }
  notificationListeners.clear();
  presenceListeners.clear();
}

export function onNewNotification(callback: (notificationId: string) => void) {
  if (!socket) return;
  const listener = (data: { type: string; notificationId: string }) => {
    if (data.type === 'new_notification') {
      callback(data.notificationId);
    }
  };
  notificationListeners.set(callback, listener);
  socket.on('notification', listener);
}

export function offNewNotification(callback: (notificationId: string) => void) {
  if (!socket) return;
  const listener = notificationListeners.get(callback);
  if (!listener) return;
  socket.off('notification', listener);
  notificationListeners.delete(callback);
}

export function onPresence(callback: (payload: PresencePayload) => void) {
  const sock = socket ?? connectNotificationSocket();
  const listener = (payload: PresencePayload) => {
    if (payload?.type === 'presence' && payload.userId) {
      callback(payload);
    }
  };
  presenceListeners.set(callback, listener);
  sock.on('presence', listener);
}

export function offPresence(callback: (payload: PresencePayload) => void) {
  if (!socket) return;
  const listener = presenceListeners.get(callback);
  if (!listener) return;
  socket.off('presence', listener);
  presenceListeners.delete(callback);
}
