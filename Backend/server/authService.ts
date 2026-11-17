import crypto from 'crypto';
import { Request, Response, NextFunction } from 'express';
import { config, isWeakAdminPassword } from './config.js';
import { normalizeClientIp } from './normalizer.js';
import type { UserRole } from './types.js';

export interface Session {
  username: string;
  createdAt: number;
  role?: UserRole;
  userId?: string;
  displayName?: string;
  email?: string;
}

interface LoginAttemptState {
  failures: number;
  blockedUntil: number | null;
  lastAttemptAt: number;
}

const MAX_FAILED_LOGINS = 5;
const BLOCK_DURATION_MS = 15 * 60 * 1000;

const activeSessions = new Map<string, Session>();
const loginRateLimits = new Map<string, LoginAttemptState>();
const loginRequestRateLimits = new Map<string, { count: number; windowStartedAt: number }>();
const registerRequestRateLimits = new Map<string, { count: number; windowStartedAt: number }>();

const LOGIN_REQUEST_WINDOW_MS = 60 * 1000;
const MAX_LOGIN_REQUESTS_PER_WINDOW = 30;

const REGISTER_REQUEST_WINDOW_MS = 60 * 60 * 1000;
const MAX_REGISTER_REQUESTS_PER_WINDOW = 5;

export function getClientIp(req: Request): string {
  return normalizeClientIp(req.ip || req.socket?.remoteAddress);
}

export function loginRequestRateLimit(req: Request, res: Response, next: NextFunction): void {
  const ip = getClientIp(req);
  const now = Date.now();
  const current = loginRequestRateLimits.get(ip);
  const state =
    !current || now - current.windowStartedAt >= LOGIN_REQUEST_WINDOW_MS
      ? { count: 0, windowStartedAt: now }
      : current;

  state.count += 1;
  loginRequestRateLimits.set(ip, state);
  if (state.count > MAX_LOGIN_REQUESTS_PER_WINDOW) {
    res.status(429).json({
      success: false,
      blocked: true,
      error: 'Too many login requests. Please try again later.',
    });
    return;
  }
  next();
}

export function registerRequestRateLimit(req: Request, res: Response, next: NextFunction): void {
  const ip = getClientIp(req);
  const now = Date.now();
  const current = registerRequestRateLimits.get(ip);
  const state =
    !current || now - current.windowStartedAt >= REGISTER_REQUEST_WINDOW_MS
      ? { count: 0, windowStartedAt: now }
      : current;

  state.count += 1;
  registerRequestRateLimits.set(ip, state);
  if (state.count > MAX_REGISTER_REQUESTS_PER_WINDOW) {
    res.status(429).json({
      success: false,
      blocked: true,
      error: 'Too many registration requests. Please try again later.',
    });
    return;
  }
  next();
}

export function createSession(payload: {
  username: string;
  role?: UserRole;
  userId?: string;
  displayName?: string;
  email?: string;
}): string {
  const token = `sess_${crypto.randomBytes(24).toString('hex')}`;
  activeSessions.set(token, {
    username: payload.username,
    createdAt: Date.now(),
    role: payload.role ?? 'admin',
    userId: payload.userId,
    displayName: payload.displayName,
    email: payload.email,
  });
  return token;
}

export function getSession(token: string | undefined): Session | null {
  if (!token) return null;
  const cleanToken = token.replace(/^Bearer\s+/i, '').trim();
  const session = activeSessions.get(cleanToken);
  if (!session) return null;

  // Session valid for 24 hours
  const isExpired = Date.now() - session.createdAt > 24 * 60 * 60 * 1000;
  if (isExpired) {
    activeSessions.delete(cleanToken);
    return null;
  }

  return session;
}

export function verifySessionToken(token: string | undefined): boolean {
  return getSession(token) !== null;
}

export function revokeSessionToken(token: string | undefined): void {
  if (!token) return;
  const cleanToken = token.replace(/^Bearer\s+/i, '').trim();
  activeSessions.delete(cleanToken);
}

export function revokeSessionsForUser(userId: string): void {
  if (!userId) return;
  for (const [token, session] of activeSessions.entries()) {
    if (session.userId === userId) {
      activeSessions.delete(token);
    }
  }
}

export function checkIpLoginBlocked(
  clientIp: string,
  now: number = Date.now()
): { blocked: boolean; retryAfterSeconds?: number } {
  const ipKey = (clientIp || '127.0.0.1').trim();
  const state = loginRateLimits.get(ipKey);
  if (state?.blockedUntil) {
    if (now < state.blockedUntil) {
      return {
        blocked: true,
        retryAfterSeconds: Math.ceil((state.blockedUntil - now) / 1000),
      };
    } else {
      loginRateLimits.set(ipKey, { failures: 0, blockedUntil: null, lastAttemptAt: now });
    }
  }
  return { blocked: false };
}

