import { describe, expect, it } from 'vitest';
import { extractClientIp } from '@/lib/client-ip';

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
});
