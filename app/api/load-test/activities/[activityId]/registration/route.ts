import { apiError, apiSuccess, requestId } from '@/lib/http';
import { requireLoadTestSession } from '@/server/load-test-auth';
import { ActivityRegistrationError, cancelActivityRegistrationForUser, registerActivityForUser } from '@/server/services/activity-registration';

type RegistrationContext = { params: Promise<{ activityId: string }> };

async function authorize(request: Request, context: RegistrationContext) {
  const session = await requireLoadTestSession(request);
  const { activityId } = await context.params;
  return { session, activityId };
}

function failure(error: unknown, id: string) {
  if (error instanceof Error && error.message === 'NOT_FOUND') return apiError('NOT_FOUND', 'Not found', 404, id);
  if (error instanceof Error && error.message === 'UNAUTHORIZED') return apiError('UNAUTHORIZED', '无权执行压测写入', 401, id);
  if (error instanceof Error && error.message === 'FORBIDDEN') return apiError('FORBIDDEN', '无权执行压测写入', 403, id);
  if (error instanceof ActivityRegistrationError) return apiError('BAD_REQUEST', '活动已满额或不在报名状态', 409, id);
  return apiError('INTERNAL_ERROR', '活动报名操作失败', 500, id);
}

export async function POST(request: Request, context: RegistrationContext) {
  const id = requestId(request);
  try {
    const { session, activityId } = await authorize(request, context);
    const outcome = await registerActivityForUser(activityId, session.id);
    if (outcome === 'ALREADY_REGISTERED') return apiError('BAD_REQUEST', '已经报名该活动', 409, id);
    return apiSuccess({ status: 'registered' }, id, { status: 201 });
  } catch (error) {
    return failure(error, id);
  }
}

export async function DELETE(request: Request, context: RegistrationContext) {
  const id = requestId(request);
  try {
    const { session, activityId } = await authorize(request, context);
    const cancelled = await cancelActivityRegistrationForUser(activityId, session.id);
    return apiSuccess({ status: cancelled ? 'cancelled' : 'unchanged' }, id);
  } catch (error) {
    return failure(error, id);
  }
}
