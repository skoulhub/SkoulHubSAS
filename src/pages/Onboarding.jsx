import { useState } from 'react';
import { provisionTenant } from '../lib/tenantStore';
import { LoginShell, Logo, ArrowRight } from './Login';

const STEPS = ['School Info', 'Admin Account', 'MFA Setup', 'Confirm'];

const DISTRICTS = [
  'Kampala','Wakiso','Mukono','Jinja','Mbale','Gulu','Arua','Mbarara',
  'Fort Portal','Lira','Soroti','Masaka','Entebbe','Iganga','Tororo',
];

const PLANS = [
  {
    id: 'starter',
    name: 'Starter',
    price: 'UGX 10,000',
    unit: '/ student / term',
    max: '300 students',
    color: 'var(--accent)',
    bg: 'var(--tint-blue)',
    features: ['Attendance','Fee Collection','SMS (50/mo)','Email Support'],
  },
  {
    id: 'growth',
    name: 'Growth',
    price: 'UGX 8,500',
    unit: '/ student / term',
    max: '1,000 students',
    color: 'var(--ok)',
    bg: 'var(--tint-green)',
    badge: 'Most Popular',
    features: ['Everything in Starter','Exam Results','Report Cards','Unlimited SMS','Priority Support'],
  },
  {
    id: 'enterprise',
    name: 'Enterprise',
    price: 'Custom',
    unit: 'contact us',
    max: 'Unlimited',
    color: 'var(--violet)',
    bg: 'var(--tint-violet)',
    features: ['Everything in Growth','Multi-School','Custom Branding','API Access','Dedicated Manager'],
  },
];

