import crypto from 'crypto';
import type { RegistrationMode, SafeUser, UserRecord, UserStatus } from './types.js';
import { UserModel } from './models.js';
import { isDatabaseConnected } from './db.js';
import { config, getRegistrationMode } from './config.js';

const SCRYPT_N = 16384;
const SCRYPT_R = 8;
const SCRYPT_P = 1;
const SCRYPT_KEYLEN = 64;

// Pre-computed dummy hash with valid scrypt format used for timing-attack mitigation
const DUMMY_HASH =
  'scrypt$16384$8$1$0123456789abcdef0123456789abcdef$0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function toSafeUser(user: UserRecord): SafeUser {
  return {
    id: user.id,
    full_name: user.full_name,
    email: user.email,
    role: user.role,
    status: user.status,
    created_at: user.created_at,
    last_login_at: user.last_login_at,
  };
}

export async function hashPassword(password: string): Promise<string> {
  const salt = crypto.randomBytes(16);
  return new Promise((resolve, reject) => {
    crypto.scrypt(
      password,
      salt,
      SCRYPT_KEYLEN,
      { cost: SCRYPT_N, blockSize: SCRYPT_R, parallelization: SCRYPT_P, maxmem: 64 * 1024 * 1024 },
      (err, derivedKey) => {
        if (err) return reject(err);
        resolve(`scrypt$${SCRYPT_N}$${SCRYPT_R}$${SCRYPT_P}$${salt.toString('hex')}$${derivedKey.toString('hex')}`);
      }
    );
  });
}

export async function verifyPassword(password: string, storedHash: string): Promise<boolean> {
  if (!password || !storedHash || typeof storedHash !== 'string') {
    return false;
  }
  const parts = storedHash.split('$');
  if (parts.length !== 6 || parts[0] !== 'scrypt') {
    return false;
  }
  const cost = parseInt(parts[1], 10);
  const blockSize = parseInt(parts[2], 10);
  const parallelization = parseInt(parts[3], 10);
  const saltHex = parts[4];
  const hashHex = parts[5];

  if (!cost || !blockSize || !parallelization || !saltHex || !hashHex) {
    return false;
  }

  try {
    const salt = Buffer.from(saltHex, 'hex');
    const expectedKey = Buffer.from(hashHex, 'hex');

    return await new Promise<boolean>((resolve) => {
      crypto.scrypt(
        password,
        salt,
        expectedKey.length,
        { cost, blockSize, parallelization, maxmem: 64 * 1024 * 1024 },
        (err, derivedKey) => {
          if (err || !derivedKey || derivedKey.length !== expectedKey.length) {
            return resolve(false);
          }
          try {
            resolve(crypto.timingSafeEqual(derivedKey, expectedKey));
          } catch {
            resolve(false);
          }
        }
      );
    });
  } catch {
    return false;
  }
}

export async function dummyVerifyPassword(password: string): Promise<void> {
  await verifyPassword(password, DUMMY_HASH);
}

export interface RegistrationValidationResult {
  valid: boolean;
  error?: string;
  fields?: {
    full_name?: string;
    email?: string;
    password?: string;
  };
  normalized?: {
    full_name: string;
    email: string;
    password: string;
  };
}

export function validateRegistration(data: {
  full_name?: unknown;
  email?: unknown;
  password?: unknown;
}): RegistrationValidationResult {
  const fields: { full_name?: string; email?: string; password?: string } = {};

  const rawFullName = typeof data?.full_name === 'string' ? data.full_name : '';
  const trimmedName = rawFullName.trim();
  if (!trimmedName || trimmedName.length < 2 || trimmedName.length > 80) {
    fields.full_name = 'Full name must be between 2 and 80 characters.';
  }

  const rawEmail = typeof data?.email === 'string' ? data.email : '';
  const trimmedEmail = rawEmail.trim().toLowerCase();
  if (!trimmedEmail || trimmedEmail.length > 254 || !EMAIL_REGEX.test(trimmedEmail)) {
    fields.email = 'Please provide a valid email address (maximum 254 characters).';
  } else if (trimmedEmail === (config.adminUser || '').trim().toLowerCase()) {
    fields.email = 'This email cannot be used for registration.';
  }

  const rawPassword = typeof data?.password === 'string' ? data.password : '';
  if (
    !rawPassword ||
    rawPassword.length < 8 ||
    rawPassword.length > 128 ||
    !/\d/.test(rawPassword) ||
    !/[^a-zA-Z0-9]/.test(rawPassword)
  ) {
    fields.password = 'Password must be 8-128 characters long and contain at least one number and one special character.';
  }

  if (Object.keys(fields).length > 0) {
    return {
      valid: false,
      error: Object.values(fields)[0],
      fields,
    };
  }

  return {
    valid: true,
    normalized: {
      full_name: trimmedName,
      email: trimmedEmail,
      password: rawPassword,
    },
  };
}

