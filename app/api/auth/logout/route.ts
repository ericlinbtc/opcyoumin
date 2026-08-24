import { eq } from 'drizzle-orm';
import { getDatabase } from '@/db';
import { sessions } from '@/db/schema';
import { isSameOriginRequest } from '@/lib/csrf';
import { apiError, apiSuccess, requestId } from '@/lib/http';
import { clearSessionCookie, readSession } from '@/server/auth/session';

export async function POST(request: Request) {
  const id = requestId(request);
  if (!isSameOriginRequest(request)) return apiError('FORBIDDEN', '请求来源无效', 403, id);
  try {
    const session = await readSession();
    if (session) await getDatabase().update(sessions).set({ revokedAt: new Date() }).where(eq(sessions.id, session.sessionId));
  } catch (error) {
    console.error(JSON.stringify({ level: 'error', event: 'session_revoke_failed', requestId: id, error: String(error) }));
  } finally {
    await clearSessionCookie();
  }
  return apiSuccess({ loggedOut: true }, id);
}
