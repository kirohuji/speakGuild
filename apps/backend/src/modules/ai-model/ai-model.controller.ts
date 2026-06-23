import { Controller, Get, Put, Param, Body, Req, ForbiddenException } from '@nestjs/common';
import type { Request } from 'express';
import { AiModelService, type UpdateAiProviderDto } from './ai-model.service';
import { requireAuthSession } from '../auth/session.util';

@Controller('admin/ai-models')
export class AiModelController {
  constructor(private readonly aiModelService: AiModelService) {}

  private async requireAdmin(req: Request) {
    const session = await requireAuthSession(req);
    if ((session.user as any)?.role !== 'admin') {
      throw new ForbiddenException('需要管理员权限');
    }
    return session;
  }

  /** 获取按类型分组的所有供应商 */
  @Get()
  async listGrouped(@Req() req: Request) {
    await this.requireAdmin(req);
    return this.aiModelService.listGrouped();
  }

  /** 更新某个供应商配置 */
  @Put(':id')
  async update(
    @Req() req: Request,
    @Param('id') id: string,
    @Body() dto: UpdateAiProviderDto,
  ) {
    await this.requireAdmin(req);
    return this.aiModelService.update(id, dto);
  }

  /** 激活某个供应商 */
  @Put(':id/activate')
  async activate(@Req() req: Request, @Param('id') id: string) {
    await this.requireAdmin(req);
    return this.aiModelService.activate(id);
  }
}
