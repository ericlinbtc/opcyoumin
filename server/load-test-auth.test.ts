import { describe, expect, it } from 'vitest';
import { secretsMatch } from '@/server/load-test-auth';

describe('load-test secret comparison', () => {
  it('requires an exact non-empty secret', () => {
    expect(secretsMatch('a'.repeat(32), 'a'.repeat(32))).toBe(true);
    expect(secretsMatch('b'.repeat(32), 'a'.repeat(32))).toBe(false);
    expect(secretsMatch('a'.repeat(31), 'a'.repeat(32))).toBe(false);
    expect(secretsMatch(null, 'a'.repeat(32))).toBe(false);
  });
});
