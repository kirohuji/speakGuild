export function getRedisConnectionOptions() {
  const raw = process.env.REDIS_URL?.trim() || 'redis://127.0.0.1:6379';
  const url = new URL(raw);
  return {
    host: url.hostname,
    port: url.port ? Number(url.port) : 6379,
    username: url.username ? decodeURIComponent(url.username) : undefined,
    password: url.password ? decodeURIComponent(url.password) : undefined,
    db: url.pathname && url.pathname !== '/' ? Number(url.pathname.slice(1)) : undefined,
  };
}
