import { randomUUID } from 'node:crypto';
import { eq } from 'drizzle-orm';
import { getDatabase } from '@/db';
import { profiles, sessions, users } from '@/db/schema';
import { hashClientIp } from '@/lib/client-ip';
import { getPhoneEncryptionKey, getPhoneHashPepper, getServerEnv } from '@/lib/env';
import { encryptPhone, hashPhone, maskPhone, normalizePhone } from '@/lib/phone';
import { createSessionToken, setSessionCookie, tokenHash } from '@/server/auth/session';

export async function loginWithVerifiedPhone(phoneValue: string, request: Request) {
  const phone = normalizePhone(phoneValue);
  const env = getServerEnv();
  const phoneHash = hashPhone(phone, getPhoneHashPepper(env));
  const phoneEncrypted = encryptPhone(phone, getPhoneEncryptionKey(env));
  const now = new Date();
  const expiresAt = new Date(now.getTime() + env.SESSION_TTL_SECONDS * 1000);
  const sessionId = randomUUID();
  const ipHash = hashClientIp(request.headers);
  const db = getDatabase();
  const login = await db.transaction(async (tx) => {
    const [user] = await tx.insert(users).values({ phoneHash, phoneEncrypted, lastLoginAt: now })
      .onConflictDoUpdate({ target: users.phoneHash, set: { phoneEncrypted, lastLoginAt: now, updatedAt: now } })
      .returning({ id: users.id, role: users.role });
    if (!user) throw new Error('USER_UPSERT_FAILED');
    await tx.insert(profiles).values({ userId: user.id, nickname: `游民${phone.slice(-4)}` }).onConflictDoNothing({ target: profiles.userId });
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
  return { id: login.user.id, role: login.user.role, phone: maskPhone(phone) };
}