export function recordLoginFailure(
  clientIp: string,
  now: number = Date.now()
): { blocked: boolean; retryAfterSeconds?: number; remainingAttempts: number } {
  const ipKey = (clientIp || '127.0.0.1').trim();
  let state = loginRateLimits.get(ipKey);

  if (!state) {
    state = { failures: 1, blockedUntil: null, lastAttemptAt: now };
  } else {
    state.failures += 1;
    state.lastAttemptAt = now;
  }

  if (state.failures >= MAX_FAILED_LOGINS) {
    state.blockedUntil = now + BLOCK_DURATION_MS;
    loginRateLimits.set(ipKey, state);
    return {
      blocked: true,
      retryAfterSeconds: Math.ceil(BLOCK_DURATION_MS / 1000),
      remainingAttempts: 0,
    };
  }

  loginRateLimits.set(ipKey, state);
  return {
    blocked: false,
    remainingAttempts: MAX_FAILED_LOGINS - state.failures,
  };
}

export function resetLoginFailures(clientIp: string): void {
  const ipKey = (clientIp || '127.0.0.1').trim();
  loginRateLimits.delete(ipKey);
}

export interface LoginAuthResult {
  success: boolean;
  token?: string;
  blocked?: boolean;
  retryAfterSeconds?: number;
  remainingAttempts?: number;
  weakAdminPassword?: boolean;
}

export function authenticateAdmin(username: string, pass: string): string | null {
  if (!username || !pass) return null;

  if (username === config.adminUser && pass === config.adminPass) {
    return createSession({
      username,
      role: 'admin',
      displayName: 'Administrator',
    });
  }

  return null;
}

export function authenticateAdminWithRateLimit(
  username: string,
  pass: string,
  clientIp: string,
  now: number = Date.now()
): LoginAuthResult {
  const ipKey = (clientIp || '127.0.0.1').trim();
  let state = loginRateLimits.get(ipKey);

  if (state?.blockedUntil) {
    if (now < state.blockedUntil) {
      return {
        success: false,
        blocked: true,
        retryAfterSeconds: Math.ceil((state.blockedUntil - now) / 1000),
        remainingAttempts: 0,
      };
    } else {
      state = { failures: 0, blockedUntil: null, lastAttemptAt: now };
      loginRateLimits.set(ipKey, state);
    }
  }

  const token = authenticateAdmin(username, pass);
  if (token) {
    loginRateLimits.delete(ipKey);
    return {
      success: true,
      token,
      weakAdminPassword: isWeakAdminPassword(),
    };
  }

  if (!state) {
    state = { failures: 1, blockedUntil: null, lastAttemptAt: now };
  } else {
    state.failures += 1;
    state.lastAttemptAt = now;
  }

  if (state.failures >= MAX_FAILED_LOGINS) {
    state.blockedUntil = now + BLOCK_DURATION_MS;
    loginRateLimits.set(ipKey, state);
    return {
      success: false,
      blocked: true,
      retryAfterSeconds: Math.ceil(BLOCK_DURATION_MS / 1000),
      remainingAttempts: 0,
    };
  }

  loginRateLimits.set(ipKey, state);
  return {
    success: false,
    blocked: false,
    remainingAttempts: MAX_FAILED_LOGINS - state.failures,
  };
}

export function clearLoginRateLimitsForTesting(): void {
  loginRateLimits.clear();
  loginRequestRateLimits.clear();
  registerRequestRateLimits.clear();
}

export function clearSessionsForTesting(): void {
  activeSessions.clear();
}

/**
 * Protection middleware for API endpoints
 */
export function requireDashboardAuth(req: Request, res: Response, next: NextFunction): void {
  const authHeader = req.headers['authorization'];
  const session = getSession(authHeader);
  if (!session) {
    res.status(401).json({ error: 'Unauthorized: Admin authentication required.' });
    return;
  }
  res.locals.session = session;
  const role = session.role || 'admin';
  const method = req.method.toUpperCase();
  if (role !== 'admin' && !['GET', 'HEAD', 'OPTIONS'].includes(method)) {
    res.status(403).json({ error: 'Forbidden: admin role required.' });
    return;
  }
  next();
}

/**
 * Middleware requiring admin role
 */
export function requireAdmin(req: Request, res: Response, next: NextFunction): void {
  const authHeader = req.headers['authorization'];
  const session = res.locals.session || getSession(authHeader);
  if (!session) {
    res.status(401).json({ error: 'Unauthorized: Admin authentication required.' });
    return;
  }
  res.locals.session = session;
  const role = session.role || 'admin';
  if (role !== 'admin') {
    res.status(403).json({ error: 'Forbidden: admin role required.' });
    return;
  }
  next();
}
