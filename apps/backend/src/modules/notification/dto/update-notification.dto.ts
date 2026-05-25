import { IsString, IsEnum, IsOptional } from 'class-validator';

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
}
