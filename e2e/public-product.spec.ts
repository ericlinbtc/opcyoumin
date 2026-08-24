import { expect, test } from '@playwright/test';

test('public city, post, activity and content routes are navigable', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: /在 OPC 城市寻找志同道合的人/ })).toBeVisible();
  await expect(page.getByRole('button', { name: '搜索 OPC 城市' })).toBeVisible();
  await page.goto('/cities');
  await expect(page.getByRole('heading', { name: '找到你的城市社区' })).toBeVisible();
  await page.getByRole('link', { name: /进入城市/ }).first().click();
  await expect(page.locator('.city-banner').getByRole('heading')).toBeVisible();
  await page.locator('.feed-item').first().locator('.feed-copy').click();
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();

  await page.goto('/activities');
  await expect(page.getByRole('heading', { name: '在线认识，线下连接' })).toBeVisible();
  await page.locator('.route-activity-card').first().getByRole('link', { name: /查看活动/ }).click();
  await expect(page.getByText('免费')).toBeVisible();

  await page.goto('/knowledge');
  await expect(page.getByRole('heading', { name: '知识' })).toBeVisible();
  await page.goto('/insights');
  await expect(page.getByRole('heading', { name: '洞察' })).toBeVisible();
});

test('protected pages redirect to login and forged API origins are rejected', async ({ page, request }) => {
  await page.goto('/me');
  await expect(page).toHaveURL(/\/login$/);
  const response = await request.post('/api/auth/sms/send', { headers: { origin: 'https://example.com' }, data: { phone: '13800138000' } });
  expect(response.status()).toBe(403);
  await expect(response.json()).resolves.toMatchObject({ ok: false, error: { code: 'FORBIDDEN' } });
});
