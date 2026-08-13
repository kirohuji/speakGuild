import {
  IsString, IsOptional, IsInt, IsArray, Min, Max, IsIn, IsBoolean,
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

  @IsOptional()
  @IsIn(['practice', 'writing', 'reading', 'listening', 'novel', 'story'])
  contentMode?: 'practice' | 'writing' | 'reading' | 'listening' | 'novel' | 'story';

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

  @IsOptional()
  @IsBoolean()
  isFree?: boolean;

  @IsOptional()
  @IsString()
  coverImage?: string;
}

export class UpdateSceneDto {
  @IsOptional()
  @IsString()
  categoryId?: string;

  @IsOptional()
  @IsIn(['daily', 'exam', 'story', 'course', 'foundation'])
  packageType?: 'daily' | 'exam' | 'story' | 'course' | 'foundation';

  @IsOptional()
  @IsIn(['practice', 'writing', 'reading', 'listening', 'novel', 'story'])
  contentMode?: 'practice' | 'writing' | 'reading' | 'listening' | 'novel' | 'story';

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

  @IsOptional()
  @IsBoolean()
  isFree?: boolean;

  @IsOptional()
  @IsString()
  coverImage?: string;
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

  @IsOptional()
  @IsIn(['practice', 'writing', 'reading', 'listening'])
  activityType?: 'practice' | 'writing' | 'reading' | 'listening';

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
  contentConfig?: any;

  @IsOptional()
  @IsString()
  mediaAssetId?: string;

  @IsOptional()
  transcript?: any;

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

  /** 存在引用冲突时仍保存：冲突材料降级为 review（复习复用），不作为新学目标 */
  @IsOptional()
  @IsBoolean()
  forceReview?: boolean;

  /** 覆盖冲突认领：移除当前组内原包/话题的材料关联，改由当前话题作为新学目标认领 */
  @IsOptional()
  @IsBoolean()
  forceOverride?: boolean;
}

export class UpdateTrainingTopicDto {
  @IsOptional()
  @IsString()
  sceneId?: string;

  @IsOptional()
  @IsIn(['daily', 'ielts'])
  type?: 'daily' | 'ielts';

  @IsOptional()
  @IsIn(['practice', 'writing', 'reading', 'listening'])
  activityType?: 'practice' | 'writing' | 'reading' | 'listening';

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
  contentConfig?: any;

  @IsOptional()
  @IsString()
  mediaAssetId?: string;

  @IsOptional()
  transcript?: any;

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

  /** 存在引用冲突时仍保存：冲突材料降级为 review（复习复用），不作为新学目标 */
  @IsOptional()
  @IsBoolean()
  forceReview?: boolean;

  /** 覆盖冲突认领：移除当前组内原包/话题的材料关联，改由当前话题作为新学目标认领 */
  @IsOptional()
  @IsBoolean()
  forceOverride?: boolean;
}

/** 根据已绑句型/句块推荐搭配词汇 */
export class SuggestTopicVocabsDto {
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  patternIds?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  chunkIds?: string[];

  @IsOptional()
  @IsString()
  difficulty?: string;

  @IsOptional()
  @IsString()
  teachingMarkdown?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(20)
  count?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(20)
  extensionCount?: number;
}

/** 根据教学文档和当前已选材料，判断是否需要补充句型或 Chunk */
export class SuggestTopicSupportsDto {
  @IsIn(['pattern', 'chunk'])
  kind: 'pattern' | 'chunk';

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
  @IsString()
  difficulty?: string;

  @IsOptional()
  @IsString()
  teachingMarkdown?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(12)
  count?: number;
}
