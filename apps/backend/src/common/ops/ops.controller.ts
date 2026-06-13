import { Body, Controller, Get, Post } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { OpsAlertService } from './ops-alert.service';

@Controller()
export class OpsController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly alerts: OpsAlertService,
  ) {}

  @Get('health')
  async health() {
    const startedAt = Date.now();
    await this.prisma.$queryRaw`SELECT 1`;
    return {
      ok: true,
      database: 'ok',
      latencyMs: Date.now() - startedAt,
      checkedAt: new Date().toISOString(),
    };
  }

  @Post('client-errors')
  async clientError(@Body() body: {
    message?: string;
    stack?: string;
    source?: string;
    route?: string;
    userAgent?: string;
  }) {
    await this.alerts.notify({
      key: `client-error:${body.message || 'unknown'}`,
      title: `前端错误: ${body.message || 'unknown'}`,
      severity: 'warning',
      details: {
        source: body.source,
        route: body.route,
        userAgent: body.userAgent,
        stack: body.stack,
      },
    });
    return { success: true };
  }
}
