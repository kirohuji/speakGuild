import { IsString, IsNotEmpty, IsOptional } from 'class-validator';

export class PracticeActionDto {
  @IsString()
  @IsNotEmpty()
  questionId: string;

  @IsString()
  @IsNotEmpty()
  actionType: string;

  @IsOptional()
  payload?: Record<string, any>;
}
