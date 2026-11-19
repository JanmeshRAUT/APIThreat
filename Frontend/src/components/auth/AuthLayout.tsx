import React from 'react';
import { Logo } from '../Logo';

interface AuthLayoutProps {
  side: 'login' | 'register';
  formContent: React.ReactNode;
  onSwitchToLogin?: () => void;
  onSwitchToRegister?: () => void;
  showRegister?: boolean;
}

const BrandPanel = () => (
  <div className="relative flex flex-col h-full overflow-hidden bg-slate-900 border-r border-slate-800">
    <div className="relative z-10 flex flex-col h-full p-10">
      {/* Logo top-left */}
      <div className="flex items-center gap-3">
        <Logo size={36} />
        <div className="flex flex-col">
          <span className="font-bold text-white text-base font-sans">
            Gatekeeper
          </span>
          <span className="font-mono text-[10px] text-slate-400 uppercase tracking-wider">
            API Security Platform
          </span>
        </div>
      </div>

      <div className="flex-1" />

      {/* 3 factual lines */}
      <div className="border-t border-slate-800 pt-6">
        <div className="flex flex-col gap-4 text-xs">
          <div>
            <div className="text-white font-semibold mb-0.5">Central Ingest API</div>
            <div className="text-slate-400">Accepts backend request telemetry via POST /api/v1/ingest.</div>
          </div>
          <div>
            <div className="text-white font-semibold mb-0.5">In-Memory Detection</div>
            <div className="text-slate-400">Evaluates 13 security rules in memory without blocking user requests.</div>
          </div>
          <div>
            <div className="text-white font-semibold mb-0.5">Telemetry &amp; ML Export</div>
            <div className="text-slate-400">Aggregates window metrics and exports training data as CSV and JSONL.</div>
          </div>
        </div>
      </div>
    </div>
  </div>
);

export function AuthLayout({
  side,
  formContent,
}: AuthLayoutProps) {
  return (
    <div className="min-h-screen flex bg-slate-900">
      {/* Two-column layout on desktop */}
      {side === 'login' ? (
        <>
          {/* Login: brand panel LEFT */}
          <div className="hidden lg:block w-1/2 min-h-screen">
            <BrandPanel />
          </div>
          {/* Form RIGHT */}
          <div className="flex-1 lg:w-1/2 flex flex-col items-center justify-center bg-slate-50 py-12 px-6">
            {/* Mobile logo strip */}
            <div className="lg:hidden mb-8 flex items-center gap-2.5">
              <Logo size={34} />
              <span className="font-bold text-slate-800 text-base">
                Gatekeeper
              </span>
            </div>
            <div className="w-full max-w-[400px]">
              {formContent}
            </div>
          </div>
        </>
      ) : (
        <>
          {/* Register: form LEFT */}
          <div className="flex-1 lg:w-1/2 flex flex-col items-center justify-center bg-slate-50 py-12 px-6">
            {/* Mobile logo strip */}
            <div className="lg:hidden mb-8 flex items-center gap-2.5">
              <Logo size={34} />
              <span className="font-bold text-slate-800 text-base">
                Gatekeeper
              </span>
            </div>
            <div className="w-full max-w-[400px]">
              {formContent}
            </div>
          </div>
          {/* Brand panel RIGHT */}
          <div className="hidden lg:block w-1/2 min-h-screen">
            <BrandPanel />
          </div>
        </>
      )}
    </div>
  );
}
