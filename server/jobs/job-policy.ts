export const MAX_JOB_ATTEMPTS = 5;

export function requiredJobPayloadString(payload: Record<string, unknown>, key: string): string {
  const value = payload[key];
  if (typeof value !== 'string') throw new Error(`INVALID_JOB_PAYLOAD:${key}`);
  return value;
}

export function optionalJobPayloadString(payload: Record<string, unknown>, key: string): string | null {
  const value = payload[key];
  return typeof value === 'string' && value.length > 0 ? value : null;
}

export function optionalJobPayloadBoolean(payload: Record<string, unknown>, key: string): boolean {
  return payload[key] === true;
}

export function jobRetryDelaySeconds(attempts: number): number {
  return Math.min(3600, 30 * 2 ** Math.max(0, attempts - 1));
}

export function normalizeJobError(error: unknown): string {
  return String(error).slice(0, 10_000);
}
