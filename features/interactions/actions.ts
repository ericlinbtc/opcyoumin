'use server';

import { and, count, eq, gte, or, sql } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { getDatabase } from '@/db';
import { activities, comments, follows, moderationAppeals, moderationCases, outboxJobs, polls, pollVotes, posts, postShares, reactions, reports, saves, userBlocks, users } from '@/db/schema';
import type { ActionResult } from '@/features/posts/actions';
import { requireSession } from '@/server/auth/session';

const uuidSchema = z.uuid();

export async function toggleReaction(input: unknown): Promise<ActionResult<{ active: boolean }>> {
  try {
    const session = await requireSession();
    const postId = uuidSchema.parse(input);
    const active = await getDatabase().transaction(async (tx) => {
      const [target] = await tx.select({ id: posts.id }).from(posts).where(and(eq(posts.id, postId), eq(posts.status, 'published'))).limit(1);
      if (!target) throw new Error('POST_NOT_FOUND');
      const inserted = await tx.insert(reactions).values({ userId: session.id, postId }).onConflictDoNothing().returning({ postId: reactions.postId });
      if (inserted.length > 0) {
        await tx.update(posts).set({ reactionCount: sql`${posts.reactionCount} + 1`, updatedAt: new Date() }).where(eq(posts.id, postId));
        await tx.insert(outboxJobs).values({ topic: 'reaction.created', idempotencyKey: `reaction.created:${session.id}:${postId}`, payload: { actorId: session.id, postId } }).onConflictDoNothing();
        return true;
      }
      await tx.delete(reactions).where(and(eq(reactions.userId, session.id), eq(reactions.postId, postId)));
      await tx.update(posts).set({ reactionCount: sql`greatest(${posts.reactionCount} - 1, 0)`, updatedAt: new Date() }).where(eq(posts.id, postId));
      return false;
    });
    revalidatePath(`/posts/${postId}`);
    return { ok: true, data: { active } };
  } catch (error) {
    return { ok: false, code: error instanceof Error ? error.message : 'INTERNAL_ERROR', message: '互动失败，请稍后重试' };
  }
}

export async function toggleSave(input: unknown): Promise<ActionResult<{ active: boolean }>> {
  try {
    const session = await requireSession();
    const postId = uuidSchema.parse(input);
    const active = await getDatabase().transaction(async (tx) => {
      const [target] = await tx.select({ id: posts.id }).from(posts).where(and(eq(posts.id, postId), eq(posts.status, 'published'))).limit(1);
      if (!target) throw new Error('POST_NOT_FOUND');
      const inserted = await tx.insert(saves).values({ userId: session.id, postId }).onConflictDoNothing().returning({ postId: saves.postId });
      if (inserted.length > 0) {
        await tx.update(posts).set({ saveCount: sql`${posts.saveCount} + 1`, updatedAt: new Date() }).where(eq(posts.id, postId));
        return true;
      }
      await tx.delete(saves).where(and(eq(saves.userId, session.id), eq(saves.postId, postId)));
      await tx.update(posts).set({ saveCount: sql`greatest(${posts.saveCount} - 1, 0)`, updatedAt: new Date() }).where(eq(posts.id, postId));
      return false;
    });
    revalidatePath(`/posts/${postId}`);
    return { ok: true, data: { active } };
  } catch (error) {
    return { ok: false, code: error instanceof Error ? error.message : 'INTERNAL_ERROR', message: '收藏失败，请稍后重试' };
  }
}

