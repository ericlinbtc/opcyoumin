import { hostname } from 'node:os';
import { apiSuccess, requestId } from '@/lib/http';

export const dynamic = 'force-dynamic';

export function GET(request: Request) {
  const release = process.env.RELEASE_SHA ?? 'unknown';
  const instance = process.env.SAE_INSTANCE_ID ?? hostname();
  return apiSuccess({ status: 'ok', service: 'youmin-web', release, instance, timestamp: new Date().toISOString() }, requestId(request), {
    headers: { 'x-release-sha': release, 'x-instance-id': instance, 'cache-control': 'no-store' },
  });
}
