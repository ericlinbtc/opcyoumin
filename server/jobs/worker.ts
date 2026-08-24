import { and, eq, lte, or, sql } from 'drizzle-orm';
import { pathToFileURL } from 'node:url';
import { getDatabase } from '@/db';
import { activities, auditLogs, comments, deadLetterJobs, media, notifications, outboxJobs, posts, profiles, registrations, users } from '@/db/schema';
import { evaluateUploadedMedia } from '@/server/media/content-safety';
import { getOssClient } from '@/server/oss';

type Job = typeof outboxJobs.$inferSelect;
const MAX_ATTEMPTS = 5;
const LOCK_SECONDS = 300;

export async function claimJob(): Promise<Job | null> {
  const now = new Date();
  const availableAgain = new Date(now.getTime() + LOCK_SECONDS * 1000);
  return getDatabase().transaction(async (tx) => {
    const [candidate] = await tx.select({ id: outboxJobs.id }).from(outboxJobs)
      .where(or(and(eq(outboxJobs.status, 'pending'), lte(outboxJobs.availableAt, now)), and(eq(outboxJobs.status, 'processing'), lte(outboxJobs.availableAt, now))))
      .orderBy(outboxJobs.availableAt).limit(1).for('update', { skipLocked: true });
    if (!candidate) return null;
    const [job] = await tx.update(outboxJobs).set({ status: 'processing', attempts: sql`${outboxJobs.attempts} + 1`, availableAt: availableAgain }).where(eq(outboxJobs.id, candidate.id)).returning();
    return job ?? null;
  });
}

function requiredString(payload: Record<string, unknown>, key: string): string {
  const value = payload[key];
  if (typeof value !== 'string') throw new Error(`INVALID_JOB_PAYLOAD:${key}`);
  return value;
}

export async function processJob(job: Job): Promise<void> {
  if (job.topic === 'media.uploaded') {
    const mediaId = requiredString(job.payload, 'mediaId');
    const ownerId = requiredString(job.payload, 'ownerId');
    const [item] = await getDatabase().select({ originalKey: media.originalKey, kind: media.kind, mimeType: media.mimeType, byteSize: media.byteSize, postId: media.postId, status: media.status }).from(media).where(eq(media.id, mediaId)).limit(1);
    if (!item || item.status !== 'uploaded') throw new Error('MEDIA_NOT_READY');
    const oss = getOssClient();
    const review = await evaluateUploadedMedia({ mediaId, kind: item.kind, mimeType: item.mimeType, byteSize: item.byteSize, signedUrl: oss.signatureUrl(item.originalKey, { expires: 600 }) });
    const publicKey = review.decision === 'approved' ? `public/${mediaId}/${item.originalKey.split('/').at(-1)}` : null;
    if (publicKey) await oss.copy(publicKey, item.originalKey);
    await getDatabase().transaction(async (tx) => {
      if (review.decision !== 'review') {
        await tx.update(media).set({ status: review.decision, publicKey, updatedAt: new Date() }).where(and(eq(media.id, mediaId), eq(media.status, 'uploaded')));
        if (review.decision === 'approved' && item.kind === 'image' && !item.postId && publicKey) await tx.update(profiles).set({ avatarKey: publicKey, updatedAt: new Date() }).where(eq(profiles.userId, ownerId));
      }
      await tx.insert(notifications).values({ userId: ownerId, type: 'moderation', title: review.decision === 'approved' ? '媒体审核通过' : review.decision === 'rejected' ? '媒体审核未通过' : '媒体进入人工审核', body: review.reason, payload: { mediaId, decision: review.decision } });
      await tx.insert(auditLogs).values({ actorId: null, action: `media.safety_${review.decision}`, targetType: 'media', targetId: mediaId, after: { decision: review.decision, reason: review.reason } });
      await tx.update(outboxJobs).set({ status: 'processed', processedAt: new Date(), lastError: null }).where(eq(outboxJobs.id, job.id));
    });
    return;
  }
  const db = getDatabase();
  await db.transaction(async (tx) => {
    if (job.topic === 'comment.created') {
      const commentId = requiredString(job.payload, 'commentId');
      const [row] = await tx.select({ actorId: comments.authorId, content: comments.content, postAuthorId: posts.authorId, parentId: comments.parentId }).from(comments).innerJoin(posts, eq(posts.id, comments.postId)).where(eq(comments.id, commentId)).limit(1);
      if (!row) throw new Error('COMMENT_NOT_FOUND');
      let recipientId = row.postAuthorId;
      let type: 'comment' | 'reply' = 'comment';
      if (row.parentId) {
        const [parent] = await tx.select({ authorId: comments.authorId }).from(comments).where(eq(comments.id, row.parentId)).limit(1);
        if (parent) { recipientId = parent.authorId; type = 'reply'; }
      }
      if (recipientId !== row.actorId) await tx.insert(notifications).values({ userId: recipientId, type, title: type === 'reply' ? '你的评论有新回复' : '你的动态有新评论', body: row.content.slice(0, 500), payload: { commentId } });
    } else if (job.topic === 'reaction.created') {
      const actorId = requiredString(job.payload, 'actorId');
      const postId = requiredString(job.payload, 'postId');
      const [row] = await tx.select({ authorId: posts.authorId, nickname: profiles.nickname }).from(posts).innerJoin(profiles, eq(profiles.userId, actorId)).where(eq(posts.id, postId)).limit(1);
      if (row && row.authorId !== actorId) await tx.insert(notifications).values({ userId: row.authorId, type: 'reaction', title: '你的动态收到点赞', body: `${row.nickname} 点赞了你的动态`, payload: { postId } });
    } else if (job.topic === 'follow.created') {
      const actorId = requiredString(job.payload, 'actorId');
      const followingId = requiredString(job.payload, 'followingId');
      const [actor] = await tx.select({ nickname: profiles.nickname }).from(profiles).where(eq(profiles.userId, actorId)).limit(1);
      if (actor) await tx.insert(notifications).values({ userId: followingId, type: 'follow', title: '你有新的关注者', body: `${actor.nickname} 关注了你`, payload: { actorId } });
    } else if (job.topic === 'registration.created') {
      const userId = requiredString(job.payload, 'userId');
      const activityId = requiredString(job.payload, 'activityId');
      const [activity] = await tx.select({ title: activities.title, startsAt: activities.startsAt }).from(activities).where(eq(activities.id, activityId)).limit(1);
      if (!activity) throw new Error('ACTIVITY_NOT_FOUND');
      await tx.insert(notifications).values({ userId, type: 'activity', title: '活动报名成功', body: `${activity.title} · ${activity.startsAt.toLocaleString('zh-CN')}`, payload: { activityId } });
    } else if (job.topic === 'activity.cancelled') {
      const activityId = requiredString(job.payload, 'activityId');
      const [activity] = await tx.select({ title: activities.title }).from(activities).where(eq(activities.id, activityId)).limit(1);
      if (!activity) throw new Error('ACTIVITY_NOT_FOUND');
      const attendees = await tx.select({ userId: registrations.userId }).from(registrations).where(and(eq(registrations.activityId, activityId), eq(registrations.status, 'registered')));
      if (attendees.length > 0) await tx.insert(notifications).values(attendees.map((item) => ({ userId: item.userId, type: 'activity' as const, title: '活动已取消', body: `${activity.title} 已由发起人取消`, payload: { activityId } })));
    } else {
      throw new Error(`UNSUPPORTED_JOB_TOPIC:${job.topic}`);
    }
    await tx.update(outboxJobs).set({ status: 'processed', processedAt: new Date(), lastError: null }).where(eq(outboxJobs.id, job.id));
  });
}

