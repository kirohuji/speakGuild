import { IsArray, IsBoolean, IsNumber, IsObject, IsOptional, IsString } from 'class-validator';

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

/** 提交练习对话记录 */
export class SubmitPracticeDialogueDto {
  @IsString()
  npcText: string;

  @IsString()
  @IsOptional()
  userText?: string;

  @IsOptional()
  round?: number;

  @IsOptional()
  @IsBoolean()
  isOnTopic?: boolean;

  @IsOptional()
  objectivesCompleted?: string[];

  @IsOptional()
  chunksUsed?: string[];

  @IsOptional()
  grammarIssues?: any;
}

export class CreatePracticeSessionDto {
  @IsString()
  topicId: string;
}

export class SubmitPracticeTurnDto {
  @IsNumber()
  @IsOptional()
  round?: number;

  @IsString()
  npcText: string;

  @IsString()
  userText: string;

  @IsString()
  @IsOptional()
  userAudioUrl?: string;

  @IsString()
  @IsOptional()
  inputNodeId?: string;

  @IsArray()
  @IsOptional()
  tags?: string[];

  @IsObject()
  @IsOptional()
  judgement?: any;

  @IsArray()
  @IsOptional()
  objectivesCompleted?: string[];

  @IsArray()
  @IsOptional()
  chunksUsed?: string[];

  @IsBoolean()
  @IsOptional()
  isRetry?: boolean;

  @IsString()
  @IsOptional()
  parentTurnId?: string;
}
