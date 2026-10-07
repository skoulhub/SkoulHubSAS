/**
 * validation.js
 * ─────────────────────────────────────────────────────────────
 * Small, dependency-free validators shared by the profile /
 * security screens and the login flows. Pure functions so they
 * can be unit-tested without a DOM.
 * ─────────────────────────────────────────────────────────────
 */

/** Pragmatic email check — one @, a dot in the domain, no spaces. */
export function isValidEmail(value) {
  const v = String(value ?? '').trim();
  if (!v || v.length > 254 || /\s/.test(v)) return false;
  return /^[^\s@]+@[^\s@]+\.[a-zA-Z]{2,}$/.test(v);
}

/**
 * Ugandan number: +256 7XX XXX XXX / 07XX XXX XXX / 0XXX XXXXXX.
 * Spaces, dashes and parentheses are ignored.
 */
export function isValidUgPhone(value) {
  const digits = String(value ?? '').replace(/[\s\-()]/g, '');
  return /^(\+256|256|0)(7\d{8}|[34]\d{8})$/.test(digits);
}

/** Normalise a phone number to the +256… form (best effort). */
export function normalisePhone(value) {
  const digits = String(value ?? '').replace(/[\s\-()]/g, '');
  if (/^\+256\d{9}$/.test(digits)) return digits;
  if (/^256\d{9}$/.test(digits)) return '+' + digits;
  if (/^0\d{9}$/.test(digits)) return '+256' + digits.slice(1);
  return String(value ?? '').trim();
}

export const PASSWORD_MIN_LENGTH = 10;

/** Individual password requirements, for a live checklist UI. */
export function passwordChecks(pw) {
  const s = String(pw ?? '');
  return {
    length:  s.length >= PASSWORD_MIN_LENGTH,
    upper:   /[A-Z]/.test(s),
    lower:   /[a-z]/.test(s),
    number:  /\d/.test(s),
    symbol:  /[^A-Za-z0-9]/.test(s),
    noSpace: s.length > 0 && !/\s/.test(s),
  };
}

/** 0–4 score derived from the checks (used for the strength meter). */
export function passwordScore(pw) {
  const c = passwordChecks(pw);
  const passed = [c.length, c.upper, c.lower, c.number, c.symbol].filter(Boolean).length;
  if (!pw) return 0;
  if (passed <= 2) return 1;
  if (passed === 3) return 2;
  if (passed === 4) return 3;
  return 4;
}

export const STRENGTH_META = [
  { label: 'Too weak',  color: '#dc2626', width: '10%'  },
  { label: 'Weak',      color: '#dc2626', width: '30%'  },
  { label: 'Fair',      color: '#d97706', width: '55%'  },
  { label: 'Good',      color: '#0891b2', width: '80%'  },
  { label: 'Strong',    color: '#059669', width: '100%' },
];

/** True when a new password satisfies every requirement. */
export function isStrongPassword(pw) {
  return Object.values(passwordChecks(pw)).every(Boolean);
}

/** 6-digit verification / OTP code. */
export function isValidCode(value) {
  return /^\d{6}$/.test(String(value ?? '').trim());
}

/** Convenience: a display-friendly initials avatar. */
export function initials(name) {
  return String(name ?? '')
    .split(/\s+/)
    .filter(Boolean)
    .map(w => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase() || 'U';
}
