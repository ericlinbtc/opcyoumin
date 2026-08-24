import { afterEach, describe, expect, it, vi } from 'vitest';
import { verifyOssCallback } from './oss-callback';

describe('OSS callback verification', () => {
  afterEach(() => vi.restoreAllMocks());

  it('rejects missing signatures without network access', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    await expect(verifyOssCallback(new Request('https://app.test/api/uploads/callback'), 'key=x')).resolves.toBe(false);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('rejects attacker-controlled public-key URLs without fetching them', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    const request = new Request('https://app.test/api/uploads/callback', { headers: {
      authorization: Buffer.from('fake').toString('base64'),
      'x-oss-pub-key-url': Buffer.from('https://attacker.example/key.pem').toString('base64'),
    } });
    await expect(verifyOssCallback(request, 'key=x')).resolves.toBe(false);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('fails closed when the allowed key endpoint is unavailable', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('', { status: 503 }));
    const request = new Request('https://app.test/api/uploads/callback', { headers: {
      authorization: Buffer.from('fake').toString('base64'),
      'x-oss-pub-key-url': Buffer.from('https://gosspublic.alicdn.com/callback_pub_key_v1.pem').toString('base64'),
    } });
    await expect(verifyOssCallback(request, 'key=x')).resolves.toBe(false);
  });
});
