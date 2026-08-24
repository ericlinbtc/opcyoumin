'use server';

import { createHash, randomUUID } from 'node:crypto';
import { and, eq, or, sql } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { getDatabase } from '@/db';
import { activities, auditLogs, cities, cityMemberships, comments, deadLetterJobs, follows, helpTickets, insights, knowledgeArticles, media, moderationAppeals, moderationCases, notifications, opcVerificationApplications, organizationApplications, outboxJobs, pollVotes, polls, posts, postShares, profiles, reactions, registrations, reports, saves, sessions, userBlocks, users } from '@/db/schema';
import type { ActionResult } from '@/features/posts/actions';
import { requireSession } from '@/server/auth/session';
import { assertConfiguredCan } from '@/server/auth/permissions';
import { canTransitionActivity, canTransitionPost } from '@/server/domain/state-machines';
import type { ActivityStatus, PostStatus } from '@/server/domain/types';
import { getOssClient } from '@/server/oss';
import { assertCityScope } from '@/server/auth/city-scope';
import { getAuditContext } from '@/server/request-context';

const postModerationSchema = z.object({ postId: z.uuid(), targetStatus: z.enum(['published', 'hidden', 'deleted']), reason: z.string().trim().min(2).max(500) });

export async function moderatePost(input: unknown): Promise<ActionResult> {
  try {
    const session = await requireSession(['city_admin', 'platform_admin']);
    const audit = await getAuditContext();
    await assertConfiguredCan(session.role, 'moderation:review');
    const values = postModerationSchema.parse(input);
    const [scopePost] = await getDatabase().select({ cityId: posts.cityId, ownerId: posts.authorId }).from(posts).where(eq(posts.id, values.postId)).limit(1);
    if (!scopePost) throw new Error('NOT_FOUND');
    await assertCityScope(session, scopePost.cityId);
    await getDatabase().transaction(async (tx) => {
      const [post] = await tx.select({ status: posts.status }).from(posts).where(eq(posts.id, values.postId)).limit(1);
      if (!post) throw new Error('NOT_FOUND');
      if (!canTransitionPost(post.status as PostStatus, values.targetStatus)) throw new Error('INVALID_STATE_TRANSITION');
      await tx.update(posts).set({ status: values.targetStatus, deletedAt: values.targetStatus === 'deleted' ? new Date() : null, updatedAt: new Date() }).where(eq(posts.id, values.postId));
      await tx.insert(notifications).values({ userId: scopePost.ownerId, type: 'moderation', title: values.targetStatus === 'published' ? '动态已恢复' : '动态状态已变更', body: values.reason, payload: { postId: values.postId, status: values.targetStatus } });
      await tx.insert(auditLogs).values({ ...audit, actorId: session.id, action: `post.${values.targetStatus}`, targetType: 'post', targetId: values.postId, before: { status: post.status }, after: { status: values.targetStatus, reason: values.reason } });
    });
    revalidatePath(`/posts/${values.postId}`);
    revalidatePath('/admin/posts');
    return { ok: true };
  } catch (error) {
    if (error instanceof z.ZodError) return { ok: false, code: 'VALIDATION_ERROR', message: '审核参数不正确' };
    return { ok: false, code: error instanceof Error ? error.message : 'INTERNAL_ERROR', message: '审核操作失败' };
  }
}

const commentModerationSchema = z.object({ commentId: z.uuid(), targetStatus: z.enum(['published', 'hidden', 'deleted']), reason: z.string().trim().min(2).max(500) });

export async function moderateComment(input: unknown): Promise<ActionResult> {
  try {
    const session = await requireSession(['city_admin', 'platform_admin']);
    const audit = await getAuditContext();
    await assertConfiguredCan(session.role, 'moderation:review');
    const values = commentModerationSchema.parse(input);
    const [scopeComment] = await getDatabase().select({ cityId: posts.cityId, ownerId: comments.authorId }).from(comments).innerJoin(posts, eq(posts.id, comments.postId)).where(eq(comments.id, values.commentId)).limit(1);
    if (!scopeComment) throw new Error('NOT_FOUND');
    await assertCityScope(session, scopeComment.cityId);
    await getDatabase().transaction(async (tx) => {
      const [comment] = await tx.select({ status: comments.status, postId: comments.postId }).from(comments).where(eq(comments.id, values.commentId)).limit(1);
      if (!comment) throw new Error('NOT_FOUND');
      if (!canTransitionPost(comment.status as PostStatus, values.targetStatus)) throw new Error('INVALID_STATE_TRANSITION');
      await tx.update(comments).set({ status: values.targetStatus, deletedAt: values.targetStatus === 'deleted' ? new Date() : null, updatedAt: new Date() }).where(eq(comments.id, values.commentId));
      const wasPublished = comment.status === 'published';
      const isPublished = values.targetStatus === 'published';
      if (wasPublished !== isPublished) await tx.update(posts).set({ commentCount: isPublished ? sql`${posts.commentCount} + 1` : sql`greatest(${posts.commentCount} - 1, 0)`, updatedAt: new Date() }).where(eq(posts.id, comment.postId));
      await tx.insert(notifications).values({ userId: scopeComment.ownerId, type: 'moderation', title: values.targetStatus === 'published' ? '评论已恢复' : '评论状态已变更', body: values.reason, payload: { commentId: values.commentId, status: values.targetStatus } });
      await tx.insert(auditLogs).values({ ...audit, actorId: session.id, action: `comment.${values.targetStatus}`, targetType: 'comment', targetId: values.commentId, before: { status: comment.status }, after: { status: values.targetStatus, reason: values.reason } });
    });
    revalidatePath('/admin/posts');
    return { ok: true };
  } catch (error) {
    return { ok: false, code: error instanceof Error ? error.message : 'INTERNAL_ERROR', message: '评论审核失败' };
  }
}

