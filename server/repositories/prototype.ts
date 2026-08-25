import 'server-only';

import { and, count, desc, eq, inArray, sql } from 'drizzle-orm';
import { getDatabase } from '@/db';
import {
  activities,
  cities,
  cityMemberships,
  follows,
  media,
  organizationApplications,
  organizations,
  polls,
  pollVotes,
  posts,
  profiles,
  reactions,
  registrations,
  saves,
  users,
} from '@/db/schema';
import { getMediaPublicBaseUrl } from '@/lib/env';

function mediaUrl(key: string | null): string | undefined {
  return key ? `${getMediaPublicBaseUrl()}/${key.split('/').map(encodeURIComponent).join('/')}` : undefined;
}

export async function listPrototypeCityStats() {
  return getDatabase().select({
    id: cities.id,
    name: cities.name,
    regionCode: cities.regionCode,
    memberCount: cities.memberCount,
    postCount: sql<number>`(select count(*) from ${posts} where ${posts.cityId} = ${cities.id} and ${posts.status} = 'published')::int`,
    activityCount: sql<number>`(select count(*) from ${activities} where ${activities.cityId} = ${cities.id} and ${activities.status} = 'published')::int`,
    organizationCount: sql<number>`(select count(*) from ${organizations} where ${organizations.cityId} = ${cities.id} and ${organizations.status} = 'published')::int`,
  }).from(cities).orderBy(cities.regionCode, cities.name).limit(700);
}

