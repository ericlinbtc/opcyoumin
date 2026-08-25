import { beforeEach, describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({
  enabled: true,
  secret: 'a'.repeat(32),
  sameOrigin: true,
  session: { id: 'test-user', sessionId: 'test-session', role: 'user' as const },
}));

vi.mock('@/lib/env', () => ({
  getServerEnv: () => ({ LOAD_TEST_ENABLED: state.enabled, LOAD_TEST_SECRET: state.secret }),
}));
vi.mock('@/lib/csrf', () => ({ isSameOriginRequest: () => state.sameOrigin }));
vi.mock('@/server/auth/session', () => ({ requireSession: async () => state.session }));

import { assertLoadTestRequest, requireLoadTestSession, secretsMatch } from '@/server/load-test-auth';

beforeEach(() => {
  state.enabled = true;
  state.secret = 'a'.repeat(32);
  state.sameOrigin = true;
});

describe('load-test secret comparison', () => {
  it('requires an exact non-empty secret', () => {
    expect(secretsMatch('a'.repeat(32), 'a'.repeat(32))).toBe(true);
    expect(secretsMatch('b'.repeat(32), 'a'.repeat(32))).toBe(false);
    expect(secretsMatch('a'.repeat(31), 'a'.repeat(32))).toBe(false);
    expect(secretsMatch(null, 'a'.repeat(32))).toBe(false);
  });

  it('accepts only an enabled, same-origin request with the exact key', async () => {
    const request = new Request('https://staging.example.com/api/load-test/login', {
      headers: { 'x-load-test-key': state.secret },
    });
    expect(() => assertLoadTestRequest(request)).not.toThrow();
    await expect(requireLoadTestSession(request)).resolves.toEqual(state.session);
  });

  it('hides disabled routes and rejects cross-origin or invalid keys', () => {
    const request = (key = state.secret) => new Request('https://staging.example.com/api/load-test/login', {
      headers: { 'x-load-test-key': key },
    });

    state.enabled = false;
    expect(() => assertLoadTestRequest(request())).toThrow('NOT_FOUND');

    state.enabled = true;
    state.sameOrigin = false;
    expect(() => assertLoadTestRequest(request())).toThrow('FORBIDDEN');

    state.sameOrigin = true;
    expect(() => assertLoadTestRequest(request('b'.repeat(32)))).toThrow('FORBIDDEN');
  });
});
