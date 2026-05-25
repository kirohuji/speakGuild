import {
  Injectable, NotFoundException, BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import {
  CreateQuestionBankDto, UpdateQuestionBankDto,
  CreateTopicDto, UpdateTopicDto,
  CreateQuestionDto, UpdateQuestionDto,
  QuestionQueryDto,
} from './dto/question-bank-admin.dto';

@Injectable()
export class QuestionBankAdminService {
  constructor(private readonly prisma: PrismaService) {}

  // ═══════════════════════════════════════════════════════════
  // 题库 (QuestionBank)
  // ═══════════════════════════════════════════════════════════

  async listBanks() {
    return this.prisma.questionBank.findMany({
      orderBy: { updatedAt: 'desc' },
      include: {
        _count: { select: { topics: true } },
      },
    });
  }

  async getBank(id: string) {
    const bank = await this.prisma.questionBank.findUnique({
      where: { id },
      include: {
        topics: {
          orderBy: { sortOrder: 'asc' },
          include: { _count: { select: { items: true } } },
        },
      },
    });
    if (!bank) throw new NotFoundException('题库不存在');
    return bank;
  }

  async createBank(dto: CreateQuestionBankDto) {
    // 检查同 province + examType 是否已存在
    const existing = await this.prisma.questionBank.findFirst({
      where: {
        province: dto.province,
        examType: dto.examType,
        language: dto.language,
      },
    });
    if (existing) {
      throw new BadRequestException('该地区+考试类型+语言的题库已存在');
    }
    return this.prisma.questionBank.create({ data: dto });
  }

  async updateBank(id: string, dto: UpdateQuestionBankDto) {
    await this.getBank(id); // ensure exists
    return this.prisma.questionBank.update({
      where: { id },
      data: dto,
    });
  }

  async deleteBank(id: string) {
    await this.getBank(id);
    // 级联删除 topics -> items -> content
    const topicIds = await this.prisma.questionTopic.findMany({
      where: { bankId: id },
      select: { id: true },
    });
    if (topicIds.length > 0) {
      // 先删除所有题目内容
      await this.prisma.questionContent.deleteMany({
        where: { question: { topicId: { in: topicIds.map(t => t.id) } } },
      });
      // 删除所有题目
      await this.prisma.questionItem.deleteMany({
        where: { topicId: { in: topicIds.map(t => t.id) } },
      });
      // 删除所有分类
      await this.prisma.questionTopic.deleteMany({
        where: { bankId: id },
      });
    }
    return this.prisma.questionBank.delete({ where: { id } });
  }

  // ═══════════════════════════════════════════════════════════
  // 题目分类 (QuestionTopic)
  // ═══════════════════════════════════════════════════════════

  async listTopics(bankId: string) {
    return this.prisma.questionTopic.findMany({
      where: { bankId },
      orderBy: { sortOrder: 'asc' },
      include: { _count: { select: { items: true } } },
    });
  }

  async getTopic(id: string) {
    const topic = await this.prisma.questionTopic.findUnique({
      where: { id },
      include: {
        bank: { select: { id: true, name: true, province: true } },
        _count: { select: { items: true } },
      },
    });
    if (!topic) throw new NotFoundException('题目分类不存在');
    return topic;
  }

  async createTopic(dto: CreateTopicDto) {
    // 确保 bank 存在
    await this.prisma.questionBank.findUniqueOrThrow({
      where: { id: dto.bankId },
    }).catch(() => { throw new BadRequestException('题库不存在'); });

    // 检查同 code 是否已存在
    const existing = await this.prisma.questionTopic.findFirst({
      where: { bankId: dto.bankId, code: dto.code },
    });
    if (existing) {
      throw new BadRequestException('该分类 code 在此题库中已存在');
    }
    return this.prisma.questionTopic.create({ data: dto });
  }

  async updateTopic(id: string, dto: UpdateTopicDto) {
    await this.prisma.questionTopic.findUniqueOrThrow({ where: { id } })
      .catch(() => { throw new NotFoundException('题目分类不存在'); });
    return this.prisma.questionTopic.update({ where: { id }, data: dto });
  }

  async deleteTopic(id: string) {
    const topic = await this.prisma.questionTopic.findUnique({
      where: { id },
      include: { _count: { select: { items: true } } },
    });
    if (!topic) throw new NotFoundException('题目分类不存在');
    if (topic._count.items > 0) {
      throw new BadRequestException(
        `该分类下还有 ${topic._count.items} 道题目，请先删除题目`,
      );
    }
    return this.prisma.questionTopic.delete({ where: { id } });
  }

  // ═══════════════════════════════════════════════════════════
  // 题目 (QuestionItem + QuestionContent)
  // ═══════════════════════════════════════════════════════════

  async listItems(query: QuestionQueryDto) {
    const { bankId, topicId, keyword, page = 1, pageSize = 20 } = query;
    const skip = (page - 1) * pageSize;

    const where: any = {};

    if (topicId) {
      where.topicId = topicId;
    } else if (bankId) {
      where.topic = { bankId };
    }

    if (keyword) {
      where.title = { contains: keyword, mode: 'insensitive' };
    }

    const [list, total] = await this.prisma.$transaction([
      this.prisma.questionItem.findMany({
        where,
        include: {
          topic: {
            select: {
              id: true,
              code: true,
              name: true,
            },
          },
          content: {
            select: {
              summary: true,
            },
          },
        },
        orderBy: { updatedAt: 'desc' },
        skip,
        take: pageSize,
      }),
      this.prisma.questionItem.count({ where }),
    ]);

    return {
      list,
      total,
      page,
      pageSize,
    };
  }

  async getItem(id: string) {
    const item = await this.prisma.questionItem.findUnique({
      where: { id },
      include: {
        topic: {
          select: {
            id: true,
            code: true,
            name: true,
            bank: {
              select: { id: true, name: true, province: true },
            },
          },
        },
        content: true,
      },
    });
    if (!item) throw new NotFoundException('题目不存在');
    return item;
  }

  async createItem(dto: CreateQuestionDto) {
    // 确保 topic 存在
    await this.prisma.questionTopic.findUniqueOrThrow({
      where: { id: dto.topicId },
    }).catch(() => { throw new BadRequestException('题目分类不存在'); });

    const {
      promptEn, promptZh, answerEn, answerZh, summary,
      ...itemData
    } = dto;

    const hasContent = promptEn || promptZh || answerEn || answerZh || summary;

    return this.prisma.questionItem.create({
      data: {
        ...itemData,
        ...(hasContent ? {
          content: {
            create: {
              promptEn: promptEn || '',
              promptZh: promptZh || '',
              answerEn: answerEn || '',
              answerZh: answerZh || '',
              summary: summary || '',
            },
          },
        } : {}),
      },
      include: {
        content: true,
        topic: {
          select: { id: true, code: true, name: true },
        },
      },
    });
  }

  async updateItem(id: string, dto: UpdateQuestionDto) {
    await this.prisma.questionItem.findUniqueOrThrow({ where: { id } })
      .catch(() => { throw new NotFoundException('题目不存在'); });

    const {
      promptEn, promptZh, answerEn, answerZh, summary,
      ...itemData
    } = dto;

    const hasContentData = promptEn !== undefined || promptZh !== undefined
      || answerEn !== undefined || answerZh !== undefined
      || summary !== undefined;

    return this.prisma.questionItem.update({
      where: { id },
      data: {
        ...itemData,
        ...(hasContentData ? {
          content: {
            upsert: {
              create: {
                promptEn: promptEn || '',
                promptZh: promptZh || '',
                answerEn: answerEn || '',
                answerZh: answerZh || '',
                summary: summary || '',
              },
              update: {
                ...(promptEn !== undefined && { promptEn }),
                ...(promptZh !== undefined && { promptZh }),
                ...(answerEn !== undefined && { answerEn }),
                ...(answerZh !== undefined && { answerZh }),
                ...(summary !== undefined && { summary }),
              },
            },
          },
        } : {}),
      },
      include: {
        content: true,
        topic: {
          select: { id: true, code: true, name: true },
        },
      },
    });
  }

  async deleteItem(id: string) {
    await this.prisma.questionItem.findUniqueOrThrow({ where: { id } })
      .catch(() => { throw new NotFoundException('题目不存在'); });

    // 先删除关联的 content
    await this.prisma.questionContent.deleteMany({
      where: { questionId: id },
    });

    return this.prisma.questionItem.delete({ where: { id } });
  }

  // ═══════════════════════════════════════════════════════════
  // 批量操作
  // ═══════════════════════════════════════════════════════════

  /** 获取所有省份（用于筛选下拉） */
  async getProvinces() {
    const banks = await this.prisma.questionBank.findMany({
      select: { province: true },
      distinct: ['province'],
    });
    return banks.map(b => b.province);
  }
}
