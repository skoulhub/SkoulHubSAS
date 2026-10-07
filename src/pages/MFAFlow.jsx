import { useState, useRef, useEffect } from 'react';
import { LoginShell, ArrowRight } from './Login';

const METHODS = [
  {
    id: 'otp',
    label: 'Email / SMS OTP',
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
        <rect x="2" y="4" width="20" height="16" rx="3"/>
        <path d="M2 8l10 6 10-6"/>
      </svg>
    ),
    desc: 'Receive a 6-digit code by email or SMS',
    badge: null,
  },
  {
    id: 'authapp',
    label: 'Authenticator App',
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
        <rect x="5" y="2" width="14" height="20" rx="2"/>
        <path d="M9 7h6M9 11h6M9 15h3"/>
        <circle cx="16" cy="15" r="2.5"/>
        <path d="M16 12.5v.5M16 17v.5M13.5 15h.5M18 15h.5M14.6 13.1l.35.35M17.65 16.15l.35.35M14.6 16.9l.35-.35M17.65 13.85l.35-.35"/>
      </svg>
    ),
    desc: 'Use Google Authenticator or Authy',
    badge: 'Recommended',
  },
  {
    id: 'passkey',
    label: 'Passkey / Biometric',
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 11c-1.7 0-3-1.3-3-3s1.3-3 3-3 3 1.3 3 3-1.3 3-3 3z"/>
        <path d="M17.6 21H6.4C5.6 21 5 20.3 5.1 19.5c.5-3.5 3.4-6 6.9-6s6.4 2.5 6.9 6c.1.8-.5 1.5-1.3 1.5z"/>
        <path d="M9 8c.3-1.7 1.7-3 3.3-3"/>
        <path d="M3 15c.8-3.5 3.8-6.1 7.4-6.6"/>
      </svg>
    ),
    desc: 'Face ID, Touch ID or hardware key',
    badge: 'Passwordless',
  },
];

export default function MFAFlow({ role, email, onBack, onSuccess }) {
  const [method, setMethod] = useState(null); // null | 'otp' | 'authapp' | 'passkey'

  /* ── Method selector ─────────────────────────── */
  if (!method) {
    return (
      <LoginShell>
        <div className="animate-slide-up">
          <button onClick={onBack}
            className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-brand-blue mb-6 transition-colors">
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path d="M9 2L4 7L9 12" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            Back
          </button>

          <div className="text-center mb-7">
            
            <div className="mt-4 inline-flex items-center gap-2 bg-blue-50 border border-blue-100 rounded-full px-3 py-1">
              <span className="text-xs font-semibold text-brand-blue">
                {email ? email.split('@')[0] : 'User'}
              </span>
              {role?.label && (
                <>
                  <span className="text-brand-blue/40">·</span>
                  <span className="text-xs font-bold px-2 py-0.5 rounded-full" style={{ background: 'var(--tint-blue)', color: '#1E45FC' }}>
                    {role.label}
                  </span>
                </>
              )}
            </div>
            <h1 className="mt-4 text-xl font-bold text-brand-navy font-display">Choose verification method</h1>
            <p className="mt-1 text-sm text-gray-500">All methods are passwordless and secure</p>
          </div>

          <div className="flex flex-col gap-3">
            {METHODS.map(m => (
              <button
                key={m.id}
                onClick={() => setMethod(m.id)}
                className="relative flex items-center gap-4 p-4 rounded-xl border-2 border-gray-200 bg-white text-left
                  hover:border-brand-blue hover:bg-brand-blue-light hover:shadow-md transition-all duration-150 group"
              >
                <div className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 transition-colors
                  bg-gray-50 group-hover:bg-brand-blue group-hover:text-white text-gray-500">
                  {m.icon}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-sm text-brand-navy">{m.label}</span>
                    {m.badge && (
                      <span className="text-xs font-bold px-2 py-0.5 rounded-full"
                        style={{ background: m.badge === 'Recommended' ? '#A3CF2E' : 'var(--tint-blue)', color: m.badge === 'Recommended' ? '#1a2a00' : '#1E45FC' }}>
                        {m.badge}
                      </span>
                    )}
                  </div>
                  <span className="text-xs text-gray-400">{m.desc}</span>
                </div>
                <svg className="text-gray-300 group-hover:text-brand-blue transition-colors" width="16" height="16" viewBox="0 0 16 16" fill="none">
                  <path d="M4 8H12M8 4L12 8L8 12" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </button>
            ))}
          </div>

          <SecurityBadge />
        </div>
      </LoginShell>
    );
  }

  if (method === 'otp')     return <OTPMethod     email={email} onBack={() => setMethod(null)} onSuccess={onSuccess} />;
  if (method === 'authapp') return <AuthAppMethod  email={email} onBack={() => setMethod(null)} onSuccess={onSuccess} />;
  if (method === 'passkey') return <PasskeyMethod  onBack={() => setMethod(null)} onSuccess={onSuccess} />;
}

