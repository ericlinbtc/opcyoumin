import 'server-only';

import { z } from 'zod';
import { getServerEnv } from '@/lib/env';

const responseSchema = z.object({ decision: z.enum(['approved', 'rejected', 'review']), reason: z.string().trim().min(1).max(500) });

export async function evaluateUploadedMedia(input: { mediaId: string; kind: string; mimeType: string; byteSize: number; signedUrl: string }): Promise<{ decision: 'approved' | 'rejected' | 'review'; reason: string }> {
  const env = getServerEnv();
  if (!env.MEDIA_CONTENT_SAFETY_ENDPOINT) return { decision: 'review', reason: '未配置自动内容安全服务，已进入人工审核队列' };
  const response = await fetch(env.MEDIA_CONTENT_SAFETY_ENDPOINT, {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...(env.MEDIA_CONTENT_SAFETY_TOKEN ? { authorization: `Bearer ${env.MEDIA_CONTENT_SAFETY_TOKEN}` } : {}) },
    body: JSON.stringify(input),
    signal: AbortSignal.timeout(15_000),
  });
  if (!response.ok) throw new Error(`MEDIA_SAFETY_PROVIDER_${response.status}`);
  return responseSchema.parse(await response.json());
}