const activityReviewSchema = z.object({ activityId: z.uuid(), targetStatus: z.enum(['published', 'cancelled', 'ended']), reason: z.string().trim().min(2).max(500) });

export async function reviewActivity(input: unknown): Promise<ActionResult> {
  try {
    const session = await requireSession(['city_admin', 'platform_admin']);
    const audit = await getAuditContext();
    await assertConfiguredCan(session.role, 'activity:approve');
    const values = activityReviewSchema.parse(input);
    const [scopeActivity] = await getDatabase().select({ cityId: activities.cityId, organizerId: activities.organizerId }).from(activities).where(eq(activities.id, values.activityId)).limit(1);
    if (!scopeActivity) throw new Error('NOT_FOUND');
    await assertCityScope(session, scopeActivity.cityId);
    await getDatabase().transaction(async (tx) => {
      const [activity] = await tx.select({ status: activities.status }).from(activities).where(eq(activities.id, values.activityId)).limit(1);
      if (!activity) throw new Error('NOT_FOUND');
      if (!canTransitionActivity(activity.status as ActivityStatus, values.targetStatus)) throw new Error('INVALID_STATE_TRANSITION');
      await tx.update(activities).set({ status: values.targetStatus, updatedAt: new Date() }).where(eq(activities.id, values.activityId));
      await tx.insert(notifications).values({ userId: scopeActivity.organizerId, type: 'activity', title: values.targetStatus === 'published' ? '活动审核通过' : '活动状态已变更', body: values.reason, payload: { activityId: values.activityId, status: values.targetStatus } });
      await tx.insert(auditLogs).values({ ...audit, actorId: session.id, action: `activity.${values.targetStatus}`, targetType: 'activity', targetId: values.activityId, before: { status: activity.status }, after: { status: values.targetStatus, reason: values.reason } });
    });
    revalidatePath(`/activities/${values.activityId}`);
    revalidatePath('/admin/activities');
    return { ok: true };
  } catch (error) {
    return { ok: false, code: error instanceof Error ? error.message : 'INTERNAL_ERROR', message: '活动审核失败' };
  }
}

const userStatusSchema = z.object({ userId: z.uuid(), status: z.enum(['active', 'banned']), reason: z.string().trim().min(2).max(500) });

export async function setUserStatus(input: unknown): Promise<ActionResult> {
  try {
    const session = await requireSession(['platform_admin']);
    const audit = await getAuditContext();
    await assertConfiguredCan(session.role, 'platform:manage');
    const values = userStatusSchema.parse(input);
    if (values.userId === session.id) return { ok: false, code: 'CANNOT_BAN_SELF', message: '不能封禁当前管理员账号' };
    await getDatabase().transaction(async (tx) => {
      const [user] = await tx.select({ status: users.status }).from(users).where(eq(users.id, values.userId)).limit(1);
      if (!user) throw new Error('NOT_FOUND');
      await tx.update(users).set({ status: values.status, updatedAt: new Date() }).where(eq(users.id, values.userId));
      if (values.status === 'banned') await tx.update(sessions).set({ revokedAt: new Date() }).where(eq(sessions.userId, values.userId));
      await tx.insert(auditLogs).values({ ...audit, actorId: session.id, action: values.status === 'banned' ? 'user.banned' : 'user.unbanned', targetType: 'user', targetId: values.userId, before: { status: user.status }, after: { status: values.status, reason: values.reason } });
    });
    revalidatePath('/admin/users');
    return { ok: true };
  } catch (error) {
    return { ok: false, code: error instanceof Error ? error.message : 'INTERNAL_ERROR', message: '用户状态更新失败' };
  }
}

const userRoleSchema = z.object({ userId: z.uuid(), role: z.enum(['user', 'editor', 'city_admin', 'platform_admin']), reason: z.string().trim().min(2).max(500) });

