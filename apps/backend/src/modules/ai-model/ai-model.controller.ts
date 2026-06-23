import { Controller, Delete, Get, Put, Post, Param, Body, Req, ForbiddenException } from '@nestjs/common';
import type { Request } from 'express';
import { AiModelService, type CreateAiProviderDto, type UpdateAiProviderDto } from './ai-model.service';
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
  @Post()
  async create(@Req() req: Request, @Body() dto: CreateAiProviderDto) {
    await this.requireAdmin(req);
    return this.aiModelService.create(dto);
  }

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
  @Delete(':id')
  async remove(@Req() req: Request, @Param('id') id: string) {
    await this.requireAdmin(req);
    return this.aiModelService.remove(id);
  }

  @Put(':id/activate')
  async activate(@Req() req: Request, @Param('id') id: string) {
    await this.requireAdmin(req);
    return this.aiModelService.activate(id);
  }

  @Post(':id/test-llm')
  async testLlm(
    @Req() req: Request,
    @Param('id') id: string,
    @Body('prompt') prompt?: string,
  ) {
    await this.requireAdmin(req);
    return this.aiModelService.testLlmProvider(id, prompt ?? '');
  }
}
