import { PrismaClient, type Prisma } from '@prisma/client';
import { loadEnvFile } from 'node:process';
import { resolve } from 'node:path';

try {
  loadEnvFile(resolve(__dirname, '../.env'));
} catch (error: any) {
  if (error?.code !== 'ENOENT') throw error;
}

type SeedClient = Pick<PrismaClient, 'aiProvider'>;

type ProviderSeed = {
  type: 'stt' | 'tts' | 'llm';
  provider: string;
  label: string;
  model: string;
  apiKey: string;
  baseUrl: string;
  config?: Prisma.InputJsonValue;
  sortOrder: number;
};

function env(name: string, fallback = '') {
  const value = process.env[name]?.trim();
  if (!value || /^your-/i.test(value)) return fallback;
  return value;
}

function optionalNumber(name: string) {
  const value = Number(env(name));
  return Number.isFinite(value) && value > 0 ? value : undefined;
}

function compactConfig(config: Record<string, unknown>): Prisma.InputJsonValue | undefined {
  const entries = Object.entries(config).filter(([, value]) => value !== '' && value !== undefined);
  return entries.length > 0 ? Object.fromEntries(entries) as Prisma.InputJsonObject : undefined;
}

function providerSeeds(): ProviderSeed[] {
  return [
    {
      type: 'stt',
      provider: 'whisper',
      label: 'Whisper',
      model: env('WHISPER_MODEL'),
      apiKey: '',
      baseUrl: env('WHISPER_INFERENCE_URL'),
      config: compactConfig({
        language: env('WHISPER_LANGUAGE', 'en'),
        timeoutMs: optionalNumber('WHISPER_TIMEOUT_MS') ?? 120_000,
      }),
      sortOrder: 0,
    },
    {
      type: 'stt',
      provider: 'tencent',
      label: '腾讯云 ASR',
      model: '',
      apiKey: env('TENCENT_SECRET_KEY'),
      baseUrl: env('TENCENT_SECRET_ID'),
      config: compactConfig({
        region: env('TENCENT_REGION', 'ap-shanghai'),
        language: env('STT_LANGUAGE', 'en-US'),
      }),
      sortOrder: 1,
    },
    {
      type: 'tts',
      provider: 'minimax',
      label: 'MiniMax',
      model: env('MINIMAX_MODEL', 'speech-2.8-hd'),
      apiKey: env('MINIMAX_API_KEY'),
      baseUrl: env('MINIMAX_BASE_URL'),
      config: compactConfig({ groupId: env('MINIMAX_GROUP_ID') }),
      sortOrder: 0,
    },
    {
      type: 'tts',
      provider: 'cartesia',
      label: 'Cartesia',
      model: env('CARTESIA_MODEL', 'sonic-english'),
      apiKey: env('CARTESIA_API_KEY'),
      baseUrl: env('CARTESIA_BASE_URL'),
      sortOrder: 1,
    },
    {
      type: 'tts',
      provider: 'hume',
      label: 'Hume AI',
      model: env('HUME_MODEL', '2'),
      apiKey: env('HUME_API_KEY'),
      baseUrl: env('HUME_BASE_URL'),
      config: compactConfig({
        voiceName: env('HUME_VOICE_NAME', 'Ava Song'),
        voiceProvider: env('HUME_VOICE_PROVIDER', 'HUME_AI'),
      }),
      sortOrder: 2,
    },
    {
      type: 'tts',
      provider: 'elevenlabs',
      label: 'ElevenLabs',
      model: env('ELEVENLABS_MODEL', 'eleven_multilingual_v2'),
      apiKey: env('ELEVENLABS_API_KEY'),
      baseUrl: env('ELEVENLABS_BASE_URL', 'https://api.elevenlabs.io'),
      config: compactConfig({ voiceId: env('ELEVENLABS_VOICE_ID', 'JBFqnCBsd6RMkjVDRZzb') }),
      sortOrder: 3,
    },
    {
      type: 'llm',
      provider: 'deepseek',
      label: 'DeepSeek',
      model: env('DEEPSEEK_MODEL', 'deepseek-v4'),
      apiKey: env('DEEPSEEK_API_KEY'),
      baseUrl: env('DEEPSEEK_BASE_URL', 'https://api.deepseek.com'),
      sortOrder: 0,
    },
    {
      type: 'llm',
      provider: 'openai',
      label: 'OpenAI',
      model: env('OPENAI_MODEL', 'gpt-4o'),
      apiKey: env('OPENAI_API_KEY'),
      baseUrl: env('OPENAI_BASE_URL', 'https://api.openai.com/v1'),
      sortOrder: 1,
    },
  ];
}

export async function seedAiModels(prisma: SeedClient) {
  const seeds = providerSeeds();

  for (const seed of seeds) {
    const { apiKey, baseUrl, model } = seed;
    await prisma.aiProvider.upsert({
      where: { type_provider: { type: seed.type, provider: seed.provider } },
      create: seed,
      update: {
        label: seed.label,
        sortOrder: seed.sortOrder,
        ...(seed.config !== undefined ? { config: seed.config } : {}),
        // Empty env values must not erase values entered through the admin UI.
        ...(model ? { model } : {}),
        ...(baseUrl ? { baseUrl } : {}),
        ...(apiKey ? { apiKey } : {}),
      },
    });
  }

  const preferred = {
    stt: env('STT_PROVIDER'),
    tts: env('TTS_PROVIDER'),
    llm: env('LLM_PROVIDER'),
  } as const;

  for (const type of ['stt', 'tts', 'llm'] as const) {
    const active = await prisma.aiProvider.findFirst({ where: { type, isActive: true } });
    const preferredProvider = preferred[type];
    if (preferredProvider) {
      const target = await prisma.aiProvider.findUnique({
        where: { type_provider: { type, provider: preferredProvider.toLowerCase() } },
      });
      if (target && target.id !== active?.id) {
        await prisma.aiProvider.updateMany({ where: { type }, data: { isActive: false } });
        await prisma.aiProvider.update({ where: { id: target.id }, data: { isActive: true } });
      }
    } else if (!active) {
      const first = await prisma.aiProvider.findFirst({ where: { type }, orderBy: { sortOrder: 'asc' } });
      if (first) await prisma.aiProvider.update({ where: { id: first.id }, data: { isActive: true } });
    }
  }

  console.log(`    ↳ ${seeds.length} 项 AI 模型配置`);
}

async function main() {
  const prisma = new PrismaClient();
  try {
    await seedAiModels(prisma);
  } finally {
    await prisma.$disconnect();
  }
}

if (require.main === module) {
  main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}