export async function setUserRole(input: unknown): Promise<ActionResult> {
  try {
    const session = await requireSession(['platform_admin']);
    const audit = await getAuditContext();
    await assertConfiguredCan(session.role, 'platform:manage');
    const values = userRoleSchema.parse(input);
    if (values.userId === session.id && values.role !== 'platform_admin') return { ok: false, code: 'CANNOT_DEMOTE_SELF', message: '不能降低当前管理员自己的权限' };
    await getDatabase().transaction(async (tx) => {
      const [user] = await tx.select({ role: users.role }).from(users).where(eq(users.id, values.userId)).limit(1);
      if (!user) throw new Error('NOT_FOUND');
      await tx.update(users).set({ role: values.role, updatedAt: new Date() }).where(eq(users.id, values.userId));
      await tx.update(sessions).set({ revokedAt: new Date() }).where(eq(sessions.userId, values.userId));
      await tx.insert(auditLogs).values({ ...audit, actorId: session.id, action: 'user.role_changed', targetType: 'user', targetId: values.userId, before: { role: user.role }, after: { role: values.role, reason: values.reason } });
    });
    revalidatePath('/admin/users');
    return { ok: true };
  } catch (error) {
    return { ok: false, code: error instanceof Error ? error.message : 'INTERNAL_ERROR', message: '用户角色更新失败' };
  }
}

const activityCreatorEligibilitySchema = z.object({ userId: z.uuid(), approved: z.boolean(), reason: z.string().trim().min(2).max(500) });

export async function setActivityCreatorEligibility(input: unknown): Promise<ActionResult> {
  try {
    const session = await requireSession(['platform_admin']);
    const audit = await getAuditContext();
    await assertConfiguredCan(session.role, 'platform:manage');
    const values = activityCreatorEligibilitySchema.parse(input);
    await getDatabase().transaction(async (tx) => {
      const [user] = await tx.select({ approvedAt: users.activityCreatorApprovedAt, requestedAt: users.activityCreatorRequestedAt }).from(users).where(and(eq(users.id, values.userId), eq(users.status, 'active'))).limit(1);
      if (!user) throw new Error('NOT_FOUND');
      const approvedAt = values.approved ? new Date() : null;
      await tx.update(users).set({ activityCreatorApprovedAt: approvedAt, activityCreatorRequestedAt: null, updatedAt: new Date() }).where(eq(users.id, values.userId));
      await tx.insert(notifications).values({ userId: values.userId, type: 'system', title: values.approved ? '活动发起资格已开通' : user.requestedAt ? '活动发起资格申请未通过' : '活动发起资格已撤销', body: values.reason, payload: { approved: values.approved } });
      await tx.insert(auditLogs).values({ ...audit, actorId: session.id, action: values.approved ? 'activity_creator.approved' : 'activity_creator.revoked', targetType: 'user', targetId: values.userId, before: { approved: Boolean(user.approvedAt) }, after: { approved: values.approved, reason: values.reason } });
    });
    revalidatePath('/admin/users');
    revalidatePath('/activities');
    return { ok: true };
  } catch (error) {
    return { ok: false, code: error instanceof Error ? error.message : 'INTERNAL_ERROR', message: '活动发起资格更新失败' };
  }
}

const cityAdminSchema = z.object({ cityId: z.uuid(), userId: z.uuid(), enabled: z.boolean(), reason: z.string().trim().min(2).max(500) });

export async function setCityAdmin(input: unknown): Promise<ActionResult> {
  try {
    const session = await requireSession(['platform_admin']);
    const audit = await getAuditContext();
    await assertConfiguredCan(session.role, 'platform:manage');
    const values = cityAdminSchema.parse(input);
    await getDatabase().transaction(async (tx) => {
      const [user] = await tx.select({ role: users.role }).from(users).where(eq(users.id, values.userId)).limit(1);
      if (!user) throw new Error('NOT_FOUND');
      await tx.insert(cityMemberships).values({ cityId: values.cityId, userId: values.userId, role: values.enabled ? 'city_admin' : 'member' }).onConflictDoUpdate({ target: [cityMemberships.cityId, cityMemberships.userId], set: { role: values.enabled ? 'city_admin' : 'member' } });
      if (values.enabled && user.role !== 'platform_admin') await tx.update(users).set({ role: 'city_admin', updatedAt: new Date() }).where(eq(users.id, values.userId));
      if (!values.enabled && user.role === 'city_admin') {
        const remaining = await tx.select({ cityId: cityMemberships.cityId }).from(cityMemberships).where(and(eq(cityMemberships.userId, values.userId), eq(cityMemberships.role, 'city_admin'))).limit(1);
        if (!remaining[0]) await tx.update(users).set({ role: 'user', updatedAt: new Date() }).where(eq(users.id, values.userId));
      }
      await tx.update(sessions).set({ revokedAt: new Date() }).where(eq(sessions.userId, values.userId));
      await tx.insert(auditLogs).values({ ...audit, actorId: session.id, action: values.enabled ? 'city.admin_assigned' : 'city.admin_removed', targetType: 'city', targetId: values.cityId, after: { userId: values.userId, reason: values.reason } });
    });
    revalidatePath('/admin/cities');
    return { ok: true };
  } catch (error) {
    return { ok: false, code: error instanceof Error ? error.message : 'INTERNAL_ERROR', message: '城市管理员更新失败' };
  }
}

const managedContentSchema = z.object({
  id: z.uuid().optional(),
  kind: z.enum(['knowledge', 'insight']),
  slug: z.string().trim().min(2).max(160).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  title: z.string().trim().min(2).max(200),
  summary: z.string().trim().min(10).max(500),
  body: z.string().trim().min(20).max(100_000),
  category: z.string().trim().min(2).max(80),
  importance: z.number().int().min(1).max(5).default(1),
  status: z.enum(['draft', 'pending', 'published', 'hidden', 'deleted']),
});

