import { randomInt } from 'node:crypto';
import DysmsapiClient, { SendSmsRequest } from '@alicloud/dysmsapi20170525';
import { Config } from '@alicloud/openapi-client';
import { getPhoneHashPepper, getServerEnv, requireProductionEnv } from '@/lib/env';
import { hashPhone, normalizePhone } from '@/lib/phone';
import { getReadyRedis, getRedis } from '@/server/redis';

const INCREMENT_WITH_EXPIRY_SCRIPT = `
local count = redis.call('INCR', KEYS[1])
if count == 1 then redis.call('EXPIRE', KEYS[1], ARGV[1]) end
return count
`;

const CONSUME_CODE_SCRIPT = `
local expected = redis.call('GET', KEYS[1])
if expected and expected == ARGV[1] then
  redis.call('DEL', KEYS[1])
  redis.call('DEL', KEYS[2])
  return 1
end
return 0
`;

type SmsSendResult = { retryAfter: number; expiresIn: number };

function utcDay(): string {
  return new Date().toISOString().slice(0, 10);
}

async function incrementWithExpiry(key: string, ttlSeconds: number): Promise<number> {
  const redis = getRedis();
  return Number(await redis.eval(INCREMENT_WITH_EXPIRY_SCRIPT, 1, key, String(ttlSeconds)));
}

async function sendViaAliyun(phone: string, code: string): Promise<void> {
  const env = getServerEnv();
  requireProductionEnv(env, [
    'ALIYUN_ACCESS_KEY_ID',
    'ALIYUN_ACCESS_KEY_SECRET',
    'ALIYUN_SMS_SIGN_NAME',
    'ALIYUN_SMS_TEMPLATE_CODE',
  ]);
  if (env.NODE_ENV !== 'production' && env.SMS_DEV_CODE) return;
  if (!env.ALIYUN_ACCESS_KEY_ID || !env.ALIYUN_ACCESS_KEY_SECRET || !env.ALIYUN_SMS_SIGN_NAME || !env.ALIYUN_SMS_TEMPLATE_CODE) {
    throw new Error('ALIYUN_SMS_NOT_CONFIGURED');
  }
  const config = new Config({
    accessKeyId: env.ALIYUN_ACCESS_KEY_ID,
    accessKeySecret: env.ALIYUN_ACCESS_KEY_SECRET,
    regionId: env.ALIYUN_REGION_ID,
    endpoint: 'dysmsapi.aliyuncs.com',
  });
  const client = new DysmsapiClient(config);
  const response = await client.sendSms(new SendSmsRequest({
    phoneNumbers: phone,
    signName: env.ALIYUN_SMS_SIGN_NAME,
    templateCode: env.ALIYUN_SMS_TEMPLATE_CODE,
    templateParam: JSON.stringify({ code }),
  }));
  if (response.body?.code !== 'OK') throw new Error(`ALIYUN_SMS_${response.body?.code ?? 'UNKNOWN'}`);
}

export async function sendVerificationCode(phoneValue: string, ipHash: string): Promise<SmsSendResult> {
  await getReadyRedis();
  const env = getServerEnv();
  const phone = normalizePhone(phoneValue);
  const phoneKey = hashPhone(phone, getPhoneHashPepper(env));
  const redis = getRedis();
  const intervalKey = `sms:interval:${phoneKey}`;
  const acquired = await redis.set(intervalKey, '1', 'EX', env.SMS_SEND_INTERVAL_SECONDS, 'NX');
  if (!acquired) {
    const intervalTtl = Math.max(await redis.ttl(intervalKey), 1);
    throw new Error(`RATE_LIMITED:${intervalTtl}`);
  }

  try {
    const phoneCount = await incrementWithExpiry(`sms:phone:${utcDay()}:${phoneKey}`, 86_400);
    if (phoneCount > env.SMS_PHONE_DAILY_LIMIT) throw new Error('RATE_LIMITED:86400');
    const ipCount = await incrementWithExpiry(`sms:ip:${utcDay()}:${ipHash}`, 86_400);
    if (ipCount > env.SMS_IP_DAILY_LIMIT) throw new Error('RATE_LIMITED:86400');

    const code = env.NODE_ENV !== 'production' && env.SMS_DEV_CODE
      ? env.SMS_DEV_CODE
      : String(randomInt(100_000, 1_000_000));
    await sendViaAliyun(phone, code);
    await redis.multi()
      .set(`sms:code:${phoneKey}`, code, 'EX', env.SMS_CODE_TTL_SECONDS)
      .del(`sms:fail:${phoneKey}`)
      .exec();
    return { retryAfter: env.SMS_SEND_INTERVAL_SECONDS, expiresIn: env.SMS_CODE_TTL_SECONDS };
  } catch (error) {
    await redis.del(intervalKey);
    throw error;
  }
}

export async function verifyCode(phoneValue: string, code: string): Promise<string> {
  await getReadyRedis();
  const env = getServerEnv();
  const phone = normalizePhone(phoneValue);
  const phoneKey = hashPhone(phone, getPhoneHashPepper(env));
  const redis = getRedis();
  const cooldown = await redis.ttl(`sms:cooldown:${phoneKey}`);
  if (cooldown > 0) throw new Error(`RATE_LIMITED:${cooldown}`);
  const consumed = Number(await redis.eval(
    CONSUME_CODE_SCRIPT,
    2,
    `sms:code:${phoneKey}`,
    `sms:fail:${phoneKey}`,
    code,
  ));
  if (consumed !== 1) {
    const failures = await incrementWithExpiry(`sms:fail:${phoneKey}`, env.SMS_CODE_TTL_SECONDS);
    if (failures >= env.SMS_FAILURE_COOLDOWN_THRESHOLD) {
      const cooldownSeconds = Math.min(3600, 60 * 2 ** Math.min(failures - env.SMS_FAILURE_COOLDOWN_THRESHOLD, 5));
      await redis.set(`sms:cooldown:${phoneKey}`, '1', 'EX', cooldownSeconds);
    }
    throw new Error('INVALID_CODE');
  }
  return phone;
}
