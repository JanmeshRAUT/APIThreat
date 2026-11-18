import React from 'react';
import { Logo } from '../Logo';

interface AuthLayoutProps {
  side: 'login' | 'register';
  formContent: React.ReactNode;
  onSwitchToLogin?: () => void;
  onSwitchToRegister?: () => void;
  showRegister?: boolean;
}

const ApiPatternSvg = () => (
  <svg
    className="absolute inset-0 w-full h-full"
    xmlns="http://www.w3.org/2000/svg"
    aria-hidden="true"
  >
    <defs>
      <pattern id="api-grid" x="0" y="0" width="40" height="40" patternUnits="userSpaceOnUse">
        <path d="M 40 0 L 0 0 0 40" fill="none" stroke="white" strokeWidth="0.35" strokeOpacity="0.07" />
      </pattern>
    </defs>
    <rect width="100%" height="100%" fill="url(#api-grid)" />

    {/* Request trace lines — intentionally uneven spacing */}
    <line x1="8%"  y1="28%" x2="92%" y2="28%" stroke="white" strokeWidth="0.5" strokeOpacity="0.09" strokeDasharray="5 7" />
    <line x1="10%" y1="51%" x2="88%" y2="51%" stroke="white" strokeWidth="0.7" strokeOpacity="0.11" strokeDasharray="3 9" />
    <line x1="12%" y1="72%" x2="90%" y2="72%" stroke="white" strokeWidth="0.5" strokeOpacity="0.08" strokeDasharray="4 6" />

    {/* Verticals — slightly off-center */}
    <line x1="23%" y1="18%" x2="23%" y2="82%" stroke="white" strokeWidth="0.5" strokeOpacity="0.08" strokeDasharray="2 10" />
    <line x1="51%" y1="22%" x2="51%" y2="78%" stroke="white" strokeWidth="0.5" strokeOpacity="0.09" strokeDasharray="2 8" />
    <line x1="76%" y1="19%" x2="76%" y2="81%" stroke="white" strokeWidth="0.5" strokeOpacity="0.07" strokeDasharray="2 11" />

    {/* Nodes — slight opacity variation */}
    <circle cx="23%" cy="28%" r="2.5" fill="white" fillOpacity="0.13" />
    <circle cx="51%" cy="28%" r="4"   fill="white" fillOpacity="0.19" />
    <circle cx="76%" cy="28%" r="2.5" fill="white" fillOpacity="0.11" />

    <circle cx="23%" cy="51%" r="4.5" fill="white" fillOpacity="0.16" />
    <circle cx="76%" cy="51%" r="2.5" fill="white" fillOpacity="0.13" />

    <circle cx="51%" cy="72%" r="3.5" fill="white" fillOpacity="0.18" />
    <circle cx="23%" cy="72%" r="2.5" fill="white" fillOpacity="0.10" />
    <circle cx="76%" cy="72%" r="3"   fill="white" fillOpacity="0.11" />

    {/* Active node rings — different radii so it feels drawn not generated */}
    <circle cx="51%" cy="28%" r="9"  fill="none" stroke="#38BDF8" strokeWidth="1.2" strokeOpacity="0.45" />
    <circle cx="23%" cy="51%" r="11" fill="none" stroke="#818CF8" strokeWidth="1"   strokeOpacity="0.30" />
    <circle cx="51%" cy="72%" r="7"  fill="none" stroke="#60A5FA" strokeWidth="1"   strokeOpacity="0.35" />
  </svg>
);

