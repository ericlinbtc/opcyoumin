import { createHash } from 'node:crypto';
import { and, eq, gt, isNull } from 'drizzle-orm';
import { cookies } from 'next/headers';
import { SignJWT, jwtVerify } from 'jose';
import { getDatabase } from '@/db';
import { sessions, users } from '@/db/schema';
import { getServerEnv, requireProductionEnv } from '@/lib/env';

const SESSION_ISSUER = 'youmin-web';
const SESSION_AUDIENCE = 'youmin-session';

export type SessionUser = {
  id: string;
  role: 'user' | 'editor' | 'city_admin' | 'platform_admin';
};

function secret(): Uint8Array {
  const env = getServerEnv();
  requireProductionEnv(env, ['SESSION_SIGNING_SECRET']);
  return new TextEncoder().encode(env.SESSION_SIGNING_SECRET ?? 'development-session-secret-at-least-32-chars');
}

export function tokenHash(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

export async function createSessionToken(user: Pick<SessionUser, 'id'>, sessionId: string): Promise<string> {
  const env = getServerEnv();
  return new SignJWT({ sid: sessionId })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(user.id)
    .setIssuer(SESSION_ISSUER)
    .setAudience(SESSION_AUDIENCE)
    .setIssuedAt()
    .setExpirationTime(`${env.SESSION_TTL_SECONDS}s`)
    .sign(secret());
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
  let payload;
  try {
    ({ payload } = await jwtVerify(token, secret(), {
      algorithms: ['HS256'],
      issuer: SESSION_ISSUER,
      audience: SESSION_AUDIENCE,
    }));
  } catch {
    return null;
  }
  if (!payload.sub || typeof payload.sid !== 'string') return null;
  const active = await getDatabase().select({ id: users.id, role: users.role })
    .from(sessions)
    .innerJoin(users, eq(users.id, sessions.userId))
    .where(and(
      eq(sessions.id, payload.sid),
      eq(sessions.userId, payload.sub),
      eq(sessions.tokenHash, tokenHash(token)),
      gt(sessions.expiresAt, new Date()),
      isNull(sessions.revokedAt),
      eq(users.status, 'active'),
    ))
    .limit(1);
  if (!active[0]) return null;
  return { id: active[0].id, sessionId: payload.sid, role: active[0].role };
}

export async function requireSession(roles?: SessionUser['role'][]): Promise<SessionUser & { sessionId: string }> {
  const session = await readSession();
  if (!session) throw new Error('UNAUTHORIZED');
  if (roles && !roles.includes(session.role)) throw new Error('FORBIDDEN');
  return session;
}
