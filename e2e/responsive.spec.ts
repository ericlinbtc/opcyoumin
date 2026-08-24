import { expect, test } from '@playwright/test';

for (const path of ['/', '/cities', '/activities', '/login']) {
  test(`${path} has no horizontal overflow or clipped primary heading`, async ({ page }) => {
    await page.goto(path);
    const metrics = await page.evaluate(() => ({ viewport: document.documentElement.clientWidth, content: document.documentElement.scrollWidth }));
    expect(metrics.content).toBeLessThanOrEqual(metrics.viewport + 1);
    const firstHeading = page.getByRole('heading').first();
    await expect(firstHeading).toBeVisible();
    const box = await firstHeading.boundingBox();
    expect(box).not.toBeNull();
    expect(box!.x).toBeGreaterThanOrEqual(0);
    expect(box!.x + box!.width).toBeLessThanOrEqual(metrics.viewport + 1);
  });
}
