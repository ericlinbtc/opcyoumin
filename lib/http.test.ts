import { describe, expect, it } from 'vitest';
import { normalizeRequestId } from '@/lib/http';

describe('normalizeRequestId', () => {
  it('preserves a canonical upstream UUID', () => {
    const value = '123e4567-e89b-12d3-a456-426614174000';
    expect(normalizeRequestId(value)).toBe(value);
  });
  it('replaces malformed or attacker-controlled values', () => {
    expect(normalizeRequestId('not-a-request-id')).toMatch(/^[0-9a-f-]{36}$/);
    expect(normalizeRequestId('123e4567-e89b-12d3-a456-426614174000\nforged')).not.toContain('forged');
  });
});
