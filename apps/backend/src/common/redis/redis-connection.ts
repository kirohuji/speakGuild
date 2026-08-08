export function getRedisConnectionOptions() {
  const raw = process.env.REDIS_URL?.trim() || 'redis://127.0.0.1:6379';
  const url = new URL(raw);
  const explicitDb = url.pathname && url.pathname !== '/' ? Number(url.pathname.slice(1)) : undefined;
  return {
    host: url.hostname,
    port: url.port ? Number(url.port) : 6379,
    username: url.username ? decodeURIComponent(url.username) : undefined,
    password: url.password ? decodeURIComponent(url.password) : undefined,
    // 生产环境（NODE_ENV=production）使用 db 0；本地开发默认落到 db 1，
    // 与生产队列隔离，避免本地投递的任务被生产环境的 worker 抢先消费
    // （生产库中找不到本地任务，会瞬间标记完成，导致本地任务永远排队中）。
    db: explicitDb ?? (process.env.NODE_ENV === 'production' ? 0 : 1),
  };
}
