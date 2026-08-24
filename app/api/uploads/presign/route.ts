import { z } from 'zod';
import { eq } from 'drizzle-orm';
import { getDatabase } from '@/db';
import { media } from '@/db/schema';
import { getServerEnv } from '@/lib/env';
import { isSameOriginRequest } from '@/lib/csrf';
import { apiError, apiSuccess, requestId } from '@/lib/http';
import { requireSession } from '@/server/auth/session';
import { getOssClient } from '@/server/oss';

const imageTypes = new Set(['image/jpeg', 'image/png', 'image/webp']);
const videoTypes = new Set(['video/mp4', 'video/webm']);
const bodySchema = z.object({
  filename: z.string().min(1).max(180),
  mimeType: z.string().min(1).max(120),
  byteSize: z.number().int().positive(),
});

function safeFilename(value: string): string {
  return value.normalize('NFKC').replace(/[^a-zA-Z0-9._-]/g, '-').replace(/-+/g, '-').slice(-120);
}

export async function POST(request: Request) {
  const id = requestId(request);
  if (!isSameOriginRequest(request)) return apiError('FORBIDDEN', '请求来源无效', 403, id);
  try {
    const session = await requireSession();
    const body = bodySchema.parse(await request.json());
    const kind = imageTypes.has(body.mimeType) ? 'image' : videoTypes.has(body.mimeType) ? 'video' : null;
    if (!kind) return apiError('BAD_REQUEST', '不支持的文件类型', 400, id);
    if ((kind === 'image' && body.byteSize > 10 * 1024 * 1024) || (kind === 'video' && body.byteSize > 200 * 1024 * 1024)) {
      return apiError('BAD_REQUEST', kind === 'image' ? '图片不能超过 10MB' : '视频不能超过 200MB', 400, id);
    }
    const [record] = await getDatabase().insert(media).values({
      ownerId: session.id,
      kind,
      originalKey: 'pending',
      mimeType: body.mimeType,
      byteSize: body.byteSize,
    }).returning({ id: media.id });
    const key = `original/${session.id}/${record.id}/${safeFilename(body.filename)}`;
    await getDatabase().update(media).set({ originalKey: key }).where(eq(media.id, record.id));
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
