import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import type { AiProvider } from '@prisma/client';

export type AiProviderType = 'stt' | 'tts' | 'llm';

export interface UpdateAiProviderDto {
  label?: string;
  model?: string;
  apiKey?: string;
  baseUrl?: string;
  isActive?: boolean;
}

@Injectable()
export class AiModelService {
  private readonly logger = new Logger(AiModelService.name);

  constructor(private readonly prisma: PrismaService) {}

  /** 获取所有供应商 */
  async list(): Promise<AiProvider[]> {
    return this.prisma.aiProvider.findMany({ orderBy: { sortOrder: 'asc' } });
  }

  /** 获取按类型分组的所有供应商 */
  async listGrouped(): Promise<Record<AiProviderType, AiProvider[]>> {
    const all = await this.list();
    const grouped: Record<string, AiProvider[]> = { stt: [], tts: [], llm: [] };
    for (const p of all) {
      if (grouped[p.type]) grouped[p.type].push(p);
    }
    return grouped as Record<AiProviderType, AiProvider[]>;
  }

  /** 获取某类型当前激活的供应商 */
  async getActive(type: AiProviderType): Promise<AiProvider | null> {
    return this.prisma.aiProvider.findFirst({
      where: { type, isActive: true },
    });
  }

  /** 获取某个供应商 */
  async getById(id: string): Promise<AiProvider | null> {
    return this.prisma.aiProvider.findUnique({ where: { id } });
  }

  /** 更新供应商配置 */
  async update(id: string, dto: UpdateAiProviderDto): Promise<AiProvider> {
    return this.prisma.aiProvider.update({ where: { id }, data: dto });
  }

  /** 激活某个供应商（同一 type 下取消其他激活） */
  async activate(id: string): Promise<AiProvider> {
    const provider = await this.prisma.aiProvider.findUnique({ where: { id } });
    if (!provider) throw new Error('Provider not found');

    // 取消同类型其他激活
    await this.prisma.aiProvider.updateMany({
      where: { type: provider.type, isActive: true },
      data: { isActive: false },
    });

    // 激活目标
    return this.prisma.aiProvider.update({
      where: { id },
      data: { isActive: true },
    });
  }

  /** 获取 LLM 配置（用于 LlmProviderFactory） */
  async getLlmConfig() {
    const active = await this.getActive('llm');
    return {
      provider: active?.provider ?? 'deepseek',
      apiKey: active?.apiKey || process.env.DEEPSEEK_API_KEY?.trim() || '',
      model: active?.model || 'deepseek-chat',
      baseUrl: active?.baseUrl || 'https://api.deepseek.com/v1',
    };
  }

  /** 获取 STT 配置 */
  async getSttProviderName(): Promise<string> {
    const active = await this.getActive('stt');
    return active?.provider || process.env.STT_PROVIDER?.trim() || 'whisper';
  }

  /** 初始化内置供应商（幂等，仅在不存在时插入） */
  async seedDefaults() {
    const defaults = [
      { type: 'stt', provider: 'whisper', label: 'Whisper', model: '', apiKey: '', baseUrl: '', sortOrder: 0 },
      { type: 'stt', provider: 'tencent', label: '腾讯云 ASR', model: '', apiKey: '', baseUrl: '', sortOrder: 1 },
      { type: 'tts', provider: 'minimax', label: 'MiniMax', model: 'speech-2.8-hd', apiKey: process.env.MINIMAX_API_KEY?.trim() || '', baseUrl: '', sortOrder: 0 },
      { type: 'tts', provider: 'cartesia', label: 'Cartesia', model: '', apiKey: '', baseUrl: '', sortOrder: 1 },
      { type: 'llm', provider: 'deepseek', label: 'DeepSeek', model: 'deepseek-chat', apiKey: process.env.DEEPSEEK_API_KEY?.trim() || '', baseUrl: 'https://api.deepseek.com/v1', sortOrder: 0 },
      { type: 'llm', provider: 'openai', label: 'OpenAI', model: 'gpt-4o', apiKey: '', baseUrl: 'https://api.openai.com/v1', sortOrder: 1 },
    ];

    for (const def of defaults) {
      await this.prisma.aiProvider.upsert({
        where: { type_provider: { type: def.type, provider: def.provider } },
        create: def,
        update: {}, // don't overwrite user config
      });
    }

    // 确保每个 type 至少有一个激活
    for (const type of ['stt', 'tts', 'llm'] as const) {
      const active = await this.getActive(type);
      if (!active) {
        const first = await this.prisma.aiProvider.findFirst({
          where: { type },
          orderBy: { sortOrder: 'asc' },
        });
        if (first) {
          await this.prisma.aiProvider.update({
            where: { id: first.id },
            data: { isActive: true },
          });
        }
      }
    }

    this.logger.log('AI providers seeded');
  }
}
