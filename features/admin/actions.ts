'use server';

import { and, eq, sql } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { getDatabase } from '@/db';
import { activities, auditLogs, cityMemberships, comments, insights, knowledgeArticles, media, moderationAppeals, posts, profiles, reports, sessions, users } from '@/db/schema';
import type { ActionResult } from '@/features/posts/actions';
import { requireSession } from '@/server/auth/session';
import { assertCan } from '@/server/domain/rbac';
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
    assertCan(session.role, 'moderation:review');
    const values = postModerationSchema.parse(input);
    const [scopePost] = await getDatabase().select({ cityId: posts.cityId }).from(posts).where(eq(posts.id, values.postId)).limit(1);
    if (!scopePost) throw new Error('NOT_FOUND');
    await assertCityScope(session, scopePost.cityId);
    await getDatabase().transaction(async (tx) => {
      const [post] = await tx.select({ status: posts.status }).from(posts).where(eq(posts.id, values.postId)).limit(1);
      if (!post) throw new Error('NOT_FOUND');
      if (!canTransitionPost(post.status as PostStatus, values.targetStatus)) throw new Error('INVALID_STATE_TRANSITION');
      await tx.update(posts).set({ status: values.targetStatus, deletedAt: values.targetStatus === 'deleted' ? new Date() : null, updatedAt: new Date() }).where(eq(posts.id, values.postId));
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
    assertCan(session.role, 'moderation:review');
    const values = commentModerationSchema.parse(input);
    const [scopeComment] = await getDatabase().select({ cityId: posts.cityId }).from(comments).innerJoin(posts, eq(posts.id, comments.postId)).where(eq(comments.id, values.commentId)).limit(1);
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
    assertCan(session.role, 'activity:approve');
    const values = activityReviewSchema.parse(input);
    const [scopeActivity] = await getDatabase().select({ cityId: activities.cityId }).from(activities).where(eq(activities.id, values.activityId)).limit(1);
    if (!scopeActivity) throw new Error('NOT_FOUND');
    await assertCityScope(session, scopeActivity.cityId);
    await getDatabase().transaction(async (tx) => {
      const [activity] = await tx.select({ status: activities.status }).from(activities).where(eq(activities.id, values.activityId)).limit(1);
      if (!activity) throw new Error('NOT_FOUND');
      if (!canTransitionActivity(activity.status as ActivityStatus, values.targetStatus)) throw new Error('INVALID_STATE_TRANSITION');
      await tx.update(activities).set({ status: values.targetStatus, updatedAt: new Date() }).where(eq(activities.id, values.activityId));
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
    assertCan(session.role, 'platform:manage');
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
    assertCan(session.role, 'platform:manage');
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

const cityAdminSchema = z.object({ cityId: z.uuid(), userId: z.uuid(), enabled: z.boolean(), reason: z.string().trim().min(2).max(500) });

export async function setCityAdmin(input: unknown): Promise<ActionResult> {
  try {
    const session = await requireSession(['platform_admin']);
    const audit = await getAuditContext();
    assertCan(session.role, 'platform:manage');
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
    assertCan(session.role, 'knowledge:publish');
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
    assertCan(session.role, 'moderation:review');
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
    assertCan(session.role, 'moderation:review');
    const values = reportReviewSchema.parse(input);
    const [target] = await getDatabase().select({ targetType: reports.targetType, targetId: reports.targetId }).from(reports).where(eq(reports.id, values.reportId)).limit(1);
    if (!target) throw new Error('NOT_FOUND');
    let cityId: string | null = null;
    if (target.targetType === 'post') cityId = (await getDatabase().select({ cityId: posts.cityId }).from(posts).where(eq(posts.id, target.targetId)).limit(1))[0]?.cityId ?? null;
    if (target.targetType === 'comment') cityId = (await getDatabase().select({ cityId: posts.cityId }).from(comments).innerJoin(posts, eq(posts.id, comments.postId)).where(eq(comments.id, target.targetId)).limit(1))[0]?.cityId ?? null;
    if (target.targetType === 'activity') cityId = (await getDatabase().select({ cityId: activities.cityId }).from(activities).where(eq(activities.id, target.targetId)).limit(1))[0]?.cityId ?? null;
    await assertCityScope(session, cityId);
    await getDatabase().transaction(async (tx) => {
      const [report] = await tx.select({ status: reports.status }).from(reports).where(eq(reports.id, values.reportId)).limit(1);
      if (!report) throw new Error('NOT_FOUND');
      await tx.update(reports).set({ status: 'closed', updatedAt: new Date() }).where(eq(reports.id, values.reportId));
      await tx.insert(auditLogs).values({ ...audit, actorId: session.id, action: 'report.reviewed', targetType: 'report', targetId: values.reportId, before: { status: report.status }, after: { status: 'closed', decision: values.decision, notes: values.notes } });
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
    assertCan(session.role, 'moderation:review');
    const values = appealReviewSchema.parse(input);
    const [appeal] = await getDatabase().select({ targetType: moderationAppeals.targetType, targetId: moderationAppeals.targetId, status: moderationAppeals.status }).from(moderationAppeals).where(eq(moderationAppeals.id, values.appealId)).limit(1);
    if (!appeal) throw new Error('NOT_FOUND');
    let cityId: string | null = null;
    if (appeal.targetType === 'post') cityId = (await getDatabase().select({ cityId: posts.cityId }).from(posts).where(eq(posts.id, appeal.targetId)).limit(1))[0]?.cityId ?? null;
    if (appeal.targetType === 'comment') cityId = (await getDatabase().select({ cityId: posts.cityId }).from(comments).innerJoin(posts, eq(posts.id, comments.postId)).where(eq(comments.id, appeal.targetId)).limit(1))[0]?.cityId ?? null;
    if (appeal.targetType === 'activity') cityId = (await getDatabase().select({ cityId: activities.cityId }).from(activities).where(eq(activities.id, appeal.targetId)).limit(1))[0]?.cityId ?? null;
    await assertCityScope(session, cityId);
    await getDatabase().transaction(async (tx) => {
      await tx.update(moderationAppeals).set({ status: values.decision, decision: values.decision, notes: values.notes, updatedAt: new Date() }).where(eq(moderationAppeals.id, values.appealId));
      if (values.decision === 'approved' && appeal.targetType === 'post') await tx.update(posts).set({ status: 'published', deletedAt: null, publishedAt: new Date(), updatedAt: new Date() }).where(eq(posts.id, appeal.targetId));
      if (values.decision === 'approved' && appeal.targetType === 'comment') {
        const changed = await tx.update(comments).set({ status: 'published', deletedAt: null, updatedAt: new Date() }).where(and(eq(comments.id, appeal.targetId), sql`${comments.status} <> 'published'`)).returning({ postId: comments.postId });
        if (changed[0]) await tx.update(posts).set({ commentCount: sql`${posts.commentCount} + 1`, updatedAt: new Date() }).where(eq(posts.id, changed[0].postId));
      }
      await tx.insert(auditLogs).values({ ...audit, actorId: session.id, action: 'appeal.reviewed', targetType: 'appeal', targetId: values.appealId, before: { status: appeal.status }, after: { status: values.decision, notes: values.notes } });
    });
    revalidatePath('/admin/posts');
    revalidatePath('/me/appeals');
    return { ok: true };
  } catch (error) {
    return { ok: false, code: error instanceof Error ? error.message : 'INTERNAL_ERROR', message: '申诉处理失败' };
  }
}
