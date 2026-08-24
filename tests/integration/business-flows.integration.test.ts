import { randomUUID } from 'node:crypto';
import { and, eq } from 'drizzle-orm';
import { describe, expect, it, vi } from 'vitest';

const auth = vi.hoisted(() => ({ current: { id: '', sessionId: '', role: 'user' as 'user' | 'editor' | 'city_admin' | 'platform_admin' } }));
vi.mock('@/server/auth/session', () => ({
  requireSession: async (roles?: string[]) => {
    if (!auth.current.id) throw new Error('UNAUTHORIZED');
    if (roles && !roles.includes(auth.current.role)) throw new Error('FORBIDDEN');
    return auth.current;
  },
  clearSessionCookie: vi.fn(),
}));
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));
vi.mock('@/server/request-context', () => ({ getAuditContext: async () => ({ requestId: randomUUID(), ipHash: 'integration' }) }));

import { getDatabase } from '@/db';
import { activities, cities, cityMemberships, comments, follows, moderationAppeals, moderationCases, polls, posts, postShares, reactions, reports, roles, saves, userBlocks, users } from '@/db/schema';
import { cancelOwnActivity, createActivity } from '@/features/activities/actions';
import { closeReport, reviewActivity, reviewAppeal, setUserRole } from '@/features/admin/actions';
import { createAppeal, createReport, recordShare, toggleBlock, toggleFollow, toggleReaction, toggleSave, votePoll } from '@/features/interactions/actions';
import { createComment, deleteOwnPost, editOwnPost } from '@/features/posts/actions';
import { assertCityScope } from '@/server/auth/city-scope';

const integration = process.env.DATABASE_URL ? describe.sequential : describe.skip;

async function createUser(role: 'user' | 'editor' | 'city_admin' | 'platform_admin' = 'user') {
  const id = randomUUID();
  await getDatabase().insert(users).values({ id, phoneHash: randomUUID().replaceAll('-', '').padEnd(64, '0'), phoneEncrypted: `flow:${id}`, role, createdAt: new Date(Date.now() - 172_800_000) });
  return id;
}

async function createCity() {
  const suffix = randomUUID();
  const [city] = await getDatabase().insert(cities).values({ slug: `flow-${suffix}`, name: `流程城市${suffix.slice(0, 5)}`, regionCode: 'FT' }).returning({ id: cities.id });
  return city.id;
}

function actAs(id: string, role: typeof auth.current.role = 'user') {
  auth.current = { id, role, sessionId: randomUUID() };
}

