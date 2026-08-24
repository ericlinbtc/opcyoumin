import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
  scenarios: {
    public_read: { executor: 'constant-arrival-rate', rate: 100, timeUnit: '1s', duration: '15m', preAllocatedVUs: 100, maxVUs: 500 },
  },
  thresholds: {
    http_req_failed: ['rate<0.01'],
    http_req_duration: ['p(95)<500'],
  },
};

const baseUrl = __ENV.BASE_URL || 'http://127.0.0.1:3001';
const routes = ['/cities', '/activities', '/knowledge', '/insights'];

export default function communityReadScenario() {
  const route = routes[Math.floor(Math.random() * routes.length)];
  const response = http.get(`${baseUrl}${route}`, { tags: { route } });
  check(response, { 'status is 200': (result) => result.status === 200 });
  sleep(.1);
}
