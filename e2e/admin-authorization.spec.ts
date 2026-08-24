import { randomUUID } from 'node:crypto';
import { expect, test } from '@playwright/test';
import { and, eq } from 'drizzle-orm';
import { getDatabase } from '../db';
import { cities, cityMemberships, posts, users } from '../db/schema';
import { createAuthenticatedUser, getSeedCity } from './support/auth';

test.describe('administrator authorization and city scope', () => {
  test.skip(!process.env.DATABASE_URL, 'requires PostgreSQL integration services');

  test('platform administrator can change a user role', async ({ context, page, browser }) => {
    await createAuthenticatedUser(context, { role: 'platform_admin', nickname: '平台管理员测试' });
    const targetContext = await browser.newContext();
    const target = await createAuthenticatedUser(targetContext, { nickname: `角色目标${randomUUID().slice(0, 5)}` });
    await targetContext.close();
    await page.goto('/admin/users');
    const row = page.getByRole('row').filter({ hasText: target.nickname });
    const prompts = ['业务角色调整', 'editor'];
    page.on('dialog', (dialog) => dialog.accept(prompts.shift()));
    await row.getByRole('button', { name: '角色：user' }).click();
    await expect(row.getByText('完成')).toBeVisible();
    const [stored] = await getDatabase().select({ role: users.role }).from(users).where(eq(users.id, target.id));
    expect(stored.role).toBe('editor');
  });

  test('city administrator sees only managed-city content and cannot open platform modules', async ({ context, page }) => {
    const managedCity = await getSeedCity('北京');
    const otherCity = await getSeedCity('上海');
    const cityAdmin = await createAuthenticatedUser(context, { role: 'city_admin', cityMemberships: [{ cityId: managedCity.id, role: 'city_admin' }] });
    const [managedPost] = await getDatabase().insert(posts).values({ authorId: cityAdmin.id, cityId: managedCity.id, content: `管理城市内容 ${randomUUID()}`, status: 'published', publishedAt: new Date() }).returning();
    const [otherPost] = await getDatabase().insert(posts).values({ authorId: cityAdmin.id, cityId: otherCity.id, content: `其他城市内容 ${randomUUID()}`, status: 'published', publishedAt: new Date() }).returning();
    await page.goto('/admin/posts');
    await expect(page.getByText(managedPost.content)).toBeVisible();
    await expect(page.getByText(otherPost.content)).toHaveCount(0);
    await page.goto('/admin/users');
    await expect(page.getByRole('heading', { name: '没有找到这个页面' })).toBeVisible();
    expect(await getDatabase().select().from(cityMemberships).where(and(eq(cityMemberships.userId, cityAdmin.id), eq(cityMemberships.cityId, managedCity.id)))).toHaveLength(1);
    expect(await getDatabase().select().from(cities).where(eq(cities.id, otherCity.id))).toHaveLength(1);
  });
});
