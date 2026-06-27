import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { generateText } from 'ai';
import { PrismaService } from '../../common/prisma/prisma.service';
import type { AiProvider } from '@prisma/client';
import { LlmProviderFactory } from '../../common/llm/llm-provider.factory';

export type AiProviderType = 'stt' | 'tts' | 'llm';

export interface UpdateAiProviderDto {
  label?: string;
  model?: string;
  apiKey?: string;
  baseUrl?: string;
  config?: any;
  isActive?: boolean;
}

export interface CreateAiProviderDto {
  type?: AiProviderType;
  provider: string;
  label: string;
  model?: string;
  apiKey?: string;
  baseUrl?: string;
  config?: any;
}

@Injectable()
export class AiModelService {
  private readonly logger = new Logger(AiModelService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly llmFactory: LlmProviderFactory,
  ) {}

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
  async create(dto: CreateAiProviderDto): Promise<AiProvider> {
    const type = dto.type ?? 'llm';
    if (!['stt', 'tts', 'llm'].includes(type)) {
      throw new BadRequestException('Unsupported provider type');
    }

    const provider = dto.provider.trim().toLowerCase();
    const label = dto.label.trim();
    if (!provider) throw new BadRequestException('Provider is required');
    if (!label) throw new BadRequestException('Label is required');

    const last = await this.prisma.aiProvider.findFirst({
      where: { type },
      orderBy: { sortOrder: 'desc' },
    });

    return this.prisma.aiProvider.create({
      data: {
        type,
        provider,
        label,
        model: dto.model?.trim() ?? '',
        apiKey: dto.apiKey?.trim() ?? '',
        baseUrl: dto.baseUrl?.trim() ?? '',
        config: dto.config,
        sortOrder: (last?.sortOrder ?? -1) + 1,
      },
    });
  }

