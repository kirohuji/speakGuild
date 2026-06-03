import { IsOptional, IsString, IsBoolean, MaxLength } from 'class-validator';

export class UpdateUserProfileDto {
  @IsString()
  @MaxLength(30)
  @IsOptional()
  name?: string;

  @IsString()
  @MaxLength(30)
  @IsOptional()
  username?: string;

  @IsBoolean()
  @IsOptional()
  hasCompletedOnboarding?: boolean;
}
