import { Type } from 'class-transformer'
import {
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator'

export class CompleteScriptPracticeDto {
  @IsIn(['vn', 'repeat'])
  mode!: 'vn' | 'repeat'

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(24 * 60 * 60)
  durationSec?: number

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(10000)
  turnCount?: number

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(10000)
  lineCount?: number

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(10000)
  usedChunkCount?: number

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(10000)
  completedObjectiveCount?: number

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(100)
  score?: number

  @IsOptional()
  resultSnapshot?: Record<string, unknown>

  @IsOptional()
  @IsString()
  audioAssetId?: string

  @IsOptional()
  @IsString()
  videoAssetId?: string
}

export class CreateScriptWorkDto {
  @IsString()
  recordId!: string

  @IsIn(['vn_video', 'repeat_video', 'progress_card'])
  kind!: 'vn_video' | 'repeat_video' | 'progress_card'

  @IsString()
  @MaxLength(80)
  title!: string

  @IsOptional()
  @IsString()
  @MaxLength(500)
  caption?: string

  @IsOptional()
  @IsString()
  videoAssetId?: string

  @IsOptional()
  @IsString()
  coverAssetId?: string
}

export class UpdateScriptWorkDto {
  @IsOptional()
  @IsString()
  @MaxLength(80)
  title?: string

  @IsOptional()
  @IsString()
  @MaxLength(500)
  caption?: string

  @IsOptional()
  @IsString()
  videoAssetId?: string

  @IsOptional()
  @IsString()
  coverAssetId?: string
}

export class ScriptReactionDto {
  @IsIn(['太棒了', '发音真自然', '剧情感拉满', '我也在练', '继续加油', '学到了'])
  reaction!: string
}

export class ScriptReportDto {
  @IsIn(['inappropriate', 'copyright', 'privacy', 'spam', 'other'])
  reason!: string

  @IsOptional()
  @IsString()
  @MaxLength(500)
  detail?: string
}
