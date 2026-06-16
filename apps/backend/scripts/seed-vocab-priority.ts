import { PrismaClient } from '@prisma/client';
const p = new PrismaClient();
p.vocabulary.updateMany({
  where: { word: { in: ['check in', 'borrow', 'appointment', 'key', 'late', 'lost', 'available', 'help'] } },
  data: { outputPriority: 'high' },
}).then(r => {
  console.log('Updated', r.count, 'vocabs to high priority');
  p.$disconnect();
}).catch(e => {
  console.error(e);
  p.$disconnect();
});
