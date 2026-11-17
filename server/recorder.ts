import { TrafficRecord, TelemetryStats } from './types.js';
import { config } from './config.js';
import { ruleToLabel } from './normalizer.js';
import { TrafficRecordModel } from './models.js';
import { isDatabaseConnected } from './db.js';

class TrafficRecorder {
  private inMemoryRecords: TrafficRecord[] = [];
  private totalRecordedCount: number = 0;
  private maxRecords: number;
  private startedAt: string;

  constructor(maxRecords: number = 5000, logFilePath: string = '') {
    this.maxRecords = maxRecords;
    this.startedAt = new Date().toISOString();
  }
  public hydrate(records: TrafficRecord[]): void {
    this.totalRecordedCount = records.length;
    this.inMemoryRecords = records.slice(-this.maxRecords).map((record) => this.ensureLabels(record));
  }

  /**
   * Ensure every record has normalized ML label & label_source metadata.
   */
  private ensureLabels(record: TrafficRecord): TrafficRecord {
    const label =
      record.label ||
      (record.threat_rule && record.threat_rule !== 'normal'
        ? ruleToLabel(record.threat_rule_id || record.threat_rule)
        : 'normal');
    const labelSource = record.label_source || 'rule';
    const threatRule = record.threat_rule || (label === 'normal' ? 'normal' : label);
    return {
      ...record,
      threat_rule: threatRule,
      label,
      label_source: labelSource,
    };
  }

  /**
   * Asynchronous, non-blocking recording.
   * Safety rule: If file write fails or is slow, the request is completely unaffected.
   */
  public recordAsync(record: TrafficRecord): void {
    const labeledRecord = this.ensureLabels(record);

    this.totalRecordedCount++;
    this.inMemoryRecords.push(labeledRecord);
    if (this.inMemoryRecords.length > this.maxRecords) {
      this.inMemoryRecords.shift();
    }

    setImmediate(async () => {
      try {
        if (isDatabaseConnected()) await TrafficRecordModel.create(labeledRecord);
      } catch (err) {
        console.error('[Gatekeeper] Background disk write error to traffic.jsonl:', err);
      }
    });
  }

  /**
   * Synchronous push into the in-memory ring buffer and MongoDB.
   */
  public recordSync(record: TrafficRecord, persistToDisk: boolean = true): TrafficRecord {
    const labeledRecord = this.ensureLabels(record);
    this.totalRecordedCount++;
    this.inMemoryRecords.push(labeledRecord);
    if (this.inMemoryRecords.length > this.maxRecords) {
      this.inMemoryRecords.shift();
    }
    if (persistToDisk && isDatabaseConnected()) {
      void TrafficRecordModel.create(labeledRecord).catch((err: unknown) => console.error('[Gatekeeper] MongoDB traffic write error:', err));
    }
    return labeledRecord;
  }

  /**
   * Human feedback correction: when a threat is marked "false_positive",
   * update all matching requests back to label: "normal" and label_source: "human".
   */
  public markFalsePositiveByThreat(
    threat: { app_id: string; client_ip: string; rule_id: string; rule_name: string },
    _targetFilePath?: string
  ): number {
    const mlLabel = ruleToLabel(threat.rule_id || threat.rule_name);
    const matchesThreat = (r: TrafficRecord): boolean => {
      const sameApp = !r.app_id || r.app_id === threat.app_id;
      const sameIp = r.client_ip === threat.client_ip;
      if (!sameApp || !sameIp) return false;

      return (
        r.threat_rule_id === threat.rule_id ||
        r.threat_rule === threat.rule_name ||
        r.label === mlLabel
      );
    };

    let correctedCount = 0;

    for (const r of this.inMemoryRecords) {
      if (matchesThreat(r)) {
        r.label = 'normal';
        r.label_source = 'human';
        r.threat_rule = 'normal';
        correctedCount++;
      }
    }

    try {
      if (isDatabaseConnected()) {
        void TrafficRecordModel.updateMany(
          { app_id: threat.app_id, client_ip: threat.client_ip, $or: [{ threat_rule_id: threat.rule_id }, { threat_rule: threat.rule_name }, { label: mlLabel }] },
          { $set: { label: 'normal', label_source: 'human', threat_rule: 'normal' } }
        ).catch((err: unknown) => console.error('[Gatekeeper] MongoDB traffic correction error:', err));
        return correctedCount;
      }
    } catch (err) {
      console.error('[Gatekeeper] Failed to update false positive labels in traffic.jsonl:', err);
    }

    return correctedCount;
  }

