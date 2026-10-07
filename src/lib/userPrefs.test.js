import { describe, it, expect, beforeEach } from 'vitest';
import {
  DEFAULT_PREFS, mergePrefs, loadPrefs, savePrefs, updatePrefs,
  getStoredTheme, persistTheme, resolveTheme, applyTheme, THEME_OPTIONS,
  THEME_STORAGE_KEY, PREFS_STORAGE_PREFIX,
} from './userPrefs';

/* Minimal localStorage stub — the lib degrades gracefully without it. */
const memory = new Map();
beforeEach(() => {
  memory.clear();
  globalThis.localStorage = {
    getItem: k => (memory.has(k) ? memory.get(k) : null),
    setItem: (k, v) => memory.set(k, String(v)),
    removeItem: k => memory.delete(k),
    clear: () => memory.clear(),
  };
});

describe('userPrefs — merging', () => {
  it('deep-merges one level of sections and replaces scalars', () => {
    const merged = mergePrefs(DEFAULT_PREFS, { notifications: { push: true }, locale: 'sw' });
    expect(merged.notifications.push).toBe(true);
    expect(merged.notifications.email).toBe(DEFAULT_PREFS.notifications.email); // untouched
    expect(merged.locale).toBe('sw');
    expect(DEFAULT_PREFS.notifications.push).toBe(false); // base not mutated
  });

  it('returns a fresh object each time', () => {
    const a = mergePrefs(DEFAULT_PREFS, {});
    a.mfa.enabled = false;
    expect(DEFAULT_PREFS.mfa.enabled).toBe(true);
    expect(mergePrefs(DEFAULT_PREFS, {}).mfa.enabled).toBe(true);
  });
});

describe('userPrefs — persistence', () => {
  it('returns defaults for an unknown user', () => {
    expect(loadPrefs('u-xyz')).toEqual(DEFAULT_PREFS);
  });

  it('round-trips saved preferences', () => {
    savePrefs('u-001', mergePrefs(DEFAULT_PREFS, { mfa: { method: 'authapp' } }));
    expect(loadPrefs('u-001').mfa.method).toBe('authapp');
    // stored under the per-user key
    expect(memory.has(PREFS_STORAGE_PREFIX + 'u-001')).toBe(true);
  });

  it('updatePrefs patches without losing other sections', () => {
    updatePrefs('u-001', { notifications: { digest: 'weekly' } });
    updatePrefs('u-001', { mfa: { enabled: false } });
    const prefs = loadPrefs('u-001');
    expect(prefs.notifications.digest).toBe('weekly');
    expect(prefs.mfa.enabled).toBe(false);
    expect(prefs.mfa.method).toBe(DEFAULT_PREFS.mfa.method);
  });

  it('keeps users isolated from each other', () => {
    updatePrefs('u-001', { mfa: { enabled: false } });
    expect(loadPrefs('u-002').mfa.enabled).toBe(DEFAULT_PREFS.mfa.enabled);
  });

  it('survives corrupt JSON', () => {
    memory.set(PREFS_STORAGE_PREFIX + 'u-003', '{not json');
    expect(loadPrefs('u-003')).toEqual(DEFAULT_PREFS);
  });
});

describe('userPrefs — theme', () => {
  it('offers exactly light / dark / system', () => {
    expect(THEME_OPTIONS.map(o => o.id)).toEqual(['light', 'dark', 'system']);
  });

  it('defaults to system and persists a choice', () => {
    expect(getStoredTheme()).toBe('system');
    persistTheme('dark');
    expect(getStoredTheme()).toBe('dark');
    expect(memory.get(THEME_STORAGE_KEY)).toBe('dark');
  });

  it('resolves explicit themes without consulting the OS', () => {
    expect(resolveTheme('dark')).toBe('dark');
    expect(resolveTheme('light')).toBe('light');
  });

  it('falls back to light for system when matchMedia is unavailable', () => {
    expect(resolveTheme('system')).toBe('light');
  });

  it('applyTheme never throws without a DOM', () => {
    expect(() => applyTheme('dark')).not.toThrow();
    expect(applyTheme('dark')).toBe('dark');
  });
});
