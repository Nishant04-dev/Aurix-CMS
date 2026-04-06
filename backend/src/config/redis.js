// Redis is optional — only initialised when REDIS_ENABLED=true
// Falls back gracefully so the server never crashes without Redis

let redis = null;
let redisAvailable = false;

if (process.env.REDIS_ENABLED === 'true' && process.env.REDIS_URL) {
  try {
    const { default: Redis } = await import('ioredis');
    redis = new Redis(process.env.REDIS_URL, {
      maxRetriesPerRequest: null,
      enableReadyCheck: false,
      lazyConnect: true,
      retryStrategy: (times) => (times > 3 ? null : Math.min(times * 500, 2000)),
    });
    redis.on('connect', () => { redisAvailable = true; });
    redis.on('error',   () => { redisAvailable = false; });
    redis.on('close',   () => { redisAvailable = false; });
  } catch {
    redis = null;
    redisAvailable = false;
  }
}

export { redis, redisAvailable };
