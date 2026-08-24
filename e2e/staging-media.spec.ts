import { expect, test } from '@playwright/test';
import { eq } from 'drizzle-orm';
import { getDatabase } from '../db';
import { media } from '../db/schema';

const enabled = process.env.E2E_REAL_OSS === 'true'
  && Boolean(process.env.E2E_BASE_URL)
  && Boolean(process.env.E2E_SESSION_COOKIE)
  && Boolean(process.env.DATABASE_URL)
  && Boolean(process.env.MEDIA_PUBLIC_BASE_URL);

test.describe('real staging OSS media pipeline', () => {
  test.skip(!enabled, 'requires an explicit staging URL, test session, database and real OSS configuration');
  test.skip(({ isMobile }) => isMobile, 'one real upload is sufficient');

  test('uploads an avatar, receives the OSS callback, passes moderation and is publicly readable', async ({ context, page }) => {
    const baseUrl = new URL(process.env.E2E_BASE_URL!);
    await context.addCookies([{
      name: process.env.SESSION_COOKIE_NAME ?? 'youmin_session', value: process.env.E2E_SESSION_COOKIE!, domain: baseUrl.hostname, path: '/', httpOnly: true, secure: baseUrl.protocol === 'https:', sameSite: 'Lax',
    }]);
    await page.goto('/me');
    const presignResponse = page.waitForResponse((response) => response.url().includes('/api/uploads/presign') && response.request().method() === 'POST');
    await page.getByLabel(/头像/).setInputFiles({
      name: 'staging-avatar.png',
      mimeType: 'image/png',
      buffer: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=', 'base64'),
    });
    const presign = await presignResponse;
    expect(presign.ok()).toBe(true);
    const payload = await presign.json() as { data: { mediaId: string } };
    await expect(page.getByText('头像已上传，审核通过后将自动更新。')).toBeVisible();

    await expect.poll(async () => {
      const [record] = await getDatabase().select({ status: media.status }).from(media).where(eq(media.id, payload.data.mediaId));
      return record?.status;
    }, { timeout: 90_000, intervals: [1_000, 2_000, 5_000] }).toBe('approved');
    const [record] = await getDatabase().select({ publicKey: media.publicKey }).from(media).where(eq(media.id, payload.data.mediaId));
    expect(record.publicKey).toBeTruthy();
    const publicResponse = await page.request.get(`${process.env.MEDIA_PUBLIC_BASE_URL!.replace(/\/$/, '')}/${record.publicKey}`);
    expect(publicResponse.ok()).toBe(true);
    expect(publicResponse.headers()['content-type']).toContain('image/');
  });
});
