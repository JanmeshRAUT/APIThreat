import { recorder } from './recorder.js';
import { threatEngine } from './threatEngine.js';
import { DashboardStats, MinuteMetric, EndpointMetric, ClientIpMetric, SlowestEndpointMetric } from './types.js';

/**
 * Calculates comprehensive metrics from the recorded traffic for GET /api/stats
 * Supports filtering by appId (or across all apps)
 */
export function calculateDashboardStats(appId?: string): DashboardStats {
  const allRecords = recorder.getAllRecords();
  const records = appId && appId !== 'ALL' ? allRecords.filter((r) => r.app_id === appId) : allRecords;
  const total = records.length;

  let totalDuration = 0;
  let totalErrors = 0;
  let failedLogins = 0;

  const statusBreakdown = {
    '2xx': 0,
    '3xx': 0,
    '4xx': 0,
    '5xx': 0,
  };

  const endpointMap = new Map<string, { count: number; totalMs: number }>();
  const ipMap = new Map<string, number>();

  // 30 minute time series buckets
  const now = Date.now();
  const currentMinute = Math.floor(now / 60_000) * 60_000;
  const thirtyMinutesAgo = currentMinute - 29 * 60_000;
  const minuteBuckets: Map<number, MinuteMetric> = new Map();

  for (let i = 29; i >= 0; i--) {
    const slotTimestamp = currentMinute - i * 60_000;
    const slotTime = new Date(slotTimestamp);
    const hours = slotTime.getHours().toString().padStart(2, '0');
    const minutes = slotTime.getMinutes().toString().padStart(2, '0');
    const key = `${hours}:${minutes}`;

    minuteBuckets.set(slotTimestamp, {
      time: key,
      timestamp: slotTimestamp,
      requests: 0,
      errors: 0,
    });
  }

  for (const r of records) {
    totalDuration += r.response_time_ms;

    if (r.status_code >= 200 && r.status_code < 300) {
      statusBreakdown['2xx']++;
    } else if (r.status_code >= 300 && r.status_code < 400) {
      statusBreakdown['3xx']++;
    } else if (r.status_code >= 400 && r.status_code < 500) {
      statusBreakdown['4xx']++;
      totalErrors++;
    } else if (r.status_code >= 500) {
      statusBreakdown['5xx']++;
      totalErrors++;
    }

    if (r.login_result === 'fail') {
      failedLogins++;
    }

    const endpoint = r.normalized_path || r.path || '/';
    const epData = endpointMap.get(endpoint) || { count: 0, totalMs: 0 };
    epData.count++;
    epData.totalMs += r.response_time_ms;
    endpointMap.set(endpoint, epData);

    const ip = r.client_ip || '127.0.0.1';
    ipMap.set(ip, (ipMap.get(ip) || 0) + 1);

    try {
      const recDate = new Date(r.timestamp);
      if (recDate.getTime() >= thirtyMinutesAgo) {
        const bucketTimestamp = Math.floor(recDate.getTime() / 60_000) * 60_000;
        const bucket = minuteBuckets.get(bucketTimestamp);
        if (bucket) {
          bucket.requests++;
          if (r.status_code >= 400) {
            bucket.errors++;
          }
        }
      }
    } catch {
    }
  }

  // Top 10 endpoints by volume
  const topEndpoints: EndpointMetric[] = Array.from(endpointMap.entries())
    .map(([endpoint, data]) => ({
      endpoint,
      count: data.count,
      percentage: total > 0 ? Math.round((data.count / total) * 1000) / 10 : 0,
    }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);

  // Top 10 client IPs
  const topClientIps: ClientIpMetric[] = Array.from(ipMap.entries())
    .map(([ip, count]) => ({
      ip,
      count,
      percentage: total > 0 ? Math.round((count / total) * 1000) / 10 : 0,
    }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);

  // 5 slowest endpoints by average response time
  const slowestEndpoints: SlowestEndpointMetric[] = Array.from(endpointMap.entries())
    .map(([endpoint, data]) => ({
      endpoint,
      avg_response_time_ms: data.count > 0 ? Math.round((data.totalMs / data.count) * 10) / 10 : 0,
      count: data.count,
    }))
    .sort((a, b) => b.avg_response_time_ms - a.avg_response_time_ms)
    .slice(0, 5);

  const avgResponseTime = total > 0 ? Math.round((totalDuration / total) * 10) / 10 : 0;
  const errorRate = total > 0 ? Math.round((totalErrors / total) * 1000) / 10 : 0;

  return {
    total_requests: total,
    error_rate: errorRate,
    failed_logins: failedLogins,
    avg_response_time_ms: avgResponseTime,
    status_code_breakdown: statusBreakdown,
    requests_per_minute: Array.from(minuteBuckets.values()),
    top_endpoints: topEndpoints,
    top_client_ips: topClientIps,
    slowest_endpoints: slowestEndpoints,
    generated_at: new Date().toISOString(),
    selected_app_id: appId || null,
    open_threats_by_severity: threatEngine.getOpenThreatsSummary(appId),
  };
}
