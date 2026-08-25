const profile = process.argv[2] ?? 'core';

const core = [
  'APP_URL',
  'DATABASE_URL',
  'REDIS_URL',
  'SESSION_SIGNING_SECRET',
  'PHONE_ENCRYPTION_KEY',
  'PHONE_HASH_PEPPER',
  'REQUEST_IP_HASH_PEPPER',
];
const media = [
  ...core,
  'ALIYUN_ACCESS_KEY_ID',
  'ALIYUN_ACCESS_KEY_SECRET',
  'ALIYUN_OSS_REGION',
  'ALIYUN_OSS_BUCKET',
  'MEDIA_PUBLIC_BASE_URL',
  'MEDIA_CONTENT_SAFETY_ENDPOINT',
  'MEDIA_CONTENT_SAFETY_TOKEN',
];
const profiles = {
  core,
  media,
  production: [
    ...media,
    'NEXT_SERVER_ACTIONS_ENCRYPTION_KEY',
    'RELEASE_SHA',
    'SAE_INSTANCE_ID',
    'NEXT_PUBLIC_ICP_RECORD',
  ],
};

if (!(profile in profiles)) {
  console.error('Usage: check-runtime-config.mjs <core|media|production>');
  process.exit(2);
}

const placeholderPattern = /(replace|example|change[-_ ]?me|your[-_ ]|unique[-_ ]?suffix)/i;

function statusFor(name, value) {
  if (!value) return 'missing';
  if (placeholderPattern.test(value)) return 'placeholder';
  if (['SESSION_SIGNING_SECRET', 'PHONE_ENCRYPTION_KEY', 'PHONE_HASH_PEPPER', 'REQUEST_IP_HASH_PEPPER'].includes(name) && value.length < 32) return 'too-short';
  if (name === 'MEDIA_CONTENT_SAFETY_TOKEN' && value.length < 16) return 'too-short';
  if (name === 'RELEASE_SHA' && !/^[0-9a-f]{40}$/i.test(value)) return 'invalid-sha';
  if (name === 'NEXT_SERVER_ACTIONS_ENCRYPTION_KEY') {
    const bytes = Buffer.from(value, 'base64');
    if (!/^[A-Za-z0-9+/]+={0,2}$/.test(value) || ![16, 24, 32].includes(bytes.length)) return 'invalid-base64-key';
  }
  if (name === 'DATABASE_URL' && !/^postgres(?:ql)?:\/\//.test(value)) return 'invalid-url';
  if (name === 'REDIS_URL' && !/^rediss?:\/\//.test(value)) return 'invalid-url';
  if (['APP_URL', 'MEDIA_PUBLIC_BASE_URL', 'MEDIA_CONTENT_SAFETY_ENDPOINT'].includes(name)) {
    try {
      const url = new URL(value);
      if (!['http:', 'https:'].includes(url.protocol)) return 'invalid-url';
      if (profile === 'production' && url.protocol !== 'https:') return 'https-required';
      if (profile === 'production' && (url.hostname === 'localhost' || /\.(?:example|invalid|localhost|test)$/.test(url.hostname))) return 'placeholder-host';
    } catch {
      return 'invalid-url';
    }
  }
  return 'ok';
}

const report = profiles[profile].map((name) => ({ component: name, status: statusFor(name, process.env[name]) }));
console.table(report);
const failed = report.filter((item) => item.status !== 'ok');
if (failed.length > 0) {
  console.error(`Runtime configuration check failed for ${profile}: ${failed.length} item(s) need attention. Values were not printed.`);
  process.exit(1);
}
console.info(`Runtime configuration check passed for ${profile}. Values were not printed.`);