export async function toggleFollow(input: unknown): Promise<ActionResult<{ active: boolean }>> {
  try {
    const session = await requireSession();
    const followingId = uuidSchema.parse(input);
    if (followingId === session.id) return { ok: false, code: 'CANNOT_FOLLOW_SELF', message: '不能关注自己' };
    const active = await getDatabase().transaction(async (tx) => {
      const inserted = await tx.insert(follows).values({ followerId: session.id, followingId }).onConflictDoNothing().returning({ followingId: follows.followingId });
      if (inserted.length > 0) {
        await tx.insert(outboxJobs).values({ topic: 'follow.created', idempotencyKey: `follow.created:${session.id}:${followingId}`, payload: { actorId: session.id, followingId } }).onConflictDoNothing();
        return true;
      }
      await tx.delete(follows).where(and(eq(follows.followerId, session.id), eq(follows.followingId, followingId)));
      return false;
    });
    return { ok: true, data: { active } };
  } catch (error) {
    return { ok: false, code: error instanceof Error ? error.message : 'INTERNAL_ERROR', message: '关注失败，请稍后重试' };
  }
}

export async function recordShare(input: unknown): Promise<ActionResult<{ counted: boolean }>> {
  try {
    const session = await requireSession();
    const postId = uuidSchema.parse(input);
    const counted = await getDatabase().transaction(async (tx) => {
      const [target] = await tx.select({ id: posts.id }).from(posts).where(and(eq(posts.id, postId), eq(posts.status, 'published'))).limit(1);
      if (!target) throw new Error('POST_NOT_FOUND');
      const inserted = await tx.insert(postShares).values({ userId: session.id, postId }).onConflictDoNothing().returning({ postId: postShares.postId });
      if (inserted[0]) await tx.update(posts).set({ shareCount: sql`${posts.shareCount} + 1`, updatedAt: new Date() }).where(and(eq(posts.id, postId), eq(posts.status, 'published')));
      return Boolean(inserted[0]);
    });
    return { ok: true, data: { counted } };
  } catch (error) {
    return { ok: false, code: error instanceof Error ? error.message : 'INTERNAL_ERROR', message: '分享记录失败' };
  }
}

export async function toggleBlock(input: unknown): Promise<ActionResult<{ active: boolean }>> {
  try {
    const session = await requireSession();
    const blockedId = uuidSchema.parse(input);
    if (blockedId === session.id) return { ok: false, code: 'CANNOT_BLOCK_SELF', message: '不能屏蔽自己' };
    const active = await getDatabase().transaction(async (tx) => {
      const inserted = await tx.insert(userBlocks).values({ blockerId: session.id, blockedId }).onConflictDoNothing().returning({ blockedId: userBlocks.blockedId });
      if (inserted[0]) {
        await tx.delete(follows).where(or(and(eq(follows.followerId, session.id), eq(follows.followingId, blockedId)), and(eq(follows.followerId, blockedId), eq(follows.followingId, session.id))));
        return true;
      }
      await tx.delete(userBlocks).where(and(eq(userBlocks.blockerId, session.id), eq(userBlocks.blockedId, blockedId)));
      return false;
    });
    revalidatePath(`/members/${blockedId}`);
    revalidatePath('/cities');
    return { ok: true, data: { active } };
  } catch (error) {
    return { ok: false, code: error instanceof Error ? error.message : 'INTERNAL_ERROR', message: '屏蔽操作失败' };
  }
}

const reportSchema = z.object({
  targetType: z.enum(['post', 'comment', 'activity', 'user']),
  targetId: z.uuid(),
  reason: z.string().trim().min(2).max(80),
  details: z.string().trim().max(1_000).optional(),
});

