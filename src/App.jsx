import { useState } from 'react';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import EnrollmentForm from './pages/EnrollmentForm';
import Onboarding from './pages/Onboarding';
import { resolveUser, queryTenant } from './lib/tenantStore';

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

  const handleLogin = (email, roleId) => {
    const currentUser = resolveUser(email, roleId);
    if (!currentUser) {
      // Unknown user — reset to login (defensive; Login validates beforehand)
      setSession(null);
      setView('login');
      return;
    }
    const tenant = currentUser.school_id ? queryTenant(currentUser.school_id) : null;
    setSession({ currentUser, tenant });
    setView('dashboard');
  };

  const handleLogout = () => {
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

  return (
    <Login
      onLogin={handleLogin}
      onEnroll={handleEnroll}
      onCreateSchool={handleCreateSchool}
    />
  );
}