export async function failJob(job: Job, error: unknown): Promise<void> {
  const message = String(error).slice(0, 10_000);
  if (job.attempts >= MAX_ATTEMPTS) {
    await getDatabase().transaction(async (tx) => {
      await tx.insert(deadLetterJobs).values({ outboxJobId: job.id, topic: job.topic, payload: job.payload, error: message });
      await tx.update(outboxJobs).set({ status: 'failed', lastError: message }).where(eq(outboxJobs.id, job.id));
      const administrators = await tx.select({ id: users.id }).from(users).where(and(eq(users.role, 'platform_admin'), eq(users.status, 'active')));
      if (administrators.length > 0) await tx.insert(notifications).values(administrators.map((administrator) => ({ userId: administrator.id, type: 'system' as const, title: '异步任务进入死信队列', body: `${job.topic} 已连续失败 ${job.attempts} 次`, payload: { outboxJobId: job.id, topic: job.topic } })));
    });
    return;
  }
  const delaySeconds = Math.min(3600, 30 * 2 ** Math.max(0, job.attempts - 1));
  await getDatabase().update(outboxJobs).set({ status: 'pending', lastError: message, availableAt: new Date(Date.now() + delaySeconds * 1000) }).where(eq(outboxJobs.id, job.id));
}

export async function runWorker(signal?: AbortSignal): Promise<void> {
  let stopping = false;
  const stop = () => { stopping = true; };
  process.on('SIGTERM', stop);
  process.on('SIGINT', stop);
  signal?.addEventListener('abort', stop, { once: true });
  while (!stopping) {
    const job = await claimJob();
    if (!job) { await new Promise((resolve) => setTimeout(resolve, 1_000)); continue; }
    try { await processJob(job); } catch (error) { await failJob(job, error); }
  }
  process.off('SIGTERM', stop);
  process.off('SIGINT', stop);
}

const executedDirectly = process.argv[1] ? import.meta.url === pathToFileURL(process.argv[1]).href : false;
if (executedDirectly) runWorker().catch((error) => { console.error(error); process.exitCode = 1; });
