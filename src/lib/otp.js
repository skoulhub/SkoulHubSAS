/**
 * otp.js
 * ─────────────────────────────────────────────────────────────
 * One-time-passcode challenges with the properties a real verifier
 * must have: a random code, a short expiry, a bounded number of
 * attempts, and a resend cooldown.
 *
 * Pure and clock-injectable so it is fully unit-testable. In
 * production the challenge lives server-side and the code is
 * delivered out-of-band; the browser must never be the verifier.
 * ─────────────────────────────────────────────────────────────
 */

export const OTP_LENGTH          = 6;
export const OTP_TTL_MS          = 2 * 60 * 1000;   // 2 minutes
export const OTP_MAX_ATTEMPTS    = 5;
export const OTP_RESEND_COOLDOWN_MS = 30 * 1000;    // 30 seconds

/** Cryptographically-random numeric code (falls back only if unavailable). */
export function generateOtp(length = OTP_LENGTH) {
  const digits = [];
  const cryptoObj = typeof globalThis !== 'undefined' ? globalThis.crypto : undefined;
  if (cryptoObj?.getRandomValues) {
    const buf = new Uint32Array(length);
    cryptoObj.getRandomValues(buf);
    for (let i = 0; i < length; i++) digits.push(buf[i] % 10);
  } else {
    for (let i = 0; i < length; i++) digits.push(Math.floor(Math.random() * 10));
  }
  return digits.join('');
}

/** Start a new challenge. */
export function createOtpChallenge({ now = Date.now(), ttl = OTP_TTL_MS, code = null } = {}) {
  return {
    code: code ?? generateOtp(),
    issuedAt: now,
    expiresAt: now + ttl,
    attempts: 0,
    maxAttempts: OTP_MAX_ATTEMPTS,
    used: false,
  };
}

export const otpSecondsLeft = (challenge, now = Date.now()) =>
  challenge ? Math.max(0, Math.ceil((challenge.expiresAt - now) / 1000)) : 0;

export const otpAttemptsLeft = (challenge) =>
  challenge ? Math.max(0, challenge.maxAttempts - challenge.attempts) : 0;

export const canResend = (challenge, now = Date.now()) =>
  !challenge || now - challenge.issuedAt >= OTP_RESEND_COOLDOWN_MS;

/**
 * Verify a submitted code against a challenge.
 * Returns { ok, reason, challenge } — `challenge` is the (possibly updated)
 * challenge so the caller can persist the incremented attempt counter.
 *
 * reasons: 'ok' | 'no_challenge' | 'used' | 'expired' | 'locked' | 'mismatch'
 */
export function verifyOtp(challenge, input, now = Date.now()) {
  if (!challenge)              return { ok: false, reason: 'no_challenge', challenge };
  if (challenge.used)          return { ok: false, reason: 'used',         challenge };
  if (now > challenge.expiresAt) return { ok: false, reason: 'expired',    challenge };
  if (challenge.attempts >= challenge.maxAttempts)
    return { ok: false, reason: 'locked', challenge };

  const submitted = String(input ?? '').replace(/\D/g, '');
  if (submitted !== challenge.code) {
    const next = { ...challenge, attempts: challenge.attempts + 1 };
    return {
      ok: false,
      reason: next.attempts >= next.maxAttempts ? 'locked' : 'mismatch',
      challenge: next,
    };
  }

  // single use — a code cannot be replayed
  return { ok: true, reason: 'ok', challenge: { ...challenge, used: true } };
}

/** Human-readable message for a failure reason. */
export function otpErrorMessage(reason, challenge) {
  switch (reason) {
    case 'expired':      return 'That code has expired. Request a new one.';
    case 'locked':       return 'Too many incorrect attempts. This code is locked — request a new one.';
    case 'mismatch':     return `Incorrect code. ${otpAttemptsLeft(challenge)} attempt${otpAttemptsLeft(challenge) === 1 ? '' : 's'} left.`;
    case 'used':         return 'That code has already been used.';
    case 'no_challenge': return 'No active code. Request a new one.';
    default:             return 'Verification failed.';
  }
}
