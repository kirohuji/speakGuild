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

  getOnlineUserIds() {
    return Array.from(this.clientMap.keys());
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

      if (!this.clientMap.has(userId)) {
        this.clientMap.set(userId, new Set());
      }
      this.clientMap.get(userId)!.add(client.id);
    } catch {
      client.disconnect();
    }
  }

  handleDisconnect(client: Socket) {
    const userId = client.data.userId as string | undefined;
    if (userId && this.clientMap.has(userId)) {
      this.clientMap.get(userId)!.delete(client.id);
      if (this.clientMap.get(userId)!.size === 0) {
        this.clientMap.delete(userId);
      }
    }
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
      targetUserIds.forEach((userId) => {
        this.server.to(`user:${userId}`).emit('notification', payload);
      });
    }
  }
}