export async function saveManagedContent(input: unknown): Promise<ActionResult<{ id: string }>> {
  try {
    const session = await requireSession(['editor', 'platform_admin']);
    const audit = await getAuditContext();
    await assertConfiguredCan(session.role, 'knowledge:publish');
    const values = managedContentSchema.parse(input);
    const now = new Date();
    const id = await getDatabase().transaction(async (tx) => {
      if (values.kind === 'knowledge') {
        const payload = { slug: values.slug, title: values.title, summary: values.summary, body: values.body, category: values.category, status: values.status, authorId: session.id, publishedAt: values.status === 'published' ? now : null, updatedAt: now } as const;
        const [row] = values.id
          ? await tx.update(knowledgeArticles).set(payload).where(eq(knowledgeArticles.id, values.id)).returning({ id: knowledgeArticles.id })
          : await tx.insert(knowledgeArticles).values(payload).returning({ id: knowledgeArticles.id });
        if (!row) throw new Error('NOT_FOUND');
        await tx.insert(auditLogs).values({ ...audit, actorId: session.id, action: `knowledge.${values.status}`, targetType: 'knowledge', targetId: row.id, after: { title: values.title, slug: values.slug, status: values.status } });
        return row.id;
      }
      const payload = { slug: values.slug, title: values.title, summary: values.summary, body: values.body, category: values.category, importance: values.importance, status: values.status, publishedAt: values.status === 'published' ? now : null, updatedAt: now } as const;
      const [row] = values.id
        ? await tx.update(insights).set(payload).where(eq(insights.id, values.id)).returning({ id: insights.id })
        : await tx.insert(insights).values(payload).returning({ id: insights.id });
      if (!row) throw new Error('NOT_FOUND');
      await tx.insert(auditLogs).values({ ...audit, actorId: session.id, action: `insight.${values.status}`, targetType: 'insight', targetId: row.id, after: { title: values.title, slug: values.slug, status: values.status } });
      return row.id;
    });
    revalidatePath('/knowledge');
    revalidatePath('/insights');
    revalidatePath('/admin/content');
    return { ok: true, data: { id } };
  } catch (error) {
    if (error instanceof z.ZodError) return { ok: false, code: 'VALIDATION_ERROR', message: '内容字段不完整或 slug 格式不正确' };
    return { ok: false, code: error instanceof Error ? error.message : 'INTERNAL_ERROR', message: '内容保存失败' };
  }
}

const mediaReviewSchema = z.object({ mediaId: z.uuid(), decision: z.enum(['approved', 'rejected']), reason: z.string().trim().min(2).max(500) });

export async function reviewMedia(input: unknown): Promise<ActionResult> {
  try {
    const session = await requireSession(['city_admin', 'platform_admin']);
    const audit = await getAuditContext();
    await assertConfiguredCan(session.role, 'moderation:review');
    const values = mediaReviewSchema.parse(input);
    const [item] = await getDatabase().select({ originalKey: media.originalKey, status: media.status, ownerId: media.ownerId, postId: media.postId, kind: media.kind, cityId: posts.cityId }).from(media).leftJoin(posts, eq(posts.id, media.postId)).where(eq(media.id, values.mediaId)).limit(1);
    if (!item) throw new Error('NOT_FOUND');
    await assertCityScope(session, item.cityId);
    if (!['uploaded', 'rejected'].includes(item.status)) throw new Error('INVALID_STATE_TRANSITION');
    const publicKey = values.decision === 'approved' ? `public/${values.mediaId}/${item.originalKey.split('/').at(-1)}` : null;
    if (publicKey) await getOssClient().copy(publicKey, item.originalKey);
    await getDatabase().transaction(async (tx) => {
      await tx.update(media).set({ status: values.decision, publicKey, updatedAt: new Date() }).where(eq(media.id, values.mediaId));
      if (values.decision === 'approved' && item.kind === 'image' && !item.postId && publicKey) await tx.update(profiles).set({ avatarKey: publicKey, updatedAt: new Date() }).where(eq(profiles.userId, item.ownerId));
      await tx.insert(notifications).values({ userId: item.ownerId, type: 'moderation', title: values.decision === 'approved' ? '媒体审核通过' : '媒体审核未通过', body: values.reason, payload: { mediaId: values.mediaId, decision: values.decision } });
      await tx.insert(auditLogs).values({ ...audit, actorId: session.id, action: `media.${values.decision}`, targetType: 'media', targetId: values.mediaId, before: { status: item.status }, after: { status: values.decision, reason: values.reason, publicKey } });
    });
    revalidatePath('/admin/posts');
    return { ok: true };
  } catch (error) {
    if (error instanceof z.ZodError) return { ok: false, code: 'VALIDATION_ERROR', message: '媒体审核参数不正确' };
    return { ok: false, code: error instanceof Error ? error.message : 'INTERNAL_ERROR', message: '媒体审核失败' };
  }
}

