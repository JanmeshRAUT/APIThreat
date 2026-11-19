import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Shield,
  RefreshCw,
  Download,
  Search,
  ExternalLink,
  Copy,
  Check,
  Server,
  Zap,
  Lock,
  LogOut,
  AlertTriangle,
  Clock,
  Activity,
  Globe,
  Layers,
  X,
  User,
  Key,
  Plus,
  Trash2,
  RotateCw,
  Power,
  Code2,
  LayoutDashboard,
  CheckCircle2,
  FileText,
  ChevronDown,
  ShieldAlert,
  SlidersHorizontal,
  Flame,
  Sliders,
  Database,
  Eye,
  EyeOff,
} from 'lucide-react';
import { ThreatsView } from './components/ThreatsView';
import { RulesView } from './components/RulesView';
import { SettingsView } from './components/SettingsView';
import { SettingsModal } from './components/SettingsModal';
import { MlDataView } from './components/MlDataView';
import { ToastNotifications } from './components/ToastNotifications';
import { ApplicationsView } from './components/ApplicationsView';
import { ConnectGuideView } from './components/ConnectGuideView';
import { DashboardView } from './components/DashboardView';
import { Logo } from './components/Logo';
import { GuideLanguage } from './data/connectGuideSnippets';
import { RegisteredApp } from './components/ApplicationsView';
import { DashboardStats, TrafficRecord } from './components/DashboardView';
import { ThreatRecord, PlatformSettings, OpenThreatsSummary } from './types/threats';
import { apiFetch } from './lib/api';
import { AuthLayout } from './components/auth/AuthLayout';
import { LoginPage } from './components/auth/LoginPage';
import { RegisterPage } from './components/auth/RegisterPage';

