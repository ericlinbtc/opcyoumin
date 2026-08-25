import { describe, expect, it } from 'vitest';
import { apiError, apiSuccess, normalizeRequestId, requestId } from '@/lib/http';

describe('normalizeRequestId', () => {
  it('preserves a canonical upstream UUID', () => {
    const value = '123e4567-e89b-12d3-a456-426614174000';
    expect(normalizeRequestId(value)).toBe(value);
  });
  it('replaces malformed or attacker-controlled values', () => {
    expect(normalizeRequestId('not-a-request-id')).toMatch(/^[0-9a-f-]{36}$/);
    expect(normalizeRequestId('123e4567-e89b-12d3-a456-426614174000\nforged')).not.toContain('forged');
  });

  it('reads a safe request id and returns it on success and error responses', async () => {
    const id = '123e4567-e89b-12d3-a456-426614174000';
    expect(requestId(new Request('https://example.com', { headers: { 'x-request-id': id } }))).toBe(id);

    const success = apiSuccess({ value: 1 }, id, { status: 201, headers: { 'cache-control': 'no-store' } });
    expect(success.status).toBe(201);
    expect(success.headers.get('x-request-id')).toBe(id);
    expect(success.headers.get('cache-control')).toBe('no-store');
    await expect(success.json()).resolves.toEqual({ ok: true, data: { value: 1 }, requestId: id });

    const error = apiError('BAD_REQUEST', '请求错误', 400, id, { field: 'name' });
    expect(error.status).toBe(400);
    expect(error.headers.get('x-request-id')).toBe(id);
    await expect(error.json()).resolves.toEqual({
      ok: false,
      error: { code: 'BAD_REQUEST', message: '请求错误', details: { field: 'name' } },
      requestId: id,
    });
  });
});
