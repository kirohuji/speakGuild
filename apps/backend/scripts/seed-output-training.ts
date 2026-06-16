import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  // Find scene-based topics with Ink scripts and chunks (not grammar/system ones)
  const topics = await prisma.trainingTopic.findMany({
    where: {
      activeChunks: { some: {} },
      inkScriptId: { not: null },
    },
    include: {
      scene: { select: { title: true, packageType: true } },
      activeChunks: { include: { chunk: { select: { text: true } } }, take: 5 },
      topicVocabs: { include: { vocab: { select: { id: true, word: true } } }, take: 5 },
    },
    take: 8,
    orderBy: { createdAt: 'asc' },
  });

  if (topics.length === 0) {
    console.log('No scene-based topics with Ink scripts found.');
    return;
  }

  console.log(`Found ${topics.length} scene-based topics with Ink scripts\n`);

  const templateChunkItems = [
    { zh: '我想办理入住。', answer: "I'd like to check in." },
    { zh: '我想借这本书。', answer: "I'd like to borrow this book." },
    { zh: '我想预约。', answer: "I'd like to make an appointment." },
  ];

  let count = 0;
  for (const topic of topics) {
    const chunkTexts = topic.activeChunks.map((tc) => tc.chunk.text);
    const vocabWords = topic.topicVocabs.map((tv) => tv.vocab.word);
    const vocabIds = topic.topicVocabs.map((tv) => tv.vocab.id);

    if (chunkTexts.length === 0) continue;

    const outputTraining = {
      version: 1,
      enabled: true,
      pipeline: [
        {
          id: 'warmup_1',
          type: 'chunk_substitution',
          title: `用 "${chunkTexts[0] || 'key expression'}" 造句`,
          chunk: chunkTexts[0],
          items: templateChunkItems,
        },
        ...(vocabIds.length > 0 ? [{
          id: 'vocab_drill_1',
          type: 'vocab_drill',
          title: '核心词汇输出训练',
          vocabs: vocabIds.slice(0, 3).map((vid, idx) => ({
            vocabId: vid,
            promptZh: ['我想办理入住。', '我需要帮助。', '我想借一本书。'][idx] || vocabWords[idx] || '使用这个词汇造句',
            targetWords: vocabWords[idx] ? [vocabWords[idx]] : [],
            suggestedAnswer: '',
          })),
        }] : []),
      ],
    };

    await prisma.trainingTopic.update({
      where: { id: topic.id },
      data: { metadata: { outputTraining } as any },
    });

    console.log(`  ✅ ${topic.scene?.packageType || '?'}/${topic.scene?.title || '?'} → "${topic.title}" (${chunkTexts.length} chunks, ${vocabIds.length} vocabs)`);
    count++;
  }

  console.log(`\nDone! Seeded outputTraining on ${count} scene-based topics.`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());

