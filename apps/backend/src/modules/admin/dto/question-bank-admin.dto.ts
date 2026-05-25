import {
  IsString, IsOptional, IsInt, IsArray, Min, Max,
} from 'class-validator';
import { Type } from 'class-transformer';

// ─── Question Bank ──────────────────────────────────────────

export class CreateQuestionBankDto {
  @IsString()
  name: string;

  @IsString()
  province: string;

  @IsString()
  language: string;

  @IsString()
  examType: string;

  @IsString()
  interviewForm: string;

  @IsOptional()
  @IsString()
  status?: string;
}

export class UpdateQuestionBankDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  province?: string;

  @IsOptional()
  @IsString()
  language?: string;

  @IsOptional()
  @IsString()
  examType?: string;

  @IsOptional()
  @IsString()
  interviewForm?: string;

  @IsOptional()
  @IsString()
  status?: string;
}

// ─── Topic ──────────────────────────────────────────────────

export class CreateTopicDto {
  @IsString()
  bankId: string;

  @IsString()
  code: string;

  @IsString()
  name: string;

  @IsOptional()
  @IsInt()
  @Type(() => Number)
  sortOrder?: number;
}

export class UpdateTopicDto {
  @IsOptional()
  @IsString()
  code?: string;

  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsInt()
  @Type(() => Number)
  sortOrder?: number;
}

// ─── Question Item ──────────────────────────────────────────

export class CreateQuestionDto {
  @IsString()
  topicId: string;

  @IsString()
  title: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(5)
  @Type(() => Number)
  difficulty?: number;

  @IsOptional()
  @IsInt()
  @Type(() => Number)
  suggestedDurationSec?: number;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  keywords?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  focusWords?: string[];

  // Content
  @IsOptional()
  @IsString()
  promptEn?: string;

  @IsOptional()
  @IsString()
  promptZh?: string;

  @IsOptional()
  @IsString()
  answerEn?: string;

  @IsOptional()
  @IsString()
  answerZh?: string;

  @IsOptional()
  @IsString()
  summary?: string;
}

export class UpdateQuestionDto {
  @IsOptional()
  @IsString()
  title?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(5)
  @Type(() => Number)
  difficulty?: number;

  @IsOptional()
  @IsInt()
  @Type(() => Number)
  suggestedDurationSec?: number;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  keywords?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  focusWords?: string[];

  // Content
  @IsOptional()
  @IsString()
  promptEn?: string;

  @IsOptional()
  @IsString()
  promptZh?: string;

  @IsOptional()
  @IsString()
  answerEn?: string;

  @IsOptional()
  @IsString()
  answerZh?: string;

  @IsOptional()
  @IsString()
  summary?: string;
}

// ─── Query ──────────────────────────────────────────────────

export class QuestionQueryDto {
  @IsOptional()
  @IsString()
  bankId?: string;

  @IsOptional()
  @IsString()
  topicId?: string;

  @IsOptional()
  @IsString()
  keyword?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  pageSize?: number = 20;
}
