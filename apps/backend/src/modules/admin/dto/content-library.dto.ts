import { IsString, IsOptional, IsInt, IsArray, IsIn, MaxLength, ArrayMinSize } from 'class-validator';

class ExampleDto {
  @IsString() en: string;
  @IsString() zh: string;
  @IsOptional() @IsString() note?: string;
  @IsOptional() @IsString() audioUrl?: string;
  @IsOptional() @IsString() level?: string;
}

// ─── Vocabulary ─────────────────────────────────────────────

export class CreateFullVocabularyDto {
  @IsString() word: string;
  @IsString() meaning: string;
  @IsOptional() @IsString() partOfSpeech?: string;
  @IsOptional() @IsString() phoneticUs?: string;
  @IsOptional() @IsString() phoneticUk?: string;
  @IsOptional() @IsString() audioUsUrl?: string;
  @IsOptional() @IsString() audioUkUrl?: string;
  @IsOptional() @IsString() definitionEn?: string;
  @IsOptional() @IsArray() @IsString({ each: true }) synonyms?: string[];
  @IsOptional() @IsArray() @IsString({ each: true }) tags?: string[];
  @IsOptional() @IsArray() examples?: ExampleDto[];
  @IsOptional() @IsString() description?: string;
  @IsOptional() @IsString() difficulty?: string;
  @IsOptional() @IsInt() sortOrder?: number;
}

export class UpdateFullVocabularyDto {
  @IsOptional() @IsString() word?: string;
  @IsOptional() @IsString() meaning?: string;
  @IsOptional() @IsString() partOfSpeech?: string;
  @IsOptional() @IsString() phoneticUs?: string;
  @IsOptional() @IsString() phoneticUk?: string;
  @IsOptional() @IsString() audioUsUrl?: string;
  @IsOptional() @IsString() audioUkUrl?: string;
  @IsOptional() @IsString() definitionEn?: string;
  @IsOptional() @IsArray() @IsString({ each: true }) synonyms?: string[];
  @IsOptional() @IsArray() @IsString({ each: true }) tags?: string[];
  @IsOptional() @IsArray() examples?: ExampleDto[];
  @IsOptional() @IsString() description?: string;
  @IsOptional() @IsString() difficulty?: string;
  @IsOptional() @IsInt() sortOrder?: number;
}

// ─── Chunk ───────────────────────────────────────────────────

export class CreateFullChunkDto {
  @IsString() text: string;
  @IsString() meaning: string;
  @IsOptional() @IsString() description?: string;
  @IsOptional() @IsString() audioUrl?: string;
  @IsOptional() @IsString() category?: string;
  @IsOptional() @IsString() difficulty?: string;
  @IsOptional() @IsArray() examples?: ExampleDto[];
}

export class UpdateFullChunkDto {
  @IsOptional() @IsString() text?: string;
  @IsOptional() @IsString() meaning?: string;
  @IsOptional() @IsString() description?: string;
  @IsOptional() @IsString() audioUrl?: string;
  @IsOptional() @IsString() category?: string;
  @IsOptional() @IsString() difficulty?: string;
  @IsOptional() @IsArray() examples?: ExampleDto[];
}

// ─── Sentence Pattern ────────────────────────────────────────

export class CreateSentencePatternDto {
  @IsString() pattern: string;
  @IsOptional() @IsString() meaning?: string;
  @IsOptional() @IsString() category?: string;
  @IsOptional() @IsString() description?: string;
  @IsOptional() slots?: any;
  @IsOptional() examples?: any;
  @IsOptional() @IsString() difficulty?: string;
}

/** 内容库批量任务使用的词汇筛选，与列表接口同一套条件。 */
export class LibraryVocabularyScopeDto {
  @IsOptional() @IsString() @MaxLength(200) search?: string;
  @IsOptional() @IsIn(['fuzzy', 'exact']) matchType?: 'fuzzy' | 'exact';
  @IsOptional() @IsString() @MaxLength(8) difficulty?: string;
  @IsOptional() @IsIn(['missing-phonetic', 'missing-audio', 'incomplete']) pronunciationStatus?: 'missing-phonetic' | 'missing-audio' | 'incomplete';
  @IsOptional() @IsIn(['meaning-other', 'english-only-definition', 'missing-pos-prefix']) qualityIssue?: 'meaning-other' | 'english-only-definition' | 'missing-pos-prefix';
  @IsOptional() @IsString() @MaxLength(64) tag?: string;
  @IsOptional() @IsString() @MaxLength(64) sceneId?: string;
  @IsOptional() @IsString() @MaxLength(64) topicId?: string;
}

/** 句块 / 句式批量任务使用的筛选，与各自列表接口同一套条件。 */
export class LibraryTextScopeDto {
  @IsOptional() @IsString() @MaxLength(200) search?: string;
  @IsOptional() @IsString() @MaxLength(8) difficulty?: string;
  @IsOptional() @IsString() @MaxLength(64) sceneId?: string;
  @IsOptional() @IsString() @MaxLength(64) topicId?: string;
}

export class LibraryVocabularyFieldBatchDto extends LibraryVocabularyScopeDto {
  @IsIn(['fill', 'regenerate']) mode!: 'fill' | 'regenerate';
  @IsArray() @ArrayMinSize(1) @IsIn(['meaning', 'description', 'examples', 'definition', 'pronunciation', 'difficulty'], { each: true })
  fields!: Array<'meaning' | 'description' | 'examples' | 'definition' | 'pronunciation' | 'difficulty'>;
}

export class LibraryTextFieldBatchDto extends LibraryTextScopeDto {
  @IsIn(['fill', 'regenerate']) mode!: 'fill' | 'regenerate';
  @IsArray() @ArrayMinSize(1) @IsIn(['meaning', 'description', 'examples'], { each: true })
  fields!: Array<'meaning' | 'description' | 'examples'>;
}

export class UpdateSentencePatternDto {
  @IsOptional() @IsString() pattern?: string;
  @IsOptional() @IsString() meaning?: string;
  @IsOptional() @IsString() category?: string;
  @IsOptional() @IsString() description?: string;
  @IsOptional() slots?: any;
  @IsOptional() examples?: any;
  @IsOptional() @IsString() difficulty?: string;
}