export async function getPrototypeCity(name: string, viewerId?: string, regionCode?: string) {
  const db = getDatabase();
  const [city] = await db.select({
    id: cities.id,
    name: cities.name,
    memberCount: cities.memberCount,
    postCount: sql<number>`(select count(*) from ${posts} where ${posts.cityId} = ${cities.id} and ${posts.status} = 'published')::int`,
    activityCount: sql<number>`(select count(*) from ${activities} where ${activities.cityId} = ${cities.id} and ${activities.status} = 'published')::int`,
    organizationCount: sql<number>`(select count(*) from ${organizations} where ${organizations.cityId} = ${cities.id} and ${organizations.status} = 'published')::int`,
  })
    .from(cities).where(and(eq(cities.name, name), regionCode ? eq(cities.regionCode, regionCode) : undefined)).limit(1);
  if (!city) return null;
  const contributionScore = sql<number>`((select count(*) from ${posts} where ${posts.authorId} = ${users.id} and ${posts.cityId} = ${city.id} and ${posts.status} = 'published') * 100 + (select count(*) from ${reactions} where ${reactions.userId} = ${users.id}) * 10)::int`;

  const [postRows, activityRows, organizationRows, memberRows, membership] = await Promise.all([
    db.select({
      id: posts.id,
      authorId: posts.authorId,
      author: profiles.nickname,
      avatarKey: profiles.avatarKey,
      content: posts.content,
      topics: posts.topics,
      reactions: posts.reactionCount,
      replies: posts.commentCount,
      saves: posts.saveCount,
      shares: posts.shareCount,
      publishedAt: posts.publishedAt,
    }).from(posts).innerJoin(profiles, eq(profiles.userId, posts.authorId))
      .where(and(eq(posts.cityId, city.id), eq(posts.status, 'published'))).orderBy(desc(posts.publishedAt)).limit(30),
    db.select({
      id: activities.id,
      title: activities.title,
      summary: activities.summary,
      details: activities.details,
      location: activities.location,
      capacity: activities.capacity,
      registered: activities.registrationCount,
      startsAt: activities.startsAt,
      organizerId: activities.organizerId,
      organizer: profiles.nickname,
      avatarKey: profiles.avatarKey,
    }).from(activities).innerJoin(profiles, eq(profiles.userId, activities.organizerId))
      .where(and(eq(activities.cityId, city.id), eq(activities.status, 'published'))).orderBy(activities.startsAt).limit(30),
    db.select({
      id: organizations.id,
      name: organizations.name,
      category: organizations.category,
      summary: organizations.summary,
      location: organizations.location,
      memberCount: organizations.memberCount,
    }).from(organizations).where(and(eq(organizations.cityId, city.id), eq(organizations.status, 'published'))).orderBy(organizations.name).limit(30),
    db.select({
      id: users.id,
      name: profiles.nickname,
      avatarKey: profiles.avatarKey,
      role: sql<string>`coalesce(${profiles.occupationTags}[1], 'OPC 创业者')`,
      contribution: contributionScore,
      postCount: sql<number>`(select count(*) from ${posts} where ${posts.authorId} = ${users.id} and ${posts.cityId} = ${city.id} and ${posts.status} = 'published')::int`,
      followerCount: sql<number>`(select count(*) from ${follows} where ${follows.followingId} = ${users.id})::int`,
    }).from(cityMemberships).innerJoin(users, eq(users.id, cityMemberships.userId)).innerJoin(profiles, eq(profiles.userId, users.id))
      .where(and(eq(cityMemberships.cityId, city.id), eq(users.status, 'active'))).orderBy(desc(contributionScore)).limit(30),
    viewerId ? db.select({ cityId: cityMemberships.cityId }).from(cityMemberships)
      .where(and(eq(cityMemberships.cityId, city.id), eq(cityMemberships.userId, viewerId))).limit(1) : Promise.resolve([]),
  ]);

  const postIds = postRows.map((post) => post.id);
  const activityIds = activityRows.map((activity) => activity.id);
  const organizationIds = organizationRows.map((organization) => organization.id);
  const [pollRows, mediaRows, viewerReactions, viewerSaves, viewerRegistrations, viewerOrganizationApplications, viewerFollows] = await Promise.all([
    postIds.length ? db.select({ id: polls.id, postId: polls.postId, question: polls.question, options: polls.options, closesAt: polls.closesAt })
      .from(polls).where(inArray(polls.postId, postIds)) : Promise.resolve([]),
    postIds.length ? db.select({ postId: media.postId, kind: media.kind, key: media.publicKey, mimeType: media.mimeType })
      .from(media).where(and(inArray(media.postId, postIds), eq(media.status, 'approved'))) : Promise.resolve([]),
    viewerId && postIds.length ? db.select({ postId: reactions.postId }).from(reactions).where(and(eq(reactions.userId, viewerId), inArray(reactions.postId, postIds))) : Promise.resolve([]),
    viewerId && postIds.length ? db.select({ postId: saves.postId }).from(saves).where(and(eq(saves.userId, viewerId), inArray(saves.postId, postIds))) : Promise.resolve([]),
    viewerId && activityIds.length ? db.select({ activityId: registrations.activityId }).from(registrations).where(and(eq(registrations.userId, viewerId), eq(registrations.status, 'registered'), inArray(registrations.activityId, activityIds))) : Promise.resolve([]),
    viewerId && organizationIds.length ? db.select({ organizationId: organizationApplications.organizationId }).from(organizationApplications).where(and(eq(organizationApplications.userId, viewerId), inArray(organizationApplications.organizationId, organizationIds), inArray(organizationApplications.status, ['submitted', 'reviewing', 'approved']))) : Promise.resolve([]),
    viewerId && memberRows.length ? db.select({ followingId: follows.followingId }).from(follows).where(and(eq(follows.followerId, viewerId), inArray(follows.followingId, memberRows.map((member) => member.id)))) : Promise.resolve([]),
  ]);

  const pollByPost = new Map(pollRows.map((poll) => [poll.postId, poll]));
  const mediaByPost = new Map(mediaRows.filter((item) => item.postId && item.key).map((item) => [item.postId!, item]));
  const reacted = new Set(viewerReactions.map((item) => item.postId));
  const saved = new Set(viewerSaves.map((item) => item.postId));
  const registered = new Set(viewerRegistrations.map((item) => item.activityId));
  const applied = new Set(viewerOrganizationApplications.map((item) => item.organizationId));
  const following = new Set(viewerFollows.map((item) => item.followingId));
  const viewerPollIds = viewerId && pollRows.length
    ? new Set((await db.select({ pollId: pollVotes.pollId }).from(pollVotes).where(and(eq(pollVotes.userId, viewerId), inArray(pollVotes.pollId, pollRows.map((poll) => poll.id))))).map((item) => item.pollId))
    : new Set<string>();

  return {
    city: { ...city, joined: membership.length > 0 },
    posts: postRows.map((post) => {
      const postMedia = mediaByPost.get(post.id);
      const poll = pollByPost.get(post.id);
      return {
        id: post.id,
        authorId: post.authorId,
        author: post.author,
        avatarUrl: mediaUrl(post.avatarKey),
        content: post.content,
        topic: post.topics[0],
        publishedAt: post.publishedAt?.toISOString() ?? '',
        stats: { likes: post.reactions, replies: post.replies, shares: post.shares, saves: post.saves },
        viewer: { reacted: reacted.has(post.id), saved: saved.has(post.id) },
        media: postMedia?.key ? { kind: postMedia.kind, src: mediaUrl(postMedia.key)!, mimeType: postMedia.mimeType } : undefined,
        poll: poll ? { id: poll.id, question: poll.question, options: poll.options, closesAt: poll.closesAt?.toISOString(), viewerVoted: viewerPollIds.has(poll.id) } : undefined,
      };
    }),
    activities: activityRows.map((activity) => ({
      id: activity.id,
      organizerId: activity.organizerId,
      organizer: activity.organizer,
      avatarUrl: mediaUrl(activity.avatarKey),
      title: activity.title,
      summary: activity.summary,
      details: activity.details,
      location: activity.location,
      capacity: activity.capacity,
      registeredCount: activity.registered,
      startsAt: activity.startsAt.toISOString(),
      registered: registered.has(activity.id),
    })),
    organizations: organizationRows.map((organization) => ({ ...organization, applied: applied.has(organization.id) })),
    members: memberRows.map((member) => ({ ...member, avatarUrl: mediaUrl(member.avatarKey), following: following.has(member.id) })),
  };
}

