'use server';

import { randomUUID } from 'node:crypto';
import { and, count, eq, gte, sql } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { getDatabase } from '@/db';
import { cityMemberships, media, polls, posts, users } from '@/db/schema';
import { requireSession } from '@/server/auth/session';
import { moderateText } from '@/server/domain/moderation';
import { getServerEnv } from '@/lib/env';
import { createCommentForUser } from '@/server/services/comments';

export type ActionResult<T = undefined> = { ok: true; data?: T } | { ok: false; code: string; message: string };

const postSchema = z.object({ cityId: z.uuid(), content: z.string().trim().min(1).max(5_000), topics: z.array(z.string().trim().min(1).max(30)).max(8).default([]), mediaIds: z.array(z.uuid()).max(9).default([]), poll: z.object({ question: z.string().trim().min(2).max(240), options: z.array(z.string().trim().min(1).max(120)).min(2).max(6), closesAt: z.coerce.date().optional() }).optional() });
const commentSchema = z.object({ postId: z.uuid(), parentId: z.uuid().optional(), content: z.string().trim().min(1).max(1_000) });
const editPostSchema = z.object({ postId: z.uuid(), content: z.string().trim().min(1).max(5_000), topics: z.array(z.string().trim().min(1).max(30)).max(8).default([]) });