const BrandPanel = () => (
  <div className="relative flex flex-col h-full overflow-hidden" style={{ backgroundColor: '#0c1324' }}>
    <ApiPatternSvg />

    {/* Very subtle radial glow in top-left */}
    <div
      className="absolute inset-0 pointer-events-none"
      style={{
        background: 'radial-gradient(ellipse 60% 50% at 20% 15%, rgba(81,70,216,0.18) 0%, transparent 70%)',
      }}
    />

    <div className="relative z-10 flex flex-col h-full" style={{ padding: '40px 44px' }}>
      {/* Logo top-left */}
      <div className="flex items-center gap-3">
        <Logo size={38} />
        <div className="flex flex-col" style={{ gap: 1 }}>
          <span
            style={{
              fontFamily: "'Space Grotesk', sans-serif",
              fontSize: 15,
              fontWeight: 700,
              color: '#fff',
              letterSpacing: '-0.02em',
              lineHeight: 1,
            }}
          >
            Gatekeeper
          </span>
          <span
            style={{
              fontFamily: "'JetBrains Mono', monospace",
              fontSize: 9,
              color: 'rgba(147,197,253,0.55)',
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
            }}
          >
            API Security Platform
          </span>
        </div>
      </div>

      {/* Spacer */}
      <div style={{ flex: 1 }} />

      {/* Headline block — not center-aligned, sits in lower-mid */}
      <div style={{ marginBottom: 36 }}>
        <h1
          style={{
            fontFamily: "'Space Grotesk', sans-serif",
            fontSize: 31,
            fontWeight: 700,
            color: '#fff',
            letterSpacing: '-0.03em',
            lineHeight: 1.2,
            marginBottom: 14,
            maxWidth: 310,
          }}
        >
          Every request,{' '}
          <span style={{ color: '#818CF8' }}>accounted for.</span>
        </h1>
        <p
          style={{
            color: 'rgba(203,213,225,0.75)',
            fontSize: 13.5,
            lineHeight: 1.6,
            maxWidth: 280,
          }}
        >
          Real-time API security telemetry. Monitor threats,
          enforce rules, and keep production traffic visible
          — without slowing a single request.
        </p>
      </div>

      {/* Divider + feature blurbs */}
      <div style={{ borderTop: '1px solid rgba(100,116,139,0.35)', paddingTop: 22 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 11 }}>
            <span
              style={{
                width: 7,
                height: 7,
                borderRadius: '50%',
                backgroundColor: '#818CF8',
                marginTop: 5,
                flexShrink: 0,
              }}
            />
            <div>
              <div style={{ color: '#fff', fontSize: 13, fontWeight: 600, lineHeight: 1.3 }}>
                Live request telemetry
              </div>
              <div style={{ color: 'rgba(148,163,184,0.8)', fontSize: 11.5, marginTop: 3, lineHeight: 1.4 }}>
                Every ingest event appears on the dashboard in under 5 s.
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 11 }}>
            <span
              style={{
                width: 7,
                height: 7,
                borderRadius: '50%',
                backgroundColor: '#38BDF8',
                marginTop: 5,
                flexShrink: 0,
              }}
            />
            <div>
              <div style={{ color: '#fff', fontSize: 13, fontWeight: 600, lineHeight: 1.3 }}>
                13 detection rules, no inline blocking
              </div>
              <div style={{ color: 'rgba(148,163,184,0.8)', fontSize: 11.5, marginTop: 3, lineHeight: 1.4 }}>
                Rules fire in-memory — your users never see a slowdown.
              </div>
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
}: AuthLayoutProps) {
  return (
    <div className="min-h-screen flex" style={{ backgroundColor: '#0f172a' }}>
      {/* Two-column layout on desktop */}
      {side === 'login' ? (
        <>
          {/* Login: brand panel LEFT */}
          <div className="hidden lg:block w-1/2" style={{ minHeight: '100vh' }}>
            <BrandPanel />
          </div>
          {/* Form RIGHT */}
          <div className="flex-1 lg:w-1/2 flex flex-col items-center justify-center bg-slate-50 py-12 px-6">
            {/* Mobile logo strip */}
            <div className="lg:hidden mb-8 flex items-center gap-2.5">
              <Logo size={34} />
              <span
                className="font-bold text-slate-800"
                style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 17 }}
              >
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
              <span
                className="font-bold text-slate-800"
                style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 17 }}
              >
                Gatekeeper
              </span>
            </div>
            <div className="w-full max-w-[400px]">
              {formContent}
            </div>
          </div>
          {/* Brand panel RIGHT */}
          <div className="hidden lg:block w-1/2" style={{ minHeight: '100vh' }}>
            <BrandPanel />
          </div>
        </>
      )}
    </div>
  );
}
