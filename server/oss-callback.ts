import { createVerify } from 'node:crypto';

const allowedPublicKey = /^https?:\/\/gosspublic\.alicdn\.com\/callback_pub_key_v\d+\.pem$/;
const publicKeyCache = new Map<string, string>();

async function getPublicKey(encodedUrl: string): Promise<string> {
  const publicKeyUrl = Buffer.from(encodedUrl, 'base64').toString('utf8');
  if (!allowedPublicKey.test(publicKeyUrl)) throw new Error('INVALID_OSS_PUBLIC_KEY_URL');
  const cached = publicKeyCache.get(publicKeyUrl);
  if (cached) return cached;
  const response = await fetch(publicKeyUrl, { signal: AbortSignal.timeout(3_000), cache: 'force-cache' });
  if (!response.ok) throw new Error('OSS_PUBLIC_KEY_FETCH_FAILED');
  const publicKey = await response.text();
  publicKeyCache.set(publicKeyUrl, publicKey);
  return publicKey;
}

export async function verifyOssCallback(request: Request, body: string): Promise<boolean> {
  const authorization = request.headers.get('authorization');
  const encodedPublicKeyUrl = request.headers.get('x-oss-pub-key-url');
  if (!authorization || !encodedPublicKeyUrl) return false;
  const url = new URL(request.url);
  const pathAndQuery = `${decodeURIComponent(url.pathname)}${url.search}`;
  const verifier = createVerify('RSA-MD5');
  verifier.update(`${pathAndQuery}\n${body}`);
  verifier.end();
  return verifier.verify(await getPublicKey(encodedPublicKeyUrl), Buffer.from(authorization, 'base64'));
}
