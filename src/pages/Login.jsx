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
const BADGES = [
  { label: 'Mobile Apps',            sub: 'iOS & Android',      color: '#1E45FC', bg: '#eef3ff', icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#1E45FC" strokeWidth="1.8" strokeLinecap="round"><rect x="5" y="2" width="14" height="20" rx="2"/><line x1="12" y1="18" x2="12" y2="18.01"/></svg> },
  { label: 'Report Cards',           sub: 'Auto generation',    color: '#A3CF2E', bg: '#f0f9d8', icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#A3CF2E" strokeWidth="1.8" strokeLinecap="round"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg> },
  { label: 'Results & Grading',      sub: 'Smart scoring',      color: '#1E45FC', bg: '#eef3ff', icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#1E45FC" strokeWidth="1.8" strokeLinecap="round"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg> },
  { label: 'Attendance Tracking',    sub: 'Real-time',          color: '#A3CF2E', bg: '#f0f9d8', icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#A3CF2E" strokeWidth="1.8" strokeLinecap="round"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87"/><path d="M16 3.13a4 4 0 010 7.75"/></svg> },
  { label: 'Timetables',             sub: 'Auto scheduling',    color: '#1E45FC', bg: '#eef3ff', icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#1E45FC" strokeWidth="1.8" strokeLinecap="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg> },
  { label: 'Student Management',     sub: 'Full profiles',      color: '#A3CF2E', bg: '#f0f9d8', icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#A3CF2E" strokeWidth="1.8" strokeLinecap="round"><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/></svg> },
  { label: 'Teacher Management',     sub: 'HR & payroll',       color: '#1E45FC', bg: '#eef3ff', icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#1E45FC" strokeWidth="1.8" strokeLinecap="round"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75"/></svg> },
  { label: 'ID Cards',               sub: 'Print & digital',    color: '#A3CF2E', bg: '#f0f9d8', icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#A3CF2E" strokeWidth="1.8" strokeLinecap="round"><rect x="2" y="5" width="20" height="14" rx="2"/><circle cx="8" cy="12" r="2"/><path d="M14 9h4M14 12h4M14 15h2"/></svg> },
  { label: 'Fee Management',         sub: 'Collections',        color: '#1E45FC', bg: '#eef3ff', icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#1E45FC" strokeWidth="1.8" strokeLinecap="round"><rect x="1" y="4" width="22" height="16" rx="2"/><line x1="1" y1="10" x2="23" y2="10"/></svg> },
  { label: 'Expense Tracking',       sub: 'Budget control',     color: '#A3CF2E', bg: '#f0f9d8', icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#A3CF2E" strokeWidth="1.8" strokeLinecap="round"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6"/></svg> },
  { label: 'Payroll',                sub: 'Staff salaries',     color: '#1E45FC', bg: '#eef3ff', icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#1E45FC" strokeWidth="1.8" strokeLinecap="round"><rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 21V5a2 2 0 00-2-2h-4a2 2 0 00-2 2v16"/></svg> },
  { label: 'Security & Access',      sub: 'Role-based',         color: '#A3CF2E', bg: '#f0f9d8', icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#A3CF2E" strokeWidth="1.8" strokeLinecap="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg> },
  { label: 'Notifications',          sub: 'SMS & push',         color: '#1E45FC', bg: '#eef3ff', icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#1E45FC" strokeWidth="1.8" strokeLinecap="round"><path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 01-3.46 0"/></svg> },
];

// Three concentric ellipses: inner(5), middle(4), outer(4)
// Centre at cx=50%, cy=34% — upper area above the illustration
const ORBIT_RINGS = [
  { count: 5, rx: 88,  ry: 52,  duration: 42, dir:  1 },
  { count: 4, rx: 130, ry: 76,  duration: 56, dir: -1 },
  { count: 4, rx: 168, ry: 98,  duration: 68, dir:  1 },
];
const cx = 50; // % from left of panel
const cy = 34; // % from top of panel

const ORBITS = (() => {
  const result = [];
  let bi = 0;
  ORBIT_RINGS.forEach(({ count, rx, ry, duration, dir }) => {
    for (let j = 0; j < count && bi < BADGES.length; j++, bi++) {
      const angleDeg = (j / count) * 360 * dir;
      const delay = -(j * (duration / count));
      result.push({ ...BADGES[bi], cx, cy, rx, ry, angleDeg, duration, delay, dir });
    }
  });
  return result;
})();

export function LoginShell({ children }) {
  return (
    <div
      className="min-h-screen flex items-center justify-center"
      style={{ background: 'linear-gradient(135deg, #0B0F2A 0%, #1535d4 60%, #1E45FC 100%)' }}
    >
      <style>{`
        ${ORBITS.map((o, i) => `
          @keyframes orbit${i} {
            from { transform: translate(calc(${o.rx}px * cos(0deg)), calc(${o.ry}px * sin(0deg))); }
          }
        `).join('')}
        ${ORBITS.map((o, i) => {
          // Generate 8 keyframe stops around the ellipse
          const stops = Array.from({ length: 9 }, (_, k) => {
            const a = ((o.angleDeg + k * 45) * Math.PI) / 180;
            const tx = (o.rx * Math.cos(a)).toFixed(1);
            const ty = (o.ry * Math.sin(a)).toFixed(1);
            return `${k * 12.5}% { transform: translate(${tx}px, ${ty}px); }`;
          }).join('\n            ');
          return `@keyframes orb${i} {\n            ${stops}\n          }`;
        }).join('\n          ')}
        ${ORBITS.map((o, i) => `.sh-badge-${i} {
            position: absolute;
            left: calc(${o.cx}% - 60px);
            top: calc(${o.cy}% - 18px);
            animation: orb${i} ${o.duration}s linear ${o.delay}s infinite;
            pointer-events: none;
          }`).join('\n          ')}
      `}</style>

      {/* Card — no rounded corners, 75vh */}
      <div
        className="w-full max-w-6xl overflow-hidden shadow-2xl flex"
        style={{ minHeight: '75vh', maxHeight: '75vh' }}
      >
        {/* Left — form panel */}
        <div className="flex-1 bg-white flex flex-col justify-center px-10 py-8 lg:px-14 overflow-y-auto">
          {/* Logo */}
          <div className="mb-8">
            <div className="flex items-center gap-3">
              <img src="/skoulhub-logo.png" alt="SkoulHub" className="w-14 h-14 object-contain" />
              <div className="flex flex-col gap-1">
                <span className="font-bold text-3xl leading-none" style={{ color: '#1E45FC' }}>
                  Skoul<span style={{ color: '#A3CF2E' }}>Hub</span>
                </span>
                <div className="flex items-center gap-2">
                  <span className="h-0.5 w-5 rounded-full" style={{ background: '#1E45FC' }} />
                  <span className="text-xs font-medium text-gray-500 tracking-wide">Smart School. Better Future.</span>
                  <span className="h-0.5 w-5 rounded-full" style={{ background: '#A3CF2E' }} />
                </div>
              </div>
            </div>
          </div>

          {/* Slot for step content */}
          <div className="w-full max-w-sm">
            {children}
          </div>
        </div>

        {/* Right — illustration panel */}
        <div
          className="hidden lg:block w-[46%] flex-shrink-0 relative overflow-hidden"
          style={{ background: 'linear-gradient(170deg, #eef3ff 0%, #f5faff 55%, #f0f9d8 100%)' }}
        >
          {/* Glow accents */}
          <div className="absolute top-0 right-0 w-72 h-72 rounded-full pointer-events-none"
            style={{ background: 'radial-gradient(circle, rgba(30,69,252,0.1) 0%, transparent 70%)', transform: 'translate(25%,-25%)' }} />
          <div className="absolute bottom-10 left-0 w-56 h-56 rounded-full pointer-events-none"
            style={{ background: 'radial-gradient(circle, rgba(163,207,46,0.15) 0%, transparent 70%)', transform: 'translate(-30%,0)' }} />

          {/* Orbiting badges */}
          {ORBITS.map((o, i) => (
            <div key={i} className={`sh-badge-${i} flex items-center gap-1.5 bg-white rounded-xl shadow-md px-2.5 py-1.5`} style={{ width: '138px' }}>
              <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: o.bg }}>
                {o.icon}
              </div>
              <div>
                <div className="text-[9px] font-bold text-[#0B0F2A] leading-tight">{o.label}</div>
                <div className="text-[8px] text-gray-400 leading-tight">{o.sub}</div>
              </div>
            </div>
          ))}

          {/* School illustration */}
          <svg viewBox="0 0 400 300" fill="none" xmlns="http://www.w3.org/2000/svg"
            className="absolute bottom-0 left-0 w-full">
            <rect x="0" y="265" width="400" height="35" fill="#A3CF2E" opacity="0.15"/>
            <line x1="0" y1="265" x2="400" y2="265" stroke="#A3CF2E" strokeWidth="1.5" opacity="0.4"/>
            <rect x="130" y="100" width="140" height="165" rx="4" fill="#1E45FC"/>
            <rect x="136" y="106" width="128" height="159" rx="3" fill="#2d55fc"/>
            <path d="M118 102 L200 60 L282 102 Z" fill="#1E45FC"/>
            <line x1="200" y1="60" x2="200" y2="30" stroke="#0B0F2A" strokeWidth="2" strokeLinecap="round"/>
            <path d="M200 30 L222 38 L200 46 Z" fill="#A3CF2E"/>
            <circle cx="200" cy="82" r="11" fill="white" opacity="0.9"/>
            <line x1="200" y1="82" x2="200" y2="74" stroke="#1E45FC" strokeWidth="1.5" strokeLinecap="round"/>
            <line x1="200" y1="82" x2="206" y2="82" stroke="#1E45FC" strokeWidth="1.5" strokeLinecap="round"/>
            <rect x="148" y="120" width="20" height="22" rx="2" fill="white" opacity="0.25"/>
            <rect x="178" y="120" width="20" height="22" rx="2" fill="white" opacity="0.25"/>
            <rect x="208" y="120" width="20" height="22" rx="2" fill="white" opacity="0.25"/>
            <rect x="238" y="120" width="20" height="22" rx="2" fill="white" opacity="0.25"/>
            <rect x="148" y="155" width="20" height="22" rx="2" fill="white" opacity="0.2"/>
            <rect x="178" y="155" width="20" height="22" rx="2" fill="white" opacity="0.2"/>
            <rect x="208" y="155" width="20" height="22" rx="2" fill="white" opacity="0.2"/>
            <rect x="238" y="155" width="20" height="22" rx="2" fill="white" opacity="0.2"/>
            <rect x="183" y="220" width="34" height="45" rx="3" fill="white" opacity="0.3"/>
            <circle cx="212" cy="244" r="2" fill="white" opacity="0.8"/>
            <rect x="174" y="262" width="52" height="4" rx="1" fill="#1E45FC" opacity="0.5"/>
            <rect x="179" y="258" width="42" height="4" rx="1" fill="#1E45FC" opacity="0.4"/>
            <rect x="94" y="215" width="7" height="50" rx="2" fill="#8ab526"/>
            <ellipse cx="97" cy="208" rx="22" ry="24" fill="#A3CF2E"/>
            <ellipse cx="97" cy="203" rx="16" ry="18" fill="#b8de44"/>
            <rect x="299" y="215" width="7" height="50" rx="2" fill="#8ab526"/>
            <ellipse cx="303" cy="208" rx="22" ry="24" fill="#A3CF2E"/>
            <ellipse cx="303" cy="203" rx="16" ry="18" fill="#b8de44"/>
            <ellipse cx="126" cy="257" rx="13" ry="9" fill="#A3CF2E" opacity="0.7"/>
            <ellipse cx="274" cy="257" rx="13" ry="9" fill="#A3CF2E" opacity="0.7"/>
            <rect x="60" y="200" width="26" height="50" rx="4" fill="#1E45FC"/>
            <circle cx="73" cy="192" r="13" fill="#f5c5a0"/>
            <path d="M61 190 Q73 178 85 190" fill="#2d1a0e"/>
            <rect x="70" y="205" width="6" height="18" rx="1" fill="#A3CF2E"/>
            <rect x="82" y="205" width="8" height="28" rx="3" fill="#1E45FC"/>
            <rect x="86" y="208" width="18" height="24" rx="2" fill="#0B0F2A"/>
            <rect x="88" y="210" width="14" height="18" rx="1" fill="#2d55fc"/>
            <rect x="63" y="248" width="10" height="18" rx="3" fill="#0B0F2A"/>
            <rect x="76" y="248" width="10" height="18" rx="3" fill="#0B0F2A"/>
            <circle cx="38" cy="215" r="11" fill="#d4956a"/>
            <path d="M28 213 Q38 203 48 213" fill="#1a1a2e"/>
            <rect x="28" y="226" width="20" height="38" rx="4" fill="#A3CF2E"/>
            <rect x="20" y="228" width="12" height="22" rx="3" fill="#8ab526"/>
            <rect x="30" y="262" width="8" height="14" rx="3" fill="#1E45FC"/>
            <rect x="40" y="262" width="8" height="14" rx="3" fill="#1E45FC"/>
            <circle cx="362" cy="215" r="11" fill="#c17f5a"/>
            <path d="M352 212 Q362 202 372 212" fill="#0d0d0d"/>
            <rect x="352" y="226" width="20" height="38" rx="4" fill="#A3CF2E"/>
            <rect x="354" y="262" width="8" height="14" rx="3" fill="#1E45FC"/>
            <rect x="364" y="262" width="8" height="14" rx="3" fill="#1E45FC"/>
            <circle cx="327" cy="200" r="12" fill="#e8b090"/>
            <path d="M316 198 Q327 187 338 198" fill="#2d1a0e"/>
            <rect x="316" y="212" width="22" height="42" rx="4" fill="#1E45FC"/>
            <rect x="334" y="215" width="16" height="20" rx="2" fill="white" opacity="0.9"/>
            <rect x="319" y="252" width="8" height="14" rx="3" fill="#0B0F2A"/>
            <rect x="329" y="252" width="8" height="14" rx="3" fill="#0B0F2A"/>
          </svg>
        </div>
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
