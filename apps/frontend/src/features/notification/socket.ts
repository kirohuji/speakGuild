import { io, Socket } from 'socket.io-client';

let socket: Socket | null = null;

export function connectNotificationSocket(userId: string) {
  if (socket?.connected) return socket;

  const wsBase = import.meta.env.VITE_WS_URL || window.location.origin;
  socket = io(`${wsBase}/notifications`, {
    query: { userId },
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
    socket.disconnect();
    socket = null;
  }
}

export function onNewNotification(callback: (notificationId: string) => void) {
  if (!socket) return;
  socket.on('notification', (data: { type: string; notificationId: string }) => {
    if (data.type === 'new_notification') {
      callback(data.notificationId);
    }
  });
}

export function offNewNotification(callback: (notificationId: string) => void) {
  if (!socket) return;
  socket.off('notification', callback);
}
