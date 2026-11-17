import React from 'react';
import { Logo } from '../Logo';

interface AuthLayoutProps {
  side: 'login' | 'register';
  formContent: React.ReactNode;
  onSwitchToLogin: () => void;
  onSwitchToRegister: () => void;
  showRegister: boolean;
}

const ApiPatternSvg = () => (
  <svg
    className="absolute inset-0 w-full h-full"
    xmlns="http://www.w3.org/2000/svg"
    aria-hidden="true"
  >
    <defs>
      <pattern id="api-grid" x="0" y="0" width="40" height="40" patternUnits="userSpaceOnUse">
        <path d="M 40 0 L 0 0 0 40" fill="none" stroke="white" strokeWidth="0.4" strokeOpacity="0.08" />
      </pattern>
    </defs>
    <rect width="100%" height="100%" fill="url(#api-grid)" />

    {/* Request trace lines */}
    <line x1="10%" y1="30%" x2="90%" y2="30%" stroke="white" strokeWidth="0.6" strokeOpacity="0.12" strokeDasharray="4 6" />
    <line x1="10%" y1="50%" x2="90%" y2="50%" stroke="white" strokeWidth="0.6" strokeOpacity="0.12" strokeDasharray="4 6" />
    <line x1="10%" y1="70%" x2="90%" y2="70%" stroke="white" strokeWidth="0.6" strokeOpacity="0.12" strokeDasharray="4 6" />

    {/* Vertical trace */}
    <line x1="25%" y1="20%" x2="25%" y2="80%" stroke="white" strokeWidth="0.6" strokeOpacity="0.1" strokeDasharray="2 8" />
    <line x1="50%" y1="20%" x2="50%" y2="80%" stroke="white" strokeWidth="0.6" strokeOpacity="0.1" strokeDasharray="2 8" />
    <line x1="75%" y1="20%" x2="75%" y2="80%" stroke="white" strokeWidth="0.6" strokeOpacity="0.1" strokeDasharray="2 8" />

    {/* Nodes */}
    <circle cx="25%" cy="30%" r="3" fill="white" fillOpacity="0.15" />
    <circle cx="50%" cy="30%" r="4" fill="white" fillOpacity="0.2" />
    <circle cx="75%" cy="30%" r="3" fill="white" fillOpacity="0.15" />

    <circle cx="25%" cy="50%" r="5" fill="white" fillOpacity="0.18" />
    <circle cx="75%" cy="50%" r="3" fill="white" fillOpacity="0.15" />

    <circle cx="50%" cy="70%" r="4" fill="white" fillOpacity="0.2" />
    <circle cx="25%" cy="70%" r="3" fill="white" fillOpacity="0.12" />
    <circle cx="75%" cy="70%" r="3" fill="white" fillOpacity="0.12" />

    {/* Active node highlight */}
    <circle cx="50%" cy="30%" r="8" fill="none" stroke="#0d9488" strokeWidth="1" strokeOpacity="0.3" />
    <circle cx="25%" cy="50%" r="10" fill="none" stroke="#0d9488" strokeWidth="1" strokeOpacity="0.25" />
  </svg>
);

const BrandPanel = () => (
  <div className="relative flex flex-col h-full overflow-hidden" style={{ backgroundColor: '#0f1a1a' }}>
    <ApiPatternSvg />

    <div className="relative z-10 flex flex-col h-full p-10">
      {/* Logo */}
      <div className="flex items-center gap-2.5 mb-auto">
        <Logo size={36} />
        <div className="flex flex-col leading-tight">
          <span
            className="font-bold text-white tracking-tight"
            style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 15 }}
          >
            Gatekeeper
          </span>
          <span className="font-mono text-white/40 uppercase tracking-widest" style={{ fontSize: 9 }}>
            API Security
          </span>
        </div>
      </div>

      {/* Headline */}
      <div className="mt-auto mb-10">
        <h1
          className="font-bold leading-tight mb-4"
          style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 32, color: 'white' }}
        >
          Every request,{' '}
          <span style={{ color: '#0d9488' }}>accounted for.</span>
        </h1>
        <p className="text-white/60 leading-relaxed text-sm max-w-xs">
          Real-time API security telemetry. Monitor threats, enforce rules, and
          keep your production traffic visible — without blocking a single request.
        </p>
      </div>

      {/* Divider */}
      <div className="border-t border-white/10 pt-6 flex flex-col gap-4">
        <div className="flex items-start gap-3">
          <span className="status-dot status-dot-accent mt-1.5 shrink-0" />
          <div>
            <div className="text-white text-sm font-semibold">Live request telemetry</div>
            <div className="text-white/50 text-xs mt-0.5">
              Every ingest event lands on the dashboard in under 5 seconds.
            </div>
          </div>
        </div>
        <div className="flex items-start gap-3">
          <span className="status-dot status-dot-accent mt-1.5 shrink-0" />
          <div>
            <div className="text-white text-sm font-semibold">13 detection rules, no inline blocking</div>
            <div className="text-white/50 text-xs mt-0.5">
              Rules fire in-memory — your users never see a slowdown.
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
);

