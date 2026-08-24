import { randomUUID } from 'node:crypto';
import { eq } from 'drizzle-orm';
import { z } from 'zod';
import { getDatabase } from '@/db';
import { profiles, sessions, users } from '@/db/schema';
import { hashClientIp } from '@/lib/client-ip';
import { isSameOriginRequest } from '@/lib/csrf';
import { getPhoneEncryptionKey, getPhoneHashPepper, getServerEnv } from '@/lib/env';
import { apiError, apiSuccess, requestId } from '@/lib/http';
import { encryptPhone, hashPhone, maskPhone } from '@/lib/phone';
import { createSessionToken, setSessionCookie, tokenHash } from '@/server/auth/session';
import { verifyCode } from '@/server/auth/sms';

const bodySchema = z.object({ phone: z.string().min(11).max(20), code: z.string().regex(/^\d{6}$/) });

export async function POST(request: Request) {
  const id = requestId(request);
  if (!isSameOriginRequest(request)) return apiError('FORBIDDEN', '请求来源无效', 403, id);
  try {
    const body = bodySchema.parse(await request.json());
    const phone = await verifyCode(body.phone, body.code);
    const env = getServerEnv();
    const phoneHash = hashPhone(phone, getPhoneHashPepper(env));
    const phoneEncrypted = encryptPhone(phone, getPhoneEncryptionKey(env));
    const now = new Date();
    const expiresAt = new Date(now.getTime() + env.SESSION_TTL_SECONDS * 1000);
    const sessionId = randomUUID();
    const ipHash = hashClientIp(request.headers);
    const db = getDatabase();
    const login = await db.transaction(async (tx) => {
      const [user] = await tx.insert(users).values({
          phoneHash,
          phoneEncrypted,
          lastLoginAt: now,
        })
        .onConflictDoUpdate({
          target: users.phoneHash,
          set: { phoneEncrypted, lastLoginAt: now, updatedAt: now },
        })
        .returning({ id: users.id, role: users.role });
      if (!user) throw new Error('USER_UPSERT_FAILED');

      await tx.insert(profiles)
        .values({ userId: user.id, nickname: `游民${phone.slice(-4)}` })
        .onConflictDoNothing({ target: profiles.userId });

      const token = await createSessionToken(user, sessionId);
      await tx.insert(sessions).values({
        id: sessionId,
        userId: user.id,
        tokenHash: tokenHash(token),
        ipHash,
        userAgent: request.headers.get('user-agent')?.slice(0, 500),
        expiresAt,
      });
      return { token, user };
    });

    try {
      await setSessionCookie(login.token);
    } catch (error) {
      await db.delete(sessions).where(eq(sessions.id, sessionId));
      throw error;
    }
    return apiSuccess({ user: { id: login.user.id, role: login.user.role, phone: maskPhone(phone) } }, id);
  } catch (error) {
    if (error instanceof z.ZodError) return apiError('BAD_REQUEST', '手机号或验证码格式不正确', 400, id);
    if (error instanceof Error && error.message === 'INVALID_CODE') return apiError('INVALID_CODE', '验证码错误或已失效', 400, id);
    if (error instanceof Error && error.message.startsWith('RATE_LIMITED:')) return apiError('RATE_LIMITED', '验证失败次数过多，请稍后再试', 429, id);
    console.error(JSON.stringify({ level: 'error', event: 'sms_verify_failed', requestId: id, error: String(error) }));
    return apiError('INTERNAL_ERROR', '登录失败，请稍后再试', 500, id);
  }
}
