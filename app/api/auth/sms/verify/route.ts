import { z } from 'zod';
import { isSameOriginRequest } from '@/lib/csrf';
import { apiError, apiSuccess, requestId } from '@/lib/http';
import { verifyCode } from '@/server/auth/sms';
import { loginWithVerifiedPhone } from '@/server/services/phone-login';

const bodySchema = z.object({ phone: z.string().min(11).max(20), code: z.string().regex(/^\d{6}$/) });

export async function POST(request: Request) {
  const id = requestId(request);
  if (!isSameOriginRequest(request)) return apiError('FORBIDDEN', '请求来源无效', 403, id);
  try {
    const body = bodySchema.parse(await request.json());
    const phone = await verifyCode(body.phone, body.code);
    const user = await loginWithVerifiedPhone(phone, request);
    return apiSuccess({ user }, id);
  } catch (error) {
    if (error instanceof z.ZodError) return apiError('BAD_REQUEST', '手机号或验证码格式不正确', 400, id);
    if (error instanceof Error && error.message === 'INVALID_CODE') return apiError('INVALID_CODE', '验证码错误或已失效', 400, id);
    if (error instanceof Error && error.message.startsWith('RATE_LIMITED:')) return apiError('RATE_LIMITED', '验证失败次数过多，请稍后再试', 429, id);
    console.error(JSON.stringify({ level: 'error', event: 'sms_verify_failed', requestId: id, error: String(error) }));
    return apiError('INTERNAL_ERROR', '登录失败，请稍后再试', 500, id);
  }
}
