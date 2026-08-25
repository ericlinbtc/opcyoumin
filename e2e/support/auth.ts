import { createHash, randomUUID } from 'node:crypto';
import type { BrowserContext } from '@playwright/test';
import { eq } from 'drizzle-orm';
import { getDatabase } from '../../db';
import { cities, cityMemberships, notifications, profiles, sessions, users } from '../../db/schema';
import { signSessionToken, tokenHash } from '../../server/auth/session-token';

export type TestRole = 'user' | 'editor' | 'city_admin' | 'platform_admin';

export async function createAuthenticatedUser(context: BrowserContext, options: {
  role?: TestRole;
  cityMemberships?: Array<{ cityId: string; role?: 'member' | 'city_admin' }>;
  nickname?: string;
} = {}) {
  const id = randomUUID();
  const sessionId = randomUUID();
  const expiresAt = new Date(Date.now() + 3_600_000);
  const role = options.role ?? 'user';
  const nickname = options.nickname ?? `自动化用户${id.slice(0, 6)}`;
  const phoneHash = createHash('sha256').update(`e2e:${id}`).digest('hex');
  await getDatabase().insert(users).values({ id, phoneHash, phoneEncrypted: `e2e:${id}`, role, createdAt: new Date(Date.now() - 172_800_000) });
  await getDatabase().insert(profiles).values({ userId: id, nickname });
  if (options.cityMemberships?.length) {
    await getDatabase().insert(cityMemberships).values(options.cityMemberships.map((membership) => ({ cityId: membership.cityId, userId: id, role: membership.role ?? 'member' })));
  }
  const signingSecret = process.env.SESSION_SIGNING_SECRET ?? 'development-session-secret-at-least-32-chars';
  const token = await signSessionToken({ userId: id, sessionId, ttlSeconds: 3600, signingSecret });
  await getDatabase().insert(sessions).values({ id: sessionId, userId: id, tokenHash: tokenHash(token), userAgent: 'Playwright authenticated fixture', expiresAt });
  await context.addCookies([{
    name: process.env.SESSION_COOKIE_NAME ?? 'youmin_session', value: token, domain: '127.0.0.1', path: '/', httpOnly: true, secure: false, sameSite: 'Lax', expires: Math.floor(expiresAt.getTime() / 1000),
  }]);
  return { id, sessionId, role, nickname };
}

export async function getSeedCity(name = '北京') {
  const [city] = await getDatabase().select({ id: cities.id, slug: cities.slug, name: cities.name }).from(cities).where(eq(cities.name, name)).limit(1);
  if (!city) throw new Error(`Seed city ${name} is missing`);
  return city;
}

export async function addNotification(userId: string, title: string) {
  const [notice] = await getDatabase().insert(notifications).values({ userId, type: 'system', title, body: '由端到端测试创建的未读通知。' }).returning({ id: notifications.id });
  return notice.id;
}
