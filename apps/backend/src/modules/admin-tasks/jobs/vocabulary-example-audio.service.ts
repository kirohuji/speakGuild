import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../common/prisma/prisma.service';
import {
  DictionaryAudioService,
  type DictionaryAccent,
  type VoiceGender,
} from '../../dictionary/dictionary-audio.service';
import { FileAssetsService } from '../../file-assets/file-assets.service';

export type VocabularyExampleAudioItem = {
  vocabularyId: string;
  word: string;
  exampleIndex: number;
  text: string;
  type: DictionaryAccent;
  gender: VoiceGender;
};

export type LibraryVocabularyListParams = {
  search?: string;
  matchType?: 'fuzzy' | 'exact';
  difficulty?: string;
  pronunciationStatus?: 'missing-phonetic' | 'missing-audio' | 'incomplete' | '';
  qualityIssue?: 'meaning-other' | 'english-only-definition' | '';
  page?: number;
  pageSize?: number;
};

type VocabExample = {
  en?: string;
  zh?: string;
  note?: string;
  level?: string;
  audioUrl?: string | null;
  [key: string]: unknown;
};

const VOICE_COMBOS: Array<{ type: DictionaryAccent; gender: VoiceGender }> = [
  { type: 'uk', gender: 'female' },
  { type: 'uk', gender: 'male' },
  { type: 'us', gender: 'female' },
  { type: 'us', gender: 'male' },
];

