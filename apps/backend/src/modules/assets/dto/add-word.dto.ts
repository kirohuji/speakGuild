import { IsString, IsNotEmpty, IsOptional } from 'class-validator';

export class AddWordDto {
  @IsString()
  @IsNotEmpty()
  term: string;

  @IsOptional()
  @IsString()
  definition?: string;

  @IsOptional()
  @IsString()
  sourceQuestionId?: string;
}