const reportReviewSchema = z.object({ reportId: z.uuid(), decision: z.enum(['approved', 'rejected']), notes: z.string().trim().min(2).max(500) });

export async function closeReport(input: unknown): Promise<ActionResult> {
  try {
    const session = await requireSession(['city_admin', 'platform_admin']);
    const audit = await getAuditContext();
    await assertConfiguredCan(session.role, 'moderation:review');
    const values = reportReviewSchema.parse(input);
    const [target] = await getDatabase().select({ targetType: reports.targetType, targetId: reports.targetId, reporterId: reports.reporterId }).from(reports).where(eq(reports.id, values.reportId)).limit(1);
    if (!target) throw new Error('NOT_FOUND');
    let cityId: string | null = null;
    let targetOwnerId: string | null = target.targetType === 'user' ? target.targetId : null;
    if (target.targetType === 'post') { const row = (await getDatabase().select({ cityId: posts.cityId, ownerId: posts.authorId }).from(posts).where(eq(posts.id, target.targetId)).limit(1))[0]; cityId = row?.cityId ?? null; targetOwnerId = row?.ownerId ?? null; }
    if (target.targetType === 'comment') { const row = (await getDatabase().select({ cityId: posts.cityId, ownerId: comments.authorId }).from(comments).innerJoin(posts, eq(posts.id, comments.postId)).where(eq(comments.id, target.targetId)).limit(1))[0]; cityId = row?.cityId ?? null; targetOwnerId = row?.ownerId ?? null; }
    if (target.targetType === 'activity') { const row = (await getDatabase().select({ cityId: activities.cityId, ownerId: activities.organizerId }).from(activities).where(eq(activities.id, target.targetId)).limit(1))[0]; cityId = row?.cityId ?? null; targetOwnerId = row?.ownerId ?? null; }
    await assertCityScope(session, cityId);
    await getDatabase().transaction(async (tx) => {
      const [report] = await tx.select({ status: reports.status }).from(reports).where(eq(reports.id, values.reportId)).limit(1);
      if (!report || report.status !== 'open') throw new Error('INVALID_STATE_TRANSITION');
      await tx.update(reports).set({ status: 'reviewing', updatedAt: new Date() }).where(eq(reports.id, values.reportId));
      await tx.update(moderationCases).set({ status: 'reviewing', assigneeId: session.id, updatedAt: new Date() }).where(eq(moderationCases.reportId, values.reportId));
      if (values.decision === 'approved' && target.targetType === 'post') await tx.update(posts).set({ status: 'hidden', updatedAt: new Date() }).where(and(eq(posts.id, target.targetId), eq(posts.status, 'published')));
      if (values.decision === 'approved' && target.targetType === 'comment') {
        const [changed] = await tx.update(comments).set({ status: 'hidden', updatedAt: new Date() }).where(and(eq(comments.id, target.targetId), eq(comments.status, 'published'))).returning({ postId: comments.postId });
        if (changed) await tx.update(posts).set({ commentCount: sql`greatest(${posts.commentCount} - 1, 0)`, updatedAt: new Date() }).where(eq(posts.id, changed.postId));
      }
      if (values.decision === 'approved' && target.targetType === 'activity') {
        const [changed] = await tx.update(activities).set({ status: 'cancelled', updatedAt: new Date() }).where(and(eq(activities.id, target.targetId), eq(activities.status, 'published'))).returning({ id: activities.id });
        if (changed) await tx.insert(outboxJobs).values({ topic: 'activity.cancelled', idempotencyKey: `activity.cancelled:moderation:${target.targetId}`, payload: { activityId: target.targetId } }).onConflictDoNothing();
      }
      await tx.update(reports).set({ status: values.decision, updatedAt: new Date() }).where(eq(reports.id, values.reportId));
      await tx.update(moderationCases).set({ status: values.decision, decision: values.decision, notes: values.notes, updatedAt: new Date() }).where(eq(moderationCases.reportId, values.reportId));
      await tx.insert(notifications).values({ userId: target.reporterId, type: 'moderation', title: values.decision === 'approved' ? '举报已核实' : '举报未成立', body: values.notes, payload: { reportId: values.reportId, decision: values.decision } });
      if (values.decision === 'approved' && targetOwnerId && targetOwnerId !== target.reporterId) await tx.insert(notifications).values({ userId: targetOwnerId, type: 'moderation', title: '你的内容已被限制', body: values.notes, payload: { targetType: target.targetType, targetId: target.targetId } });
      await tx.insert(auditLogs).values({ ...audit, actorId: session.id, action: 'report.reviewed', targetType: 'report', targetId: values.reportId, before: { status: report.status }, after: { status: values.decision, decision: values.decision, notes: values.notes } });
    });
    revalidatePath('/admin/posts');
    return { ok: true };
  } catch (error) {
    return { ok: false, code: error instanceof Error ? error.message : 'INTERNAL_ERROR', message: '举报处理失败' };
  }
}

const appealReviewSchema = z.object({ appealId: z.uuid(), decision: z.enum(['approved', 'rejected']), notes: z.string().trim().min(2).max(500) });