  /**
   * Retention clean-up: delete raw traffic records older than `retentionDays`.
   */
  public cleanupOlderThanDays(
    retentionDays: number,
    nowMs: number = Date.now(),
    _targetFilePath?: string
  ): { removed: number; kept: number } {
    const safeDays = Math.max(1, Number(retentionDays) || 30);
    const cutoffMs = nowMs - safeDays * 24 * 60 * 60 * 1000;
    let removed = 0;
    let kept = 0;

    const before = this.inMemoryRecords.length;
    this.inMemoryRecords = this.inMemoryRecords.filter((r) => {
      const ts = new Date(r.timestamp).getTime();
      return isNaN(ts) || ts >= cutoffMs;
    });
    removed += before - this.inMemoryRecords.length;

    try {
      if (isDatabaseConnected()) {
        void TrafficRecordModel.deleteMany({ timestamp: { $lt: new Date(cutoffMs).toISOString() } }).catch((err: unknown) => console.error('[Gatekeeper] MongoDB traffic cleanup error:', err));
        removed += this.inMemoryRecords.filter((r) => {
          const ts = new Date(r.timestamp).getTime();
          return !isNaN(ts) && ts < cutoffMs;
        }).length;
        this.inMemoryRecords = this.inMemoryRecords.filter((r) => {
          const ts = new Date(r.timestamp).getTime();
          return isNaN(ts) || ts >= cutoffMs;
        });
        return { removed, kept: Math.max(0, this.inMemoryRecords.length) };
      }
    } catch (err) {
      console.error('[Gatekeeper] Raw traffic retention cleanup error:', err);
    }

    return { removed, kept };
  }

  /**
   * Retrieve the latest N records from memory (newest first).
   */
  public getRecent(
    limit: number = 50,
    filters?: { method?: string; status?: string; loginResult?: string; search?: string; appId?: string }
  ): TrafficRecord[] {
    let result = [...this.inMemoryRecords].reverse();

    if (filters) {
      if (filters.appId && filters.appId !== 'ALL') {
        result = result.filter((r) => r.app_id === filters.appId);
      }
      if (filters.method && filters.method !== 'ALL') {
        result = result.filter((r) => r.method.toUpperCase() === filters.method!.toUpperCase());
      }
      if (filters.loginResult && filters.loginResult !== 'ALL') {
        result = result.filter((r) => r.login_result === filters.loginResult);
      }
      if (filters.status && filters.status !== 'ALL') {
        const statusPrefix = filters.status[0]; // e.g. "2" for "2xx"
        result = result.filter((r) => r.status_code.toString().startsWith(statusPrefix));
      }
      if (filters.search && filters.search.trim()) {
        const term = filters.search.trim().toLowerCase();
        result = result.filter(
          (r) =>
            r.path.toLowerCase().includes(term) ||
            r.normalized_path.toLowerCase().includes(term) ||
            r.request_id.toLowerCase().includes(term) ||
            r.client_ip.toLowerCase().includes(term) ||
            r.user_agent.toLowerCase().includes(term) ||
            (r.app_name && r.app_name.toLowerCase().includes(term))
        );
      }
    }

    return result.slice(0, limit);
  }

  /**
   * Calculate aggregated telemetry statistics.
   */
  public getStats(): TelemetryStats {
    const records = this.inMemoryRecords;
    const total = records.length;

    let totalDuration = 0;
    let minDuration = total > 0 ? Infinity : 0;
    let maxDuration = 0;

    const loginCounts = { ok: 0, fail: 0, none: 0 };
    const statusCounts = { '2xx': 0, '3xx': 0, '4xx': 0, '5xx': 0 };
    const methodsBreakdown: Record<string, number> = {};
    const pathCounts: Record<string, number> = {};

    for (const r of records) {
      totalDuration += r.response_time_ms;
      if (r.response_time_ms < minDuration) minDuration = r.response_time_ms;
      if (r.response_time_ms > maxDuration) maxDuration = r.response_time_ms;

      if (r.login_result in loginCounts) {
        loginCounts[r.login_result]++;
      } else {
        loginCounts.none++;
      }

      if (r.status_code >= 200 && r.status_code < 300) statusCounts['2xx']++;
      else if (r.status_code >= 300 && r.status_code < 400) statusCounts['3xx']++;
      else if (r.status_code >= 400 && r.status_code < 500) statusCounts['4xx']++;
      else if (r.status_code >= 500) statusCounts['5xx']++;

      methodsBreakdown[r.method] = (methodsBreakdown[r.method] || 0) + 1;
      pathCounts[r.normalized_path] = (pathCounts[r.normalized_path] || 0) + 1;
    }

    const topPaths = Object.entries(pathCounts)
      .map(([path, count]) => ({ path, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    const avgDuration = total > 0 ? Math.round((totalDuration / total) * 10) / 10 : 0;

    return {
      total_records: this.totalRecordedCount,
      in_memory_records: total,
      avg_response_time_ms: avgDuration,
      min_response_time_ms: minDuration === Infinity ? 0 : minDuration,
      max_response_time_ms: maxDuration,
      login_counts: loginCounts,
      status_counts: statusCounts,
      methods_breakdown: methodsBreakdown,
      top_paths: topPaths,
      started_at: this.startedAt,
    };
  }

  /**
   * Reset in-memory buffer.
   */
  public clearInMemory(): void {
    this.inMemoryRecords = [];
  }

  public getAllRecords(): TrafficRecord[] {
    return [...this.inMemoryRecords];
  }

  public getLogFilePath(): string {
    return '';
  }
}

export const recorder = new TrafficRecorder(config.maxInMemoryRecords);
