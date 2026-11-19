import React, { useState, useEffect } from 'react';
import { X, Shield, Bell, Check, Sliders, Info } from 'lucide-react';
import { PlatformSettings } from '../types/threats';
import { apiFetch } from '../lib/api';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSaved?: (settings: PlatformSettings) => void;
}

export function SettingsModal({ isOpen, onClose, onSaved }: SettingsModalProps) {
  const [settings, setSettings] = useState<PlatformSettings>({
    mode: 'shadow',
    notify_on_high_critical: true,
  });
  const [isSaving, setIsSaving] = useState(false);
  const [savedSuccess, setSavedSuccess] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    async function loadSettings() {
      try {
        const res = await apiFetch('/api/threats/settings');
        if (res.ok) {
          const data = await res.json();
          if (data.settings) setSettings(data.settings);
        }
      } catch (err) {
        console.error('Failed to load settings:', err);
      }
    }
    loadSettings();
  }, [isOpen]);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const res = await apiFetch('/api/threats/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings),
      });
      if (res.ok) {
        const data = await res.json();
        setSavedSuccess(true);
        if (onSaved) onSaved(data.settings);
        setTimeout(() => {
          setSavedSuccess(false);
          onClose();
        }, 800);
      }
    } catch (err) {
      console.error('Failed to save settings:', err);
    } finally {
      setIsSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
      <div className="bg-white rounded max-w-md w-full border border-slate-200 shadow-md overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-slate-200 bg-slate-50">
          <div className="flex items-center gap-2">
            <div>
              <h3 className="font-semibold text-slate-900 text-xs tracking-tight">Platform Security Settings</h3>
              <p className="text-[11px] text-slate-500">Configure global threat detection posture</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded text-slate-400 hover:text-slate-700 transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="p-4 flex flex-col gap-4 text-xs font-sans">
          {/* Mode Selector */}
          <div>
            <label className="block text-xs font-semibold text-slate-800 mb-2">
              Detection Operating Mode:
            </label>
            <div className="space-y-2">
              {/* Option 1: Shadow Mode */}
              <label
                onClick={() => setSettings((prev) => ({ ...prev, mode: 'shadow' }))}
                className={`flex items-start gap-3 p-2.5 rounded border cursor-pointer transition-all ${
                  settings.mode === 'shadow'
                    ? 'border-blue-500 bg-blue-50/50'
                    : 'border-slate-200 hover:bg-slate-50'
                }`}
              >
                <input
                  type="radio"
                  name="operating_mode"
                  checked={settings.mode === 'shadow'}
                  onChange={() => setSettings((prev) => ({ ...prev, mode: 'shadow' }))}
                  className="mt-0.5 text-blue-600 focus:ring-blue-500"
                />
                <div>
                  <div className="font-bold text-slate-900 flex items-center gap-1.5">
                    <span>Monitoring only (not blocking traffic)</span>
                    <span className="text-xs font-mono font-medium text-emerald-700 bg-emerald-50 px-1.5 py-0.2 rounded border border-emerald-200">
                      RECOMMENDED
                    </span>
                  </div>
                  <p className="text-slate-500 text-xs mt-0.5 leading-relaxed">
                    Evaluates requests in background. Records threat telemetry and live statistics without ever blocking or dropping traffic.
                  </p>
                </div>
              </label>

              {/* Option 2: Alert-Only Mode */}
              <label
                onClick={() => setSettings((prev) => ({ ...prev, mode: 'alert_only' }))}
                className={`flex items-start gap-3 p-2.5 rounded border cursor-pointer transition-all ${
                  settings.mode === 'alert_only'
                    ? 'border-amber-500 bg-amber-50/50'
                    : 'border-slate-200 hover:bg-slate-50'
                }`}
              >
                <input
                  type="radio"
                  name="operating_mode"
                  checked={settings.mode === 'alert_only'}
                  onChange={() => setSettings((prev) => ({ ...prev, mode: 'alert_only' }))}
                  className="mt-0.5 text-amber-600 focus:ring-amber-500"
                />
                <div>
                  <div className="font-semibold text-slate-900">Alert-Only Mode</div>
                  <p className="text-slate-500 text-xs mt-0.5 leading-relaxed">
                    Shadow mode plus high-visibility real-time alert dispatch for incident responders and SOC operators.
                  </p>
                </div>
              </label>
            </div>
          </div>

          {/* Toast Notification Toggle */}
          <div className="pt-3 border-t border-slate-100">
            <label className="flex items-center justify-between cursor-pointer">
              <div className="flex items-center gap-2">
                <Bell className="w-4 h-4 text-slate-500" />
                <div>
                  <span className="font-semibold text-slate-800 text-xs block">Live Toast Notifications</span>
                  <span className="text-xs text-slate-500">Pop up toast alerts on High & Critical severity threats</span>
                </div>
              </div>
              <input
                type="checkbox"
                checked={settings.notify_on_high_critical}
                onChange={(e) =>
                  setSettings((prev) => ({ ...prev, notify_on_high_critical: e.target.checked }))
                }
                className="w-4 h-4 text-blue-600 rounded border-slate-300 focus:ring-blue-500 cursor-pointer"
              />
            </label>
          </div>
        </div>

        {/* Footer */}
        <div className="p-3 bg-slate-50 border-t border-slate-200 flex items-center justify-between">
          <span className="text-xs text-slate-500 font-mono">settings.json</span>
          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="btn btn-secondary text-xs"
            >
              Cancel
            </button>
            <button
              disabled={isSaving}
              onClick={handleSave}
              className="btn btn-primary text-xs"
            >
              {savedSuccess ? (
                <>
                  <Check className="w-3.5 h-3.5" />
                  <span>Saved!</span>
                </>
              ) : (
                <span>{isSaving ? 'Saving...' : 'Save Settings'}</span>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
