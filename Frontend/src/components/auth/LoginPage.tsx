import React, { useState } from 'react';
import { Eye, EyeOff, Loader2 } from 'lucide-react';
import { motion } from 'motion/react';

interface LoginPageProps {
  loginUsername: string;
  setLoginUsername: (v: string) => void;
  loginPassword: string;
  setLoginPassword: (v: string) => void;
  loginError: string | null;
  loginNotice: { type: 'pending' | 'disabled' | 'success'; message: string } | null;
  isLoggingIn: boolean;
  handleLogin: (e: React.FormEvent) => void;
  onSwitchToRegister: () => void;
  registrationOpen: boolean;
  successPrefill?: string;
}

export function LoginPage({
  loginUsername,
  setLoginUsername,
  loginPassword,
  setLoginPassword,
  loginError,
  loginNotice,
  isLoggingIn,
  handleLogin,
  onSwitchToRegister,
  registrationOpen,
  successPrefill,
}: LoginPageProps) {
  const [showPassword, setShowPassword] = useState(false);

  const prefersReducedMotion =
    typeof window !== 'undefined' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  return (
    <motion.div
      initial={prefersReducedMotion ? false : { opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
      className="flex flex-col gap-6"
    >
      <div>
        <h2
          className="font-bold text-slate-900 mb-1"
          style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 22, letterSpacing: '-0.02em' }}
        >
          Sign in
        </h2>
        <p className="text-slate-500" style={{ fontSize: 13.5 }}>Access the security dashboard.</p>
      </div>

      {/* Success notice from registration */}
      {successPrefill && loginNotice?.type === 'success' && (
        <div
          className="p-3 rounded text-xs"
          style={{
            backgroundColor: 'var(--color-ok-subtle)',
            border: '1px solid var(--color-ok-border)',
            color: 'var(--color-ok)',
          }}
          role="status"
          aria-live="polite"
        >
          {loginNotice.message}
        </div>
      )}

      {/* Pending notice — neutral, not red */}
      {loginNotice?.type === 'pending' && (
        <div
          className="p-3 rounded text-xs"
          style={{
            backgroundColor: 'var(--color-info-subtle)',
            border: '1px solid var(--color-info-border)',
            color: 'var(--color-info)',
          }}
          role="status"
          aria-live="polite"
        >
          Your account is waiting for administrator approval.
        </div>
      )}

      {/* Disabled notice — danger */}
      {loginNotice?.type === 'disabled' && (
        <div
          className="p-3 rounded text-xs border-l-2"
          style={{
            backgroundColor: 'var(--color-danger-subtle)',
            border: '1px solid var(--color-danger-border)',
            borderLeftWidth: 2,
            borderLeftColor: 'var(--color-danger)',
            color: 'var(--color-danger)',
          }}
          role="alert"
          aria-live="polite"
        >
          {loginNotice.message}
        </div>
      )}

      {/* Error notice */}
      {loginError && !loginNotice && (
        <div
          className="p-3 rounded text-xs border-l-2"
          style={{
            backgroundColor: 'var(--color-danger-subtle)',
            border: '1px solid var(--color-danger-border)',
            borderLeftWidth: 2,
            borderLeftColor: 'var(--color-danger)',
            color: 'var(--color-danger)',
          }}
          role="alert"
          aria-live="polite"
        >
          {loginError}
        </div>
      )}

      <form onSubmit={handleLogin} className="flex flex-col gap-4" noValidate>
        {/* Email or username */}
        <div>
          <label htmlFor="login-username" className="block text-xs font-semibold text-slate-700 mb-1.5">
            Email or username
          </label>
          <input
            id="login-username"
            type="text"
            autoComplete="username"
            required
            value={loginUsername}
            onChange={(e) => setLoginUsername(e.target.value)}
            placeholder="you@example.com"
            className="input"
          />
        </div>

        {/* Password */}
        <div>
          <label htmlFor="login-password" className="block text-xs font-semibold text-slate-700 mb-1.5">
            Password
          </label>
          <div className="relative">
            <input
              id="login-password"
              type={showPassword ? 'text' : 'password'}
              autoComplete="current-password"
              required
              value={loginPassword}
              onChange={(e) => setLoginPassword(e.target.value)}
              placeholder="••••••••"
              className="input pr-10"
            />
            <button
              type="button"
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 transition-colors"
              onClick={() => setShowPassword((v) => !v)}
              aria-label={showPassword ? 'Hide password' : 'Show password'}
              tabIndex={0}
            >
              {showPassword ? (
                <EyeOff className="w-4 h-4" strokeWidth={1.75} />
              ) : (
                <Eye className="w-4 h-4" strokeWidth={1.75} />
              )}
            </button>
          </div>
        </div>

        {/* Error above submit (redundant inline display for submit area) */}
        {loginError && !loginNotice && (
          <div aria-hidden="true" className="sr-only" />
        )}

        <button
          type="submit"
          disabled={isLoggingIn}
          className="btn btn-primary w-full justify-center py-2.5 text-sm"
          style={{ borderRadius: '6px', fontSize: 13 }}
        >
          {isLoggingIn ? (
            <>
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
              <span>Verifying...</span>
            </>
          ) : (
            <span>Sign In</span>
          )}
        </button>
      </form>

      <div className="flex flex-col gap-3">
        {/* Switch view */}
        {registrationOpen && (
          <p className="text-xs text-slate-500">
            Need an account?{' '}
            <button
              type="button"
              onClick={onSwitchToRegister}
              className="text-blue-600 font-semibold hover:underline focus-visible:outline-none cursor-pointer"
            >
              Register
            </button>
          </p>
        )}

        <p className="text-xs text-slate-400">
          Forgot your password? Ask an administrator to reset it.
        </p>
      </div>
    </motion.div>
  );
}
