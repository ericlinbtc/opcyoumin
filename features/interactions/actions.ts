'use server';

import { and, eq, or, sql } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { getDatabase } from '@/db';
import { activities, comments, follows, moderationAppeals, outboxJobs, polls, pollVotes, posts, postShares, reactions, reports, saves, userBlocks } from '@/db/schema';
import type { ActionResult } from '@/features/posts/actions';
import { requireSession } from '@/server/auth/session';

const uuidSchema = z.uuid();

export async function toggleReaction(input: unknown): Promise<ActionResult<{ active: boolean }>> {
  try {
    const session = await requireSession();
    const postId = uuidSchema.parse(input);
    const active = await getDatabase().transaction(async (tx) => {
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
    const [report] = await getDatabase().insert(reports).values({ ...values, reporterId: session.id }).onConflictDoNothing().returning({ id: reports.id });
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
    let ownsTarget = false;
    if (values.targetType === 'post') ownsTarget = Boolean((await getDatabase().select({ id: posts.id }).from(posts).where(and(eq(posts.id, values.targetId), eq(posts.authorId, session.id))).limit(1))[0]);
    if (values.targetType === 'comment') ownsTarget = Boolean((await getDatabase().select({ id: comments.id }).from(comments).where(and(eq(comments.id, values.targetId), eq(comments.authorId, session.id))).limit(1))[0]);
    if (values.targetType === 'activity') ownsTarget = Boolean((await getDatabase().select({ id: activities.id }).from(activities).where(and(eq(activities.id, values.targetId), eq(activities.organizerId, session.id))).limit(1))[0]);
    if (!ownsTarget) return { ok: false, code: 'FORBIDDEN', message: '只能申诉自己发布的内容或活动' };
    const [appeal] = await getDatabase().insert(moderationAppeals).values({ ...values, appellantId: session.id }).returning({ id: moderationAppeals.id });
    revalidatePath('/me/appeals');
    revalidatePath('/admin/posts');
    return { ok: true, data: { appealId: appeal.id } };
  } catch (error) {
    if (error instanceof z.ZodError) return { ok: false, code: 'VALIDATION_ERROR', message: '申诉理由至少需要 10 个字' };
    return { ok: false, code: error instanceof Error ? error.message : 'INTERNAL_ERROR', message: '申诉提交失败' };
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
