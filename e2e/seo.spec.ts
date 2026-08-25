import { expect, test, type Page } from '@playwright/test';

const canonicalOrigin = new URL(process.env.APP_URL ?? 'http://localhost:3001').origin;
const canonicalPaths = [
  '/cities',
  '/activities',
  '/organizations',
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

async function expectCanonical(page: Page, path: string) {
  await page.goto(path);
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href', `${canonicalOrigin}${path}`);
  await expect(page.locator('meta[property="og:url"]')).toHaveAttribute('content', `${canonicalOrigin}${path}`);
}

test('public pages declare route-specific canonical URLs', async ({ page }) => {
  for (const path of canonicalPaths) {
    await expectCanonical(page, path);
  }

  await page.goto('/activities');
  const activityPath = await page.locator('a.directory-link[href^="/activities/"]').first().getAttribute('href');
  expect(activityPath).toBeTruthy();
  await expectCanonical(page, activityPath!);

  await page.goto('/organizations');
  const organizationPath = await page.locator('a.directory-link[href^="/organizations/"]').first().getAttribute('href');
  expect(organizationPath).toBeTruthy();
  await expectCanonical(page, organizationPath!);
});

test('login remains discoverable to users but excluded from search indexes', async ({ page }) => {
  await page.goto('/login');
  await expect(page.getByRole('heading', { name: '登录游民' })).toBeVisible();
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', /noindex/);
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href', `${canonicalOrigin}/login`);
});
