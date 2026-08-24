import { and, eq } from 'drizzle-orm';
import { getDatabase } from '@/db';
import { cityMemberships } from '@/db/schema';
import type { SessionUser } from '@/server/auth/session';

export async function assertCityScope(user: SessionUser, cityId: string | null): Promise<void> {
  if (user.role === 'platform_admin') return;
  if (user.role !== 'city_admin' || !cityId) throw new Error('FORBIDDEN');
  const row = await getDatabase().select({ cityId: cityMemberships.cityId }).from(cityMemberships)
    .where(and(eq(cityMemberships.userId, user.id), eq(cityMemberships.cityId, cityId), eq(cityMemberships.role, 'city_admin'))).limit(1);
  if (!row[0]) throw new Error('FORBIDDEN');
}

export async function listManagedCityIds(user: SessionUser): Promise<string[] | undefined> {
  if (user.role === 'platform_admin') return undefined;
  if (user.role !== 'city_admin') return [];
  const rows = await getDatabase().select({ cityId: cityMemberships.cityId }).from(cityMemberships).where(and(eq(cityMemberships.userId, user.id), eq(cityMemberships.role, 'city_admin')));
  return rows.map((row) => row.cityId);
}
