import { IsString, IsNotEmpty, IsInt, Min, Max, IsOptional, IsArray } from 'class-validator';
import { Type } from 'class-transformer';

export class StartExamDto {
  @IsString()
  @IsNotEmpty()
  paperId: string;
}

export class SubmitExamDto {
  @IsString()
  @IsNotEmpty()
  paperId: string;

  @IsInt()
  @Min(0)
  @Max(100)
  @Type(() => Number)
  score: number;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  weakness?: string[];
}
