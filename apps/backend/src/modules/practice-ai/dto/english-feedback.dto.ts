import { IsArray, IsBoolean, IsNumber, IsObject, IsOptional, IsString } from 'class-validator';

export class DialogueTurnJudgeDto {
  @IsString()
  topicId: string;

  @IsString()
  @IsOptional()
  inputNodeId?: string;

  @IsString()
  npcText: string;

  @IsString()
  userText: string;

  @IsString()
  @IsOptional()
  expectedIntent?: string;

  @IsArray()
  @IsOptional()
  objectives?: string[];

  @IsArray()
  @IsOptional()
  targetChunks?: string[];

  @IsString()
  @IsOptional()
  mode?: string; // 'communicative' | 'targeted_output'

  @IsArray()
  @IsOptional()
  requiredChunks?: string[];

  @IsArray()
  @IsOptional()
  targetWords?: string[];

  @IsArray()
  @IsOptional()
  essentialSlots?: string[];

  @IsBoolean()
  @IsOptional()
  allowParaphrase?: boolean;
}

export class DialogueTurnJudgeResultDto {
  @IsString()
  intent: string;

  @IsBoolean()
  passed: boolean;

  @IsArray()
  objectiveCompleted: string[];

  @IsArray()
  chunksUsed: string[];

  @IsObject()
  inkVariables: Record<string, string | number | boolean>;

  @IsString()
  feedback: string;

  @IsNumber()
  confidence: number;
}

export class WarmupTurnJudgeDto {
  @IsString()
  stepType:
    | 'chunk_substitution'
    | 'vocab_drill'
    | 'vocab_sentence_building'
    | 'pattern_drill'
    | 'sentence_decomposition';

  @IsString()
  @IsOptional()
  direction?: 'zh_to_en' | 'en_to_zh';

  @IsString()
  prompt: string;

  @IsString()
  @IsOptional()
  expectedAnswer?: string;

  @IsString()
  userAnswer: string;

  @IsString()
  @IsOptional()
  targetText?: string;

  @IsString()
  @IsOptional()
  targetMeaning?: string;
}

export class PlacementAssessmentAnswerDto {
  @IsString()
  promptId: string;

  @IsString()
  prompt: string;

  @IsString()
  answer: string;
}

export class PlacementAssessmentDto {
  @IsArray()
  @IsString({ each: true })
  learningGoals: string[];

  @IsArray()
  answers: PlacementAssessmentAnswerDto[];
}

export class GenerateDrillsDto {
  @IsString()
  type: 'chunk_substitution' | 'vocab_sentence_building' | 'sentence_decomposition' | 'pattern_drill';

  @IsString()
  keyword: string;

  @IsString()
  @IsOptional()
  meaning?: string;

  @IsString()
  @IsOptional()
  direction?: string;

  @IsString()
  @IsOptional()
  topicTitle?: string;

  @IsString()
  @IsOptional()
  difficulty?: string;

  @IsString()
  @IsOptional()
  kind?: string;

  @IsNumber()
  @IsOptional()
  count?: number;

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  chunks?: string[];

  @IsString()
  @IsOptional()
  sentence?: string;

  @IsString()
  @IsOptional()
  zh?: string;

  @IsBoolean()
  @IsOptional()
  generateSentence?: boolean;

  @IsBoolean()
  @IsOptional()
  generateHints?: boolean;

  @IsBoolean()
  @IsOptional()
  polish?: boolean;

  @IsNumber()
  @IsOptional()
  itemCount?: number;

  @IsArray()
  @IsOptional()
  items?: Array<{ zh?: string; en?: string; answer?: string; hint?: string }>;

  @IsObject()
  @IsOptional()
  materials?: {
    vocabs?: Array<{ id?: string; word?: string; meaning?: string }>;
    chunks?: Array<{ id?: string; text?: string; meaning?: string }>;
    patterns?: Array<{ id?: string; pattern?: string; meaning?: string }>;
  };

  @IsObject()
  @IsOptional()
  usedRefs?: {
    vocabIds?: string[];
    chunkIds?: string[];
    patternIds?: string[];
  };
}
