import Redis from 'ioredis';
import { getServerEnv, requireProductionEnv } from '@/lib/env';

let redis: Redis | undefined;

export function getRedis(): Redis {
  const env = getServerEnv();
  requireProductionEnv(env, ['REDIS_URL']);
  if (!env.REDIS_URL) throw new Error('REDIS_URL is not configured');
  redis ??= new Redis(env.REDIS_URL, {
    lazyConnect: true,
    enableOfflineQueue: false,
    maxRetriesPerRequest: 1,
  });
  return redis;
}

export async function checkRedis(): Promise<void> {
  const client = await getReadyRedis();
  await client.ping();
}

export async function getReadyRedis(): Promise<Redis> {
  const client = getRedis();
  if (client.status === 'wait') await client.connect();
  if (client.status === 'connecting' || client.status === 'reconnecting') {
    await new Promise<void>((resolve, reject) => {
      const ready = () => { cleanup(); resolve(); };
      const failed = (error: Error) => { cleanup(); reject(error); };
      const cleanup = () => { client.off('ready', ready); client.off('error', failed); };
      client.once('ready', ready);
      client.once('error', failed);
    });
  }
  if (client.status !== 'ready') throw new Error(`REDIS_NOT_READY:${client.status}`);
  return client;
}
