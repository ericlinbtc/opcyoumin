import { z } from 'zod';

const serverEnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  APP_URL: z.url().default('http://localhost:3001'),
  DATABASE_URL: z.string().min(1).optional(),
  REDIS_URL: z.string().min(1).optional(),
  SESSION_COOKIE_NAME: z.string().min(1).default('youmin_session'),
  SESSION_TTL_SECONDS: z.coerce.number().int().positive().default(2_592_000),
  SESSION_SIGNING_SECRET: z.string().min(32).optional(),
  PHONE_ENCRYPTION_KEY: z.string().min(32).optional(),
  PHONE_HASH_PEPPER: z.string().min(32).optional(),
  REQUEST_IP_HASH_PEPPER: z.string().min(32).optional(),
  TRUST_PROXY_HOPS: z.coerce.number().int().min(1).max(8).default(1),
  ALIYUN_REGION_ID: z.string().default('cn-hangzhou'),
  ALIYUN_ACCESS_KEY_ID: z.string().optional(),
  ALIYUN_ACCESS_KEY_SECRET: z.string().optional(),
  ALIYUN_SMS_SIGN_NAME: z.string().optional(),
  ALIYUN_SMS_TEMPLATE_CODE: z.string().optional(),
  ALIYUN_OSS_REGION: z.string().optional(),
  ALIYUN_OSS_BUCKET: z.string().optional(),
  ALIYUN_OSS_ENDPOINT: z.string().optional(),
  MEDIA_PUBLIC_BASE_URL: z.url().optional(),
  MEDIA_CONTENT_SAFETY_ENDPOINT: z.url().optional(),
  MEDIA_CONTENT_SAFETY_TOKEN: z.string().min(16).optional(),
  SMS_DEV_CODE: z.string().regex(/^\d{6}$/).optional(),
  SMS_CODE_TTL_SECONDS: z.coerce.number().int().min(60).max(900).default(300),
  SMS_SEND_INTERVAL_SECONDS: z.coerce.number().int().min(30).max(600).default(60),
  SMS_PHONE_DAILY_LIMIT: z.coerce.number().int().min(1).max(100).default(10),
  SMS_IP_DAILY_LIMIT: z.coerce.number().int().min(1).max(500).default(30),
  SMS_FAILURE_COOLDOWN_THRESHOLD: z.coerce.number().int().min(3).max(20).default(5),
  NEW_ACCOUNT_POST_LIMIT: z.coerce.number().int().min(1).max(100).default(3),
  NEW_ACCOUNT_COMMENT_LIMIT: z.coerce.number().int().min(1).max(500).default(20),
  LOAD_TEST_ENABLED: z.stringbool().default(false),
  LOAD_TEST_SECRET: z.string().min(32).optional(),
  RELEASE_SHA: z.string().regex(/^[0-9a-f]{40}$/i).optional(),
  SAE_INSTANCE_ID: z.string().min(1).optional(),
});

export type ServerEnv = z.infer<typeof serverEnvSchema>;

let cachedEnv: ServerEnv | undefined;

export function getServerEnv(): ServerEnv {
  cachedEnv ??= serverEnvSchema.parse(process.env);
  return cachedEnv;
}

export function requireProductionEnv(
  env: ServerEnv,
  keys: Array<keyof ServerEnv>,
): void {
  if (env.NODE_ENV !== 'production') return;
  const missing = keys.filter((key) => !env[key]);
  if (missing.length > 0) {
    throw new Error(`Missing production environment variables: ${missing.join(', ')}`);
  }
}

export function isLocalDemoMode(): boolean {
  const env = getServerEnv();
  return env.NODE_ENV !== 'production' && !env.DATABASE_URL;
}

export function getPhoneHashPepper(env = getServerEnv()): string {
  requireProductionEnv(env, ['PHONE_HASH_PEPPER']);
  return env.PHONE_HASH_PEPPER ?? 'development-phone-pepper-32-chars';
}

export function getPhoneEncryptionKey(env = getServerEnv()): string {
  requireProductionEnv(env, ['PHONE_ENCRYPTION_KEY']);
  return env.PHONE_ENCRYPTION_KEY ?? 'development-phone-key-at-least-32-chars';
}

export function getRequestIpHashPepper(env = getServerEnv()): string {
  requireProductionEnv(env, ['REQUEST_IP_HASH_PEPPER']);
  return env.REQUEST_IP_HASH_PEPPER ?? 'development-request-ip-pepper-32-chars';
}

export function getMediaPublicBaseUrl(env = getServerEnv()): string {
  requireProductionEnv(env, ['MEDIA_PUBLIC_BASE_URL']);
  return (env.MEDIA_PUBLIC_BASE_URL ?? 'http://localhost:3001/media').replace(/\/$/, '');
}
