import { IsArray, IsBoolean, IsIn, IsObject, IsOptional, IsString, MaxLength } from 'class-validator';

export class UpdateUserProfileDto {
  @IsString()
  @MaxLength(30)
  @IsOptional()
  name?: string;

  @IsString()
  @MaxLength(30)
  @IsOptional()
  username?: string;

  @IsBoolean()
  @IsOptional()
  hasCompletedOnboarding?: boolean;

  @IsIn(['L1', 'L2', 'L3', 'L4', 'L5'])
  @IsOptional()
  outputLevel?: string;

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  learningGoals?: string[];

  @IsObject()
  @IsOptional()
  outputLevelDetail?: Record<string, unknown>;
}
