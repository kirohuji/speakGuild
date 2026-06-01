import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { PaginationDto, toPageResult } from '../../common/dto/pagination.dto';
import { AddWordDto } from './dto/add-word.dto';

@Injectable()
export class AssetsService {
  constructor(private readonly prisma: PrismaService) {}

  async getWords(userId: string, pagination: PaginationDto) {
    const { page = 1, pageSize = 20 } = pagination;
    const skip = (page - 1) * pageSize;

    const where: Record<string, unknown> = { userId };
    if (pagination.keyword) {
      where.term = { contains: pagination.keyword, mode: 'insensitive' };
    }

    const [list, total] = await this.prisma.$transaction([
      this.prisma.vocabularyWord.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: pageSize,
        }),
      this.prisma.vocabularyWord.count({ where }),
    ]);

    return toPageResult(list, total, pagination);
  }

  async addWord(userId: string, dto: AddWordDto) {
    const existing = await this.prisma.vocabularyWord.findUnique({
      where: { userId_term: { userId, term: dto.term } },
    });
    if (existing) {
      return this.prisma.vocabularyWord.update({
        where: { userId_term: { userId, term: dto.term } },
        data: {
          definition: dto.definition ?? existing.definition,
        },
      });
    }

    return this.prisma.vocabularyWord.create({
      data: {
        userId,
        term: dto.term,
        definition: dto.definition ?? null,
      },
    });
  }

  async removeWord(userId: string, term: string) {
    const existing = await this.prisma.vocabularyWord.findUnique({
      where: { userId_term: { userId, term } },
    });
    if (!existing) {
      throw new NotFoundException('Word not found');
    }

    await this.prisma.vocabularyWord.delete({
      where: { userId_term: { userId, term } },
    });

    return { success: true };
  }
}
