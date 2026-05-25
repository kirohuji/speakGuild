import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class GetFeedbackDto {
  @IsString()
  @IsNotEmpty()
  questionId: string;

  @IsString()
  @IsNotEmpty()
  userAnswer: string;

  @IsOptional()
  isVoice?: boolean;
}

export class GetTeachingDto {
  @IsString()
  @IsNotEmpty()
  questionId: string;

  /** 用户当前草稿（可为空字符串，表示尚未作答） */
  @IsOptional()
  @IsString()
  userDraft?: string;
}

export class WordEnrichmentDto {
  @IsString()
  @IsNotEmpty()
  word: string;

  /** 来自 dictionaryapi.dev 的英文释义摘要（帮助 AI 生成更准确的例句） */
  @IsOptional()
  @IsString()
  englishDefinitions?: string;
}
