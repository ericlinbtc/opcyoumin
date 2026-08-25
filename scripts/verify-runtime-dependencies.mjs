import Redis from 'ioredis';
import postgres from 'postgres';

const databaseUrl = process.env.DATABASE_URL;
const redisUrl = process.env.REDIS_URL;
const checks = [];

if (!databaseUrl) checks.push({ dependency: 'PostgreSQL', status: 'missing', detail: 'DATABASE_URL is not configured' });
if (!redisUrl) checks.push({ dependency: 'Redis', status: 'missing', detail: 'REDIS_URL is not configured' });

if (databaseUrl) {
  const client = postgres(databaseUrl, { max: 1, connect_timeout: 3, idle_timeout: 1 });
  try {
    const [migrationState] = await client`select to_regclass('drizzle.__drizzle_migrations')::text as migration_table`;
    const [cityState] = await client`select count(*)::int as count from cities`;
    checks.push({ dependency: 'PostgreSQL', status: migrationState.migration_table ? 'ok' : 'migration-missing', detail: `${cityState.count} seeded cities` });
  } catch (error) {
    checks.push({ dependency: 'PostgreSQL', status: 'unavailable', detail: error instanceof Error ? error.message : String(error) });
  } finally {
    await client.end({ timeout: 1 });
  }
}

if (redisUrl) {
  const redis = new Redis(redisUrl, { lazyConnect: true, connectTimeout: 3_000, maxRetriesPerRequest: 1, enableOfflineQueue: false });
  redis.on('error', () => undefined);
  try {
    await redis.connect();
    const response = await redis.ping();
    checks.push({ dependency: 'Redis', status: response === 'PONG' ? 'ok' : 'unexpected-response', detail: response });
  } catch (error) {
    checks.push({ dependency: 'Redis', status: 'unavailable', detail: error instanceof Error ? error.message : String(error) });
  } finally {
    redis.disconnect();
  }
}

console.table(checks);
if (checks.length !== 2 || checks.some((check) => check.status !== 'ok')) process.exit(1);
