import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';

@WebSocketGateway({
  namespace: '/notifications',
  cors: { origin: '*' },
})
export class NotificationGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server!: Server;

  private clientMap = new Map<string, Set<string>>(); // userId -> Set<socketId>

  handleConnection(client: Socket) {
    const userId = client.handshake.query.userId as string;
    if (!userId) {
      client.disconnect();
      return;
    }

    client.join(`user:${userId}`);

    if (!this.clientMap.has(userId)) {
      this.clientMap.set(userId, new Set());
    }
    this.clientMap.get(userId)!.add(client.id);
  }

  handleDisconnect(client: Socket) {
    const userId = client.handshake.query.userId as string;
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
      this.server.emit('notification', payload);
    } else if (targetUserIds?.length) {
      targetUserIds.forEach((userId) => {
        this.server.to(`user:${userId}`).emit('notification', payload);
      });
    }
  }
}
