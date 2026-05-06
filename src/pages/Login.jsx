import { useState } from 'react';
import MFAFlow from './MFAFlow';
import { queryAllTenants, queryTenant, lookupUser } from '../lib/tenantStore';

const DEFAULT_ROLE = { id: 'school_admin', label: 'School Admin' };
const ALL_SCHOOLS = queryAllTenants();

/* ─── Main Login component ──────────────────────────────────── */
export default function Login({ onLogin }) {
  const [step, setStep]           = useState('email'); // email | mfa
  const [email, setEmail]         = useState('');
  const [emailError, setEmailErr] = useState('');
  const [schoolMode, setSchoolMode] = useState('select'); // 'select' | 'id'
  const [selectedSchool, setSelectedSchool] = useState('');
  const [tenantId, setTenantId]   = useState('');
  const [schoolError, setSchoolErr] = useState('');

  /* Step 1 – email */
  if (step === 'email') {
    const handleContinue = (e) => {
      e.preventDefault();
      const school = schoolMode === 'select' ? selectedSchool : tenantId.trim();
      if (!school) { setSchoolErr('Please select or enter your school.'); return; }

      // 1. Verify tenant exists
      const tenant = queryTenant(school);
      if (!tenant) { setSchoolErr('School not found. Check your Tenant ID.'); return; }
      setSchoolErr('');

      if (!email.includes('@')) { setEmailErr('Please enter a valid email address.'); return; }

      // 2. Verify user is enrolled at this school
      const user = lookupUser(email);
      if (!user) {
        setEmailErr('No account found for this email. Contact your administrator.');
        return;
      }
      if (user.school_id !== school) {
        setEmailErr('You are not enrolled at this school. Contact your administrator.');
        return;
      }
      setEmailErr('');
      setStep('mfa');
    };

    return (
      <LoginShell>
        <div className="animate-slide-up">
          <h1 className="text-2xl font-bold text-[#0B0F2A] mb-1" style={{ fontFamily: 'Fraunces, serif' }}>
            Sign In
          </h1>
          <p className="text-sm text-gray-400 mb-6">Welcome back! Please enter your details to continue</p>

          {/* Social buttons */}
          <div className="space-y-3 mb-5">
            <button className="w-full flex items-center gap-3 py-3 px-4 rounded-2xl border border-gray-200 bg-white hover:border-brand-blue hover:bg-[#f5f7ff] transition-all text-sm font-medium text-gray-700">
              <svg viewBox="0 0 24 24" width="18" height="18" className="flex-shrink-0">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"/>
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
              </svg>
              Continue with Google
            </button>
            <button className="w-full flex items-center gap-3 py-3 px-4 rounded-2xl border border-gray-200 bg-white hover:border-gray-400 hover:bg-gray-50 transition-all text-sm font-medium text-gray-700">
              <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor" className="flex-shrink-0">
                <path d="M12.152 6.896c-.948 0-2.415-1.078-3.96-1.04-2.04.027-3.91 1.183-4.961 3.014-2.117 3.675-.546 9.103 1.519 12.09 1.013 1.454 2.208 3.09 3.792 3.039 1.52-.065 2.09-.987 3.935-.987 1.831 0 2.35.987 3.96.948 1.637-.026 2.676-1.48 3.676-2.948 1.156-1.688 1.636-3.325 1.662-3.415-.039-.013-3.182-1.221-3.22-4.857-.026-3.04 2.48-4.494 2.597-4.559-1.429-2.09-3.623-2.324-4.39-2.376-2-.156-3.675 1.09-4.61 1.09zM15.53 3.83c.843-1.012 1.4-2.427 1.245-3.83-1.207.052-2.662.805-3.532 1.818-.78.896-1.454 2.338-1.273 3.714 1.338.104 2.715-.688 3.559-1.701"/>
              </svg>
              Continue with Apple
            </button>
          </div>

          {/* OR divider */}
          <div className="flex items-center gap-3 mb-5">
            <div className="flex-1 h-px bg-gray-100" />
            <span className="text-xs text-gray-400 uppercase tracking-wider">OR</span>
            <div className="flex-1 h-px bg-gray-100" />
          </div>

          <form onSubmit={handleContinue} className="space-y-4">
            {/* School selector */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-xs font-semibold text-gray-600">
                  School <span className="text-red-400">*</span>
                </label>
                <button
                  type="button"
                  onClick={() => { setSchoolMode(m => m === 'select' ? 'id' : 'select'); setSchoolErr(''); }}
                  className="text-xs text-brand-blue font-semibold hover:underline"
                >
                  {schoolMode === 'select' ? 'Enter Tenant ID instead' : 'Select from list'}
                </button>
              </div>

              {schoolMode === 'select' ? (
                <div className="relative">
                  <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none">
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round"><path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
                  </span>
                  <select
                    value={selectedSchool}
                    onChange={e => { setSelectedSchool(e.target.value); setSchoolErr(''); }}
                    className={`w-full pl-10 pr-4 py-3 rounded-2xl border text-sm bg-white outline-none appearance-none transition-all
                      focus:border-brand-blue focus:ring-2 focus:ring-brand-blue/15 text-gray-700
                      ${schoolError ? 'border-red-400' : 'border-gray-200'}`}
                  >
                    <option value="">— Select your school —</option>
                    {ALL_SCHOOLS.map(s => (
                      <option key={s.school_id} value={s.school_id}>{s.name}</option>
                    ))}
                  </select>
                  <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none">
                    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="M2 4l4 4 4-4"/></svg>
                  </span>
                </div>
              ) : (
                <div className="relative">
                  <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400">
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round"><rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 21V5a2 2 0 00-2-2h-4a2 2 0 00-2 2v16"/></svg>
                  </span>
                  <input
                    type="text"
                    value={tenantId}
                    onChange={e => { setTenantId(e.target.value); setSchoolErr(''); }}
                    placeholder="e.g. sch-xxxxxxxx-xxxx-xxxx"
                    className={`w-full pl-10 pr-4 py-3 rounded-2xl border text-sm bg-white outline-none transition-all font-mono
                      focus:border-brand-blue focus:ring-2 focus:ring-brand-blue/15
                      ${schoolError ? 'border-red-400' : 'border-gray-200'}`}
                  />
                </div>
              )}
              {schoolError && <p className="mt-1.5 text-xs text-red-500">{schoolError}</p>}
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1.5">
                Email <span className="text-red-400">*</span>
              </label>
              <div className="relative">
                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400">
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round">
                    <rect x="2" y="4" width="20" height="16" rx="3"/><path d="M2 8l10 6 10-6"/>
                  </svg>
                </span>
                <input
                  type="email"
                  value={email}
                  onChange={e => { setEmail(e.target.value); setEmailErr(''); }}
                  placeholder="hello@school.ug"
                  autoFocus
                  className={`w-full pl-10 pr-4 py-3 rounded-2xl border text-sm bg-white outline-none transition-all
                    focus:border-brand-blue focus:ring-2 focus:ring-brand-blue/15
                    ${emailError ? 'border-red-400' : 'border-gray-200'}`}
                />
              </div>
              {emailError && <p className="mt-1.5 text-xs text-red-500">{emailError}</p>}
            </div>

            <button type="submit" className="btn-brand-primary w-full mt-1 rounded-2xl py-3">
              Sign in
            </button>
          </form>

        </div>
      </LoginShell>
    );
  }

  /* Step 2 – MFA */
  if (step === 'mfa') {
    return (
      <MFAFlow
        role={DEFAULT_ROLE}
        email={email}
        onBack={() => setStep('email')}
        onSuccess={() => onLogin(email, DEFAULT_ROLE.id)}
      />
    );
  }
}

/* ─── Shell ─────────────────────────────────────────────────── */

export function LoginShell({ children }) {
  return (
    <div
      className="min-h-screen flex items-center justify-center px-4"
      style={{ background: 'linear-gradient(135deg, #0B0F2A 0%, #1535d4 60%, #1E45FC 100%)' }}
    >
      {/* Card — centred, constrained width, auto height */}
      <div
        className="w-full max-w-md bg-white shadow-2xl rounded-2xl px-10 py-12"
      >
        {/* Logo */}
        <div className="mb-8">
          <span className="font-bold text-3xl leading-none" style={{ color: '#1E45FC' }}>
            Skoul<span style={{ color: '#A3CF2E' }}>Hub</span>
          </span>
          <div className="flex items-center gap-2 mt-1">
            <span className="h-0.5 w-5 rounded-full" style={{ background: '#1E45FC' }} />
            <span className="text-xs font-medium text-gray-500 tracking-wide">Smart School. Better Future.</span>
            <span className="h-0.5 w-5 rounded-full" style={{ background: '#A3CF2E' }} />
          </div>
        </div>

        {/* Step content */}
        {children}
      </div>
    </div>
  );
}

/* ─── Reusable atoms ───────────────────────────────────────── */
export function Logo() {
  return (
    <div className="flex items-center gap-3">
      <img src="/skoulhub-logo.png" alt="SkoulHub" className="w-12 h-12 object-contain" />
      <div className="flex flex-col gap-1">
        <span className="font-bold text-2xl leading-none" style={{ color: '#1E45FC' }}>
          Skoul<span style={{ color: '#A3CF2E' }}>Hub</span>
        </span>
        <div className="flex items-center gap-2">
          <span className="h-0.5 w-4 rounded-full" style={{ background: '#1E45FC' }} />
          <span className="text-[11px] font-medium text-gray-500 tracking-wide">Smart School. Better Future.</span>
          <span className="h-0.5 w-4 rounded-full" style={{ background: '#A3CF2E' }} />
        </div>
      </div>
    </div>
  );
}

export function LogoIcon({ size = 'md', white = false }) {
  const dim = size === 'lg' ? 44 : size === 'sm' ? 28 : 36;
  return (
    <img
      src="/skoulhub-logo.png"
      alt="SkoulHub"
      width={dim}
      height={dim}
      style={{ objectFit: 'contain', filter: white ? 'brightness(0) invert(1)' : 'none' }}
    />
  );
}

export function ArrowRight() {
  return (
    <svg width="15" height="15" viewBox="0 0 15 15" fill="none">
      <path d="M1 7.5H14M8.5 2L14 7.5L8.5 13" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}

export function PasskeyIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="8" cy="8" r="4"/>
      <path d="M16 20v-2a4 4 0 00-4-4H4a4 4 0 00-4 4v2"/>
      <line x1="19" y1="8" x2="19" y2="14"/>
      <line x1="22" y1="11" x2="16" y2="11"/>
    </svg>
  );
}
