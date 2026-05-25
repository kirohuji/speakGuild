import { IsString, IsOptional } from 'class-validator';

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
