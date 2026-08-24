import { apiError, apiSuccess, requestId } from '@/lib/http';
import { isLocalDemoMode } from '@/lib/env';
import { listPrototypeCityStats } from '@/server/repositories/prototype';

export async function GET(request: Request) {
  const id = requestId(request);
  try {
    if (isLocalDemoMode()) return apiSuccess({ connected: false, cities: [] }, id);
    return apiSuccess({ connected: true, cities: await listPrototypeCityStats() }, id);
  } catch {
    return apiError('INTERNAL_ERROR', '城市统计加载失败', 500, id);
  }
}
