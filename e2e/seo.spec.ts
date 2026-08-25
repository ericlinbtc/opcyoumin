import { expect, test } from '@playwright/test';

const canonicalOrigin = new URL(process.env.APP_URL ?? 'http://localhost:3001').origin;
const canonicalPaths = [
  '/cities',
  '/activities',
  '/activities/hangzhou-opc-night',
  '/organizations',
  '/organizations/00000000-0000-4000-8000-000000000201',
  '/knowledge',
  '/insights',
  '/policies',
  '/help',
  '/legal/about',
  '/legal/terms',
  '/legal/privacy',
  '/legal/risk',
  '/legal/cooperation',
] as const;

test('public pages declare route-specific canonical URLs', async ({ page }) => {
  for (const path of canonicalPaths) {
    await page.goto(path);
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href', `${canonicalOrigin}${path}`);
    await expect(page.locator('meta[property="og:url"]')).toHaveAttribute('content', `${canonicalOrigin}${path}`);
  }
});

test('login remains discoverable to users but excluded from search indexes', async ({ page }) => {
  await page.goto('/login');
  await expect(page.getByRole('heading', { name: '登录游民' })).toBeVisible();
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', /noindex/);
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href', `${canonicalOrigin}/login`);
});
