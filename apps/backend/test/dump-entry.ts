import { PrismaClient } from '@prisma/client';

async function main() {
  const prisma = new PrismaClient();
  const word = process.argv[2] || 'dog';
  const entry = await prisma.dictionaryEntry.findUnique({ where: { word } });
  if (!entry) { console.log(`"${word}" not found`); await prisma.$disconnect(); return; }

  const data = entry as any;

  // Summary
  console.log(`=== ${data.word} ===`);
  console.log(`language: ${data.language}`);
  console.log(`sourceUrl: ${data.sourceUrl}`);
  console.log(`pipelineVersion: ${data.pipelineVersion}`);
  console.log(`aiReviewed: ${data.aiReviewed}`);
  console.log(`aiReviewMeta:`, JSON.stringify(data.aiReviewMeta, null, 2));

  // Pronunciations
  console.log(`\n--- pronunciations (${data.pronunciations?.length ?? 0}) ---`);
  for (const p of data.pronunciations ?? []) {
    console.log(`  [${p.type}] ${p.ipa} ${p.isPreferred ? '⭐' : ''} ${p.audioUrl ?? ''}`);
  }

  // Clusters with senses (strip embeddings)
  console.log(`\n--- senseClusters (${data.senseClusters?.length ?? 0}) ---`);
  for (const c of data.senseClusters ?? []) {
    console.log(`\n#${c.rank} [${c.posBucket}] "${c.label}" (${c.senses?.length ?? 0} senses)`);
    for (const s of c.senses ?? []) {
      console.log(`  ${' '.repeat(String(c.rank).length)}  ├─ ${s.translations?.zh || '(no zh)'}`);
      console.log(`  ${' '.repeat(String(c.rank).length)}  │  EN: ${s.definition}`);
      console.log(`  ${' '.repeat(String(c.rank).length)}  │  POS: ${s.partOfSpeech} | tags: [${(s.tags ?? []).join(', ')}]`);
      if (s.examples?.length) {
        for (const ex of s.examples.slice(0, 2)) {
          console.log(`  ${' '.repeat(String(c.rank).length)}  │  📝 "${ex.en.substring(0, 60)}${ex.en.length > 60 ? '...' : ''}"`);
          if (ex.zh) console.log(`  ${' '.repeat(String(c.rank).length)}  │     → "${ex.zh}"`);
        }
      }
      if (s.synonyms?.length) console.log(`  ${' '.repeat(String(c.rank).length)}  │  syn: [${s.synonyms.slice(0, 5).join(', ')}]`);
    }
  }

  // Flat senses count
  console.log(`\n--- senses (flat, ${data.senses?.length ?? 0} total) ---`);
  console.log(`  (same data as senseClusters[*].senses, stored flat with clusterId references)`);

  await prisma.$disconnect();
}
main();
