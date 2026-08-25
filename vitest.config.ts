import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';

export default defineConfig({
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('.', import.meta.url)),
      'server-only': fileURLToPath(new URL('./tests/server-only.ts', import.meta.url)),
    },
  },
  test: {
    environment: 'node',
    include: ['**/*.test.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json-summary'],
      exclude: ['server/domain/types.ts'],
      include: [
        'lib/client-ip.ts',
        'lib/csrf.ts',
        'lib/http.ts',
        'lib/phone.ts',
        'lib/seo.ts',
        'server/domain/**/*.ts',
        'server/auth/session-token.ts',
        'server/jobs/job-policy.ts',
        'server/load-test-auth.ts',
        'server/media/upload-policy.ts',
        'server/oss-callback.ts',
      ],
      thresholds: { statements: 80, branches: 80, functions: 80, lines: 80 },
    },
  },
});
