const imageTypes = new Set(['image/jpeg', 'image/png', 'image/webp']);
const videoTypes = new Set(['video/mp4', 'video/webm']);

export type MediaKind = 'image' | 'video';

export const MEDIA_SIZE_LIMITS: Record<MediaKind, number> = {
  image: 10 * 1024 * 1024,
  video: 200 * 1024 * 1024,
};

export function classifyMediaType(mimeType: string): MediaKind | null {
  if (imageTypes.has(mimeType)) return 'image';
  if (videoTypes.has(mimeType)) return 'video';
  return null;
}

export function sanitizeUploadFilename(value: string): string {
  return value.normalize('NFKC').replace(/[^a-zA-Z0-9._-]/g, '-').replace(/-+/g, '-').slice(-120);
}

export function validateUploadRequest(mimeType: string, byteSize: number): { kind: MediaKind } | { error: string } {
  const kind = classifyMediaType(mimeType);
  if (!kind) return { error: 'UNSUPPORTED_MEDIA_TYPE' };
  if (!Number.isSafeInteger(byteSize) || byteSize <= 0 || byteSize > MEDIA_SIZE_LIMITS[kind]) {
    return { error: kind === 'image' ? 'IMAGE_TOO_LARGE' : 'VIDEO_TOO_LARGE' };
  }
  return { kind };
}

export function validateUploadCallback(input: {
  key: string | null;
  userId: string | null;
  mimeType: string | null;
  size: number;
  expectedKey: string;
  expectedUserId: string;
  expectedMimeType: string;
  expectedSize: number;
  kind: string;
}): string | null {
  if (!input.key || !input.userId || !input.mimeType || !Number.isSafeInteger(input.size) || input.size <= 0) return 'INVALID_CALLBACK_DATA';
  if (input.key !== input.expectedKey || input.userId !== input.expectedUserId || !input.key.startsWith(`original/${input.userId}/`)) return 'CALLBACK_BINDING_MISMATCH';
  const classified = classifyMediaType(input.mimeType);
  if (!classified || classified !== input.kind || input.mimeType !== input.expectedMimeType) return 'MIME_MISMATCH';
  if (input.size > MEDIA_SIZE_LIMITS[classified] || input.size > input.expectedSize) return 'SIZE_MISMATCH';
  return null;
}
