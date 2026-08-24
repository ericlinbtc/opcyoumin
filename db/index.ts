import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { getServerEnv, requireProductionEnv } from '@/lib/env';
import * as schema from './schema';

let queryClient: ReturnType<typeof postgres> | undefined;

export function getDatabase() {
  const env = getServerEnv();
  requireProductionEnv(env, ['DATABASE_URL']);
  if (!env.DATABASE_URL) throw new Error('DATABASE_URL is not configured');
  queryClient ??= postgres(env.DATABASE_URL, {
    max: 10,
    idle_timeout: 20,
    connect_timeout: 10,
    prepare: false,
  });
  return drizzle(queryClient, { schema });
}

export async function checkDatabase(): Promise<void> {
  const env = getServerEnv();
  if (!env.DATABASE_URL) throw new Error('DATABASE_URL is not configured');
  const client = postgres(env.DATABASE_URL, { max: 1, connect_timeout: 2, idle_timeout: 1 });
  try {
    await client`select 1`;
  } finally {
    await client.end({ timeout: 1 });
  }
}
