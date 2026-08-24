import { existsSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';

const releaseMode = process.argv.includes('--release');
const root = resolve(import.meta.dirname, '..');
const requirements = [
  { name: 'node', command: process.execPath, args: ['--version'], pattern: /^v24\./, required: true },
  { name: 'pnpm', command: 'pnpm', args: ['--version'], pattern: /^11\.19\./, required: true },
  { name: 'docker', command: 'docker', args: ['--version'], pattern: /version/i, required: releaseMode },
  { name: 'terraform', command: 'terraform', args: ['version'], pattern: /Terraform v1\.15\./, required: releaseMode },
  { name: 'k6', command: 'k6', args: ['version'], pattern: /v2\.2\./, required: releaseMode },
];

let failed = false;
const report = requirements.map((requirement) => {
  const result = spawnSync(requirement.command, requirement.args, { encoding: 'utf8' });
  const output = `${result.stdout || ''}${result.stderr || ''}`.trim().split('\n')[0] || 'not installed';
  const available = result.status === 0 && requirement.pattern.test(output);
  if (requirement.required && !available) failed = true;
  return { component: requirement.name, required: requirement.required, status: available ? 'ok' : requirement.required ? 'missing-or-wrong-version' : 'optional-unavailable', version: output };
});

const envFile = existsSync(resolve(root, '.env.local'));
if (!envFile && !releaseMode) report.push({ component: '.env.local', required: false, status: 'optional-unavailable', version: 'copy .env.example before running the full stack' });
console.table(report);
if (failed) {
  console.error(`Environment check failed in ${releaseMode ? 'release' : 'development'} mode.`);
  process.exit(1);
}