export async function reviewAppeal(input: unknown): Promise<ActionResult> {
  try {
    const session = await requireSession(['city_admin', 'platform_admin']);
    const audit = await getAuditContext();
    await assertConfiguredCan(session.role, 'moderation:review');
    const values = appealReviewSchema.parse(input);
    const [appeal] = await getDatabase().select({ appellantId: moderationAppeals.appellantId, targetType: moderationAppeals.targetType, targetId: moderationAppeals.targetId, status: moderationAppeals.status }).from(moderationAppeals).where(eq(moderationAppeals.id, values.appealId)).limit(1);
    if (!appeal) throw new Error('NOT_FOUND');
    let cityId: string | null = null;
    if (appeal.targetType === 'post') cityId = (await getDatabase().select({ cityId: posts.cityId }).from(posts).where(eq(posts.id, appeal.targetId)).limit(1))[0]?.cityId ?? null;
    if (appeal.targetType === 'comment') cityId = (await getDatabase().select({ cityId: posts.cityId }).from(comments).innerJoin(posts, eq(posts.id, comments.postId)).where(eq(comments.id, appeal.targetId)).limit(1))[0]?.cityId ?? null;
    if (appeal.targetType === 'activity') cityId = (await getDatabase().select({ cityId: activities.cityId }).from(activities).where(eq(activities.id, appeal.targetId)).limit(1))[0]?.cityId ?? null;
    await assertCityScope(session, cityId);
    await getDatabase().transaction(async (tx) => {
      if (!['open', 'reviewing'].includes(appeal.status)) throw new Error('INVALID_STATE_TRANSITION');
      await tx.update(moderationAppeals).set({ status: 'reviewing', updatedAt: new Date() }).where(eq(moderationAppeals.id, values.appealId));
      await tx.update(moderationCases).set({ status: 'reviewing', assigneeId: session.id, updatedAt: new Date() }).where(and(eq(moderationCases.targetType, appeal.targetType), eq(moderationCases.targetId, appeal.targetId), eq(moderationCases.status, 'appealed')));
      if (values.decision === 'approved' && appeal.targetType === 'post') await tx.update(posts).set({ status: 'published', deletedAt: null, publishedAt: new Date(), updatedAt: new Date() }).where(eq(posts.id, appeal.targetId));
      if (values.decision === 'approved' && appeal.targetType === 'comment') {
        const changed = await tx.update(comments).set({ status: 'published', deletedAt: null, updatedAt: new Date() }).where(and(eq(comments.id, appeal.targetId), sql`${comments.status} <> 'published'`)).returning({ postId: comments.postId });
        if (changed[0]) await tx.update(posts).set({ commentCount: sql`${posts.commentCount} + 1`, updatedAt: new Date() }).where(eq(posts.id, changed[0].postId));
      }
      if (values.decision === 'approved' && appeal.targetType === 'activity') await tx.update(activities).set({ status: 'pending', updatedAt: new Date() }).where(and(eq(activities.id, appeal.targetId), eq(activities.status, 'cancelled')));
      await tx.update(moderationAppeals).set({ status: values.decision, decision: values.decision, notes: values.notes, updatedAt: new Date() }).where(eq(moderationAppeals.id, values.appealId));
      await tx.update(moderationCases).set({ status: 'closed', decision: `appeal_${values.decision}`, notes: values.notes, updatedAt: new Date() }).where(and(eq(moderationCases.targetType, appeal.targetType), eq(moderationCases.targetId, appeal.targetId), eq(moderationCases.status, 'reviewing')));
      await tx.insert(notifications).values({ userId: appeal.appellantId, type: 'moderation', title: values.decision === 'approved' ? '申诉已通过' : '申诉未通过', body: values.notes, payload: { appealId: values.appealId, decision: values.decision } });
      await tx.insert(auditLogs).values({ ...audit, actorId: session.id, action: 'appeal.reviewed', targetType: 'appeal', targetId: values.appealId, before: { status: appeal.status }, after: { status: values.decision, notes: values.notes } });
    });
    revalidatePath('/admin/posts');
    revalidatePath('/me/appeals');
    return { ok: true };
  } catch (error) {
    return { ok: false, code: error instanceof Error ? error.message : 'INTERNAL_ERROR', message: '申诉处理失败' };
  }
}

const applicationReviewSchema = z.object({
  kind: z.enum(['opc', 'organization']),
  applicationId: z.uuid(),
  decision: z.enum(['approved', 'rejected']),
  notes: z.string().trim().min(2).max(1_000),
});

