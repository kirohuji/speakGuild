import { IsEnum, IsInt, IsNotEmpty, IsOptional, IsString, Matches, Min } from 'class-validator';
import { FileAssetGroup } from '@prisma/client';

export class CompleteUploadDto {
  @IsEnum(FileAssetGroup)
  group: FileAssetGroup;

  @IsString()
  @IsNotEmpty()
  key: string;

  @IsString()
  @Matches(/^[a-f0-9]{64}$/i, { message: 'sha256 必须是 64 位十六进制字符串' })
  sha256: string;

  @IsInt()
  @Min(1)
  size: number;

  @IsString()
  @IsNotEmpty()
  filename: string;

  @IsOptional()
  @IsString()
  mimeType?: string;
}
