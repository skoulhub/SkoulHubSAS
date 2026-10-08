import { describe, it, expect } from 'vitest';
import {
  OTP_LENGTH, OTP_TTL_MS, OTP_MAX_ATTEMPTS, OTP_RESEND_COOLDOWN_MS,
  generateOtp, createOtpChallenge, verifyOtp, canResend,
  otpSecondsLeft, otpAttemptsLeft, otpErrorMessage,
} from './otp';

const T0 = 1_700_000_000_000;

describe('otp — generation', () => {
  it('produces a numeric code of the required length', () => {
    for (let i = 0; i < 50; i++) {
      const code = generateOtp();
      expect(code).toMatch(/^\d{6}$/);
      expect(code).toHaveLength(OTP_LENGTH);
    }
  });

  it('does not repeat itself across many draws', () => {
    const seen = new Set(Array.from({ length: 200 }, () => generateOtp()));
    expect(seen.size).toBeGreaterThan(150);          // not a constant / counter
  });

  it('starts a challenge with the full attempt budget and a TTL', () => {
    const c = createOtpChallenge({ now: T0, code: '123456' });
    expect(c.code).toBe('123456');
    expect(c.attempts).toBe(0);
    expect(c.maxAttempts).toBe(OTP_MAX_ATTEMPTS);
    expect(c.expiresAt).toBe(T0 + OTP_TTL_MS);
  });
});

describe('otp — verification', () => {
  it('accepts the correct code exactly once', () => {
    const c = createOtpChallenge({ now: T0, code: '424242' });
    const first = verifyOtp(c, '424242', T0 + 1000);
    expect(first.ok).toBe(true);
    expect(first.reason).toBe('ok');

    const replay = verifyOtp(first.challenge, '424242', T0 + 2000);
    expect(replay.ok).toBe(false);                    // single use
    expect(replay.reason).toBe('used');
  });

  it('rejects a wrong code and counts the attempt', () => {
    const c = createOtpChallenge({ now: T0, code: '111111' });
    const r = verifyOtp(c, '222222', T0);
    expect(r.ok).toBe(false);
    expect(r.reason).toBe('mismatch');
    expect(r.challenge.attempts).toBe(1);
    expect(otpAttemptsLeft(r.challenge)).toBe(OTP_MAX_ATTEMPTS - 1);
  });

  it('locks out after the attempt budget is exhausted', () => {
    let c = createOtpChallenge({ now: T0, code: '111111' });
    for (let i = 0; i < OTP_MAX_ATTEMPTS; i++) {
      const r = verifyOtp(c, '000000', T0);
      c = r.challenge;
      if (i === OTP_MAX_ATTEMPTS - 1) expect(r.reason).toBe('locked');
    }
    expect(verifyOtp(c, '111111', T0).reason).toBe('locked');   // correct code no longer helps
  });

  it('expires the code after the TTL', () => {
    const c = createOtpChallenge({ now: T0, code: '123456' });
    expect(verifyOtp(c, '123456', T0 + OTP_TTL_MS - 1).ok).toBe(true);
    const expired = verifyOtp(c, '123456', T0 + OTP_TTL_MS + 1);
    expect(expired.ok).toBe(false);
    expect(expired.reason).toBe('expired');
  });

  it('refuses to verify without a challenge', () => {
    expect(verifyOtp(null, '123456', T0).reason).toBe('no_challenge');
  });

  it('ignores formatting characters in the submitted value', () => {
    const c = createOtpChallenge({ now: T0, code: '123456' });
    expect(verifyOtp(c, ' 123-456 ', T0).ok).toBe(true);
  });
});

describe('otp — resend cooldown and messaging', () => {
  it('blocks resends inside the cooldown window', () => {
    const c = createOtpChallenge({ now: T0 });
    expect(canResend(c, T0 + 1000)).toBe(false);
    expect(canResend(c, T0 + OTP_RESEND_COOLDOWN_MS - 1)).toBe(false);
    expect(canResend(c, T0 + OTP_RESEND_COOLDOWN_MS)).toBe(true);
    expect(canResend(null, T0)).toBe(true);
  });

  it('reports seconds remaining', () => {
    const c = createOtpChallenge({ now: T0, ttl: 60_000 });
    expect(otpSecondsLeft(c, T0)).toBe(60);
    expect(otpSecondsLeft(c, T0 + 30_000)).toBe(30);
    expect(otpSecondsLeft(c, T0 + 90_000)).toBe(0);
  });

  it('explains every failure reason without leaking the code', () => {
    const c = createOtpChallenge({ now: T0, code: '999999' });
    for (const reason of ['expired', 'locked', 'used', 'no_challenge', 'mismatch']) {
      const msg = otpErrorMessage(reason, c);
      expect(msg.length).toBeGreaterThan(10);
      expect(msg).not.toContain('999999');
    }
  });
});
