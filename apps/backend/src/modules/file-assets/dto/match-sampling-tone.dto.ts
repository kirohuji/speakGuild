import { Type } from 'class-transformer';
import { IsNumber, IsUrl, Max, Min } from 'class-validator';

export class MatchSamplingToneDto {
  @IsUrl({ require_protocol: true, protocols: ['https'] })
  backgroundUrl: string;

  @IsUrl({ require_protocol: true, protocols: ['https'] })
  resourceUrl: string;

  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(1)
  positionX: number;

  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(1)
  positionY: number;
}
