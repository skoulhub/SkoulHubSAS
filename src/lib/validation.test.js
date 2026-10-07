import { describe, it, expect } from 'vitest';
import {
  isValidEmail, isValidUgPhone, normalisePhone, passwordChecks, passwordScore,
  isStrongPassword, isValidCode, initials, PASSWORD_MIN_LENGTH,
} from './validation';

describe('validation — email', () => {
  it('accepts normal addresses', () => {
    for (const e of ['a@b.co', 'admin@smck.ug', 'first.last+tag@school.ac.ug']) {
      expect(isValidEmail(e), e).toBe(true);
    }
  });

  it('rejects malformed addresses', () => {
    for (const e of ['', 'nope', 'a@b', 'a b@c.com', 'a@@b.com', '@b.com', null, undefined]) {
      expect(isValidEmail(e), String(e)).toBe(false);
    }
  });
});

describe('validation — Ugandan phone numbers', () => {
  it('accepts local and international forms', () => {
    for (const p of ['+256 700 111 001', '0700111001', '256700111001', '0414 200 123', '+256-414-200-123']) {
      expect(isValidUgPhone(p), p).toBe(true);
    }
  });

  it('rejects wrong-length or non-Ugandan numbers', () => {
    for (const p of ['', '12345', '+254700111001', '+256 700 111 00', 'abc']) {
      expect(isValidUgPhone(p), p).toBe(false);
    }
  });

  it('normalises to the +256 form', () => {
    expect(normalisePhone('0700111001')).toBe('+256700111001');
    expect(normalisePhone('256700111001')).toBe('+256700111001');
    expect(normalisePhone('+256 700 111 001')).toBe('+256700111001');
  });
});

describe('validation — password policy', () => {
  it('reports each requirement separately', () => {
    expect(passwordChecks('')).toEqual({ length: false, upper: false, lower: false, number: false, symbol: false, noSpace: false });
    expect(passwordChecks('Passw0rd!x')).toEqual({ length: true, upper: true, lower: true, number: true, symbol: true, noSpace: true });
    expect(passwordChecks('has space1A')).toMatchObject({ noSpace: false });
  });

  it('requires the full set for a strong password', () => {
    expect(isStrongPassword('short1A!')).toBe(false);            // too short
    expect(isStrongPassword('alllowercase1!')).toBe(false);      // no uppercase
    expect(isStrongPassword('Passw0rd!x')).toBe(true);
  });

  it('scores strength from 0 to 4', () => {
    expect(passwordScore('')).toBe(0);
    expect(passwordScore('abc')).toBe(1);
    expect(passwordScore('abcdefghij')).toBeLessThan(4);
    expect(passwordScore('Passw0rd!x')).toBe(4);
  });

  it(`enforces a minimum length of ${PASSWORD_MIN_LENGTH}`, () => {
    expect(passwordChecks('a'.repeat(PASSWORD_MIN_LENGTH - 1)).length).toBe(false);
    expect(passwordChecks('a'.repeat(PASSWORD_MIN_LENGTH)).length).toBe(true);
  });
});

describe('validation — codes and initials', () => {
  it('accepts exactly six digits', () => {
    expect(isValidCode('123456')).toBe(true);
    expect(isValidCode('12345')).toBe(false);
    expect(isValidCode('12345a')).toBe(false);
    expect(isValidCode('')).toBe(false);
  });

  it('derives initials safely', () => {
    expect(initials('Agnes Namukwaya')).toBe('AN');
    expect(initials('Grace')).toBe('G');
    expect(initials('')).toBe('U');
    expect(initials(null)).toBe('U');
  });
});
