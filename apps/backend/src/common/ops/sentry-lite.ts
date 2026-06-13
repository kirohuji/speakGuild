import { randomUUID } from 'node:crypto';

type SentryLiteEvent = {
  level: 'error' | 'warning' | 'info';
  message: string;
  tags?: Record<string, string | number | boolean | null | undefined>;
  extra?: Record<string, unknown>;
};

function parseDsn(dsn: string) {
  try {
    const url = new URL(dsn);
    const projectId = url.pathname.replace(/^\/+/, '').split('/').pop();
    const publicKey = url.username;
    if (!projectId || !publicKey) return null;
    return {
      endpoint: `${url.protocol}//${url.host}/api/${projectId}/envelope/?sentry_key=${publicKey}&sentry_version=7&sentry_client=manyu-lite/1.0`,
    };
  } catch {
    return null;
  }
}

export async function sendSentryLiteEvent(dsn: string | undefined, event: SentryLiteEvent) {
  if (!dsn) return;
  const parsed = parseDsn(dsn);
  if (!parsed) return;

  const eventId = randomUUID().replace(/-/g, '');
  const payload = {
    event_id: eventId,
    timestamp: new Date().toISOString(),
    platform: 'node',
    level: event.level,
    message: event.message,
    tags: event.tags,
    extra: event.extra,
  };
  const envelope = [
    JSON.stringify({ event_id: eventId, sent_at: new Date().toISOString() }),
    JSON.stringify({ type: 'event' }),
    JSON.stringify(payload),
  ].join('\n');

  await fetch(parsed.endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-sentry-envelope' },
    body: envelope,
  });
}
