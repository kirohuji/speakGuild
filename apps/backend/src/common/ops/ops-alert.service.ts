import { Injectable, Logger } from '@nestjs/common';
import { sendSentryLiteEvent } from './sentry-lite';

type AlertSeverity = 'info' | 'warning' | 'critical';

@Injectable()
export class OpsAlertService {
  private readonly logger = new Logger(OpsAlertService.name);
  private readonly lastSentAt = new Map<string, number>();

  async notify(params: {
    key: string;
    title: string;
    severity?: AlertSeverity;
    details?: Record<string, unknown>;
    throttleSeconds?: number;
  }) {
    const severity = params.severity ?? 'warning';
    const throttleSeconds = params.throttleSeconds ?? Number(process.env.OPS_ALERT_MIN_INTERVAL_SECONDS || 300);
    const now = Date.now();
    const lastSentAt = this.lastSentAt.get(params.key) ?? 0;
    if (now - lastSentAt < throttleSeconds * 1000) return;
    this.lastSentAt.set(params.key, now);

    const payload = {
      title: params.title,
      severity,
      service: process.env.OPS_SERVICE_NAME || 'manyu-backend',
      environment: process.env.NODE_ENV || 'development',
      occurredAt: new Date().toISOString(),
      details: params.details ?? {},
    };

    await Promise.allSettled([
      this.sendWebhook(payload),
      sendSentryLiteEvent(process.env.SENTRY_DSN, {
        level: severity === 'critical' ? 'error' : severity,
        message: params.title,
        tags: {
          service: payload.service,
          environment: payload.environment,
          severity,
        },
        extra: payload.details,
      }),
    ]);
  }

  private async sendWebhook(payload: Record<string, unknown>) {
    const url = process.env.OPS_ALERT_WEBHOOK_URL?.trim();
    if (!url) return;

    try {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      const authorization = process.env.OPS_ALERT_WEBHOOK_AUTHORIZATION?.trim();
      if (authorization) headers.Authorization = authorization;
      const response = await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify(payload),
      });
      if (!response.ok) {
        this.logger.warn(`Ops alert webhook failed: ${response.status}`);
      }
    } catch (error) {
      this.logger.warn(`Ops alert webhook error: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
}