export default function App() {
  // Navigation: 'dashboard' | 'threats' | 'rules' | 'applications' | 'guide' | 'ml' | 'settings'
  const [activeTab, setActiveTab] = useState<'dashboard' | 'threats' | 'rules' | 'applications' | 'guide' | 'ml' | 'settings'>(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const tab = params.get('tab');
      if (tab === 'threats' || tab === 'rules' || tab === 'applications' || tab === 'guide' || tab === 'ml' || tab === 'settings') {
        return tab;
      }
    }
    return 'dashboard';
  });

  const [initialThreatId, setInitialThreatId] = useState<string | null>(() => {
    if (typeof window !== 'undefined') {
      return new URLSearchParams(window.location.search).get('threat_id');
    }
    return null;
  });

  // Threat Detection & Simulator State
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [platformSettings, setPlatformSettings] = useState<PlatformSettings>({ mode: 'shadow', notify_on_high_critical: true });
  const [toasts, setToasts] = useState<ThreatRecord[]>([]);
  const [isSimulatingAttack, setIsSimulatingAttack] = useState(false);
  const [attackResultModal, setAttackResultModal] = useState<{ count: number; rules: string[] } | null>(null);

  // Authentication State
  const [authToken, setAuthToken] = useState<string | null>(() => localStorage.getItem('gatekeeper_admin_token'));
  const [currentUser, setCurrentUser] = useState<string | null>(null);
  const [currentRole, setCurrentRole] = useState<string | null>(null);
  const [currentFullName, setCurrentFullName] = useState<string | null>(null);
  const [weakAdminPassword, setWeakAdminPassword] = useState<boolean>(false);
  const [loginUsername, setLoginUsername] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [loginError, setLoginError] = useState<string | null>(null);
  const [loginNotice, setLoginNotice] = useState<{ type: 'pending' | 'disabled' | 'success'; message: string } | null>(null);
  const [loginSuccessPrefill, setLoginSuccessPrefill] = useState<string | undefined>(undefined);
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [authView, setAuthView] = useState<'login' | 'register'>('login');
  const [registrationMode, setRegistrationMode] = useState<'open' | 'approval' | 'closed'>('approval');
  const [pendingUsersCount, setPendingUsersCount] = useState<number>(0);

  // Applications & Multi-Tenant State
  const [apps, setApps] = useState<RegisteredApp[]>([]);
  const [selectedAppId, setSelectedAppId] = useState<string>('ALL');
  const [newKeyModal, setNewKeyModal] = useState<{ appId: string; appName: string; plainKey: string } | null>(null);
  const [isKeyVisible, setIsKeyVisible] = useState(true);
  const [isRegisteringApp, setIsRegisteringApp] = useState(false);
  const [newAppName, setNewAppName] = useState('');
  const [newAppEnv, setNewAppEnv] = useState<'dev' | 'prod'>('dev');

  // Telemetry Data State
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [records, setRecords] = useState<TrafficRecord[]>([]);

  // Auto Refresh State (5 seconds)
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [secondsUntilRefresh, setSecondsUntilRefresh] = useState(5);

  // Filter States for Live Table
  const [methodFilter, setMethodFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [searchQuery, setSearchQuery] = useState('');

  // Inspection Drawer
  const [selectedRecord, setSelectedRecord] = useState<TrafficRecord | null>(null);
  const [copiedId, setCopiedId] = useState(false);
  const [copiedKey, setCopiedKey] = useState(false);

  // Connect Guide state
  const [guideLanguage, setGuideLanguage] = useState<'node' | 'python' | 'java' | 'php'>('node');
  const [guideSelectedAppId, setGuideSelectedAppId] = useState<string>('');
  const [guideApiKeys, setGuideApiKeys] = useState<Record<string, string>>({});
  const [connectionTest, setConnectionTest] = useState<{
    appId: string;
    status: 'testing' | 'connected' | 'not_connected';
    message?: string;
  } | null>(null);
  const [connectionTestKey, setConnectionTestKey] = useState('');

  // Host URL for snippets
  const platformUrl = import.meta.env.VITE_API_URL || 'https://apithreat.onrender.com';

  // Fetch registration mode config on load
  useEffect(() => {
    async function fetchAuthConfig() {
      try {
        const res = await apiFetch('/api/auth/config');
        if (res.ok) {
          const data = await res.json();
          if (data.registration) {
            setRegistrationMode(data.registration);
          }
        }
      } catch {
        // Default to approval on error
      }
    }
    fetchAuthConfig();
  }, []);

  // Verify auth session
  useEffect(() => {
    async function verifyAuth() {
      if (!authToken) return;
      try {
        const res = await apiFetch('/api/auth/check', {
          headers: { Authorization: `Bearer ${authToken}` },
        });
        const data = await res.json();
        if (data.authenticated) {
          setCurrentUser(data.user?.username || 'admin');
          setCurrentRole(data.user?.role || 'admin');
          setCurrentFullName(data.user?.full_name || null);
          setWeakAdminPassword(Boolean(data.weak_admin_password));
        } else {
          localStorage.removeItem('gatekeeper_admin_token');
          setAuthToken(null);
          setCurrentUser(null);
          setCurrentRole(null);
          setCurrentFullName(null);
        }
      } catch {
      }
    }
    verifyAuth();
  }, [authToken]);

  // Fetch list of registered applications
  const fetchApps = useCallback(async () => {
    try {
      const res = await apiFetch('/api/apps');
      if (res.ok) {
        const data = await res.json();
        setApps(data.apps || []);
        if (!guideSelectedAppId && data.apps?.length > 0) {
          setGuideSelectedAppId(data.apps[0].id);
        }
      }
    } catch (err) {
      console.error('Failed to fetch apps:', err);
    }
  }, [guideSelectedAppId]);

  // Fetch Dashboard Stats from GET /api/stats?app_id=...
  const fetchStats = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (selectedAppId && selectedAppId !== 'ALL') {
        params.append('app_id', selectedAppId);
      }
      const res = await apiFetch(`/api/stats?${params.toString()}`);
      if (res.ok) {
        const data: DashboardStats = await res.json();
        setStats(data);
      }
    } catch (err) {
      console.error('Failed to fetch /api/stats:', err);
    }
  }, [selectedAppId]);

  // Fetch Latest 50 Requests with filters & app_id
  const fetchRecords = useCallback(async () => {
    try {
      const params = new URLSearchParams({ limit: '50' });
      if (selectedAppId && selectedAppId !== 'ALL') params.append('app_id', selectedAppId);
      if (methodFilter !== 'ALL') params.append('method', methodFilter);
      if (statusFilter !== 'ALL') params.append('status', statusFilter);
      if (searchQuery.trim()) params.append('search', searchQuery.trim());

      const res = await apiFetch(`/api/monitor/records?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setRecords(data.records || []);
      }
    } catch (err) {
      console.error('Failed to fetch records:', err);
    }
  }, [selectedAppId, methodFilter, statusFilter, searchQuery]);

  // Fetch Platform Settings (Shadow mode)
  const fetchSettings = useCallback(async () => {
    try {
      const res = await apiFetch('/api/threats/settings');
      if (res.ok) {
        const data = await res.json();
        if (data.settings) setPlatformSettings(data.settings);
      }
    } catch (err) {
      console.error('Failed to load settings:', err);
    }
  }, []);

  // Attack Simulator: Fires 5 sample attacks
  const handleSimulateAttack = async () => {
    setIsSimulatingAttack(true);
    try {
      const targetAppId = selectedAppId !== 'ALL' ? selectedAppId : undefined;
      const res = await apiFetch('/api/threats/simulate-attack', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ app_id: targetAppId }),
      });
      if (res.ok) {
        const data = await res.json();
        setAttackResultModal({
          count: data.rules_fired_count || 0,
          rules: data.fired_rules || [],
        });

        // Trigger toasts for high/critical threats if enabled
        if (platformSettings.notify_on_high_critical) {
          const threatsRes = await apiFetch('/api/threats');
          if (threatsRes.ok) {
            const threatsData = await threatsRes.json();
            const alerts: ThreatRecord[] = (threatsData.threats || [])
              .filter((t: ThreatRecord) => t.severity === 'critical' || t.severity === 'high')
              .slice(0, 3);
            setToasts(alerts);
          }
        }

        fetchStats();
        fetchRecords();
      }
    } catch (err) {
      console.error('Failed to run attack simulator:', err);
    } finally {
      setIsSimulatingAttack(false);
    }
  };

  // Initial load
  useEffect(() => {
    if (authToken) {
      fetchApps();
      fetchStats();
      fetchRecords();
      fetchSettings();
    }
  }, [authToken, fetchApps, fetchStats, fetchRecords, fetchSettings]);

  // 5-Second Auto Refresh Timer
  useEffect(() => {
    if (!autoRefresh || !authToken) return;

    const interval = setInterval(() => {
      setSecondsUntilRefresh((prev) => {
        if (prev <= 1) {
          fetchStats();
          fetchRecords();
          fetchApps();
          return 5;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [autoRefresh, authToken, fetchStats, fetchRecords, fetchApps]);

  // Handle Login
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError(null);
    setLoginNotice(null);
    setIsLoggingIn(true);

    try {
      const res = await apiFetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: loginUsername.trim(),
          password: loginPassword,
        }),
      });

      const data = await res.json();
      if (res.ok && data.success && data.token) {
        localStorage.setItem('gatekeeper_admin_token', data.token);
        setAuthToken(data.token);
        setCurrentUser(data.user?.username || loginUsername);
        setCurrentRole(data.user?.role || 'admin');
        setCurrentFullName(data.user?.full_name || null);
        setWeakAdminPassword(Boolean(data.weak_admin_password));
      } else if (res.status === 403) {
        if (data.code === 'pending') {
          setLoginNotice({
            type: 'pending',
            message: 'Your account is waiting for administrator approval.',
          });
        } else if (data.code === 'disabled') {
          setLoginNotice({
            type: 'disabled',
            message: data.error || 'Your account has been disabled. Contact an administrator.',
          });
        } else {
          setLoginError(data.error || 'Access forbidden.');
        }
      } else {
        setLoginError(data.error || 'Invalid credentials.');
      }
    } catch (err: any) {
      setLoginError(err.message || 'Unable to connect to authentication server.');
    } finally {
      setIsLoggingIn(false);
    }
  };

  // Handle Logout
  const handleLogout = async () => {
    try {
      if (authToken) {
        await apiFetch('/api/auth/logout', {
          method: 'POST',
          headers: { Authorization: `Bearer ${authToken}` },
        });
      }
    } catch {
    }
    localStorage.removeItem('gatekeeper_admin_token');
    setAuthToken(null);
    setCurrentUser(null);
    setCurrentRole(null);
    setCurrentFullName(null);
  };

  // Register New App
  const handleRegisterApp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newAppName.trim()) return;

    try {
      const res = await apiFetch('/api/apps', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newAppName.trim(),
          environment: newAppEnv,
        }),
      });

      const data = await res.json();
      if (res.ok && data.plain_api_key) {
        const nextKeys = { ...guideApiKeys, [data.app.id]: data.plain_api_key };
        setGuideApiKeys(nextKeys);
        setNewKeyModal({
          appId: data.app.id,
          appName: data.app.name,
          plainKey: data.plain_api_key,
        });
        setIsKeyVisible(true);
        setNewAppName('');
        setIsRegisteringApp(false);
        await fetchApps();
      }
    } catch (err) {
      console.error('App registration error:', err);
    }
  };

  // Regenerate App API Key
  const handleRegenerateKey = async (app: RegisteredApp) => {
    if (!confirm(`Regenerate API key for "${app.name}"? Any backend using the old key will be rejected immediately.`)) {
      return;
    }

    try {
      const res = await apiFetch(`/api/apps/${app.id}/regenerate-key`, { method: 'POST' });
      const data = await res.json();
      if (res.ok && data.plain_api_key) {
        const nextKeys = { ...guideApiKeys, [app.id]: data.plain_api_key };
        setGuideApiKeys(nextKeys);
        setNewKeyModal({
          appId: app.id,
          appName: app.name,
          plainKey: data.plain_api_key,
        });
        setIsKeyVisible(true);
        await fetchApps();
      }
    } catch (err) {
      console.error('Key regeneration error:', err);
    }
  };

  // Toggle App Status (active/disabled)
  const handleToggleStatus = async (app: RegisteredApp) => {
    try {
      await apiFetch(`/api/apps/${app.id}/toggle-status`, { method: 'POST' });
      await fetchApps();
    } catch (err) {
      console.error('Toggle status error:', err);
    }
  };

  // Delete App
  const handleDeleteApp = async (app: RegisteredApp) => {
    if (!confirm(`Are you sure you want to delete "${app.name}"? This action cannot be undone.`)) {
      return;
    }

    try {
      await apiFetch(`/api/apps/${app.id}`, { method: 'DELETE' });
      if (selectedAppId === app.id) setSelectedAppId('ALL');
      await fetchApps();
      await fetchStats();
      await fetchRecords();
    } catch (err) {
      console.error('Delete app error:', err);
    }
  };

  // Copy raw JSON to clipboard
  const handleCopyJson = (record: TrafficRecord) => {
    navigator.clipboard.writeText(JSON.stringify(record, null, 2));
    setCopiedId(true);
    setTimeout(() => setCopiedId(false), 2000);
  };

  // Recharts Data Prep
  const topEndpointsChartData = useMemo(() => {
    if (!stats?.top_endpoints) return [];
    return stats.top_endpoints.slice(0, 8).map((item) => ({
      name: item.endpoint.length > 20 ? item.endpoint.slice(0, 18) + '…' : item.endpoint,
      fullName: item.endpoint,
      requests: item.count,
      percentage: item.percentage,
    }));
  }, [stats]);

  const requestsPerMinuteChartData = useMemo(() => {
    if (!stats?.requests_per_minute) return [];
    return stats.requests_per_minute.map((item) => ({
      time: new Date(item.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      requests: item.requests,
      errors: item.errors,
    }));
  }, [stats]);

  const statusBreakdownData = useMemo(() => {
    if (!stats?.status_code_breakdown) return [];
    return [
      { name: '2xx (OK)', count: stats.status_code_breakdown['2xx'] || 0, fill: '#10b981' },
      { name: '3xx (Redirect)', count: stats.status_code_breakdown['3xx'] || 0, fill: '#64748b' },
      { name: '4xx (Client)', count: stats.status_code_breakdown['4xx'] || 0, fill: '#f59e0b' },
      { name: '5xx (Server)', count: stats.status_code_breakdown['5xx'] || 0, fill: '#ef4444' },
    ];
  }, [stats]);

  // Selected App for Connect Guide
  const guideApp = apps.find((a) => a.id === guideSelectedAppId) || apps[0];
  const guideApiKey = guideApp ? guideApiKeys[guideApp.id] || '' : '';
  const guideApiKeyPlaceholder = guideApiKey || (guideApp ? '[API key shown when this app was registered]' : 'No app selected');

  const handleTestConnection = async () => {
    if (!guideApp) return;
    const apiKey = guideApiKeys[guideApp.id] || connectionTestKey.trim();
    if (!apiKey) {
      setConnectionTest({
        appId: guideApp.id,
        status: 'not_connected',
        message: 'This key is not available in this browser. Regenerate the app key, then copy it here again.',
      });
      return;
    }

    setConnectionTest({ appId: guideApp.id, status: 'testing' });
    try {
      const response = await apiFetch('/api/v1/ingest', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': apiKey,
        },
        body: JSON.stringify({
          timestamp: new Date().toISOString(),
          method: 'GET',
          path: '/_gatekeeper_connection_test',
          status: 200,
          response_time_ms: 1,
          client_ip: '127.0.0.1',
          user_agent: 'Gatekeeper-Connect-Guide',
        }),
      });
      if (!response.ok) throw new Error('The dashboard rejected the test event.');

      await new Promise((resolve) => setTimeout(resolve, 3000));
      const appsResponse = await apiFetch('/api/apps');
      const appsData = await appsResponse.json();
      const updatedApp = (appsData.apps || []).find((app: RegisteredApp) => app.id === guideApp.id);
      if (updatedApp?.total_requests > guideApp.total_requests) {
        setConnectionTest({
          appId: guideApp.id,
          status: 'connected',
          message: 'Connected — we received your test event',
        });
      } else {
        throw new Error('The test event was not visible after waiting.');
      }
    } catch {
      setConnectionTest({
        appId: guideApp.id,
        status: 'not_connected',
        message: "Not connected yet — we haven't received anything from this app",
      });
    } finally {
      setConnectionTestKey('');
    }
  };

  const closeKeyDialog = () => {
    if (newKeyModal) {
      setGuideApiKeys((current) => {
        const next = { ...current };
        delete next[newKeyModal.appId];
        return next;
      });
    }
    setNewKeyModal(null);
    setIsKeyVisible(true);
    setCopiedKey(false);
  };

  // Code Snippets for Connect Guide
  // ----------------------------------------------------
  // AUTH SCREENS (If not authenticated)
  // ----------------------------------------------------
  if (!authToken) {
    const showRegister = registrationMode !== 'closed';
    return (
      <AuthLayout
        side={authView}
        showRegister={showRegister}
        onSwitchToLogin={() => setAuthView('login')}
        onSwitchToRegister={() => setAuthView('register')}
        formContent={
          authView === 'login' ? (
            <LoginPage
              loginUsername={loginUsername}
              setLoginUsername={setLoginUsername}
              loginPassword={loginPassword}
              setLoginPassword={setLoginPassword}
              loginError={loginError}
              loginNotice={loginNotice}
              isLoggingIn={isLoggingIn}
              handleLogin={handleLogin}
              onSwitchToRegister={() => setAuthView('register')}
              registrationOpen={showRegister}
              successPrefill={loginSuccessPrefill}
            />
          ) : (
            <RegisterPage
              onSwitchToLogin={(prefillEmail, successMsg) => {
                if (prefillEmail) setLoginUsername(prefillEmail);
                if (successMsg) {
                  setLoginNotice({ type: 'success', message: successMsg });
                  setLoginSuccessPrefill(prefillEmail);
                }
                setAuthView('login');
              }}
            />
          )
        }
      />
    );
  }

  // ----------------------------------------------------
  // MAIN CENTRAL PLATFORM UI
  // ----------------------------------------------------
  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex antialiased">
      {/* Left navigation panel */}
      <aside className="hidden lg:flex lg:w-64 xl:w-72 shrink-0 flex-col bg-white border-r border-slate-200 sticky top-0 h-screen">
        <div className="p-5 border-b border-slate-200">
          <div className="flex items-center gap-3">
            <Logo size={36} className="w-9 h-9" />
            <div className="flex flex-col">
              <span className="font-bold text-slate-900 text-sm tracking-tight flex items-center gap-1.5">
                Gatekeeper <span className="text-blue-600">Security</span>
              </span>
              <span className="text-[10px] text-slate-500 font-mono tracking-wider uppercase">
                Central Ingest Platform
              </span>
            </div>
          </div>
        </div>
        <nav aria-label="Primary navigation" className="flex flex-col gap-4 p-4 text-xs">
          {/* Section: Monitor */}
          <div>
            <div className="nav-section-label" style={{ color: 'var(--color-slate-400)', letterSpacing: '0.05em' }}>Monitor</div>
            <div className="flex flex-col gap-1">
              <button
                onClick={() => setActiveTab('dashboard')}
                className={activeTab === 'dashboard' ? 'nav-item-active' : 'nav-item'}
              >
                <LayoutDashboard className="w-3.5 h-3.5" />
                <span>Dashboard</span>
              </button>

              <button
                onClick={() => setActiveTab('threats')}
                className={activeTab === 'threats' ? 'nav-item-active' : 'nav-item'}
              >
                <ShieldAlert className="w-3.5 h-3.5 text-rose-600" />
                <span className="flex-1 text-left">Threats</span>
                {stats?.open_threats_by_severity && stats.open_threats_by_severity.total > 0 && (
                  <span className="px-1.5 py-0.2 rounded-full text-xs font-bold bg-rose-600 text-white leading-none">
                    {stats.open_threats_by_severity.total}
                  </span>
                )}
              </button>
            </div>
          </div>

          {/* Section: Configure */}
          <div>
            <div className="nav-section-label">Configure</div>
            <div className="flex flex-col gap-1">
              <button
                onClick={() => setActiveTab('rules')}
                className={activeTab === 'rules' ? 'nav-item-active' : 'nav-item'}
              >
                <Shield className="w-3.5 h-3.5 text-blue-600" />
                <span>Rules</span>
              </button>

              <button
                onClick={() => setActiveTab('applications')}
                className={activeTab === 'applications' ? 'nav-item-active' : 'nav-item'}
              >
                <Layers className="w-3.5 h-3.5" />
                <span>Applications ({apps.length})</span>
              </button>

              <button
                onClick={() => setActiveTab('guide')}
                className={activeTab === 'guide' ? 'nav-item-active' : 'nav-item'}
              >
                <Code2 className="w-3.5 h-3.5" />
                <span>Connect Guide</span>
              </button>

              <button
                onClick={() => setActiveTab('ml')}
                className={activeTab === 'ml' ? 'nav-item-active' : 'nav-item'}
              >
                <Database className="w-3.5 h-3.5 text-blue-600" />
                <span>ML Data</span>
              </button>

              <button
                onClick={() => setActiveTab('settings')}
                className={activeTab === 'settings' ? 'nav-item-active' : 'nav-item'}
              >
                <Sliders className="w-3.5 h-3.5 text-slate-600" />
                <span className="flex-1 text-left">Settings</span>
                {currentRole === 'admin' && pendingUsersCount > 0 && (
                  <span
                    className="px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-500 text-white leading-none"
                    title={`${pendingUsersCount} pending user approval(s)`}
                  >
                    {pendingUsersCount}
                  </span>
                )}
              </button>
            </div>
          </div>
        </nav>
      </aside>

      <div className="flex-1 min-w-0 flex flex-col">
        {/* Global controls */}
        <header className="bg-white border-b border-slate-200 px-4 sm:px-6 py-2.5 flex items-center justify-between lg:justify-end gap-3 sticky top-0 z-40">
          <select
            aria-label="Navigate dashboard"
            value={activeTab}
            onChange={(event) => setActiveTab(event.target.value as typeof activeTab)}
            className="lg:hidden max-w-[190px] px-2.5 py-1.5 text-xs font-semibold bg-slate-100 border border-slate-200 rounded text-slate-700"
          >
            <option value="dashboard">Dashboard</option>
            <option value="threats">Threats</option>
            <option value="rules">Rules</option>
            <option value="applications">Applications ({apps.length})</option>
            <option value="guide">Connect Guide</option>
            <option value="ml">ML Data</option>
            <option value="settings">Settings {pendingUsersCount > 0 ? `(${pendingUsersCount})` : ''}</option>
          </select>

          {/* Mode & Live status */}
          <div className="flex items-center gap-1.5 text-xs text-slate-600">
            <span className="status-dot status-dot-ok" />
            <span>Live · refresh 5s</span>
          </div>

          {/* User Profile & Role & Logout */}
          <div className="flex items-center gap-2 pl-3 border-l border-slate-200">
            <div className="flex flex-col text-right">
              <span className="text-xs font-semibold text-slate-900 leading-tight">
                {currentFullName || currentUser}
              </span>
              <span className="text-[10px] text-slate-500 font-mono">
                {currentRole === 'member' ? 'member' : 'admin'}
              </span>
            </div>
            <button
              onClick={handleLogout}
              className="p-1.5 text-slate-400 hover:text-rose-600 transition-colors cursor-pointer"
              title="Sign Out"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </header>

      {/* 2. BODY CONTENT ROUTED BY ACTIVE TAB */}
      <main className="flex-1 w-full px-5 py-4 flex flex-col gap-4">
        {activeTab === 'dashboard' && (
          <DashboardView
            apps={apps}
            selectedAppId={selectedAppId}
            setSelectedAppId={setSelectedAppId}
            setActiveTab={setActiveTab}
            stats={stats}
            topEndpointsChartData={topEndpointsChartData}
            requestsPerMinuteChartData={requestsPerMinuteChartData}
            statusBreakdownData={statusBreakdownData}
            records={records}
            methodFilter={methodFilter}
            setMethodFilter={setMethodFilter}
            statusFilter={statusFilter}
            setStatusFilter={setStatusFilter}
            searchQuery={searchQuery}
            setSearchQuery={setSearchQuery}
            setSelectedRecord={setSelectedRecord}
            selectedRecord={selectedRecord}
            copiedId={copiedId}
            handleCopyJson={handleCopyJson}
          />
        )}

        {activeTab === 'applications' && (
          <ApplicationsView
            apps={apps}
            currentRole={currentRole}
            setIsRegisteringApp={setIsRegisteringApp}
            handleRegisterApp={handleRegisterApp}
            handleRegenerateKey={handleRegenerateKey}
            handleToggleStatus={handleToggleStatus}
            handleDeleteApp={handleDeleteApp}
            isRegisteringApp={isRegisteringApp}
            newAppName={newAppName}
            setNewAppName={setNewAppName}
            newAppEnv={newAppEnv}
            setNewAppEnv={setNewAppEnv}
            newKeyModal={newKeyModal}
            isKeyVisible={isKeyVisible}
            setIsKeyVisible={setIsKeyVisible}
            copiedKey={copiedKey}
            setCopiedKey={setCopiedKey}
            closeKeyDialog={closeKeyDialog}
          />
        )}

        {activeTab === 'guide' && (
          <ConnectGuideView
            apps={apps}
            platformUrl={platformUrl}
            guideApiKeyPlaceholder={guideApiKeyPlaceholder}
            guideApiKey={guideApiKey}
            guideSelectedAppId={guideSelectedAppId}
            setGuideSelectedAppId={setGuideSelectedAppId}
            guideApiKeys={guideApiKeys}
            connectionTestKey={connectionTestKey}
            setConnectionTestKey={setConnectionTestKey}
            connectionTest={connectionTest}
            handleTestConnection={() => void handleTestConnection()}
            guideLanguage={guideLanguage as GuideLanguage}
            setGuideLanguage={setGuideLanguage}
          />
        )}

        {/* ========================================================================= */}
        {/* TAB 2: THREATS REGISTRY (STEP 3) */}
        {/* ========================================================================= */}
        {activeTab === 'threats' && (
          <ThreatsView
            apps={apps}
            selectedAppId={selectedAppId}
            currentRole={currentRole}
            onSelectApp={setSelectedAppId}
            initialThreatId={initialThreatId}
            onThreatsUpdated={() => {
              fetchStats();
            }}
          />
        )}

        {/* ========================================================================= */}
        {/* TAB 3: THREAT DETECTION RULES (STEP 3) */}
        {/* ========================================================================= */}
        {activeTab === 'rules' && <RulesView currentRole={currentRole} />}

        {/* ========================================================================= */}
        {/* TAB 6: ML TRAINING DATA & EXPORT PAGE (STEP 5) */}
        {/* ========================================================================= */}
        {activeTab === 'ml' && (
          <MlDataView
            apps={apps}
            selectedAppId={selectedAppId}
            authToken={authToken}
          />
        )}

        {/* ========================================================================= */}
        {/* TAB 7: SETTINGS & ALERTS & RETENTION PAGE */}
        {/* ========================================================================= */}
        {activeTab === 'settings' && (
          <SettingsView
            authToken={authToken}
            currentRole={currentRole}
            selectedAppId={selectedAppId}
            onPendingUsersCountChange={setPendingUsersCount}
            onSimulateAttack={handleSimulateAttack}
            onTestingDataGenerated={() => {
              fetchStats();
              fetchRecords();
              fetchApps();
            }}
            onSaved={(newSettings) => setPlatformSettings(newSettings)}
          />
        )}
      </main>

      {/* ATTACK SIMULATION RESULTS MODAL */}
      {attackResultModal && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded max-w-md w-full p-6 shadow-md">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-rose-50 text-rose-600 flex items-center justify-center shrink-0">
                <Flame className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-bold text-slate-900 text-sm">Attack Simulation Dispatched</h3>
                <p className="text-xs text-slate-500">5 targeted attack scenarios executed</p>
              </div>
            </div>

            <p className="text-xs text-slate-600 mb-4 leading-relaxed">
              The platform dispatched simulated brute force, SQL injection, scraping, fake signup, and path traversal requests. All rules evaluated in memory under <strong>Monitoring only (not blocking traffic)</strong>.
            </p>

            <div className="p-3 bg-slate-50 rounded border border-slate-200 mb-4">
              <div className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                Fired Threat Rules ({attackResultModal.count}):
              </div>
              <div className="space-y-1.5">
                {attackResultModal.rules.map((ruleName, idx) => (
                  <div key={idx} className="flex items-center gap-2 text-xs font-semibold text-rose-700">
                    <span className="w-1.5 h-1.5 rounded-full bg-rose-600"></span>
                    <span>{ruleName}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                onClick={() => setAttackResultModal(null)}
                className="px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-100 rounded transition-colors cursor-pointer"
              >
                Dismiss
              </button>
              <button
                onClick={() => {
                  setAttackResultModal(null);
                  setActiveTab('threats');
                }}
                className="px-4 py-1.5 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded transition-colors cursor-pointer flex items-center gap-1.5"
              >
                <span>View in Threats Registry</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* SETTINGS MODAL */}
      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        onSaved={(newSettings) => setPlatformSettings(newSettings)}
      />

      {/* REAL-TIME TOAST NOTIFICATIONS */}
      <ToastNotifications
        toasts={toasts}
        onDismiss={(id) => setToasts((prev) => prev.filter((t) => t.id !== id))}
        onViewThreat={() => setActiveTab('threats')}
      />

      {/* FOOTER */}
      <footer className="border-t border-slate-200 bg-white px-6 py-2.5 text-xs text-slate-500 font-mono flex items-center justify-between gap-2 shrink-0">
        <div className="flex items-center gap-2">
          <span className="status-dot status-dot-ok" />
          <span>Active</span>
          <span aria-hidden="true">·</span>
          <span>Monitoring only</span>
          <span aria-hidden="true">·</span>
          <span>{apps.length} apps</span>
          <span aria-hidden="true">·</span>
          <span>{autoRefresh ? '5s refresh' : 'paused'}</span>
        </div>
        <div className="hidden sm:flex items-center gap-2 text-slate-400">
          <span>13 detection rules</span>
        </div>
      </footer>
      </div>
    </div>
  );
}
