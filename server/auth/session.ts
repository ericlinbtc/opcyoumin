import { and, eq, gt, isNull } from 'drizzle-orm';
import { cookies } from 'next/headers';
import { getDatabase } from '@/db';
import { sessions, users } from '@/db/schema';
import { getServerEnv, requireProductionEnv } from '@/lib/env';
import { signSessionToken, tokenHash, verifySessionToken } from '@/server/auth/session-token';

export { tokenHash } from '@/server/auth/session-token';

export type SessionUser = {
  id: string;
  role: 'user' | 'editor' | 'city_admin' | 'platform_admin';
};

function secret(): string {
  const env = getServerEnv();
  requireProductionEnv(env, ['SESSION_SIGNING_SECRET']);
  return env.SESSION_SIGNING_SECRET ?? 'development-session-secret-at-least-32-chars';
}

export async function createSessionToken(user: Pick<SessionUser, 'id'>, sessionId: string): Promise<string> {
  const env = getServerEnv();
  return signSessionToken({ userId: user.id, sessionId, ttlSeconds: env.SESSION_TTL_SECONDS, signingSecret: secret() });
}

export async function setSessionCookie(token: string): Promise<void> {
  const env = getServerEnv();
  const store = await cookies();
  store.set(env.SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    secure: env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: env.SESSION_TTL_SECONDS,
  });
}

export async function clearSessionCookie(): Promise<void> {
  const env = getServerEnv();
  const store = await cookies();
  store.set(env.SESSION_COOKIE_NAME, '', {
    httpOnly: true,
    secure: env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 0,
  });
}

export async function readSession(): Promise<(SessionUser & { sessionId: string }) | null> {
  const env = getServerEnv();
  const store = await cookies();
  const token = store.get(env.SESSION_COOKIE_NAME)?.value;
  if (!token) return null;
  let claims;
  try {
    claims = await verifySessionToken(token, secret());
  } catch {
    return null;
  }
  const active = await getDatabase().select({ id: users.id, role: users.role })
    .from(sessions)
    .innerJoin(users, eq(users.id, sessions.userId))
    .where(and(
      eq(sessions.id, claims.sessionId),
      eq(sessions.userId, claims.userId),
      eq(sessions.tokenHash, tokenHash(token)),
      gt(sessions.expiresAt, new Date()),
      isNull(sessions.revokedAt),
      eq(users.status, 'active'),
    ))
    .limit(1);
  if (!active[0]) return null;
  return { id: active[0].id, sessionId: claims.sessionId, role: active[0].role };
}

export async function requireSession(roles?: SessionUser['role'][]): Promise<SessionUser & { sessionId: string }> {
  const session = await readSession();
  if (!session) throw new Error('UNAUTHORIZED');
  if (roles && !roles.includes(session.role)) throw new Error('FORBIDDEN');
  return session;
}
