import { z } from 'zod';
import { apiError, apiSuccess, requestId } from '@/lib/http';
import { assertLoadTestRequest } from '@/server/load-test-auth';
import { loginWithVerifiedPhone } from '@/server/services/phone-login';

const bodySchema = z.object({ phone: z.string().min(11).max(20) });

export async function POST(request: Request) {
  const id = requestId(request);
  try {
    assertLoadTestRequest(request);
    const { phone } = bodySchema.parse(await request.json());
    const user = await loginWithVerifiedPhone(phone, request);
    return apiSuccess({ user }, id);
  } catch (error) {
    if (error instanceof z.ZodError || (error instanceof Error && error.message === 'INVALID_PHONE')) return apiError('BAD_REQUEST', '手机号格式不正确', 400, id);
    if (error instanceof Error && error.message === 'NOT_FOUND') return apiError('NOT_FOUND', 'Not found', 404, id);
    if (error instanceof Error && error.message === 'FORBIDDEN') return apiError('FORBIDDEN', '无权执行压测登录', 403, id);
    return apiError('INTERNAL_ERROR', '压测登录失败', 500, id);
  }
}
