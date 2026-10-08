/**
 * userPrefs.js
 * ─────────────────────────────────────────────────────────────
 * Per-user preferences (MFA, notifications, locale) and the
 * app-wide appearance theme.
 *
 * Persistence is localStorage — this is a front-end demo, so in
 * production these calls map to the user-profile API and the
 * preferences table. Theme is a device-level choice and is stored
 * globally; the rest is stored per user id.
 * ─────────────────────────────────────────────────────────────
 */
import { useState, useEffect, useCallback } from 'react';

const THEME_KEY    = 'skoulhub_theme';
const PREFS_PREFIX = 'skoulhub_prefs_';

export const THEME_OPTIONS = [
  { id: 'light',  label: 'Light',  icon: '☀️', desc: 'Always light' },
  { id: 'dark',   label: 'Dark',   icon: '🌙', desc: 'Always dark' },
  { id: 'system', label: 'System', icon: '💻', desc: 'Match this device' },
];

export const DEFAULT_PREFS = {
  mfa:           { enabled: true, method: 'otp', recoveryCodesRemaining: 8 },
  notifications: { email: true, sms: true, push: false, digest: 'daily' },
  locale:        { language: 'en', timezone: 'Africa/Kampala', dateFormat: 'DD/MM/YYYY' },
};

const clone = (o) => JSON.parse(JSON.stringify(o));

/** Deep-merge the two levels we actually use (section → key). */
export function mergePrefs(base, patch) {
  const out = clone(base);
  for (const [section, value] of Object.entries(patch ?? {})) {
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      out[section] = { ...(out[section] ?? {}), ...value };
    } else {
      out[section] = value;
    }
  }
  return out;
}

/* ── Theme ─────────────────────────────────────────────────── */

export function getStoredTheme() {
  try { return localStorage.getItem(THEME_KEY) || 'system'; } catch { return 'system'; }
}

export function persistTheme(theme) {
  try { localStorage.setItem(THEME_KEY, theme); } catch { /* storage unavailable */ }
}

/** Resolve 'system' against the OS preference. */
export function resolveTheme(theme) {
  if (theme === 'light' || theme === 'dark') return theme;
  try {
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  } catch { return 'light'; }
}

/** Apply the resolved theme to <html> (class + data attribute). */
export function applyTheme(theme) {
  const resolved = resolveTheme(theme);
  try {
    const root = document.documentElement;
    root.classList.toggle('dark', resolved === 'dark');
    root.dataset.theme = resolved;
    root.style.colorScheme = resolved;
  } catch { /* no DOM (tests/SSR) */ }
  return resolved;
}

/**
 * useTheme() → [themePreference, setTheme]
 * Applies the theme and follows OS changes while 'system' is selected.
 */
export function useTheme() {
  const [theme, setThemeState] = useState(getStoredTheme);

  useEffect(() => {
    applyTheme(theme);
    if (theme !== 'system') return undefined;
    let mq;
    try { mq = window.matchMedia('(prefers-color-scheme: dark)'); } catch { return undefined; }
    if (!mq?.addEventListener) return undefined;
    const onChange = () => applyTheme('system');
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, [theme]);

  const setTheme = useCallback((next) => {
    persistTheme(next);
    setThemeState(next);
  }, []);

  return [theme, setTheme];
}

/* ── Preferences ───────────────────────────────────────────── */

export function loadPrefs(userId) {
  const defaults = clone(DEFAULT_PREFS);
  if (!userId) return defaults;
  try {
    const raw = localStorage.getItem(PREFS_PREFIX + userId);
    if (!raw) return defaults;
    return mergePrefs(defaults, JSON.parse(raw));
  } catch {
    return defaults;
  }
}

export function savePrefs(userId, prefs) {
  if (!userId) return prefs;
  try { localStorage.setItem(PREFS_PREFIX + userId, JSON.stringify(prefs)); } catch { /* storage unavailable */ }
  return prefs;
}

export function updatePrefs(userId, patch) {
  return savePrefs(userId, mergePrefs(loadPrefs(userId), patch));
}

/** React state wrapper for one user's preferences. */
export function usePrefs(userId) {
  const [prefs, setPrefs] = useState(() => loadPrefs(userId));

  const update = useCallback((patch) => {
    setPrefs(prev => savePrefs(userId, mergePrefs(prev, patch)));
  }, [userId]);

  return [prefs, update];
}

/**
 * Remove everything this app persisted for a user. Called on sign-out so a
 * shared device does not leak the previous user's preferences (MFA method,
 * notification settings, locale) to the next person who signs in.
 */
export function clearUserStorage(userId) {
  try {
    if (userId) localStorage.removeItem(PREFS_PREFIX + userId);
  } catch { /* storage unavailable */ }
}

export const THEME_STORAGE_KEY = THEME_KEY;
export const PREFS_STORAGE_PREFIX = PREFS_PREFIX;
