import { describe, expect, it } from 'vitest';
import { isSameOriginRequest } from '@/lib/csrf';

describe('isSameOriginRequest', () => {
  const appUrl = 'https://opcyoumin.com';
  it('accepts the configured application origin', () => {
    expect(isSameOriginRequest(new Request(`${appUrl}/api`, { headers: { origin: appUrl } }), appUrl)).toBe(true);
  });
  it('rejects missing, malformed, subdomain and cross-site origins', () => {
    expect(isSameOriginRequest(new Request(`${appUrl}/api`), appUrl)).toBe(false);
    expect(isSameOriginRequest(new Request(`${appUrl}/api`, { headers: { origin: 'not-a-url' } }), appUrl)).toBe(false);
    expect(isSameOriginRequest(new Request(`${appUrl}/api`, { headers: { origin: 'https://evil.opcyoumin.com' } }), appUrl)).toBe(false);
    expect(isSameOriginRequest(new Request(`${appUrl}/api`, { headers: { origin: 'https://example.com' } }), appUrl)).toBe(false);
  });
});
