import React from 'react';

interface LogoProps {
  className?: string;
  size?: number;
  showText?: boolean;
}

export const Logo: React.FC<LogoProps> = ({
  className = 'w-9 h-9',
  size = 36,
  showText = false,
}) => {
  return (
    <div className={`flex items-center gap-2.5 ${className}`}>
      {/* Flat single-color mark in accent color */}
      <svg
        viewBox="0 0 32 32"
        width={size}
        height={size}
        className="shrink-0"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
      >
        {/* Hexagonal frame */}
        <path
          d="M16 2 L28 8.5 L28 23.5 L16 30 L4 23.5 L4 8.5 Z"
          fill="#0d9488"
        />
        {/* Grid pattern representing API traffic */}
        <line x1="10" y1="12" x2="22" y2="12" stroke="white" strokeWidth="1.5" strokeLinecap="round" />
        <line x1="10" y1="16" x2="22" y2="16" stroke="white" strokeWidth="1.5" strokeLinecap="round" />
        <line x1="10" y1="20" x2="22" y2="20" stroke="white" strokeWidth="1.5" strokeLinecap="round" />
        {/* Node dots */}
        <circle cx="10" cy="12" r="1.5" fill="white" />
        <circle cx="22" cy="16" r="1.5" fill="white" />
        <circle cx="10" cy="20" r="1.5" fill="white" />
        {/* Active pulse */}
        <circle cx="22" cy="12" r="2" fill="white" fillOpacity="0.4" />
        <circle cx="22" cy="12" r="1" fill="white" />
      </svg>

      {showText && (
        <div className="flex flex-col leading-none">
          <span
            className="font-bold text-slate-900 tracking-tight"
            style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 14 }}
          >
            Gatekeeper
          </span>
          <span
            className="font-mono text-slate-500 uppercase tracking-widest"
            style={{ fontSize: 9 }}
          >
            API Security
          </span>
        </div>
      )}
    </div>
  );
};
