import { useState } from 'react';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import EnrollmentForm from './pages/EnrollmentForm';
import Onboarding from './pages/Onboarding';
import { resolveUser, queryTenant } from './lib/tenantStore';
import { useTheme, clearUserStorage } from './lib/userPrefs';
import { refreshSubscriptions, evaluateTenant } from './lib/billing';

/* Read the ?enroll= param once, lazily, so we never setState in an effect */
function initialView() {
  const params = new URLSearchParams(window.location.search);
  return params.get('enroll') ? 'enroll' : 'login';
}
function initialEnrollSchoolId() {
  return new URLSearchParams(window.location.search).get('enroll') ?? null;
}

export default function App() {
  const [view, setView] = useState(initialView); // 'login' | 'dashboard' | 'enroll' | 'onboarding'
  const [session, setSession] = useState(null);
  const [enrollSchoolId, setEnrollSchoolId] = useState(initialEnrollSchoolId); // null = generic, 'skh-xxx' = school-specific
  const [theme, setTheme] = useTheme(); // light | dark | system — applied to <html>
  const [blocked, setBlocked] = useState(null); // { tenant, state, email } — school access revoked


  /** Patch the signed-in user (profile edits: name / email / phone) */
  const handleUpdateUser = (patch) =>
    setSession(s => (s ? { ...s, currentUser: { ...s.currentUser, ...patch } } : s));

  /** Patch the active tenant (e.g. a plan change on the Subscription page) */
  const handleUpdateTenant = (patch) =>
    setSession(s => (s && s.tenant ? { ...s, tenant: { ...s.tenant, ...patch } } : s));

  const handleLogin = (email) => {
    const currentUser = resolveUser(email);
    if (!currentUser) {
      // Unknown user — reset to login (defensive; Login validates beforehand)
      setSession(null);
      setView('login');
      return;
    }
    const tenant = currentUser.school_id ? queryTenant(currentUser.school_id) : null;

    /* Auto-revocation: a school whose subscription lapsed cannot sign in.
       The school admin is the exception — they get a locked dashboard whose
       only reachable page is Subscription, so they can settle the invoice. */
    if (tenant && currentUser.role !== 'saas_admin') {
      refreshSubscriptions();
      const state = evaluateTenant(tenant.school_id);
      if (state?.locked && currentUser.role !== 'school_admin') {
        setBlocked({ tenant, state, email });
        setView('login');
        return;
      }
    }

    // a different user signing in must not inherit the previous user's storage
    const previous = session?.currentUser?.user_id;
    if (previous && previous !== currentUser.user_id) clearUserStorage(previous);

    setSession({ currentUser, tenant });
    setView('dashboard');
  };

  const handleLogout = () => {
    clearUserStorage(session?.currentUser?.user_id);   // no preference leak on shared devices
    setSession(null);
    setView('login');
  };

  const handleEnroll = (schoolId = null) => {
    setEnrollSchoolId(schoolId);
    setView('enroll');
  };

  const handleBackFromEnroll = () => {
    // Clear URL param if set
    const url = new URL(window.location.href);
    url.searchParams.delete('enroll');
    window.history.replaceState({}, '', url);
    setView('login');
  };

  const handleCreateSchool = () => {
    setView('onboarding');
  };

  const handleOnboardingComplete = ({ user, tenant }) => {
    // Onboarding provisions a tenant + admin user; sign straight in as that admin
    setSession({ currentUser: user, tenant });
    setView('dashboard');
  };

  if (view === 'dashboard' && session) {
    return (
      <Dashboard
        currentUser={session.currentUser}
        tenant={session.tenant}
        onLogout={handleLogout}
        theme={theme}
        onTheme={setTheme}
        onUpdateUser={handleUpdateUser}
        onUpdateTenant={handleUpdateTenant}
      />
    );
  }

  if (view === 'enroll') {
    return (
      <EnrollmentForm
        schoolId={enrollSchoolId}
        onBack={handleBackFromEnroll}
      />
    );
  }

  if (view === 'onboarding') {
    return (
      <Onboarding
        onComplete={handleOnboardingComplete}
        onBackToLogin={() => setView('login')}
      />
    );
  }

  if (blocked) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4"
        style={{ background: 'linear-gradient(135deg, #0B0F2A 0%, #1535d4 60%, #1E45FC 100%)' }}>
        <div className="w-full max-w-md rounded-2xl shadow-2xl px-8 py-10 text-center" style={{ background: 'var(--surface)' }}>
          <div className="w-16 h-16 rounded-2xl mx-auto mb-4 flex items-center justify-center text-3xl"
            style={{ background: 'var(--tint-red)' }}>🔒</div>
          <h1 className="text-lg font-extrabold" style={{ color: 'var(--text)' }}>School access suspended</h1>
          <p className="text-sm mt-2" style={{ color: 'var(--text-muted)' }}>
            {blocked.tenant.name} — {blocked.state.reason}
          </p>
          <div className="rounded-xl px-4 py-3 mt-4 text-left text-xs space-y-1" style={{ background: 'var(--surface-2)' }}>
            <div className="flex justify-between"><span style={{ color: 'var(--text-dim)' }}>School</span>
              <strong style={{ color: 'var(--text)' }}>{blocked.tenant.name}</strong></div>
            <div className="flex justify-between"><span style={{ color: 'var(--text-dim)' }}>Tenant ID</span>
              <span className="font-mono" style={{ color: 'var(--text)' }}>{blocked.tenant.school_id}</span></div>
            <div className="flex justify-between"><span style={{ color: 'var(--text-dim)' }}>Outstanding</span>
              <strong style={{ color: 'var(--danger)' }}>{blocked.state.outstanding.toLocaleString()} UGX</strong></div>
          </div>
          <p className="text-[11px] mt-4" style={{ color: 'var(--text-dim)' }}>
            Ask your school administrator to settle the invoice, or contact SkoulHub billing on +256 772 000 123.
          </p>
          <button onClick={() => setBlocked(null)} className="btn-brand-primary w-full mt-6 rounded-2xl py-3">
            Back to sign in
          </button>
        </div>
      </div>
    );
  }

  return (
    <Login
      onLogin={handleLogin}
      onEnroll={handleEnroll}
      onCreateSchool={handleCreateSchool}
    />
  );
}
