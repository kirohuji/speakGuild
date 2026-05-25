import { IsEnum, IsNotEmpty, IsOptional, IsString, Matches } from 'class-validator';
import { FileAssetGroup } from '@prisma/client';

export class CreateCosPolicyDto {
  @IsEnum(FileAssetGroup)
  group: FileAssetGroup;

  @IsString()
  @IsNotEmpty()
  filename: string;

  @IsOptional()
  @IsString()
  mimeType?: string;

  @IsOptional()
  @IsString()
  @Matches(/^[a-f0-9]{64}$/i, { message: 'sha256 必须是 64 位十六进制字符串' })
  sha256?: string;
}
