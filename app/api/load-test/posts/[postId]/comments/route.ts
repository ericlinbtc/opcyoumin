import { z } from 'zod';
import { apiError, apiSuccess, requestId } from '@/lib/http';
import { moderateText } from '@/server/domain/moderation';
import { requireLoadTestSession } from '@/server/load-test-auth';
import { createCommentForUser } from '@/server/services/comments';

const bodySchema = z.object({ content: z.string().trim().min(1).max(1_000), parentId: z.uuid().optional() });

export async function POST(request: Request, context: { params: Promise<{ postId: string }> }) {
  const id = requestId(request);
  try {
    const session = await requireLoadTestSession(request);
    const { postId } = await context.params;
    const values = bodySchema.parse(await request.json());
    const decision = moderateText(values.content);
    if (decision === 'reject') return apiError('BAD_REQUEST', '回复未通过发布规则', 400, id);
    const status = decision === 'review' ? 'pending' : 'published';
    const comment = await createCommentForUser({ ...values, postId, userId: session.id, status });
    return apiSuccess({ commentId: comment.id, status }, id, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) return apiError('BAD_REQUEST', '回复格式不正确', 400, id);
    if (error instanceof Error && error.message === 'NOT_FOUND') return apiError('NOT_FOUND', 'Not found', 404, id);
    if (error instanceof Error && error.message === 'UNAUTHORIZED') return apiError('UNAUTHORIZED', '无权执行压测写入', 401, id);
    if (error instanceof Error && error.message === 'FORBIDDEN') return apiError('FORBIDDEN', '无权执行压测写入', 403, id);
    if (error instanceof Error && ['POST_NOT_FOUND', 'PARENT_COMMENT_NOT_FOUND'].includes(error.message)) return apiError('NOT_FOUND', '动态或回复目标不存在', 404, id);
    if (error instanceof Error && error.message === 'NEW_ACCOUNT_LIMIT') return apiError('RATE_LIMITED', '新账号评论次数已达上限', 429, id);
    return apiError('INTERNAL_ERROR', '回复失败', 500, id);
  }
}
