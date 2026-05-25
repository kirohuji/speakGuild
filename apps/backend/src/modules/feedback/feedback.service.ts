import { Injectable } from '@nestjs/common'
import { PrismaService } from '../../common/prisma/prisma.service'
import { NotificationService } from '../notification/notification.service'
import { NotificationGateway } from '../notification/notification.gateway'
import type { Prisma } from '@prisma/client'

@Injectable()
export class FeedbackService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notificationService: NotificationService,
    private readonly gateway: NotificationGateway,
  ) {}

  async create(data: { userId: string; type: string; content: string; contact?: string }) {
    return this.prisma.feedback.create({ data })
  }

  async findByUser(userId: string, page = 1, pageSize = 20) {
    const skip = (page - 1) * pageSize
    const [items, total] = await Promise.all([
      this.prisma.feedback.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        skip,
        take: pageSize,
      }),
      this.prisma.feedback.count({ where: { userId } }),
    ])
    return { items, total, page, pageSize }
  }

  async findAll(params: { status?: string; page?: number; pageSize?: number }) {
    const { status, page = 1, pageSize = 20 } = params
    const where: Prisma.FeedbackWhereInput = {}
    if (status) where.status = status as any
    const skip = (page - 1) * pageSize
    const [items, total] = await Promise.all([
      this.prisma.feedback.findMany({
        where,
        include: { user: { select: { id: true, name: true, email: true } } },
        orderBy: { createdAt: 'desc' },
        skip,
        take: pageSize,
      }),
      this.prisma.feedback.count({ where }),
    ])
    return { items, total, page, pageSize }
  }

  async updateStatus(id: string, status: string, adminNote?: string) {
    return this.prisma.feedback.update({
      where: { id },
      data: { status: status as any, adminNote },
    })
  }

  /** 管理员回复反馈，同时发送通知给用户 */
  async reply(adminUserId: string, feedbackId: string, adminNote: string) {
    const feedback = await this.prisma.feedback.findUnique({ where: { id: feedbackId } })
    if (!feedback) throw new Error('反馈不存在')

    // 更新 adminNote（不自动改变状态，由管理员手动管理）
    await this.prisma.feedback.update({
      where: { id: feedbackId },
      data: { adminNote },
    })

    // 创建定向通知（Markdown 格式：引用卡片 + 分隔线 + 回复）
    const notification = await this.prisma.notification.create({
      data: {
        title: '您的反馈已收到回复',
        content: [
          `> ${feedback.content}`,
          '',
          '---',
          '',
          adminNote,
        ].join('\n'),
        type: 'targeted',
        sentById: adminUserId,
        targets: {
          create: { userId: feedback.userId },
        },
      },
    })

    // WebSocket 实时推送
    this.gateway.pushNotification(notification.id, 'targeted', [feedback.userId])

    return { success: true, notificationId: notification.id }
  }
}
