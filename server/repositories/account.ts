import { and, desc, eq, inArray } from 'drizzle-orm';
import { getDatabase } from '@/db';
import { activities, cities, cityMemberships, follows, helpTicketMessages, helpTickets, moderationAppeals, notifications, organizationApplications, organizationMemberships, organizations, posts, profiles, registrations, saves, sessions, users } from '@/db/schema';

export async function getAccountProfile(userId: string) {
  return (await getDatabase().select({ nickname: profiles.nickname, bio: profiles.bio, occupationTags: profiles.occupationTags, avatarKey: profiles.avatarKey })
    .from(profiles).where(eq(profiles.userId, userId)).limit(1))[0] ?? null;
}

export async function getActivityCreatorCapability(userId: string) {
  const [account, joinedCities] = await Promise.all([
    getDatabase().select({ role: users.role, approvedAt: users.activityCreatorApprovedAt, requestedAt: users.activityCreatorRequestedAt }).from(users).where(eq(users.id, userId)).limit(1),
    getDatabase().select({ id: cities.id, name: cities.name, membershipRole: cityMemberships.role }).from(cityMemberships).innerJoin(cities, eq(cities.id, cityMemberships.cityId)).where(eq(cityMemberships.userId, userId)).orderBy(cities.name),
  ]);
  const user = account[0];
  return user ? { canCreate: user.role !== 'user' || Boolean(user.approvedAt), requestedAt: user.requestedAt, joinedCities } : { canCreate: false, requestedAt: null, joinedCities: [] };
}

export async function listAccountPosts(userId: string) {
  return getDatabase().select({ id: posts.id, content: posts.content, status: posts.status, reactions: posts.reactionCount, comments: posts.commentCount, createdAt: posts.createdAt })
    .from(posts).where(eq(posts.authorId, userId)).orderBy(desc(posts.createdAt)).limit(100);
}

export async function listAccountSaves(userId: string) {
  return getDatabase().select({ id: posts.id, content: posts.content, city: cities.name, savedAt: saves.createdAt })
    .from(saves).innerJoin(posts, eq(posts.id, saves.postId)).leftJoin(cities, eq(cities.id, posts.cityId))
    .where(and(eq(saves.userId, userId), eq(posts.status, 'published'))).orderBy(desc(saves.createdAt)).limit(100);
}

export async function listAccountFollows(userId: string) {
  return getDatabase().select({ id: follows.followingId, nickname: profiles.nickname, bio: profiles.bio, followedAt: follows.createdAt })
    .from(follows).innerJoin(profiles, eq(profiles.userId, follows.followingId))
    .where(eq(follows.followerId, userId)).orderBy(desc(follows.createdAt)).limit(100);
}

export async function listAccountCityMemberships(userId: string) {
  return getDatabase().select({ id: cities.id, slug: cities.slug, name: cities.name, role: cityMemberships.role, joinedAt: cityMemberships.joinedAt })
    .from(cityMemberships).innerJoin(cities, eq(cities.id, cityMemberships.cityId))
    .where(eq(cityMemberships.userId, userId)).orderBy(desc(cityMemberships.joinedAt)).limit(100);
}

export async function listAccountOrganizationMemberships(userId: string) {
  return getDatabase().select({ id: organizations.id, name: organizations.name, role: organizationMemberships.role, joinedAt: organizationMemberships.joinedAt })
    .from(organizationMemberships).innerJoin(organizations, eq(organizations.id, organizationMemberships.organizationId))
    .where(eq(organizationMemberships.userId, userId)).orderBy(desc(organizationMemberships.joinedAt)).limit(100);
}

export async function listAccountActivities(userId: string) {
  return getDatabase().select({ id: activities.id, title: activities.title, city: cities.name, startsAt: activities.startsAt, status: registrations.status })
    .from(registrations).innerJoin(activities, eq(activities.id, registrations.activityId)).innerJoin(cities, eq(cities.id, activities.cityId))
    .where(eq(registrations.userId, userId)).orderBy(desc(activities.startsAt)).limit(100);
}

export async function listOrganizedActivities(userId: string) {
  return getDatabase().select({ id: activities.id, cityId: activities.cityId, city: cities.name, title: activities.title, summary: activities.summary, details: activities.details, location: activities.location, capacity: activities.capacity, startsAt: activities.startsAt, endsAt: activities.endsAt, status: activities.status })
    .from(activities).innerJoin(cities, eq(cities.id, activities.cityId)).where(eq(activities.organizerId, userId)).orderBy(desc(activities.startsAt)).limit(100);
}

export async function listAccountNotifications(userId: string) {
  return getDatabase().select({ id: notifications.id, type: notifications.type, title: notifications.title, body: notifications.body, payload: notifications.payload, readAt: notifications.readAt, createdAt: notifications.createdAt })
    .from(notifications).where(eq(notifications.userId, userId)).orderBy(desc(notifications.createdAt)).limit(100);
}

export async function listAccountHelpTickets(userId: string) {
  const db = getDatabase();
  const ticketRows = await db.select({ id: helpTickets.id, description: helpTickets.description, status: helpTickets.status, resolution: helpTickets.resolution, createdAt: helpTickets.createdAt, updatedAt: helpTickets.updatedAt, resolvedAt: helpTickets.resolvedAt })
    .from(helpTickets).where(eq(helpTickets.userId, userId)).orderBy(desc(helpTickets.createdAt)).limit(100);
  if (ticketRows.length === 0) return [];
  const messages = await db.select({ id: helpTicketMessages.id, ticketId: helpTicketMessages.ticketId, authorRole: helpTicketMessages.authorRole, body: helpTicketMessages.body, createdAt: helpTicketMessages.createdAt })
    .from(helpTicketMessages).where(inArray(helpTicketMessages.ticketId, ticketRows.map((row) => row.id))).orderBy(helpTicketMessages.createdAt);
  return ticketRows.map((ticket) => ({ ...ticket, messages: messages.filter((message) => message.ticketId === ticket.id) }));
}

export async function listAccountSessions(userId: string) {
  return getDatabase().select({ id: sessions.id, userAgent: sessions.userAgent, expiresAt: sessions.expiresAt, revokedAt: sessions.revokedAt, createdAt: sessions.createdAt })
    .from(sessions).where(eq(sessions.userId, userId)).orderBy(desc(sessions.createdAt)).limit(50);
}

export async function listAccountAppeals(userId: string) {
  return getDatabase().select({ id: moderationAppeals.id, targetType: moderationAppeals.targetType, targetId: moderationAppeals.targetId, reason: moderationAppeals.reason, status: moderationAppeals.status, decision: moderationAppeals.decision, notes: moderationAppeals.notes, createdAt: moderationAppeals.createdAt }).from(moderationAppeals).where(eq(moderationAppeals.appellantId, userId)).orderBy(desc(moderationAppeals.createdAt)).limit(100);
}

export async function listAccountApplications(userId: string) {
  const organizationRows = await getDatabase().select({ id: organizationApplications.id, title: organizations.name, status: organizationApplications.status, reviewNotes: organizationApplications.reviewNotes, createdAt: organizationApplications.createdAt }).from(organizationApplications).innerJoin(organizations, eq(organizations.id, organizationApplications.organizationId)).where(eq(organizationApplications.userId, userId)).orderBy(desc(organizationApplications.createdAt)).limit(100);
  return [
    ...organizationRows.map((row) => ({ ...row, kind: '机构申请' })),
  ].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
}
