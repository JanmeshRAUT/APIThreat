import express, { Request, Response } from 'express';
import { calculateDashboardStats } from './statsService.js';
import {
  authenticateAdminWithRateLimit,
  checkIpLoginBlocked,
  createSession,
  getClientIp,
  getSession,
  loginRequestRateLimit,
  recordLoginFailure,
  registerRequestRateLimit,
  requireAdmin,
  requireDashboardAuth,
  resetLoginFailures,
  revokeSessionsForUser,
  revokeSessionToken,
} from './authService.js';
import { config, getRegistrationMode, isWeakAdminPassword } from './config.js';
import {
  dummyVerifyPassword,
  hashPassword,
  userService,
  validateRegistration,
  verifyPassword,
} from './userService.js';

export const statsRouter = express.Router();
export const authRouter = express.Router();

statsRouter.use(requireDashboardAuth);

// GET /api/stats - Telemetry metrics endpoint
statsRouter.get('/', (req: Request, res: Response) => {
  const appId = req.query.app_id as string | undefined;
  const stats = calculateDashboardStats(appId);
  res.json(stats);
});

// GET /api/auth/config - Registration configuration endpoint
authRouter.get('/config', (_req: Request, res: Response) => {
  res.json({
    registration: getRegistrationMode(),
  });
});

// POST /api/auth/register - Register a new member
authRouter.post('/register', registerRequestRateLimit, async (req: Request, res: Response) => {
  const mode = getRegistrationMode();
  if (mode === 'closed') {
    res.status(403).json({
      success: false,
      error: 'Registration is currently closed.',
    });
    return;
  }

  const validation = validateRegistration(req.body || {});
  if (!validation.valid || !validation.normalized) {
    res.status(400).json({
      success: false,
      error: validation.error,
      fields: validation.fields,
    });
    return;
  }

  const existing = await userService.findUserByEmail(validation.normalized.email);
  if (existing) {
    res.status(409).json({
      success: false,
      error: 'An account with this email already exists.',
    });
    return;
  }

  const passwordHash = await hashPassword(validation.normalized.password);
  const result = await userService.registerUser(
    {
      full_name: validation.normalized.full_name,
      email: validation.normalized.email,
      password_hash: passwordHash,
    },
    mode
  );

  const message =
    result.status === 'active'
      ? 'Registration successful. You can now log in.'
      : 'Registration submitted. Your account is pending administrator approval.';

  res.status(201).json({
    success: true,
    status: result.status,
    message,
  });
});

