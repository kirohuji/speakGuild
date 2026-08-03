import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  MaxLength,
  Max,
  Min,
} from 'class-validator';

export const CONTENT_MODES = ['practice', 'writing', 'reading', 'listening', 'novel', 'story'] as const;

export class CreatePackageGroupDto {
  @IsString()
  slug: string;

  @IsString()
  name: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  coverImage?: string;

  @IsOptional()
  @IsIn(CONTENT_MODES)
  contentMode?: typeof CONTENT_MODES[number];

  @IsOptional()
  @IsIn(['draft', 'published', 'archived'])
  status?: 'draft' | 'published' | 'archived';
}

export class UpdatePackageGroupDto {
  @IsOptional()
  @IsString()
  slug?: string;

  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  coverImage?: string;

  @IsOptional()
  @IsIn(CONTENT_MODES)
  contentMode?: typeof CONTENT_MODES[number];

  @IsOptional()
  @IsIn(['draft', 'published', 'archived'])
  status?: 'draft' | 'published' | 'archived';
}

export class AssignPackageGroupDto {
  @IsOptional()
  @IsString()
  groupId?: string | null;

  @IsOptional()
  @IsInt()
  @Min(0)
  sortOrder?: number;

  @IsOptional()
  @IsString()
  volumeLabel?: string;

  @IsOptional()
  @IsBoolean()
  requiredPrevious?: boolean;
}

export class AttachEpubDto {
  @IsString()
  assetId: string;
}

export class UpdateSceneKnowledgeDto {
  @IsArray()
  @IsString({ each: true })
  vocabularyIds: string[];

  @IsArray()
  @IsString({ each: true })
  chunkIds: string[];

  @IsArray()
  @IsString({ each: true })
  patternIds: string[];
}

export class SaveTopicSubmissionDto {
  @IsObject()
  response: Record<string, unknown>;

  @IsOptional()
  @IsIn(['draft', 'submitted', 'reviewed', 'completed'])
  status?: 'draft' | 'submitted' | 'reviewed' | 'completed';

  @IsOptional()
  @IsInt()
  @Min(1)
  revision?: number;
}

export class SaveNovelProgressDto {
  @IsObject()
  locator: Record<string, unknown>;

  @IsNumber()
  @Min(0)
  @Max(1)
  percentage: number;
}

export class GenerateWritingTopicDto {
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  instruction?: string;

  @IsOptional()
  @IsIn(['journal', 'message', 'email', 'paragraph', 'essay'])
  genre?: 'journal' | 'message' | 'email' | 'paragraph' | 'essay';

  @IsOptional()
  @IsString()
  @MaxLength(10)
  difficulty?: string;

  @IsOptional()
  @IsInt()
  @Min(20)
  @Max(2000)
  minWords?: number;

  @IsOptional()
  @IsInt()
  @Min(20)
  @Max(3000)
  maxWords?: number;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  currentTitle?: string;

  @IsOptional()
  @IsString()
  @MaxLength(4000)
  currentPromptEn?: string;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(40)
  @IsString({ each: true })
  @MaxLength(200, { each: true })
  vocabulary?: string[];

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(30)
  @IsString({ each: true })
  @MaxLength(300, { each: true })
  chunks?: string[];

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @IsString({ each: true })
  @MaxLength(300, { each: true })
  sentencePatterns?: string[];
}
