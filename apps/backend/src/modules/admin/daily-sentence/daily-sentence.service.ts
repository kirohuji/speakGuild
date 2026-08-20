import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../common/prisma/prisma.service';
import type { CreateDailySentenceDto, UpdateDailySentenceDto } from './dto/daily-sentence.dto';
import { addDateKeyDays, parseDateKey, todayDateKey, DEFAULT_CLIENT_TIME_ZONE } from '../../../common/calendar-date';

@Injectable()
export class DailySentenceService {
  constructor(private readonly prisma: PrismaService) {}

  /** 获取所有每日句子，按日期降序 */
  async findAll() {
    return this.prisma.dailySentence.findMany({
      orderBy: [{ date: 'desc' }, { sortOrder: 'asc' }],
    });
  }

  /** 获取单个句子 */
  async findById(id: string) {
    const item = await this.prisma.dailySentence.findUnique({ where: { id } });
    if (!item) throw new NotFoundException('每日句子不存在');
    return item;
  }

  /** 获取今日句子 */
  async findToday() {
    const today = parseDateKey(todayDateKey(DEFAULT_CLIENT_TIME_ZONE))!;
    const tomorrow = addDateKeyDays(today, 1);

    const item = await this.prisma.dailySentence.findFirst({
      where: {
        date: {
          gte: today,
          lt: tomorrow,
        },
      },
    });

    // 如果今天没有配置句子，返回最近的一句
    if (!item) {
      return this.prisma.dailySentence.findFirst({
        orderBy: { date: 'desc' },
      });
    }

    return item;
  }

  /** 获取指定日期的句子 */
  async findByDate(dateStr: string) {
    const date = parseDateKey(dateStr);
    if (!date) throw new BadRequestException('日期格式无效');
    const nextDay = addDateKeyDays(date, 1);

    const item = await this.prisma.dailySentence.findFirst({
      where: {
        date: {
          gte: date,
          lt: nextDay,
        },
      },
    });
    return item;
  }

  /** 创建句子 */
  async create(dto: CreateDailySentenceDto) {
    const date = parseDateKey(dto.date);
    if (!date) throw new BadRequestException('日期格式无效');

    return this.prisma.dailySentence.create({
      data: {
        date,
        quote: dto.quote,
        translation: dto.translation,
        author: dto.author ?? '',
        sortOrder: dto.sortOrder ?? 0,
      },
    });
  }

  /** 更新句子 */
  async update(id: string, dto: UpdateDailySentenceDto) {
    await this.findById(id);

    const data: any = { ...dto };
    if (dto.date) {
      const date = parseDateKey(dto.date);
      if (!date) throw new BadRequestException('日期格式无效');
      data.date = date;
    }

    return this.prisma.dailySentence.update({
      where: { id },
      data,
    });
  }

  /** 删除句子 */
  async remove(id: string) {
    await this.findById(id);
    return this.prisma.dailySentence.delete({ where: { id } });
  }
}
