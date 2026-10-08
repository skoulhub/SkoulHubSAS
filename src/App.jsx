import { useState, useEffect } from 'react';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import EnrollmentForm from './pages/EnrollmentForm';
import Onboarding from './pages/Onboarding';
import { queryTenant, __hydrateStore } from './lib/tenantStore';
import { useTheme, clearUserStorage } from './lib/userPrefs';
import { useIdleTimeout, IDLE_TIMEOUT_MS } from './lib/useIdleTimeout';
import { recordAudit, setAuditActor, AUDIT_ACTIONS, AUDIT_SEVERITY } from './lib/audit';
import { refreshSubscriptions, evaluateTenant } from './lib/billing';
import { signIn, signOut, loadTenantData, currentAuthSession } from './lib/db';

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
  const [notice, setNotice] = useState('');     // e.g. "signed out for inactivity"

  /* Expire an unattended session (OWASP A07). */
  useIdleTimeout({
    enabled: view === 'dashboard' && !!session,
    onIdle: () => {
      recordAudit({ action: AUDIT_ACTIONS.IDLE_SIGN_OUT, severity: AUDIT_SEVERITY.NOTICE });
      setAuditActor({});
      clearUserStorage(session?.currentUser?.user_id);
      signOut();                       // revoke server-side too, not just the UI
      setSession(null);
      setView('login');
      setNotice(`You were signed out after ${Math.round(IDLE_TIMEOUT_MS / 60000)} minutes of inactivity.`);
    },
  });


  /** Patch the signed-in user (profile edits: name / email / phone) */
  const handleUpdateUser = (patch) =>
    setSession(s => (s ? { ...s, currentUser: { ...s.currentUser, ...patch } } : s));

  /** Patch the active tenant (e.g. a plan change on the Subscription page) */
  const handleUpdateTenant = (patch) =>
    setSession(s => (s && s.tenant ? { ...s, tenant: { ...s.tenant, ...patch } } : s));

  /**
   * Sign in against Supabase, then load the caller's data.
   *
   * The browser no longer decides who anyone is: the credentials go to the
   * auth server, and every row that comes back has already been filtered by
   * Row Level Security for that identity.
   */
  const handleLogin = async (email, password) => {
    const { error } = await signIn(email, password);
    if (error) {
      // Deliberately pass the server's message through unchanged — enriching it
      // ("no such user" vs "wrong password") would be an enumeration oracle.
      return { ok: false, error: error.message === 'Invalid login credentials'
        ? 'Incorrect email or password.' : error.message };
    }

    const data = await loadTenantData();
    if (!data || data.error) {
      return { ok: false, error: `Signed in, but your school data could not be loaded${data?.error ? `: ${data.error.message}` : '.'}` };
    }
    __hydrateStore(data);

    const key = String(email).trim().toLowerCase();
    const currentUser = data.users[key];
    if (!currentUser) {
      await signOut();
      return { ok: false, error: 'This account has no profile. Ask your administrator to provision it.' };
    }
    const tenant = currentUser.school_id ? queryTenant(currentUser.school_id) : null;

    /* Auto-revocation. The database already refuses the data (tenant_is_active),
       so a lapsed school sees nothing; here we additionally explain why, and
       let the school admin reach only the Subscription page to settle up. */
    if (tenant && currentUser.role !== 'saas_admin') {
      refreshSubscriptions();
      const state = evaluateTenant(tenant.school_id);
      if (state?.locked && currentUser.role !== 'school_admin') {
        setBlocked({ tenant, state, email });
        setView('login');
        return { ok: true };
      }
    }

    const previous = session?.currentUser?.user_id;
    if (previous && previous !== currentUser.user_id) clearUserStorage(previous);

    setAuditActor({
      name: currentUser.name, role: currentUser.role,
      school_id: currentUser.school_id ?? null, id: currentUser.user_id,
    });
    recordAudit({ action: AUDIT_ACTIONS.SIGN_IN, target: currentUser.email, severity: AUDIT_SEVERITY.NOTICE });
    setNotice('');
    setSession({ currentUser, tenant });
    setView('dashboard');
    return { ok: true };
  };

  const handleLogout = async () => {
    // audit before signing out — the insert needs the session to be attributed
    recordAudit({ action: AUDIT_ACTIONS.SIGN_OUT, severity: AUDIT_SEVERITY.NOTICE });
    setAuditActor({});
    clearUserStorage(session?.currentUser?.user_id);   // no preference leak on shared devices
    await signOut();
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

  /* Restore an existing Supabase session on reload — the token lives in
     localStorage, so a refresh should not force a fresh sign-in. */
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const authSession = await currentAuthSession();
      if (!authSession?.user || cancelled) return;
      const data = await loadTenantData();
      if (cancelled || !data || data.error) return;
      __hydrateStore(data);
      const currentUser = data.users[authSession.user.email.toLowerCase()];
      if (!currentUser) return;
      setAuditActor({
        name: currentUser.name, role: currentUser.role,
        school_id: currentUser.school_id ?? null, id: currentUser.user_id,
      });
      setSession({ currentUser, tenant: currentUser.school_id ? queryTenant(currentUser.school_id) : null });
      setView(v => (v === 'login' ? 'dashboard' : v));
    })();
    return () => { cancelled = true; };
  }, []);

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
      notice={notice}
      onDismissNotice={() => setNotice('')}
    />
  );
}
