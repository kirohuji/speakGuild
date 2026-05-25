import { IsString, IsNotEmpty } from 'class-validator';

export class BindConfigDto {
  @IsString()
  @IsNotEmpty()
  province: string;

  @IsString()
  @IsNotEmpty()
  language: string;

  @IsString()
  @IsNotEmpty()
  examType: string;

  @IsString()
  @IsNotEmpty()
  interviewForm: string;
}
