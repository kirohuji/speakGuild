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

export const PRONUNCIATION_AUDIT_FILTERS = ['all', 'missing', 'noncanonical', 'invalid'] as const;
export type PronunciationAuditFilter = (typeof PRONUNCIATION_AUDIT_FILTERS)[number];

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

  @IsOptional()
  @IsIn(PRONUNCIATION_AUDIT_FILTERS)
  filter: PronunciationAuditFilter = 'all';
}

export class RefreshPronunciationDto {
  @IsIn(PRONUNCIATION_PROVIDERS)
  provider!: PronunciationProvider;

  @IsIn(PRONUNCIATION_SCOPES)
  scope: PronunciationScope = 'all';
}

export class ManualPronunciationDto {
  @IsIn(['uk', 'us'])
  type!: 'uk' | 'us';

  @IsString()
  @MaxLength(200)
  @Transform(({ value }) => typeof value === 'string' ? value.trim() : value)
  ipa!: string;
}

export class NormalizePronunciationDto {
  @IsIn(['uk', 'us'])
  type!: 'uk' | 'us';
}

export class GeneratePronunciationAudioDto {
  @IsIn(['uk', 'us'])
  type!: 'uk' | 'us';

  @IsOptional()
  @IsIn(['female', 'male'])
  gender: 'female' | 'male' = 'female';
}

export class ClearPronunciationQueryDto {
  @IsIn(PRONUNCIATION_SCOPES)
  scope: PronunciationScope = 'all';
}
