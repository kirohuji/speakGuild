import {
  IsString, IsOptional, IsInt, IsArray, Min, Max,
} from 'class-validator';

export class CreateSceneCategoryDto {
  @IsString()
  name: string;

  @IsOptional()
  @IsString()
  icon?: string;

  @IsOptional()
  @IsInt()
  sortOrder?: number;
}

export class UpdateSceneCategoryDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  icon?: string;

  @IsOptional()
  @IsInt()
  sortOrder?: number;
}

export class CreateSceneDto {
  @IsString()
  categoryId: string;

  @IsString()
  title: string;

  @IsString()
  location: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  requiredOutputLevel?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  requiredUserLevel?: number;
}

export class UpdateSceneDto {
  @IsOptional()
  @IsString()
  categoryId?: string;

  @IsOptional()
  @IsString()
  title?: string;

  @IsOptional()
  @IsString()
  location?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  requiredOutputLevel?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  requiredUserLevel?: number;
}

export class CreateVocabularyDto {
  @IsString()
  sceneId: string;

  @IsString()
  word: string;

  @IsString()
  meaning: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsInt()
  sortOrder?: number;
}

export class UpdateVocabularyDto {
  @IsOptional()
  @IsString()
  word?: string;

  @IsOptional()
  @IsString()
  meaning?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsInt()
  sortOrder?: number;
}

export class CreateTrainingTopicDto {
  @IsString()
  sceneId: string;

  @IsString()
  title: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsString()
  promptEn: string;

  @IsString()
  promptZh: string;

  @IsOptional()
  @IsInt()
  suggestedDurationSec?: number;

  @IsOptional()
  @IsString()
  difficulty?: string;

  @IsOptional()
  @IsString()
  sentenceSkeleton?: string;

  @IsOptional()
  sentencePatterns?: any;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  chunkIds?: string[];

  @IsOptional()
  @IsInt()
  sortOrder?: number;

  @IsOptional()
  @IsString()
  inkScriptId?: string;
}

export class UpdateTrainingTopicDto {
  @IsOptional()
  @IsString()
  sceneId?: string;

  @IsOptional()
  @IsString()
  title?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  promptEn?: string;

  @IsOptional()
  @IsString()
  promptZh?: string;

  @IsOptional()
  @IsInt()
  suggestedDurationSec?: number;

  @IsOptional()
  @IsString()
  difficulty?: string;

  @IsOptional()
  @IsString()
  sentenceSkeleton?: string;

  @IsOptional()
  sentencePatterns?: any;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  chunkIds?: string[];

  @IsOptional()
  @IsInt()
  sortOrder?: number;

  @IsOptional()
  @IsString()
  inkScriptId?: string;
}
