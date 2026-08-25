import { describe, expect, it } from 'vitest';
import {
  jobRetryDelaySeconds,
  MAX_JOB_ATTEMPTS,
  normalizeJobError,
  optionalJobPayloadBoolean,
  optionalJobPayloadString,
  requiredJobPayloadString,
} from '@/server/jobs/job-policy';

describe('worker job policy', () => {
  it('validates required and optional payload values without coercion', () => {
    const payload = { id: 'job-id', empty: '', enabled: true, disabled: 'true' };
    expect(requiredJobPayloadString(payload, 'id')).toBe('job-id');
    expect(() => requiredJobPayloadString(payload, 'missing')).toThrow('INVALID_JOB_PAYLOAD:missing');
    expect(optionalJobPayloadString(payload, 'id')).toBe('job-id');
    expect(optionalJobPayloadString(payload, 'empty')).toBeNull();
    expect(optionalJobPayloadString(payload, 'missing')).toBeNull();
    expect(optionalJobPayloadBoolean(payload, 'enabled')).toBe(true);
    expect(optionalJobPayloadBoolean(payload, 'disabled')).toBe(false);
  });

  it('uses bounded exponential retry delays and a fixed dead-letter threshold', () => {
    expect(MAX_JOB_ATTEMPTS).toBe(5);
    expect(jobRetryDelaySeconds(0)).toBe(30);
    expect(jobRetryDelaySeconds(1)).toBe(30);
    expect(jobRetryDelaySeconds(2)).toBe(60);
    expect(jobRetryDelaySeconds(5)).toBe(480);
    expect(jobRetryDelaySeconds(20)).toBe(3600);
  });

  it('bounds persisted error text', () => {
    expect(normalizeJobError(new Error('worker failed'))).toContain('worker failed');
    expect(normalizeJobError('x'.repeat(12_000))).toHaveLength(10_000);
  });
});
