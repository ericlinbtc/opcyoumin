import { randomUUID } from 'node:crypto';
import { expect, test } from '@playwright/test';
import { eq } from 'drizzle-orm';
import { getDatabase } from '../db';
import { comments, polls, posts, registrations, sessions, users } from '../db/schema';
import { addNotification, createAuthenticatedUser, getSeedCity } from './support/auth';

test.describe('isolated authenticated community flows', () => {
  test.skip(!process.env.DATABASE_URL, 'requires PostgreSQL and Redis integration services');

  test('SMS login creates a real account and session', async ({ page }, testInfo) => {
    const phone = `138${String(testInfo.parallelIndex).padStart(4, '0')}${String(testInfo.retry + 10).padStart(4, '0')}`;
    await page.goto('/login');
    await page.getByLabel('手机号').fill(phone);
    await page.getByRole('button', { name: '获取验证码' }).click();
    await expect(page.getByText('验证码已发送')).toBeVisible({ timeout: 15_000 });
    await page.getByLabel('短信验证码').fill(process.env.SMS_DEV_CODE ?? '246810');
    await page.getByRole('button', { name: '登录 / 注册' }).click();
    await expect(page).toHaveURL(/\/me$/);
  });

  test('city membership, post create, edit and soft delete are isolated', async ({ context, page }) => {
    const city = await getSeedCity();
    const account = await createAuthenticatedUser(context);
    await page.goto(`/cities/${city.slug}`);
    await page.getByRole('button', { name: '加入城市' }).click();
    await expect(page.getByText('已加入城市')).toBeVisible();
    const content = `独立动态场景 ${randomUUID()}`;
    await page.getByLabel('发布城市动态').fill(content);
    await page.getByRole('button', { name: '发布动态' }).click();
    await expect(page).toHaveURL(/\/posts\/[0-9a-f-]+$/);
    await page.goto('/me/posts');
    const record = page.locator('.account-records article').filter({ hasText: content });
    await record.getByRole('button', { name: '编辑' }).click();
    await record.locator('textarea').fill(`${content} 已编辑`);
    await record.getByRole('button', { name: '保存修改' }).click();
    await expect(record).toContainText('已编辑');
    page.once('dialog', (dialog) => dialog.accept());
    await record.getByRole('button', { name: '删除' }).click();
    await expect(record).toContainText('deleted');
    const [stored] = await getDatabase().select({ status: posts.status }).from(posts).where(eq(posts.authorId, account.id)).limit(1);
    expect(stored.status).toBe('deleted');
  });

  test('poll, comment reply and XSS rendering remain safe', async ({ context, page }) => {
    const city = await getSeedCity();
    const author = await createAuthenticatedUser(context, { nickname: '安全内容作者' });
    const [post] = await getDatabase().insert(posts).values({ authorId: author.id, cityId: city.id, content: '<img src=x onerror="window.__xss=1"> SQL \' OR 1=1 --', status: 'published', publishedAt: new Date() }).returning({ id: posts.id });
    const optionA = randomUUID();
    const optionB = randomUUID();
    await getDatabase().insert(polls).values({ postId: post.id, question: '自动化投票', options: [{ id: optionA, label: 'A', votes: 0 }, { id: optionB, label: 'B', votes: 0 }] });
    await page.goto(`/posts/${post.id}`);
    await expect(page.locator('.feed-detail-copy')).toContainText('<img src=x');
    await expect(page.locator('.feed-detail-page-body img')).toHaveCount(0);
    expect(await page.evaluate(() => (window as typeof window & { __xss?: number }).__xss)).toBeUndefined();
    await page.getByRole('button', { name: /A/ }).click();
    await expect(page.getByText('投票成功')).toBeVisible();
    await page.getByLabel('参与讨论').fill('一级自动化评论');
    await page.getByRole('button', { name: '发表评论' }).click();
    const comment = page.locator('.comment-list article').filter({ hasText: '一级自动化评论' });
    await comment.getByRole('button', { name: '回复' }).click();
    await comment.getByLabel('回复这条评论').fill('二级自动化回复');
    await comment.getByRole('button', { name: '提交回复' }).click();
    await expect(page.getByText('二级自动化回复')).toBeVisible();
    expect(await getDatabase().select().from(comments).where(eq(comments.postId, post.id))).toHaveLength(2);
  });

  test('activity registration can be cancelled without counter drift', async ({ context, page }) => {
    const account = await createAuthenticatedUser(context);
    await page.goto('/activities/00000000-0000-4000-8000-000000000003');
    await page.getByRole('button', { name: '立即报名' }).click();
    await expect(page.getByText('报名成功')).toBeVisible();
    await page.getByRole('button', { name: '取消报名' }).click();
    await expect(page.getByText('已取消报名')).toBeVisible();
    const [registration] = await getDatabase().select({ status: registrations.status }).from(registrations).where(eq(registrations.userId, account.id));
    expect(registration.status).toBe('cancelled');
  });

  test('notifications, session revocation and deletion request update persisted state', async ({ context, page }) => {
    const account = await createAuthenticatedUser(context);
    await addNotification(account.id, `未读通知 ${randomUUID()}`);
    const secondSessionId = randomUUID();
    await getDatabase().insert(sessions).values({ id: secondSessionId, userId: account.id, tokenHash: randomUUID().replaceAll('-', '').padEnd(64, '0'), userAgent: '需要撤销的测试设备', expiresAt: new Date(Date.now() + 3_600_000) });
    await page.goto('/me/notifications');
    await page.getByRole('button', { name: '全部标为已读' }).click();
    await expect(page.getByRole('button', { name: '全部标为已读' })).toHaveCount(0);
    await page.goto('/me/sessions');
    const otherDevice = page.locator('.account-records article').filter({ hasText: '需要撤销的测试设备' });
    await otherDevice.getByRole('button', { name: '撤销会话' }).click();
    await expect(otherDevice).toContainText('已撤销');
    const [revoked] = await getDatabase().select({ revokedAt: sessions.revokedAt }).from(sessions).where(eq(sessions.id, secondSessionId));
    expect(revoked.revokedAt).not.toBeNull();
    await page.goto('/me');
    page.once('dialog', (dialog) => dialog.accept('DELETE'));
    await page.getByRole('button', { name: '申请注销账号' }).click();
    await expect(page).toHaveURL(/\/login$/);
    const [deleted] = await getDatabase().select({ status: users.status }).from(users).where(eq(users.id, account.id));
    expect(deleted.status).toBe('deletion_requested');
  });
});
