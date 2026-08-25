import { describe, expect, it } from 'vitest';
import { SignJWT } from 'jose';
import { signSessionToken, tokenHash, verifySessionToken } from '@/server/auth/session-token';

const signingSecret = 'test-session-signing-secret-at-least-32-characters';

describe('session token contract', () => {
  it('round-trips the user and session identity with the expected contract', async () => {
    const token = await signSessionToken({
      userId: 'user-id',
      sessionId: 'session-id',
      ttlSeconds: 3600,
      signingSecret,
    });
    await expect(verifySessionToken(token, signingSecret)).resolves.toEqual({ userId: 'user-id', sessionId: 'session-id' });
    expect(tokenHash(token)).toMatch(/^[0-9a-f]{64}$/);
    expect(tokenHash(token)).toBe(tokenHash(token));
  });

  it('rejects the wrong key and a modified token', async () => {
    const token = await signSessionToken({
      userId: 'user-id',
      sessionId: 'session-id',
      ttlSeconds: 3600,
      signingSecret,
    });
    await expect(verifySessionToken(token, 'different-session-signing-secret-at-least-32-characters')).rejects.toThrow();
    await expect(verifySessionToken(`${token.slice(0, -1)}x`, signingSecret)).rejects.toThrow();
  });

  it('rejects a correctly signed token that omits required session claims', async () => {
    const token = await new SignJWT({})
      .setProtectedHeader({ alg: 'HS256' })
      .setSubject('user-id')
      .setIssuer('youmin-web')
      .setAudience('youmin-session')
      .setExpirationTime('1h')
      .sign(new TextEncoder().encode(signingSecret));
    await expect(verifySessionToken(token, signingSecret)).rejects.toThrow('INVALID_SESSION_CLAIMS');
  });
});
