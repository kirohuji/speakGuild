-- CreateTable
CREATE TABLE "nqtr_chapter_vocab" (
    "id" TEXT NOT NULL,
    "chapterId" TEXT NOT NULL,
    "vocabId" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "nqtr_chapter_vocab_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "nqtr_chapter_chunk" (
    "id" TEXT NOT NULL,
    "chapterId" TEXT NOT NULL,
    "chunkId" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "nqtr_chapter_chunk_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "nqtr_chapter_sentence_pattern" (
    "id" TEXT NOT NULL,
    "chapterId" TEXT NOT NULL,
    "patternId" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "nqtr_chapter_sentence_pattern_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "nqtr_chapter_vocab_chapterId_vocabId_key" ON "nqtr_chapter_vocab"("chapterId", "vocabId");

-- CreateIndex
CREATE UNIQUE INDEX "nqtr_chapter_chunk_chapterId_chunkId_key" ON "nqtr_chapter_chunk"("chapterId", "chunkId");

-- CreateIndex
CREATE UNIQUE INDEX "nqtr_chapter_sentence_pattern_chapterId_patternId_key" ON "nqtr_chapter_sentence_pattern"("chapterId", "patternId");

-- AddForeignKey
ALTER TABLE "nqtr_chapter_vocab" ADD CONSTRAINT "nqtr_chapter_vocab_chapterId_fkey" FOREIGN KEY ("chapterId") REFERENCES "nqtr_chapter"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "nqtr_chapter_vocab" ADD CONSTRAINT "nqtr_chapter_vocab_vocabId_fkey" FOREIGN KEY ("vocabId") REFERENCES "vocabulary"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "nqtr_chapter_chunk" ADD CONSTRAINT "nqtr_chapter_chunk_chapterId_fkey" FOREIGN KEY ("chapterId") REFERENCES "nqtr_chapter"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "nqtr_chapter_chunk" ADD CONSTRAINT "nqtr_chapter_chunk_chunkId_fkey" FOREIGN KEY ("chunkId") REFERENCES "chunk"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "nqtr_chapter_sentence_pattern" ADD CONSTRAINT "nqtr_chapter_sentence_pattern_chapterId_fkey" FOREIGN KEY ("chapterId") REFERENCES "nqtr_chapter"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "nqtr_chapter_sentence_pattern" ADD CONSTRAINT "nqtr_chapter_sentence_pattern_patternId_fkey" FOREIGN KEY ("patternId") REFERENCES "sentence_pattern"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