  async remove(id: string): Promise<{ success: true }> {
    const provider = await this.prisma.aiProvider.findUnique({ where: { id } });
    if (!provider) throw new NotFoundException('Provider not found');
    if (['whisper', 'tencent', 'minimax', 'cartesia', 'hume', 'elevenlabs', 'deepseek', 'openai'].includes(provider.provider)) {
      throw new BadRequestException('Built-in providers cannot be deleted');
    }
    if (provider.isActive) {
      throw new BadRequestException('Active provider cannot be deleted');
    }

    await this.prisma.aiProvider.delete({ where: { id } });
    return { success: true };
  }

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
      model: active?.model || 'deepseek-v4-pro',
      baseUrl: active?.baseUrl || 'https://api.deepseek.com',
    };
  }

  async testLlmProvider(id: string, prompt: string) {
    const provider = await this.getById(id);
    if (!provider) throw new NotFoundException('Provider not found');
    if (provider.type !== 'llm') throw new BadRequestException('Only LLM providers can use this test');
    const trimmedPrompt = prompt.trim();
    if (!trimmedPrompt) throw new BadRequestException('Prompt is required');

    const startedAt = Date.now();
    const fallbackApiKey =
      provider.provider === 'deepseek'
        ? process.env.DEEPSEEK_API_KEY?.trim()
        : provider.provider === 'openai'
          ? process.env.OPENAI_API_KEY?.trim()
          : undefined;
    const model = this.llmFactory.create({
      provider: provider.provider,
      apiKey: provider.apiKey || fallbackApiKey || '',
      model: provider.model,
      baseUrl: provider.baseUrl,
    });
    const { text, usage } = await generateText({
      model,
      prompt: trimmedPrompt,
      maxOutputTokens: 500,
    });

    return {
      text,
      usage,
      elapsedMs: Date.now() - startedAt,
      provider: provider.provider,
      model: provider.model,
    };
  }

  /** 获取 STT 配置（含 provider 级默认参数） */
  async getSttConfig(): Promise<{
    provider: string;
    temperature?: number;
    enableTimestamps?: boolean;
    inferenceUrl?: string;
    timeoutMs?: number;
    tencentSecretId?: string;
    tencentSecretKey?: string;
    tencentRegion?: string;
  }> {
    const active = await this.getActive('stt');
    const config = (active?.config as any) ?? {};
    return {
      provider: active?.provider || process.env.STT_PROVIDER?.trim() || 'whisper',
      temperature: typeof config.temperature === 'number' ? config.temperature : undefined,
      enableTimestamps: typeof config.enableTimestamps === 'boolean' ? config.enableTimestamps : undefined,
      inferenceUrl: active?.provider === 'whisper' && active.baseUrl ? active.baseUrl : undefined,
      timeoutMs: typeof config.timeoutMs === 'number' ? config.timeoutMs : undefined,
      tencentSecretId: active?.provider === 'tencent' && active.baseUrl ? active.baseUrl : undefined,
      tencentSecretKey: active?.provider === 'tencent' && active.apiKey ? active.apiKey : undefined,
      tencentRegion: active?.provider === 'tencent' && typeof config.region === 'string' ? config.region : undefined,
    };
  }

  /** 获取 TTS 配置（优先 AI Models 表，缺省再回退到环境变量） */
  async getTtsConfig(providerName?: string): Promise<{
    provider: string;
    model: string;
    apiKey: string;
    baseUrl: string;
    groupId?: string;
    config: Record<string, unknown>;
  }> {
    const normalizedProvider = providerName?.trim().toLowerCase();
    const provider = normalizedProvider
      ? await this.prisma.aiProvider.findFirst({ where: { type: 'tts', provider: normalizedProvider } })
      : await this.getActive('tts');
    const selectedProvider = provider?.provider || normalizedProvider || process.env.TTS_PROVIDER?.trim() || 'minimax';
    const config = ((provider?.config as Record<string, unknown> | null) ?? {}) as Record<string, unknown>;

    const envApiKey =
      selectedProvider === 'minimax'
        ? process.env.MINIMAX_API_KEY?.trim()
        : selectedProvider === 'cartesia'
          ? process.env.CARTESIA_API_KEY?.trim()
          : selectedProvider === 'hume'
            ? process.env.HUME_API_KEY?.trim()
            : selectedProvider === 'elevenlabs'
              ? process.env.ELEVENLABS_API_KEY?.trim()
              : '';

    const defaultModel =
      selectedProvider === 'cartesia'
        ? 'sonic-english'
        : selectedProvider === 'hume'
          ? '2'
          : selectedProvider === 'elevenlabs'
            ? 'eleven_multilingual_v2'
            : 'speech-2.8-hd';

    return {
      provider: selectedProvider,
      model: provider?.model || defaultModel,
      apiKey: provider?.apiKey || envApiKey || '',
      baseUrl: provider?.baseUrl || '',
      groupId: typeof config.groupId === 'string' ? config.groupId : undefined,
      config,
    };
  }

  /** 初始化内置供应商（幂等，仅在不存在时插入） */
  async seedDefaults() {
    const defaults = [
      { type: 'stt', provider: 'whisper', label: 'Whisper', model: '', apiKey: '', baseUrl: '', sortOrder: 0 },
      { type: 'stt', provider: 'tencent', label: '腾讯云 ASR', model: '', apiKey: '', baseUrl: '', sortOrder: 1 },
      { type: 'tts', provider: 'minimax', label: 'MiniMax', model: 'speech-2.8-hd', apiKey: process.env.MINIMAX_API_KEY?.trim() || '', baseUrl: '', config: { groupId: process.env.MINIMAX_GROUP_ID?.trim() || '' }, sortOrder: 0 },
      { type: 'tts', provider: 'cartesia', label: 'Cartesia', model: '', apiKey: '', baseUrl: '', sortOrder: 1 },
      { type: 'tts', provider: 'hume', label: 'Hume AI', model: '2', apiKey: process.env.HUME_API_KEY?.trim() || '', baseUrl: '', config: { voiceName: 'Ava Song', voiceProvider: 'HUME_AI' }, sortOrder: 2 },
      { type: 'tts', provider: 'elevenlabs', label: 'ElevenLabs', model: 'eleven_multilingual_v2', apiKey: process.env.ELEVENLABS_API_KEY?.trim() || '', baseUrl: 'https://api.elevenlabs.io', config: { voiceId: process.env.ELEVENLABS_VOICE_ID?.trim() || 'JBFqnCBsd6RMkjVDRZzb' }, sortOrder: 3 },
      { type: 'llm', provider: 'deepseek', label: 'DeepSeek', model: 'deepseek-v4-pro', apiKey: process.env.DEEPSEEK_API_KEY?.trim() || '', baseUrl: 'https://api.deepseek.com', sortOrder: 0 },
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
