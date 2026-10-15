/**
 * One-off: upsert 阿里云百炼 LLM 并设为当前激活。
 * 用法: pnpm --filter @manyu/backend exec ts-node prisma/upsert-bailian-llm.ts
 */
import { PrismaClient } from '@prisma/client';
import { loadEnvFile } from 'node:process';
import { resolve } from 'node:path';

try {
  loadEnvFile(resolve(__dirname, '../.env'));
} catch (error: any) {
  if (error?.code !== 'ENOENT') throw error;
}

const API_KEY =
  process.env.BAILIAN_UPSERT_API_KEY?.trim()
  || process.env.DASHSCOPE_API_KEY?.trim()
  || process.env.BAILIAN_API_KEY?.trim()
  || '';

const BASE_URL =
  process.env.BAILIAN_UPSERT_BASE_URL?.trim()
  || process.env.BAILIAN_BASE_URL?.trim()
  || 'https://dashscope.aliyuncs.com/compatible-mode/v1';

const MODEL = process.env.BAILIAN_UPSERT_MODEL?.trim() || process.env.BAILIAN_MODEL?.trim() || 'qwen3.7-flash';

async function main() {
  if (!API_KEY) {
    throw new Error('缺少 API Key：请设置 BAILIAN_UPSERT_API_KEY / DASHSCOPE_API_KEY / BAILIAN_API_KEY');
  }

  const prisma = new PrismaClient();
  try {
    const provider = await prisma.aiProvider.upsert({
      where: { type_provider: { type: 'llm', provider: 'bailian' } },
      create: {
        type: 'llm',
        provider: 'bailian',
        label: '阿里云百炼',
        model: MODEL,
        apiKey: API_KEY,
        baseUrl: BASE_URL,
        sortOrder: 2,
        isActive: false,
      },
      update: {
        label: '阿里云百炼',
        model: MODEL,
        apiKey: API_KEY,
        baseUrl: BASE_URL,
        sortOrder: 2,
      },
    });

    await prisma.aiProvider.updateMany({
      where: { type: 'llm', isActive: true, NOT: { id: provider.id } },
      data: { isActive: false },
    });
    const active = await prisma.aiProvider.update({
      where: { id: provider.id },
      data: { isActive: true },
    });

    console.log(
      JSON.stringify(
        {
          id: active.id,
          provider: active.provider,
          label: active.label,
          model: active.model,
          baseUrl: active.baseUrl,
          isActive: active.isActive,
          apiKeyPreview: `${active.apiKey.slice(0, 8)}***`,
        },
        null,
        2,
      ),
    );
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