class UserService {
  private users = new Map<string, UserRecord>();

  public hydrate(users: UserRecord[]): void {
    this.users = new Map(users.map((u) => [u.id, u]));
  }

  public clearForTesting(): void {
    this.users.clear();
  }

  public async registerUser(
    data: { full_name: string; email: string; password_hash: string },
    mode?: RegistrationMode
  ): Promise<{ user: SafeUser; status: UserStatus }> {
    const currentMode = mode || getRegistrationMode();
    const status: UserStatus = currentMode === 'open' ? 'active' : 'pending';
    const id = `usr_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
    const user: UserRecord = {
      id,
      full_name: data.full_name.trim(),
      email: data.email.trim().toLowerCase(),
      password_hash: data.password_hash,
      role: 'member',
      status,
      created_at: new Date().toISOString(),
      last_login_at: null,
    };

    this.users.set(user.id, user);
    if (isDatabaseConnected()) {
      await UserModel.create(user).catch((err: unknown) => {
        console.error('[UserService] MongoDB create failed:', err);
      });
    }
    return { user: toSafeUser(user), status };
  }

  public async findUserByEmail(email: string): Promise<UserRecord | null> {
    if (!email || typeof email !== 'string') return null;
    const normalized = email.trim().toLowerCase();
    if (isDatabaseConnected()) {
      const doc = await UserModel.findOne({ email: normalized }).lean();
      if (doc) {
        const { _id, ...clean } = doc as any;
        this.users.set(clean.id, clean as UserRecord);
        return clean as UserRecord;
      }
      return null;
    }
    for (const u of this.users.values()) {
      if (u.email.toLowerCase() === normalized) {
        return u;
      }
    }
    return null;
  }

  public async findUserById(id: string): Promise<UserRecord | null> {
    if (!id || typeof id !== 'string') return null;
    if (isDatabaseConnected()) {
      const doc = await UserModel.findOne({ id }).lean();
      if (doc) {
        const { _id, ...clean } = doc as any;
        this.users.set(clean.id, clean as UserRecord);
        return clean as UserRecord;
      }
      return null;
    }
    return this.users.get(id) || null;
  }

  public async listUsers(): Promise<SafeUser[]> {
    if (isDatabaseConnected()) {
      const docs = await UserModel.find().sort({ created_at: -1 }).lean();
      return docs.map((d: any) => {
        const { _id, password_hash, ...safe } = d;
        return safe as SafeUser;
      });
    }
    return Array.from(this.users.values())
      .map(toSafeUser)
      .sort((a, b) => b.created_at.localeCompare(a.created_at));
  }

  public async setUserStatus(id: string, status: UserStatus): Promise<SafeUser | null> {
    let user: UserRecord | null = null;
    if (isDatabaseConnected()) {
      const doc = await UserModel.findOneAndUpdate(
        { id },
        { $set: { status } },
        { new: true }
      ).lean();
      if (!doc) return null;
      const { _id, ...clean } = doc as any;
      user = clean as UserRecord;
      this.users.set(user.id, user);
    } else {
      const existing = this.users.get(id);
      if (!existing) return null;
      existing.status = status;
      user = existing;
    }
    return toSafeUser(user);
  }

  public async updateLastLogin(id: string, timestamp: string = new Date().toISOString()): Promise<void> {
    if (isDatabaseConnected()) {
      await UserModel.updateOne({ id }, { $set: { last_login_at: timestamp } }).catch((err: unknown) => {
        console.error('[UserService] MongoDB updateLastLogin failed:', err);
      });
    }
    const existing = this.users.get(id);
    if (existing) {
      existing.last_login_at = timestamp;
    }
  }
}

export const userService = new UserService();

export const registerUser = (data: { full_name: string; email: string; password_hash: string }, mode?: RegistrationMode) =>
  userService.registerUser(data, mode);
export const findUserByEmail = (email: string) => userService.findUserByEmail(email);
export const findUserById = (id: string) => userService.findUserById(id);
export const listUsers = () => userService.listUsers();
export const setUserStatus = (id: string, status: UserStatus) => userService.setUserStatus(id, status);
