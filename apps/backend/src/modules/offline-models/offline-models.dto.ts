import { IsIn, IsOptional, IsString, Matches, MaxLength } from 'class-validator';
export class PrepareOfflineModelDto {
  @IsString() variantId: string;
  @IsString() @Matches(/^[a-zA-Z0-9._-]{1,64}$/) version: string;
  @IsOptional() @IsString() @Matches(/^[a-zA-Z0-9._-]{1,100}$/) sourceRevision?: string;
  @IsOptional() @IsString() @MaxLength(128) importAssetId?: string;
}
export class ValidateOfflineModelDto {
  @IsIn(['unverified', 'passed', 'failed']) deviceValidation: string;
  @IsOptional() @IsString() @MaxLength(2000) validationNote?: string;
}
