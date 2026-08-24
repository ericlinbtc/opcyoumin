import { createCipheriv, createDecipheriv, createHmac, randomBytes } from 'node:crypto';

const PHONE_PATTERN = /^1[3-9]\d{9}$/;

export function normalizePhone(value: string): string {
  const phone = value.replace(/[\s-]/g, '').replace(/^\+86/, '');
  if (!PHONE_PATTERN.test(phone)) throw new Error('INVALID_PHONE');
  return phone;
}

export function hashPhone(phone: string, pepper: string): string {
  return createHmac('sha256', pepper).update(normalizePhone(phone)).digest('hex');
}

function encryptionKey(secret: string): Buffer {
  return createHmac('sha256', secret).update('youmin-phone-encryption-v1').digest();
}

export function encryptPhone(phone: string, secret: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', encryptionKey(secret), iv);
  const encrypted = Buffer.concat([cipher.update(normalizePhone(phone), 'utf8'), cipher.final()]);
  return [iv, cipher.getAuthTag(), encrypted].map((part) => part.toString('base64url')).join('.');
}

export function decryptPhone(payload: string, secret: string): string {
  const [ivValue, tagValue, encryptedValue] = payload.split('.');
  if (!ivValue || !tagValue || !encryptedValue) throw new Error('INVALID_PHONE_PAYLOAD');
  const decipher = createDecipheriv('aes-256-gcm', encryptionKey(secret), Buffer.from(ivValue, 'base64url'));
  decipher.setAuthTag(Buffer.from(tagValue, 'base64url'));
  return Buffer.concat([
    decipher.update(Buffer.from(encryptedValue, 'base64url')),
    decipher.final(),
  ]).toString('utf8');
}

export function maskPhone(phone: string): string {
  const normalized = normalizePhone(phone);
  return `${normalized.slice(0, 3)}****${normalized.slice(-4)}`;
}
