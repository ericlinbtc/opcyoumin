import type { Instrumentation } from 'next';
import { registerOTel } from '@vercel/otel';

export function register() {
  registerOTel({ serviceName: 'youmin-web' });
}

export const onRequestError: Instrumentation.onRequestError = async (error, request, context) => {
  const digest = error && typeof error === 'object' && 'digest' in error ? String(error.digest) : undefined;
  console.error(JSON.stringify({
    level: 'error',
    event: 'next_request_error',
    method: request.method,
    path: request.path,
    routePath: context.routePath,
    routeType: context.routeType,
    digest,
    error: error instanceof Error ? error.message : String(error),
  }));
};
