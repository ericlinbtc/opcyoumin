import { and, count, eq, gte, sql } from 'drizzle-orm';
import { getDatabase } from '@/db';
import { comments, outboxJobs, posts, users } from '@/db/schema';
import { getServerEnv } from '@/lib/env';

export type CommentStatus = 'pending' | 'published';

export async function createCommentForUser(input: {
  userId: string;
  postId: string;
  parentId?: string;
  content: string;
  status: CommentStatus;
}): Promise<{ id: string }> {
  return getDatabase().transaction(async (tx) => {
    await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${input.userId}))`);
    const [targetPost] = await tx.select({ id: posts.id }).from(posts).where(and(eq(posts.id, input.postId), eq(posts.status, 'published'))).limit(1);
    if (!targetPost) throw new Error('POST_NOT_FOUND');

    if (input.parentId) {
      const [parent] = await tx.select({ id: comments.id }).from(comments).where(and(eq(comments.id, input.parentId), eq(comments.postId, input.postId), eq(comments.status, 'published'))).limit(1);
      if (!parent) throw new Error('PARENT_COMMENT_NOT_FOUND');
    }

    const since = new Date(Date.now() - 86_400_000);
    const [daily] = await tx.select({ value: count() }).from(comments).where(and(eq(comments.authorId, input.userId), gte(comments.createdAt, since)));
    const [account] = await tx.select({ createdAt: users.createdAt }).from(users).where(eq(users.id, input.userId)).limit(1);
    if (!account) throw new Error('UNAUTHORIZED');
    if (daily.value >= 100) throw new Error('COMMENT_RATE_LIMIT');
    if (Date.now() - account.createdAt.getTime() < 86_400_000 && daily.value >= getServerEnv().NEW_ACCOUNT_COMMENT_LIMIT) {
      throw new Error('NEW_ACCOUNT_LIMIT');
    }

    const [created] = await tx.insert(comments).values({
      postId: input.postId,
      parentId: input.parentId,
      content: input.content,
      authorId: input.userId,
      status: input.status,
    }).returning({ id: comments.id });
    if (input.status === 'published') {
      await tx.update(posts).set({ commentCount: sql`${posts.commentCount} + 1`, updatedAt: new Date() }).where(eq(posts.id, input.postId));
    }
    await tx.insert(outboxJobs).values({
      topic: 'comment.created',
      idempotencyKey: `comment.created:${created.id}`,
      payload: { commentId: created.id, postId: input.postId, authorId: input.userId },
    });
    return created;
  });
}
