import crypto from 'crypto';
import { KeyRotation, RegisteredApp } from './types.js';
import { AppModel } from './models.js';
import { isDatabaseConnected } from './db.js';

class AppsService {
  private apps = new Map<string, RegisteredApp>();
  private rateLimits = new Map<string, { count: number; resetAt: number }>();
  private maxRequestsPerMinute = 1200;

  public hydrate(apps: RegisteredApp[]): void {
    this.apps = new Map(apps.map((app) => [app.id, { ...app, key_history: app.key_history || [] }]));
  }
  private hashKey(key: string): string { return crypto.createHash('sha256').update(key.trim()).digest('hex'); }
  private persist(app: RegisteredApp): void {
    if (isDatabaseConnected()) void AppModel.replaceOne({ id: app.id }, app, { upsert: true }).catch((err: unknown) => console.error('[AppsService] MongoDB write failed:', err));
  }
  private remove(id: string): void {
    if (isDatabaseConnected()) void AppModel.deleteOne({ id }).catch((err: unknown) => console.error('[AppsService] MongoDB delete failed:', err));
  }
  public generateApiKey(environment: 'dev' | 'prod' = 'dev'): string {
    return `${environment === 'prod' ? 'sk_live_' : 'sk_test_'}${crypto.randomBytes(24).toString('hex')}`;
  }
  public registerApp(name: string, environment: 'dev' | 'prod'): { app: RegisteredApp; plainKey: string } {
    const plainKey = this.generateApiKey(environment);
    const app: RegisteredApp = {
      id: `app_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`, name: name.trim(), environment,
      key_prefix: `${plainKey.slice(0, 14)}...${plainKey.slice(-6)}`, key_hash: this.hashKey(plainKey),
      status: 'active', created_at: new Date().toISOString(), last_seen_at: null, total_requests: 0, key_history: [],
    };
    this.apps.set(app.id, app); this.persist(app);
    return { app, plainKey };
  }
  public regenerateKey(appId: string): { app: RegisteredApp; plainKey: string } | null {
    const app = this.apps.get(appId); if (!app) return null;
    const plainKey = this.generateApiKey(app.environment);
    const newPrefix = `${plainKey.slice(0, 14)}...${plainKey.slice(-6)}`;
    app.key_history = [{ old_key_prefix: app.key_prefix, new_key_prefix: newPrefix, rotated_at: new Date().toISOString() }, ...(app.key_history || [])];
    app.key_prefix = newPrefix; app.key_hash = this.hashKey(plainKey); this.persist(app);
    return { app, plainKey };
  }
  public toggleStatus(appId: string): RegisteredApp | null {
    const app = this.apps.get(appId); if (!app) return null;
    app.status = app.status === 'active' ? 'disabled' : 'active'; this.persist(app); return app;
  }
  public deleteApp(appId: string): boolean {
    const deleted = this.apps.delete(appId); if (deleted) this.remove(appId); return deleted;
  }
  public listApps(): RegisteredApp[] { return Array.from(this.apps.values()).map((app) => ({ ...app, key_hash: '[SECURED_HASH]' })); }
  public getAppById(appId: string): RegisteredApp | null {
    const app = this.apps.get(appId); return app ? { ...app, key_hash: '[SECURED_HASH]' } : null;
  }
  public authenticateKey(rawKey: string): { authorized: boolean; app?: RegisteredApp; rateLimited?: boolean } {
    if (!rawKey || typeof rawKey !== 'string') return { authorized: false };
    const hash = this.hashKey(rawKey.replace(/^Bearer\s+/i, '').trim());
    const app = Array.from(this.apps.values()).find((item) => item.key_hash === hash);
    if (!app || app.status !== 'active') return { authorized: false };
    const now = Date.now(); let rl = this.rateLimits.get(hash);
    if (!rl || now > rl.resetAt) { rl = { count: 1, resetAt: now + 60000 }; this.rateLimits.set(hash, rl); }
    else { rl.count++; if (rl.count > this.maxRequestsPerMinute) return { authorized: true, app, rateLimited: true }; }
    return { authorized: true, app, rateLimited: false };
  }
  public recordAppTraffic(appId: string, eventCount: number): void {
    const app = this.apps.get(appId); if (!app) return;
    app.total_requests += eventCount; app.last_seen_at = new Date().toISOString(); this.persist(app);
  }
  public getFirstActiveApp(): { app: RegisteredApp } | null {
    const first = Array.from(this.apps.values()).find((a) => a.status === 'active') || Array.from(this.apps.values())[0];
    return first ? { app: { ...first, key_hash: '[SECURED_HASH]' } } : null;
  }
}
export const appsService = new AppsService();