export async function createReport(input: unknown): Promise<ActionResult<{ reportId: string }>> {
  try {
    const session = await requireSession();
    const values = reportSchema.parse(input);
    if (values.targetType === 'user' && values.targetId === session.id) return { ok: false, code: 'CANNOT_REPORT_SELF', message: '不能举报自己' };
    const db = getDatabase();
    const [dailyReports] = await db.select({ value: count() }).from(reports).where(and(eq(reports.reporterId, session.id), gte(reports.createdAt, new Date(Date.now() - 86_400_000))));
    if (dailyReports.value >= 20) return { ok: false, code: 'RATE_LIMITED', message: '今日举报次数已达上限，请明日再试' };
    const targetExists = values.targetType === 'post'
      ? Boolean((await db.select({ id: posts.id }).from(posts).where(and(eq(posts.id, values.targetId), eq(posts.status, 'published'))).limit(1))[0])
      : values.targetType === 'comment'
        ? Boolean((await db.select({ id: comments.id }).from(comments).where(and(eq(comments.id, values.targetId), eq(comments.status, 'published'))).limit(1))[0])
        : values.targetType === 'activity'
          ? Boolean((await db.select({ id: activities.id }).from(activities).where(and(eq(activities.id, values.targetId), eq(activities.status, 'published'))).limit(1))[0])
          : Boolean((await db.select({ id: users.id }).from(users).where(and(eq(users.id, values.targetId), eq(users.status, 'active'))).limit(1))[0]);
    if (!targetExists) return { ok: false, code: 'TARGET_NOT_FOUND', message: '举报目标不存在或当前不可举报' };
    const report = await db.transaction(async (tx) => {
      const [created] = await tx.insert(reports).values({ ...values, reporterId: session.id }).onConflictDoNothing().returning({ id: reports.id });
      if (created) await tx.insert(moderationCases).values({ reportId: created.id, targetType: values.targetType, targetId: values.targetId, status: 'open' });
      return created;
    });
    if (!report) return { ok: false, code: 'ALREADY_REPORTED', message: '你已经举报过该目标，平台正在处理中' };
    return { ok: true, data: { reportId: report.id } };
  } catch (error) {
    if (error instanceof z.ZodError) return { ok: false, code: 'VALIDATION_ERROR', message: '举报信息不完整' };
    return { ok: false, code: error instanceof Error ? error.message : 'INTERNAL_ERROR', message: '举报提交失败' };
  }
}

const appealSchema = z.object({ targetType: z.enum(['post', 'comment', 'activity']), targetId: z.uuid(), reason: z.string().trim().min(10).max(1_000) });

export async function createAppeal(input: unknown): Promise<ActionResult<{ appealId: string }>> {
  try {
    const session = await requireSession();
    const values = appealSchema.parse(input);
    const [dailyAppeals] = await getDatabase().select({ value: count() }).from(moderationAppeals).where(and(eq(moderationAppeals.appellantId, session.id), gte(moderationAppeals.createdAt, new Date(Date.now() - 86_400_000))));
    if (dailyAppeals.value >= 10) return { ok: false, code: 'RATE_LIMITED', message: '今日申诉次数已达上限' };
    let ownsTarget = false;
    if (values.targetType === 'post') ownsTarget = Boolean((await getDatabase().select({ id: posts.id }).from(posts).where(and(eq(posts.id, values.targetId), eq(posts.authorId, session.id))).limit(1))[0]);
    if (values.targetType === 'comment') ownsTarget = Boolean((await getDatabase().select({ id: comments.id }).from(comments).where(and(eq(comments.id, values.targetId), eq(comments.authorId, session.id))).limit(1))[0]);
    if (values.targetType === 'activity') ownsTarget = Boolean((await getDatabase().select({ id: activities.id }).from(activities).where(and(eq(activities.id, values.targetId), eq(activities.organizerId, session.id))).limit(1))[0]);
    if (!ownsTarget) return { ok: false, code: 'FORBIDDEN', message: '只能申诉自己发布的内容或活动' };
    const existing = await getDatabase().select({ id: moderationAppeals.id }).from(moderationAppeals).where(and(eq(moderationAppeals.appellantId, session.id), eq(moderationAppeals.targetType, values.targetType), eq(moderationAppeals.targetId, values.targetId), or(eq(moderationAppeals.status, 'open'), eq(moderationAppeals.status, 'reviewing')))).limit(1);
    if (existing[0]) return { ok: false, code: 'APPEAL_IN_PROGRESS', message: '该目标已有申诉正在处理中' };
    const appeal = await getDatabase().transaction(async (tx) => {
      const [created] = await tx.insert(moderationAppeals).values({ ...values, appellantId: session.id }).returning({ id: moderationAppeals.id });
      await tx.update(moderationCases).set({ status: 'appealed', updatedAt: new Date() }).where(and(eq(moderationCases.targetType, values.targetType), eq(moderationCases.targetId, values.targetId), eq(moderationCases.status, 'approved')));
      return created;
    });
    revalidatePath('/me/appeals');
    revalidatePath('/admin/posts');
    return { ok: true, data: { appealId: appeal.id } };
  } catch (error) {
    if (error instanceof z.ZodError) return { ok: false, code: 'VALIDATION_ERROR', message: '申诉理由至少需要 10 个字' };
    return { ok: false, code: error instanceof Error ? error.message : 'INTERNAL_ERROR', message: '申诉提交失败' };
  }
}

