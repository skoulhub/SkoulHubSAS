import { useState, useRef } from 'react';
import { ROLE_META } from '../lib/permissions';
import { usePrefs, THEME_OPTIONS } from '../lib/userPrefs';
import { updateUserProfile } from '../lib/tenantStore';
import {
  isValidEmail, isValidUgPhone, normalisePhone, passwordChecks, passwordScore,
  STRENGTH_META, isStrongPassword, isValidCode, PASSWORD_MIN_LENGTH, initials,
} from '../lib/validation';
import {
  Card, SectionHeader, Field, TextInput, Select, Toggle, ReadOnlyRow,
  PrimaryButton, GhostButton, QRMock, CodeInput,
} from '../components/ui';
import { recordAudit, AUDIT_ACTIONS, AUDIT_SEVERITY } from '../lib/audit';

/* ── Page ───────────────────────────────────────────────────── */

const MFA_METHODS = [
  { id: 'otp',     label: 'Email / SMS OTP',      desc: '6-digit code sent to you',      badge: null },
  { id: 'authapp', label: 'Authenticator App',    desc: 'Google Authenticator / Authy',  badge: 'Recommended' },
  { id: 'passkey', label: 'Passkey / Biometric',  desc: 'Face ID, Touch ID, YubiKey',    badge: 'Passwordless' },
];

const SESSIONS = [
  { id: 's1', device: 'MacBook Pro · Chrome',  location: 'Kampala, UG', last: 'Active now',       current: true  },
  { id: 's2', device: 'iPhone 15 · Safari',    location: 'Kampala, UG', last: '2 hours ago',      current: false },
  { id: 's3', device: 'Windows PC · Edge',     location: 'Entebbe, UG', last: '3 days ago',       current: false },
];