export async function reviewApplication(input: unknown): Promise<ActionResult> {
  try {
    const session = await requireSession(['platform_admin']);
    const audit = await getAuditContext();
    const values = applicationReviewSchema.parse(input);
    const table = values.kind === 'opc' ? opcVerificationApplications : organizationApplications;
    await getDatabase().transaction(async (tx) => {
      const [current] = await tx.select({ status: table.status, userId: table.userId }).from(table).where(eq(table.id, values.applicationId)).limit(1);
      if (!current) throw new Error('NOT_FOUND');
      if (!['submitted', 'reviewing'].includes(current.status)) throw new Error('INVALID_STATE_TRANSITION');
      await tx.update(table).set({ status: values.decision, reviewerId: session.id, reviewNotes: values.notes, reviewedAt: new Date(), updatedAt: new Date() }).where(eq(table.id, values.applicationId));
      await tx.insert(notifications).values({ userId: current.userId, type: 'system', title: values.decision === 'approved' ? '申请已通过' : '申请未通过', body: values.notes, payload: { kind: values.kind, applicationId: values.applicationId, decision: values.decision } });
      await tx.insert(auditLogs).values({ ...audit, actorId: session.id, action: `${values.kind}_application.${values.decision}`, targetType: `${values.kind}_application`, targetId: values.applicationId, before: { status: current.status }, after: { status: values.decision, notes: values.notes } });
    });
    revalidatePath('/admin/applications');
    revalidatePath('/me/applications');
    revalidatePath('/');
    return { ok: true };
  } catch (error) {
    if (error instanceof z.ZodError) return { ok: false, code: 'VALIDATION_ERROR', message: '申请审核参数不正确' };
    return { ok: false, code: error instanceof Error ? error.message : 'INTERNAL_ERROR', message: '申请审核失败' };
  }
}

const ticketReviewSchema = z.object({ ticketId: z.uuid(), resolution: z.string().trim().min(2).max(2_000) });

export async function resolveHelpTicket(input: unknown): Promise<ActionResult> {
  try {
    const session = await requireSession(['platform_admin']);
    const audit = await getAuditContext();
    const values = ticketReviewSchema.parse(input);
    const [changed] = await getDatabase().update(helpTickets).set({ status: 'resolved', assigneeId: session.id, resolution: values.resolution, resolvedAt: new Date(), updatedAt: new Date() })
      .where(and(eq(helpTickets.id, values.ticketId), sql`${helpTickets.status} in ('open', 'in_progress')`)).returning({ id: helpTickets.id });
    if (!changed) throw new Error('NOT_FOUND');
    await getDatabase().insert(auditLogs).values({ ...audit, actorId: session.id, action: 'help_ticket.resolved', targetType: 'help_ticket', targetId: values.ticketId, after: { status: 'resolved' } });
    revalidatePath('/admin/applications');
    return { ok: true };
  } catch (error) {
    if (error instanceof z.ZodError) return { ok: false, code: 'VALIDATION_ERROR', message: '处理结果至少需要 2 个字' };
    return { ok: false, code: error instanceof Error ? error.message : 'INTERNAL_ERROR', message: '工单处理失败' };
  }
}

const deadLetterResolutionSchema = z.object({ deadLetterId: z.uuid(), action: z.enum(['replay', 'ignore']), notes: z.string().trim().min(2).max(1_000) });

export async function resolveDeadLetter(input: unknown): Promise<ActionResult> {
  try {
    const session = await requireSession(['platform_admin']);
    const audit = await getAuditContext();
    await assertConfiguredCan(session.role, 'platform:manage');
    const values = deadLetterResolutionSchema.parse(input);
    await getDatabase().transaction(async (tx) => {
      const [item] = await tx.select({ status: deadLetterJobs.status, outboxJobId: deadLetterJobs.outboxJobId }).from(deadLetterJobs).where(eq(deadLetterJobs.id, values.deadLetterId)).limit(1);
      if (!item || item.status !== 'open') throw new Error('INVALID_STATE_TRANSITION');
      if (values.action === 'replay') await tx.update(outboxJobs).set({ status: 'pending', attempts: 0, availableAt: new Date(), processedAt: null, lastError: null }).where(eq(outboxJobs.id, item.outboxJobId));
      await tx.update(deadLetterJobs).set({ status: values.action === 'replay' ? 'replayed' : 'ignored', resolutionNotes: values.notes, resolvedBy: session.id, resolvedAt: new Date() }).where(eq(deadLetterJobs.id, values.deadLetterId));
      await tx.insert(auditLogs).values({ ...audit, actorId: session.id, action: `dead_letter.${values.action}`, targetType: 'dead_letter', targetId: values.deadLetterId, after: { notes: values.notes, outboxJobId: item.outboxJobId } });
    });
    revalidatePath('/admin/operations');
    return { ok: true };
  } catch (error) {
    if (error instanceof z.ZodError) return { ok: false, code: 'VALIDATION_ERROR', message: '处置说明至少需要 2 个字' };
    return { ok: false, code: error instanceof Error ? error.message : 'INTERNAL_ERROR', message: '死信处置失败' };
  }
}

const accountDeletionSchema = z.object({ userId: z.uuid(), notes: z.string().trim().min(10).max(2_000) });

