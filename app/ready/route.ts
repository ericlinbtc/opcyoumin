import { checkDatabase } from '@/db';
import { apiError, apiSuccess, requestId } from '@/lib/http';
import { checkRedis } from '@/server/redis';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const id = requestId(request);
  const checks = await Promise.allSettled([checkDatabase(), checkRedis()]);
  const database = checks[0].status === 'fulfilled';
  const redis = checks[1].status === 'fulfilled';
  if (!database || !redis) {
    return apiError('INTERNAL_ERROR', 'Service dependencies are not ready', 503, id, { database, redis });
  }
  return apiSuccess({ status: 'ready', database, redis }, id);
}