/* ══════════════════════════════════════════════════
   METHOD 1 – Email / SMS OTP
═══════════════════════════════════════════════════ */
function OTPMethod({ email, onBack, onSuccess }) {
  const [digits, setDigits]   = useState(['','','','','','']);
  const [timer, setTimer]     = useState(59);
  const [verifying, setVerif] = useState(false);
  const [error, setError]     = useState('');
  const refs = [useRef(), useRef(), useRef(), useRef(), useRef(), useRef()];

  useEffect(() => {
    if (timer <= 0) return;
    const t = setTimeout(() => setTimer(t => t - 1), 1000);
    return () => clearTimeout(t);
  }, [timer]);

  const handleDigit = (idx, val) => {
    if (!/^\d?$/.test(val)) return;
    const next = [...digits];
    next[idx] = val;
    setDigits(next);
    setError('');
    if (val && idx < 5) refs[idx + 1].current?.focus();
  };

  const handleKeyDown = (idx, e) => {
    if (e.key === 'Backspace' && !digits[idx] && idx > 0) refs[idx - 1].current?.focus();
    if (e.key === 'ArrowLeft' && idx > 0) refs[idx - 1].current?.focus();
    if (e.key === 'ArrowRight' && idx < 5) refs[idx + 1].current?.focus();
  };

  const handlePaste = (e) => {
    const text = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    if (text.length === 6) {
      setDigits(text.split(''));
      refs[5].current?.focus();
    }
  };

  const handleVerify = () => {
    const code = digits.join('');
    if (code.length < 6) { setError('Please enter all 6 digits.'); return; }
    setVerif(true);
    // Simulate verification — accept any 6-digit code in demo
    setTimeout(() => {
      setVerif(false);
      onSuccess();
    }, 1500);
  };

  const filled = digits.every(d => d !== '');

  return (
    <LoginShell>
      <div className="animate-slide-up">
        <BackBtn onClick={onBack} />

        <div className="text-center mb-7">
          
          <div className="mt-4 w-14 h-14 rounded-2xl bg-blue-50 flex items-center justify-center mx-auto">
            <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#1E45FC" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
              <rect x="2" y="4" width="20" height="16" rx="3"/>
              <path d="M2 8l10 6 10-6"/>
            </svg>
          </div>
          <h1 className="mt-3 text-xl font-bold text-brand-navy font-display">Check your email</h1>
          <p className="mt-1 text-sm text-gray-500">
            We sent a 6-digit code to <span className="font-semibold text-brand-navy">{email || 'your email'}</span>
          </p>
        </div>

        {/* OTP Input */}
        <div className="flex justify-center gap-2.5 mb-2" onPaste={handlePaste}>
          {digits.map((d, i) => (
            <input
              key={i}
              ref={refs[i]}
              type="text"
              inputMode="numeric"
              maxLength={1}
              value={d}
              onChange={e => handleDigit(i, e.target.value)}
              onKeyDown={e => handleKeyDown(i, e)}
              autoFocus={i === 0}
              className={`w-12 h-14 text-center text-xl font-bold rounded-xl border-2 outline-none transition-all bg-white
                focus:border-brand-blue focus:ring-2 focus:ring-brand-blue/15
                ${error ? 'border-red-400 shake' : d ? 'border-brand-blue bg-brand-blue-light' : 'border-gray-200'}`}
            />
          ))}
        </div>

        {error && <p className="text-center text-xs text-red-500 mb-3">{error}</p>}

        <button
          onClick={handleVerify}
          disabled={!filled || verifying}
          className={`btn-brand-primary w-full mt-4 ${(!filled || verifying) ? 'opacity-60 cursor-not-allowed' : ''}`}
        >
          {verifying ? <Spinner /> : <>Verify Code <ArrowRight /></>}
        </button>

        <div className="mt-5 text-center">
          {timer > 0 ? (
            <span className="text-xs text-gray-400">Resend code in <span className="font-semibold text-brand-navy">0:{String(timer).padStart(2,'0')}</span></span>
          ) : (
            <button onClick={() => { setTimer(59); setDigits(['','','','','','']); }}
              className="text-xs text-brand-blue font-semibold hover:underline">
              Resend code
            </button>
          )}
        </div>

        <SecurityBadge />
      </div>
    </LoginShell>
  );
}

