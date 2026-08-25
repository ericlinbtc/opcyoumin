import { NextResponse } from 'next/server';

export type ApiErrorCode =
  | 'BAD_REQUEST'
  | 'UNAUTHORIZED'
  | 'FORBIDDEN'
  | 'NOT_FOUND'
  | 'RATE_LIMITED'
  | 'PAYLOAD_TOO_LARGE'
  | 'SMS_SEND_FAILED'
  | 'INVALID_CODE'
  | 'INTERNAL_ERROR';

export function requestId(request: Request): string {
  return normalizeRequestId(request.headers.get('x-request-id'));
}

export function normalizeRequestId(candidate: string | null | undefined): string {
  return candidate && /^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i.test(candidate) ? candidate : crypto.randomUUID();
}

export function apiSuccess<T>(data: T, id: string, init?: ResponseInit) {
  return NextResponse.json({ ok: true, data, requestId: id }, {
    ...init,
    headers: { ...Object.fromEntries(new Headers(init?.headers)), 'x-request-id': id },
  });
}

export function apiError(
  code: ApiErrorCode,
  message: string,
  status: number,
  id: string,
  details?: Record<string, unknown>,
) {
  return NextResponse.json(
    { ok: false, error: { code, message, details }, requestId: id },
    { status, headers: { 'x-request-id': id } },
  );
}
