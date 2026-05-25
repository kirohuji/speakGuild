import { IsString, IsOptional, IsBoolean } from 'class-validator';

/** 提交录音转写 */
export class SubmitRecordingDto {
  @IsString()
  topicId: string;

  @IsString()
  userTranscript: string;

  @IsOptional()
  @IsString()
  audioUrl?: string;
}

/** 获取 AI 纠错反馈 */
export class GetEnglishFeedbackDto {
  @IsString()
  topicId: string;

  @IsString()
  userTranscript: string;

  @IsString()
  @IsOptional()
  promptEn?: string;

  @IsString()
  @IsOptional()
  outputLevel?: string;
}

/** 提交复述 */
export class SubmitRetellDto {
  @IsString()
  topicId: string;

  @IsString()
  userTranscript: string;

  @IsString()
  targetText: string;
}

/** 保存到表达库 */
export class SaveExpressionDto {
  @IsString()
  type: 'chunk' | 'error_sentence' | 'upgraded' | 'scene_phrase';

  @IsString()
  @IsOptional()
  original?: string;

  @IsString()
  @IsOptional()
  corrected?: string;

  @IsString()
  @IsOptional()
  chunkText?: string;

  @IsString()
  @IsOptional()
  sceneName?: string;
}
