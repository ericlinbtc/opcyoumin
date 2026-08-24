import { check, fail, sleep } from 'k6';
import exec from 'k6/execution';
import http from 'k6/http';
import { Rate, Trend } from 'k6/metrics';

const profile = __ENV.LOAD_PROFILE || 'smoke';
const release = profile === 'release';
const baseUrl = (__ENV.BASE_URL || 'http://127.0.0.1:3001').replace(/\/$/, '');
const loadTestKey = __ENV.LOAD_TEST_SECRET || '';
const postId = __ENV.LOAD_POST_ID || '00000000-0000-4000-8000-000000000002';
const activityId = __ENV.LOAD_ACTIVITY_ID || '00000000-0000-4000-8000-000000000003';
const phoneStart = Number(__ENV.LOAD_PHONE_START || '13910000000');
const releaseSha = __ENV.RELEASE_SHA || 'local-uncommitted';

const loginFailures = new Rate('login_failures');
const readFailures = new Rate('read_failures');
const commentFailures = new Rate('comment_failures');
const registrationFailures = new Rate('registration_failures');
const loginDuration = new Trend('login_duration', true);
const readDuration = new Trend('read_duration', true);
const commentDuration = new Trend('comment_duration', true);
const registrationDuration = new Trend('registration_duration', true);

const arrival = (rate, duration, preAllocatedVUs, maxVUs, startTime = '0s') => ({
  executor: 'constant-arrival-rate', rate, timeUnit: '1s', duration, preAllocatedVUs, maxVUs, startTime,
});

export const options = {
  discardResponseBodies: false,
  scenarios: {
    public_read: { ...arrival(release ? 100 : 5, release ? '15m' : '30s', release ? 120 : 10, release ? 500 : 30), exec: 'publicRead' },
    login: { ...arrival(release ? 5 : 1, release ? '5m' : '20s', release ? 20 : 3, release ? 100 : 10), exec: 'login' },
    comment_write: { ...arrival(release ? 5 : 1, release ? '5m' : '20s', release ? 20 : 3, release ? 100 : 10, release ? '30s' : '5s'), exec: 'commentWrite' },
    activity_registration: { ...arrival(release ? 5 : 1, release ? '5m' : '20s', release ? 20 : 3, release ? 100 : 10, release ? '30s' : '5s'), exec: 'activityRegistration' },
  },
  thresholds: {
    checks: ['rate>0.99'],
    read_failures: ['rate<0.01'], login_failures: ['rate<0.01'], comment_failures: ['rate<0.01'], registration_failures: ['rate<0.01'],
    read_duration: ['p(95)<500'], login_duration: ['p(95)<800'], comment_duration: ['p(95)<800'], registration_duration: ['p(95)<800'],
  },
};

const jsonHeaders = () => ({ headers: { 'content-type': 'application/json', origin: baseUrl, 'x-load-test-key': loadTestKey } });

function uniquePhone(namespace) {
  const offsets = { login: 0, comment_write: 2_000_000, activity_registration: 4_000_000 };
  return String(phoneStart + offsets[namespace] + exec.scenario.iterationInTest).padStart(11, '0');
}

function performLogin(namespace) {
  const response = http.post(`${baseUrl}/api/load-test/login`, JSON.stringify({ phone: uniquePhone(namespace) }), { ...jsonHeaders(), tags: { operation: 'login' } });
  const passed = check(response, { 'login returns 200': (result) => result.status === 200 });
  loginFailures.add(!passed);
  loginDuration.add(response.timings.duration);
  return passed;
}

export function setup() {
  if (!['smoke', 'release'].includes(profile)) fail(`LOAD_PROFILE must be smoke or release, received: ${profile}`);
  if (loadTestKey.length < 32) fail('LOAD_TEST_SECRET must contain at least 32 characters');
  if (!/^1[3-9]\d{9}$/.test(String(phoneStart))) fail('LOAD_PHONE_START must be an 11-digit mainland China test range');
  const health = http.get(`${baseUrl}/ready`, { tags: { operation: 'readiness' } });
  if (health.status !== 200) fail(`Target is not ready: ${health.status} ${health.body}`);
  if (/^[0-9a-f]{40}$/i.test(releaseSha) && health.headers['X-Release-Sha'] !== releaseSha) {
    fail(`Target release mismatch: expected ${releaseSha}, observed ${health.headers['X-Release-Sha'] || 'missing'}`);
  }
  return { releaseSha, profile };
}

export function publicRead() {
  const routes = ['/cities', '/activities', `/activities/${activityId}`, `/posts/${postId}`, '/api/prototype/city?name=%E5%8C%97%E4%BA%AC', `/api/prototype/posts/${postId}`];
  const route = routes[Math.floor(Math.random() * routes.length)];
  const response = http.get(`${baseUrl}${route}`, { tags: { operation: 'public_read', route } });
  const passed = check(response, { 'public read returns 200': (result) => result.status === 200 });
  readFailures.add(!passed);
  readDuration.add(response.timings.duration);
  sleep(0.05);
}

export function login() { performLogin('login'); }

export function commentWrite() {
  if (!performLogin('comment_write')) return;
  const response = http.post(`${baseUrl}/api/load-test/posts/${postId}/comments`, JSON.stringify({ content: `k6 ${releaseSha.slice(0, 12)} ${exec.scenario.iterationInTest}` }), { ...jsonHeaders(), tags: { operation: 'comment_write' } });
  const passed = check(response, { 'comment returns 201': (result) => result.status === 201 });
  commentFailures.add(!passed);
  commentDuration.add(response.timings.duration);
}

export function activityRegistration() {
  if (!performLogin('activity_registration')) return;
  const url = `${baseUrl}/api/load-test/activities/${activityId}/registration`;
  const registered = http.post(url, null, { ...jsonHeaders(), tags: { operation: 'activity_register' } });
  const registrationPassed = check(registered, { 'registration returns 201': (result) => result.status === 201 });
  registrationFailures.add(!registrationPassed);
  registrationDuration.add(registered.timings.duration);
  if (!registrationPassed) return;
  const cancelled = http.del(url, null, { ...jsonHeaders(), tags: { operation: 'activity_cancel' } });
  registrationFailures.add(!check(cancelled, { 'cancellation returns 200': (result) => result.status === 200 }));
}

export function handleSummary(data) {
  const destination = __ENV.LOAD_RESULT_JSON || 'artifacts/load/summary.json';
  return {
    [destination]: JSON.stringify({ metadata: { profile, releaseSha, baseUrl, generatedAt: new Date().toISOString() }, result: data }, null, 2),
    stdout: `k6 profile=${profile} release=${releaseSha} checks=${data.metrics.checks?.values?.rate ?? 'n/a'}\n`,
  };
}
