import { IsOptional, IsBoolean } from 'class-validator';
import { Transform } from 'class-transformer';
import { PaginationDto } from '../../../common/dto/pagination.dto';

/** 安全地将查询字符串 'true'/'false' 转为 boolean */
function transformBoolean(value: unknown): boolean | undefined {
  if (value === 'true' || value === true) return true;
  if (value === 'false' || value === false) return false;
  return undefined;
}

export class QueryNotificationDto extends PaginationDto {
  @IsOptional()
  @Transform(({ value }) => transformBoolean(value))
  @IsBoolean()
  isRead?: boolean;
}
