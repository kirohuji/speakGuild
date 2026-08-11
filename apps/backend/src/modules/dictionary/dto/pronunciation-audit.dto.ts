import { Transform, Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString, MaxLength, Min } from 'class-validator';

export const PRONUNCIATION_PROVIDERS = [
  'auto',
  'wiktionary',
  'freedictionaryapi',
  'dictionaryapi.dev',
  'datamuse',
  'ai_verify',
] as const;
export type PronunciationProvider = (typeof PRONUNCIATION_PROVIDERS)[number];

export const PRONUNCIATION_SCOPES = ['all', 'uk', 'us'] as const;
export type PronunciationScope = (typeof PRONUNCIATION_SCOPES)[number];

export class PronunciationAuditQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page = 1;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  @Transform(({ value }) => typeof value === 'string' ? value.trim() : value)
  search?: string;
}

export class RefreshPronunciationDto {
  @IsIn(PRONUNCIATION_PROVIDERS)
  provider!: PronunciationProvider;

  @IsIn(PRONUNCIATION_SCOPES)
  scope: PronunciationScope = 'all';
}

export class ClearPronunciationQueryDto {
  @IsIn(PRONUNCIATION_SCOPES)
  scope: PronunciationScope = 'all';
}
