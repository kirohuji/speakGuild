import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { PaginationDto, toPageResult } from '../../common/dto/pagination.dto';
import { AddWordDto } from './dto/add-word.dto';

@Injectable()
export class AssetsService {
  constructor(private readonly prisma: PrismaService) {}

  async getFavorites(userId: string, pagination: PaginationDto) {
    const { page = 1, pageSize = 20 } = pagination;
    const skip = (page - 1) * pageSize;

    const [list, total] = await this.prisma.$transaction([
      this.prisma.favoriteQuestion.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        skip,
        take: pageSize,
        include: {
          question: {
            include: {
              content: true,
              topic: { select: { id: true, name: true } },
            },
          },
        },
      }),
      this.prisma.favoriteQuestion.count({ where: { userId } }),
    ]);

    return toPageResult(list, total, pagination);
  }

  async addFavorite(userId: string, questionId: string) {
    const question = await this.prisma.questionItem.findUnique({ where: { id: questionId } });
    if (!question) {
      throw new NotFoundException('Question not found');
    }

    const existing = await this.prisma.favoriteQuestion.findUnique({
      where: { userId_questionId: { userId, questionId } },
    });
    if (existing) {
      return existing;
    }

    return this.prisma.favoriteQuestion.create({
      data: { userId, questionId },
    });
  }

  async removeFavorite(userId: string, questionId: string) {
    const existing = await this.prisma.favoriteQuestion.findUnique({
      where: { userId_questionId: { userId, questionId } },
    });
    if (!existing) {
      throw new NotFoundException('Favorite not found');
    }

    await this.prisma.favoriteQuestion.delete({
      where: { userId_questionId: { userId, questionId } },
    });

    return { success: true };
  }

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
        include: {
          sourceQuestion: {
            select: { id: true, title: true },
          },
        },
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
          sourceQuestionId: dto.sourceQuestionId ?? existing.sourceQuestionId,
        },
      });
    }

    return this.prisma.vocabularyWord.create({
      data: {
        userId,
        term: dto.term,
        definition: dto.definition ?? null,
        sourceQuestionId: dto.sourceQuestionId ?? null,
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