export async function createPost(input: unknown): Promise<ActionResult<{ postId: string; status: string }>> {
  try {
    const session = await requireSession();
    const values = postSchema.parse(input);
    const decision = moderateText(values.content);
    if (decision === 'reject') return { ok: false, code: 'CONTENT_REJECTED', message: '内容未通过发布规则，请修改后重试' };
    const status = decision === 'review' ? 'pending' : 'published';
    const post = await getDatabase().transaction(async (tx) => {
      await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${session.id}))`);
      const [account] = await tx.select({ createdAt: users.createdAt }).from(users).where(eq(users.id, session.id)).limit(1);
      if (!account) throw new Error('UNAUTHORIZED');
      const [membership] = await tx.select({ cityId: cityMemberships.cityId }).from(cityMemberships).where(and(eq(cityMemberships.cityId, values.cityId), eq(cityMemberships.userId, session.id))).limit(1);
      if (!membership) throw new Error('CITY_MEMBERSHIP_REQUIRED');
      if (Date.now() - account.createdAt.getTime() < 86_400_000) {
        const [daily] = await tx.select({ value: count() }).from(posts).where(and(eq(posts.authorId, session.id), gte(posts.createdAt, new Date(Date.now() - 86_400_000))));
        if (daily.value >= getServerEnv().NEW_ACCOUNT_POST_LIMIT) throw new Error('NEW_ACCOUNT_LIMIT');
      }
      if (values.mediaIds.length > 0) {
        const ownedMedia = await tx.select({ id: media.id, kind: media.kind }).from(media).where(and(eq(media.ownerId, session.id), eq(media.status, 'uploaded'), sql`${media.id} = any(${values.mediaIds}::uuid[])`));
        if (ownedMedia.length !== values.mediaIds.length || ownedMedia.filter((item) => item.kind === 'video').length > 1) throw new Error('INVALID_MEDIA');
      }
      const [created] = await tx.insert(posts).values({ authorId: session.id, cityId: values.cityId, content: values.content, topics: values.topics, status, publishedAt: status === 'published' ? new Date() : null }).returning({ id: posts.id });
      if (values.mediaIds.length > 0) await tx.update(media).set({ postId: created.id, updatedAt: new Date() }).where(and(eq(media.ownerId, session.id), sql`${media.id} = any(${values.mediaIds}::uuid[])`));
      if (values.poll) await tx.insert(polls).values({ postId: created.id, question: values.poll.question, options: values.poll.options.map((label) => ({ id: randomUUID(), label, votes: 0 })), closesAt: values.poll.closesAt });
      return created;
    });
    revalidatePath('/cities');
    return { ok: true, data: { postId: post.id, status } };
  } catch (error) {
    if (error instanceof z.ZodError) return { ok: false, code: 'VALIDATION_ERROR', message: '动态内容格式不正确' };
    if (error instanceof Error && error.message === 'NEW_ACCOUNT_LIMIT') return { ok: false, code: error.message, message: '新账号 24 小时内最多发布 3 条动态' };
    if (error instanceof Error && error.message === 'INVALID_MEDIA') return { ok: false, code: error.message, message: '媒体文件无效、尚未完成上传或视频数量超过限制' };
    if (error instanceof Error && error.message === 'CITY_MEMBERSHIP_REQUIRED') return { ok: false, code: error.message, message: '请先加入城市社区再发布动态' };
    if (error instanceof Error && ['UNAUTHORIZED', 'FORBIDDEN'].includes(error.message)) return { ok: false, code: error.message, message: '没有执行此操作的权限' };
    return { ok: false, code: 'INTERNAL_ERROR', message: '发布失败，请稍后再试' };
  }
}

export async function createComment(input: unknown): Promise<ActionResult<{ commentId: string; status: string }>> {
  try {
    const session = await requireSession();
    const values = commentSchema.parse(input);
    const decision = moderateText(values.content);
    if (decision === 'reject') return { ok: false, code: 'CONTENT_REJECTED', message: '回复未通过发布规则' };
    const status = decision === 'review' ? 'pending' : 'published';
    const comment = await createCommentForUser({ ...values, userId: session.id, status });
    revalidatePath(`/posts/${values.postId}`);
    return { ok: true, data: { commentId: comment.id, status } };
  } catch (error) {
    if (error instanceof z.ZodError) return { ok: false, code: 'VALIDATION_ERROR', message: '回复格式不正确' };
    if (error instanceof Error && error.message === 'NEW_ACCOUNT_LIMIT') return { ok: false, code: error.message, message: '新账号 24 小时内最多发布 20 条评论' };
    if (error instanceof Error && ['POST_NOT_FOUND', 'PARENT_COMMENT_NOT_FOUND'].includes(error.message)) return { ok: false, code: error.message, message: '动态或回复目标不存在' };
    return { ok: false, code: error instanceof Error ? error.message : 'INTERNAL_ERROR', message: '回复失败，请稍后再试' };
  }
}

export async function editOwnPost(input: unknown): Promise<ActionResult<{ status: string }>> {
  try {
    const session = await requireSession();
    const values = editPostSchema.parse(input);
    const decision = moderateText(values.content);
    if (decision === 'reject') return { ok: false, code: 'CONTENT_REJECTED', message: '内容未通过发布规则' };
    const status = decision === 'review' ? 'pending' : 'published';
    const changed = await getDatabase().update(posts).set({ content: values.content, topics: values.topics, status, publishedAt: status === 'published' ? new Date() : null, updatedAt: new Date() }).where(and(eq(posts.id, values.postId), eq(posts.authorId, session.id), sql`${posts.status} <> 'deleted'`)).returning({ id: posts.id });
    if (!changed[0]) return { ok: false, code: 'NOT_FOUND', message: '动态不存在或不可编辑' };
    revalidatePath(`/posts/${values.postId}`);
    revalidatePath('/me/posts');
    return { ok: true, data: { status } };
  } catch (error) {
    if (error instanceof z.ZodError) return { ok: false, code: 'VALIDATION_ERROR', message: '动态内容格式不正确' };
    return { ok: false, code: error instanceof Error ? error.message : 'INTERNAL_ERROR', message: '动态编辑失败' };
  }
}

export async function deleteOwnPost(input: unknown): Promise<ActionResult> {
  try {
    const session = await requireSession();
    const postId = z.uuid().parse(input);
    const changed = await getDatabase().update(posts).set({ status: 'deleted', deletedAt: new Date(), updatedAt: new Date() }).where(and(eq(posts.id, postId), eq(posts.authorId, session.id), sql`${posts.status} <> 'deleted'`)).returning({ id: posts.id });
    if (!changed[0]) return { ok: false, code: 'NOT_FOUND', message: '动态不存在或已经删除' };
    revalidatePath(`/posts/${postId}`);
    revalidatePath('/me/posts');
    return { ok: true };
  } catch (error) {
    return { ok: false, code: error instanceof Error ? error.message : 'INTERNAL_ERROR', message: '动态删除失败' };
  }
}
