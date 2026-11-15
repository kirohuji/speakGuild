import { Body, Controller, ForbiddenException, Param, Post, Req } from '@nestjs/common';
import { IsIn } from 'class-validator';
import type { Request } from 'express';
import { requireAuthSession } from '../auth/session.util';
import { InsightContentService } from './insight-content.service';

export class RegenerateInsightDto {
  @IsIn(['description', 'examples']) field!: 'description' | 'examples';
}

@Controller('admin/insight-content')
export class InsightContentController {
  constructor(private readonly service: InsightContentService) {}

  @Post(':kind/:id/regenerate')
  async regenerate(@Req() req: Request, @Param('kind') kind: string, @Param('id') id: string, @Body() input: RegenerateInsightDto) {
    const session = await requireAuthSession(req);
    if (session.user.role !== 'admin') throw new ForbiddenException('仅管理员可以重新生成内容');
    return this.service.regenerate(kind, id, input.field, session.user.id);
  }
}