export async function completeAccountDeletion(input: unknown): Promise<ActionResult> {
  try {
    const session = await requireSession(['platform_admin']);
    const audit = await getAuditContext();
    await assertConfiguredCan(session.role, 'platform:manage');
    const values = accountDeletionSchema.parse(input);
    if (values.userId === session.id) throw new Error('CANNOT_DELETE_SELF');
    await getDatabase().transaction(async (tx) => {
      const [account] = await tx.select({ status: users.status }).from(users).where(eq(users.id, values.userId)).limit(1);
      if (!account || account.status !== 'deletion_requested') throw new Error('INVALID_STATE_TRANSITION');
      const [memberships, registrationRows, reactionRows, saveRows, shareRows, voteRows] = await Promise.all([
        tx.select({ cityId: cityMemberships.cityId }).from(cityMemberships).where(eq(cityMemberships.userId, values.userId)),
        tx.select({ activityId: registrations.activityId }).from(registrations).where(and(eq(registrations.userId, values.userId), eq(registrations.status, 'registered'))),
        tx.select({ postId: reactions.postId }).from(reactions).where(eq(reactions.userId, values.userId)),
        tx.select({ postId: saves.postId }).from(saves).where(eq(saves.userId, values.userId)),
        tx.select({ postId: postShares.postId }).from(postShares).where(eq(postShares.userId, values.userId)),
        tx.select({ pollId: pollVotes.pollId, optionId: pollVotes.optionId }).from(pollVotes).where(eq(pollVotes.userId, values.userId)),
      ]);
      for (const item of memberships) await tx.update(cities).set({ memberCount: sql`greatest(${cities.memberCount} - 1, 0)`, updatedAt: new Date() }).where(eq(cities.id, item.cityId));
      for (const item of registrationRows) await tx.update(activities).set({ registrationCount: sql`greatest(${activities.registrationCount} - 1, 0)`, updatedAt: new Date() }).where(eq(activities.id, item.activityId));
      for (const item of reactionRows) await tx.update(posts).set({ reactionCount: sql`greatest(${posts.reactionCount} - 1, 0)`, updatedAt: new Date() }).where(eq(posts.id, item.postId));
      for (const item of saveRows) await tx.update(posts).set({ saveCount: sql`greatest(${posts.saveCount} - 1, 0)`, updatedAt: new Date() }).where(eq(posts.id, item.postId));
      for (const item of shareRows) await tx.update(posts).set({ shareCount: sql`greatest(${posts.shareCount} - 1, 0)`, updatedAt: new Date() }).where(eq(posts.id, item.postId));
      for (const item of voteRows) await tx.update(polls).set({ options: sql`(select jsonb_agg(case when option->>'id' = ${item.optionId}::text then jsonb_set(option, '{votes}', to_jsonb(greatest(coalesce((option->>'votes')::int, 0) - 1, 0))) else option end) from jsonb_array_elements(${polls.options}) option)`, updatedAt: new Date() }).where(eq(polls.id, item.pollId));
      await tx.delete(cityMemberships).where(eq(cityMemberships.userId, values.userId));
      await tx.delete(registrations).where(eq(registrations.userId, values.userId));
      await tx.delete(reactions).where(eq(reactions.userId, values.userId));
      await tx.delete(saves).where(eq(saves.userId, values.userId));
      await tx.delete(postShares).where(eq(postShares.userId, values.userId));
      await tx.delete(pollVotes).where(eq(pollVotes.userId, values.userId));
      await tx.delete(follows).where(or(eq(follows.followerId, values.userId), eq(follows.followingId, values.userId)));
      await tx.delete(userBlocks).where(or(eq(userBlocks.blockerId, values.userId), eq(userBlocks.blockedId, values.userId)));
      await tx.delete(notifications).where(eq(notifications.userId, values.userId));
      await tx.delete(opcVerificationApplications).where(eq(opcVerificationApplications.userId, values.userId));
      await tx.delete(organizationApplications).where(eq(organizationApplications.userId, values.userId));
      await tx.update(helpTickets).set({ userId: null, requesterName: '已注销用户', contact: '已移除', description: '账号注销后已移除用户提交内容', updatedAt: new Date() }).where(eq(helpTickets.userId, values.userId));
      await tx.update(media).set({ publicKey: null, status: 'rejected', updatedAt: new Date() }).where(eq(media.ownerId, values.userId));
      await tx.update(profiles).set({ nickname: `已注销用户-${values.userId.slice(0, 8)}`, avatarKey: null, bio: null, occupationTags: [], updatedAt: new Date() }).where(eq(profiles.userId, values.userId));
      await tx.update(sessions).set({ revokedAt: new Date() }).where(eq(sessions.userId, values.userId));
      await tx.update(users).set({ phoneHash: createHash('sha256').update(`deleted:${values.userId}:${randomUUID()}`).digest('hex'), phoneEncrypted: 'deleted', role: 'user', status: 'deleted', activityCreatorApprovedAt: null, activityCreatorRequestedAt: null, deletionReviewNotes: values.notes, deletionCompletedAt: new Date(), updatedAt: new Date() }).where(eq(users.id, values.userId));
      await tx.insert(auditLogs).values({ ...audit, actorId: session.id, action: 'account.deletion_completed', targetType: 'user', targetId: values.userId, before: { status: account.status }, after: { status: 'deleted', retentionAssessment: values.notes } });
    });
    revalidatePath('/admin/users');
    return { ok: true };
  } catch (error) {
    if (error instanceof z.ZodError) return { ok: false, code: 'VALIDATION_ERROR', message: '保留评估至少需要 10 个字' };
    return { ok: false, code: error instanceof Error ? error.message : 'INTERNAL_ERROR', message: '账号注销处理失败' };
  }
}
