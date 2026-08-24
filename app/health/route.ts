import { apiSuccess, requestId } from '@/lib/http';

export const dynamic = 'force-dynamic';

export function GET(request: Request) {
  return apiSuccess({ status: 'ok', service: 'youmin-web', timestamp: new Date().toISOString() }, requestId(request));
}