integration('authenticated business and governance state machines', () => {
  it('enforces platform role changes and city-admin scope', async () => {
    await getDatabase().insert(roles).values([
      { key: 'user', label: '注册用户', permissions: ['content:create', 'content:edit-own'] },
      { key: 'city_admin', label: '城市管理员', permissions: ['moderation:review', 'city:manage'] },
      { key: 'platform_admin', label: '平台管理员', permissions: ['content:create', 'content:edit-own', 'activity:create', 'activity:approve', 'knowledge:publish', 'city:manage', 'moderation:review', 'platform:manage'] },
    ]).onConflictDoNothing();
    const platformId = await createUser('platform_admin');
    const targetId = await createUser();
    const cityAdminId = await createUser('city_admin');
    const managedCityId = await createCity();
    const otherCityId = await createCity();
    await getDatabase().insert(cityMemberships).values({ cityId: managedCityId, userId: cityAdminId, role: 'city_admin' });

    actAs(cityAdminId, 'city_admin');
    await expect(assertCityScope(auth.current, managedCityId)).resolves.toBeUndefined();
    await expect(assertCityScope(auth.current, otherCityId)).rejects.toThrow('FORBIDDEN');
    await expect(setUserRole({ userId: targetId, role: 'editor', reason: '越权修改测试' })).resolves.toMatchObject({ ok: false, code: 'FORBIDDEN' });

    actAs(platformId, 'platform_admin');
    await expect(setUserRole({ userId: targetId, role: 'editor', reason: '业务需要调整' })).resolves.toMatchObject({ ok: true });
    const [target] = await getDatabase().select({ role: users.role }).from(users).where(eq(users.id, targetId));
    expect(target.role).toBe('editor');
  });

  it('keeps interaction, poll, block and share counters idempotent', async () => {
    const authorId = await createUser();
    const viewerId = await createUser();
    const cityId = await createCity();
    const optionId = randomUUID();
    const [post] = await getDatabase().insert(posts).values({ authorId, cityId, content: '互动一致性测试', status: 'published', publishedAt: new Date() }).returning({ id: posts.id });
    const [poll] = await getDatabase().insert(polls).values({ postId: post.id, question: '选择一个选项', options: [{ id: optionId, label: '选项 A', votes: 0 }] }).returning({ id: polls.id });
    actAs(viewerId);

    expect(await toggleReaction(post.id)).toMatchObject({ ok: true, data: { active: true } });
    expect(await toggleReaction(post.id)).toMatchObject({ ok: true, data: { active: false } });
    expect(await toggleSave(post.id)).toMatchObject({ ok: true, data: { active: true } });
    expect(await toggleSave(post.id)).toMatchObject({ ok: true, data: { active: false } });
    expect(await recordShare(post.id)).toMatchObject({ ok: true, data: { counted: true } });
    expect(await recordShare(post.id)).toMatchObject({ ok: true, data: { counted: false } });
    expect(await votePoll({ pollId: poll.id, optionId })).toMatchObject({ ok: true });
    expect(await votePoll({ pollId: poll.id, optionId })).toMatchObject({ ok: false, code: 'ALREADY_VOTED' });

    expect(await toggleFollow(authorId)).toMatchObject({ ok: true, data: { active: true } });
    expect(await toggleBlock(authorId)).toMatchObject({ ok: true, data: { active: true } });
    expect(await getDatabase().select().from(follows).where(and(eq(follows.followerId, viewerId), eq(follows.followingId, authorId)))).toHaveLength(0);
    expect(await getDatabase().select().from(userBlocks).where(and(eq(userBlocks.blockerId, viewerId), eq(userBlocks.blockedId, authorId)))).toHaveLength(1);

    const [storedPost] = await getDatabase().select().from(posts).where(eq(posts.id, post.id));
    const [storedPoll] = await getDatabase().select().from(polls).where(eq(polls.id, poll.id));
    expect(storedPost).toMatchObject({ reactionCount: 0, saveCount: 0, shareCount: 1 });
    expect(storedPoll.options[0].votes).toBe(1);
    expect(await getDatabase().select().from(reactions).where(eq(reactions.postId, post.id))).toHaveLength(0);
    expect(await getDatabase().select().from(saves).where(eq(saves.postId, post.id))).toHaveLength(0);
    expect(await getDatabase().select().from(postShares).where(eq(postShares.postId, post.id))).toHaveLength(1);
  });

  it('validates comment replies and blocks post IDOR edits and deletes', async () => {
    const ownerId = await createUser();
    const attackerId = await createUser();
    const cityId = await createCity();
    const [post] = await getDatabase().insert(posts).values({ authorId: ownerId, cityId, content: '只允许作者修改', status: 'published', publishedAt: new Date() }).returning({ id: posts.id });
    actAs(attackerId);
    expect(await editOwnPost({ postId: post.id, content: '越权修改内容', topics: [] })).toMatchObject({ ok: false, code: 'NOT_FOUND' });
    expect(await deleteOwnPost(post.id)).toMatchObject({ ok: false, code: 'NOT_FOUND' });

    const first = await createComment({ postId: post.id, content: '一级评论' });
    expect(first).toMatchObject({ ok: true });
    if (!first.ok || !first.data) throw new Error('comment fixture failed');
    expect(await createComment({ postId: post.id, parentId: first.data.commentId, content: '二级回复' })).toMatchObject({ ok: true });
    expect(await createComment({ postId: post.id, parentId: randomUUID(), content: '伪造回复目标' })).toMatchObject({ ok: false, code: 'PARENT_COMMENT_NOT_FOUND' });
    expect(await getDatabase().select().from(comments).where(eq(comments.postId, post.id))).toHaveLength(2);
    const [stored] = await getDatabase().select({ count: posts.commentCount }).from(posts).where(eq(posts.id, post.id));
    expect(stored.count).toBe(2);
  });

  it('creates, reviews and cancels an activity through role and membership checks', async () => {
    const organizerId = await createUser();
    const administratorId = await createUser('platform_admin');
    const cityId = await createCity();
    await getDatabase().update(users).set({ activityCreatorApprovedAt: new Date() }).where(eq(users.id, organizerId));
    await getDatabase().insert(cityMemberships).values({ cityId, userId: organizerId });
    actAs(organizerId);
    const created = await createActivity({ cityId, title: '完整活动状态机', summary: '这是一个用于验证活动状态机的自动化场景。', details: '普通用户通过活动发起资格后提交，平台审核发布，最后由发起人取消。', location: '自动化测试空间', capacity: 20, startsAt: new Date(Date.now() + 86_400_000), endsAt: new Date(Date.now() + 90_000_000) });
    expect(created).toMatchObject({ ok: true });
    if (!created.ok || !created.data) throw new Error('activity fixture failed');
    const activityId = created.data.activityId;
    actAs(administratorId, 'platform_admin');
    expect(await reviewActivity({ activityId, targetStatus: 'published', reason: '活动信息完整' })).toMatchObject({ ok: true });
    actAs(organizerId);
    expect(await cancelOwnActivity(activityId)).toMatchObject({ ok: true });
    const [stored] = await getDatabase().select({ status: activities.status }).from(activities).where(eq(activities.id, activityId));
    expect(stored.status).toBe('cancelled');
  });

  it('runs report moderation and owner appeal through the complete state machine', async () => {
    const ownerId = await createUser();
    const reporterId = await createUser();
    const administratorId = await createUser('platform_admin');
    const cityId = await createCity();
    const [post] = await getDatabase().insert(posts).values({ authorId: ownerId, cityId, content: '治理闭环测试内容', status: 'published', publishedAt: new Date() }).returning({ id: posts.id });

    actAs(reporterId);
    const report = await createReport({ targetType: 'post', targetId: post.id, reason: '虚假信息', details: '集成测试举报' });
    expect(report).toMatchObject({ ok: true });
    if (!report.ok || !report.data) throw new Error('report fixture failed');
    expect(await createAppeal({ targetType: 'post', targetId: post.id, reason: '非作者越权申诉应该失败' })).toMatchObject({ ok: false, code: 'FORBIDDEN' });

    actAs(administratorId, 'platform_admin');
    expect(await closeReport({ reportId: report.data.reportId, decision: 'approved', notes: '举报证据成立' })).toMatchObject({ ok: true });
    const [hidden] = await getDatabase().select({ status: posts.status }).from(posts).where(eq(posts.id, post.id));
    const [approvedCase] = await getDatabase().select({ status: moderationCases.status }).from(moderationCases).where(eq(moderationCases.reportId, report.data.reportId));
    expect(hidden.status).toBe('hidden');
    expect(approvedCase.status).toBe('approved');

    actAs(ownerId);
    const appeal = await createAppeal({ targetType: 'post', targetId: post.id, reason: '原始内容具有完整来源，请求恢复展示。' });
    expect(appeal).toMatchObject({ ok: true });
    if (!appeal.ok || !appeal.data) throw new Error('appeal fixture failed');

    actAs(administratorId, 'platform_admin');
    expect(await reviewAppeal({ appealId: appeal.data.appealId, decision: 'approved', notes: '复核来源后恢复' })).toMatchObject({ ok: true });
    const [restored] = await getDatabase().select({ status: posts.status }).from(posts).where(eq(posts.id, post.id));
    const [closedCase] = await getDatabase().select({ status: moderationCases.status }).from(moderationCases).where(eq(moderationCases.reportId, report.data.reportId));
    const [storedAppeal] = await getDatabase().select({ status: moderationAppeals.status }).from(moderationAppeals).where(eq(moderationAppeals.id, appeal.data.appealId));
    const [storedReport] = await getDatabase().select({ status: reports.status }).from(reports).where(eq(reports.id, report.data.reportId));
    expect(restored.status).toBe('published');
    expect(closedCase.status).toBe('closed');
    expect(storedAppeal.status).toBe('approved');
    expect(storedReport.status).toBe('approved');
  });
});
