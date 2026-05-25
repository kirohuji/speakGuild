import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { BindConfigDto } from './dto/bind-config.dto';

@Injectable()
export class ConfigGuideService {
  constructor(private readonly prisma: PrismaService) {}

  async getOptions() {
    const banks = await this.prisma.questionBank.findMany({
      where: { status: 'active' },
      select: { province: true, language: true, examType: true, interviewForm: true },
    });

    const toOptions = (arr: string[]) =>
      arr.map((v) => ({ label: v, value: v }));

    return {
      provinces: toOptions([...new Set(banks.map((b) => b.province))]),
      languages: toOptions([...new Set(banks.map((b) => b.language))]),
      examTypes: toOptions([...new Set(banks.map((b) => b.examType))]),
      interviewForms: toOptions([...new Set(banks.map((b) => b.interviewForm))]),
    };
  }

  async bindConfig(userId: string, dto: BindConfigDto) {
    const bank = await this.prisma.questionBank.findFirst({
      where: {
        province: dto.province,
        language: dto.language,
        examType: dto.examType,
        interviewForm: dto.interviewForm,
        status: 'active',
      },
    });

    const payload = {
      province: dto.province,
      language: dto.language,
      examType: dto.examType,
      interviewForm: dto.interviewForm,
      bankId: bank?.id ?? null,
    };

    await this.prisma.userBindingConfig.upsert({
      where: { userId },
      create: { ...payload, userId },
      update: payload,
    });

    await this.prisma.userPreference.upsert({
      where: { userId },
      create: { userId },
      update: {},
    });

    return {
      bankId: bank?.id ?? null,
      bankName: bank?.name ?? null,
      province: dto.province,
      language: dto.language,
      examType: dto.examType,
      interviewForm: dto.interviewForm,
    };
  }

  async getCurrentConfig(userId: string) {
    return this.findBindingConfigSimple(userId);
  }

  async getBootstrap(userId: string) {
    const config = await this.findBindingConfigWithTopics(userId);

    if (!config) {
      return { configured: false, config: null, bank: null };
    }

    return {
      configured: true,
      config: {
        province: config.province,
        language: config.language,
        examType: config.examType,
        interviewForm: config.interviewForm,
      },
      bank: config.bank
        ? {
            id: config.bank.id,
            name: config.bank.name,
            topics: config.bank.topics.map((t) => ({
              id: t.id,
              code: t.code,
              name: t.name,
              questionCount: t._count.items,
            })),
          }
        : null,
    };
  }

  private async findBindingConfigSimple(userId: string) {
    return this.prisma.userBindingConfig.findUnique({
      where: { userId },
      include: { bank: true },
    });
  }

  private async findBindingConfigWithTopics(userId: string) {
    return this.prisma.userBindingConfig.findUnique({
      where: { userId },
      include: {
        bank: {
          include: {
            topics: {
              orderBy: { sortOrder: 'asc' },
              include: {
                _count: { select: { items: true } },
              },
            },
          },
        },
      },
    });
  }
}
