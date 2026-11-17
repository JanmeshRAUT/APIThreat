import express, { Request, Response } from 'express';
import net from 'net';
import { requireDashboardAuth } from './authService.js';
import { threatEngine } from './threatEngine.js';
import { appsService } from './appsService.js';
import { alertService } from './alertService.js';
import { ThreatStatus } from './types.js';
import { recorder } from './recorder.js';
import { normalizePath, extractQueryParamNames } from './normalizer.js';
import { config } from './config.js';
import { attachReasoning } from './threatReasoning.js';
import { PlatformSettings, ThreatRule, ThreatSeverity } from './types.js';

export const threatsRouter = express.Router();
threatsRouter.use(requireDashboardAuth);

const VALID_SEVERITIES: ThreatSeverity[] = ['low', 'medium', 'high', 'critical'];
const RULE_PATCH_FIELDS = ['enabled', 'threshold', 'window_seconds', 'severity'] as const;
const SETTINGS_PATCH_FIELDS = [
  'mode',
  'notify_on_high_critical',
  'description',
  'alert_webhook_url',
  'alert_min_severity',
  'alert_dedup_minutes',
  'raw_traffic_retention_days',
  'feature_retention_days',
] as const;

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function unknownFields(body: Record<string, unknown>, fields: readonly string[]): string[] {
  return Object.keys(body).filter((key) => !fields.includes(key));
}

function isPrivateIp(hostname: string): boolean {
  const normalized = hostname.toLowerCase().replace(/^\[|\]$/g, '');
  if (normalized === 'localhost' || normalized.endsWith('.localhost')) return true;
  if (normalized.startsWith('::ffff:')) return isPrivateIp(normalized.slice(7));

  if (net.isIP(normalized) === 4) {
    const parts = normalized.split('.').map(Number);
    return parts[0] === 0 || parts[0] === 10 || parts[0] === 127 ||
      (parts[0] === 169 && parts[1] === 254) ||
      (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) ||
      (parts[0] === 192 && parts[1] === 168) ||
      (parts[0] === 100 && parts[1] >= 64 && parts[1] <= 127);
  }

  if (net.isIP(normalized) === 6) {
    return normalized === '::1' || normalized.startsWith('fc') || normalized.startsWith('fd') || normalized.startsWith('fe80:');
  }
  return false;
}

export function validateWebhookUrl(value: unknown): string | null {
  if (typeof value !== 'string' || !value.trim()) return null;
  let parsed: URL;
  try {
    parsed = new URL(value.trim());
  } catch {
    return 'Webhook URL must be a valid URL.';
  }
  const isProduction = process.env.NODE_ENV === 'production';
  if (parsed.protocol !== 'https:' && !(parsed.protocol === 'http:' && !isProduction)) {
    return 'Webhook URL must use HTTPS in production.';
  }
  if (parsed.username || parsed.password || isPrivateIp(parsed.hostname)) {
    return 'Webhook URL must not target localhost or a private IP address.';
  }
  return null;
}

export function validateRulePatch(body: unknown): { updates?: Partial<ThreatRule>; error?: string } {
  if (!isRecord(body)) return { error: 'Rule updates must be a JSON object.' };
  const unknown = unknownFields(body, RULE_PATCH_FIELDS);
  if (unknown.length) return { error: `Unknown rule fields: ${unknown.join(', ')}.` };
  if (!Object.keys(body).length) return { error: 'At least one rule field is required.' };

  const updates: Partial<ThreatRule> = {};
  if ('enabled' in body && typeof body.enabled !== 'boolean') return { error: 'enabled must be a boolean.' };
  if ('threshold' in body && (!Number.isInteger(body.threshold) || Number(body.threshold) < 1)) {
    return { error: 'threshold must be an integer greater than or equal to 1.' };
  }
  if ('window_seconds' in body && (!Number.isInteger(body.window_seconds) || Number(body.window_seconds) < 10 || Number(body.window_seconds) > 86400)) {
    return { error: 'window_seconds must be an integer between 10 and 86400.' };
  }
  if ('severity' in body && !VALID_SEVERITIES.includes(body.severity as ThreatSeverity)) {
    return { error: `severity must be one of: ${VALID_SEVERITIES.join(', ')}.` };
  }
  for (const field of RULE_PATCH_FIELDS) {
    if (field in body) updates[field] = body[field] as never;
  }
  return { updates };
}

