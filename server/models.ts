import mongoose, { Schema } from 'mongoose';
import {
  AlertHistoryEntry,
  FeatureRow,
  PlatformSettings,
  RegisteredApp,
  ThreatRecord,
  ThreatRule,
  TrafficRecord,
} from './types.js';

const schemaOptions = { versionKey: false, strict: true, id: false, timestamps: false } as any;

export const AppModel = mongoose.models.App || mongoose.model<RegisteredApp>('App', new Schema({
  id: { type: String, required: true, unique: true },
  name: String, environment: String, key_prefix: String, key_hash: { type: String, required: true, index: true },
  status: String, created_at: String, last_seen_at: { type: String, default: null },
  total_requests: Number, key_history: { type: Array, default: [] } as any,
}, schemaOptions));

export const ThreatModel = mongoose.models.Threat || mongoose.model<ThreatRecord>('Threat', new Schema({
  id: { type: String, required: true, unique: true },
  app_id: { type: String, index: true }, app_name: String, rule_id: { type: String, index: true },
  rule_name: String, severity: String, client_ip: String, hashed_user_id: String,
  first_seen: String, last_seen: String, hit_count: Number, status: String, evidence: String,
  owasp_tag: String, milestone_100_alerted: Boolean,
}, schemaOptions).index({ app_id: 1, rule_id: 1 }));

export const TrafficRecordModel = mongoose.models.TrafficRecord || mongoose.model<TrafficRecord>('TrafficRecord', new Schema({
  request_id: { type: String, required: true, unique: true }, app_id: String, app_name: String,
  environment: String, timestamp: { type: String, required: true, index: true }, client_ip: String,
  method: String, path: String, normalized_path: String, query_param_names: [String],
  status_code: Number, response_time_ms: Number, request_size: Number, response_size: Number,
  user_agent: String, user_id_hash: String, login_result: String, threat_rule: String,
  threat_rule_id: String, label: String, label_source: String, is_synthetic: Boolean,
}, schemaOptions));

export const FeatureRowModel = mongoose.models.FeatureRow || mongoose.model<FeatureRow>('FeatureRow', new Schema({
  feature_id: { type: String, required: true, unique: true }, timestamp: { type: String, index: true },
  app_id: String, app_name: String, client_ip: String, window_size: String, request_count: Number,
  error_rate_4xx: Number, error_rate_5xx: Number, unique_endpoints: Number, unique_user_ids: Number,
  failed_logins: Number, avg_gap_between_requests_ms: Number, avg_response_time_ms: Number,
  avg_request_size: Number, max_request_size: Number, post_ratio: Number, night_time_ratio: Number,
  unique_user_agents: Number, label: String, label_source: String,
}, schemaOptions));

export const AlertHistoryModel = mongoose.models.AlertHistoryEntry || mongoose.model<AlertHistoryEntry>('AlertHistoryEntry', new Schema({
  id: { type: String, required: true, unique: true }, timestamp: String, threat_id: String, app_id: String,
  app_name: String, rule_id: String, rule_name: String, severity: String, client_ip: String,
  trigger_reason: String, status: String, attempts: Number, error: String,
}, schemaOptions));

export const RuleModel = mongoose.models.Rule || mongoose.model<ThreatRule>('Rule', new Schema({
  id: { type: String, required: true, unique: true }, name: String, severity: String, window_seconds: Number,
  threshold: Number, enabled: Boolean, owasp_tag: String, description: String,
}, schemaOptions));

export const SettingsModel = mongoose.models.Settings || mongoose.model<PlatformSettings>('Settings', new Schema({
  mode: String, notify_on_high_critical: Boolean, description: String, alert_webhook_url: String,
  alert_min_severity: String, alert_dedup_minutes: Number, raw_traffic_retention_days: Number,
  feature_retention_days: Number,
}, schemaOptions));