export function AuthLayout({
  side,
  formContent,
  onSwitchToLogin,
  onSwitchToRegister,
  showRegister,
}: AuthLayoutProps) {
  return (
    <div className="min-h-screen flex flex-col" style={{ backgroundColor: '#0f1a1a' }}>
      {/* Top navbar */}
      <nav
        className="shrink-0 flex items-center justify-between px-6 py-3 border-b"
        style={{ backgroundColor: '#0f1a1a', borderColor: 'rgba(255,255,255,0.08)' }}
      >
        <div className="flex items-center gap-2.5">
          <Logo size={28} />
          <span
            className="font-bold text-white tracking-tight hidden sm:block"
            style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 14 }}
          >
            Gatekeeper
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onSwitchToLogin}
            className={`btn text-xs ${side === 'login' ? 'btn-secondary' : 'btn-ghost'}`}
            style={side === 'login' ? { color: '#0d9488', borderColor: '#0d9488', backgroundColor: 'rgba(13,148,136,0.08)' } : { color: 'rgba(255,255,255,0.6)', borderColor: 'rgba(255,255,255,0.15)' }}
          >
            Sign In
          </button>
          {showRegister && (
            <button
              type="button"
              onClick={onSwitchToRegister}
              className="btn text-xs"
              style={
                side === 'register'
                  ? { backgroundColor: '#0d9488', color: 'white', borderColor: '#0d9488' }
                  : { backgroundColor: '#0d9488', color: 'white', borderColor: '#0d9488' }
              }
            >
              Register
            </button>
          )}
        </div>
      </nav>

      {/* Mobile brand strip */}
      <div
        className="lg:hidden px-6 py-5 border-b"
        style={{ backgroundColor: '#0f1a1a', borderColor: 'rgba(255,255,255,0.08)' }}
      >
        <p
          className="font-bold text-white text-lg leading-tight"
          style={{ fontFamily: "'Space Grotesk', sans-serif" }}
        >
          Every request, <span style={{ color: '#0d9488' }}>accounted for.</span>
        </p>
      </div>

      {/* Two-column layout on desktop */}
      <div className="flex flex-1 overflow-hidden">
        {side === 'login' ? (
          <>
            {/* Login: brand panel LEFT */}
            <div className="hidden lg:block w-1/2 h-full" style={{ minHeight: 'calc(100vh - 52px)' }}>
              <BrandPanel />
            </div>
            {/* Form RIGHT */}
            <div className="flex-1 lg:w-1/2 flex items-start lg:items-center justify-center bg-bg py-10 px-6">
              <div className="w-full max-w-[420px]">
                {formContent}
              </div>
            </div>
          </>
        ) : (
          <>
            {/* Register: form LEFT */}
            <div className="flex-1 lg:w-1/2 flex items-start lg:items-center justify-center bg-bg py-10 px-6">
              <div className="w-full max-w-[420px]">
                {formContent}
              </div>
            </div>
            {/* Brand panel RIGHT */}
            <div className="hidden lg:block w-1/2 h-full" style={{ minHeight: 'calc(100vh - 52px)' }}>
              <BrandPanel />
            </div>
          </>
        )}
      </div>
    </div>
  );
}
