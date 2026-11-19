import React, { useState } from 'react';
import { Eye, EyeOff, Loader2, Check, X as XIcon } from 'lucide-react';
import { apiFetch } from '../../lib/api';

interface RegisterPageProps {
  onSwitchToLogin: (prefillEmail?: string, successMessage?: string) => void;
}

interface ValidationErrors {
  full_name?: string;
  email?: string;
  password?: string;
  general?: string;
}

function validatePassword(password: string): {
  minLength: boolean;
  hasNumber: boolean;
  hasSpecial: boolean;
  valid: boolean;
} {
  const minLength = password.length >= 8 && password.length <= 128;
  const hasNumber = /\d/.test(password);
  const hasSpecial = /[^a-zA-Z0-9]/.test(password);
  return { minLength, hasNumber, hasSpecial, valid: minLength && hasNumber && hasSpecial };
}

function validateEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) && email.trim().length <= 254;
}

export function RegisterPage({ onSwitchToLogin }: RegisterPageProps) {
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [errors, setErrors] = useState<ValidationErrors>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  const passwordChecks = validatePassword(password);
  const canSubmit =
    fullName.trim().length >= 2 &&
    validateEmail(email) &&
    passwordChecks.valid &&
    !isSubmitting;

  const prefersReducedMotion =
    typeof window !== 'undefined' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});

    // Client-side validation
    const newErrors: ValidationErrors = {};
    const trimmedName = fullName.trim();
    if (!trimmedName || trimmedName.length < 2 || trimmedName.length > 80) {
      newErrors.full_name = 'Full name must be between 2 and 80 characters.';
    }
    const trimmedEmail = email.trim().toLowerCase();
    if (!trimmedEmail || !validateEmail(trimmedEmail)) {
      newErrors.email = 'Please enter a valid email address.';
    }
    if (!passwordChecks.valid) {
      newErrors.password = 'Password must be 8–128 characters with a number and a special character.';
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await apiFetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          full_name: trimmedName,
          email: trimmedEmail,
          password,
        }),
      });

      const data = await res.json();

      if (res.status === 201 && data.success) {
        const message =
          data.status === 'pending'
            ? 'Account created. An administrator must approve it before you can sign in.'
            : 'Account created. You can sign in now.';
        onSwitchToLogin(trimmedEmail, message);
        return;
      }

      if (res.status === 409) {
        setErrors({ email: 'An account with this email already exists.' });
        return;
      }

      if (res.status === 403) {
        setErrors({ general: data.error || 'Registration is currently closed.' });
        return;
      }

      if (res.status === 429) {
        setErrors({ general: 'Too many registration attempts. Please try again later.' });
        return;
      }

      if (res.status === 400 && data.fields) {
        const fieldErrors: ValidationErrors = {};
        if (data.fields.full_name) fieldErrors.full_name = data.fields.full_name;
        if (data.fields.email) fieldErrors.email = data.fields.email;
        if (data.fields.password) fieldErrors.password = data.fields.password;
        setErrors(fieldErrors);
        return;
      }

      setErrors({ general: data.error || 'Registration failed. Please try again.' });
    } catch {
      setErrors({ general: 'Unable to connect to the server. Please try again.' });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="page-title text-slate-900 mb-1">
          Create Account
        </h2>
        <p className="page-sub">Access the security dashboard.</p>
      </div>

      {errors.general && (
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
          {errors.general}
        </div>
      )}

      <form onSubmit={handleSubmit} className="flex flex-col gap-4" noValidate>
        {/* Full name */}
        <div>
          <label htmlFor="reg-full-name" className="block text-xs font-semibold text-slate-700 mb-1.5">
            Full name
          </label>
          <input
            id="reg-full-name"
            type="text"
            autoComplete="name"
            required
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            placeholder="Jane Smith"
            className="input"
            aria-describedby={errors.full_name ? 'reg-full-name-error' : undefined}
            aria-invalid={!!errors.full_name}
          />
          {errors.full_name && (
            <p id="reg-full-name-error" className="text-xs mt-1" style={{ color: 'var(--color-danger)' }}>
              {errors.full_name}
            </p>
          )}
        </div>

        {/* Email */}
        <div>
          <label htmlFor="reg-email" className="block text-xs font-semibold text-slate-700 mb-1.5">
            Email
          </label>
          <input
            id="reg-email"
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            className="input"
            aria-describedby={errors.email ? 'reg-email-error' : undefined}
            aria-invalid={!!errors.email}
          />
          {errors.email && (
            <p id="reg-email-error" className="text-xs mt-1" style={{ color: 'var(--color-danger)' }}>
              {errors.email}
            </p>
          )}
        </div>

        {/* Password */}
        <div>
          <label htmlFor="reg-password" className="block text-xs font-semibold text-slate-700 mb-1.5">
            Password
          </label>
          <div className="relative">
            <input
              id="reg-password"
              type={showPassword ? 'text' : 'password'}
              autoComplete="new-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="input pr-10"
              aria-describedby="reg-password-checklist"
              aria-invalid={!!errors.password}
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

          {/* Live password checklist */}
          <div id="reg-password-checklist" className="mt-2 flex flex-col gap-1" aria-label="Password requirements">
            {[
              { key: 'minLength', label: '8–128 characters', ok: passwordChecks.minLength },
              { key: 'hasNumber', label: 'At least one number', ok: passwordChecks.hasNumber },
              { key: 'hasSpecial', label: 'At least one special character', ok: passwordChecks.hasSpecial },
            ].map(({ key, label, ok }) => (
              <div key={key} className="flex items-center gap-1.5">
                {password.length > 0 ? (
                  ok ? (
                    <Check className="w-3 h-3 shrink-0" style={{ color: 'var(--color-ok)' }} strokeWidth={2.5} />
                  ) : (
                    <XIcon className="w-3 h-3 shrink-0" style={{ color: 'var(--color-danger)' }} strokeWidth={2.5} />
                  )
                ) : (
                  <span
                    className="w-3 h-3 rounded-full border shrink-0"
                    style={{ borderColor: 'var(--color-border)' }}
                  />
                )}
                <span
                  className="text-xs"
                  style={{
                    color:
                      password.length === 0
                        ? 'var(--color-ink-muted)'
                        : ok
                        ? 'var(--color-ok)'
                        : 'var(--color-danger)',
                  }}
                >
                  {label}
                </span>
              </div>
            ))}
          </div>

          {errors.password && (
            <p className="text-xs mt-1" style={{ color: 'var(--color-danger)' }}>
              {errors.password}
            </p>
          )}
        </div>

        <button
          type="submit"
          disabled={!canSubmit}
          className="btn btn-primary w-full justify-center py-2.5 text-sm"
          style={{ borderRadius: '6px', fontSize: 13 }}
        >
          {isSubmitting ? (
            <>
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
              <span>Creating account...</span>
            </>
          ) : (
            <span>Create account</span>
          )}
        </button>
      </form>

      <p className="text-xs text-slate-500">
        Already registered?{' '}
        <button
          type="button"
          onClick={() => onSwitchToLogin()}
          className="text-blue-600 font-semibold hover:underline focus-visible:outline-none cursor-pointer"
        >
          Sign in
        </button>
      </p>
    </div>
  );
}
