import { describe, expect, it } from 'vitest';
import { MEDIA_SIZE_LIMITS, classifyMediaType, sanitizeUploadFilename, validateUploadCallback, validateUploadRequest } from './upload-policy';

describe('upload policy security matrix', () => {
  it.each([
    ['image/jpeg', 'image'],
    ['image/png', 'image'],
    ['image/webp', 'image'],
    ['video/mp4', 'video'],
    ['video/webm', 'video'],
    ['image/svg+xml', null],
    ['text/html', null],
    ['application/octet-stream', null],
  ] as const)('classifies %s as %s', (mimeType, expected) => {
    expect(classifyMediaType(mimeType)).toBe(expected);
  });

  it('rejects unsupported, empty and oversized uploads at the boundary', () => {
    expect(validateUploadRequest('text/html', 128)).toEqual({ error: 'UNSUPPORTED_MEDIA_TYPE' });
    expect(validateUploadRequest('image/png', 0)).toEqual({ error: 'IMAGE_TOO_LARGE' });
    expect(validateUploadRequest('image/png', MEDIA_SIZE_LIMITS.image + 1)).toEqual({ error: 'IMAGE_TOO_LARGE' });
    expect(validateUploadRequest('video/mp4', MEDIA_SIZE_LIMITS.video + 1)).toEqual({ error: 'VIDEO_TOO_LARGE' });
    expect(validateUploadRequest('image/png', MEDIA_SIZE_LIMITS.image)).toEqual({ kind: 'image' });
  });

  it('normalizes path traversal and active-content filenames', () => {
    expect(sanitizeUploadFilename('../../头像<script>.png')).toBe('..-..-script-.png');
    expect(sanitizeUploadFilename('ＡＢＣ 头像.png')).toBe('ABC-.png');
  });

  it('binds callbacks to the requested owner, object, MIME and maximum size', () => {
    const base = {
      key: 'original/user-a/media-a/photo.png',
      userId: 'user-a',
      mimeType: 'image/png',
      size: 1024,
      expectedKey: 'original/user-a/media-a/photo.png',
      expectedUserId: 'user-a',
      expectedMimeType: 'image/png',
      expectedSize: 2048,
      kind: 'image',
    };
    expect(validateUploadCallback(base)).toBeNull();
    expect(validateUploadCallback({ ...base, key: 'original/user-b/media-a/photo.png' })).toBe('CALLBACK_BINDING_MISMATCH');
    expect(validateUploadCallback({ ...base, mimeType: 'text/html' })).toBe('MIME_MISMATCH');
    expect(validateUploadCallback({ ...base, mimeType: 'image/jpeg' })).toBe('MIME_MISMATCH');
    expect(validateUploadCallback({ ...base, size: 2049 })).toBe('SIZE_MISMATCH');
  });
});