// POST /api/auth/login - Login admin or registered member
authRouter.post('/login', loginRequestRateLimit, async (req: Request, res: Response) => {
  const { username, password } = req.body || {};
  const clientIp = getClientIp(req);
  const now = Date.now();

  const trimmedUsername = typeof username === 'string' ? username.trim() : '';
  const isAdminTarget =
    trimmedUsername === config.adminUser ||
    (trimmedUsername && trimmedUsername.toLowerCase() === config.adminUser.toLowerCase());

  // 1. Try admin credentials first via existing logic
  if (isAdminTarget) {
    const result = authenticateAdminWithRateLimit(trimmedUsername, password, clientIp, now);

    if (result.blocked) {
      res.status(429).json({
        success: false,
        blocked: true,
        retry_after_seconds: result.retryAfterSeconds,
        error: `Too many failed login attempts. This IP is blocked for 15 minutes (${Math.ceil((result.retryAfterSeconds || 900) / 60)}m remaining).`,
      });
      return;
    }

    if (!result.success || !result.token) {
      res.status(401).json({
        success: false,
        remaining_attempts: result.remainingAttempts,
        error: `Invalid username or password (${result.remainingAttempts} attempts remaining before 15m IP block).`,
      });
      return;
    }

    res.json({
      success: true,
      token: result.token,
      weak_admin_password: result.weakAdminPassword ?? isWeakAdminPassword(),
      user: {
        username: config.adminUser,
        full_name: 'Administrator',
        role: 'admin',
      },
    });
    return;
  }

  // 2. Member login path: check shared IP block first
  const ipBlock = checkIpLoginBlocked(clientIp, now);
  if (ipBlock.blocked) {
    res.status(429).json({
      success: false,
      blocked: true,
      retry_after_seconds: ipBlock.retryAfterSeconds,
      error: `Too many failed login attempts. This IP is blocked for 15 minutes (${Math.ceil((ipBlock.retryAfterSeconds || 900) / 60)}m remaining).`,
    });
    return;
  }

  if (!trimmedUsername || !password || typeof password !== 'string') {
    const fail = recordLoginFailure(clientIp, now);
    if (fail.blocked) {
      res.status(429).json({
        success: false,
        blocked: true,
        retry_after_seconds: fail.retryAfterSeconds,
        error: `Too many failed login attempts. This IP is blocked for 15 minutes (${Math.ceil((fail.retryAfterSeconds || 900) / 60)}m remaining).`,
      });
      return;
    }
    res.status(401).json({
      success: false,
      remaining_attempts: fail.remainingAttempts,
      error: `Invalid username or password (${fail.remainingAttempts} attempts remaining before 15m IP block).`,
    });
    return;
  }

  // Look up user by email
  const user = await userService.findUserByEmail(trimmedUsername);

  if (!user) {
    // When a login lookup finds no user, still run a dummy scrypt verify so response time does not reveal whether the email exists.
    await dummyVerifyPassword(password);

    const fail = recordLoginFailure(clientIp, now);
    if (fail.blocked) {
      res.status(429).json({
        success: false,
        blocked: true,
        retry_after_seconds: fail.retryAfterSeconds,
        error: `Too many failed login attempts. This IP is blocked for 15 minutes (${Math.ceil((fail.retryAfterSeconds || 900) / 60)}m remaining).`,
      });
      return;
    }
    res.status(401).json({
      success: false,
      remaining_attempts: fail.remainingAttempts,
      error: `Invalid username or password (${fail.remainingAttempts} attempts remaining before 15m IP block).`,
    });
    return;
  }

  // Check the password BEFORE the status, so a wrong password never reveals that an account exists.
  const isValidPassword = await verifyPassword(password, user.password_hash);
  if (!isValidPassword) {
    const fail = recordLoginFailure(clientIp, now);
    if (fail.blocked) {
      res.status(429).json({
        success: false,
        blocked: true,
        retry_after_seconds: fail.retryAfterSeconds,
        error: `Too many failed login attempts. This IP is blocked for 15 minutes (${Math.ceil((fail.retryAfterSeconds || 900) / 60)}m remaining).`,
      });
      return;
    }
    res.status(401).json({
      success: false,
      remaining_attempts: fail.remainingAttempts,
      error: `Invalid username or password (${fail.remainingAttempts} attempts remaining before 15m IP block).`,
    });
    return;
  }

  // Password is correct. Now check status:
  if (user.status === 'pending') {
    res.status(403).json({
      success: false,
      code: 'pending',
      error: 'Your account is pending administrator approval.',
    });
    return;
  }

  if (user.status === 'disabled') {
    res.status(403).json({
      success: false,
      code: 'disabled',
      error: 'Your account has been disabled. Please contact an administrator.',
    });
    return;
  }

  // Active user: reset login failures for IP, update last login, and issue session
  resetLoginFailures(clientIp);
  await userService.updateLastLogin(user.id);

  const token = createSession({
    username: user.email,
    role: user.role,
    userId: user.id,
    displayName: user.full_name,
    email: user.email,
  });

  res.json({
    success: true,
    token,
    weak_admin_password: false,
    user: {
      username: user.email,
      full_name: user.full_name,
      role: user.role,
    },
  });
});

// GET /api/auth/check - Verify session and return user profile
authRouter.get('/check', (req: Request, res: Response) => {
  const authHeader = req.headers['authorization'];
  const session = getSession(authHeader);

  if (!session) {
    res.json({
      authenticated: false,
      weak_admin_password: false,
      user: null,
    });
    return;
  }

  const isAdmin = (session.role || 'admin') === 'admin';
  res.json({
    authenticated: true,
    weak_admin_password: isAdmin ? isWeakAdminPassword() : false,
    user: {
      username: session.username,
      full_name: session.displayName || (isAdmin ? 'Administrator' : session.username),
      role: session.role || 'admin',
    },
  });
});

// POST /api/auth/logout - Invalidate session
authRouter.post('/logout', (req: Request, res: Response) => {
  const authHeader = req.headers['authorization'];
  revokeSessionToken(authHeader);
  res.json({ success: true, message: 'Logged out successfully' });
});

// GET /api/auth/users - List registered users (Admin only)
authRouter.get('/users', requireAdmin, async (_req: Request, res: Response) => {
  const users = await userService.listUsers();
  res.json({ users });
});

// PATCH /api/auth/users/:id - Update user status (Admin only)
authRouter.patch('/users/:id', requireAdmin, async (req: Request, res: Response) => {
  const id = req.params.id;
  const { status } = req.body || {};

  if (status !== 'active' && status !== 'disabled') {
    res.status(400).json({
      success: false,
      error: 'Invalid status. Status must be "active" or "disabled".',
    });
    return;
  }

  if (
    id === config.adminUser ||
    id.toLowerCase() === 'admin' ||
    id.toLowerCase() === config.adminUser.toLowerCase()
  ) {
    res.status(400).json({
      success: false,
      error: 'Cannot modify environment administrator.',
    });
    return;
  }

  const existing = await userService.findUserById(id);
  if (!existing) {
    res.status(404).json({
      success: false,
      error: 'User not found.',
    });
    return;
  }

  const updatedUser = await userService.setUserStatus(id, status);
  if (status === 'disabled') {
    revokeSessionsForUser(id);
  }

  res.json({
    success: true,
    user: updatedUser,
  });
});