export async function supplementAppeal(input: unknown): Promise<ActionResult> {
  try {
    const session = await requireSession();
    const values = z.object({ appealId: z.uuid(), supplement: z.string().trim().min(10).max(500) }).parse(input);
    const [appeal] = await getDatabase().select({ reason: moderationAppeals.reason, status: moderationAppeals.status }).from(moderationAppeals)
      .where(and(eq(moderationAppeals.id, values.appealId), eq(moderationAppeals.appellantId, session.id), or(eq(moderationAppeals.status, 'open'), eq(moderationAppeals.status, 'reviewing')))).limit(1);
    if (!appeal) return { ok: false, code: 'NOT_FOUND', message: '申诉不存在或已结案' };
    const reason = `${appeal.reason}\n\n补充材料：${values.supplement}`;
    if (reason.length > 1_000) return { ok: false, code: 'CONTENT_TOO_LONG', message: '申诉材料总长度不能超过 1000 字' };
    await getDatabase().update(moderationAppeals).set({ reason, updatedAt: new Date() }).where(eq(moderationAppeals.id, values.appealId));
    revalidatePath('/me/appeals'); revalidatePath('/admin/posts');
    return { ok: true };
  } catch (error) {
    if (error instanceof z.ZodError) return { ok: false, code: 'VALIDATION_ERROR', message: '补充材料至少需要 10 个字' };
    return { ok: false, code: error instanceof Error ? error.message : 'INTERNAL_ERROR', message: '补充材料提交失败' };
  }
}

const pollVoteSchema = z.object({ pollId: z.uuid(), optionId: z.uuid() });

export async function votePoll(input: unknown): Promise<ActionResult> {
  try {
    const session = await requireSession();
    const values = pollVoteSchema.parse(input);
    const outcome = await getDatabase().transaction(async (tx) => {
      const [poll] = await tx.select({ options: polls.options, closesAt: polls.closesAt }).from(polls).innerJoin(posts, eq(posts.id, polls.postId)).where(and(eq(polls.id, values.pollId), eq(posts.status, 'published'))).limit(1);
      if (!poll || (poll.closesAt && poll.closesAt <= new Date())) return 'POLL_CLOSED';
      if (!poll.options.some((option) => option.id === values.optionId)) return 'OPTION_NOT_FOUND';
      const inserted = await tx.insert(pollVotes).values({ pollId: values.pollId, userId: session.id, optionId: values.optionId }).onConflictDoNothing().returning({ pollId: pollVotes.pollId });
      if (!inserted[0]) return 'ALREADY_VOTED';
      await tx.update(polls).set({ options: sql`(select jsonb_agg(case when option->>'id' = ${values.optionId} then jsonb_set(option, '{votes}', to_jsonb(coalesce((option->>'votes')::int, 0) + 1)) else option end) from jsonb_array_elements(${polls.options}) option)`, updatedAt: new Date() }).where(eq(polls.id, values.pollId));
      return 'VOTED';
    });
    if (outcome !== 'VOTED') return { ok: false, code: outcome, message: outcome === 'ALREADY_VOTED' ? '你已经参与过这个投票' : '投票已结束或选项不存在' };
    revalidatePath('/posts');
    return { ok: true };
  } catch (error) {
    if (error instanceof z.ZodError) return { ok: false, code: 'VALIDATION_ERROR', message: '投票参数不正确' };
    return { ok: false, code: error instanceof Error ? error.message : 'INTERNAL_ERROR', message: '投票失败' };
  }
}
