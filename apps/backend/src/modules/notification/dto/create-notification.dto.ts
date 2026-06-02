import { IsString, IsEnum, IsArray, IsOptional, IsBoolean } from 'class-validator';

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
}
