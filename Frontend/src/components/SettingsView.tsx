import React, { useState, useEffect, useCallback } from 'react';
import {
  Sliders,
  Shield,
  Bell,
  Webhook,
  Send,
  Check,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Clock,
  Info,
  Database,
  Trash2,
  Flame,
  Sparkles,
  Users,
  UserCheck,
  UserX,
} from 'lucide-react';
import { PlatformSettings, ThreatSeverity, AlertHistoryEntry, UserAccount } from '../types/threats';
import { apiFetch } from '../lib/api';

interface SettingsViewProps {
  authToken?: string | null;
  currentRole?: string | null;
  onSaved?: (settings: PlatformSettings) => void;
  onAlertSent?: () => void;
  selectedAppId?: string;
  onSimulateAttack?: () => Promise<void>;
  onTestingDataGenerated?: () => void;
  onPendingUsersCountChange?: (count: number) => void;
}

export function SettingsView({
  authToken,
  currentRole = 'admin',
  onSaved,
  onAlertSent,
  selectedAppId = 'ALL',
  onSimulateAttack,
  onTestingDataGenerated,
  onPendingUsersCountChange,
}: SettingsViewProps) {
  const isAdmin = currentRole === 'admin';
  const [users, setUsers] = useState<UserAccount[]>([]);
  const [usersLoading, setUsersLoading] = useState(false);
  const [userActionError, setUserActionError] = useState<string | null>(null);
  const [userUpdatingId, setUserUpdatingId] = useState<string | null>(null);

  const fetchUsers = useCallback(async () => {
    if (!isAdmin || !authToken) return;
    setUsersLoading(true);
    try {
      const res = await apiFetch('/api/auth/users');
      if (res.ok) {
        const data = await res.json();
        const userList: UserAccount[] = data.users || [];
        setUsers(userList);
        const pendingCount = userList.filter((u) => u.status === 'pending').length;
        onPendingUsersCountChange?.(pendingCount);
      }
    } catch (err) {
      console.error('Failed to load users:', err);
    } finally {
      setUsersLoading(false);
    }
  }, [isAdmin, authToken, onPendingUsersCountChange]);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  const handleUpdateUserStatus = async (userId: string, newStatus: 'active' | 'disabled') => {
    setUserUpdatingId(userId);
    setUserActionError(null);
    try {
      const res = await apiFetch(`/api/auth/users/${userId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      });
      if (res.ok) {
        await fetchUsers();
      } else {
        const data = await res.json().catch(() => ({}));
        setUserActionError(data.error || 'Failed to update user status.');
      }
    } catch (err: any) {
      setUserActionError(err?.message || 'Failed to update user status.');
    } finally {
      setUserUpdatingId(null);
    }
  };
  const [settings, setSettings] = useState<PlatformSettings>({
    mode: 'shadow',
    notify_on_high_critical: true,
    alert_webhook_url: '',
    alert_min_severity: 'high',
    alert_dedup_minutes: 30,
    raw_traffic_retention_days: 30,
    feature_retention_days: 90,
  });
  const [isRunningCleanup, setIsRunningCleanup] = useState(false);
  const [cleanupMessage, setCleanupMessage] = useState<string | null>(null);
  const [envWebhookConfigured, setEnvWebhookConfigured] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [isTestingAlert, setIsTestingAlert] = useState(false);
  const [testAlertResult, setTestAlertResult] = useState<{
    success: boolean;
    message: string;
    entry?: AlertHistoryEntry;
  } | null>(null);
  const [isGeneratingSampleData, setIsGeneratingSampleData] = useState(false);
  const [testingToolsMessage, setTestingToolsMessage] = useState<string | null>(null);

  useEffect(() => {
    async function loadSettings() {
      try {
        const res = await apiFetch('/api/threats/settings');
        if (res.ok) {
          const data = await res.json();
          if (data.settings) {
            setSettings({
              mode: data.settings.mode || 'shadow',
              notify_on_high_critical: data.settings.notify_on_high_critical !== false,
              alert_webhook_url: data.settings.alert_webhook_url || '',
              alert_min_severity: data.settings.alert_min_severity || 'high',
              alert_dedup_minutes:
                data.settings.alert_dedup_minutes !== undefined
                  ? data.settings.alert_dedup_minutes
                  : 30,
              raw_traffic_retention_days:
                data.settings.raw_traffic_retention_days !== undefined
                  ? data.settings.raw_traffic_retention_days
                  : 30,
              feature_retention_days:
                data.settings.feature_retention_days !== undefined
                  ? data.settings.feature_retention_days
                  : 90,
            });
          }
          setEnvWebhookConfigured(Boolean(data.env_webhook_configured));
        }
      } catch (err) {
        console.error('Failed to load settings:', err);
      }
    }
    loadSettings();
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setSaveMessage(null);
    try {
      const res = await apiFetch('/api/threats/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings),
      });
      if (res.ok) {
        const data = await res.json();
        setSettings(data.settings);
        setSaveMessage('Settings saved successfully.');
        if (onSaved) onSaved(data.settings);
        setTimeout(() => setSaveMessage(null), 3000);
      }
    } catch (err) {
      console.error('Failed to save settings:', err);
    } finally {
      setIsSaving(false);
    }
  };

  const handleSendTestAlert = async () => {
    setIsTestingAlert(true);
    setTestAlertResult(null);
    try {
      const res = await apiFetch('/api/threats/alerts/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          webhook_url: settings.alert_webhook_url,
        }),
      });
      const data = await res.json();
      setTestAlertResult({
        success: Boolean(data.success),
        message: data.message || (data.success ? 'Test alert sent!' : 'Test alert failed.'),
        entry: data.entry,
      });
      if (onAlertSent) onAlertSent();
    } catch (err: any) {
      setTestAlertResult({
        success: false,
        message: err?.message || 'Failed to send test alert.',
      });
    } finally {
      setIsTestingAlert(false);
    }
  };

  const handleRunCleanupNow = async () => {
    if (!authToken) return;
    setIsRunningCleanup(true);
    setCleanupMessage(null);
    try {
      const res = await apiFetch('/api/v1/export/cleanup-now', {
        method: 'POST',
        headers: { Authorization: `Bearer ${authToken}` },
      });
      const data = await res.json();
      if (res.ok) {
        setCleanupMessage(data.message || 'Retention cleanup completed.');
      } else {
        setCleanupMessage(data.error || 'Cleanup failed.');
      }
    } catch (err: any) {
      setCleanupMessage(err?.message || 'Cleanup failed.');
    } finally {
      setIsRunningCleanup(false);
    }
  };

  const handleGenerateSampleData = async () => {
    if (!authToken) return;
    setIsGeneratingSampleData(true);
    setTestingToolsMessage(null);
    try {
      const res = await apiFetch('/api/v1/export/simulate-training-data', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify({ app_id: selectedAppId }),
      });
      const data = await res.json();
      if (!res.ok) {
        setTestingToolsMessage(data.error || 'Failed to generate sample training data.');
        return;
      }
      setTestingToolsMessage(data.message || 'Generated sample training data.');
      onTestingDataGenerated?.();
    } catch (err: any) {
      setTestingToolsMessage(err?.message || 'Unable to generate sample training data.');
    } finally {
      setIsGeneratingSampleData(false);
    }
  };

  const [activeSection, setActiveSection] = useState<'users' | 'alerts' | 'mode' | 'testing' | 'retention'>(isAdmin ? 'users' : 'alerts');

  return (
    <form onSubmit={handleSave} className="flex flex-col gap-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="page-title text-slate-900">Settings</h1>
          <p className="page-sub mt-0.5">
            Configure global threat detection mode, alerting, and data retention.
          </p>
        </div>

        <div className="flex items-center gap-3">
          {saveMessage && (
            <span className="text-xs font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2.5 py-1 rounded flex items-center gap-1.5">
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>{saveMessage}</span>
            </span>
          )}
          <button
            type="submit"
            disabled={isSaving || !isAdmin}
            className="btn btn-primary text-xs"
            title={!isAdmin ? 'Read-only access' : undefined}
          >
            <Check className="w-3.5 h-3.5" />
            <span>{isSaving ? 'Saving...' : 'Save Settings'}</span>
          </button>
        </div>
      </div>

      <div className="flex flex-col md:flex-row gap-4 items-start">
        {/* Left Sub-menu */}
        <div className="w-full md:w-56 shrink-0 panel p-1.5 flex flex-col gap-1">
          {isAdmin && (
            <button
              type="button"
              onClick={() => setActiveSection('users')}
              className={activeSection === 'users' ? 'nav-item-active' : 'nav-item'}
            >
              <span>User Accounts</span>
            </button>
          )}
          <button
            type="button"
            onClick={() => setActiveSection('alerts')}
            className={activeSection === 'alerts' ? 'nav-item-active' : 'nav-item'}
          >
            <span>Alerts &amp; Webhook</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveSection('mode')}
            className={activeSection === 'mode' ? 'nav-item-active' : 'nav-item'}
          >
            <span>Detection Mode</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveSection('testing')}
            className={activeSection === 'testing' ? 'nav-item-active' : 'nav-item'}
          >
            <span>Testing Tools</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveSection('retention')}
            className={activeSection === 'retention' ? 'nav-item-active' : 'nav-item'}
          >
            <span>Data Retention</span>
          </button>
        </div>

        {/* Right Active Section */}
        <div className="flex-1 w-full min-w-0">
          {/* SECTION: USER ACCOUNTS */}
          {activeSection === 'users' && isAdmin && (
            <div className="panel overflow-hidden">
              <div className="panel-head flex items-center justify-between">
                <div>
                  <h3 className="text-xs font-semibold text-slate-900 tracking-tight">User Accounts</h3>
                  <p className="text-[11px] text-slate-500">
                    Manage registered users and pending account approvals
                  </p>
                </div>
                <span className="text-xs font-mono text-slate-500">
                  {users.length} {users.length === 1 ? 'user' : 'users'}
                </span>
              </div>

              <div className="p-4 flex flex-col gap-4 text-xs">
                {userActionError && (
                  <div className="p-2.5 rounded bg-rose-50 border border-rose-200 text-rose-700 flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 shrink-0" />
                    <span>{userActionError}</span>
                  </div>
                )}

                {usersLoading ? (
                  <div className="py-8 text-center text-slate-400">Loading user accounts...</div>
                ) : users.length === 0 ? (
                  <div className="py-8 text-center text-slate-400">
                    No registered member accounts found.
                  </div>
                ) : (
                  <div className="overflow-x-auto border border-slate-200 rounded">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold">
                          <th className="th">Name</th>
                          <th className="th">Email</th>
                          <th className="th">Role</th>
                          <th className="th">Status</th>
                          <th className="th">Created</th>
                          <th className="th">Last Login</th>
                          <th className="th text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {users.map((user) => {
                          const isUpdating = userUpdatingId === user.id;
                          return (
                            <tr key={user.id} className="hover:bg-slate-50/50">
                              <td className="td font-medium text-slate-900">{user.full_name}</td>
                              <td className="td font-mono text-slate-600">{user.email}</td>
                              <td className="td font-mono">
                                <span className="capitalize px-1.5 py-0.5 rounded text-[11px] bg-slate-100 text-slate-700">
                                  {user.role}
                                </span>
                              </td>
                              <td className="td">
                                <span
                                  className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold ${
                                    user.status === 'active'
                                      ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                      : user.status === 'pending'
                                      ? 'bg-amber-50 text-amber-700 border border-amber-200'
                                      : 'bg-rose-50 text-rose-700 border border-rose-200'
                                  }`}
                                >
                                  {user.status}
                                </span>
                              </td>
                              <td className="td text-slate-500 font-mono text-[11px]">
                                {new Date(user.created_at).toLocaleDateString()}
                              </td>
                              <td className="td text-slate-500 font-mono text-[11px]">
                                {user.last_login_at
                                  ? new Date(user.last_login_at).toLocaleDateString()
                                  : 'Never'}
                              </td>
                              <td className="td text-right">
                                {user.status === 'pending' && (
                                  <button
                                    type="button"
                                    disabled={isUpdating}
                                    onClick={() => handleUpdateUserStatus(user.id, 'active')}
                                    className="px-2 py-1 text-xs font-semibold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded transition-colors disabled:opacity-50 cursor-pointer"
                                  >
                                    {isUpdating ? 'Approving...' : 'Approve'}
                                  </button>
                                )}
                                {user.status === 'active' && (
                                  <button
                                    type="button"
                                    disabled={isUpdating}
                                    onClick={() => handleUpdateUserStatus(user.id, 'disabled')}
                                    className="px-2 py-1 text-xs font-semibold text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 rounded transition-colors disabled:opacity-50 cursor-pointer"
                                  >
                                    {isUpdating ? 'Disabling...' : 'Disable'}
                                  </button>
                                )}
                                {user.status === 'disabled' && (
                                  <button
                                    type="button"
                                    disabled={isUpdating}
                                    onClick={() => handleUpdateUserStatus(user.id, 'active')}
                                    className="px-2 py-1 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 border border-slate-300 rounded transition-colors disabled:opacity-50 cursor-pointer"
                                  >
                                    {isUpdating ? 'Enabling...' : 'Re-enable'}
                                  </button>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* SECTION: ALERTS CONFIGURATION */}
          {activeSection === 'alerts' && (
            <div className="panel overflow-hidden">
              <div className="panel-head flex items-center justify-between">
                <div>
                  <h3 className="text-xs font-semibold text-slate-900 tracking-tight">Alerts &amp; Webhook Notifications</h3>
                  <p className="text-[11px] text-slate-500">
                    Dispatches background alerts (3s timeout, up to 2 retries) for new threats &amp; 100-hit milestones
                  </p>
                </div>
              </div>

              <div className="p-4 flex flex-col gap-4 text-xs">
                {/* Webhook URL */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="font-semibold text-slate-800">
                      Webhook URL (Slack, Discord, Telegram, or any HTTP endpoint)
                    </label>
                    {envWebhookConfigured && (
                      <span className="text-xs font-mono font-medium text-blue-700 bg-blue-50 px-2 py-0.5 rounded border border-blue-200">
                        ALERT_WEBHOOK_URL env detected
                      </span>
                    )}
                  </div>
                  <div className="flex flex-col sm:flex-row gap-2">
                    <input
                      type="url"
                      value={settings.alert_webhook_url || ''}
                      onChange={(e) => setSettings((prev) => ({ ...prev, alert_webhook_url: e.target.value }))}
                      placeholder="https://hooks.slack.com/services/... or https://discord.com/api/webhooks/..."
                      className="input flex-1 font-mono text-xs"
                    />
                    <button
                      type="button"
                      onClick={handleSendTestAlert}
                      disabled={isTestingAlert}
                      className="btn btn-secondary text-xs"
                    >
                      <Send className="w-3.5 h-3.5" />
                      <span>{isTestingAlert ? 'Sending...' : 'Send test alert'}</span>
                    </button>
                  </div>
                  <p className="text-[11px] text-slate-500 mt-1.5">
                    Configured from this dashboard or via the <code className="font-mono text-slate-700">ALERT_WEBHOOK_URL</code> environment variable. Alert payloads never include secrets, query parameter values, or request bodies.
                  </p>

                  {testAlertResult && (
                    <div
                      className={`mt-3 p-2.5 rounded border text-xs flex items-start gap-2 ${
                        testAlertResult.success
                          ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                          : 'bg-rose-50 border-rose-200 text-rose-800'
                      }`}
                    >
                      {testAlertResult.success ? (
                        <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                      ) : (
                        <XCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                      )}
                      <div>
                        <div className="font-semibold">{testAlertResult.message}</div>
                        {testAlertResult.entry && (
                          <div className="text-xs opacity-80 font-mono mt-0.5">
                            Attempts: {testAlertResult.entry.attempts} · Status: {testAlertResult.entry.status}
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2 border-t border-slate-100">
                  {/* Minimum Severity */}
                  <div>
                    <label className="block font-semibold text-slate-800 mb-1">
                      Minimum Severity to Alert
                    </label>
                    <select
                      value={settings.alert_min_severity || 'high'}
                      onChange={(e) =>
                        setSettings((prev) => ({
                          ...prev,
                          alert_min_severity: e.target.value as ThreatSeverity,
                        }))
                      }
                      className="input text-xs cursor-pointer font-medium"
                    >
                      <option value="critical">Critical only</option>
                      <option value="high">High &amp; Critical (Default)</option>
                      <option value="medium">Medium, High &amp; Critical</option>
                      <option value="low">All Severities (Low and above)</option>
                    </select>
                    <p className="text-[11px] text-slate-500 mt-1">
                      Only newly detected threats meeting or exceeding this severity trigger a webhook alert.
                    </p>
                  </div>

                  {/* Deduplication Window */}
                  <div>
                    <label className="block font-semibold text-slate-800 mb-1">
                      Alert De-duplication Window (Minutes)
                    </label>
                    <div className="flex items-center gap-2">
                      <Clock className="w-4 h-4 text-slate-400 shrink-0" />
                      <input
                        type="number"
                        min={0}
                        max={1440}
                        value={settings.alert_dedup_minutes ?? 30}
                        onChange={(e) =>
                          setSettings((prev) => ({
                            ...prev,
                            alert_dedup_minutes: Math.max(0, parseInt(e.target.value || '0', 10)),
                          }))
                        }
                        className="input w-28 text-xs font-mono font-bold"
                      />
                      <span className="text-xs text-slate-500">minutes per attacker + rule</span>
                    </div>
                    <p className="text-[11px] text-slate-500 mt-1">
                      Default: 30 minutes. Later hits only increment the hit count, with 1 extra alert sent at 100 hits.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* SECTION: DETECTION MODE */}
          {activeSection === 'mode' && (
            <div className="panel overflow-hidden">
              <div className="panel-head flex items-center justify-between">
                <div>
                  <h3 className="text-xs font-semibold text-slate-900 tracking-tight">Detection Operating Mode</h3>
                  <p className="text-[11px] text-slate-600">Monitoring only (not blocking traffic)</p>
                </div>
              </div>

              <div className="p-4 flex flex-col gap-4 text-xs">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <label
                    onClick={() => setSettings((prev) => ({ ...prev, mode: 'shadow' }))}
                    className={`flex items-start gap-3 p-3 rounded border cursor-pointer transition-all ${
                      settings.mode === 'shadow'
                        ? 'border-blue-500 bg-blue-50/50'
                        : 'border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    <input
                      type="radio"
                      name="operating_mode_view"
                      checked={settings.mode === 'shadow'}
                      onChange={() => setSettings((prev) => ({ ...prev, mode: 'shadow' }))}
                      className="mt-0.5 text-blue-600"
                    />
                    <div>
                      <div className="font-semibold text-slate-900 flex items-center gap-1.5">
                        <span>Monitoring only (not blocking traffic)</span>
                        <span className="text-[10px] font-mono font-medium text-emerald-700 bg-emerald-50 px-1.5 py-0.2 rounded border border-emerald-200">
                          RECOMMENDED
                        </span>
                      </div>
                      <p className="text-slate-500 text-xs mt-1 leading-relaxed">
                        Evaluates requests in background. Records threat telemetry without ever blocking or delaying user requests.
                      </p>
                    </div>
                  </label>

                  <label
                    onClick={() => setSettings((prev) => ({ ...prev, mode: 'alert_only' }))}
                    className={`flex items-start gap-3 p-3 rounded border cursor-pointer transition-all ${
                      settings.mode === 'alert_only'
                        ? 'border-amber-500 bg-amber-50/50'
                        : 'border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    <input
                      type="radio"
                      name="operating_mode_view"
                      checked={settings.mode === 'alert_only'}
                      onChange={() => setSettings((prev) => ({ ...prev, mode: 'alert_only' }))}
                      className="mt-0.5 text-amber-600"
                    />
                    <div>
                      <div className="font-semibold text-slate-900">Alert-Only Mode</div>
                      <p className="text-slate-500 text-xs mt-1 leading-relaxed">
                        Non-blocking evaluation with high-visibility alert dispatch for SOC responders.
                      </p>
                    </div>
                  </label>
                </div>

                <div className="pt-3 border-t border-slate-100">
                  <label className="flex items-center justify-between cursor-pointer">
                    <div className="flex items-center gap-2">
                      <Bell className="w-4 h-4 text-slate-500" />
                      <div>
                        <span className="font-semibold text-slate-800 text-xs block">Dashboard Live Toast Notifications</span>
                        <span className="text-xs text-slate-500">Show top-right toast alerts for High &amp; Critical threats</span>
                      </div>
                    </div>
                    <input
                      type="checkbox"
                      checked={settings.notify_on_high_critical}
                      onChange={(e) =>
                        setSettings((prev) => ({ ...prev, notify_on_high_critical: e.target.checked }))
                      }
                      className="w-4 h-4 text-blue-600 rounded border-slate-300 cursor-pointer"
                    />
                  </label>
                </div>
              </div>
            </div>
          )}

          {/* SECTION: TESTING TOOLS */}
          {activeSection === 'testing' && (
            <div className="panel p-4 flex flex-col gap-3 text-xs">
              <div>
                <h3 className="text-xs font-semibold text-slate-900 tracking-tight">Testing Tools</h3>
                <p className="text-xs text-amber-800 font-medium mt-0.5">
                  This sends FAKE traffic for testing. Do not use this if you only want real data.
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2.5 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => void onSimulateAttack?.()}
                  disabled={!onSimulateAttack || !isAdmin}
                  className="btn btn-danger text-xs disabled:opacity-50"
                  title={!isAdmin ? 'Admin access required' : undefined}
                >
                  <Flame className="w-3.5 h-3.5" />
                  <span>Attack Simulator</span>
                </button>
                <button
                  type="button"
                  onClick={() => void handleGenerateSampleData()}
                  disabled={isGeneratingSampleData || !authToken || !isAdmin}
                  className="btn btn-secondary text-xs disabled:opacity-50"
                  title={!isAdmin ? 'Admin access required' : undefined}
                >
                  <Sparkles className="w-3.5 h-3.5 text-blue-600" />
                  <span>{isGeneratingSampleData ? 'Generating Samples...' : 'Generate sample training data'}</span>
                </button>
                {testingToolsMessage && (
                  <span className="text-xs font-medium text-slate-600">{testingToolsMessage}</span>
                )}
              </div>
            </div>
          )}

          {/* SECTION: DATA RETENTION */}
          {activeSection === 'retention' && (
            <div className="panel overflow-hidden">
              <div className="panel-head flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h3 className="text-xs font-semibold text-slate-900 tracking-tight">Data Retention &amp; Daily Clean-up</h3>
                  <p className="text-[11px] text-slate-500">
                    Automatic daily background job prunes expired records from <code className="font-mono">traffic.jsonl</code> and <code className="font-mono">features.jsonl</code>
                  </p>
                </div>

                <button
                  type="button"
                  onClick={handleRunCleanupNow}
                  disabled={isRunningCleanup || !authToken || !isAdmin}
                  className="btn btn-secondary text-xs disabled:opacity-50"
                  title={!isAdmin ? 'Admin access required' : undefined}
                >
                  <Trash2 className="w-3.5 h-3.5 text-slate-500" />
                  <span>{isRunningCleanup ? 'Cleaning...' : 'Run cleanup now'}</span>
                </button>
              </div>

              <div className="p-4 flex flex-col gap-4 text-xs">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block font-semibold text-slate-800 mb-1">
                      Raw Traffic Retention (Days)
                    </label>
                    <input
                      type="number"
                      min={1}
                      max={3650}
                      value={settings.raw_traffic_retention_days ?? 30}
                      onChange={(e) =>
                        setSettings((prev) => ({
                          ...prev,
                          raw_traffic_retention_days: Math.max(1, parseInt(e.target.value || '30', 10)),
                        }))
                      }
                      className="input w-32 font-mono font-bold text-xs"
                    />
                    <p className="text-[11px] text-slate-500 mt-1">
                      Days to keep raw request metadata in <code className="font-mono">traffic.jsonl</code> (default: 30 days).
                    </p>
                  </div>

                  <div>
                    <label className="block font-semibold text-slate-800 mb-1">
                      ML Feature Rows Retention (Days)
                    </label>
                    <input
                      type="number"
                      min={1}
                      max={3650}
                      value={settings.feature_retention_days ?? 90}
                      onChange={(e) =>
                        setSettings((prev) => ({
                          ...prev,
                          feature_retention_days: Math.max(1, parseInt(e.target.value || '90', 10)),
                        }))
                      }
                      className="input w-32 font-mono font-bold text-xs"
                    />
                    <p className="text-[11px] text-slate-500 mt-1">
                      Days to keep 1m/5m/1h aggregated ML feature rows in <code className="font-mono">features.jsonl</code> (default: 90 days).
                    </p>
                  </div>
                </div>

                {cleanupMessage && (
                  <div className="p-2.5 rounded bg-blue-50 border border-blue-200 text-blue-900 text-xs font-medium">
                    {cleanupMessage}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </form>
  );
}
