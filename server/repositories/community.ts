import 'server-only';

import { and, desc, eq, ilike, sql } from 'drizzle-orm';
import { getDatabase } from '@/db';
import { activities, cities, cityMemberships, follows, posts, profiles, registrations, users } from '@/db/schema';
import { demoPosts } from '@/features/catalog/content';
import { isLocalDemoMode } from '@/lib/env';

export async function listCityMembers(cityId: string, options: { query?: string; limit?: number; offset?: number } = {}) {
  if (isLocalDemoMode()) {
    const seen = new Set<string>();
    return demoPosts.filter((post) => !seen.has(post.authorId) && seen.add(post.authorId)).map((post) => ({ id: post.authorId, name: post.author, bio: 'OPC 实践者', occupationTags: ['OPC'], role: 'member', joinedAt: new Date('2026-01-01'), postCount: 1, followerCount: 0 }));
  }
  const query = options.query?.trim();
  return getDatabase().select({
    id: users.id,
    name: profiles.nickname,
    bio: profiles.bio,
    occupationTags: profiles.occupationTags,
    role: cityMemberships.role,
    joinedAt: cityMemberships.joinedAt,
    postCount: sql<number>`(select count(*) from ${posts} where ${posts.authorId} = ${users.id} and ${posts.cityId} = ${cityId} and ${posts.status} = 'published')::int`,
    followerCount: sql<number>`(select count(*) from ${follows} where ${follows.followingId} = ${users.id})::int`,
  }).from(cityMemberships).innerJoin(users, eq(users.id, cityMemberships.userId)).innerJoin(profiles, eq(profiles.userId, users.id))
    .where(and(eq(cityMemberships.cityId, cityId), eq(users.status, 'active'), query ? ilike(profiles.nickname, `%${query}%`) : undefined))
    .orderBy(desc(cityMemberships.joinedAt)).limit(Math.min(options.limit ?? 20, 100)).offset(Math.max(options.offset ?? 0, 0));
}

export async function getPublicMemberRelations(userId: string) {
  if (isLocalDemoMode()) return { followerCount: 0, followingCount: 0, cities: [], participatedActivities: [], organizedActivities: [] };
  const db = getDatabase();
  const [followers, following, joinedCities, participatedActivities, organizedActivities] = await Promise.all([
    db.select({ value: sql<number>`count(*)::int` }).from(follows).where(eq(follows.followingId, userId)),
    db.select({ value: sql<number>`count(*)::int` }).from(follows).where(eq(follows.followerId, userId)),
    db.select({ id: cities.id, slug: cities.slug, name: cities.name, role: cityMemberships.role }).from(cityMemberships).innerJoin(cities, eq(cities.id, cityMemberships.cityId)).where(eq(cityMemberships.userId, userId)).orderBy(cities.name).limit(50),
    db.select({ id: activities.id, title: activities.title, startsAt: activities.startsAt, status: registrations.status }).from(registrations).innerJoin(activities, eq(activities.id, registrations.activityId)).where(and(eq(registrations.userId, userId), sql`${registrations.status} in ('attended', 'registered')`, sql`${activities.status} in ('published', 'ended')`)).orderBy(desc(activities.startsAt)).limit(12),
    db.select({ id: activities.id, title: activities.title, startsAt: activities.startsAt, status: activities.status }).from(activities).where(and(eq(activities.organizerId, userId), sql`${activities.status} in ('published', 'ended')`)).orderBy(desc(activities.startsAt)).limit(12),
  ]);
  return { followerCount: followers[0]?.value ?? 0, followingCount: following[0]?.value ?? 0, cities: joinedCities, participatedActivities, organizedActivities };
}
