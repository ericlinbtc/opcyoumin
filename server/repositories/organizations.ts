import { cache } from 'react';
import { and, desc, eq, ilike, sql } from 'drizzle-orm';
import { getDatabase } from '@/db';
import { cities, organizationApplications, organizationMemberships, organizations, profiles, users } from '@/db/schema';
import { demoOrganizations } from '@/features/catalog/organizations';
import { isLocalDemoMode } from '@/lib/env';

export type PublicOrganization = {
  id: string;
  cityId: string;
  citySlug: string;
  city: string;
  name: string;
  category: string;
  summary: string;
  location: string;
  memberCount: number;
  membershipRole: string | null;
  applicationId: string | null;
  applicationStatus: string | null;
};

export async function listPublicOrganizations(options: { cityId?: string; query?: string; limit?: number; offset?: number; viewerId?: string } = {}): Promise<PublicOrganization[]> {
  const query = options.query?.trim() ?? '';
  if (isLocalDemoMode()) {
    return demoOrganizations
      .filter((item) => (!options.cityId || item.cityId === options.cityId) && (!query || `${item.name}${item.category}${item.city}`.includes(query)))
      .slice(options.offset ?? 0, (options.offset ?? 0) + (options.limit ?? 24))
      .map((item) => ({ ...item, membershipRole: null, applicationId: null, applicationStatus: null }));
  }
  const db = getDatabase();
  const viewerId = options.viewerId;
  return db.select({
    id: organizations.id,
    cityId: organizations.cityId,
    citySlug: cities.slug,
    city: cities.name,
    name: organizations.name,
    category: organizations.category,
    summary: organizations.summary,
    location: organizations.location,
    memberCount: organizations.memberCount,
    membershipRole: viewerId ? sql<string | null>`(select ${organizationMemberships.role} from ${organizationMemberships} where ${organizationMemberships.organizationId} = ${organizations.id} and ${organizationMemberships.userId} = ${viewerId} limit 1)` : sql<null>`null`,
    applicationId: viewerId ? sql<string | null>`(select ${organizationApplications.id} from ${organizationApplications} where ${organizationApplications.organizationId} = ${organizations.id} and ${organizationApplications.userId} = ${viewerId} order by ${organizationApplications.createdAt} desc limit 1)` : sql<null>`null`,
    applicationStatus: viewerId ? sql<string | null>`(select ${organizationApplications.status}::text from ${organizationApplications} where ${organizationApplications.organizationId} = ${organizations.id} and ${organizationApplications.userId} = ${viewerId} order by ${organizationApplications.createdAt} desc limit 1)` : sql<null>`null`,
  }).from(organizations).innerJoin(cities, eq(cities.id, organizations.cityId))
    .where(and(eq(organizations.status, 'published'), options.cityId ? eq(organizations.cityId, options.cityId) : undefined, query ? ilike(organizations.name, `%${query}%`) : undefined))
    .orderBy(desc(organizations.memberCount), organizations.name)
    .limit(Math.min(options.limit ?? 24, 100)).offset(Math.max(options.offset ?? 0, 0));
}

export const getPublicOrganization = cache(async (id: string, viewerId?: string): Promise<PublicOrganization | null> => {
  if (isLocalDemoMode()) {
    const item = demoOrganizations.find((organization) => organization.id === id);
    return item ? { ...item, membershipRole: null, applicationId: null, applicationStatus: null } : null;
  }
  const db = getDatabase();
  const rows = await db.select({
    id: organizations.id,
    cityId: organizations.cityId,
    citySlug: cities.slug,
    city: cities.name,
    name: organizations.name,
    category: organizations.category,
    summary: organizations.summary,
    location: organizations.location,
    memberCount: organizations.memberCount,
    membershipRole: viewerId ? sql<string | null>`(select ${organizationMemberships.role} from ${organizationMemberships} where ${organizationMemberships.organizationId} = ${organizations.id} and ${organizationMemberships.userId} = ${viewerId} limit 1)` : sql<null>`null`,
    applicationId: viewerId ? sql<string | null>`(select ${organizationApplications.id} from ${organizationApplications} where ${organizationApplications.organizationId} = ${organizations.id} and ${organizationApplications.userId} = ${viewerId} order by ${organizationApplications.createdAt} desc limit 1)` : sql<null>`null`,
    applicationStatus: viewerId ? sql<string | null>`(select ${organizationApplications.status}::text from ${organizationApplications} where ${organizationApplications.organizationId} = ${organizations.id} and ${organizationApplications.userId} = ${viewerId} order by ${organizationApplications.createdAt} desc limit 1)` : sql<null>`null`,
  }).from(organizations).innerJoin(cities, eq(cities.id, organizations.cityId))
    .where(and(eq(organizations.id, id), eq(organizations.status, 'published'))).limit(1);
  return rows[0] ?? null;
});

export async function listOrganizationMembers(organizationId: string, limit = 50) {
  if (isLocalDemoMode()) return [];
  return getDatabase().select({ id: users.id, nickname: profiles.nickname, role: organizationMemberships.role, joinedAt: organizationMemberships.joinedAt })
    .from(organizationMemberships).innerJoin(users, eq(users.id, organizationMemberships.userId)).innerJoin(profiles, eq(profiles.userId, users.id))
    .where(and(eq(organizationMemberships.organizationId, organizationId), eq(users.status, 'active'))).orderBy(desc(organizationMemberships.joinedAt)).limit(Math.min(limit, 100));
}
