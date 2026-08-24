import { writeFile } from 'node:fs/promises';

const [baseUrlValue, expectedSha, minimumInstancesValue = '1', output = 'deployment-verification.json'] = process.argv.slice(2);
if (!baseUrlValue || !/^https?:\/\//.test(baseUrlValue)) throw new Error('Usage: node scripts/verify-deployment.mjs <base-url> <40-char-sha> [minimum-instances] [output]');
if (!/^[0-9a-f]{40}$/i.test(expectedSha || '')) throw new Error('Expected release SHA must contain 40 hexadecimal characters');
const minimumInstances = Number(minimumInstancesValue);
if (!Number.isInteger(minimumInstances) || minimumInstances < 1) throw new Error('minimum-instances must be a positive integer');
const baseUrl = baseUrlValue.replace(/\/$/, '');
const samples = [];

for (let index = 0; index < 30; index += 1) {
  try {
    const response = await fetch(`${baseUrl}/health?deployment-check=${Date.now()}-${index}`, { cache: 'no-store', headers: { connection: 'close', 'cache-control': 'no-cache' } });
    const body = await response.json().catch(() => null);
    samples.push({ status: response.status, release: response.headers.get('x-release-sha') ?? body?.data?.release, instance: response.headers.get('x-instance-id') ?? body?.data?.instance });
  } catch (error) {
    samples.push({ status: 0, error: error instanceof Error ? error.message : String(error) });
  }
}
let readyStatus = 0;
let readyRelease;
try {
  const ready = await fetch(`${baseUrl}/ready?deployment-check=${Date.now()}`, { cache: 'no-store', headers: { connection: 'close', 'cache-control': 'no-cache' } });
  readyStatus = ready.status;
  readyRelease = ready.headers.get('x-release-sha');
} catch {}
const releases = new Set(samples.map((sample) => sample.release));
const instances = new Set(samples.map((sample) => sample.instance).filter((value) => value && value !== 'unknown'));
const passed = samples.every((sample) => sample.status === 200 && sample.release === expectedSha) && readyStatus === 200 && readyRelease === expectedSha && releases.size === 1 && instances.size >= minimumInstances;
const evidence = { generatedAt: new Date().toISOString(), baseUrl, expectedSha, minimumInstances, observedInstances: [...instances], observedReleases: [...releases], readyStatus, readyRelease, samples, passed };
await writeFile(output, `${JSON.stringify(evidence, null, 2)}\n`);
console.info(JSON.stringify({ passed, observedInstances: instances.size, observedReleases: [...releases], output }));
if (!passed) process.exit(1);
