import { headers } from 'next/headers';
import { hashClientIp } from '@/lib/client-ip';
import { normalizeRequestId } from '@/lib/http';

export async function getAuditContext(): Promise<{ requestId: string; ipHash: string }> {
  const requestHeaders = await headers();
  return { requestId: normalizeRequestId(requestHeaders.get('x-request-id')), ipHash: hashClientIp(requestHeaders) };
}