/* ══════════════════════════════════════════════════
   METHOD 2 – Authenticator App
═══════════════════════════════════════════════════ */
function AuthAppMethod({ email, onBack, onSuccess }) {
  const [digits, setDigits]   = useState(['','','','','','']);
  const [verifying, setVerif] = useState(false);
  const [error, setError]     = useState('');
  const [showSetup, setSetup] = useState(false);
  const refs = [useRef(), useRef(), useRef(), useRef(), useRef(), useRef()];

  const handleDigit = (idx, val) => {
    if (!/^\d?$/.test(val)) return;
    const next = [...digits];
    next[idx] = val;
    setDigits(next);
    setError('');
    if (val && idx < 5) refs[idx + 1].current?.focus();
  };

  const handleKeyDown = (idx, e) => {
    if (e.key === 'Backspace' && !digits[idx] && idx > 0) refs[idx - 1].current?.focus();
  };

  const handlePaste = (e) => {
    const text = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    if (text.length === 6) { setDigits(text.split('')); refs[5].current?.focus(); }
  };

  const handleVerify = () => {
    const code = digits.join('');
    if (code.length < 6) { setError('Please enter the 6-digit TOTP code.'); return; }
    setVerif(true);
    setTimeout(() => { setVerif(false); onSuccess(); }, 1500);
  };

  const filled = digits.every(d => d !== '');

  return (
    <LoginShell>
      <div className="animate-slide-up">
        <BackBtn onClick={onBack} />

        <div className="text-center mb-6">
          
          <div className="mt-4 w-14 h-14 rounded-2xl bg-brand-blue-light flex items-center justify-center mx-auto">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#1E45FC" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
              <rect x="5" y="2" width="14" height="20" rx="2"/>
              <path d="M9 7h6M9 11h6M9 15h3"/>
              <circle cx="16" cy="15" r="2.5"/>
            </svg>
          </div>
          <h1 className="mt-3 text-xl font-bold text-brand-navy font-display">Authenticator App</h1>
          <p className="mt-1 text-sm text-gray-500">Enter the 6-digit code from your auth app</p>
        </div>

        {/* Setup hint */}
        <div className="mb-5 rounded-xl border border-dashed border-blue-200 bg-blue-50/60 p-3.5 text-xs text-blue-700">
          <div className="flex items-start gap-2">
            <svg className="flex-shrink-0 mt-0.5" width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5">
              <circle cx="7" cy="7" r="6"/><path d="M7 4.5v3M7 9.5v.5"/>
            </svg>
            <div>
              Open <strong>Google Authenticator</strong>, <strong>Authy</strong>, or <strong>1Password</strong> and enter the rotating code.
              <button onClick={() => setSetup(!showSetup)} className="ml-1 underline font-semibold">
                {showSetup ? 'Hide' : 'Don\'t have an app? Set up now'}
              </button>
            </div>
          </div>
        </div>

        {/* Setup QR mock */}
        {showSetup && (
          <div className="mb-5 rounded-xl border border-gray-200 bg-white p-4">
            <p className="text-xs font-semibold text-gray-600 mb-3">Scan this QR code with your auth app</p>
            <div className="flex items-center gap-4">
              {/* Mock QR */}
              <div className="w-24 h-24 rounded-lg bg-white border border-gray-200 p-1.5 flex-shrink-0">
                <QRMock />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs text-gray-500 mb-1">Or enter this secret key manually:</p>
                <code className="block text-xs font-mono bg-gray-50 border border-gray-200 rounded px-2 py-1.5 tracking-widest text-brand-navy break-all">
                  JBSWY3DPEHPK3PXP
                </code>
                <p className="text-xs text-gray-400 mt-2">Account: <span className="font-medium text-gray-600">{email || 'you@school.ug'}</span></p>
              </div>
            </div>
          </div>
        )}

        {/* Code input */}
        <div className="flex justify-center gap-2.5 mb-2" onPaste={handlePaste}>
          {digits.map((d, i) => (
            <input
              key={i} ref={refs[i]}
              type="text" inputMode="numeric" maxLength={1}
              value={d}
              onChange={e => handleDigit(i, e.target.value)}
              onKeyDown={e => handleKeyDown(i, e)}
              autoFocus={i === 0 && !showSetup}
              className={`w-12 h-14 text-center text-xl font-bold rounded-xl border-2 outline-none transition-all bg-white
                focus:border-brand-blue focus:ring-2 focus:ring-brand-blue/15
                ${error ? 'border-red-400' : d ? 'border-brand-blue bg-brand-blue-light' : 'border-gray-200'}`}
            />
          ))}
        </div>
        {error && <p className="text-center text-xs text-red-500 mb-2">{error}</p>}

        <button
          onClick={handleVerify}
          disabled={!filled || verifying}
          className={`btn-brand-primary w-full mt-3 ${(!filled || verifying) ? 'opacity-60 cursor-not-allowed' : ''}`}
        >
          {verifying ? <Spinner /> : <>Verify Code <ArrowRight /></>}
        </button>

        <SecurityBadge />
      </div>
    </LoginShell>
  );
}

