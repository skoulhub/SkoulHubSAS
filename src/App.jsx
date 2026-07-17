import { useState, useEffect } from 'react';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import EnrollmentForm from './pages/EnrollmentForm';
import { resolveUser, queryTenant } from './lib/tenantStore';

export default function App() {
  const [view, setView] = useState('login'); // 'login' | 'dashboard' | 'enroll'
  const [session, setSession] = useState(null);
  const [enrollSchoolId, setEnrollSchoolId] = useState(null); // null = generic, 'skh-xxx' = school-specific

  /* Auto-open enrollment form via URL param: ?enroll=skh-001 */
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const schoolParam = params.get('enroll');
    if (schoolParam) {
      setEnrollSchoolId(schoolParam);
      setView('enroll');
    }
  }, []);

  const handleLogin = (email, roleId) => {
    const currentUser = resolveUser(email, roleId);
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

  return <Login onLogin={handleLogin} onEnroll={handleEnroll} />;
}
