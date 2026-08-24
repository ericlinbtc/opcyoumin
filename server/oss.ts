import OSS from 'ali-oss';
import { getServerEnv, requireProductionEnv } from '@/lib/env';

let client: OSS | undefined;

export function getOssClient(): OSS {
  const env = getServerEnv();
  requireProductionEnv(env, ['ALIYUN_ACCESS_KEY_ID', 'ALIYUN_ACCESS_KEY_SECRET', 'ALIYUN_OSS_REGION', 'ALIYUN_OSS_BUCKET']);
  if (!env.ALIYUN_ACCESS_KEY_ID || !env.ALIYUN_ACCESS_KEY_SECRET || !env.ALIYUN_OSS_REGION || !env.ALIYUN_OSS_BUCKET) {
    throw new Error('ALIYUN_OSS_NOT_CONFIGURED');
  }
  client ??= new OSS({
    region: env.ALIYUN_OSS_REGION,
    endpoint: env.ALIYUN_OSS_ENDPOINT,
    bucket: env.ALIYUN_OSS_BUCKET,
    accessKeyId: env.ALIYUN_ACCESS_KEY_ID,
    accessKeySecret: env.ALIYUN_ACCESS_KEY_SECRET,
    secure: true,
    authorizationV4: true,
  });
  return client;
}
