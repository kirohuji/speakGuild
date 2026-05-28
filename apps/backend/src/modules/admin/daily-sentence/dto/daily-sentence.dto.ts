import { IsString, IsOptional, IsNumber, IsDateString, MinLength } from 'class-validator';

export class CreateDailySentenceDto {
  @IsDateString()
  date: string;

  @IsString()
  @MinLength(1)
  quote: string;

  @IsString()
  @MinLength(1)
  translation: string;

  @IsOptional()
  @IsString()
  author?: string;

  @IsOptional()
  @IsNumber()
  sortOrder?: number;
}

export class UpdateDailySentenceDto {
  @IsOptional()
  @IsDateString()
  date?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  quote?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  translation?: string;

  @IsOptional()
  @IsString()
  author?: string;

  @IsOptional()
  @IsNumber()
  sortOrder?: number;
}
