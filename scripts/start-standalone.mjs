import { access } from 'node:fs/promises';
import { constants } from 'node:fs';
import { spawn } from 'node:child_process';
import { resolve } from 'node:path';

const server = resolve(import.meta.dirname, '../.next/standalone/server.js');
try {
  await access(server, constants.R_OK);
} catch {
  console.error('Standalone build is missing. Run `pnpm build` before `pnpm start`.');
  process.exit(1);
}

const child = spawn(process.execPath, [server], {
  stdio: 'inherit',
  env: { ...process.env, NODE_ENV: 'production', HOSTNAME: process.env.HOSTNAME || '0.0.0.0', PORT: process.env.PORT || '3001' },
});
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => child.kill(signal));
child.on('exit', (code, signal) => process.exitCode = signal ? 1 : (code ?? 1));
