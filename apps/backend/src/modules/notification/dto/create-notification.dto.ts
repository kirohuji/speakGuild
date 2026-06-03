import { IsString, IsEnum, IsArray, IsOptional, IsBoolean, IsUrl } from 'class-validator';

export class CreateNotificationDto {
  @IsString()
  title: string;

  @IsString()
  content: string;

  @IsEnum(['broadcast', 'targeted'])
  type: 'broadcast' | 'targeted';

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  targetUserIds?: string[];

  @IsOptional()
  @IsBoolean()
  isSpecial?: boolean;

  @IsOptional()
  @IsString()
  imageUrl?: string;
}
