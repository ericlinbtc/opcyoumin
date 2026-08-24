import { z } from 'zod';
import { apiError, apiSuccess, requestId } from '@/lib/http';
import { isLocalDemoMode } from '@/lib/env';
import { listPostComments } from '@/server/repositories/public-content';

export async function GET(request: Request, { params }: { params: Promise<{ postId: string }> }) {
  const id = requestId(request);
  try {
    if (isLocalDemoMode()) return apiSuccess({ connected: false, comments: [] }, id);
    const postId = z.uuid().parse((await params).postId);
    const comments = await listPostComments(postId);
    return apiSuccess({ connected: true, comments: comments.map((comment) => ({ ...comment, createdAt: comment.createdAt.toISOString() })) }, id);
  } catch (error) {
    if (error instanceof z.ZodError) return apiError('BAD_REQUEST', '动态参数不正确', 400, id);
    return apiError('INTERNAL_ERROR', '回复加载失败', 500, id);
  }
}
