import { cache } from 'react';
import { and, desc, eq, ilike, sql } from 'drizzle-orm';
import { getDatabase } from '@/db';
import { activities, cities, cityMemberships, comments, follows, insights, knowledgeArticles, media, polls, pollVotes, posts, profiles, reactions, registrations, saves, userBlocks, users } from '@/db/schema';
import { publicCities } from '@/features/catalog/cities';
import { demoActivities, demoInsights, demoKnowledge, demoPosts } from '@/features/catalog/content';
import { isLocalDemoMode } from '@/lib/env';
import { getMediaPublicBaseUrl } from '@/lib/env';

export type CityListItem = { id: string; slug: string; name: string; regionCode: string; memberCount: number; activityCount: number };
export type PublicPost = { id: string; authorId: string; author: string; city: string; title: string; body: string; topics?: string[]; publishedAt?: Date | null; replies: number; reactions?: number; saves?: number; shares?: number };
export type PublicComment = { id: string; parentId: string | null; authorId: string; author: string; content: string; createdAt: Date };
export type PublicMedia = { id: string; kind: string; url: string; mimeType: string; width: number | null; height: number | null };
export type PublicPoll = { id: string; question: string; options: Array<{ id: string; label: string; votes: number }>; closesAt: Date | null; viewerVoted: boolean };
export type PublicActivity = { id: string; cityId: string; city: string; organizerId: string; organizer: string; title: string; summary: string; details: string; date: string; startsAt: string; endsAt: string; location: string; capacity: number; registered: number; status: string };
export type PublicArticle = { slug: string; category: string; title: string; summary: string; body?: string; author?: string | null; sourceName?: string | null; sourceUrl?: string | null; factCheckedAt?: Date | null; updatedAt?: Date };
export type PublicInsight = PublicArticle & { importance: number; date: string };
export type PublicMember = { id: string; name: string; avatarUrl?: string; bio: string; occupationTags: string[]; posts: PublicPost[] };

function titleFromBody(body: string): string {
  const firstLine = body.split(/\n+/)[0].trim();
  return firstLine.length > 42 ? `${firstLine.slice(0, 42)}…` : firstLine;
}

export const listPublicCities = cache(async (query = ''): Promise<CityListItem[]> => {
  if (isLocalDemoMode()) {
    return publicCities
      .filter((city) => !query || city.name.includes(query))
      .map((city) => ({ ...city, id: city.slug }));
  }
  const db = getDatabase();
  const rows = await db.select({
    id: cities.id,
    slug: cities.slug,
    name: cities.name,
    regionCode: cities.regionCode,
    memberCount: cities.memberCount,
    activityCount: sql<number>`(select count(*) from ${activities} where ${activities.cityId} = ${cities.id} and ${activities.status} = 'published' and ${activities.startsAt} >= now())::int`,
  }).from(cities).where(query ? ilike(cities.name, `%${query}%`) : undefined).orderBy(cities.regionCode, cities.name);
  return rows;
});

export const getPublicCity = cache(async (slug: string): Promise<CityListItem | null> => {
  if (isLocalDemoMode()) {
    const city = publicCities.find((item) => item.slug === slug);
    return city ? { ...city, id: city.slug } : null;
  }
  const rows = await getDatabase().select({
    id: cities.id,
    slug: cities.slug,
    name: cities.name,
    regionCode: cities.regionCode,
    memberCount: cities.memberCount,
    activityCount: sql<number>`(select count(*) from ${activities} where ${activities.cityId} = ${cities.id} and ${activities.status} = 'published' and ${activities.startsAt} >= now())::int`,
  }).from(cities).where(eq(cities.slug, slug)).limit(1);
  return rows[0] ?? null;
});

export const listCityPosts = cache(async (cityId: string, cityName: string, viewerId?: string, options: { topic?: string; limit?: number; offset?: number } = {}): Promise<PublicPost[]> => {
  if (isLocalDemoMode()) return demoPosts.slice(options.offset ?? 0, (options.offset ?? 0) + (options.limit ?? 20)).map((post) => ({ ...post, topics: [] }));
  const rows = await getDatabase().select({
    id: posts.id,
    authorId: posts.authorId,
    author: profiles.nickname,
    body: posts.content,
    topics: posts.topics,
    publishedAt: posts.publishedAt,
    replies: posts.commentCount,
    reactions: posts.reactionCount,
    saves: posts.saveCount,
    shares: posts.shareCount,
  }).from(posts)
    .innerJoin(users, eq(users.id, posts.authorId))
    .innerJoin(profiles, eq(profiles.userId, users.id))
    .where(and(eq(posts.cityId, cityId), eq(posts.status, 'published'), options.topic ? sql`${options.topic} = any(${posts.topics})` : undefined, viewerId ? sql`not exists (select 1 from ${userBlocks} where ${userBlocks.blockerId} = ${viewerId} and ${userBlocks.blockedId} = ${posts.authorId})` : undefined))
    .orderBy(desc(posts.publishedAt))
    .limit(Math.min(options.limit ?? 20, 100)).offset(Math.max(options.offset ?? 0, 0));
  return rows.map((post) => ({ ...post, city: cityName, title: titleFromBody(post.body) }));
});

