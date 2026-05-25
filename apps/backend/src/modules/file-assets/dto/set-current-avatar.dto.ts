import { IsNotEmpty, IsString } from 'class-validator';

export class SetCurrentAvatarDto {
  @IsString()
  @IsNotEmpty()
  assetId: string;
}
