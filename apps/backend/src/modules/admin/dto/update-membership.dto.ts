import { IsISO8601, IsNotEmpty, IsString } from 'class-validator';

export class UpdateMembershipDto {
  @IsString()
  @IsNotEmpty()
  planId: string;

  @IsISO8601({ strict: true })
  expiredAt: string;
}
