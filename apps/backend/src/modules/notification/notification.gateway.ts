import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { fromNodeHeaders } from 'better-auth/node';
import { auth } from '../auth/auth';

const allowedOrigins = (process.env.FRONTEND_URL || '')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);

const PRESENCE_DEBOUNCE_MS = 300;

export type PresenceEvent = {
  type: 'presence';
  userId: string;
  online: boolean;
  socketCount: number;
  onlineCount: number;
};

@WebSocketGateway({
  namespace: '/notifications',
  cors: {
    origin: allowedOrigins.length ? allowedOrigins : ['capacitor://localhost', 'ionic://localhost'],
    credentials: true,
  },
})
export class NotificationGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server!: Server;

  private clientMap = new Map<string, Set<string>>(); // userId -> Set<socketId>
  private presenceTimers = new Map<string, NodeJS.Timeout>();

  getOnlineUserIds() {
    return Array.from(this.clientMap.keys());
  }

  getOnlineCount() {
    return this.clientMap.size;
  }

  getUserPresence(userId: string) {
    const sockets = this.clientMap.get(userId);
    return {
      online: Boolean(sockets?.size),
      socketCount: sockets?.size ?? 0,
    };
  }

  async handleConnection(client: Socket) {
    try {
      const token = client.handshake.auth?.token;
      const authorization =
        typeof token === 'string' && token
          ? `Bearer ${token}`
          : client.handshake.headers.authorization;
      const session = await auth.api.getSession({
        headers: fromNodeHeaders({
          ...client.handshake.headers,
          authorization,
        }),
      });
      const userId = session?.user?.id;

      if (!userId) {
        client.disconnect();
        return;
      }

      client.data.userId = userId;
      client.join('authenticated');
      client.join(`user:${userId}`);

      if ((session.user as { role?: string })?.role === 'admin') {
        client.join('admins');
      }

      const wasOffline = !this.clientMap.has(userId);
      if (wasOffline) {
        this.clientMap.set(userId, new Set());
      }
      this.clientMap.get(userId)!.add(client.id);

      if (wasOffline) {
        this.schedulePresence(userId);
      }
    } catch {
      client.disconnect();
    }
  }

  handleDisconnect(client: Socket) {
    const userId = client.data.userId as string | undefined;
    if (!userId || !this.clientMap.has(userId)) return;

    const sockets = this.clientMap.get(userId)!;
    sockets.delete(client.id);

    if (sockets.size === 0) {
      this.clientMap.delete(userId);
      this.schedulePresence(userId);
    }
  }

  private schedulePresence(userId: string) {
    const existing = this.presenceTimers.get(userId);
    if (existing) clearTimeout(existing);

    const timer = setTimeout(() => {
      this.presenceTimers.delete(userId);
      const live = this.getUserPresence(userId);
      const payload: PresenceEvent = {
        type: 'presence',
        userId,
        online: live.online,
        socketCount: live.socketCount,
        onlineCount: this.getOnlineCount(),
      };
      this.server.to('admins').emit('presence', payload);
    }, PRESENCE_DEBOUNCE_MS);

    this.presenceTimers.set(userId, timer);
  }

  /** 推送通知给指定用户或全部用户 */
  pushNotification(
    notificationId: string,
    type: 'broadcast' | 'targeted',
    targetUserIds?: string[],
  ) {
    const payload = { type: 'new_notification', notificationId };

    if (type === 'broadcast') {
      this.server.to('authenticated').emit('notification', payload);
    } else if (targetUserIds?.length) {
      targetUserIds.forEach((id) => {
        this.server.to(`user:${id}`).emit('notification', payload);
      });
    }
  }
}
