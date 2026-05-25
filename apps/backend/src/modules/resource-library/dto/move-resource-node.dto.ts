import { IsString, IsOptional, IsInt } from 'class-validator';

export class MoveResourceNodeDto {
  @IsOptional()
  @IsString()
  parentId?: string | null;

  @IsOptional()
  @IsInt()
  sortOrder?: number;
}
