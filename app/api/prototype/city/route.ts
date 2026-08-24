import { z } from 'zod';
import { apiError, apiSuccess, requestId } from '@/lib/http';
import { isLocalDemoMode } from '@/lib/env';
import { readSession } from '@/server/auth/session';
import { getPrototypeCity } from '@/server/repositories/prototype';

export async function GET(request: Request) {
  const id = requestId(request);
  try {
    if (isLocalDemoMode()) return apiSuccess({ connected: false }, id);
    const url = new URL(request.url);
    const name = z.string().trim().min(1).max(80).parse(url.searchParams.get('name'));
    const region = z.string().trim().min(1).max(12).optional().parse(url.searchParams.get('region') ?? undefined);
    const session = await readSession();
    const city = await getPrototypeCity(name, session?.id, region);
    if (!city) return apiError('NOT_FOUND', '城市不存在', 404, id);
    return apiSuccess({ connected: true, ...city }, id);
  } catch (error) {
    if (error instanceof z.ZodError) return apiError('BAD_REQUEST', '城市参数不正确', 400, id);
    return apiError('INTERNAL_ERROR', '城市数据加载失败', 500, id);
  }
}
