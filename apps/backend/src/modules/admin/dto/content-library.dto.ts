import { IsString, IsOptional, IsInt, IsArray } from 'class-validator';

class ExampleDto {
  @IsString() en: string;
  @IsString() zh: string;
  @IsOptional() @IsString() note?: string;
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
  @IsOptional() @IsString() category?: string;
  @IsOptional() @IsString() difficulty?: string;
  @IsOptional() @IsArray() examples?: ExampleDto[];
}

export class UpdateFullChunkDto {
  @IsOptional() @IsString() text?: string;
  @IsOptional() @IsString() meaning?: string;
  @IsOptional() @IsString() description?: string;
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

export class UpdateSentencePatternDto {
  @IsOptional() @IsString() pattern?: string;
  @IsOptional() @IsString() meaning?: string;
  @IsOptional() @IsString() category?: string;
  @IsOptional() @IsString() description?: string;
  @IsOptional() slots?: any;
  @IsOptional() examples?: any;
  @IsOptional() @IsString() difficulty?: string;
}