export default function Onboarding({ onComplete, onBackToLogin }) {
  const [step, setStep]     = useState(0);
  const [errors, setErrors] = useState({});
  const [loading, setLoad]  = useState(false);
  const [result, setResult] = useState(null);

  const [form, setForm] = useState({
    schoolName: '', district: '', address: '', phone: '',
    adminName: '', adminEmail: '', adminPhone: '',
    plan: 'growth',
    mfaMethod: 'otp',
  });

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));
  const clearErr = k => setErrors(e => { const n = { ...e }; delete n[k]; return n; });

  const validate = () => {
    const e = {};
    if (step === 0) {
      if (!form.schoolName.trim()) e.schoolName = 'Required';
      if (!form.district)         e.district    = 'Required';
    }
    if (step === 1) {
      if (!form.adminName.trim())  e.adminName  = 'Required';
      if (!form.adminEmail.includes('@')) e.adminEmail = 'Valid email required';
    }
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const next = () => { if (validate()) setStep(s => s + 1); };
  const back = () => { setErrors({}); setStep(s => s - 1); };

  const submit = () => {
    setLoad(true);
    // Simulate async provisioning
    setTimeout(() => {
      const { tenant, user } = provisionTenant({
        schoolName: form.schoolName,
        district:   form.district,
        adminEmail: form.adminEmail,
        adminName:  form.adminName,
        plan:       form.plan,
      });
      setResult({ tenant, user });
      setLoad(false);
      setStep(4); // success screen
    }, 1600);
  };

  if (step === 4 && result) {
    return (
      <LoginShell>
        <div className="animate-slide-up text-center">
          <div className="w-16 h-16 rounded-2xl mx-auto mb-5 flex items-center justify-center"
            style={{ background: 'linear-gradient(135deg, #A3CF2E, #8ab526)' }}>
            <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
              <path d="M6 16L13 23L26 9" stroke="#0B0F2A" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
          <h1 className="text-2xl font-bold font-display mb-2" style={{ color: 'var(--text)' }}>
            School Created!
          </h1>
          <p className="text-sm text-gray-500 mb-6">
            Your school has been set up and is ready to use.
          </p>

          {/* Tenant ID card */}
          <div className="rounded-2xl p-5 mb-6 text-left" style={{ background: 'var(--sidebar)' }}>
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center font-bold text-sm text-white flex-shrink-0"
                style={{ background: '#1E45FC' }}>
                {result.tenant.logo_initials}
              </div>
              <div>
                <div className="text-white font-semibold text-sm">{result.tenant.name}</div>
                <div className="text-xs" style={{ color: '#A3CF2E' }}>{result.tenant.district}</div>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3 text-xs">
              {[
                ['Tenant ID',  result.tenant.school_id],
                ['Plan',       result.tenant.plan],
                ['Status',     'Trial — 7 days free'],
                ['Admin',      result.user.name],
              ].map(([label, val]) => (
                <div key={label} className="rounded-lg p-2.5" style={{ background: 'rgba(255,255,255,0.06)' }}>
                  <div className="text-white/40 mb-0.5">{label}</div>
                  <div className="text-white font-semibold truncate">{val}</div>
                </div>
              ))}
            </div>
            <div className="mt-3 pt-3 border-t border-white/10 flex items-center gap-2">
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="#A3CF2E" strokeWidth="1.5">
                <path d="M6 1L10.5 3V6C10.5 8.5 8.5 10.7 6 11C3.5 10.7 1.5 8.5 1.5 6V3L6 1Z"/>
              </svg>
              <span className="text-xs" style={{ color: '#A3CF2E' }}>
                Tenant isolation active · school_id enforced on all data
              </span>
            </div>
          </div>

          <button onClick={() => onComplete(result)} className="btn-brand-primary w-full mb-3">
            Go to Dashboard <ArrowRight />
          </button>
          <button onClick={onBackToLogin} className="text-xs text-gray-400 hover:text-brand-blue transition-colors">
            Back to login
          </button>
        </div>
      </LoginShell>
    );
  }

  return (
    <LoginShell>
      <div className="animate-slide-up">
        {/* Header */}
        <div className="text-center mb-6">
          <Logo />
          <h1 className="mt-4 text-xl font-bold font-display" style={{ color: 'var(--text)' }}>
            Set up your school
          </h1>
          <p className="text-xs text-gray-500 mt-1">Free 7-day trial · No credit card needed</p>
        </div>

        {/* Step progress */}
        <div className="flex items-center gap-1.5 mb-7">
          {STEPS.map((label, i) => (
            <div key={i} className="flex items-center gap-1.5 flex-1">
              <div className={`flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold flex-shrink-0 transition-all
                ${i < step ? 'text-white' : i === step ? 'text-white' : 'text-gray-400'}`}
                style={{ background: i < step ? '#A3CF2E' : i === step ? '#1E45FC' : '#f0f0f0',
                         color: i < step ? '#0B0F2A' : undefined }}>
                {i < step ? '✓' : i + 1}
              </div>
              {i < STEPS.length - 1 && (
                <div className="flex-1 h-0.5 rounded-full transition-all"
                  style={{ background: i < step ? '#A3CF2E' : 'var(--border)' }} />
              )}
            </div>
          ))}
        </div>
        <p className="text-xs font-semibold text-gray-500 mb-5">{STEPS[step]}</p>

        {/* Step 0 — School Info */}
        {step === 0 && (
          <div className="flex flex-col gap-4">
            <Field label="School Name" error={errors.schoolName}>
              <input value={form.schoolName} onChange={e => { set('schoolName', e.target.value); clearErr('schoolName'); }}
                placeholder="St. Mary's College Kisubi" autoFocus className={inputCls(errors.schoolName)} />
            </Field>
            <Field label="District" error={errors.district}>
              <select value={form.district} onChange={e => { set('district', e.target.value); clearErr('district'); }}
                className={inputCls(errors.district)}>
                <option value="">Select district…</option>
                {DISTRICTS.map(d => <option key={d}>{d}</option>)}
              </select>
            </Field>
            <Field label="Address (optional)">
              <input value={form.address} onChange={e => set('address', e.target.value)}
                placeholder="P.O. Box 123, Kampala" className={inputCls()} />
            </Field>
            <Field label="School Phone (optional)">
              <input value={form.phone} onChange={e => set('phone', e.target.value)}
                placeholder="+256 700 000 000" className={inputCls()} />
            </Field>

            {/* Plan picker */}
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-2">Select Plan</label>
              <div className="grid grid-cols-3 gap-2">
                {PLANS.map(p => (
                  <button key={p.id} type="button"
                    onClick={() => set('plan', p.id)}
                    className={`relative flex flex-col p-3 rounded-xl border-2 text-left transition-all
                      ${form.plan === p.id ? 'border-brand-blue bg-brand-blue-light' : 'border-gray-200 bg-white hover:border-gray-300'}`}>
                    {p.badge && (
                      <span className="absolute -top-2 left-1/2 -translate-x-1/2 text-xs font-bold px-1.5 py-0.5 rounded-full whitespace-nowrap"
                        style={{ background: '#A3CF2E', color: 'var(--text)', fontSize: '9px' }}>{p.badge}</span>
                    )}
                    <span className="text-xs font-bold" style={{ color: p.color }}>{p.name}</span>
                    <span className="text-xs font-semibold mt-0.5" style={{ color: 'var(--text)' }}>{p.price}</span>
                    <span className="text-xs text-gray-400">{p.unit}</span>
                  </button>
                ))}
              </div>
            </div>

            <button onClick={next} className="btn-brand-primary w-full mt-1">
              Continue <ArrowRight />
            </button>
          </div>
        )}

        {/* Step 1 — Admin Account */}
        {step === 1 && (
          <div className="flex flex-col gap-4">
            <div className="flex items-start gap-3 p-3 rounded-xl text-xs" style={{ background: '#f0fdf4', border: '1px solid #bbf7d0' }}>
              <span className="text-green-600 mt-0.5">🔐</span>
              <span className="text-green-800">
                A unique <strong>school_id (tenant ID)</strong> will be automatically generated and linked to this account.
                All your data will be isolated and secured by this ID.
              </span>
            </div>
            <Field label="Full Name" error={errors.adminName}>
              <input value={form.adminName} onChange={e => { set('adminName', e.target.value); clearErr('adminName'); }}
                placeholder="Agnes Namukwaya" autoFocus className={inputCls(errors.adminName)} />
            </Field>
            <Field label="Work Email" error={errors.adminEmail}>
              <input type="email" value={form.adminEmail} onChange={e => { set('adminEmail', e.target.value); clearErr('adminEmail'); }}
                placeholder="admin@yourschool.ug" className={inputCls(errors.adminEmail)} />
            </Field>
            <Field label="Phone Number (optional)">
              <input value={form.adminPhone} onChange={e => set('adminPhone', e.target.value)}
                placeholder="+256 700 000 000" className={inputCls()} />
            </Field>
            <div className="flex gap-3 mt-1">
              <button onClick={back} className="flex-1 py-2.5 rounded-xl border text-sm font-semibold text-gray-600 hover:bg-gray-50 transition-colors" style={{ borderColor: 'var(--border-strong)' }}>Back</button>
              <button onClick={next} className="flex-1 btn-brand-primary">Continue <ArrowRight /></button>
            </div>
          </div>
        )}

        {/* Step 2 — MFA Setup */}
        {step === 2 && (
          <div className="flex flex-col gap-4">
            <p className="text-xs text-gray-500 leading-relaxed">
              Choose how you'll verify your identity each time you sign in. You can add more methods later.
            </p>
            {[
              { id: 'otp',     icon: '📧', label: 'Email / SMS OTP',        desc: '6-digit code sent to your email or phone' },
              { id: 'authapp', icon: '📱', label: 'Authenticator App',       desc: 'Google Authenticator, Authy, or 1Password', badge: 'Recommended' },
              { id: 'passkey', icon: '🪪', label: 'Passkey / Biometric',     desc: 'Face ID, Touch ID or hardware key', badge: 'Passwordless' },
            ].map(m => (
              <button key={m.id} type="button" onClick={() => set('mfaMethod', m.id)}
                className={`flex items-center gap-3 p-4 rounded-xl border-2 text-left transition-all
                  ${form.mfaMethod === m.id ? 'border-brand-blue bg-brand-blue-light' : 'border-gray-200 bg-white hover:border-gray-300'}`}>
                <span className="text-2xl">{m.icon}</span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold" style={{ color: 'var(--text)' }}>{m.label}</span>
                    {m.badge && (
                      <span className="text-xs font-bold px-1.5 py-0.5 rounded-full"
                        style={{ background: m.badge === 'Recommended' ? '#A3CF2E' : 'var(--tint-blue)',
                                 color: m.badge === 'Recommended' ? '#0B0F2A' : 'var(--accent)', fontSize: '10px' }}>
                        {m.badge}
                      </span>
                    )}
                  </div>
                  <span className="text-xs text-gray-400">{m.desc}</span>
                </div>
                <div className={`w-4 h-4 rounded-full border-2 flex-shrink-0 flex items-center justify-center
                  ${form.mfaMethod === m.id ? 'border-brand-blue bg-brand-blue' : 'border-gray-300'}`}>
                  {form.mfaMethod === m.id && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                </div>
              </button>
            ))}
            <div className="flex gap-3 mt-1">
              <button onClick={back} className="flex-1 py-2.5 rounded-xl border text-sm font-semibold text-gray-600 hover:bg-gray-50 transition-colors" style={{ borderColor: 'var(--border-strong)' }}>Back</button>
              <button onClick={next} className="flex-1 btn-brand-primary">Continue <ArrowRight /></button>
            </div>
          </div>
        )}

        {/* Step 3 — Review & Confirm */}
        {step === 3 && (
          <div className="flex flex-col gap-4">
            <div className="rounded-2xl border overflow-hidden" style={{ borderColor: 'var(--border)' }}>
              {[
                { label: 'School',    value: form.schoolName, icon: '🏫' },
                { label: 'District',  value: form.district,   icon: '📍' },
                { label: 'Plan',      value: PLANS.find(p => p.id === form.plan)?.name, icon: '📋' },
                { label: 'Admin',     value: form.adminName,  icon: '👤' },
                { label: 'Email',     value: form.adminEmail, icon: '📧' },
                { label: 'MFA',       value: { otp: 'Email / SMS OTP', authapp: 'Auth App', passkey: 'Passkey' }[form.mfaMethod], icon: '🔐' },
              ].map((r, i) => (
                <div key={i} className="flex items-center gap-3 px-4 py-3 border-b last:border-0" style={{ borderColor: 'var(--border-subtle)' }}>
                  <span className="text-base flex-shrink-0">{r.icon}</span>
                  <span className="text-xs text-gray-400 w-16 flex-shrink-0">{r.label}</span>
                  <span className="text-sm font-semibold truncate" style={{ color: 'var(--text)' }}>{r.value}</span>
                </div>
              ))}
            </div>

            <div className="flex items-start gap-2.5 p-3 rounded-xl text-xs" style={{ background: 'var(--tint-blue)', border: '1px solid #c7d2ff' }}>
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="#1E45FC" strokeWidth="1.5" className="flex-shrink-0 mt-0.5">
                <path d="M7 1L12.5 3.5V7C12.5 10 10 12.8 7 13.5C4 12.8 1.5 10 1.5 7V3.5L7 1Z"/>
              </svg>
              <span className="text-brand-blue">
                A unique <strong>tenant ID (school_id)</strong> will be generated automatically.
                All your data will be fully isolated from other schools on the platform.
              </span>
            </div>

            <div className="flex gap-3">
              <button onClick={back} className="flex-1 py-2.5 rounded-xl border text-sm font-semibold text-gray-600 hover:bg-gray-50 transition-colors" style={{ borderColor: 'var(--border-strong)' }}>Back</button>
              <button onClick={submit} disabled={loading}
                className={`flex-1 btn-brand-primary ${loading ? 'opacity-70' : ''}`}>
                {loading ? (
                  <span className="flex items-center gap-2">
                    <svg className="animate-spin w-4 h-4" viewBox="0 0 16 16" fill="none">
                      <circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="2" strokeOpacity="0.3"/>
                      <path d="M8 2A6 6 0 0 1 14 8" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                    </svg>
                    Creating…
                  </span>
                ) : <>Create School <ArrowRight /></>}
              </button>
            </div>
          </div>
        )}

        {step === 0 && (
          <p className="mt-4 text-center text-xs text-gray-400">
            Already have an account?{' '}
            <button onClick={onBackToLogin} className="text-brand-blue font-semibold hover:underline">Sign in →</button>
          </p>
        )}
      </div>
    </LoginShell>
  );
}

/* ─── helpers ─── */
const inputCls = (err) =>
  `w-full px-3 py-2.5 rounded-xl border text-sm outline-none transition-all bg-white
   focus:border-brand-blue focus:ring-2 focus:ring-brand-blue/15
   ${err ? 'border-red-400' : 'border-gray-200'}`;

function Field({ label, error, children }) {
  return (
    <div>
      <label className="block text-xs font-semibold text-gray-600 mb-1.5">{label}</label>
      {children}
      {error && <p className="mt-1 text-xs text-red-500">{error}</p>}
    </div>
  );
}
