import { z } from 'zod';
import { and, count, eq, gte } from 'drizzle-orm';
import { getDatabase } from '@/db';
import { media, outboxJobs } from '@/db/schema';
import { getServerEnv } from '@/lib/env';
import { isSameOriginRequest } from '@/lib/csrf';
import { apiError, apiSuccess, requestId } from '@/lib/http';
import { requireSession } from '@/server/auth/session';
import { getOssClient } from '@/server/oss';
import { sanitizeUploadFilename, validateUploadRequest } from '@/server/media/upload-policy';

const bodySchema = z.object({
  filename: z.string().min(1).max(180),
  mimeType: z.string().min(1).max(120),
  byteSize: z.number().int().positive(),
});

export async function POST(request: Request) {
  const id = requestId(request);
  if (!isSameOriginRequest(request)) return apiError('FORBIDDEN', '请求来源无效', 403, id);
  const contentLength = Number(request.headers.get('content-length') ?? '0');
  if (contentLength > 4_096) return apiError('PAYLOAD_TOO_LARGE', '请求体过大', 413, id);
  try {
    const session = await requireSession();
    const body = bodySchema.parse(await request.json());
    const policy = validateUploadRequest(body.mimeType, body.byteSize);
    if ('error' in policy) return apiError('BAD_REQUEST', policy.error === 'UNSUPPORTED_MEDIA_TYPE' ? '不支持的文件类型' : policy.error === 'IMAGE_TOO_LARGE' ? '图片不能超过 10MB' : '视频不能超过 200MB', 400, id);
    const { kind } = policy;
    const db = getDatabase();
    const [recent] = await db.select({ value: count() }).from(media).where(and(eq(media.ownerId, session.id), gte(media.createdAt, new Date(Date.now() - 60 * 60 * 1_000))));
    if (recent.value >= 30) return apiError('RATE_LIMITED', '一小时内上传请求过多', 429, id);
    const [record] = await db.insert(media).values({ ownerId: session.id, kind, originalKey: 'pending', mimeType: body.mimeType, byteSize: body.byteSize }).returning({ id: media.id });
    const key = `original/${session.id}/${record.id}/${sanitizeUploadFilename(body.filename)}`;
    await db.transaction(async (tx) => {
      await tx.update(media).set({ originalKey: key }).where(eq(media.id, record.id));
      await tx.insert(outboxJobs).values({ topic: 'media.cleanup', idempotencyKey: `media.cleanup:stale:${record.id}`, payload: { mediaId: record.id, originalKey: key, onlyIfPending: true }, availableAt: new Date(Date.now() + 24 * 60 * 60 * 1_000) }).onConflictDoNothing();
    });
    const env = getServerEnv();
    const uploadUrl = getOssClient().signatureUrl(key, {
      method: 'PUT',
      expires: 600,
      'Content-Type': body.mimeType,
      callback: {
        url: `${env.APP_URL}/api/uploads/callback`,
        body: 'key=${object}&size=${size}&mimeType=${mimeType}&userId=${x:userId}',
        contentType: 'application/x-www-form-urlencoded',
        customValue: { userId: session.id },
      },
    });
    return apiSuccess({ mediaId: record.id, key, uploadUrl, method: 'PUT', expiresIn: 600, headers: { 'content-type': body.mimeType } }, id);
  } catch (error) {
    if (error instanceof z.ZodError) return apiError('BAD_REQUEST', '上传参数不正确', 400, id);
    if (error instanceof Error && error.message === 'UNAUTHORIZED') return apiError('UNAUTHORIZED', '请先登录', 401, id);
    console.error(JSON.stringify({ level: 'error', event: 'upload_presign_failed', requestId: id, error: String(error) }));
    return apiError('INTERNAL_ERROR', '无法创建上传凭证', 500, id);
  }
}
