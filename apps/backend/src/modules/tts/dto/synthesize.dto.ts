import { IsEnum, IsIn, IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';
import { TtsProvider } from '@prisma/client';

export class SynthesizeQuestionDto {
  @IsString()
  @IsNotEmpty()
  questionId: string;

  @IsEnum(TtsProvider)
  provider: TtsProvider;

  @IsString()
  @IsNotEmpty()
  model: string;

  @IsOptional()
  @IsString()
  voiceId?: string;

  @IsOptional()
  params?: Record<string, unknown>;

  /** 合成哪部分：question = 题干（promptEn），answer = 答案（answerEn）；默认 answer */
  @IsOptional()
  @IsIn(['question', 'answer'])
  textType?: 'question' | 'answer';
}

export class SynthesizeTextDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(800)
  text: string;

  @IsEnum(TtsProvider)
  provider: TtsProvider;

  @IsString()
  @IsNotEmpty()
  model: string;

  @IsOptional()
  @IsString()
  voiceId?: string;

  @IsOptional()
  params?: Record<string, unknown>;

  @IsOptional()
  @IsString()
  apiKey?: string;

  @IsOptional()
  @IsString()
  baseUrl?: string;

  @IsOptional()
  @IsString()
  groupId?: string;
}

export class SynthesizeAssetDto extends SynthesizeTextDto {
  @IsOptional()
  @IsString()
  bizType?: string;

  @IsOptional()
  @IsString()
  bizId?: string;
}

/** Free ENTTS synthesis shared by dictionary examples and authored dialogue. */
export class SynthesizeEnttsAssetDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(2_000)
  text: string;

  @IsOptional()
  @IsIn(['uk', 'us'])
  accent?: 'uk' | 'us';

  @IsOptional()
  @IsIn(['female', 'male'])
  gender?: 'female' | 'male';

  @IsOptional()
  @IsString()
  bizType?: string;

  @IsOptional()
  @IsString()
  bizId?: string;
}