export function validateSettingsPatch(body: unknown): { updates?: Partial<PlatformSettings>; error?: string } {
  if (!isRecord(body)) return { error: 'Settings updates must be a JSON object.' };
  const unknown = unknownFields(body, SETTINGS_PATCH_FIELDS);
  if (unknown.length) return { error: `Unknown settings fields: ${unknown.join(', ')}.` };
  if (!Object.keys(body).length) return { error: 'At least one settings field is required.' };
  if ('mode' in body && body.mode !== 'shadow' && body.mode !== 'alert_only') return { error: 'mode must be shadow or alert_only.' };
  if ('notify_on_high_critical' in body && typeof body.notify_on_high_critical !== 'boolean') return { error: 'notify_on_high_critical must be a boolean.' };
  if ('description' in body && typeof body.description !== 'string') return { error: 'description must be a string.' };
  if ('alert_webhook_url' in body && body.alert_webhook_url !== '') {
    const webhookError = validateWebhookUrl(body.alert_webhook_url);
    if (webhookError) return { error: webhookError };
  }
  if ('alert_min_severity' in body && !VALID_SEVERITIES.includes(body.alert_min_severity as ThreatSeverity)) {
    return { error: `alert_min_severity must be one of: ${VALID_SEVERITIES.join(', ')}.` };
  }
  for (const field of ['alert_dedup_minutes', 'raw_traffic_retention_days', 'feature_retention_days'] as const) {
    const minimum = field === 'alert_dedup_minutes' ? 0 : 1;
    if (field in body && (!Number.isInteger(body[field]) || Number(body[field]) < minimum)) {
      return { error: `${field} must be an integer greater than or equal to ${minimum}.` };
    }
  }
  const updates: Partial<PlatformSettings> = {};
  for (const field of SETTINGS_PATCH_FIELDS) {
    if (field in body) updates[field] = body[field] as never;
  }
  return { updates };
}

/**
 * GET /api/threats/alerts/history
 * Retrieve recent webhook alert delivery logs
 */
threatsRouter.get('/alerts/history', (req: Request, res: Response) => {
  const limit = parseInt((req.query.limit as string) || '100', 10);
  const history = alertService.getAlertHistory(limit);
  res.json({ count: history.length, history });
});

/**
 * POST /api/threats/alerts/test
 * Send a safe synthetic test alert to the configured or provided webhook URL
 */
threatsRouter.post('/alerts/test', async (req: Request, res: Response) => {
  const overrideWebhookUrl = req.body?.webhook_url as string | undefined;
  if (overrideWebhookUrl) {
    const webhookError = validateWebhookUrl(overrideWebhookUrl);
    if (webhookError) {
      res.status(400).json({ error: webhookError });
      return;
    }
  }
  const settings = threatEngine.getSettings();
  const entry = await alertService.sendTestAlert(settings, overrideWebhookUrl);

  res.json({
    success: entry.status === 'sent',
    status: entry.status,
    entry,
    message:
      entry.status === 'sent'
        ? 'Test alert delivered successfully!'
        : `Test alert failed: ${entry.error || 'Unable to reach webhook URL'}`,
  });
});

/**
 * GET /api/threats/rules
 * List all rules from rules.json
 */
threatsRouter.get('/rules', (_req: Request, res: Response) => {
  const rules = threatEngine.getRules();
  res.json({ rules });
});

/**
 * PATCH /api/threats/rules/:id
 * Toggle rule enabled or edit threshold
 */
threatsRouter.patch('/rules/:id', (req: Request, res: Response) => {
  const id = req.params.id;
  const validation = validateRulePatch(req.body);
  if (validation.error) {
    res.status(400).json({ error: validation.error });
    return;
  }

  const updated = threatEngine.updateRule(id, validation.updates!);
  if (!updated) {
    res.status(404).json({ error: 'Threat rule not found.' });
    return;
  }

  res.json({
    success: true,
    message: `Rule ${updated.id} updated successfully.`,
    rule: updated,
  });
});

/**
 * GET /api/threats/settings
 * Read global shadow mode & alert settings
 */
threatsRouter.get('/settings', (_req: Request, res: Response) => {
  const settings = threatEngine.getSettings();
  res.json({
    settings,
    env_webhook_configured: Boolean(config.alertWebhookUrl),
  });
});

/**
 * PATCH /api/threats/settings
 * Update global shadow mode & alert settings
 */
threatsRouter.patch('/settings', (req: Request, res: Response) => {
  const validation = validateSettingsPatch(req.body);
  if (validation.error) {
    res.status(400).json({ error: validation.error });
    return;
  }
  const updated = threatEngine.updateSettings(validation.updates!);
  res.json({
    success: true,
    message: 'Platform security & alert settings updated.',
    settings: updated,
    env_webhook_configured: Boolean(config.alertWebhookUrl),
  });
});

/**
 * GET /api/threats
 * Retrieve threats with optional filtering
 */
threatsRouter.get('/', (req: Request, res: Response) => {
  const severity = req.query.severity as string | undefined;
  const rule_id = req.query.rule_id as string | undefined;
  const app_id = req.query.app_id as string | undefined;
  const status = req.query.status as string | undefined;

  const threats = threatEngine.getThreats({ severity, rule_id, app_id, status });
  const openSummary = threatEngine.getOpenThreatsSummary(app_id);

  res.json({
    count: threats.length,
    threats: attachReasoning(threats, threatEngine.getRules()),
    open_summary: openSummary,
  });
});

/**
 * PATCH /api/threats/:id/status
 * Update threat status (open, acknowledged, resolved, false_positive)
 */
