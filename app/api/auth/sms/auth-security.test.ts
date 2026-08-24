import { beforeEach, describe, expect, it, vi } from 'vitest';

const sms = vi.hoisted(() => ({ sendVerificationCode: vi.fn(), verifyCode: vi.fn() }));
vi.mock('@/server/auth/sms', () => sms);

import { POST as sendCode } from './send/route';
import { POST as verifyCode } from './verify/route';

const appOrigin = new URL(process.env.APP_URL ?? 'http://localhost:3001').origin;

function request(path: string, body: unknown): Request {
  return new Request(`${appOrigin}${path}`, {
    method: 'POST',
    headers: { origin: appOrigin, 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}

describe('SMS authentication attack matrix', () => {
  beforeEach(() => vi.clearAllMocks());

  it.each([
    { phone: "13800138000' OR 1=1 --" },
    { phone: '<script>alert(1)</script>' },
    { phone: { $gt: '' } },
  ])('rejects malformed or injection-shaped phone input', async (body) => {
    const response = await sendCode(request('/api/auth/sms/send', body));
    expect(response.status).toBe(400);
    expect(sms.sendVerificationCode).not.toHaveBeenCalled();
  });

  it('does not disclose whether a phone belongs to an existing account', async () => {
    sms.verifyCode.mockRejectedValue(new Error('INVALID_CODE'));
    const first = await verifyCode(request('/api/auth/sms/verify', { phone: '13800138001', code: '000000' }));
    const second = await verifyCode(request('/api/auth/sms/verify', { phone: '13900139001', code: '000000' }));
    expect(first.status).toBe(400);
    expect(second.status).toBe(400);
    expect(await first.json()).toMatchObject({ ok: false, error: { code: 'INVALID_CODE', message: '验证码错误或已失效' } });
    expect(await second.json()).toMatchObject({ ok: false, error: { code: 'INVALID_CODE', message: '验证码错误或已失效' } });
  });

  it('rejects forged origins before touching the SMS provider', async () => {
    const forged = new Request(`${appOrigin}/api/auth/sms/send`, {
      method: 'POST', headers: { origin: 'https://attacker.example', 'content-type': 'application/json' }, body: JSON.stringify({ phone: '13800138000' }),
    });
    const response = await sendCode(forged);
    expect(response.status).toBe(403);
    expect(sms.sendVerificationCode).not.toHaveBeenCalled();
  });
});