export const listPostComments = cache(async (postId: string): Promise<PublicComment[]> => {
  if (isLocalDemoMode()) return [];
  return getDatabase().select({ id: comments.id, parentId: comments.parentId, authorId: comments.authorId, author: profiles.nickname, content: comments.content, createdAt: comments.createdAt })
    .from(comments)
    .innerJoin(profiles, eq(profiles.userId, comments.authorId))
    .where(and(eq(comments.postId, postId), eq(comments.status, 'published')))
    .orderBy(comments.createdAt)
    .limit(200);
});

export const listPublicPostMedia = cache(async (postId: string): Promise<PublicMedia[]> => {
  if (isLocalDemoMode()) return [];
  const baseUrl = getMediaPublicBaseUrl();
  const rows = await getDatabase().select({ id: media.id, kind: media.kind, publicKey: media.publicKey, mimeType: media.mimeType, width: media.width, height: media.height }).from(media).where(and(eq(media.postId, postId), eq(media.status, 'approved'))).orderBy(media.createdAt);
  return rows.filter((row) => row.publicKey).map(({ publicKey, ...row }) => ({ ...row, url: `${baseUrl}/${publicKey!.split('/').map(encodeURIComponent).join('/')}` }));
});

export async function getPublicPostPoll(postId: string, viewerId?: string): Promise<PublicPoll | null> {
  if (isLocalDemoMode()) return null;
  const [poll] = await getDatabase().select({ id: polls.id, question: polls.question, options: polls.options, closesAt: polls.closesAt }).from(polls).where(eq(polls.postId, postId)).limit(1);
  if (!poll) return null;
  const vote = viewerId ? await getDatabase().select({ pollId: pollVotes.pollId }).from(pollVotes).where(and(eq(pollVotes.pollId, poll.id), eq(pollVotes.userId, viewerId))).limit(1) : [];
  return { ...poll, viewerVoted: vote.length > 0 };
}

export async function getPostViewerState(userId: string, postId: string): Promise<{ reacted: boolean; saved: boolean }> {
  const db = getDatabase();
  const [reaction, saved] = await Promise.all([
    db.select({ postId: reactions.postId }).from(reactions).where(and(eq(reactions.userId, userId), eq(reactions.postId, postId))).limit(1),
    db.select({ postId: saves.postId }).from(saves).where(and(eq(saves.userId, userId), eq(saves.postId, postId))).limit(1),
  ]);
  return { reacted: reaction.length > 0, saved: saved.length > 0 };
}

export async function isCityMember(userId: string, cityId: string): Promise<boolean> {
  const row = await getDatabase().select({ cityId: cityMemberships.cityId }).from(cityMemberships).where(and(eq(cityMemberships.userId, userId), eq(cityMemberships.cityId, cityId))).limit(1);
  return row.length > 0;
}

export async function isFollowing(userId: string, memberId: string): Promise<boolean> {
  const row = await getDatabase().select({ followingId: follows.followingId }).from(follows).where(and(eq(follows.followerId, userId), eq(follows.followingId, memberId))).limit(1);
  return row.length > 0;
}

export async function isBlocked(userId: string, memberId: string): Promise<boolean> {
  const row = await getDatabase().select({ blockedId: userBlocks.blockedId }).from(userBlocks).where(and(eq(userBlocks.blockerId, userId), eq(userBlocks.blockedId, memberId))).limit(1);
  return row.length > 0;
}

export async function isRegisteredForActivity(userId: string, activityId: string): Promise<boolean> {
  const row = await getDatabase().select({ status: registrations.status }).from(registrations).where(and(eq(registrations.userId, userId), eq(registrations.activityId, activityId), eq(registrations.status, 'registered'))).limit(1);
  return row.length > 0;
}

