import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

dotenv.config();

const port = parseInt(process.env.PORT || '3000', 10);
const dataDir = path.resolve(process.cwd(), process.env.DATA_DIR || './data');
const trafficLogPath = path.join(dataDir, 'traffic.jsonl');
const featuresLogPath = path.join(dataDir, 'features.jsonl');
const rulesFilePath = path.join(dataDir, 'rules.json');
const settingsFilePath = path.join(dataDir, 'settings.json');
const threatsFilePath = path.join(dataDir, 'threats.json');
const appsFilePath = path.join(dataDir, 'apps.json');
const alertsHistoryFilePath = path.join(dataDir, 'alerts_history.json');
const maxInMemoryRecords = parseInt(process.env.MAX_IN_MEMORY_RECORDS || '5000', 10);
const trustProxyHops = Math.max(0, parseInt(process.env.TRUST_PROXY_HOPS || '1', 10) || 0);
const adminUser = process.env.ADMIN_USER || 'admin';
const adminPass = process.env.ADMIN_PASS || 'admin123';
const alertWebhookUrl = process.env.ALERT_WEBHOOK_URL || '';
const hashIps = process.env.HASH_IPS === 'true';
const ipHashSalt = process.env.IP_HASH_SALT || crypto.randomBytes(16).toString('hex');
const appUrl = process.env.APP_URL && process.env.APP_URL !== 'MY_APP_URL'
  ? process.env.APP_URL.replace(/\/$/, '')
  : `http://localhost:${port}`;

fs.mkdirSync(dataDir, { recursive: true });
for (const [target, seed] of [
  [rulesFilePath, 'rules.default.json'],
  [settingsFilePath, 'settings.default.json'],
] as const) {
  if (!fs.existsSync(target)) {
    fs.copyFileSync(path.resolve(process.cwd(), seed), target);
  }
}

export function isWeakAdminPassword(pass: string = adminPass): boolean {
  const normalized = pass.trim().toLowerCase();
  const blockedPasswords = new Set(['admin123', 'admin', 'password', 'change-me', 'changeme', 'test', '123456']);
  return !normalized || normalized.length < 12 || blockedPasswords.has(normalized);
}

export function assertSecureProductionConfig(): void {
  if (!isWeakAdminPassword()) return;

  const message = 'ADMIN_PASS must be a unique password with at least 12 characters and not use a blocked default.';
  if (process.env.NODE_ENV === 'production') {
    throw new Error(message);
  }
  console.warn(`[Gatekeeper] Warning: ${message}`);
}

export function hashClientIp(
  ip: string,
  shouldHash: boolean = hashIps,
  salt: string = ipHashSalt
): string {
  const cleanIp = (ip || 'unknown').trim();
  if (!shouldHash) return cleanIp;
  return 'ip_' + crypto.createHmac('sha256', salt).update(cleanIp).digest('hex').slice(0, 16);
}

export const config = {
  port,
  trustProxyHops,
  dataDir,
  trafficLogPath,
  featuresLogPath,
  rulesFilePath,
  settingsFilePath,
  threatsFilePath,
  appsFilePath,
  alertsHistoryFilePath,
  maxInMemoryRecords,
  adminUser,
  adminPass,
  alertWebhookUrl,
  hashIps,
  ipHashSalt,
  appUrl,
};
