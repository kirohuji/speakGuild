import { IsString, IsEnum, IsOptional, IsArray, IsBoolean } from 'class-validator';

export class UpdateNotificationDto {
  @IsString()
  @IsOptional()
  title?: string;

  @IsString()
  @IsOptional()
  content?: string;

  @IsEnum(['broadcast', 'targeted'])
  @IsOptional()
  type?: 'broadcast' | 'targeted';

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  targetUserIds?: string[];

  @IsOptional()
  @IsBoolean()
  isSpecial?: boolean;

  @IsOptional()
  @IsString()
  imageUrl?: string;
}
