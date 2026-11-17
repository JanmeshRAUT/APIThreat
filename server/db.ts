import mongoose from 'mongoose';
import fs from 'node:fs/promises';
import path from 'node:path';
import { AppModel, AlertHistoryModel, FeatureRowModel, RuleModel, SettingsModel, ThreatModel, TrafficRecordModel } from './models.js';
import { RegisteredApp, ThreatRecord, ThreatRule, PlatformSettings, AlertHistoryEntry, FeatureRow, TrafficRecord } from './types.js';

let connected = false;

export async function connectDatabase(): Promise<void> {
  const uri = process.env.MONGODB_URI?.trim();
  if (!uri) throw new Error('MONGODB_URI is required. Set it to your MongoDB Atlas connection string.');
  try {
    await mongoose.connect(uri);
    connected = true;
  } catch (error) {
    throw new Error(`MongoDB connection failed: ${error instanceof Error ? error.message : String(error)}`);
  }
}

export function isDatabaseConnected(): boolean {
  return connected;
}

export async function hydrateDatabase(dataRoot: string): Promise<void> {
  const [rules, settings] = await Promise.all([
    RuleModel.countDocuments(),
    SettingsModel.countDocuments(),
  ]);
  if (rules === 0) {
    const defaults = JSON.parse(await fs.readFile(path.join(dataRoot, 'rules.default.json'), 'utf8')) as ThreatRule[];
    if (defaults.length) await RuleModel.insertMany(defaults);
  }
  if (settings === 0) {
    const defaults = JSON.parse(await fs.readFile(path.join(dataRoot, 'settings.default.json'), 'utf8')) as PlatformSettings;
    await SettingsModel.create(defaults);
  }
}

export async function loadCollections(): Promise<{
  apps: RegisteredApp[]; threats: ThreatRecord[]; traffic: TrafficRecord[]; features: FeatureRow[];
  alerts: AlertHistoryEntry[]; rules: ThreatRule[]; settings: PlatformSettings | null;
}> {
  const [apps, threats, traffic, features, alerts, rules, settings] = await Promise.all([
    AppModel.find().lean(), ThreatModel.find().lean(), TrafficRecordModel.find().sort({ timestamp: 1 }).lean(),
    FeatureRowModel.find().sort({ timestamp: 1 }).lean(), AlertHistoryModel.find().sort({ timestamp: -1 }).limit(500).lean(),
    RuleModel.find().lean(), SettingsModel.findOne().lean(),
  ]);
  return { apps: apps as RegisteredApp[], threats: threats as ThreatRecord[], traffic: traffic as TrafficRecord[],
    features: features as FeatureRow[], alerts: alerts as AlertHistoryEntry[], rules: rules as ThreatRule[],
    settings: settings as PlatformSettings | null };
}

export async function closeDatabase(): Promise<void> {
  connected = false;
  await mongoose.disconnect();
}
