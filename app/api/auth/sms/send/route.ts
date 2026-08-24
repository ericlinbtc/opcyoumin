import { z } from 'zod';
import { hashClientIp } from '@/lib/client-ip';
import { isSameOriginRequest } from '@/lib/csrf';
import { apiError, apiSuccess, requestId } from '@/lib/http';
import { sendVerificationCode } from '@/server/auth/sms';

const bodySchema = z.object({ phone: z.string().min(11).max(20) });

export async function POST(request: Request) {
  const id = requestId(request);
  if (!isSameOriginRequest(request)) return apiError('FORBIDDEN', '请求来源无效', 403, id);
  try {
    const body = bodySchema.parse(await request.json());
    const ipHash = hashClientIp(request.headers);
    const result = await sendVerificationCode(body.phone, ipHash);
    return apiSuccess(result, id, { status: 202 });
  } catch (error) {
    if (error instanceof z.ZodError || (error instanceof Error && error.message === 'INVALID_PHONE')) {
      return apiError('BAD_REQUEST', '请输入有效的中国内地手机号', 400, id);
    }
    if (error instanceof Error && error.message.startsWith('RATE_LIMITED:')) {
      const retryAfter = Number(error.message.split(':')[1] ?? 60);
      return apiError('RATE_LIMITED', '请求过于频繁，请稍后再试', 429, id, { retryAfter });
    }
    console.error(JSON.stringify({ level: 'error', event: 'sms_send_failed', requestId: id, error: String(error) }));
    return apiError('SMS_SEND_FAILED', '验证码发送失败，请稍后再试', 502, id);
  }
}
