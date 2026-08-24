import { describe, expect, it } from 'vitest';
import { decryptPhone, encryptPhone, hashPhone, maskPhone, normalizePhone } from './phone';

describe('phone privacy helpers', () => {
  const secret = 'test-secret-that-is-longer-than-thirty-two-characters';

  it('normalizes mainland phone numbers', () => {
    expect(normalizePhone('+86 138-0013-8000')).toBe('13800138000');
    expect(() => normalizePhone('123')).toThrow('INVALID_PHONE');
  });

  it('encrypts and decrypts phone numbers', () => {
    const encrypted = encryptPhone('13800138000', secret);
    expect(encrypted).not.toContain('13800138000');
    expect(decryptPhone(encrypted, secret)).toBe('13800138000');
  });

  it('creates deterministic lookup hashes and masked display', () => {
    expect(hashPhone('13800138000', secret)).toBe(hashPhone('13800138000', secret));
    expect(maskPhone('13800138000')).toBe('138****8000');
  });
});