threatsRouter.patch('/:id/status', (req: Request, res: Response) => {
  const id = req.params.id;
  const { status } = req.body || {};

  const validStatuses: ThreatStatus[] = ['open', 'acknowledged', 'resolved', 'false_positive'];
  if (!validStatuses.includes(status)) {
    res.status(400).json({ error: `Invalid status. Must be one of: ${validStatuses.join(', ')}` });
    return;
  }

  const updated = threatEngine.updateThreatStatus(id, status);
  if (!updated) {
    res.status(404).json({ error: 'Threat record not found.' });
    return;
  }

  res.json({
    success: true,
    message: `Threat marked as ${status}.`,
    threat: attachReasoning([updated], threatEngine.getRules())[0],
  });
});

/**
 * POST /api/threats/simulate-attack
 * Attack Simulator: Dispatches targeted payloads to trigger:
 * 1. Brute Force Login (RULE-01-BRUTE-FORCE)
 * 2. SQL Injection (RULE-06-SQL-INJECTION)
 * 3. Product Catalog Scraping (RULE-04-SCRAPING)
 * 4. Fake Signups (RULE-12-FAKE-SIGNUPS)
 * 5. Path Traversal & Command Injection (RULE-08-PATH-TRAVERSAL)
 */
threatsRouter.post('/simulate-attack', async (req: Request, res: Response) => {
  const requestedAppId = req.body?.app_id as string | undefined;
  const targetApp = requestedAppId
    ? appsService.getAppById(requestedAppId)
    : appsService.getFirstActiveApp()?.app || null;
  if (!targetApp) {
    res.status(400).json({ error: 'Register an application before using the attack simulator.' });
    return;
  }
  const targetAppId = targetApp.id;
  const targetAppName = targetApp.name;

  const firedRules: string[] = [];

  const recordEvent = (
    method: string,
    rawPathAndQuery: string,
    clientIp: string,
    statusCode: number,
    userAgent: string,
    loginResult: 'ok' | 'fail' | 'none' = 'none',
    userId?: string
  ) => {
    const detection = threatEngine.evaluateDetailed({
      app_id: targetAppId,
      app_name: targetAppName,
      client_ip: clientIp,
      method,
      raw_path_and_query: rawPathAndQuery,
      status_code: statusCode,
      response_time_ms: Math.floor(Math.random() * 20) + 5,
      user_agent: userAgent,
      login_result: loginResult,
      user_id: userId,
    });

    if (detection.ruleName && !firedRules.includes(detection.ruleName)) {
      firedRules.push(detection.ruleName);
    }

    const cleanPath = rawPathAndQuery.split('?')[0] || rawPathAndQuery;
    recorder.recordAsync({
      request_id: `atk_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      app_id: targetAppId,
      app_name: targetAppName,
      environment: 'prod',
      timestamp: new Date().toISOString(),
      client_ip: clientIp,
      method,
      path: cleanPath,
      normalized_path: normalizePath(cleanPath),
      query_param_names: extractQueryParamNames(rawPathAndQuery),
      status_code: statusCode,
      response_time_ms: Math.floor(Math.random() * 25) + 6,
      request_size: 140,
      response_size: 320,
      user_agent: userAgent,
      login_result: loginResult,
      is_synthetic: true,
      threat_rule: detection.ruleName || 'normal',
      threat_rule_id: detection.ruleId || undefined,
      label: detection.label,
      label_source: 'rule',
    });
  };

  // Brute force login attack simulation
  const bruteIp = '198.51.100.81';
  for (let i = 0; i < 6; i++) {
    recordEvent('POST', '/login', bruteIp, 401, 'Hydra/9.5 (https://github.com/vanhauser-thc/thc-hydra)', 'fail');
  }

  // SQL injection attack simulation
  recordEvent(
    'GET',
    "/products?search=shoes' UNION SELECT 1,username,password FROM users--",
    '198.51.100.42',
    200,
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'
  );

  // Catalog scraping attack simulation
  const scrapeIp = '198.51.100.99';
  for (let i = 1; i <= 14; i++) {
    recordEvent('GET', `/products/${i}`, scrapeIp, 200, 'Scrapy/2.8.0 (+https://scrapy.org)');
  }

  // Fake signups attack simulation
  const spamIp = '203.0.113.55';
  for (let i = 1; i <= 4; i++) {
    recordEvent('POST', '/register', spamIp, 201, 'Python-requests/2.28.1');
  }

  // Path traversal attack simulation
  recordEvent(
    'GET',
    '/orders/../../../../etc/passwd',
    '203.0.113.72',
    400,
    'Mozilla/5.0 (X11; Linux x86_64)'
  );

  res.json({
    success: true,
    message: `Attack simulation executed against ${targetAppName}.`,
    rules_fired_count: firedRules.length,
    fired_rules: firedRules,
    open_threats_summary: threatEngine.getOpenThreatsSummary(targetAppId),
  });
});
