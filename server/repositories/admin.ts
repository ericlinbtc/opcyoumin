import { desc, inArray, sql } from 'drizzle-orm';
import { getDatabase } from '@/db';
import { activities, auditLogs, cities, cityMemberships, comments, deadLetterJobs, helpFaqs, helpTickets, insights, knowledgeArticles, media, moderationAppeals, moderationCases, organizationApplications, organizations, policies, posts, profiles, reports, users } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { getOssClient } from '@/server/oss';

export function listAdminUsers() {
  return getDatabase().select({ id: users.id, nickname: profiles.nickname, status: users.status, role: users.role, activityCreatorApprovedAt: users.activityCreatorApprovedAt, activityCreatorRequestedAt: users.activityCreatorRequestedAt, lastLoginAt: users.lastLoginAt, createdAt: users.createdAt })
    .from(users).innerJoin(profiles, eq(profiles.userId, users.id)).orderBy(desc(users.createdAt)).limit(200);
}

export function listAdminPosts(cityIds?: string[]) {
  return getDatabase().select({ id: posts.id, content: posts.content, status: posts.status, author: profiles.nickname, createdAt: posts.createdAt, reportCount: sql<number>`(select count(*) from ${reports} where ${reports.targetType} = 'post' and ${reports.targetId} = ${posts.id})::int` })
    .from(posts).innerJoin(profiles, eq(profiles.userId, posts.authorId)).where(cityIds === undefined ? undefined : cityIds.length > 0 ? inArray(posts.cityId, cityIds) : sql`false`).orderBy(desc(posts.createdAt)).limit(200);
}

export function listAdminComments(cityIds?: string[]) {
  return getDatabase().select({ id: comments.id, postId: comments.postId, content: comments.content, status: comments.status, author: profiles.nickname, createdAt: comments.createdAt }).from(comments).innerJoin(profiles, eq(profiles.userId, comments.authorId)).innerJoin(posts, eq(posts.id, comments.postId)).where(cityIds === undefined ? undefined : cityIds.length > 0 ? inArray(posts.cityId, cityIds) : sql`false`).orderBy(desc(comments.createdAt)).limit(200);
}

export async function listAdminReports(cityIds?: string[]) {
  const targetCity = sql<string | null>`case when ${reports.targetType} = 'post' then (select ${posts.cityId} from ${posts} where ${posts.id} = ${reports.targetId}) when ${reports.targetType} = 'comment' then (select p.city_id from comments c join posts p on p.id = c.post_id where c.id = ${reports.targetId}) when ${reports.targetType} = 'activity' then (select ${activities.cityId} from ${activities} where ${activities.id} = ${reports.targetId}) else null end`;
  return getDatabase().select({ id: reports.id, targetType: reports.targetType, targetId: reports.targetId, reason: reports.reason, details: reports.details, status: reports.status, caseStatus: moderationCases.status, decision: moderationCases.decision, createdAt: reports.createdAt }).from(reports).leftJoin(moderationCases, eq(moderationCases.reportId, reports.id))
    .where(cityIds === undefined ? undefined : cityIds.length ? inArray(targetCity, cityIds) : sql`false`).orderBy(desc(reports.createdAt)).limit(200);
}

export async function listAdminAppeals(cityIds?: string[]) {
  const targetCity = sql<string | null>`case when ${moderationAppeals.targetType} = 'post' then (select ${posts.cityId} from ${posts} where ${posts.id} = ${moderationAppeals.targetId}) when ${moderationAppeals.targetType} = 'comment' then (select p.city_id from comments c join posts p on p.id = c.post_id where c.id = ${moderationAppeals.targetId}) when ${moderationAppeals.targetType} = 'activity' then (select ${activities.cityId} from ${activities} where ${activities.id} = ${moderationAppeals.targetId}) else null end`;
  return getDatabase().select({ id: moderationAppeals.id, targetType: moderationAppeals.targetType, targetId: moderationAppeals.targetId, reason: moderationAppeals.reason, status: moderationAppeals.status, createdAt: moderationAppeals.createdAt }).from(moderationAppeals)
    .where(cityIds === undefined ? undefined : cityIds.length ? inArray(targetCity, cityIds) : sql`false`).orderBy(desc(moderationAppeals.createdAt)).limit(200);
}

export async function listAdminMedia(cityIds?: string[]) {
  const rows = await getDatabase().select({ id: media.id, kind: media.kind, originalKey: media.originalKey, mimeType: media.mimeType, byteSize: media.byteSize, status: media.status, createdAt: media.createdAt }).from(media).leftJoin(posts, eq(posts.id, media.postId)).where(cityIds === undefined ? undefined : cityIds.length > 0 ? inArray(posts.cityId, cityIds) : sql`false`).orderBy(desc(media.createdAt)).limit(200);
  const oss = getOssClient();
  return rows.map(({ originalKey, ...row }) => ({ ...row, previewUrl: oss.signatureUrl(originalKey, { expires: 600 }) }));
}

export function listAdminActivities(cityIds?: string[]) {
  return getDatabase().select({ id: activities.id, title: activities.title, city: cities.name, organizer: profiles.nickname, status: activities.status, startsAt: activities.startsAt })
    .from(activities).innerJoin(cities, eq(cities.id, activities.cityId)).innerJoin(profiles, eq(profiles.userId, activities.organizerId)).where(cityIds === undefined ? undefined : cityIds.length > 0 ? inArray(activities.cityId, cityIds) : sql`false`).orderBy(desc(activities.createdAt)).limit(200);
}

