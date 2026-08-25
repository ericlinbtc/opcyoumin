import { createHash, randomUUID } from 'node:crypto';
import { and, eq } from 'drizzle-orm';
import { describe, expect, it, vi } from 'vitest';

const auth = vi.hoisted(() => ({ current: { id: '', role: 'user' as const, sessionId: '' } }));
const oss = vi.hoisted(() => ({ signatureUrl: vi.fn(() => 'https://oss.example/signed-upload'), copy: vi.fn(async () => undefined) }));
const safety = vi.hoisted(() => ({ evaluate: vi.fn(async () => ({ decision: 'approved' as const, reason: '自动安全审核通过' })) }));
vi.mock('@/server/auth/session', () => ({ requireSession: async () => auth.current }));
vi.mock('@/server/oss', () => ({ getOssClient: () => oss }));
vi.mock('@/server/oss-callback', () => ({ verifyOssCallback: async () => true }));
vi.mock('@/server/media/content-safety', () => ({ evaluateUploadedMedia: safety.evaluate }));

import { POST as createUpload } from '@/app/api/uploads/presign/route';
import { POST as completeUpload } from '@/app/api/uploads/callback/route';
import { getDatabase } from '@/db';
import { media, notifications, outboxJobs, profiles, users } from '@/db/schema';
import { processJob } from '@/server/jobs/worker';

const integration = process.env.DATABASE_URL ? describe.sequential : describe.skip;
const appOrigin = new URL(process.env.APP_URL ?? 'http://localhost:3001').origin;

async function createUser() {
  const id = randomUUID();
  await getDatabase().insert(users).values({ id, phoneHash: createHash('sha256').update(id).digest('hex'), phoneEncrypted: `media:${id}` });
  await getDatabase().insert(profiles).values({ userId: id, nickname: `媒体${id.slice(0, 5)}` });
  auth.current = { id, role: 'user', sessionId: randomUUID() };
  return id;
}

function jsonRequest(body: unknown) {
  return new Request(`${appOrigin}/api/uploads/presign`, { method: 'POST', headers: { origin: appOrigin, 'content-type': 'application/json' }, body: JSON.stringify(body) });
}

integration('media presign, callback and moderation pipeline', () => {
  it('persists an upload, accepts an idempotent callback and publishes an approved avatar', async () => {
    const userId = await createUser();
    const presign = await createUpload(jsonRequest({ filename: '../../avatar<script>.png', mimeType: 'image/png', byteSize: 2048 }));
    expect(presign.status).toBe(200);
    const payload = await presign.json() as { data: { mediaId: string; key: string; uploadUrl: string } };
    expect(payload.data.key).toMatch(new RegExp(`^original/${userId}/${payload.data.mediaId}/`));
    expect(payload.data.key).not.toContain('<');
    expect(payload.data.uploadUrl).toBe('https://oss.example/signed-upload');

    const callbackBody = new URLSearchParams({ key: payload.data.key, userId, mimeType: 'image/png', size: '2048' }).toString();
    const callbackRequest = () => new Request(`${appOrigin}/api/uploads/callback`, { method: 'POST', body: callbackBody });
    expect((await completeUpload(callbackRequest())).status).toBe(200);
    expect((await completeUpload(callbackRequest())).status).toBe(200);
    const [job] = await getDatabase().select().from(outboxJobs).where(eq(outboxJobs.idempotencyKey, `media.uploaded:${payload.data.mediaId}`));
    expect(job).toBeDefined();

    await getDatabase().update(outboxJobs).set({ status: 'processing', attempts: 1, leaseToken: randomUUID() }).where(eq(outboxJobs.id, job.id));
    const [processing] = await getDatabase().select().from(outboxJobs).where(eq(outboxJobs.id, job.id));
    await processJob(processing);
    const [stored] = await getDatabase().select().from(media).where(eq(media.id, payload.data.mediaId));
    const [profile] = await getDatabase().select({ avatarKey: profiles.avatarKey }).from(profiles).where(eq(profiles.userId, userId));
    const [notice] = await getDatabase().select({ title: notifications.title }).from(notifications).where(and(eq(notifications.userId, userId), eq(notifications.title, '媒体审核通过'))).limit(1);
    expect(stored.status).toBe('approved');
    expect(stored.publicKey).toContain(payload.data.mediaId);
    expect(profile.avatarKey).toBe(stored.publicKey);
    expect(notice?.title).toBe('媒体审核通过');
    expect(oss.copy).toHaveBeenCalledOnce();
  });

  it('rejects MIME spoofing and oversized files before publication', async () => {
    const userId = await createUser();
    const oversized = await createUpload(jsonRequest({ filename: 'huge.png', mimeType: 'image/png', byteSize: 10 * 1024 * 1024 + 1 }));
    expect(oversized.status).toBe(400);

    const presign = await createUpload(jsonRequest({ filename: 'photo.png', mimeType: 'image/png', byteSize: 2048 }));
    const payload = await presign.json() as { data: { mediaId: string; key: string } };
    const spoofed = new Request(`${appOrigin}/api/uploads/callback`, { method: 'POST', body: new URLSearchParams({ key: payload.data.key, userId, mimeType: 'text/html', size: '1024' }) });
    expect((await completeUpload(spoofed)).status).toBe(400);
    const [stored] = await getDatabase().select({ status: media.status }).from(media).where(eq(media.id, payload.data.mediaId));
    expect(stored.status).toBe('rejected');
  });
});
