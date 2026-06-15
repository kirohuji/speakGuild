import {
  IsString, IsOptional, IsInt, IsArray, Min, Max, IsIn,
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

  @IsOptional()
  @IsIn(['daily', 'exam', 'story', 'course', 'foundation'])
  packageType?: 'daily' | 'exam' | 'story' | 'course' | 'foundation';

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
  @IsIn(['daily', 'exam', 'story', 'course', 'foundation'])
  packageType?: 'daily' | 'exam' | 'story' | 'course' | 'foundation';

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

  @IsOptional()
  @IsIn(['daily', 'ielts'])
  type?: 'daily' | 'ielts';

  @IsString()
  title: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  teachingMarkdown?: string;

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
  metadata?: any;

  @IsOptional()
  @IsArray()
  sentencePatterns?: any[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  patternIds?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  chunkIds?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  vocabIds?: string[];

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
  @IsIn(['daily', 'ielts'])
  type?: 'daily' | 'ielts';

  @IsOptional()
  @IsString()
  title?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  teachingMarkdown?: string;

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
  metadata?: any;

  @IsOptional()
  @IsArray()
  sentencePatterns?: any[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  patternIds?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  chunkIds?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  vocabIds?: string[];

  @IsOptional()
  @IsInt()
  sortOrder?: number;

  @IsOptional()
  @IsString()
  inkScriptId?: string;
}
