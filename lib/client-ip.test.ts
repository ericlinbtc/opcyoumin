import { createHmac } from 'node:crypto';
import { describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/env', () => ({
  getServerEnv: () => ({ TRUST_PROXY_HOPS: 2 }),
  getRequestIpHashPepper: () => 'test-request-ip-pepper',
}));

import { extractClientIp, hashClientIp } from '@/lib/client-ip';

describe('extractClientIp', () => {
  it('uses the address inserted by the trusted edge proxy', () => {
    const headers = new Headers({ 'x-forwarded-for': '198.51.100.9, 10.0.0.8' });
    expect(extractClientIp(headers)).toBe('10.0.0.8');
  });

  it('supports a configured trusted proxy chain', () => {
    const headers = new Headers({ 'x-forwarded-for': '198.51.100.9, 10.0.0.7, 10.0.0.8' });
    expect(extractClientIp(headers, 2)).toBe('10.0.0.7');
  });

  it('falls back to x-real-ip and then unknown', () => {
    expect(extractClientIp(new Headers({ 'x-real-ip': '203.0.113.4' }))).toBe('203.0.113.4');
    expect(extractClientIp(new Headers())).toBe('unknown');
  });

  it('hashes the trusted client address without persisting the raw IP', () => {
    const headers = new Headers({ 'x-forwarded-for': '198.51.100.9, 10.0.0.7, 10.0.0.8' });
    const expected = createHmac('sha256', 'test-request-ip-pepper').update('10.0.0.7').digest('hex');
    expect(hashClientIp(headers)).toBe(expected);
    expect(hashClientIp(headers)).not.toContain('198.51.100.9');
  });
});