export async function listAdminContent() {
  const db = getDatabase();
  const [knowledge, insightRows] = await Promise.all([
    db.select({ id: knowledgeArticles.id, kind: sql<'knowledge'>`'knowledge'`, slug: knowledgeArticles.slug, title: knowledgeArticles.title, summary: knowledgeArticles.summary, body: knowledgeArticles.body, category: knowledgeArticles.category, sourceName: knowledgeArticles.sourceName, sourceUrl: knowledgeArticles.sourceUrl, factCheckedAt: knowledgeArticles.factCheckedAt, status: knowledgeArticles.status, importance: sql<number>`1`, updatedAt: knowledgeArticles.updatedAt }).from(knowledgeArticles).orderBy(desc(knowledgeArticles.updatedAt)).limit(100),
    db.select({ id: insights.id, kind: sql<'insight'>`'insight'`, slug: insights.slug, title: insights.title, summary: insights.summary, body: insights.body, category: insights.category, sourceName: insights.sourceName, sourceUrl: insights.sourceUrl, factCheckedAt: insights.factCheckedAt, status: insights.status, importance: insights.importance, updatedAt: insights.updatedAt }).from(insights).orderBy(desc(insights.updatedAt)).limit(100),
  ]);
  return [...knowledge, ...insightRows].sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());
}

export function listAdminPolicies() {
  return getDatabase().select({ id: policies.id, cityId: policies.cityId, city: cities.name, title: policies.title, category: policies.category, summary: policies.summary, interpretation: policies.interpretation, keyPoints: policies.keyPoints, issuingAuthority: policies.issuingAuthority, documentNumber: policies.documentNumber, sourceName: policies.sourceName, sourceUrl: policies.sourceUrl, sourceCheckedAt: policies.sourceCheckedAt, revisionNote: policies.revisionNote, supersededAt: policies.supersededAt, publishedAt: policies.publishedAt, effectiveAt: policies.effectiveAt, status: policies.status, updatedAt: policies.updatedAt })
    .from(policies).leftJoin(cities, eq(cities.id, policies.cityId)).orderBy(desc(policies.updatedAt)).limit(200);
}

export function listAdminFaqs() {
  return getDatabase().select({ id: helpFaqs.id, slug: helpFaqs.slug, category: helpFaqs.category, question: helpFaqs.question, answer: helpFaqs.answer, sortOrder: helpFaqs.sortOrder, status: helpFaqs.status, updatedAt: helpFaqs.updatedAt })
    .from(helpFaqs).orderBy(helpFaqs.sortOrder, desc(helpFaqs.updatedAt)).limit(200);
}

export function listAdminCities(cityIds?: string[]) {
  return getDatabase().select({ id: cities.id, name: cities.name, regionCode: cities.regionCode, memberCount: cities.memberCount, managers: sql<string>`coalesce((select string_agg(${profiles.nickname}, '、') from ${cityMemberships} join ${profiles} on ${profiles.userId} = ${cityMemberships.userId} where ${cityMemberships.cityId} = ${cities.id} and ${cityMemberships.role} = 'city_admin'), '')`, updatedAt: cities.updatedAt }).from(cities).where(cityIds === undefined ? undefined : cityIds.length > 0 ? inArray(cities.id, cityIds) : sql`false`).orderBy(cities.regionCode, cities.name).limit(700);
}

export function listAdminAuditLogs() {
  return getDatabase().select({ id: auditLogs.id, createdAt: auditLogs.createdAt, actorId: auditLogs.actorId, action: auditLogs.action, targetType: auditLogs.targetType, targetId: auditLogs.targetId, requestId: auditLogs.requestId }).from(auditLogs).orderBy(desc(auditLogs.createdAt)).limit(500);
}

export function listAdminDeadLetters() {
  return getDatabase().select({ id: deadLetterJobs.id, topic: deadLetterJobs.topic, error: deadLetterJobs.error, status: deadLetterJobs.status, failedAt: deadLetterJobs.failedAt, resolutionNotes: deadLetterJobs.resolutionNotes }).from(deadLetterJobs).orderBy(desc(deadLetterJobs.failedAt)).limit(200);
}

export async function listAdminApplications() {
  const db = getDatabase();
  const [organizationRows, ticketRows] = await Promise.all([
    db.select({ id: organizationApplications.id, kind: sql<'organization'>`'organization'`, title: profiles.nickname, subtitle: organizations.name, status: organizationApplications.status, detail: organizationApplications.motivation, contact: sql<string>`''`, createdAt: organizationApplications.createdAt }).from(organizationApplications).innerJoin(organizations, eq(organizations.id, organizationApplications.organizationId)).innerJoin(profiles, eq(profiles.userId, organizationApplications.userId)).orderBy(desc(organizationApplications.createdAt)).limit(200),
    db.select({ id: helpTickets.id, kind: sql<'ticket'>`'ticket'`, title: helpTickets.requesterName, subtitle: sql<string>`'帮助工单'`, status: helpTickets.status, detail: helpTickets.description, contact: helpTickets.contact, createdAt: helpTickets.createdAt }).from(helpTickets).orderBy(desc(helpTickets.createdAt)).limit(200),
  ]);
  return [...organizationRows, ...ticketRows].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
}