/* ══════════════════════════════════════════════════
   METHOD 3 – Passkey / Biometric
═══════════════════════════════════════════════════ */
function PasskeyMethod({ onBack, onSuccess }) {
  const [state, setState] = useState('idle'); // idle | waiting | success | error

  const handleAuth = () => {
    setState('waiting');
    setTimeout(() => {
      setState('success');
      setTimeout(onSuccess, 1200);
    }, 2500);
  };

  return (
    <LoginShell>
      <div className="animate-slide-up">
        <BackBtn onClick={onBack} />

        <div className="text-center mb-8">
          
          <h1 className="mt-5 text-xl font-bold text-brand-navy font-display">Passkey Authentication</h1>
          <p className="mt-1 text-sm text-gray-500">Use biometrics or a hardware key to sign in instantly</p>
        </div>

        {/* Big visual */}
        <div className="flex flex-col items-center mb-8">
          <div className={`relative w-28 h-28 rounded-3xl flex items-center justify-center mb-4 transition-all duration-500
            ${state === 'waiting' ? 'scale-110' : ''}
            ${state === 'success' ? 'scale-105' : ''}`}
            style={{
              background: state === 'success'
                ? 'linear-gradient(135deg, #10b981, #059669)'
                : state === 'waiting'
                ? 'linear-gradient(135deg, #1E45FC, #1535d4)'
                : 'linear-gradient(135deg, #e8ecff, #c7d2ff)',
            }}>

            {state === 'idle' && (
              <svg width="52" height="52" viewBox="0 0 24 24" fill="none" stroke="#1E45FC" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 11c-1.7 0-3-1.3-3-3s1.3-3 3-3 3 1.3 3 3-1.3 3-3 3z"/>
                <path d="M17.6 21H6.4C5.6 21 5 20.3 5.1 19.5c.5-3.5 3.4-6 6.9-6s6.4 2.5 6.9 6c.1.8-.5 1.5-1.3 1.5z"/>
              </svg>
            )}

            {state === 'waiting' && (
              <div className="relative flex items-center justify-center">
                <svg className="animate-spin-slow" width="52" height="52" viewBox="0 0 52 52" fill="none">
                  <circle cx="26" cy="26" r="22" stroke="rgba(255,255,255,0.25)" strokeWidth="3"/>
                  <path d="M26 4 A22 22 0 0 1 48 26" stroke="white" strokeWidth="3" strokeLinecap="round"/>
                </svg>
                <svg className="absolute" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 11c-1.7 0-3-1.3-3-3s1.3-3 3-3 3 1.3 3 3-1.3 3-3 3z"/>
                  <path d="M17.6 21H6.4C5.6 21 5 20.3 5.1 19.5c.5-3.5 3.4-6 6.9-6s6.4 2.5 6.9 6c.1.8-.5 1.5-1.3 1.5z"/>
                </svg>
              </div>
            )}

            {state === 'success' && (
              <svg width="44" height="44" viewBox="0 0 44 44" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M8 22L18 32L36 14" className="animate-fade-in"/>
              </svg>
            )}

            {/* Pulse ring */}
            {state === 'waiting' && (
              <>
                <div className="absolute inset-0 rounded-3xl border-2 border-white/30 animate-ping" />
                <div className="absolute -inset-3 rounded-[2rem] border border-blue-300/30 animate-ping" style={{ animationDelay: '0.3s' }} />
              </>
            )}
          </div>

          <h3 className={`text-base font-semibold transition-colors ${state === 'success' ? 'text-green-600' : 'text-brand-navy'}`}>
            {state === 'idle'    && 'Ready to authenticate'}
            {state === 'waiting' && 'Waiting for your device…'}
            {state === 'success' && 'Identity verified!'}
            {state === 'error'   && 'Authentication failed'}
          </h3>
          <p className="mt-1 text-xs text-gray-400 text-center max-w-xs">
            {state === 'idle'    && 'Click below to trigger biometric or hardware key verification'}
            {state === 'waiting' && 'Use Face ID, Touch ID, or press your security key'}
            {state === 'success' && 'Redirecting to your dashboard…'}
            {state === 'error'   && 'Please try again or choose another method'}
          </p>
        </div>

        {/* Method options */}
        {state === 'idle' && (
          <div className="flex flex-col gap-3 mb-4">
            {[
              { icon: '🪪', label: 'Face ID / Facial Recognition' },
              { icon: '👆', label: 'Touch ID / Fingerprint' },
              { icon: '🔑', label: 'Hardware Security Key (YubiKey)' },
            ].map((opt, i) => (
              <button
                key={i}
                onClick={handleAuth}
                className="flex items-center gap-3 px-4 py-3 rounded-xl border border-gray-200 bg-white
                  hover:border-brand-blue hover:bg-brand-blue-light transition-all text-sm font-medium text-brand-navy"
              >
                <span className="text-xl">{opt.icon}</span>
                {opt.label}
                <svg className="ml-auto text-gray-300" width="14" height="14" viewBox="0 0 14 14" fill="none">
                  <path d="M4 7H10M7 4L10 7L7 10" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </button>
            ))}
          </div>
        )}

        {state === 'waiting' && (
          <div className="flex justify-center mb-4">
            <button onClick={() => setState('idle')} className="text-sm text-gray-400 hover:text-brand-blue transition-colors">
              Cancel
            </button>
          </div>
        )}

        {state === 'error' && (
          <button onClick={() => setState('idle')} className="btn-brand-primary w-full mb-4">
            Try Again <ArrowRight />
          </button>
        )}

        <SecurityBadge />
      </div>
    </LoginShell>
  );
}

