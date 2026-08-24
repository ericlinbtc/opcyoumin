import { expect, test } from '@playwright/test';

test.describe('authenticated community loop', () => {
  test.skip(!process.env.DATABASE_URL, 'requires PostgreSQL and Redis integration services');
  test.skip(({ isMobile }) => isMobile, 'the integration mutation runs once on desktop');

  test('login, join a city, publish, interact, comment and find account records', async ({ page }) => {
    await page.goto('/login');
    await page.getByLabel('手机号').fill('13800138001');
    await page.getByRole('button', { name: '获取验证码' }).click();
    await expect(page.getByText('验证码已发送')).toBeVisible();
    await page.getByLabel('短信验证码').fill(process.env.SMS_DEV_CODE ?? '246810');
    await page.getByRole('button', { name: '登录 / 注册' }).click();
    await expect(page).toHaveURL(/\/me$/);

    await page.goto('/cities');
    await page.getByRole('link', { name: /进入城市/ }).first().click();
    await page.getByRole('button', { name: '加入城市' }).click();
    await expect(page.getByText('已加入城市')).toBeVisible();

    const uniquePost = `E2E 社区闭环 ${Date.now()}`;
    await page.getByLabel('发布城市动态').fill(uniquePost);
    await page.getByRole('button', { name: '发布动态' }).click();
    await expect(page).toHaveURL(/\/posts\/[0-9a-f-]+$/);
    await expect(page.getByText(uniquePost)).toBeVisible();

    await page.getByRole('button', { name: /^点赞/ }).click();
    await expect(page.getByRole('button', { name: /^已点赞/ })).toBeVisible();
    await page.getByRole('button', { name: /^收藏/ }).click();
    await expect(page.getByRole('button', { name: /^已收藏/ })).toBeVisible();
    await page.getByLabel('参与讨论').fill('这是一条 E2E 验收评论');
    await page.getByRole('button', { name: '发表评论' }).click();
    await expect(page.getByText('这是一条 E2E 验收评论')).toBeVisible();

    await page.goto('/me/posts');
    await expect(page.getByText(uniquePost)).toBeVisible();
    await page.goto('/me/saves');
    await expect(page.getByText(uniquePost)).toBeVisible();

    await page.goto('/activities');
    await page.locator('.route-activity-card').first().getByRole('link', { name: /查看活动/ }).click();
    await page.getByRole('button', { name: '立即报名' }).click();
    await expect(page.getByText('报名成功')).toBeVisible();

    await page.goto('/members/00000000-0000-4000-8000-000000000001');
    await page.getByRole('button', { name: '关注' }).click();
    await expect(page.getByRole('button', { name: '取消关注' })).toBeVisible();
    await page.goto('/me/activities');
    await expect(page.getByText('持续集成 OPC 社区活动')).toBeVisible();
    await page.goto('/me/follows');
    await expect(page.getByText('游民演示账号')).toBeVisible();
  });
});