export const getPublicPost = cache(async (id: string): Promise<PublicPost | null> => {
  if (isLocalDemoMode()) return demoPosts.find((item) => item.id === id) ?? null;
  const rows = await getDatabase().select({
    id: posts.id,
    authorId: posts.authorId,
    author: profiles.nickname,
    city: cities.name,
    body: posts.content,
    topics: posts.topics,
    publishedAt: posts.publishedAt,
    replies: posts.commentCount,
    reactions: posts.reactionCount,
    saves: posts.saveCount,
    shares: posts.shareCount,
  }).from(posts)
    .innerJoin(users, eq(users.id, posts.authorId))
    .innerJoin(profiles, eq(profiles.userId, users.id))
    .leftJoin(cities, eq(cities.id, posts.cityId))
    .where(and(eq(posts.id, id), eq(posts.status, 'published')))
    .limit(1);
  const post = rows[0];
  return post ? { ...post, city: post.city ?? '全国', title: titleFromBody(post.body) } : null;
});

export const listPublicActivities = cache(async (cityId?: string): Promise<PublicActivity[]> => {
  if (isLocalDemoMode()) return demoActivities.filter((item) => !cityId || item.cityId === cityId).map((item) => ({ ...item }));
  const rows = await getDatabase().select({
    id: activities.id,
    cityId: activities.cityId,
    city: cities.name,
    organizerId: activities.organizerId,
    organizer: profiles.nickname,
    title: activities.title,
    summary: activities.summary,
    details: activities.details,
    startsAt: activities.startsAt,
    endsAt: activities.endsAt,
    location: activities.location,
    capacity: activities.capacity,
    registered: activities.registrationCount,
    status: activities.status,
  }).from(activities).innerJoin(cities, eq(cities.id, activities.cityId)).innerJoin(profiles, eq(profiles.userId, activities.organizerId))
    .where(and(eq(activities.status, 'published'), cityId ? eq(activities.cityId, cityId) : undefined)).orderBy(activities.startsAt).limit(100);
  return rows.map(({ startsAt, endsAt, ...item }) => ({ ...item, date: startsAt.toISOString().slice(0, 10), startsAt: startsAt.toISOString(), endsAt: endsAt.toISOString() }));
});

export const getPublicActivity = cache(async (id: string): Promise<PublicActivity | null> => {
  if (isLocalDemoMode()) return demoActivities.find((item) => item.id === id) ?? null;
  const rows = await getDatabase().select({
    id: activities.id, cityId: activities.cityId, city: cities.name, organizerId: activities.organizerId, organizer: profiles.nickname,
    title: activities.title, summary: activities.summary, details: activities.details, startsAt: activities.startsAt, endsAt: activities.endsAt,
    location: activities.location, capacity: activities.capacity, registered: activities.registrationCount, status: activities.status,
  }).from(activities).innerJoin(cities, eq(cities.id, activities.cityId)).innerJoin(profiles, eq(profiles.userId, activities.organizerId))
    .where(and(eq(activities.id, id), sql`${activities.status} in ('published', 'cancelled', 'ended')`)).limit(1);
  const item = rows[0];
  return item ? { ...item, date: item.startsAt.toISOString().slice(0, 10), startsAt: item.startsAt.toISOString(), endsAt: item.endsAt.toISOString() } : null;
});

export async function listActivityParticipants(activityId: string) {
  if (isLocalDemoMode()) return [];
  return getDatabase().select({ userId: registrations.userId, nickname: profiles.nickname, status: registrations.status, registeredAt: registrations.registeredAt, attendanceMarkedAt: registrations.attendanceMarkedAt })
    .from(registrations).innerJoin(profiles, eq(profiles.userId, registrations.userId))
    .where(eq(registrations.activityId, activityId)).orderBy(registrations.registeredAt).limit(500);
}

export const listKnowledge = cache(async (): Promise<PublicArticle[]> => {
  if (isLocalDemoMode()) return demoKnowledge.map((item) => ({ ...item }));
  return getDatabase().select({ slug: knowledgeArticles.slug, category: knowledgeArticles.category, title: knowledgeArticles.title, summary: knowledgeArticles.summary, body: knowledgeArticles.body, author: profiles.nickname, sourceName: knowledgeArticles.sourceName, sourceUrl: knowledgeArticles.sourceUrl, factCheckedAt: knowledgeArticles.factCheckedAt, updatedAt: knowledgeArticles.updatedAt })
    .from(knowledgeArticles).leftJoin(profiles, eq(profiles.userId, knowledgeArticles.authorId)).where(eq(knowledgeArticles.status, 'published')).orderBy(desc(knowledgeArticles.publishedAt)).limit(100);
});

