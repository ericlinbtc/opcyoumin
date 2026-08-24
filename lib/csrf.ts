import { getServerEnv } from '@/lib/env';

export function isSameOriginRequest(request: Request, appUrl = getServerEnv().APP_URL): boolean {
  const origin = request.headers.get('origin');
  if (!origin) return false;
  try {
    return new URL(origin).origin === new URL(appUrl).origin;
  } catch {
    return false;
  }
}