/* ─── Shared sub-components ─────────────────────── */
function BackBtn({ onClick }) {
  return (
    <button onClick={onClick}
      className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-brand-blue mb-6 transition-colors">
      <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
        <path d="M9 2L4 7L9 12" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
      Back
    </button>
  );
}

function SecurityBadge() {
  return (
    <div className="mt-6 flex items-center justify-center gap-1.5 text-xs text-gray-400">
      <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5">
        <path d="M6 1L10.5 3V6C10.5 8.5 8.5 10.7 6 11C3.5 10.7 1.5 8.5 1.5 6V3L6 1Z"/>
      </svg>
      Secured by 256-bit encryption · GDPR compliant
    </div>
  );
}

function Spinner() {
  return (
    <svg className="animate-spin" width="18" height="18" viewBox="0 0 18 18" fill="none">
      <circle cx="9" cy="9" r="7" stroke="currentColor" strokeWidth="2" strokeOpacity="0.3"/>
      <path d="M9 2A7 7 0 0 1 16 9" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
    </svg>
  );
}

function QRMock() {
  // Minimal SVG QR-code-looking grid
  const cells = [
    [1,1,1,1,1,1,1,0,1,0,1,1,1,1,1,1,1],
    [1,0,0,0,0,0,1,0,0,1,1,0,0,0,0,0,1],
    [1,0,1,1,1,0,1,0,1,0,1,0,1,1,1,0,1],
    [1,0,1,1,1,0,1,0,0,1,1,0,1,1,1,0,1],
    [1,0,1,1,1,0,1,0,1,1,1,0,1,1,1,0,1],
    [1,0,0,0,0,0,1,0,0,0,1,0,0,0,0,0,1],
    [1,1,1,1,1,1,1,0,1,0,1,1,1,1,1,1,1],
    [0,0,0,0,0,0,0,0,1,1,0,0,0,0,0,0,0],
    [1,0,1,0,1,1,1,1,1,0,1,1,0,1,1,0,1],
    [0,0,0,0,0,0,0,0,1,0,0,0,1,0,1,1,0],
    [1,1,1,1,1,1,1,0,1,0,1,0,1,0,1,0,1],
    [1,0,0,0,0,0,1,0,0,1,0,1,0,1,1,1,0],
    [1,0,1,1,1,0,1,0,1,0,1,1,1,0,0,1,1],
    [1,0,1,1,1,0,1,0,0,1,0,1,0,1,0,0,1],
    [1,0,1,1,1,0,1,0,1,0,1,0,1,1,1,0,1],
    [1,0,0,0,0,0,1,0,0,1,0,0,0,0,1,1,0],
    [1,1,1,1,1,1,1,0,1,0,1,1,0,1,0,1,1],
  ];
  const size = 17;
  const cell = 100 / size;
  return (
    <svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
      {cells.map((row, r) =>
        row.map((col, c) =>
          col ? <rect key={`${r}-${c}`} x={c * cell} y={r * cell} width={cell - 0.5} height={cell - 0.5} fill="#0B0F2A"/> : null
        )
      )}
    </svg>
  );
}

export { ArrowRight };
