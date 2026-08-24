import { apiError, apiSuccess, requestId } from '@/lib/http';
import { isLocalDemoMode } from '@/lib/env';
import { readSession } from '@/server/auth/session';
import { getPrototypeAccount } from '@/server/repositories/prototype';

export async function GET(request: Request) {
  const id = requestId(request);
  if (isLocalDemoMode()) return apiSuccess({ connected: false }, id);
  const session = await readSession();
  if (!session) return apiError('UNAUTHORIZED', '请先登录', 401, id);
  const account = await getPrototypeAccount(session.id);
  if (!account) return apiError('NOT_FOUND', '账号资料不存在', 404, id);
  return apiSuccess({ connected: true, userId: session.id, ...account }, id);
}
