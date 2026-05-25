import { IsString, IsOptional, IsEnum, IsInt, IsUrl } from 'class-validator';
import { ResourceNodeType } from '@prisma/client';

export class UpdateResourceNodeDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsEnum(ResourceNodeType)
  type?: ResourceNodeType;

  @IsOptional()
  @IsString()
  region?: string;

  @IsOptional()
  @IsString()
  assetId?: string;

  @IsOptional()
  @IsUrl()
  url?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  mimeType?: string;

  @IsOptional()
  @IsInt()
  fileSize?: number;

  @IsOptional()
  @IsInt()
  sortOrder?: number;
}