export async function getPrototypeAccount(userId: string) {
  const db = getDatabase();
  const [profile, joinedCities, ownPosts, savedPosts, registeredActivities, organizationApplicationRows, followingCount, followerCount] = await Promise.all([
    db.select({ name: profiles.nickname, bio: profiles.bio, tags: profiles.occupationTags, avatarKey: profiles.avatarKey }).from(profiles).where(eq(profiles.userId, userId)).limit(1),
    db.select({ id: cities.id, name: cities.name, postCount: sql<number>`(select count(*) from ${posts} where ${posts.cityId} = ${cities.id} and ${posts.status} = 'published')::int` }).from(cityMemberships).innerJoin(cities, eq(cities.id, cityMemberships.cityId)).where(eq(cityMemberships.userId, userId)).orderBy(cities.name),
    db.select({ id: posts.id, content: posts.content, status: posts.status, createdAt: posts.createdAt }).from(posts).where(eq(posts.authorId, userId)).orderBy(desc(posts.createdAt)).limit(100),
    db.select({ id: posts.id, content: posts.content, city: cities.name, savedAt: saves.createdAt }).from(saves).innerJoin(posts, eq(posts.id, saves.postId)).leftJoin(cities, eq(cities.id, posts.cityId)).where(and(eq(saves.userId, userId), eq(posts.status, 'published'))).orderBy(desc(saves.createdAt)).limit(100),
    db.select({ id: activities.id, title: activities.title, city: cities.name, startsAt: activities.startsAt, status: registrations.status }).from(registrations).innerJoin(activities, eq(activities.id, registrations.activityId)).innerJoin(cities, eq(cities.id, activities.cityId)).where(eq(registrations.userId, userId)).orderBy(desc(activities.startsAt)).limit(100),
    db.select({ id: organizationApplications.id, organization: organizations.name, status: organizationApplications.status, createdAt: organizationApplications.createdAt }).from(organizationApplications).innerJoin(organizations, eq(organizations.id, organizationApplications.organizationId)).where(eq(organizationApplications.userId, userId)).orderBy(desc(organizationApplications.createdAt)).limit(100),
    db.select({ value: count() }).from(follows).where(eq(follows.followerId, userId)),
    db.select({ value: count() }).from(follows).where(eq(follows.followingId, userId)),
  ]);
  if (!profile[0]) return null;
  return {
    profile: { ...profile[0], avatarUrl: mediaUrl(profile[0].avatarKey), followingCount: followingCount[0].value, followerCount: followerCount[0].value },
    joinedCities,
    posts: ownPosts.map((item) => ({ ...item, createdAt: item.createdAt.toISOString() })),
    saves: savedPosts.map((item) => ({ ...item, savedAt: item.savedAt.toISOString() })),
    activities: registeredActivities.map((item) => ({ ...item, startsAt: item.startsAt.toISOString() })),
    applications: organizationApplicationRows.map((item) => ({ id: item.id, kind: '机构申请', title: `加入${item.organization}`, status: item.status, createdAt: item.createdAt.toISOString() })).sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
  };
}
