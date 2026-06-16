import { IsArray, IsBoolean, IsNumber, IsObject, IsOptional, IsString } from 'class-validator';

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

  @IsString()
  @IsOptional()
  mode?: string; // 'communicative' | 'targeted_output'

  @IsArray()
  @IsOptional()
  requiredChunks?: string[];

  @IsArray()
  @IsOptional()
  targetWords?: string[];

  @IsArray()
  @IsOptional()
  essentialSlots?: string[];

  @IsBoolean()
  @IsOptional()
  allowParaphrase?: boolean;
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

export class PlacementAssessmentAnswerDto {
  @IsString()
  promptId: string;

  @IsString()
  prompt: string;

  @IsString()
  answer: string;
}

export class PlacementAssessmentDto {
  @IsArray()
  @IsString({ each: true })
  learningGoals: string[];

  @IsArray()
  answers: PlacementAssessmentAnswerDto[];
}
