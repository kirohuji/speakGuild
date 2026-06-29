import { IsString, IsOptional, IsInt, IsBoolean, Min, Max } from 'class-validator';

/** 创建 MobileBundle */
export class CreateMobileBundleDto {
  @IsString()
  version: string;

  @IsString()
  platform: string;

  @IsOptional()
  @IsString()
  channel?: string;

  @IsOptional()
  @IsString()
  audience?: string;

  @IsOptional()
  @IsString()
  notifyPolicy?: string;

  @IsOptional()
  @IsBoolean()
  allowMajorUpgrade?: boolean;

  @IsString()
  assetId: string;

  @IsString()
  checksum: string;

  @IsOptional()
  @IsString()
  minNativeVersion?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(100)
  rolloutPercent?: number;

  @IsOptional()
  @IsBoolean()
  enabled?: boolean;

  @IsOptional()
  @IsBoolean()
  isMandatory?: boolean;

  @IsOptional()
  @IsString()
  releaseNotes?: string;
}

/** 更新 MobileBundle */
export class UpdateMobileBundleDto {
  @IsOptional()
  @IsString()
  assetId?: string;

  @IsOptional()
  @IsString()
  checksum?: string;

  @IsOptional()
  @IsString()
  audience?: string;

  @IsOptional()
  @IsString()
  notifyPolicy?: string;

  @IsOptional()
  @IsBoolean()
  allowMajorUpgrade?: boolean;

  @IsOptional()
  @IsString()
  minNativeVersion?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(100)
  rolloutPercent?: number;

  @IsOptional()
  @IsBoolean()
  enabled?: boolean;

  @IsOptional()
  @IsBoolean()
  isMandatory?: boolean;

  @IsOptional()
  @IsString()
  releaseNotes?: string;
}
