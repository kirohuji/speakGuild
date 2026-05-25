import { IsNotEmpty, IsString } from 'class-validator';

export class DeleteReferenceDto {
  @IsString()
  @IsNotEmpty()
  assetId: string;

  @IsString()
  @IsNotEmpty()
  bizType: string;

  @IsString()
  @IsNotEmpty()
  bizId: string;
}
