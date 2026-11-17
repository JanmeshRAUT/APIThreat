import test from 'node:test';
import assert from 'node:assert/strict';
import { getClientIp, authenticateAdminWithRateLimit, clearLoginRateLimitsForTesting } from '../server/authService.js';
import { config } from '../server/config.js';

test('Login rate limiting ignores spoofed X-Forwarded-For values', () => {
  clearLoginRateLimitsForTesting();
  const socketIp = '198.51.100.40';
  const request = {
    ip: socketIp,
    socket: { remoteAddress: socketIp },
    headers: { 'x-forwarded-for': '203.0.113.1' },
  } as any;

  assert.equal(getClientIp(request), socketIp);
  for (let i = 0; i < 4; i++) {
    authenticateAdminWithRateLimit('admin', 'wrong-password', getClientIp(request), Date.now() + i);
  }

  const spoofedRequest = {
    ...request,
    headers: { 'x-forwarded-for': '203.0.113.2' },
  };
  assert.equal(getClientIp(spoofedRequest), socketIp);
  const result = authenticateAdminWithRateLimit(
    config.adminUser,
    'wrong-password',
    getClientIp(spoofedRequest),
    Date.now() + 5
  );
  assert.equal(result.blocked, true);
});
