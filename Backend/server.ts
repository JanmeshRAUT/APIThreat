import express from 'express';
import cors from 'cors';
import { monitorRouter } from './server/monitorApi.js';
import { statsRouter, authRouter } from './server/statsApi.js';
import { ingestRouter } from './server/ingestApi.js';
import { appsRouter } from './server/appsApi.js';
import { threatsRouter } from './server/threatsApi.js';
import { exportRouter } from './server/exportApi.js';
import { featureService } from './server/featureService.js';
import { threatEngine } from './server/threatEngine.js';
import { assertSecureProductionConfig, config } from './server/config.js';
import { connectDatabase, hydrateDatabase, loadCollections } from './server/db.js';
import { appsService } from './server/appsService.js';
import { alertService } from './server/alertService.js';
import { recorder } from './server/recorder.js';

async function bootstrap() {
  console.log('[Gatekeeper] Initializing API Security Monitoring Platform...');
  assertSecureProductionConfig();
  await connectDatabase();
  await hydrateDatabase(process.cwd());
  const stored = await loadCollections();
  appsService.hydrate(stored.apps);
  threatEngine.hydrate(stored.rules, stored.settings, stored.threats);
  recorder.hydrate(stored.traffic);
  featureService.hydrate(stored.features);
  alertService.hydrate(stored.alerts);

  // Background ML feature extraction and retention cleanup
  featureService.startBackgroundJobs(() => {
    const s = threatEngine.getSettings();
    return {
      rawTrafficDays: s.raw_traffic_retention_days ?? 30,
      featureDays: s.feature_retention_days ?? 90,
    };
  });

  const app = express();
  app.set('trust proxy', config.trustProxyHops);
  app.disable('x-powered-by');
  app.use((_req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('Referrer-Policy', 'no-referrer');
    res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
    res.setHeader('Content-Security-Policy', "default-src 'none'; frame-ancestors 'none'");
    res.setHeader('X-XSS-Protection', '0');
    if (process.env.NODE_ENV === 'production') {
      res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
    }
    next();
  });
  const allowedOrigins = (process.env.ALLOWED_ORIGINS || '')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);
  const corsMiddleware = cors({
    origin: (origin, callback) => {
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
        return;
      }
      callback(new Error('Origin is not allowed by ALLOWED_ORIGINS.'));
    },
    credentials: false,
    methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Authorization', 'Content-Type', 'X-API-Key'],
  });
  app.use(corsMiddleware);
  app.options('*', corsMiddleware);
  app.get('/health', (_req, res) => {
    res.json({ ok: true });
  });

  // Ingest API
  app.use('/api/v1/ingest', express.json({ limit: '2mb' }), ingestRouter);

  const apiJson = express.json({ limit: '100kb' });

  // ML Feature Export & Training Simulator API
  app.use('/api/v1/export', apiJson, exportRouter);

  // Threats & Rules Management API
  app.use('/api/threats', apiJson, threatsRouter);

  // Applications Management API
  app.use('/api/apps', apiJson, appsRouter);

  // Stats and Auth APIs
  app.use('/api/stats', apiJson, statsRouter);
  app.use('/api/auth', apiJson, authRouter);

  // Monitor API
  app.use('/api/monitor', apiJson, monitorRouter);

  app.use((err: Error & { status?: number }, _req: express.Request, res: express.Response, next: express.NextFunction) => {
    if (err.message === 'Origin is not allowed by ALLOWED_ORIGINS.') {
      res.status(403).json({ error: err.message });
      return;
    }
    next(err);
  });

  app.listen(config.port, '0.0.0.0', () => {
    console.log(`[Gatekeeper] Ready! API listening on port ${config.port}`);
  });
}

bootstrap().catch((err) => {
  console.error('[Gatekeeper] Fatal startup error:', err);
  process.exit(1);
});
