/**
 * 给语料库中已有的牛津 5000 词汇打上 tags: ['oxford-5k']。
 * 不创建新词，只更新已存在且尚未带该 tag 的词条。
 *
 * 用法：cd apps/backend && pnpm exec ts-node prisma/tag-oxford-5k.ts
 */
import { existsSync, readFileSync } from 'fs';
import { join } from 'path';
import { PrismaClient } from '@prisma/client';

const TAG = 'oxford-5k';
const prisma = new PrismaClient();

function resolveCsvPath() {
  const cwd = process.cwd();
  const candidates = [
    join(cwd, 'prisma', 'data', 'oxford-5k.csv'),
    join(cwd, 'oxford-5k.csv'),
    join(cwd, '..', 'oxford-5k.csv'),
    join(cwd, 'apps', 'oxford-5k.csv'),
  ];
  return candidates.find((path) => existsSync(path)) ?? null;
}

function loadOxfordWords(filePath: string) {
  const lines = readFileSync(filePath, 'utf-8').split(/\r?\n/).slice(1);
  const words = new Set<string>();
  for (const line of lines) {
    if (!line.trim()) continue;
    const word = line.split(',', 1)[0]?.trim().toLowerCase();
    if (word) words.add(word);
  }
  return [...words];
}

async function main() {
  const csvPath = resolveCsvPath();
  if (!csvPath) throw new Error('找不到 oxford-5k.csv');
  const oxfordWords = loadOxfordWords(csvPath);
  console.log(`牛津词表：${oxfordWords.length} 个唯一词（${csvPath}）`);

  await prisma.$executeRawUnsafe(`
    ALTER TABLE vocabulary
    ADD COLUMN IF NOT EXISTS tags TEXT[] NOT NULL DEFAULT '{}'::text[]
  `);

  const updatedThisRun = await prisma.$executeRaw`
    UPDATE vocabulary
    SET tags = array_append(tags, ${TAG})
    WHERE lower(word) = ANY(${oxfordWords}::text[])
      AND NOT (${TAG} = ANY(tags))
  `;

  const matched = await prisma.$queryRaw<Array<{ count: bigint }>>`
    SELECT COUNT(*)::bigint AS count
    FROM vocabulary
    WHERE lower(word) = ANY(${oxfordWords}::text[])
  `;
  const tagged = await prisma.$queryRaw<Array<{ count: bigint }>>`
    SELECT COUNT(*)::bigint AS count
    FROM vocabulary
    WHERE ${TAG} = ANY(tags)
  `;

  console.log(JSON.stringify({
    tag: TAG,
    oxfordUnique: oxfordWords.length,
    matchedInLibrary: Number(matched[0]?.count ?? 0),
    updatedThisRun: Number(updatedThisRun),
    taggedTotal: Number(tagged[0]?.count ?? 0),
    missingInLibrary: oxfordWords.length - Number(matched[0]?.count ?? 0),
  }, null, 2));
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
