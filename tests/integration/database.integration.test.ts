import { randomUUID } from 'node:crypto';
import { and, eq } from 'drizzle-orm';
import { describe, expect, it } from 'vitest';
import { getDatabase } from '@/db';
import { activities, cities, cityMemberships, deadLetterJobs, notifications, outboxJobs, profiles, registrations, users } from '@/db/schema';
import { failJob, processJob } from '@/server/jobs/worker';
import { ActivityRegistrationError, cancelActivityRegistrationForUser, registerActivityForUser } from '@/server/services/activity-registration';

const integration = process.env.DATABASE_URL ? describe.sequential : describe.skip;

async function createUser(role: 'user' | 'editor' | 'city_admin' | 'platform_admin' = 'user') {
  const id = randomUUID();
  await getDatabase().insert(users).values({ id, phoneHash: randomUUID().replaceAll('-', '').padEnd(64, '0'), phoneEncrypted: `integration:${id}`, role, createdAt: new Date(Date.now() - 172_800_000) });
  await getDatabase().insert(profiles).values({ userId: id, nickname: `集成${id.slice(0, 6)}` });
  return id;
}

async function createCity() {
  const suffix = randomUUID();
  const [city] = await getDatabase().insert(cities).values({ slug: `integration-${suffix}`, name: `集成城市${suffix.slice(0, 5)}`, regionCode: 'IT' }).returning({ id: cities.id });
  return city.id;
}

integration('PostgreSQL constraints, concurrency and worker delivery', () => {
  it('enforces account and membership unique constraints', async () => {
    const phoneHash = randomUUID().replaceAll('-', '').padEnd(64, '0');
    await getDatabase().insert(users).values({ phoneHash, phoneEncrypted: 'first' });
    await expect(getDatabase().insert(users).values({ phoneHash, phoneEncrypted: 'second' })).rejects.toBeDefined();

    const userId = await createUser();
    const cityId = await createCity();
    await getDatabase().insert(cityMemberships).values({ cityId, userId });
    await expect(getDatabase().insert(cityMemberships).values({ cityId, userId })).rejects.toBeDefined();
  });

  it('admits exactly one of two concurrent registrations for the last seat', async () => {
    const organizerId = await createUser('editor');
    const firstUserId = await createUser();
    const secondUserId = await createUser();
    const cityId = await createCity();
    const [activity] = await getDatabase().insert(activities).values({
      organizerId, cityId, title: '最后一个名额并发测试', summary: '验证两个请求并发争抢最后一个活动名额。', details: '数据库条件更新必须保证只有一个报名成功，另一个事务完整回滚。', location: '集成测试空间', capacity: 1,
      startsAt: new Date(Date.now() + 86_400_000), endsAt: new Date(Date.now() + 90_000_000), status: 'published',
    }).returning({ id: activities.id });

    const results = await Promise.allSettled([
      registerActivityForUser(activity.id, firstUserId),
      registerActivityForUser(activity.id, secondUserId),
    ]);
    expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(1);
    const rejected = results.find((result): result is PromiseRejectedResult => result.status === 'rejected');
    expect(rejected?.reason).toBeInstanceOf(ActivityRegistrationError);

    const [storedActivity] = await getDatabase().select({ count: activities.registrationCount }).from(activities).where(eq(activities.id, activity.id));
    const storedRegistrations = await getDatabase().select().from(registrations).where(and(eq(registrations.activityId, activity.id), eq(registrations.status, 'registered')));
    expect(storedActivity.count).toBe(1);
    expect(storedRegistrations).toHaveLength(1);

    expect(await cancelActivityRegistrationForUser(activity.id, storedRegistrations[0].userId)).toBe(true);
    expect(await cancelActivityRegistrationForUser(activity.id, storedRegistrations[0].userId)).toBe(false);
    const [cancelledActivity] = await getDatabase().select({ count: activities.registrationCount }).from(activities).where(eq(activities.id, activity.id));
    expect(cancelledActivity.count).toBe(0);
  });

  it('processes a valid job and moves a fifth failure to dead letters', async () => {
    const administratorId = await createUser('platform_admin');
    const userId = await createUser();
    const organizerId = await createUser('editor');
    const cityId = await createCity();
    const [activity] = await getDatabase().insert(activities).values({
      organizerId, cityId, title: 'Worker 通知测试', summary: '用于验证异步通知的测试活动。', details: '报名成功后 Worker 应写入通知并将任务标记为已处理。', location: '测试地点', capacity: 10,
      startsAt: new Date(Date.now() + 86_400_000), endsAt: new Date(Date.now() + 90_000_000), status: 'published',
    }).returning({ id: activities.id });
    const [job] = await getDatabase().insert(outboxJobs).values({ topic: 'registration.created', idempotencyKey: `worker-ok:${randomUUID()}`, payload: { activityId: activity.id, userId }, status: 'processing', attempts: 1 }).returning();
    await processJob(job);
    const [notice] = await getDatabase().select({ title: notifications.title }).from(notifications).where(and(eq(notifications.userId, userId), eq(notifications.title, '活动报名成功'))).limit(1);
    expect(notice?.title).toBe('活动报名成功');

    const [failing] = await getDatabase().insert(outboxJobs).values({ topic: 'unsupported.integration', idempotencyKey: `worker-fail:${randomUUID()}`, payload: {}, status: 'processing', attempts: 1 }).returning();
    await failJob(failing, new Error('first failure'));
    const [retried] = await getDatabase().select().from(outboxJobs).where(eq(outboxJobs.id, failing.id));
    expect(retried.status).toBe('pending');
    expect(retried.lastError).toContain('first failure');

    const [lastAttempt] = await getDatabase().update(outboxJobs).set({ status: 'processing', attempts: 5 }).where(eq(outboxJobs.id, failing.id)).returning();
    await failJob(lastAttempt, new Error('terminal failure'));
    const [deadLetter] = await getDatabase().select().from(deadLetterJobs).where(eq(deadLetterJobs.outboxJobId, failing.id));
    const [adminNotice] = await getDatabase().select({ title: notifications.title }).from(notifications).where(and(eq(notifications.userId, administratorId), eq(notifications.title, '异步任务进入死信队列'))).limit(1);
    expect(deadLetter.status).toBe('open');
    expect(deadLetter.error).toContain('terminal failure');
    expect(adminNotice?.title).toBe('异步任务进入死信队列');
  });
});
