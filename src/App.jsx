import { useState } from 'react';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import { resolveUser, queryTenant } from './lib/tenantStore';

export default function App() {
  const [view, setView] = useState('login'); // 'login' | 'dashboard'
  const [session, setSession] = useState(null); // { currentUser, tenant }

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

  if (view === 'dashboard' && session) {
    return (
      <Dashboard
        currentUser={session.currentUser}
        tenant={session.tenant}
        onLogout={handleLogout}
      />
    );
  }

  return <Login onLogin={handleLogin} />;
}
