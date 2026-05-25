import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { PaginationDto, toPageResult } from '../../common/dto/pagination.dto';
import { CreateNotificationDto } from './dto/create-notification.dto';
import { UpdateNotificationDto } from './dto/update-notification.dto';
import { QueryNotificationDto } from './dto/query-notification.dto';
import { NotificationGateway } from './notification.gateway';
import { FileAssetsService } from '../file-assets/file-assets.service';
import { FileAssetGroup } from '@prisma/client';

@Injectable()
export class NotificationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly gateway: NotificationGateway,
    private readonly fileAssets: FileAssetsService,
  ) {}

  /** 管理员：创建并发送通知 */
  async createNotification(adminUserId: string, dto: CreateNotificationDto) {
    // 创建通知本体
    const notification = await this.prisma.notification.create({
      data: {
        title: dto.title,
        content: dto.content,
        type: dto.type,
        sentById: adminUserId,
      },
    });

    // 指定用户：写入 target 表
    if (dto.type === 'targeted' && dto.targetUserIds?.length) {
      await this.prisma.notificationTarget.createMany({
        data: dto.targetUserIds.map((userId) => ({
          notificationId: notification.id,
          userId,
        })),
      });
    }

    // WebSocket 实时推送
    this.gateway.pushNotification(notification.id, dto.type, dto.targetUserIds);

    return notification;
  }

  /** 用户：获取我的通知列表（含已读状态） */
  async getUserNotifications(userId: string, query: QueryNotificationDto) {
    const { page = 1, pageSize = 20, isRead } = query;
    const skip = (page - 1) * pageSize;

    const baseWhere = `(n.type = 'broadcast'
       OR n.id IN (SELECT "notificationId" FROM notification_target WHERE "userId" = $1))`;

    let isReadClause = '';
    if (isRead === true) {
      isReadClause = `AND nr."readAt" IS NOT NULL`;
    } else if (isRead === false) {
      isReadClause = `AND nr."readAt" IS NULL`;
    }

    const notifications = (await this.prisma.$queryRawUnsafe(
      `SELECT n.*,
              nr."readAt" IS NOT NULL AS "isRead",
              nr."readAt"
       FROM notification n
       LEFT JOIN notification_read nr
         ON nr."notificationId" = n.id AND nr."userId" = $1
       WHERE ${baseWhere} ${isReadClause}
       ORDER BY n."createdAt" DESC
       LIMIT $2 OFFSET $3`,
      userId,
      pageSize,
      skip,
    )) as Array<{
      id: string; title: string; content: string; type: string;
      sentById: string; createdAt: Date; updatedAt: Date;
      isRead: boolean; readAt: Date | null;
    }>;

    const countResult = (await this.prisma.$queryRawUnsafe(
      `SELECT COUNT(*) as count
       FROM notification n
       LEFT JOIN notification_read nr
         ON nr."notificationId" = n.id AND nr."userId" = $1
       WHERE ${baseWhere} ${isReadClause}`,
      userId,
    )) as Array<{ count: bigint }>;

    return toPageResult(
      notifications.map((n) => ({
        id: n.id,
        title: n.title,
        content: n.content,
        type: n.type,
        sentById: n.sentById,
        createdAt: n.createdAt,
        updatedAt: n.updatedAt,
        isRead: n.isRead,
        readAt: n.readAt,
      })),
      Number(countResult[0]?.count ?? 0),
      query,
    );
  }

  /** 用户：标记通知为已读 */
  async markAsRead(userId: string, notificationId: string) {
    await this.prisma.notificationRead.upsert({
      where: {
        notificationId_userId: { notificationId, userId },
      },
      create: { notificationId, userId },
      update: {},
    });
  }

  /** 用户：批量标记已读 */
  async markAllAsRead(userId: string) {
    // 获取用户所有未读通知
    const unreadNotifications = (await this.prisma.$queryRawUnsafe(
      `SELECT n.id
       FROM notification n
       LEFT JOIN notification_read nr
         ON nr."notificationId" = n.id AND nr."userId" = $1
       WHERE nr.id IS NULL
         AND (n.type = 'broadcast'
              OR n.id IN (SELECT "notificationId" FROM notification_target WHERE "userId" = $1))`,
      userId,
    )) as Array<{ id: string }>;

    if (unreadNotifications.length === 0) return;

    await this.prisma.notificationRead.createMany({
      data: unreadNotifications.map((n) => ({
        notificationId: n.id,
        userId,
      })),
      skipDuplicates: true,
    });
  }

  /** 用户：获取未读数量 */
  async getUnreadCount(userId: string): Promise<number> {
    const result = (await this.prisma.$queryRawUnsafe(
      `SELECT COUNT(*) as count
       FROM notification n
       LEFT JOIN notification_read nr
         ON nr."notificationId" = n.id AND nr."userId" = $1
       WHERE nr.id IS NULL
         AND (n.type = 'broadcast'
              OR n.id IN (SELECT "notificationId" FROM notification_target WHERE "userId" = $1))`,
      userId,
    )) as Array<{ count: bigint }>;

    return Number(result[0]?.count ?? 0);
  }

  /** 管理员：获取所有通知列表（含已读统计） */
  async listAllNotifications(pagination: PaginationDto, keyword?: string) {
    const { page = 1, pageSize = 20 } = pagination;
    const skip = (page - 1) * pageSize;

    const where = keyword
      ? {
          OR: [
            { title: { contains: keyword, mode: 'insensitive' as const } },
            { content: { contains: keyword, mode: 'insensitive' as const } },
          ],
        }
      : {};

    const [list, total] = await this.prisma.$transaction([
      this.prisma.notification.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: pageSize,
        include: {
          sentBy: { select: { id: true, name: true, email: true } },
          _count: { select: { reads: true, targets: true } },
        },
      }),
      this.prisma.notification.count({ where }),
    ]);

    return toPageResult(list, total, pagination);
  }

  /** 管理员：搜索用户（用于指定通知目标） */
  async searchUsers(keyword: string) {
    if (!keyword || keyword.length < 1) return [];
    return this.prisma.user.findMany({
      where: {
        OR: [
          { email: { contains: keyword, mode: 'insensitive' } },
          { name: { contains: keyword, mode: 'insensitive' } },
          { username: { contains: keyword, mode: 'insensitive' } },
        ],
      },
      select: { id: true, email: true, name: true, username: true, image: true },
      take: 20,
    });
  }

  /** 管理员：上传通知内嵌图片（返回 7 天有效签名 URL） */
  async uploadNotificationImage(file: Express.Multer.File) {
    const asset = await this.fileAssets.createAssetFromBuffer({
      buffer: file.buffer,
      filename: file.originalname,
      mimeType: file.mimetype,
      group: FileAssetGroup.notification,
    });
    const { url } = await this.fileAssets.getAssetLongLivedUrl(asset.id);
    return { url, assetId: asset.id };
  }

  /** 管理员：列出通知图片库 */
  async listNotificationImages(page = 1, pageSize = 20) {
    return this.fileAssets.listByGroup(FileAssetGroup.notification, { page, pageSize });
  }

  /** 管理员：获取通知详情 */
  async getNotificationById(id: string) {
    const n = await this.prisma.notification.findUnique({
      where: { id },
      include: {
        sentBy: { select: { id: true, name: true, email: true } },
        _count: { select: { reads: true, targets: true } },
      },
    });
    if (!n) throw new NotFoundException('通知不存在');
    return n;
  }

  /** 管理员：更新通知 */
  async updateNotification(id: string, dto: UpdateNotificationDto) {
    const existing = await this.prisma.notification.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('通知不存在');
    return this.prisma.notification.update({
      where: { id },
      data: {
        ...(dto.title !== undefined ? { title: dto.title } : {}),
        ...(dto.content !== undefined ? { content: dto.content } : {}),
        ...(dto.type !== undefined ? { type: dto.type } : {}),
      },
    });
  }

  /** 管理员：删除通知 */
  async deleteNotification(id: string) {
    const existing = await this.prisma.notification.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('通知不存在');
    await this.prisma.notification.delete({ where: { id } });
    return { success: true };
  }

  /** 管理员：获取通知统计 */
  async getNotificationStats() {
    const [total, broadcast, targeted, totalReads] = await this.prisma.$transaction([
      this.prisma.notification.count(),
      this.prisma.notification.count({ where: { type: 'broadcast' } }),
      this.prisma.notification.count({ where: { type: 'targeted' } }),
      this.prisma.notificationRead.count(),
    ]);
    return { total, broadcast, targeted, totalReads };
  }
}
