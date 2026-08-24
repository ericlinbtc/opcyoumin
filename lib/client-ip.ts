import { createHmac } from 'node:crypto';
import { getRequestIpHashPepper, getServerEnv } from '@/lib/env';

export function extractClientIp(headers: Headers, trustedProxyHops = 1): string {
  const chain = headers.get('x-forwarded-for')
    ?.split(',')
    .map((value) => value.trim())
    .filter(Boolean) ?? [];

  if (chain.length > 0) {
    return chain[Math.max(0, chain.length - trustedProxyHops)];
  }

  return headers.get('x-real-ip')?.trim() || 'unknown';
}

export function hashClientIp(headers: Headers): string {
  const env = getServerEnv();
  const ip = extractClientIp(headers, env.TRUST_PROXY_HOPS);
  return createHmac('sha256', getRequestIpHashPepper(env)).update(ip).digest('hex');
}
