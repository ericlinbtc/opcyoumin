import { and, eq } from 'drizzle-orm';
import { z } from 'zod';
import { getDatabase } from '@/db';
import { media } from '@/db/schema';
import { apiError, apiSuccess, requestId } from '@/lib/http';
import { requireSession } from '@/server/auth/session';

export async function GET(request: Request, { params }: { params: Promise<{ mediaId: string }> }) {
  const id = requestId(request);
  try {
    const session = await requireSession();
    const mediaId = z.uuid().parse((await params).mediaId);
    const [item] = await getDatabase().select({ id: media.id, kind: media.kind, status: media.status, publicKey: media.publicKey })
      .from(media).where(and(eq(media.id, mediaId), eq(media.ownerId, session.id))).limit(1);
    if (!item) return apiError('NOT_FOUND', '媒体不存在', 404, id);
    return apiSuccess({ id: item.id, kind: item.kind, status: item.status, published: item.status === 'approved' && Boolean(item.publicKey) }, id);
  } catch (error) {
    if (error instanceof z.ZodError) return apiError('BAD_REQUEST', '媒体参数不正确', 400, id);
    if (error instanceof Error && error.message === 'UNAUTHORIZED') return apiError('UNAUTHORIZED', '请先登录', 401, id);
    return apiError('INTERNAL_ERROR', '媒体状态查询失败', 500, id);
  }
}
