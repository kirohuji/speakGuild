import { IsArray, IsBoolean, IsNumber, IsObject, IsOptional, IsString } from 'class-validator';

export class EnglishFeedbackDto {
  @IsString()
  userTranscript: string;

  @IsString()
  @IsOptional()
  promptEn?: string;

  @IsString()
  @IsOptional()
  sceneTitle?: string;

  @IsString()
  @IsOptional()
  topicTitle?: string;

  @IsString()
  @IsOptional()
  outputLevel?: string;
}

export class EnglishUpgradeDto {
  @IsString()
  userTranscript: string;

  @IsString()
  @IsOptional()
  outputLevel?: string;
}

export class DialogueSummaryDto {
  @IsString()
  topicId: string;

  @IsString()
  topicTitle: string;

  @IsString()
  promptEn: string;

  @IsOptional()
  objectives?: string[];

  @IsOptional()
  coreChunks?: string[];

  @IsOptional()
  dialogues?: Array<{
    round: number;
    npcText: string;
    userText: string;
    isOnTopic?: boolean;
    objectivesCompleted?: string[];
    chunksUsed?: string[];
    grammarIssues?: any;
  }>;
}

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
