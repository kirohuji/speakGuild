import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const dailySentences = [
  {
    date: new Date('2026-05-26'),
    quote: 'The secret of getting ahead is getting started.',
    translation: '领先的秘诀就是开始行动。',
    author: 'Mark Twain',
    sortOrder: 0,
  },
  {
    date: new Date('2026-05-27'),
    quote: 'Small steps lead to big changes.',
    translation: '小步前进，终成巨变。',
    author: 'EngJourney Daily',
    sortOrder: 0,
  },
  {
    date: new Date('2026-05-28'),
    quote: 'Say one real sentence today.',
    translation: '今天先说出一句真实会用的话。',
    author: 'EngJourney Daily',
    sortOrder: 0,
  },
  {
    date: new Date('2026-05-29'),
    quote: 'Practice makes progress, not perfect.',
    translation: '反复练习带来进步，而非完美。',
    author: 'EngJourney Daily',
    sortOrder: 0,
  },
  {
    date: new Date('2026-05-30'),
    quote: 'Every expert was once a beginner.',
    translation: '每个专家都曾是初学者。',
    author: 'EngJourney Daily',
    sortOrder: 0,
  },
  {
    date: new Date('2026-05-31'),
    quote: 'Don\'t watch the clock; do what it does. Keep going.',
    translation: '不要只是看钟，像钟一样继续前行。',
    author: 'Sam Levenson',
    sortOrder: 0,
  },
  {
    date: new Date('2026-06-01'),
    quote: 'Language is the road map of a culture.',
    translation: '语言是文化的路线图。',
    author: 'Rita Mae Brown',
    sortOrder: 0,
  },
  {
    date: new Date('2026-06-02'),
    quote: 'The beautiful thing about learning is that nobody can take it away from you.',
    translation: '学习的美好之处在于没有人能把它从你这里夺走。',
    author: 'B.B. King',
    sortOrder: 0,
  },
  {
    date: new Date('2026-06-03'),
    quote: 'To have another language is to possess a second soul.',
    translation: '拥有另一种语言，就如同拥有第二个灵魂。',
    author: 'Charlemagne',
    sortOrder: 0,
  },
  {
    date: new Date('2026-06-04'),
    quote: 'The limits of my language mean the limits of my world.',
    translation: '语言的边界就是我的世界的边界。',
    author: 'Ludwig Wittgenstein',
    sortOrder: 0,
  },
];

export async function seedDailySentences() {
  for (const item of dailySentences) {
    const dateStart = new Date(item.date);
    dateStart.setHours(0, 0, 0, 0);
    const dateEnd = new Date(dateStart);
    dateEnd.setDate(dateEnd.getDate() + 1);

    const existing = await prisma.dailySentence.findFirst({
      where: {
        date: {
          gte: dateStart,
          lt: dateEnd,
        },
      },
    });

    if (!existing) {
      await prisma.dailySentence.create({
        data: item,
      });
    }
  }
  console.log(`    ↳ ${dailySentences.length} 条每日句子`);
}

// 直接运行
if (require.main === module) {
  seedDailySentences()
    .then(() => { console.log('✅ 每日句子种子完成'); process.exit(0); })
    .catch((e) => { console.error(e); process.exit(1); });
}
