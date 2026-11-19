import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  ShieldAlert,
  AlertTriangle,
  Search,
  Filter,
  CheckCircle2,
  Clock,
  Layers,
  ExternalLink,
  X,
  Copy,
  Check,
  RefreshCw,
  Eye,
  ShieldCheck,
  XCircle,
  Bell,
  Webhook,
} from 'lucide-react';
import { ThreatRecord, ThreatSeverity, ThreatStatus, ThreatRule, AlertHistoryEntry } from '../types/threats';
import { getThreatReasoning } from '../data/threatReasoning';
import { apiFetch } from '../lib/api';

interface ThreatsViewProps {
  apps: Array<{ id: string; name: string }>;
  selectedAppId: string;
  currentRole?: string | null;
  onSelectApp: (id: string) => void;
  onThreatsUpdated?: () => void;
  initialThreatId?: string | null;
}

export function ThreatsView({ apps, selectedAppId, currentRole = 'admin', onThreatsUpdated, initialThreatId }: ThreatsViewProps) {
  const isAdmin = currentRole === 'admin';
  const [threats, setThreats] = useState<ThreatRecord[]>([]);
  const [alertHistory, setAlertHistory] = useState<AlertHistoryEntry[]>([]);
  const [rules, setRules] = useState<ThreatRule[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [copiedIp, setCopiedIp] = useState<string | null>(null);

  // Filters
  const [severityFilter, setSeverityFilter] = useState<string>('ALL');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [ruleFilter, setRuleFilter] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState('');

  // Selected Threat for Inspection / Status update
  const [inspectThreat, setInspectThreat] = useState<ThreatRecord | null>(null);
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);
  const [statusToast, setStatusToast] = useState<{ threatId: string; message: string; previousStatus: ThreatStatus } | null>(null);
  const inspectDialogRef = useRef<HTMLDivElement>(null);
  const inspectTriggerRef = useRef<HTMLTableRowElement | null>(null);

  // Fetch Threats
  const fetchThreats = useCallback(async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams();
      if (selectedAppId && selectedAppId !== 'ALL') params.append('app_id', selectedAppId);
      if (severityFilter !== 'ALL') params.append('severity', severityFilter);
      if (statusFilter !== 'ALL') params.append('status', statusFilter);
      if (ruleFilter !== 'ALL') params.append('rule_id', ruleFilter);

      const [threatsRes, historyRes] = await Promise.all([
        apiFetch(`/api/threats?${params.toString()}`),
        apiFetch('/api/threats/alerts/history?limit=100'),
      ]);

      if (threatsRes.ok) {
        const data = await threatsRes.json();
        const loadedThreats: ThreatRecord[] = data.threats || [];
        setThreats(loadedThreats);
        if (initialThreatId) {
          const match = loadedThreats.find((t) => t.id === initialThreatId);
          if (match) setInspectThreat(match);
        }
      }
      if (historyRes.ok) {
        const hData = await historyRes.json();
        setAlertHistory(hData.history || []);
      }
    } catch (err) {
      console.error('Failed to fetch threats:', err);
    } finally {
      setIsLoading(false);
    }
  }, [selectedAppId, severityFilter, statusFilter, ruleFilter, initialThreatId]);

  // Fetch Rules for filter dropdown
  useEffect(() => {
    async function loadRules() {
      try {
        const res = await apiFetch('/api/threats/rules');
        if (res.ok) {
          const data = await res.json();
          setRules(data.rules || []);
        }
      } catch (err) {
        console.error('Failed to load rules for filter:', err);
      }
    }
    loadRules();
  }, []);

  useEffect(() => {
    fetchThreats();
  }, [fetchThreats]);

  // Handle status update
  const handleUpdateStatus = async (threatId: string, newStatus: ThreatStatus) => {
    setIsUpdatingStatus(true);
    try {
      const previousThreat = threats.find((threat) => threat.id === threatId);
      const res = await apiFetch(`/api/threats/${threatId}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      });
      if (res.ok) {
        const data = await res.json();
        setThreats((prev) =>
          prev.map((t) => (t.id === threatId ? data.threat : t))
        );
        if (inspectThreat && inspectThreat.id === threatId) {
          setInspectThreat(data.threat);
        }
        if (onThreatsUpdated) onThreatsUpdated();
        if (previousThreat && previousThreat.status !== newStatus) {
          setStatusToast({
            threatId,
            previousStatus: previousThreat.status,
            message: `Threat marked ${newStatus.replace('_', ' ')}`,
          });
          window.setTimeout(() => setStatusToast(null), 5000);
        }
      }
    } catch (err) {
      console.error('Failed to update threat status:', err);
    } finally {
      setIsUpdatingStatus(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedIp(text);
    setTimeout(() => setCopiedIp(null), 2000);
  };

  // Filtered threats including search query
  const filteredThreats = useMemo(() => {
    if (!searchQuery.trim()) return threats;
    const q = searchQuery.toLowerCase();
    return threats.filter(
      (t) =>
        t.client_ip.toLowerCase().includes(q) ||
        t.rule_name.toLowerCase().includes(q) ||
        t.evidence.toLowerCase().includes(q) ||
        t.id.toLowerCase().includes(q) ||
        t.app_name.toLowerCase().includes(q)
    );
  }, [threats, searchQuery]);

  // Summary counts
  const counts = useMemo(() => {
    const res = { critical: 0, high: 0, medium: 0, low: 0, open: 0, total: threats.length };
    threats.forEach((t) => {
      if (t.status === 'open') res.open++;
      if (t.severity === 'critical') res.critical++;
      if (t.severity === 'high') res.high++;
      if (t.severity === 'medium') res.medium++;
      if (t.severity === 'low') res.low++;
    });
    return res;
  }, [threats]);
  const newestThreat = threats[0];
  const openHighCritical = threats.filter((threat) => threat.status === 'open' && (threat.severity === 'critical' || threat.severity === 'high')).length;
  const hasActiveFilters = Boolean(searchQuery.trim()) || severityFilter !== 'ALL' || statusFilter !== 'ALL' || ruleFilter !== 'ALL';
  const clearFilters = () => {
    setSearchQuery('');
    setSeverityFilter('ALL');
    setStatusFilter('ALL');
    setRuleFilter('ALL');
  };
  const formatRelativeTime = (timestamp: string) => {
    const elapsedMinutes = Math.max(0, Math.floor((Date.now() - new Date(timestamp).getTime()) / 60000));
    if (elapsedMinutes < 1) return 'just now';
    if (elapsedMinutes < 60) return `${elapsedMinutes} min ago`;
    const elapsedHours = Math.floor(elapsedMinutes / 60);
    if (elapsedHours < 24) return `${elapsedHours} hr ago`;
    return `${Math.floor(elapsedHours / 24)} days ago`;
  };

  useEffect(() => {
    if (!inspectThreat) return;
    const dialog = inspectDialogRef.current;
    dialog?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setInspectThreat(null);
        inspectTriggerRef.current?.focus();
      }
      if (event.key === 'Tab' && dialog) {
        const focusable = dialog.querySelectorAll<HTMLElement>('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])');
        if (focusable.length === 0) return;
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [inspectThreat]);

  const getSeverityBadge = (sev: ThreatSeverity) => {
    switch (sev) {
      case 'critical':
        return 'bg-rose-100 text-rose-800 border-rose-300 font-bold';
      case 'high':
        return 'bg-orange-100 text-orange-800 border-orange-300 font-bold';
      case 'medium':
        return 'bg-amber-100 text-amber-800 border-amber-300 font-semibold';
      case 'low':
        return 'bg-blue-100 text-blue-800 border-blue-300 font-medium';
    }
  };

  const getStatusBadge = (st: ThreatStatus) => {
    switch (st) {
      case 'open':
        return 'bg-rose-50 text-rose-700 border-rose-200';
      case 'acknowledged':
        return 'bg-amber-50 text-amber-700 border-amber-200';
      case 'resolved':
        return 'bg-emerald-50 text-emerald-700 border-emerald-200';
      case 'false_positive':
        return 'bg-slate-100 text-slate-600 border-slate-300';
    }
  };
  const inspectReasoning = inspectThreat ? getThreatReasoning(inspectThreat) : null;

  return (
    <div className="flex flex-col gap-6">
      {statusToast && (
        <div className="fixed bottom-5 right-5 z-40 flex items-center gap-3 rounded bg-slate-900 px-3.5 py-2.5 text-xs text-white shadow-sm border border-slate-700" role="status">
          <span>{statusToast.message}</span>
          <button
            onClick={() => {
              void handleUpdateStatus(statusToast.threatId, statusToast.previousStatus);
              setStatusToast(null);
            }}
            className="font-semibold text-blue-200 hover:text-white underline cursor-pointer"
          >
            Undo
          </button>
          <button onClick={() => setStatusToast(null)} aria-label="Dismiss notification" className="text-slate-300 hover:text-white cursor-pointer">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}
      {/* Top Banner / Stats Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="page-title text-slate-900">Threats</h1>
            <span className="text-xs font-mono font-medium text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
              MONITORING ONLY
            </span>
          </div>
          <p className="page-sub mt-0.5">
            Real-time threat registry and detection telemetry.
          </p>
        </div>

        {/* Severity Metrics Pills */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => setSeverityFilter('critical')}
            className={`flex items-center gap-1.5 px-2 py-1 text-xs cursor-pointer ${
              severityFilter === 'critical' ? 'border-b-2 border-rose-600 font-semibold text-rose-700' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <span className="status-dot status-dot-danger" />
            <span>Critical {counts.critical}</span>
          </button>
          <button
            onClick={() => setSeverityFilter('high')}
            className={`flex items-center gap-1.5 px-2 py-1 text-xs cursor-pointer ${
              severityFilter === 'high' ? 'border-b-2 border-amber-600 font-semibold text-amber-700' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <span className="status-dot status-dot-warn" />
            <span>High {counts.high}</span>
          </button>
          <button
            onClick={() => setSeverityFilter('medium')}
            className={`flex items-center gap-1.5 px-2 py-1 text-xs cursor-pointer ${
              severityFilter === 'medium' ? 'border-b-2 border-blue-600 font-semibold text-blue-700' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <span className="status-dot status-dot-accent" />
            <span>Medium {counts.medium}</span>
          </button>
          <button
            onClick={() => setSeverityFilter('low')}
            className={`flex items-center gap-1.5 px-2 py-1 text-xs cursor-pointer ${
              severityFilter === 'low' ? 'border-b-2 border-slate-400 font-semibold text-slate-700' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <span className="status-dot status-dot-muted" />
            <span>Low {counts.low}</span>
          </button>
          <button
            onClick={fetchThreats}
            className="p-1.5 rounded text-slate-500 hover:text-blue-600 hover:bg-slate-100 border border-slate-200 transition-colors cursor-pointer"
            title="Refresh threats"
            aria-label="Refresh threats"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Filter Toolbar */}
      <div className="flex flex-col md:flex-row gap-3 items-center justify-between">
        <div className="flex flex-wrap items-center gap-2.5 w-full md:w-auto">
          {/* Search */}
          <div className="relative min-w-[200px] flex-1 md:flex-initial">
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search IP, rule, ID..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="input pl-8 pr-3 py-1 text-xs w-full"
            />
          </div>

          {/* Severity Filter */}
          <select
            value={severityFilter}
            onChange={(e) => setSeverityFilter(e.target.value)}
            className="input py-1 text-xs w-auto cursor-pointer font-medium"
          >
            <option value="ALL">All Severities</option>
            <option value="critical">Critical</option>
            <option value="high">High</option>
            <option value="medium">Medium</option>
            <option value="low">Low</option>
          </select>

          {/* Status Filter */}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="input py-1 text-xs w-auto cursor-pointer font-medium"
          >
            <option value="ALL">All Statuses</option>
            <option value="open">Open</option>
            <option value="acknowledged">Acknowledged</option>
            <option value="resolved">Resolved</option>
            <option value="false_positive">False Positive</option>
          </select>

          {/* Rule Filter */}
          <select
            value={ruleFilter}
            onChange={(e) => setRuleFilter(e.target.value)}
            className="input py-1 text-xs w-auto cursor-pointer font-medium max-w-[180px] truncate"
          >
            <option value="ALL">All {rules.length || 'available'} Rules</option>
            {rules.map((r) => (
              <option key={r.id} value={r.id}>
                {r.name}
              </option>
            ))}
          </select>
        </div>

        <div className="text-xs text-slate-500 whitespace-nowrap self-end md:self-center">
          Showing <span className="font-semibold text-slate-900">{filteredThreats.length}</span> threat records
        </div>
      </div>

      <div className="panel border-l-2 border-l-[var(--color-danger)] p-4 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <div className="text-xs font-semibold uppercase tracking-wider text-slate-500">Needs attention</div>
          <div className="mt-1 text-sm font-semibold text-slate-900">
            {openHighCritical} open critical/high threats
            {newestThreat && <span className="text-slate-500 font-normal"> · Newest: {newestThreat.rule_name}</span>}
          </div>
        </div>
        <button
          onClick={() => {
            setStatusFilter('open');
            setSeverityFilter('ALL');
          }}
          className="btn btn-secondary text-xs"
        >
          <Eye className="w-3.5 h-3.5" aria-hidden="true" />
          Review open threats
        </button>
      </div>

      {/* Threats Table */}
      <div className="panel overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-600 border-b border-slate-200">
              <tr>
                <th className="th">Severity</th>
                <th className="th">Threat</th>
                <th className="th">Who</th>
                <th className="th">Activity</th>
                <th className="th">Status</th>
                <th className="th text-right"><span className="sr-only">Open details</span></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {isLoading ? (
                Array.from({ length: 4 }).map((_, index) => (
                  <tr key={`skeleton-${index}`} aria-hidden="true">
                    {Array.from({ length: 6 }).map((__, cellIndex) => (
                      <td key={cellIndex} className="td py-2">
                        <div className="h-3 rounded bg-slate-200" />
                      </td>
                    ))}
                  </tr>
                ))
              ) : filteredThreats.length === 0 ? (
                <tr>
                  <td colSpan={6} className="td py-8 text-center text-slate-500 font-sans">
                    <div className="max-w-sm mx-auto flex flex-col items-center gap-3">
                      <div className="font-semibold text-slate-800 text-sm">
                        {hasActiveFilters ? 'No results for these filters' : 'No threats yet — you’re all clear'}
                      </div>
                      <p className="text-xs text-slate-600">
                        {hasActiveFilters ? 'Try clearing a filter to see more threat records.' : 'Incoming detections will appear here when the monitor finds one.'}
                      </p>
                      {hasActiveFilters && (
                        <button onClick={clearFilters} className="btn btn-secondary text-xs">
                          Clear filters
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ) : (
                filteredThreats.map((t) => {
                  const rowClass =
                    t.severity === 'critical'
                      ? 'row-crit'
                      : t.severity === 'high'
                      ? 'row-high'
                      : t.severity === 'medium'
                      ? 'row-med'
                      : '';
                  const tagClass =
                    t.severity === 'critical'
                      ? 'tag tag-critical'
                      : t.severity === 'high'
                      ? 'tag tag-high'
                      : t.severity === 'medium'
                      ? 'tag tag-medium'
                      : 'tag tag-low';

                  return (
                    <tr
                      key={t.id}
                      ref={(row) => {
                        if (inspectThreat?.id === t.id) inspectTriggerRef.current = row;
                      }}
                      onClick={() => {
                        inspectTriggerRef.current = document.activeElement as HTMLTableRowElement;
                        setInspectThreat(t);
                      }}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter' || event.key === ' ') {
                          event.preventDefault();
                          inspectTriggerRef.current = event.currentTarget;
                          setInspectThreat(t);
                        }
                      }}
                      tabIndex={0}
                      className={`hover:bg-blue-50/40 cursor-pointer transition-colors ${rowClass}`}
                    >
                      <td className="td whitespace-nowrap">
                        <span className={tagClass}>
                          {t.severity}
                        </span>
                      </td>
                      <td className="td min-w-[220px] font-sans">
                        <div className="font-semibold text-slate-900 text-xs">{t.rule_name}</div>
                        <div className="text-xs text-slate-600 truncate max-w-[320px]" title={t.evidence}>{t.evidence}</div>
                      </td>
                      <td className="td min-w-[150px] font-sans">
                        <div className="font-medium text-slate-800">{t.app_name}</div>
                        <div className="flex items-center gap-1 text-xs text-slate-600">
                          <span className="font-mono">{t.client_ip}</span>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              copyToClipboard(t.client_ip);
                            }}
                            className="text-slate-600 hover:text-blue-700 rounded p-0.5 cursor-pointer"
                            title="Copy IP"
                            aria-label={`Copy IP ${t.client_ip}`}
                          >
                            {copiedIp === t.client_ip ? <Check className="w-3 h-3 text-emerald-700" /> : <Copy className="w-3 h-3" />}
                          </button>
                        </div>
                      </td>
                      <td className="td whitespace-nowrap font-mono">
                        <div className="font-semibold text-slate-800">×{t.hit_count} hits</div>
                        <time className="text-[11px] text-slate-500 block" dateTime={t.last_seen} title={new Date(t.last_seen).toLocaleString()}>
                          Last seen {formatRelativeTime(t.last_seen)}
                        </time>
                      </td>
                      <td className="td whitespace-nowrap font-sans">
                        <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full border text-xs font-semibold capitalize ${getStatusBadge(t.status)}`}>
                          {t.status === 'resolved' ? <CheckCircle2 className="w-3 h-3" aria-hidden="true" /> : t.status === 'open' ? <AlertTriangle className="w-3 h-3" aria-hidden="true" /> : <Clock className="w-3 h-3" aria-hidden="true" />}
                          {t.status.replace('_', ' ')}
                        </span>
                      </td>
                      <td className="td text-right">
                        <span className="inline-flex p-1 text-slate-500" aria-hidden="true">›</span>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Alert History Table (Step 4) */}
      <div className="panel overflow-hidden">
        <div className="panel-head flex items-center justify-between">
          <div>
            <h3 className="text-xs font-semibold text-slate-900 tracking-tight">Alert History</h3>
            <p className="text-[11px] text-slate-500">
              Webhook alert delivery log (3s timeout, up to 2 retries, deduplicated per 30m + 100-hit milestones)
            </p>
          </div>
          <span className="text-xs text-slate-500 font-mono">{alertHistory.length} deliveries</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs font-mono">
            <thead className="bg-slate-50 text-slate-500 border-b border-slate-200">
              <tr>
                <th className="th">Time</th>
                <th className="th">Threat</th>
                <th className="th">Application &amp; IP</th>
                <th className="th">Trigger</th>
                <th className="th">Status (Sent / Failed)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {alertHistory.length === 0 ? (
                <tr>
                  <td colSpan={5} className="td py-8 text-center text-slate-400 font-sans">
                    No webhook alerts dispatched yet.
                  </td>
                </tr>
              ) : (
                alertHistory.map((entry) => {
                  const rowClass =
                    entry.severity === 'critical'
                      ? 'row-crit'
                      : entry.severity === 'high'
                      ? 'row-high'
                      : entry.severity === 'medium'
                      ? 'row-med'
                      : '';
                  const tagClass =
                    entry.severity === 'critical'
                      ? 'tag tag-critical'
                      : entry.severity === 'high'
                      ? 'tag tag-high'
                      : entry.severity === 'medium'
                      ? 'tag tag-medium'
                      : 'tag tag-low';

                  return (
                    <tr key={entry.id} className={`hover:bg-slate-50 transition-colors ${rowClass}`}>
                      <td className="td whitespace-nowrap text-slate-600 tabular-nums">
                        {new Date(entry.timestamp).toLocaleString()}
                      </td>
                      <td className="td font-sans">
                        <div className="flex items-center gap-2">
                          <span className={tagClass}>
                            {entry.severity}
                          </span>
                          <span className="font-semibold text-slate-900">{entry.rule_name}</span>
                        </div>
                      </td>
                      <td className="td text-slate-600 whitespace-nowrap">
                        <span className="font-sans font-medium text-slate-800">{entry.app_name}</span>
                        <span className="text-slate-300 mx-1.5">·</span>
                        <span>{entry.client_ip}</span>
                      </td>
                      <td className="td font-sans whitespace-nowrap">
                        <span className="text-xs px-2 py-0.5 rounded bg-slate-100 text-slate-700 border border-slate-200">
                          {entry.trigger_reason === 'milestone_100_hits'
                            ? '100-Hit Milestone'
                            : entry.trigger_reason === 'test_alert'
                            ? 'Test Alert'
                            : 'New Threat'}
                        </span>
                      </td>
                      <td className="td whitespace-nowrap font-sans">
                        {entry.status === 'sent' ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                            <CheckCircle2 className="w-3 h-3" />
                            <span>sent ({entry.attempts} {entry.attempts === 1 ? 'try' : 'tries'})</span>
                          </span>
                        ) : (
                          <div className="flex items-center gap-2">
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-rose-50 text-rose-700 border border-rose-200">
                              <XCircle className="w-3 h-3" />
                              <span>failed ({entry.attempts} {entry.attempts === 1 ? 'try' : 'tries'})</span>
                            </span>
                            {entry.error && (
                              <span className="text-xs text-rose-600 font-mono truncate max-w-[180px]" title={entry.error}>
                                {entry.error}
                              </span>
                            )}
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Threat Inspection / Status Update Drawer */}
      {inspectThreat && (
        <div className="fixed inset-0 z-50 bg-black/30 flex justify-end">
          <div ref={inspectDialogRef} role="dialog" aria-modal="true" aria-labelledby="threat-dialog-title" tabIndex={-1} className="bg-white h-full w-[480px] border-l border-slate-200 shadow-md flex flex-col">
            {/* Drawer Header */}
            <div className="flex items-center justify-between p-4 border-b border-slate-200">
              <div className="flex items-center gap-2">
                <span className={inspectThreat.severity === 'critical' ? 'tag tag-critical' : inspectThreat.severity === 'high' ? 'tag tag-high' : inspectThreat.severity === 'medium' ? 'tag tag-medium' : 'tag tag-low'}>
                  {inspectThreat.severity}
                </span>
                <div>
                  <h3 id="threat-dialog-title" className="font-semibold text-slate-900 text-sm tracking-tight">{inspectThreat.rule_name}</h3>
                  <div className="flex items-center gap-1.5 text-xs text-slate-500 font-mono">
                    <span>{inspectThreat.id}</span>
                    <span>·</span>
                    <span>{inspectThreat.app_name}</span>
                  </div>
                </div>
              </div>
              <button
                onClick={() => setInspectThreat(null)}
                className="p-1 rounded text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
                aria-label="Close threat details"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Drawer Body */}
            <div className="p-4 flex-1 overflow-y-auto flex flex-col gap-4 text-xs font-sans">
              {/* Summary Section */}
              <section className="space-y-2">
                <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Summary</div>
                {inspectReasoning && (
                  <div className="text-xs text-slate-700 space-y-1">
                    <p className="font-medium text-slate-900">{inspectReasoning.headline}</p>
                    <p className="text-slate-600">{inspectReasoning.whatHappened}</p>
                  </div>
                )}
                <div className="grid grid-cols-2 gap-2 font-mono mt-2">
                  <div className="p-2 rounded bg-slate-50 border border-slate-200">
                    <span className="text-[10px] text-slate-400 uppercase tracking-wider font-sans block">Client IP</span>
                    <span className="text-slate-900 font-bold">{inspectThreat.client_ip}</span>
                  </div>
                  <div className="p-2 rounded bg-slate-50 border border-slate-200">
                    <span className="text-[10px] text-slate-400 uppercase tracking-wider font-sans block">Hits</span>
                    <span className="text-blue-700 font-bold">×{inspectThreat.hit_count}</span>
                  </div>
                  <div className="p-2 rounded bg-slate-50 border border-slate-200">
                    <span className="text-[10px] text-slate-400 uppercase tracking-wider font-sans block">First Seen</span>
                    <span className="text-slate-700">{new Date(inspectThreat.first_seen).toLocaleString()}</span>
                  </div>
                  <div className="p-2 rounded bg-slate-50 border border-slate-200">
                    <span className="text-[10px] text-slate-400 uppercase tracking-wider font-sans block">Last Seen</span>
                    <span className="text-slate-700">{new Date(inspectThreat.last_seen).toLocaleString()}</span>
                  </div>
                </div>
              </section>

              {/* Evidence Section */}
              <section className="space-y-1.5">
                <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Evidence</div>
                <div className="font-mono text-slate-800 bg-slate-50 p-2.5 rounded border border-slate-200 text-xs break-all leading-relaxed">
                  {inspectThreat.evidence}
                </div>
              </section>

              {/* Recommended Action Section */}
              <section className="space-y-1.5">
                <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Recommended action</div>
                {inspectReasoning ? (
                  <ul className="list-disc pl-4 text-slate-600 space-y-1">
                    {inspectReasoning.actions.map((action) => <li key={action}>{action}</li>)}
                  </ul>
                ) : (
                  <p className="text-slate-600">Review threat details and update status accordingly.</p>
                )}
              </section>

              {/* Status Management Actions */}
              {isAdmin ? (
                <div className="pt-3 border-t border-slate-200">
                  <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 mb-2">
                    Update Status
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      disabled={isUpdatingStatus || inspectThreat.status === 'open'}
                      onClick={() => handleUpdateStatus(inspectThreat.id, 'open')}
                      className={`px-3 py-1.5 rounded text-xs font-semibold border transition-all cursor-pointer ${
                        inspectThreat.status === 'open'
                          ? 'bg-rose-600 text-white border-rose-600'
                          : 'bg-white text-slate-700 border-slate-300 hover:bg-rose-50 hover:text-rose-700'
                      }`}
                    >
                      Open
                    </button>

                    <button
                      disabled={isUpdatingStatus || inspectThreat.status === 'acknowledged'}
                      onClick={() => handleUpdateStatus(inspectThreat.id, 'acknowledged')}
                      className={`px-3 py-1.5 rounded text-xs font-semibold border transition-all cursor-pointer ${
                        inspectThreat.status === 'acknowledged'
                          ? 'bg-amber-600 text-white border-amber-600'
                          : 'bg-white text-slate-700 border-slate-300 hover:bg-amber-50 hover:text-amber-700'
                      }`}
                    >
                      Acknowledged
                    </button>

                    <button
                      disabled={isUpdatingStatus || inspectThreat.status === 'resolved'}
                      onClick={() => handleUpdateStatus(inspectThreat.id, 'resolved')}
                      className={`px-3 py-1.5 rounded text-xs font-semibold border transition-all cursor-pointer ${
                        inspectThreat.status === 'resolved'
                          ? 'bg-emerald-600 text-white border-emerald-600'
                          : 'bg-white text-slate-700 border-slate-300 hover:bg-emerald-50 hover:text-emerald-700'
                      }`}
                    >
                      Resolved
                    </button>

                    <button
                      disabled={isUpdatingStatus || inspectThreat.status === 'false_positive'}
                      onClick={() => handleUpdateStatus(inspectThreat.id, 'false_positive')}
                      className={`px-3 py-1.5 rounded text-xs font-semibold border transition-all cursor-pointer ${
                        inspectThreat.status === 'false_positive'
                          ? 'bg-slate-700 text-white border-slate-700'
                          : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-100 hover:text-slate-900'
                      }`}
                    >
                      False Positive
                    </button>
                  </div>
                </div>
              ) : (
                <div className="pt-2 border-t border-slate-200">
                  <span className="text-xs text-slate-400 italic">Status updates require admin role.</span>
                </div>
              )}
            </div>

            {/* Drawer Footer */}
            <div className="p-3 bg-slate-50 border-t border-slate-200 flex justify-end">
              <button
                onClick={() => setInspectThreat(null)}
                className="btn btn-secondary text-xs"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
