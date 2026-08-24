import { and, eq } from 'drizzle-orm';
import { getDatabase } from '@/db';
import { media, outboxJobs } from '@/db/schema';
import { apiError, apiSuccess, requestId } from '@/lib/http';
import { verifyOssCallback } from '@/server/oss-callback';

export async function POST(request: Request) {
  const id = requestId(request);
  const body = await request.text();
  try {
    if (!await verifyOssCallback(request, body)) return apiError('FORBIDDEN', '无效的 OSS 回调签名', 403, id);
    const values = new URLSearchParams(body);
    const key = values.get('key');
    const userId = values.get('userId');
    const mimeType = values.get('mimeType');
    const size = Number(values.get('size'));
    if (!key || !userId || !mimeType || !Number.isSafeInteger(size) || size <= 0 || !key.startsWith(`original/${userId}/`)) {
      return apiError('BAD_REQUEST', '无效的 OSS 回调数据', 400, id);
    }
    const [record] = await getDatabase().select({ id: media.id, kind: media.kind, byteSize: media.byteSize, mimeType: media.mimeType, status: media.status })
      .from(media).where(and(eq(media.originalKey, key), eq(media.ownerId, userId))).limit(1);
    if (!record) return apiError('NOT_FOUND', '上传记录不存在', 404, id);
    if (record.status === 'uploaded' && record.byteSize === size) return apiSuccess({ mediaId: record.id }, id);
    const sizeLimit = record.kind === 'image' ? 10 * 1024 * 1024 : 200 * 1024 * 1024;
    if (size > sizeLimit || size > record.byteSize || mimeType !== record.mimeType) {
      await getDatabase().update(media).set({ status: 'rejected', updatedAt: new Date() }).where(eq(media.id, record.id));
      return apiError('BAD_REQUEST', '上传文件与申请信息不一致', 400, id);
    }
    const updated = await getDatabase().transaction(async (tx) => {
      const [row] = await tx.update(media)
        .set({ status: 'uploaded', byteSize: size, updatedAt: new Date() })
        .where(and(eq(media.id, record.id), eq(media.status, 'pending')))
        .returning({ id: media.id });
      if (row) await tx.insert(outboxJobs).values({ topic: 'media.uploaded', idempotencyKey: `media.uploaded:${row.id}`, payload: { mediaId: row.id, ownerId: userId, key } }).onConflictDoNothing();
      return row;
    });
    if (!updated) return apiError('BAD_REQUEST', '上传记录状态不允许更新', 409, id);
    return apiSuccess({ mediaId: updated.id }, id);
  } catch (error) {
    console.error(JSON.stringify({ level: 'error', event: 'upload_callback_failed', requestId: id, error: String(error) }));
    return apiError('INTERNAL_ERROR', '上传回调处理失败', 500, id);
  }
}