function makeRecoveryCodes() {
  return Array.from({ length: 8 }, () =>
    Array.from({ length: 8 }, () => 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'[Math.floor(Math.random() * 32)]).join('')
      .replace(/^(.{4})(.{4})$/, '$1-$2')
  );
}

export default function ProfilePage({ currentUser, tenant, theme, onTheme, onUpdateUser, onLogout }) {
  const [tab, setTab] = useState('profile');
  const [prefs, updatePrefs] = usePrefs(currentUser?.user_id);
  const [toast, setToast] = useState(null);
  const toastSeq = useRef(0);

  const notify = (msg, type = 'success') => {
    const id = ++toastSeq.current;
    setToast({ msg, type, id });
    setTimeout(() => setToast(t => (t && t.id === id ? null : t)), 3200);
  };

  const rl = ROLE_META[currentUser?.role] ?? { label: currentUser?.role, color: 'var(--accent)', bg: '#e8ecff' };
  const email = currentUser?.email ?? '';
  const phone = currentUser?.phone ?? '';

  /* ── Personal info ── */
  const [name, setName] = useState(currentUser?.name ?? '');
  const saveName = () => {
    if (!name.trim()) return notify('Name cannot be empty', 'error');
    updateUserProfile(email, { name: name.trim() });
    onUpdateUser?.({ name: name.trim() });
    notify('Name updated');
  };

  /* ── Email / phone change (verification-code flow) ── */
  const [emailFlow, setEmailFlow] = useState({ open: false, step: 'enter', value: '', code: '', error: '' });
  const [phoneFlow, setPhoneFlow] = useState({ open: false, step: 'enter', value: '', code: '', error: '' });

  const startFlow = (setter) => setter({ open: true, step: 'enter', value: '', code: '', error: '' });
  const cancelFlow = (setter) => setter({ open: false, step: 'enter', value: '', code: '', error: '' });

  const sendEmailCode = () => {
    if (!isValidEmail(emailFlow.value)) return setEmailFlow(f => ({ ...f, error: 'Enter a valid email address.' }));
    if (emailFlow.value.trim().toLowerCase() === String(email).toLowerCase())
      return setEmailFlow(f => ({ ...f, error: 'That is already your email address.' }));
    setEmailFlow(f => ({ ...f, step: 'verify', error: '' }));
    notify(`Verification code sent to ${emailFlow.value.trim()}`);
  };
  const confirmEmail = () => {
    if (!isValidCode(emailFlow.code)) return setEmailFlow(f => ({ ...f, error: 'Enter the 6-digit code.' }));
    const next = emailFlow.value.trim();
    updateUserProfile(email, { email: next });
    onUpdateUser?.({ email: next });
    cancelFlow(setEmailFlow);
    recordAudit({ action: AUDIT_ACTIONS.EMAIL_CHANGED, target: next, detail: `from ${email}`, severity: AUDIT_SEVERITY.NOTICE });
    notify('Email address updated');
  };

  const sendPhoneCode = () => {
    if (!isValidUgPhone(phoneFlow.value)) return setPhoneFlow(f => ({ ...f, error: 'Enter a valid Ugandan number, e.g. +256 700 000 000.' }));
    setPhoneFlow(f => ({ ...f, step: 'verify', error: '' }));
    notify(`Verification code sent to ${normalisePhone(phoneFlow.value)}`);
  };
  const confirmPhone = () => {
    if (!isValidCode(phoneFlow.code)) return setPhoneFlow(f => ({ ...f, error: 'Enter the 6-digit code.' }));
    const next = normalisePhone(phoneFlow.value);
    updateUserProfile(email, { phone: next });
    onUpdateUser?.({ phone: next });
    cancelFlow(setPhoneFlow);
    recordAudit({ action: AUDIT_ACTIONS.PHONE_CHANGED, target: next, severity: AUDIT_SEVERITY.NOTICE });
    notify('Phone number updated');
  };

  /* ── Password ── */
  const [pw, setPw] = useState({ current: '', next: '', confirm: '', error: '' });
  const checks = passwordChecks(pw.next);
  const score = passwordScore(pw.next);
  const strength = STRENGTH_META[score];

  const savePassword = () => {
    if (!pw.current) return setPw(p => ({ ...p, error: 'Enter your current password.' }));
    if (!isStrongPassword(pw.next)) return setPw(p => ({ ...p, error: 'New password does not meet all requirements.' }));
    if (pw.next !== pw.confirm) return setPw(p => ({ ...p, error: 'Passwords do not match.' }));
    updatePrefs({ security: { passwordChangedAt: new Date().toISOString() } });
    setPw({ current: '', next: '', confirm: '', error: '' });
    recordAudit({ action: AUDIT_ACTIONS.PASSWORD_CHANGED, severity: AUDIT_SEVERITY.NOTICE });
    notify('Password changed successfully');
  };

  const sendResetLink = () => notify(`Password reset link sent to ${email || 'your email'}`);

  /* ── MFA ── */
  const [settingUp, setSettingUp] = useState(null); // method id awaiting verification
  const [authCode, setAuthCode] = useState('');
  const [codes, setCodes] = useState(null);         // freshly generated recovery codes

  const chooseMethod = (id) => {
    if (id === 'authapp' || id === 'passkey') { setSettingUp(id); setAuthCode(''); return; }
    updatePrefs({ mfa: { method: id, enabled: true } });
    notify('Two-factor method updated');
  };
  const confirmSetup = () => {
    if (!isValidCode(authCode)) return notify('Enter the 6-digit code from your app', 'error');
    updatePrefs({ mfa: { method: settingUp, enabled: true } });
    setSettingUp(null);
    notify('Two-factor authentication enabled');
  };
  const toggleMfa = (next) => {
    updatePrefs({ mfa: { enabled: next } });
    recordAudit({ action: AUDIT_ACTIONS.MFA_CHANGED, detail: next ? 'enabled' : 'disabled', severity: AUDIT_SEVERITY.NOTICE });
    notify(next ? 'Two-factor authentication enabled' : 'Two-factor authentication disabled', next ? 'success' : 'warn');
  };
  const regenerateCodes = () => {
    setCodes(makeRecoveryCodes());
    recordAudit({ action: AUDIT_ACTIONS.RECOVERY_CODES, severity: AUDIT_SEVERITY.NOTICE });
    notify('New recovery codes generated');
  };

  /* ── Notification / locale prefs ── */
  const toggleNotif = (key) => updatePrefs({ notifications: { [key]: !prefs.notifications[key] } });

  const TABS = [
    { id: 'profile',     label: 'Profile',       icon: '👤' },
    { id: 'security',    label: 'Security',      icon: '🔐' },
    { id: 'preferences', label: 'Preferences',   icon: '🎨' },
    { id: 'sessions',    label: 'Sessions',      icon: '💻' },
  ];

  return (
    <div className="animate-fade-in space-y-5 max-w-4xl">

      {/* Header */}
      <Card className="p-5">
        <div className="flex items-center gap-4 flex-wrap">
          <div className="w-16 h-16 rounded-2xl flex items-center justify-center text-white text-xl font-extrabold flex-shrink-0"
            style={{ background: rl.color }}>
            {initials(currentUser?.name)}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-lg font-extrabold truncate" style={{ color: 'var(--text)' }}>{currentUser?.name}</h2>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full" style={{ background: rl.bg, color: rl.color }}>{rl.label}</span>
              {prefs.mfa.enabled && (
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full" style={{ background: 'var(--tint-green)', color: 'var(--ok)' }}>2FA on</span>
              )}
            </div>
            <p className="text-xs mt-0.5 truncate" style={{ color: 'var(--text-dim)' }}>
              {email || 'no email on file'} · {phone || 'no phone on file'}
            </p>
            <p className="text-[10px] mt-0.5" style={{ color: 'var(--text-dim)' }}>
              {tenant?.name ?? 'Platform'} · {currentUser?.user_id}
            </p>
          </div>
          <GhostButton onClick={onLogout}>Sign out</GhostButton>
        </div>
      </Card>

      {/* Tabs */}
      <div className="flex gap-1.5 flex-wrap">
        {TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className="px-3.5 py-2 rounded-xl text-xs font-bold transition-all"
            style={tab === t.id
              ? { background: '#1E45FC', color: 'white' }
              : { background: 'var(--surface-2)', color: 'var(--text-muted)' }}>
            <span className="mr-1.5">{t.icon}</span>{t.label}
          </button>
        ))}
      </div>

      {/* ══ PROFILE ══ */}
      {tab === 'profile' && (
        <div className="space-y-4">
          <Card>
            <SectionHeader title="Personal information" subtitle="Your name and contact details" />
            <div className="p-5 space-y-4">
              <Field label="Full name">
                <div className="flex gap-2">
                  <TextInput value={name} onChange={e => setName(e.target.value)} placeholder="Your full name" />
                  <PrimaryButton onClick={saveName} disabled={name === currentUser?.name}>Save</PrimaryButton>
                </div>
              </Field>
            </div>
          </Card>

          <Card>
            <SectionHeader title="Email address" subtitle="Used to sign in and receive notifications"
              right={<GhostButton onClick={() => startFlow(setEmailFlow)} disabled={emailFlow.open}>Change</GhostButton>} />
            <div className="px-5 py-4 space-y-3">
              {!emailFlow.open && (
                <div className="text-sm font-semibold" style={{ color: 'var(--text)' }}>{email || '—'}</div>
              )}
              {emailFlow.open && emailFlow.step === 'enter' && (
                <div className="space-y-3">
                  <Field label="New email address" error={emailFlow.error} hint="We'll send a 6-digit verification code">
                    <TextInput type="email" value={emailFlow.value} error={emailFlow.error}
                      onChange={e => setEmailFlow(f => ({ ...f, value: e.target.value, error: '' }))}
                      placeholder="new@school.ug" autoFocus />
                  </Field>
                  <div className="flex gap-2">
                    <PrimaryButton onClick={sendEmailCode}>Send verification code</PrimaryButton>
                    <GhostButton onClick={() => cancelFlow(setEmailFlow)}>Cancel</GhostButton>
                  </div>
                </div>
              )}
              {emailFlow.open && emailFlow.step === 'verify' && (
                <div className="space-y-3">
                  <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                    Enter the code sent to <strong style={{ color: 'var(--text)' }}>{emailFlow.value}</strong> (demo: any 6 digits)
                  </p>
                  <CodeInput value={emailFlow.code} label="Email verification code"
                    onChange={v => setEmailFlow(f => ({ ...f, code: v, error: '' }))} />
                  {emailFlow.error && <p className="text-[11px] text-red-500">{emailFlow.error}</p>}
                  <div className="flex gap-2">
                    <PrimaryButton onClick={confirmEmail}>Verify &amp; update</PrimaryButton>
                    <GhostButton onClick={() => cancelFlow(setEmailFlow)}>Cancel</GhostButton>
                  </div>
                </div>
              )}
            </div>
          </Card>

          <Card>
            <SectionHeader title="Phone number" subtitle="Used for SMS alerts and two-factor codes"
              right={<GhostButton onClick={() => startFlow(setPhoneFlow)} disabled={phoneFlow.open}>Change</GhostButton>} />
            <div className="px-5 py-4 space-y-3">
              {!phoneFlow.open && (
                <div className="text-sm font-semibold" style={{ color: 'var(--text)' }}>{phone || '—'}</div>
              )}
              {phoneFlow.open && phoneFlow.step === 'enter' && (
                <div className="space-y-3">
                  <Field label="New phone number" error={phoneFlow.error} hint="Ugandan format, e.g. +256 700 000 000">
                    <TextInput type="tel" value={phoneFlow.value} error={phoneFlow.error}
                      onChange={e => setPhoneFlow(f => ({ ...f, value: e.target.value, error: '' }))}
                      placeholder="+256 700 000 000" autoFocus />
                  </Field>
                  <div className="flex gap-2">
                    <PrimaryButton onClick={sendPhoneCode}>Send verification code</PrimaryButton>
                    <GhostButton onClick={() => cancelFlow(setPhoneFlow)}>Cancel</GhostButton>
                  </div>
                </div>
              )}
              {phoneFlow.open && phoneFlow.step === 'verify' && (
                <div className="space-y-3">
                  <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                    Enter the code sent to <strong style={{ color: 'var(--text)' }}>{normalisePhone(phoneFlow.value)}</strong> (demo: any 6 digits)
                  </p>
                  <CodeInput value={phoneFlow.code} label="Phone verification code"
                    onChange={v => setPhoneFlow(f => ({ ...f, code: v, error: '' }))} />
                  {phoneFlow.error && <p className="text-[11px] text-red-500">{phoneFlow.error}</p>}
                  <div className="flex gap-2">
                    <PrimaryButton onClick={confirmPhone}>Verify &amp; update</PrimaryButton>
                    <GhostButton onClick={() => cancelFlow(setPhoneFlow)}>Cancel</GhostButton>
                  </div>
                </div>
              )}
            </div>
          </Card>

          <Card>
            <SectionHeader title="Account" subtitle="Read-only details" />
            <div>
              <ReadOnlyRow label="User ID"     value={currentUser?.user_id ?? '—'} mono />
              <ReadOnlyRow label="Role"        value={rl.label} />
              <ReadOnlyRow label="School"      value={tenant?.name ?? 'Platform (all tenants)'} />
              {tenant?.school_id && <ReadOnlyRow label="Tenant ID" value={tenant.school_id} mono />}
              <ReadOnlyRow label="Member since" value={tenant?.created_at ?? '2026-04-29'} />
              <ReadOnlyRow label="Last sign-in" value="Today, just now" />
            </div>
          </Card>
        </div>
      )}

      {/* ══ SECURITY ══ */}
      {tab === 'security' && (
        <div className="space-y-4">
          <Card>
            <SectionHeader title="Password" subtitle="Use a strong, unique password"
              right={<GhostButton onClick={sendResetLink}>Email me a reset link</GhostButton>} />
            <div className="p-5 space-y-4">
              <Field label="Current password">
                <TextInput type="password" value={pw.current} onChange={e => setPw(p => ({ ...p, current: e.target.value, error: '' }))} placeholder="••••••••" />
              </Field>
              <Field label="New password">
                <TextInput type="password" value={pw.next} onChange={e => setPw(p => ({ ...p, next: e.target.value, error: '' }))} placeholder="At least 10 characters" />
              </Field>
              {pw.next && (
                <div className="space-y-2">
                  <div className="h-1.5 rounded-full overflow-hidden" style={{ background: 'var(--surface-3)' }}>
                    <div className="h-full rounded-full transition-all" style={{ width: strength.width, background: strength.color }} />
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold" style={{ color: strength.color }}>{strength.label}</span>
                    <span className="text-[10px]" style={{ color: 'var(--text-dim)' }}>{pw.next.length} characters</span>
                  </div>
                  <ul className="grid grid-cols-2 gap-1">
                    {[
                      ['length',  `At least ${PASSWORD_MIN_LENGTH} characters`],
                      ['upper',   'One uppercase letter'],
                      ['lower',   'One lowercase letter'],
                      ['number',  'One number'],
                      ['symbol',  'One symbol'],
                      ['noSpace', 'No spaces'],
                    ].map(([key, label]) => (
                      <li key={key} className="flex items-center gap-1.5 text-[11px]"
                        style={{ color: checks[key] ? 'var(--ok)' : 'var(--text-dim)' }}>
                        <span>{checks[key] ? '✓' : '○'}</span>{label}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              <Field label="Confirm new password">
                <TextInput type="password" value={pw.confirm} onChange={e => setPw(p => ({ ...p, confirm: e.target.value, error: '' }))} placeholder="Repeat new password" />
              </Field>
              {pw.error && <p className="text-[11px] text-red-500">{pw.error}</p>}
              {prefs.security?.passwordChangedAt && (
                <p className="text-[10px]" style={{ color: 'var(--text-dim)' }}>
                  Last changed {new Date(prefs.security.passwordChangedAt).toLocaleString()}
                </p>
              )}
              <div className="flex gap-2">
                <PrimaryButton onClick={savePassword}>Update password</PrimaryButton>
                <GhostButton onClick={() => setPw({ current: '', next: '', confirm: '', error: '' })}>Clear</GhostButton>
              </div>
            </div>
          </Card>

          <Card>
            <SectionHeader title="Two-factor authentication"
              subtitle="Add a second step when signing in"
              right={<Toggle label="Two-factor authentication" checked={prefs.mfa.enabled} onChange={toggleMfa} />} />
            <div className="p-5 space-y-3">
              <div className={`grid grid-cols-1 sm:grid-cols-3 gap-3 ${prefs.mfa.enabled ? '' : 'opacity-50 pointer-events-none'}`}>
                {MFA_METHODS.map(m => {
                  const active = prefs.mfa.method === m.id;
                  return (
                    <button key={m.id} onClick={() => chooseMethod(m.id)}
                      className="text-left rounded-xl border-2 p-3.5 transition-all"
                      style={{ borderColor: active ? '#1E45FC' : 'var(--border-strong)', background: active ? 'var(--tint-blue)' : 'var(--surface)' }}>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-bold" style={{ color: 'var(--text)' }}>{m.label}</span>
                        {m.badge && (
                          <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full"
                            style={{ background: m.badge === 'Recommended' ? '#A3CF2E' : 'var(--tint-blue)', color: m.badge === 'Recommended' ? '#1a2a00' : 'var(--accent)' }}>
                            {m.badge}
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] mt-1" style={{ color: 'var(--text-dim)' }}>{m.desc}</p>
                      {active && <p className="text-[10px] font-bold mt-2" style={{ color: 'var(--accent)' }}>✓ Active</p>}
                    </button>
                  );
                })}
              </div>

              {settingUp === 'authapp' && (
                <div className="rounded-xl border p-4 mt-2" style={{ borderColor: 'var(--border-strong)', background: 'var(--surface-2)' }}>
                  <p className="text-xs font-bold mb-3" style={{ color: 'var(--text)' }}>Scan with your authenticator app</p>
                  <div className="flex items-start gap-4 flex-wrap">
                    <QRMock value={`otpauth://totp/SkoulHub:${email}`} />
                    <div className="flex-1 min-w-[200px]">
                      <p className="text-[11px] mb-1" style={{ color: 'var(--text-muted)' }}>Or enter this key manually</p>
                      <code className="block text-xs font-mono px-2.5 py-1.5 rounded-lg break-all"
                        style={{ background: 'var(--surface)', border: '1px solid var(--border-strong)', color: 'var(--text)' }}>
                        JBSWY3DPEHPK3PXP
                      </code>
                      <div className="flex items-center gap-2 mt-3">
                        <CodeInput value={authCode} label="Authenticator code" onChange={setAuthCode} />
                        <PrimaryButton onClick={confirmSetup}>Verify</PrimaryButton>
                        <GhostButton onClick={() => setSettingUp(null)}>Cancel</GhostButton>
                      </div>
                    </div>
                  </div>
                </div>
              )}
              {settingUp === 'passkey' && (
                <div className="rounded-xl border p-4 mt-2 flex items-center gap-3"
                  style={{ borderColor: 'var(--border-strong)', background: 'var(--surface-2)' }}>
                  <span className="text-2xl">🪪</span>
                  <div className="flex-1">
                    <p className="text-xs font-bold" style={{ color: 'var(--text)' }}>Register a passkey</p>
                    <p className="text-[11px]" style={{ color: 'var(--text-dim)' }}>
                      Your device will prompt for Face ID, Touch ID or a security key.
                    </p>
                  </div>
                  <PrimaryButton onClick={confirmSetup}>Register</PrimaryButton>
                  <GhostButton onClick={() => setSettingUp(null)}>Cancel</GhostButton>
                </div>
              )}
            </div>
          </Card>

          <Card>
            <SectionHeader title="Recovery codes"
              subtitle={codes ? 'Store these somewhere safe — they replace the old set' : `${prefs.mfa.recoveryCodesRemaining} unused codes remaining`}
              right={<GhostButton onClick={regenerateCodes}>Regenerate</GhostButton>} />
            <div className="p-5">
              {codes ? (
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {codes.map(c => (
                    <code key={c} className="text-xs font-mono text-center px-2 py-1.5 rounded-lg"
                      style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', color: 'var(--text)' }}>{c}</code>
                  ))}
                </div>
              ) : (
                <p className="text-xs" style={{ color: 'var(--text-dim)' }}>
                  Recovery codes let you sign in if you lose your second factor. Regenerating invalidates all previous codes.
                </p>
              )}
            </div>
          </Card>
        </div>
      )}

      {/* ══ PREFERENCES ══ */}
      {tab === 'preferences' && (
        <div className="space-y-4">
          <Card>
            <SectionHeader title="Appearance" subtitle="Applies to this device immediately" />
            <div className="p-5">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {THEME_OPTIONS.map(opt => {
                  const active = theme === opt.id;
                  return (
                    <button key={opt.id} onClick={() => { onTheme?.(opt.id); notify(`Theme set to ${opt.label.toLowerCase()}`); }}
                      className="rounded-xl border-2 p-4 text-left transition-all"
                      style={{ borderColor: active ? '#1E45FC' : 'var(--border-strong)', background: active ? 'var(--tint-blue)' : 'var(--surface)' }}>
                      <div className="text-xl mb-1.5">{opt.icon}</div>
                      <div className="text-sm font-bold" style={{ color: 'var(--text)' }}>{opt.label}</div>
                      <div className="text-[11px] mt-0.5" style={{ color: 'var(--text-dim)' }}>{opt.desc}</div>
                      {active && <div className="text-[10px] font-bold mt-2" style={{ color: 'var(--accent)' }}>✓ Selected</div>}
                    </button>
                  );
                })}
              </div>
            </div>
          </Card>

          <Card>
            <SectionHeader title="Notifications" subtitle="How SkoulHub reaches you" />
            <div>
              {[
                { key: 'email', label: 'Email notifications', desc: 'Report cards, invoices, announcements' },
                { key: 'sms',   label: 'SMS notifications',   desc: 'Fee reminders and urgent alerts' },
                { key: 'push',  label: 'Push notifications',  desc: 'Real-time activity in the browser' },
              ].map(n => (
                <div key={n.key} className="flex items-center gap-4 px-5 py-3.5 border-b last:border-0" style={{ borderColor: 'var(--border-subtle)' }}>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-semibold" style={{ color: 'var(--text)' }}>{n.label}</div>
                    <div className="text-[11px]" style={{ color: 'var(--text-dim)' }}>{n.desc}</div>
                  </div>
                  <Toggle label={n.label} checked={!!prefs.notifications[n.key]} onChange={() => toggleNotif(n.key)} />
                </div>
              ))}
              <div className="flex items-center gap-4 px-5 py-3.5">
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-semibold" style={{ color: 'var(--text)' }}>Email digest</div>
                  <div className="text-[11px]" style={{ color: 'var(--text-dim)' }}>How often we bundle non-urgent updates</div>
                </div>
                <div className="w-40">
                  <Select value={prefs.notifications.digest} onChange={e => updatePrefs({ notifications: { digest: e.target.value } })}>
                    {['realtime', 'daily', 'weekly', 'never'].map(d => <option key={d} value={d}>{d}</option>)}
                  </Select>
                </div>
              </div>
            </div>
          </Card>

          <Card>
            <SectionHeader title="Language &amp; region" subtitle="Formats dates, numbers and currency" />
            <div className="p-5 grid grid-cols-1 sm:grid-cols-3 gap-4">
              <Field label="Language">
                <Select value={prefs.locale.language} onChange={e => updatePrefs({ locale: { language: e.target.value } })}>
                  {[['en', 'English'], ['sw', 'Kiswahili'], ['lg', 'Luganda'], ['fr', 'Français']].map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                </Select>
              </Field>
              <Field label="Time zone">
                <Select value={prefs.locale.timezone} onChange={e => updatePrefs({ locale: { timezone: e.target.value } })}>
                  {['Africa/Kampala', 'Africa/Nairobi', 'Africa/Lagos', 'Europe/London', 'UTC'].map(t => <option key={t} value={t}>{t}</option>)}
                </Select>
              </Field>
              <Field label="Date format">
                <Select value={prefs.locale.dateFormat} onChange={e => updatePrefs({ locale: { dateFormat: e.target.value } })}>
                  {['DD/MM/YYYY', 'MM/DD/YYYY', 'YYYY-MM-DD'].map(d => <option key={d} value={d}>{d}</option>)}
                </Select>
              </Field>
            </div>
          </Card>
        </div>
      )}

      {/* ══ SESSIONS ══ */}
      {tab === 'sessions' && (
        <Card>
          <SectionHeader title="Active sessions" subtitle="Devices currently signed in to your account"
            right={<GhostButton onClick={() => notify('Signed out of all other devices')}>Sign out others</GhostButton>} />
          <div>
            {SESSIONS.map(s => (
              <div key={s.id} className="flex items-center gap-4 px-5 py-3.5 border-b last:border-0" style={{ borderColor: 'var(--border-subtle)' }}>
                <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: 'var(--surface-2)' }}>💻</div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-semibold truncate" style={{ color: 'var(--text)' }}>
                    {s.device} {s.current && <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full ml-1" style={{ background: 'var(--tint-green)', color: 'var(--ok)' }}>This device</span>}
                  </div>
                  <div className="text-[11px]" style={{ color: 'var(--text-dim)' }}>{s.location} · {s.last}</div>
                </div>
                {!s.current && (
                  <GhostButton onClick={() => notify(`Signed out ${s.device}`)}>Sign out</GhostButton>
                )}
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Toast */}
      {toast && (
        <div className="fixed bottom-5 right-5 z-[200] flex items-center gap-3 px-4 py-3 rounded-2xl shadow-lg text-sm font-semibold text-white animate-slide-up"
          style={{ background: toast.type === 'error' ? '#dc2626' : toast.type === 'warn' ? '#d97706' : '#059669', minWidth: 240, maxWidth: 340 }}>
          <span>{toast.type === 'error' ? '✕' : toast.type === 'warn' ? '⚠' : '✓'}</span>
          <span className="flex-1">{toast.msg}</span>
        </div>
      )}
    </div>
  );
}
