import { timingSafeEqual } from 'node:crypto';
import { isSameOriginRequest } from '@/lib/csrf';
import { getServerEnv } from '@/lib/env';
import { requireSession } from '@/server/auth/session';

export function secretsMatch(actual: string | null, expected: string): boolean {
  if (!actual) return false;
  const actualBytes = Buffer.from(actual);
  const expectedBytes = Buffer.from(expected);
  return actualBytes.length === expectedBytes.length && timingSafeEqual(actualBytes, expectedBytes);
}

export function assertLoadTestRequest(request: Request): void {
  const env = getServerEnv();
  if (!env.LOAD_TEST_ENABLED || !env.LOAD_TEST_SECRET) throw new Error('NOT_FOUND');
  if (!isSameOriginRequest(request)) throw new Error('FORBIDDEN');
  if (!secretsMatch(request.headers.get('x-load-test-key'), env.LOAD_TEST_SECRET)) throw new Error('FORBIDDEN');
}

export async function requireLoadTestSession(request: Request) {
  assertLoadTestRequest(request);
  return requireSession();
}
