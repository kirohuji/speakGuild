import { IsISO8601, IsOptional, IsString, Matches, MaxLength } from 'class-validator';

export class CheckInDto {
  // An ownership assertion only; the authenticated session always supplies the acting user.
  @IsOptional()
  @IsString()
  @MaxLength(128)
  ownerId?: string;

  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  date?: string;

  @IsOptional()
  @IsISO8601()
  occurredAt?: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  timeZone?: string;

  @IsOptional()
  @IsString()
  @MaxLength(128)
  clientMutationId?: string;
}
