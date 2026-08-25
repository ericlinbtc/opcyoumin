import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const script = fileURLToPath(new URL('./check-runtime-config.mjs', import.meta.url));
const productionEnv = {
  APP_URL: 'https://www.opcyoumin.com',
  DATABASE_URL: 'postgres://user:pass@db.internal:5432/youmin',
  REDIS_URL: 'rediss://cache.internal:6379',
  SESSION_SIGNING_SECRET: '0'.repeat(32),
  PHONE_ENCRYPTION_KEY: '1'.repeat(32),
  PHONE_HASH_PEPPER: '2'.repeat(32),
  REQUEST_IP_HASH_PEPPER: '3'.repeat(32),
  ALIYUN_ACCESS_KEY_ID: 'ci-access-key-id',
  ALIYUN_ACCESS_KEY_SECRET: '4'.repeat(32),
  ALIYUN_OSS_REGION: 'oss-cn-hangzhou',
  ALIYUN_OSS_BUCKET: 'youmin-media-prod',
  MEDIA_PUBLIC_BASE_URL: 'https://media.opcyoumin.com',
  MEDIA_CONTENT_SAFETY_ENDPOINT: 'https://safety.opcyoumin.com/review',
  MEDIA_CONTENT_SAFETY_TOKEN: '5'.repeat(16),
  NEXT_SERVER_ACTIONS_ENCRYPTION_KEY: Buffer.from('6'.repeat(32)).toString('base64'),
  RELEASE_SHA: '1234567890abcdef1234567890abcdef12345678',
  SAE_INSTANCE_ID: 'sae-instance-id',
  NEXT_PUBLIC_ICP_RECORD: '浙ICP备12345678号-1',
};

function check(profile: string, overrides: Record<string, string> = {}) {
  return spawnSync(process.execPath, [script, profile], {
    encoding: 'utf8',
    env: { NODE_ENV: 'test', PATH: process.env.PATH ?? '', ...productionEnv, ...overrides },
  });
}

describe('runtime configuration gate', () => {
  it('accepts a complete production-shaped configuration without printing values', () => {
    const result = check('production');
    expect(result.status).toBe(0);
    expect(result.stdout).toContain('Runtime configuration check passed for production');
    expect(result.stdout).not.toContain(productionEnv.SESSION_SIGNING_SECRET);
  });

  it('rejects placeholders, reserved hosts and malformed release identity', () => {
    const result = check('production', {
      APP_URL: 'https://app.test',
      DATABASE_URL: 'replace-with-database-url',
      RELEASE_SHA: 'short-sha',
    });
    expect(result.status).toBe(1);
    expect(result.stdout).toContain('placeholder-host');
    expect(result.stdout).toContain('placeholder');
    expect(result.stdout).toContain('invalid-sha');
    expect(result.stderr).toContain('Values were not printed');
  });

  it('rejects unknown profiles as usage errors', () => {
    const result = check('unknown');
    expect(result.status).toBe(2);
    expect(result.stderr).toContain('core|media|production');
  });
});
