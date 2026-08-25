import { createHash } from 'node:crypto';
import { jwtVerify, SignJWT } from 'jose';

const SESSION_ISSUER = 'youmin-web';
const SESSION_AUDIENCE = 'youmin-session';

function signingKey(signingSecret: string): Uint8Array {
  return new TextEncoder().encode(signingSecret);
}

export function tokenHash(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

export async function signSessionToken(input: {
  userId: string;
  sessionId: string;
  ttlSeconds: number;
  signingSecret: string;
}): Promise<string> {
  return new SignJWT({ sid: input.sessionId })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(input.userId)
    .setIssuer(SESSION_ISSUER)
    .setAudience(SESSION_AUDIENCE)
    .setIssuedAt()
    .setExpirationTime(`${input.ttlSeconds}s`)
    .sign(signingKey(input.signingSecret));
}

export async function verifySessionToken(token: string, signingSecret: string): Promise<{ userId: string; sessionId: string }> {
  const { payload } = await jwtVerify(token, signingKey(signingSecret), {
    algorithms: ['HS256'],
    issuer: SESSION_ISSUER,
    audience: SESSION_AUDIENCE,
  });
  if (!payload.sub || typeof payload.sid !== 'string') throw new Error('INVALID_SESSION_CLAIMS');
  return { userId: payload.sub, sessionId: payload.sid };
}
