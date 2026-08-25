import { eq } from 'drizzle-orm';
import { getDatabase } from '@/db';
import { activities, cityMemberships, comments, helpTicketMessages, helpTickets, media, moderationAppeals, notifications, organizationApplications, organizationMemberships, posts, profiles, registrations, users } from '@/db/schema';
import { apiError, requestId } from '@/lib/http';
import { requireSession } from '@/server/auth/session';

export async function GET(request: Request) {
  const id = requestId(request);
  try {
    const session = await requireSession();
    const db = getDatabase();
    const [account, profile, postRows, commentRows, cityRows, organizationRows, registrationRows, organizedRows, applicationRows, ticketRows, ticketMessages, appealRows, notificationRows, mediaRows] = await Promise.all([
      db.select({ id: users.id, role: users.role, status: users.status, createdAt: users.createdAt, lastLoginAt: users.lastLoginAt }).from(users).where(eq(users.id, session.id)).limit(1),
      db.select({ nickname: profiles.nickname, bio: profiles.bio, occupationTags: profiles.occupationTags, createdAt: profiles.createdAt, updatedAt: profiles.updatedAt }).from(profiles).where(eq(profiles.userId, session.id)).limit(1),
      db.select({ id: posts.id, cityId: posts.cityId, content: posts.content, topics: posts.topics, status: posts.status, createdAt: posts.createdAt, updatedAt: posts.updatedAt }).from(posts).where(eq(posts.authorId, session.id)),
      db.select({ id: comments.id, postId: comments.postId, parentId: comments.parentId, content: comments.content, status: comments.status, createdAt: comments.createdAt }).from(comments).where(eq(comments.authorId, session.id)),
      db.select().from(cityMemberships).where(eq(cityMemberships.userId, session.id)),
      db.select().from(organizationMemberships).where(eq(organizationMemberships.userId, session.id)),
      db.select().from(registrations).where(eq(registrations.userId, session.id)),
      db.select({ id: activities.id, cityId: activities.cityId, title: activities.title, status: activities.status, startsAt: activities.startsAt, endsAt: activities.endsAt }).from(activities).where(eq(activities.organizerId, session.id)),
      db.select().from(organizationApplications).where(eq(organizationApplications.userId, session.id)),
      db.select({ id: helpTickets.id, requesterName: helpTickets.requesterName, contact: helpTickets.contact, description: helpTickets.description, status: helpTickets.status, resolution: helpTickets.resolution, createdAt: helpTickets.createdAt, updatedAt: helpTickets.updatedAt }).from(helpTickets).where(eq(helpTickets.userId, session.id)),
      db.select({ id: helpTicketMessages.id, ticketId: helpTicketMessages.ticketId, authorRole: helpTicketMessages.authorRole, body: helpTicketMessages.body, createdAt: helpTicketMessages.createdAt }).from(helpTicketMessages).where(eq(helpTicketMessages.authorId, session.id)),
      db.select().from(moderationAppeals).where(eq(moderationAppeals.appellantId, session.id)),
      db.select({ id: notifications.id, type: notifications.type, title: notifications.title, body: notifications.body, payload: notifications.payload, readAt: notifications.readAt, createdAt: notifications.createdAt }).from(notifications).where(eq(notifications.userId, session.id)),
      db.select({ id: media.id, kind: media.kind, mimeType: media.mimeType, byteSize: media.byteSize, width: media.width, height: media.height, status: media.status, createdAt: media.createdAt }).from(media).where(eq(media.ownerId, session.id)),
    ]);
    const exportedAt = new Date();
    return new Response(JSON.stringify({ exportedAt, account: account[0] ?? null, profile: profile[0] ?? null, posts: postRows, comments: commentRows, cityMemberships: cityRows, organizationMemberships: organizationRows, registrations: registrationRows, organizedActivities: organizedRows, organizationApplications: applicationRows, helpTickets: ticketRows, helpTicketMessages: ticketMessages, appeals: appealRows, notifications: notificationRows, media: mediaRows }, null, 2), { headers: { 'content-type': 'application/json; charset=utf-8', 'content-disposition': `attachment; filename="youmin-account-${exportedAt.toISOString().slice(0, 10)}.json"`, 'cache-control': 'no-store', 'x-request-id': id } });
  } catch (error) {
    if (error instanceof Error && error.message === 'UNAUTHORIZED') return apiError('UNAUTHORIZED', '请先登录', 401, id);
    return apiError('INTERNAL_ERROR', '无法生成账号数据副本', 500, id);
  }
}