@Injectable()
export class VocabularyExampleAudioService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly dictionaryAudio: DictionaryAudioService,
    private readonly fileAssets: FileAssetsService,
  ) {}

  pickVoice(seed: string): { type: DictionaryAccent; gender: VoiceGender } {
    const hash = [...seed].reduce((total, character) => ((total * 31) + character.codePointAt(0)!) >>> 0, 0);
    return VOICE_COMBOS[hash % VOICE_COMBOS.length]!;
  }

  buildWhere(params?: LibraryVocabularyListParams): Prisma.VocabularyWhereInput {
    const where: Prisma.VocabularyWhereInput = {};
    const search = params?.search?.trim();
    if (search) {
      if (params?.matchType === 'exact') {
        where.OR = [
          { word: { equals: search, mode: 'insensitive' } },
          { meaning: { equals: search, mode: 'insensitive' } },
        ];
      } else {
        where.OR = [
          { word: { contains: search, mode: 'insensitive' } },
          { meaning: { contains: search, mode: 'insensitive' } },
        ];
      }
    }
    if (params?.difficulty) where.difficulty = params.difficulty;

    const missingPhonetic: Prisma.VocabularyWhereInput = {
      OR: [
        { phoneticUs: null }, { phoneticUs: '' },
        { phoneticUk: null }, { phoneticUk: '' },
      ],
    };
    const missingAudio: Prisma.VocabularyWhereInput = {
      OR: [
        { audioUsUrl: null }, { audioUsUrl: '' },
        { audioUkUrl: null }, { audioUkUrl: '' },
      ],
    };
    const andFilters: Prisma.VocabularyWhereInput[] = [];
    if (params?.pronunciationStatus === 'missing-phonetic') andFilters.push(missingPhonetic);
    if (params?.pronunciationStatus === 'missing-audio') andFilters.push(missingAudio);
    if (params?.pronunciationStatus === 'incomplete') andFilters.push({ OR: [missingPhonetic, missingAudio] });
    if (params?.qualityIssue === 'meaning-other') {
      andFilters.push({ meaning: { contains: 'other', mode: 'insensitive' } });
    }
    if (params?.qualityIssue === 'english-only-definition') {
      andFilters.push({ definitionEn: { not: null } });
      andFilters.push({ NOT: { definitionEn: '' } });
    }
    if (andFilters.length) where.AND = andFilters;
    return where;
  }

  async listPage(params?: LibraryVocabularyListParams) {
    const page = Math.max(1, params?.page || 1);
    const pageSize = Math.min(100, Math.max(1, params?.pageSize || 20));
    const where = this.buildWhere(params);

    if (params?.qualityIssue === 'english-only-definition') {
      const candidates = await this.prisma.vocabulary.findMany({
        where,
        select: { id: true, definitionEn: true },
        orderBy: { sortOrder: 'asc' },
      });
      const matchedIds = candidates
        .filter((item) => item.definitionEn && !/[\u3400-\u9fff]/.test(item.definitionEn))
        .map((item) => item.id);
      const total = matchedIds.length;
      const pageIds = matchedIds.slice((page - 1) * pageSize, page * pageSize);
      const unordered = pageIds.length
        ? await this.prisma.vocabulary.findMany({ where: { id: { in: pageIds } } })
        : [];
      const byId = new Map(unordered.map((item) => [item.id, item]));
      const items = pageIds.map((id) => byId.get(id)!).filter(Boolean);
      return { items, total, page, pageSize, totalPages: Math.ceil(total / pageSize) };
    }

    const [items, total] = await Promise.all([
      this.prisma.vocabulary.findMany({
        where,
        orderBy: { sortOrder: 'asc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.vocabulary.count({ where }),
    ]);
    return { items, total, page, pageSize, totalPages: Math.ceil(total / pageSize) };
  }

  collectMissingItems(
    vocabularies: Array<{ id: string; word: string; examples: unknown }>,
  ): VocabularyExampleAudioItem[] {
    const items: VocabularyExampleAudioItem[] = [];
    for (const vocabulary of vocabularies) {
      const examples = Array.isArray(vocabulary.examples)
        ? vocabulary.examples as VocabExample[]
        : [];
      examples.forEach((example, exampleIndex) => {
        const text = typeof example?.en === 'string' ? example.en.trim() : '';
        if (!text) return;
        if (typeof example.audioUrl === 'string' && example.audioUrl.trim()) return;
        const voice = this.pickVoice(`${vocabulary.id}:${exampleIndex}`);
        items.push({
          vocabularyId: vocabulary.id,
          word: vocabulary.word,
          exampleIndex,
          text,
          type: voice.type,
          gender: voice.gender,
        });
      });
    }
    return items;
  }

  async generatePreviewAudio(input: {
    text: string;
    type?: DictionaryAccent;
    gender?: VoiceGender;
    bizId?: string;
  }) {
    const text = input.text.trim();
    if (!text) throw new BadRequestException('例句英文不能为空');
    const voice = input.type && input.gender
      ? { type: input.type, gender: input.gender }
      : this.pickVoice(input.bizId || text);
    const url = await this.dictionaryAudio.generate(text, voice.type, voice.gender, {
      bizType: 'library_vocab_example',
      bizId: input.bizId || `preview:${text.slice(0, 40)}`,
      filenamePrefix: text,
    });
    return { url, type: voice.type, gender: voice.gender };
  }

  async generateAndPersist(
    item: VocabularyExampleAudioItem,
    createdById?: string,
  ) {
    const vocabulary = await this.prisma.vocabulary.findUnique({
      where: { id: item.vocabularyId },
    });
    if (!vocabulary) throw new NotFoundException(`词汇不存在：${item.word}`);

    const examples = Array.isArray(vocabulary.examples)
      ? [...(vocabulary.examples as VocabExample[])]
      : [];
    const current = examples[item.exampleIndex];
    if (!current || typeof current.en !== 'string' || !current.en.trim()) {
      throw new BadRequestException(`${item.word} 第 ${item.exampleIndex + 1} 条例句不存在`);
    }
    if (typeof current.audioUrl === 'string' && current.audioUrl.trim()) {
      return { skipped: true as const, audioUrl: current.audioUrl };
    }

    const text = current.en.trim();
    const audioUrl = await this.dictionaryAudio.generate(text, item.type, item.gender, {
      bizType: 'library_vocab_example',
      bizId: `${item.vocabularyId}:${item.exampleIndex}`,
      filenamePrefix: `${item.word}-ex${item.exampleIndex + 1}`,
    });

    const latest = await this.prisma.vocabulary.findUnique({
      where: { id: item.vocabularyId },
    });
    if (!latest) throw new NotFoundException(`词汇不存在：${item.word}`);
    const latestExamples = Array.isArray(latest.examples)
      ? [...(latest.examples as VocabExample[])]
      : [];
    const latestCurrent = latestExamples[item.exampleIndex];
    if (!latestCurrent || typeof latestCurrent.en !== 'string') {
      throw new BadRequestException(`${item.word} 第 ${item.exampleIndex + 1} 条例句已被移除`);
    }
    if (typeof latestCurrent.audioUrl === 'string' && latestCurrent.audioUrl.trim()) {
      return { skipped: true as const, audioUrl: latestCurrent.audioUrl };
    }

    latestExamples[item.exampleIndex] = { ...latestCurrent, audioUrl };
    const updated = await this.prisma.$transaction(async (tx) => {
      const vocabularyUpdated = await tx.vocabulary.update({
        where: { id: item.vocabularyId },
        data: { examples: latestExamples as Prisma.InputJsonValue },
      });
      if (createdById) {
        await this.fileAssets.syncPersistentAssetReferences(
          tx,
          createdById,
          'vocabulary_asset',
          item.vocabularyId,
          vocabularyUpdated,
        );
      }
      return vocabularyUpdated;
    });

    return { skipped: false as const, audioUrl, vocabulary: updated };
  }
}
