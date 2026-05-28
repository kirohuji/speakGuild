import { IsString, IsOptional, IsBoolean, IsNumber, IsObject, Min, Max } from 'class-validator';

export class CreateThemePresetDto {
  @IsString()
  name: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsNumber()
  sortOrder?: number;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsBoolean()
  isDefault?: boolean;

  @IsOptional()
  @IsString()
  bgType?: string;

  // Light mode
  @IsOptional()
  @IsObject()
  lightColors?: Record<string, string>;

  @IsOptional()
  @IsString()
  lightBackground?: string;

  @IsOptional()
  lightDecorations?: any;

  // Dark mode
  @IsOptional()
  @IsObject()
  darkColors?: Record<string, string>;

  @IsOptional()
  @IsString()
  darkBackground?: string;

  @IsOptional()
  darkDecorations?: any;

  // BGM
  @IsOptional()
  @IsString()
  bgmUrl?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(1)
  bgmVolume?: number;
}

export class UpdateThemePresetDto extends CreateThemePresetDto {}