export const getKnowledge = cache(async (slug: string): Promise<PublicArticle | null> => {
  const items = await listKnowledge();
  return items.find((item) => item.slug === slug) ?? null;
});

export const listInsights = cache(async (): Promise<PublicInsight[]> => {
  if (isLocalDemoMode()) return demoInsights.map((item) => ({ ...item }));
  const rows = await getDatabase().select({ slug: insights.slug, category: insights.category, title: insights.title, summary: insights.summary, body: insights.body, author: profiles.nickname, sourceName: insights.sourceName, sourceUrl: insights.sourceUrl, factCheckedAt: insights.factCheckedAt, updatedAt: insights.updatedAt, importance: insights.importance, publishedAt: insights.publishedAt })
    .from(insights).leftJoin(profiles, eq(profiles.userId, insights.authorId)).where(eq(insights.status, 'published')).orderBy(desc(insights.publishedAt)).limit(100);
  return rows.map(({ publishedAt, ...item }) => ({ ...item, date: publishedAt?.toISOString().slice(0, 10) ?? '' }));
});

export const getInsight = cache(async (slug: string): Promise<PublicInsight | null> => {
  const items = await listInsights();
  return items.find((item) => item.slug === slug) ?? null;
});

export const getPublicMember = cache(async (id: string, limit = 20, offset = 0): Promise<PublicMember | null> => {
  if (isLocalDemoMode()) {
    const memberPosts = demoPosts.filter((item) => item.authorId === id).slice(offset, offset + limit).map((item) => ({ ...item }));
    const name = memberPosts[0]?.author;
    return name ? { id, name, bio: '独立创作者 · OPC 实践者', occupationTags: ['OPC', '独立创作'], posts: memberPosts } : null;
  }
  const db = getDatabase();
  const members = await db.select({ id: users.id, name: profiles.nickname, avatarKey: profiles.avatarKey, bio: profiles.bio, occupationTags: profiles.occupationTags })
    .from(users).innerJoin(profiles, eq(profiles.userId, users.id)).where(and(eq(users.id, id), eq(users.status, 'active'))).limit(1);
  const member = members[0];
  if (!member) return null;
  const memberPosts = await db.select({ id: posts.id, body: posts.content, replies: posts.commentCount, city: cities.name })
    .from(posts).leftJoin(cities, eq(cities.id, posts.cityId))
    .where(and(eq(posts.authorId, id), eq(posts.status, 'published'))).orderBy(desc(posts.publishedAt)).limit(Math.min(limit, 100)).offset(Math.max(offset, 0));
  return {
    id,
    name: member.name,
    avatarUrl: member.avatarKey ? `${getMediaPublicBaseUrl()}/${member.avatarKey.split('/').map(encodeURIComponent).join('/')}` : undefined,
    bio: member.bio ?? '',
    occupationTags: member.occupationTags,
    posts: memberPosts.map((post) => ({ id: post.id, authorId: id, author: member.name, city: post.city ?? '全国', title: titleFromBody(post.body), body: post.body, replies: post.replies })),
  };
});

export async function hasBlockRelationship(firstUserId: string, secondUserId: string): Promise<boolean> {
  const row = await getDatabase().select({ blockerId: userBlocks.blockerId }).from(userBlocks)
    .where(sql`(${userBlocks.blockerId} = ${firstUserId} and ${userBlocks.blockedId} = ${secondUserId}) or (${userBlocks.blockerId} = ${secondUserId} and ${userBlocks.blockedId} = ${firstUserId})`).limit(1);
  return row.length > 0;
}

export async function listPublicPostSitemapEntries() {
  if (isLocalDemoMode()) return demoPosts.map((item) => ({ id: item.id, updatedAt: new Date('2026-08-25') }));
  return getDatabase().select({ id: posts.id, updatedAt: posts.updatedAt }).from(posts).where(eq(posts.status, 'published')).orderBy(desc(posts.updatedAt)).limit(10_000);
}

export async function listPublicMemberSitemapEntries() {
  if (isLocalDemoMode()) return [...new Set(demoPosts.map((item) => item.authorId))].map((id) => ({ id, updatedAt: new Date('2026-08-25') }));
  return getDatabase().select({ id: users.id, updatedAt: profiles.updatedAt }).from(users).innerJoin(profiles, eq(profiles.userId, users.id)).where(eq(users.status, 'active')).orderBy(desc(profiles.updatedAt)).limit(10_000);
}
