import { IsBoolean, IsOptional, IsString } from 'class-validator';

export class UpdateUserOtaTestDto {
  @IsOptional()
  @IsBoolean()
  enabled?: boolean;

  @IsOptional()
  @IsString()
  channel?: string;

  @IsOptional()
  @IsString()
  platform?: string;

  @IsOptional()
  @IsString()
  targetReleaseLine?: string;

  @IsOptional()
  @IsString()
  targetVersion?: string;

  @IsOptional()
  @IsString()
  notes?: string;
}
