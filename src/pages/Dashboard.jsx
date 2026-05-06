import { useState } from 'react';
import { LogoIcon } from './Login';
import { TenantContext } from '../lib/TenantContext';
import { can, navAllowed, ROLE_META } from '../lib/permissions';
import {
  queryStudents, queryTeachers, queryPayments, queryParents,
  queryAllTenants, calcBilling, BILLING_RATE,
} from '../lib/tenantStore';

/* ─── SVG Icons ──────────────────────────────────────────────── */
const Icon = ({ d, size = 18, stroke = 'currentColor', fill = 'none', strokeWidth = 1.7 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill={fill} stroke={stroke} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
    <path d={d} />
  </svg>
);

const NAV_ICONS = {
  overview:   'M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z',
  students:   'M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2M9 7a4 4 0 100 8 4 4 0 000-8zM23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75',
  teachers:   'M22 10v6M2 10l10-5 10 5-10 5zM6 12v5c3 3 9 3 12 0v-5',
  attendance: 'M9 11l3 3L22 4M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11',
  timetable:  'M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z',
  results:    'M18 20V10M12 20V4M6 20v-6',
  finance:    'M12 1v22M17 5H9.5a3.5 3.5 0 100 7h5a3.5 3.5 0 110 7H6',
  reports:    'M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8zM14 2v6h6M16 13H8M16 17H8M10 9H8',
  idcards:    'M2 7a2 2 0 012-2h16a2 2 0 012 2v10a2 2 0 01-2 2H4a2 2 0 01-2-2V7zM16 11h2M16 15h2M8 11a2 2 0 100 4 2 2 0 000-4z',
  notifs:     'M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9M13.73 21a2 2 0 01-3.46 0',
  settings:   'M12 15a3 3 0 100-6 3 3 0 000 6zM19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z',
  parents:    'M20 21v-2a4 4 0 00-4-4h-4M14 11a4 4 0 10-8 0 4 4 0 008 0zM1 21v-2a4 4 0 014-4h.5',
  schools:    'M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z',
  billing:    'M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z',
  onboarding: 'M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5',
  features:   'M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3M6.343 6.343l-.707-.707M6.343 17.657l-.707.707M15.657 6.343l.707-.707M15.657 17.657l.707.707M9 12a3 3 0 116 0 3 3 0 01-6 0z',
};

/* ─── Nav config per role ──────────────────────────────────── */
const NAV_BY_ROLE = {
  saas_admin: [
    { id: 'overview',   label: 'Overview',         section: 'main' },
    { id: 'schools',    label: 'All Schools',       section: 'main' },
    { id: 'billing',    label: 'Billing',           section: 'main' },
    { id: 'onboarding', label: 'Onboarding',        section: 'main' },
    { id: 'features',   label: 'Feature Requests',  section: 'main' },
    { id: 'notifs',     label: 'Notifications',     section: 'other' },
  ],
  school_admin: [
    { id: 'overview',   label: 'Dashboard',     section: 'main' },
    { id: 'students',   label: 'Students',      section: 'main' },
    { id: 'teachers',   label: 'Teachers',      section: 'main' },
    { id: 'parents',    label: 'Parents',       section: 'main' },
    { id: 'attendance', label: 'Attendance',    section: 'main' },
    { id: 'timetable',  label: 'Timetables',    section: 'academic' },
    { id: 'results',    label: 'Results',       section: 'academic' },
    { id: 'reports',    label: 'Report Cards',  section: 'academic' },
    { id: 'finance',    label: 'Finance',       section: 'admin' },
    { id: 'idcards',    label: 'ID Cards',      section: 'admin' },
    { id: 'notifs',     label: 'Notifications', section: 'other' },
    { id: 'settings',   label: 'Settings',      section: 'other' },
  ],
  head_teacher: [
    { id: 'overview',   label: 'Dashboard',     section: 'main' },
    { id: 'students',   label: 'Students',      section: 'main' },
    { id: 'teachers',   label: 'Teachers',      section: 'main' },
    { id: 'parents',    label: 'Parents',       section: 'main' },
    { id: 'attendance', label: 'Attendance',    section: 'main' },
    { id: 'timetable',  label: 'Timetables',    section: 'academic' },
    { id: 'results',    label: 'Results',       section: 'academic' },
    { id: 'reports',    label: 'Report Cards',  section: 'academic' },
    { id: 'finance',    label: 'Finance',       section: 'admin' },
    { id: 'notifs',     label: 'Notifications', section: 'other' },
  ],
  teacher: [
    { id: 'overview',   label: 'My Classes',    section: 'main' },
    { id: 'attendance', label: 'Attendance',    section: 'main' },
    { id: 'timetable',  label: 'My Timetable',  section: 'main' },
    { id: 'results',    label: 'Enter Marks',   section: 'main' },
    { id: 'students',   label: 'Students',      section: 'main' },
    { id: 'notifs',     label: 'Notifications', section: 'other' },
  ],
  parent: [
    { id: 'overview',   label: 'My Child',      section: 'main' },
    { id: 'attendance', label: 'Attendance',    section: 'main' },
    { id: 'results',    label: 'Results',       section: 'main' },
    { id: 'finance',    label: 'Fee Balance',   section: 'main' },
    { id: 'reports',    label: 'Report Cards',  section: 'main' },
    { id: 'notifs',     label: 'Messages',      section: 'other' },
  ],
  bursar: [
    { id: 'overview',   label: 'Finance Overview', section: 'main' },
    { id: 'finance',    label: 'Payments',          section: 'main' },
    { id: 'students',   label: 'Students',          section: 'main' },
    { id: 'idcards',    label: 'ID Cards',          section: 'main' },
    { id: 'notifs',     label: 'Notifications',     section: 'other' },
  ],
};

/* ══════════════════════════════════════════════════
   Dashboard Shell
═══════════════════════════════════════════════════ */
export default function Dashboard({ currentUser, tenant, onLogout }) {
  const [activeNav, setActiveNav] = useState('overview');
  const [collapsed, setCollapsed] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);

  const roleId   = currentUser.role;
  const nav      = NAV_BY_ROLE[roleId] || NAV_BY_ROLE.school_admin;
  const rl       = ROLE_META[roleId]   || ROLE_META.school_admin;
  const schoolId = currentUser.school_id;

  const allowedNav = nav.filter(item => navAllowed(roleId, item.id));
  const mainNav    = allowedNav.filter(i => i.section === 'main' || i.section === 'academic' || i.section === 'admin');
  const otherNav   = allowedNav.filter(i => i.section === 'other');

  const ctxValue = { currentUser, tenant };

  const sectionGroups = [
    { label: null,       items: allowedNav.filter(i => i.section === 'main') },
    { label: 'Academic', items: allowedNav.filter(i => i.section === 'academic') },
    { label: 'Admin',    items: allowedNav.filter(i => i.section === 'admin') },
    { label: 'Other',    items: allowedNav.filter(i => i.section === 'other') },
  ].filter(g => g.items.length > 0);

  return (
    <TenantContext.Provider value={ctxValue}>
      <div className="flex h-screen overflow-hidden bg-gray-50" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
        <DemoBanner />

        {/* ── Sidebar ─────────────────────────────── */}
        <aside
          className={`flex-shrink-0 flex flex-col transition-all duration-300 ${collapsed ? 'w-[68px]' : 'w-[220px]'}`}
          style={{ background: '#0B0F2A', marginTop: '32px' }}
        >
          {/* Logo */}
          <div className={`flex items-center gap-3 px-4 py-5 ${collapsed ? 'justify-center' : ''}`}>
            {!collapsed && (
              <div className="flex items-center gap-2.5 flex-1 min-w-0">
                <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: '#1E45FC' }}>
                  <img src="/skoulhub-logo.png" alt="SkoulHub" style={{ width: 20, height: 20, objectFit: 'contain', filter: 'brightness(0) invert(1)' }} />
                </div>
                <span className="font-extrabold text-base tracking-tight leading-none text-white">
                  Skoul<span style={{ color: '#A3CF2E' }}>Hub</span>
                </span>
              </div>
            )}
            {collapsed && (
              <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: '#1E45FC' }}>
                <img src="/skoulhub-logo.png" alt="SkoulHub" style={{ width: 18, height: 18, objectFit: 'contain', filter: 'brightness(0) invert(1)' }} />
              </div>
            )}
          </div>

          {/* Nav */}
          <nav className="flex-1 overflow-y-auto px-3 pb-3" style={{ scrollbarWidth: 'none' }}>
            {sectionGroups.map((group, gi) => (
              <div key={gi} className="mb-1">
                {!collapsed && group.label && (
                  <div className="px-3 pb-1 pt-3 text-[10px] font-bold tracking-widest uppercase" style={{ color: 'rgba(255,255,255,0.3)' }}>
                    {group.label}
                  </div>
                )}
                {group.items.map(item => {
                  const active = activeNav === item.id;
                  return (
                    <button
                      key={item.id}
                      onClick={() => setActiveNav(item.id)}
                      title={collapsed ? item.label : undefined}
                      className={`w-full flex items-center gap-3 mb-0.5 rounded-xl transition-all text-sm font-medium ${collapsed ? 'justify-center px-2 py-2.5' : 'px-3 py-2.5'}`}
                      style={active
                        ? { background: '#1E45FC', color: '#fff' }
                        : { color: 'rgba(255,255,255,0.55)', background: 'transparent' }
                      }
                      onMouseEnter={e => { if (!active) { e.currentTarget.style.background = 'rgba(255,255,255,0.08)'; e.currentTarget.style.color = '#fff'; } }}
                      onMouseLeave={e => { if (!active) { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'rgba(255,255,255,0.55)'; } }}
                    >
                      <span className="flex-shrink-0">
                        <Icon d={NAV_ICONS[item.id] || NAV_ICONS.overview} size={17} strokeWidth={active ? 2.2 : 1.7} />
                      </span>
                      {!collapsed && <span className="truncate">{item.label}</span>}
                    </button>
                  );
                })}
              </div>
            ))}
          </nav>

          {/* Bottom: user + logout */}
          <div className="px-3 pb-4 pt-2" style={{ borderTop: '1px solid rgba(255,255,255,0.08)' }}>
            <div className={`flex items-center gap-2.5 px-2 py-2.5 rounded-xl mb-1 ${collapsed ? 'justify-center' : ''}`}>
              <div className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0"
                style={{ background: rl.color }}>
                {currentUser.name?.split(' ').map(w => w[0]).join('').slice(0, 2) ?? 'U'}
              </div>
              {!collapsed && (
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-semibold truncate text-white">{currentUser.name}</div>
                  <div className="text-[10px]" style={{ color: tenant?.name ? '#A3CF2E' : 'rgba(255,255,255,0.4)' }}>
                    {tenant?.name ?? rl.label}
                  </div>
                </div>
              )}
              {!collapsed && (
                <button
                  onClick={onLogout}
                  title="Sign out"
                  className="p-1 rounded-lg flex-shrink-0 transition-colors"
                  style={{ color: 'rgba(255,255,255,0.35)' }}
                  onMouseEnter={e => { e.currentTarget.style.color = '#f87171'; }}
                  onMouseLeave={e => { e.currentTarget.style.color = 'rgba(255,255,255,0.35)'; }}
                >
                  <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
                    <path d="M6 14H3a1 1 0 01-1-1V3a1 1 0 011-1h3M11 11l3-3-3-3M14 8H6"/>
                  </svg>
                </button>
              )}
            </div>
          </div>
        </aside>

        {/* ── Main ────────────────────────────────── */}
        <div className="flex-1 flex flex-col min-w-0 overflow-hidden" style={{ marginTop: '32px' }}>
          {/* Topbar */}
          <header className="flex-shrink-0 h-[62px] flex items-center gap-4 px-6 bg-white border-b"
            style={{ borderColor: '#eef0f6' }}>

            {/* Page title */}
            <div className="flex-1 min-w-0">
              <h1 className="text-xl font-bold truncate" style={{ color: '#0B0F2A' }}>
                {allowedNav.find(n => n.id === activeNav)?.label ?? 'Dashboard'}
              </h1>
            </div>

            {/* Search */}
            <div className="hidden md:flex items-center gap-2 px-3.5 py-2 rounded-xl border text-sm w-52"
              style={{ borderColor: '#e2e8f0', background: '#f8faff' }}>
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="#94a3b8" strokeWidth="1.6">
                <circle cx="6" cy="6" r="4.5"/><path d="M10 10L13 13"/>
              </svg>
              <span className="text-xs text-gray-400">Search...</span>
            </div>

            {/* Bell */}
            <div className="relative">
              <button
                onClick={() => setNotifOpen(!notifOpen)}
                className="relative w-9 h-9 rounded-full border flex items-center justify-center transition-colors"
                style={{ borderColor: '#e2e8f0', background: '#fff' }}
                onMouseEnter={e => e.currentTarget.style.background = '#f1f5f9'}
                onMouseLeave={e => e.currentTarget.style.background = '#fff'}
              >
                <Icon d={NAV_ICONS.notifs} size={16} stroke="#64748b" />
                <span className="absolute top-1 right-1 w-2.5 h-2.5 rounded-full bg-red-500 border-2 border-white flex items-center justify-center">
                  <span className="text-[6px] text-white font-bold">3</span>
                </span>
              </button>
              {notifOpen && <NotifDropdown onClose={() => setNotifOpen(false)} />}
            </div>

            {/* Avatar */}
            <div className="w-9 h-9 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0"
              style={{ background: rl.color }}>
              {currentUser.name?.split(' ').map(w => w[0]).join('').slice(0, 2) ?? 'U'}
            </div>
          </header>

          {/* Page content */}
          <main className="flex-1 overflow-y-auto" style={{ background: '#f0f2f8', padding: '20px 24px' }}>
            <PermissionGate roleId={roleId} navId={activeNav}>
              <PageContent activeNav={activeNav} roleId={roleId} schoolId={schoolId} tenant={tenant} currentUser={currentUser} />
            </PermissionGate>
          </main>
        </div>
      </div>
    </TenantContext.Provider>
  );
}

/* ─── Permission Gate ────────────────────────────────────────── */
function PermissionGate({ roleId, navId, children }) {
  if (!navAllowed(roleId, navId)) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-3 text-center">
        <div className="w-14 h-14 rounded-2xl bg-red-50 flex items-center justify-center text-2xl">🔒</div>
        <p className="text-base font-semibold" style={{ color: '#0B0F2A' }}>Access Denied</p>
        <p className="text-sm text-gray-400 max-w-xs">
          Your role <strong>{ROLE_META[roleId]?.label}</strong> does not have permission to view this section.
        </p>
      </div>
    );
  }
  return children;
}

/* ─── Demo Banner ─────────────────────────────────────────────── */
function DemoBanner() {
  const [vis, setVis] = useState(true);
  if (!vis) return null;
  return (
    <div className="fixed top-0 left-0 right-0 z-50 flex items-center justify-center gap-3 px-4 text-xs font-semibold"
      style={{ background: '#A3CF2E', color: '#0B0F2A', height: '32px' }}>
      <span className="w-1.5 h-1.5 rounded-full bg-green-700 animate-pulse" />
      Demo Mode — Real payments disabled · Data resets on refresh · Tenant isolation simulated
      <button onClick={() => setVis(false)} className="ml-3 opacity-50 hover:opacity-100">✕</button>
    </div>
  );
}

/* ─── Notification dropdown ───────────────────────────────────── */
function NotifDropdown({ onClose }) {
  const notifs = [
    { icon: '💳', text: 'Fee payment received from Kabuye Peter', time: '2m ago',  dot: '#10b981' },
    { icon: '👥', text: 'New student enrolled: Aisha Nakato, S.1', time: '15m ago', dot: '#1E45FC' },
    { icon: '📊', text: 'Term 2 results submitted by Ms. Grace',   time: '1h ago',  dot: '#f59e0b' },
  ];
  return (
    <div className="absolute right-0 top-11 w-72 bg-white rounded-2xl shadow-xl border z-50 overflow-hidden"
      style={{ borderColor: '#eef0f6' }}>
      <div className="px-4 py-3 border-b flex items-center justify-between" style={{ borderColor: '#f0f0f0' }}>
        <span className="text-sm font-semibold" style={{ color: '#0B0F2A' }}>Notifications</span>
        <span className="text-xs font-bold px-2 py-0.5 rounded-full" style={{ background: '#e8ecff', color: '#1E45FC' }}>3 new</span>
      </div>
      {notifs.map((n, i) => (
        <div key={i} className="flex items-start gap-3 px-4 py-3 hover:bg-gray-50 cursor-pointer border-b last:border-0"
          style={{ borderColor: '#f8f8f8' }}>
          <div className="w-8 h-8 rounded-lg flex items-center justify-center text-sm flex-shrink-0" style={{ background: '#f8faff' }}>{n.icon}</div>
          <div className="flex-1 min-w-0">
            <p className="text-xs text-gray-700 leading-relaxed">{n.text}</p>
            <p className="text-xs text-gray-400 mt-0.5">{n.time}</p>
          </div>
          <div className="w-2 h-2 rounded-full mt-1.5 flex-shrink-0" style={{ background: n.dot }} />
        </div>
      ))}
    </div>
  );
}

/* ══════════════════════════════════════════════════
   Page Content Router
═══════════════════════════════════════════════════ */
function PageContent({ activeNav, roleId, schoolId, tenant, currentUser }) {
  const props = { roleId, schoolId, tenant, currentUser };
  switch (activeNav) {
    case 'overview':   return roleId === 'saas_admin' ? <SaasOverviewPage /> : <OverviewPage {...props} />;
    case 'students':   return <StudentsPage   {...props} />;
    case 'parents':    return <ParentsPage    {...props} />;
    case 'teachers':   return <TeachersPage   {...props} />;
    case 'attendance': return <AttendancePage {...props} />;
    case 'timetable':  return <TimetablePage  {...props} />;
    case 'results':    return <ResultsPage    {...props} />;
    case 'finance':    return <FinancePage    {...props} />;
    case 'reports':    return <ReportCardsPage {...props} />;
    case 'idcards':    return <IDCardsPage    {...props} />;
    case 'notifs':     return <NotificationsPage {...props} />;
    case 'schools':    return <SaasSchoolsPage />;
    case 'billing':    return <SaasBillingPage />;
    case 'onboarding': return <SaasOnboardingPage />;
    case 'features':   return <SaasFeaturesPage />;
    case 'settings':   return <SettingsPage   {...props} />;
    default:           return <ComingSoon label={activeNav} />;
  }
}

/* ── Shared card wrapper ── */
function Card({ children, className = '', style = {} }) {
  return (
    <div className={`bg-white rounded-2xl border ${className}`} style={{ borderColor: '#eef0f6', ...style }}>
      {children}
    </div>
  );
}

/* ── Stat card ── */
function StatCard({ label, value, delta, deltaPositive = true, iconBg, iconColor, svgPath }) {
  return (
    <Card className="p-5">
      <div className="flex items-start justify-between">
        <div className="flex-1 min-w-0">
          <p className="text-xs font-medium text-gray-400 mb-1">{label}</p>
          <div className="text-2xl font-extrabold mb-1" style={{ color: '#0B0F2A' }}>{value}</div>
          <div className="flex items-center gap-1">
            <span className={`text-xs font-semibold ${deltaPositive ? 'text-green-600' : 'text-red-500'}`}>
              {deltaPositive ? '+' : '-'}{delta}
            </span>
            <span className="text-xs text-gray-400">this month</span>
          </div>
        </div>
        <div className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 ml-3"
          style={{ background: iconBg }}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={iconColor} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d={svgPath} />
          </svg>
        </div>
      </div>
    </Card>
  );
}

/* ══════════════════════════════════════════════════
   OVERVIEW
═══════════════════════════════════════════════════ */
function OverviewPage({ roleId, schoolId, tenant, currentUser }) {
  const students  = queryStudents(schoolId);
  const teachers  = queryTeachers(schoolId);
  const payments  = queryPayments(schoolId);
  const confirmedPay = payments.filter(p => p.status === 'Confirmed');
  const totalFees = confirmedPay.length * 450000;

  const bars  = [62, 75, 58, 88, 70, 95, 82];
  const days  = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

  const activity = [
    { icon: '💳', text: 'Fee payment received: UGX 450,000 from Kabuye Peter', time: '2m ago',  dot: '#10b981', category: 'Finance' },
    { icon: '👤', text: 'New student enrolled: Aisha Nakato — S.1 West',        time: '18m ago', dot: '#1E45FC', category: 'Enrollment' },
    { icon: '📋', text: 'Attendance marked for S.3 East — 42/45 present',       time: '45m ago', dot: '#0891b2', category: 'Attendance' },
    { icon: '📄', text: 'Report cards generated for Term 1 2026',               time: '2h ago',  dot: '#7c3aed', category: 'Reports' },
    { icon: '🎓', text: 'Teacher Namutebi Grace marked sick leave',             time: '3h ago',  dot: '#f59e0b', category: 'Staff' },
  ];

  // Students by class
  const classCounts = students.reduce((acc, s) => {
    acc[s.class] = (acc[s.class] || 0) + 1;
    return acc;
  }, {});
  const classData = Object.entries(classCounts).slice(0, 5).map(([cls, count]) => ({ cls, count, pct: Math.round((count / students.length) * 100) }));

  // Top subjects (mock)
  const subjects = [
    { name: 'Mathematics', score: 88, color: '#1E45FC' },
    { name: 'English',     score: 82, color: '#059669' },
    { name: 'Biology',     score: 76, color: '#0891b2' },
    { name: 'History',     score: 71, color: '#7c3aed' },
    { name: 'Chemistry',   score: 68, color: '#d97706' },
  ];

  // Upcoming events
  const events = [
    { title: 'Parent-Teacher Meeting', date: 'May 10, 2026', type: 'Meeting' },
    { title: 'End of Term 2 Begin', date: 'May 15, 2026', type: 'Academic' },
    { title: 'Sports Day', date: 'May 20, 2026', type: 'Event' },
    { title: 'Term 2 Exams Begin', date: 'May 28, 2026', type: 'Exam' },
  ];
  const eventColors = { Meeting: '#1E45FC', Academic: '#059669', Event: '#d97706', Exam: '#dc2626' };
  const eventBg = { Meeting: '#e8ecff', Academic: '#d1fae5', Event: '#fef3c7', Exam: '#fee2e2' };

  // Quick links
  const quickLinks = [
    { label: 'Add Student', icon: '👥', color: '#1E45FC', bg: '#e8ecff' },
    { label: 'Record Fee', icon: '💳', color: '#059669', bg: '#d1fae5' },
    { label: 'Mark Attendance', icon: '📋', color: '#0891b2', bg: '#e0f2fe' },
    { label: 'View Reports', icon: '📄', color: '#7c3aed', bg: '#f5f3ff' },
    { label: 'Send Message', icon: '💬', color: '#d97706', bg: '#fef3c7' },
    { label: 'ID Cards', icon: '🪪', color: '#db2777', bg: '#fce7f3' },
  ];

  // Fee collection donut
  const feeTarget = students.length * 450000;
  const feeCollected = totalFees;
  const feePct = Math.min(100, Math.round((feeCollected / feeTarget) * 100)) || 92;
  const radius = 54;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (feePct / 100) * circumference;

  // Attendance donut
  const attPresent = 85, attAbsent = 10, attLate = 5;
  const donutR = 52, donutStroke = 13;
  const donutCirc = 2 * Math.PI * donutR;
  const presentOffset = donutCirc - (attPresent / 100) * donutCirc;
  const absentOffset  = donutCirc - (attAbsent  / 100) * donutCirc;
  const lateOffset    = donutCirc - (attLate    / 100) * donutCirc;
  const absentRotate  = (attPresent / 100) * 360;
  const lateRotate    = absentRotate + (attAbsent / 100) * 360;

  const feeMonths = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  const feeBars   = [30,45,38,55,62,48,72,65,80,58,90,75];

  const recentActivities = [
    { label: 'New student enrolled', time: '2 mins ago',  iconBg: '#e8ecff', iconColor: '#1E45FC', svgPath: 'M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2M9 7a4 4 0 100 8 4 4 0 000-8z' },
    { label: 'Payment received',     time: '15 mins ago', iconBg: '#d1fae5', iconColor: '#059669', svgPath: 'M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z' },
    { label: 'Exam scheduled',       time: '1 hour ago',  iconBg: '#fef3c7', iconColor: '#d97706', svgPath: 'M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z' },
    { label: 'Report card generated',time: '2 hours ago', iconBg: '#f5f3ff', iconColor: '#7c3aed', svgPath: 'M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8zM14 2v6h6M16 13H8M16 17H8' },
  ];

  return (
    <div className="animate-fade-in space-y-5">
      {/* Stats row */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
        <StatCard label="Total Students" value={students.length.toLocaleString()} delta="12%" deltaPositive iconBg="#e8ecff" iconColor="#1E45FC" svgPath="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2M9 7a4 4 0 100 8 4 4 0 000-8zM23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75" />
        <StatCard label="Teachers"       value={teachers.length}                  delta="5%"  deltaPositive iconBg="#dbeafe" iconColor="#2563eb" svgPath="M22 10v6M2 10l10-5 10 5-10 5zM6 12v5c3 3 9 3 12 0v-5" />
        <StatCard label="Classes"        value="48"                               delta="8%"  deltaPositive iconBg="#fce7f3" iconColor="#db2777" svgPath="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z" />
        <StatCard label="Total Revenue"  value={`UGX ${(feeCollected/1000000).toFixed(1)}M`} delta="18%" deltaPositive iconBg="#d1fae5" iconColor="#059669" svgPath="M12 1v22M17 5H9.5a3.5 3.5 0 100 7h5a3.5 3.5 0 110 7H6" />
      </div>

      {/* Middle row — Fee chart + Attendance donut + Recent Activities */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">

        {/* Fee Collection bar chart */}
        <Card className="lg:col-span-2 p-5 flex flex-col">
          <div className="mb-1">
            <h3 className="font-bold text-sm" style={{ color: '#0B0F2A' }}>Fees Collection</h3>
          </div>
          <div className="mb-3">
            <p className="text-xs text-gray-400">This Month</p>
            <p className="text-2xl font-extrabold mt-0.5" style={{ color: '#0B0F2A' }}>
              UGX {(feeCollected/1000000).toFixed(1)}M
            </p>
            <span className="text-xs font-semibold text-green-600">+18% from last month</span>
          </div>
          <div className="flex items-end gap-1 flex-1" style={{ minHeight: 90 }}>
            {feeBars.map((h, i) => (
              <div key={i} className="flex-1 flex flex-col items-center gap-0.5">
                <div className="w-full rounded-sm transition-all"
                  style={{ height: `${h}%`, minHeight: 4, background: i === feeBars.length - 3 ? '#1E45FC' : '#c7d4fd' }} />
                <span className="text-[8px] text-gray-400">{feeMonths[i].slice(0,1)}</span>
              </div>
            ))}
          </div>
        </Card>

        {/* Attendance donut */}
        <Card className="lg:col-span-2 p-5">
          <h3 className="font-bold text-sm mb-4" style={{ color: '#0B0F2A' }}>Attendance Overview</h3>
          <div className="flex items-center gap-4">
            <div className="relative flex-shrink-0" style={{ width: 120, height: 120 }}>
              <svg width="120" height="120" viewBox="0 0 120 120">
                {/* bg */}
                <circle cx="60" cy="60" r={donutR} fill="none" stroke="#eef0f6" strokeWidth={donutStroke}/>
                {/* present — blue */}
                <circle cx="60" cy="60" r={donutR} fill="none" stroke="#1E45FC" strokeWidth={donutStroke}
                  strokeDasharray={donutCirc} strokeDashoffset={presentOffset}
                  strokeLinecap="butt" transform="rotate(-90 60 60)"/>
                {/* absent — orange */}
                <circle cx="60" cy="60" r={donutR} fill="none" stroke="#f97316" strokeWidth={donutStroke}
                  strokeDasharray={donutCirc} strokeDashoffset={absentOffset}
                  strokeLinecap="butt" transform={`rotate(${-90 + absentRotate} 60 60)`}/>
                {/* late — green */}
                <circle cx="60" cy="60" r={donutR} fill="none" stroke="#22c55e" strokeWidth={donutStroke}
                  strokeDasharray={donutCirc} strokeDashoffset={lateOffset}
                  strokeLinecap="butt" transform={`rotate(${-90 + lateRotate} 60 60)`}/>
              </svg>
            </div>
            <div className="space-y-2.5 flex-1">
              {[
                { label: 'Present', pct: '85%', color: '#1E45FC' },
                { label: 'Absent',  pct: '10%', color: '#f97316' },
                { label: 'Late',    pct: '1%',  color: '#22c55e' },
              ].map((item) => (
                <div key={item.label} className="flex items-center gap-2">
                  <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: item.color }} />
                  <span className="text-xs text-gray-500 flex-1">{item.label}</span>
                  <span className="text-xs font-bold" style={{ color: '#0B0F2A' }}>{item.pct}</span>
                </div>
              ))}
            </div>
          </div>
        </Card>

        {/* Recent Activities */}
        <Card className="lg:col-span-1 flex flex-col">
          <div className="flex items-center justify-between px-4 py-3.5 border-b" style={{ borderColor: '#eef0f6' }}>
            <h3 className="font-bold text-sm" style={{ color: '#0B0F2A' }}>Recent Activities</h3>
            <button className="text-xs font-semibold" style={{ color: '#1E45FC' }}>View all</button>
          </div>
          <div className="flex-1 divide-y" style={{ borderColor: '#f1f5f9' }}>
            {recentActivities.map((a, i) => (
              <div key={i} className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50/60 transition-colors">
                <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: a.iconBg }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={a.iconColor} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                    <path d={a.svgPath}/>
                  </svg>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold truncate" style={{ color: '#0B0F2A' }}>{a.label}</p>
                  <p className="text-[10px] text-gray-400">{a.time}</p>
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════
   STUDENTS
═══════════════════════════════════════════════════ */
function StudentsPage({ roleId, schoolId }) {
  const all = queryStudents(schoolId);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('all');
  const [showModal, setModal] = useState(false);

  const filtered = all.filter(s =>
    (filter === 'all' || s.status.toLowerCase() === filter) &&
    s.name.toLowerCase().includes(search.toLowerCase())
  );

  const feeColor = { Paid: '#059669', Partial: '#d97706', Unpaid: '#dc2626' };
  const feeBg    = { Paid: '#d1fae5', Partial: '#fef3c7', Unpaid: '#fee2e2' };

  return (
    <div className="animate-fade-in space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-extrabold" style={{ color: '#0B0F2A' }}>Students</h2>
          <p className="text-xs text-gray-400 mt-0.5">{all.length} enrolled · {schoolId}</p>
        </div>
        {can(roleId, 'students.create') && (
          <button onClick={() => setModal(true)} className="btn-brand-primary text-sm py-2 px-4">+ Add Student</button>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2 px-3.5 py-2 rounded-xl border bg-white text-sm" style={{ borderColor: '#e2e8f0' }}>
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="#94a3b8" strokeWidth="1.5"><circle cx="6" cy="6" r="4.5"/><path d="M10 10L13 13"/></svg>
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search students…" className="outline-none bg-transparent text-sm w-40" />
        </div>
        {['all', 'active', 'inactive'].map(f => (
          <button key={f} onClick={() => setFilter(f)}
            className="text-xs font-semibold px-3 py-1.5 rounded-lg border capitalize transition-colors"
            style={filter === f ? { borderColor: '#1E45FC', background: '#e8ecff', color: '#1E45FC' } : { borderColor: '#e2e8f0', color: '#64748b' }}>
            {f === 'all' ? 'All' : f}
          </button>
        ))}
      </div>

      <Card className="overflow-hidden">
        <table className="w-full">
          <thead>
            <tr style={{ background: '#f8faff', borderBottom: '1px solid #eef0f6' }}>
              {['Name', 'Class', 'Parent', 'Fee', 'Status', 'Actions'].map(h => (
                <th key={h} className="text-left px-4 py-3 text-xs font-bold text-gray-400 uppercase tracking-wider">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y" style={{ borderColor: '#f5f7fb' }}>
            {filtered.map(s => (
              <tr key={s.id} className="hover:bg-gray-50/50 transition-colors">
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2.5">
                    <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0" style={{ background: '#e8ecff', color: '#1E45FC' }}>
                      {s.name.split(' ').map(w => w[0]).join('').slice(0, 2)}
                    </div>
                    <span className="text-sm font-semibold" style={{ color: '#0B0F2A' }}>{s.name}</span>
                  </div>
                </td>
                <td className="px-4 py-3 text-sm text-gray-500">{s.class}</td>
                <td className="px-4 py-3 text-sm text-gray-400">{s.parent}</td>
                <td className="px-4 py-3">
                  <span className="text-xs font-bold px-2 py-1 rounded-full" style={{ background: feeBg[s.fee], color: feeColor[s.fee] }}>{s.fee}</span>
                </td>
                <td className="px-4 py-3">
                  <span className={`text-xs font-bold px-2 py-1 rounded-full ${s.status === 'Active' ? 'bg-green-50 text-green-700' : 'bg-gray-100 text-gray-500'}`}>{s.status}</span>
                </td>
                <td className="px-4 py-3">
                  <div className="flex gap-2">
                    <button className="text-xs font-semibold hover:underline" style={{ color: '#1E45FC' }}>View</button>
                    {can(roleId, 'students.edit') && <button className="text-xs text-gray-400 hover:text-gray-600">Edit</button>}
                  </div>
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr><td colSpan={6} className="py-12 text-center text-sm text-gray-400">No students match your search.</td></tr>
            )}
          </tbody>
        </table>
      </Card>
      {showModal && <AddStudentModal onClose={() => setModal(false)} />}
    </div>
  );
}

function AddStudentModal({ onClose }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(11,15,42,0.55)', backdropFilter: 'blur(4px)' }}>
      <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl animate-slide-up">
        <div className="flex items-center justify-between px-6 py-4 border-b" style={{ borderColor: '#eef0f6' }}>
          <h3 className="font-bold text-base" style={{ color: '#0B0F2A' }}>Add New Student</h3>
          <button onClick={onClose} className="w-7 h-7 rounded-lg flex items-center justify-center text-gray-400 hover:bg-gray-100">✕</button>
        </div>
        <div className="p-6 flex flex-col gap-4">
          {[['Full Name','text','Aisha Nakato'],['Class','text','S.1 West'],['Parent Name','text','Grace Nakato'],['Parent Phone','tel','+256 700 000000']].map(([lbl,type,ph]) => (
            <div key={lbl}>
              <label className="block text-xs font-semibold text-gray-500 mb-1.5">{lbl}</label>
              <input type={type} placeholder={ph} className="w-full px-3 py-2.5 rounded-xl border text-sm outline-none transition-all" style={{ borderColor: '#e2e8f0' }}/>
            </div>
          ))}
        </div>
        <div className="flex gap-3 px-6 pb-6">
          <button onClick={onClose} className="flex-1 py-2.5 rounded-xl border text-sm font-semibold text-gray-600 hover:bg-gray-50" style={{ borderColor: '#e2e8f0' }}>Cancel</button>
          <button onClick={onClose} className="flex-1 btn-brand-primary">Add Student</button>
        </div>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════
   PARENTS
═══════════════════════════════════════════════════ */
function ParentsPage({ roleId, schoolId }) {
  const all = queryParents(schoolId);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('all');

  const filtered = all.filter(p =>
    (filter === 'all' || p.status.toLowerCase() === filter) &&
    (p.name.toLowerCase().includes(search.toLowerCase()) ||
     p.email.toLowerCase().includes(search.toLowerCase()))
  );

  const balColor = (b) => b > 0 ? '#dc2626' : '#059669';
  const balBg    = (b) => b > 0 ? '#fee2e2'  : '#d1fae5';

  const totalParents  = all.length;
  const outstanding   = all.filter(p => p.balance > 0).length;
  const activeParents = all.filter(p => p.status === 'Active').length;

  return (
    <div className="animate-fade-in space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-extrabold" style={{ color: '#0B0F2A' }}>Parents &amp; Guardians</h2>
          <p className="text-xs text-gray-400 mt-0.5">{totalParents} registered · {schoolId}</p>
        </div>
        {can(roleId, 'students.create') && (
          <button className="flex items-center gap-2 text-xs font-bold px-4 py-2 rounded-xl text-white" style={{ background: '#1E45FC' }}>
            <svg width="12" height="12" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><path d="M7 2v10M2 7h10"/></svg>
            Add Parent
          </button>
        )}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: 'Total Parents',     value: totalParents,  iconBg: '#e8ecff', iconColor: '#1E45FC', svgPath: 'M20 21v-2a4 4 0 00-4-4h-4M14 11a4 4 0 10-8 0 4 4 0 008 0zM1 21v-2a4 4 0 014-4h.5' },
          { label: 'Active',            value: activeParents, iconBg: '#d1fae5', iconColor: '#059669', svgPath: 'M22 11.08V12a10 10 0 11-5.93-9.14M22 4L12 14.01l-3-3' },
          { label: 'Outstanding Fees',  value: outstanding,   iconBg: '#fee2e2', iconColor: '#dc2626', svgPath: 'M12 1v22M17 5H9.5a3.5 3.5 0 100 7h5a3.5 3.5 0 110 7H6' },
        ].map(s => (
          <Card key={s.label} className="p-5">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs font-medium text-gray-400 mb-1">{s.label}</p>
                <p className="text-2xl font-extrabold" style={{ color: '#0B0F2A' }}>{s.value}</p>
              </div>
              <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: s.iconBg }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={s.iconColor} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <path d={s.svgPath}/>
                </svg>
              </div>
            </div>
          </Card>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2 px-3.5 py-2 rounded-xl border bg-white text-sm" style={{ borderColor: '#e2e8f0' }}>
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="#94a3b8" strokeWidth="1.5"><circle cx="6" cy="6" r="4.5"/><path d="M10 10L13 13"/></svg>
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search parents…" className="outline-none bg-transparent text-sm w-40" />
        </div>
        {['all', 'active', 'inactive'].map(f => (
          <button key={f} onClick={() => setFilter(f)}
            className="text-xs font-semibold px-3 py-1.5 rounded-lg border capitalize transition-colors"
            style={filter === f ? { borderColor: '#1E45FC', background: '#e8ecff', color: '#1E45FC' } : { borderColor: '#e2e8f0', color: '#64748b' }}>
            {f === 'all' ? 'All' : f}
          </button>
        ))}
        <span className="ml-auto text-xs text-gray-400">{filtered.length} result{filtered.length !== 1 ? 's' : ''}</span>
      </div>

      {/* Table */}
      <Card className="overflow-hidden">
        <table className="w-full">
          <thead>
            <tr style={{ background: '#f8faff', borderBottom: '1px solid #eef0f6' }}>
              {['Parent / Guardian', 'Contact', 'Children', 'Fee Balance', 'Last Contact', 'Status', ''].map(h => (
                <th key={h} className="text-left text-[11px] font-bold uppercase tracking-wide text-gray-400 px-4 py-3">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y" style={{ borderColor: '#f1f5f9' }}>
            {filtered.length === 0 ? (
              <tr><td colSpan={7} className="px-4 py-10 text-center text-sm text-gray-400">No parents found.</td></tr>
            ) : filtered.map(p => (
              <tr key={p.id} className="hover:bg-gray-50/60 transition-colors">
                {/* Name + avatar */}
                <td className="px-4 py-3">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0"
                      style={{ background: '#1E45FC' }}>
                      {p.name.split(' ').map(w => w[0]).join('').slice(0, 2)}
                    </div>
                    <div>
                      <div className="text-sm font-semibold" style={{ color: '#0B0F2A' }}>{p.name}</div>
                      <div className="text-xs text-gray-400">{p.email}</div>
                    </div>
                  </div>
                </td>
                {/* Phone */}
                <td className="px-4 py-3 text-sm text-gray-600">{p.phone}</td>
                {/* Children */}
                <td className="px-4 py-3">
                  <div className="flex flex-wrap gap-1">
                    {p.children.map(c => (
                      <span key={c} className="text-[11px] font-semibold px-2 py-0.5 rounded-full" style={{ background: '#e8ecff', color: '#1E45FC' }}>{c}</span>
                    ))}
                  </div>
                </td>
                {/* Balance */}
                <td className="px-4 py-3">
                  <span className="text-xs font-bold px-2 py-1 rounded-lg" style={{ background: balBg(p.balance), color: balColor(p.balance) }}>
                    {p.balance > 0 ? `UGX ${p.balance.toLocaleString()}` : 'Cleared'}
                  </span>
                </td>
                {/* Last contact */}
                <td className="px-4 py-3 text-xs text-gray-500">{p.lastContact}</td>
                {/* Status */}
                <td className="px-4 py-3">
                  <span className="text-[11px] font-bold px-2 py-0.5 rounded-full"
                    style={p.status === 'Active' ? { background: '#d1fae5', color: '#059669' } : { background: '#f3f4f6', color: '#6b7280' }}>
                    {p.status}
                  </span>
                </td>
                {/* Actions */}
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <button className="text-[11px] font-semibold px-2.5 py-1 rounded-lg border transition-colors"
                      style={{ borderColor: '#e2e8f0', color: '#64748b' }}
                      onMouseEnter={e => { e.currentTarget.style.borderColor = '#1E45FC'; e.currentTarget.style.color = '#1E45FC'; }}
                      onMouseLeave={e => { e.currentTarget.style.borderColor = '#e2e8f0'; e.currentTarget.style.color = '#64748b'; }}>
                      Message
                    </button>
                    <button className="text-[11px] font-semibold px-2.5 py-1 rounded-lg border transition-colors"
                      style={{ borderColor: '#e2e8f0', color: '#64748b' }}
                      onMouseEnter={e => { e.currentTarget.style.borderColor = '#1E45FC'; e.currentTarget.style.color = '#1E45FC'; }}
                      onMouseLeave={e => { e.currentTarget.style.borderColor = '#e2e8f0'; e.currentTarget.style.color = '#64748b'; }}>
                      View
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );
}

/* ══════════════════════════════════════════════════
   TEACHERS
═══════════════════════════════════════════════════ */
function TeachersPage({ roleId, schoolId }) {
  const teachers = queryTeachers(schoolId);
  return (
    <div className="animate-fade-in space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-extrabold" style={{ color: '#0B0F2A' }}>Teachers</h2>
          <p className="text-xs text-gray-400 mt-0.5">{teachers.length} staff · {schoolId}</p>
        </div>
        {can(roleId, 'teachers.create') && <button className="btn-brand-primary text-sm py-2 px-4">+ Add Teacher</button>}
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {teachers.map((t, i) => (
          <Card key={i} className="p-5 hover:shadow-md transition-all">
            <div className="flex items-start gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center font-bold text-sm flex-shrink-0" style={{ background: '#e8ecff', color: '#1E45FC' }}>
                {t.name.split(' ').map(w=>w[0]).join('').slice(0,2)}
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-bold text-sm" style={{ color: '#0B0F2A' }}>{t.name}</div>
                <div className="text-xs text-gray-400">{t.subject}</div>
              </div>
              <span className={`text-xs font-bold px-2 py-1 rounded-full flex-shrink-0 ${t.status === 'Present' ? 'bg-green-50 text-green-700' : 'bg-yellow-50 text-yellow-700'}`}>{t.status}</span>
            </div>
            <div className="flex flex-col gap-1.5 text-xs text-gray-400 mb-4">
              <div className="flex gap-2"><span className="w-14">Classes</span><span className="text-gray-600 font-medium">{t.class}</span></div>
              <div className="flex gap-2"><span className="w-14">Schedule</span><span className="text-gray-600 font-medium">{t.schedule}</span></div>
            </div>
            {can(roleId, 'teachers.edit') && (
              <div className="flex gap-2">
                <button className="flex-1 py-2 rounded-xl border text-xs font-semibold text-gray-600 hover:bg-gray-50" style={{ borderColor: '#e2e8f0' }}>Schedule</button>
                <button className="flex-1 py-2 rounded-xl text-xs font-bold text-white" style={{ background: '#1E45FC' }}>Assign Class</button>
              </div>
            )}
          </Card>
        ))}
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════
   ATTENDANCE
═══════════════════════════════════════════════════ */
function AttendancePage({ roleId, schoolId }) {
  const students = queryStudents(schoolId);
  const classes  = [...new Set(students.map(s => s.class))];
  const [selClass, setSel]   = useState(classes[0] ?? '');
  const [records, setRecords] = useState(students.map(s => ({ ...s, present: true })));
  const toggle = id => setRecords(r => r.map(s => s.id === id ? { ...s, present: !s.present } : s));
  const shown  = records.filter(s => !selClass || s.class === selClass);
  const pCount = shown.filter(s => s.present).length;

  return (
    <div className="animate-fade-in space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-extrabold" style={{ color: '#0B0F2A' }}>Attendance</h2>
          <p className="text-xs text-gray-400 mt-0.5">Today · {new Date().toLocaleDateString('en-UG', { weekday:'long', month:'long', day:'numeric', year:'numeric' })}</p>
        </div>
        {can(roleId, 'attendance.mark') && <button className="btn-brand-primary text-sm py-2 px-4">Save Attendance</button>}
      </div>

      <div className="flex flex-wrap gap-2">
        {classes.map(c => (
          <button key={c} onClick={() => setSel(c)}
            className="text-xs font-semibold px-3 py-1.5 rounded-lg border transition-colors"
            style={selClass === c ? { borderColor: '#1E45FC', background: '#e8ecff', color: '#1E45FC' } : { borderColor: '#e2e8f0', color: '#64748b' }}>
            {c}
          </button>
        ))}
      </div>

      <Card className="p-4">
        <div className="flex items-center gap-4">
          <div className="flex-1 h-2.5 rounded-full bg-gray-100 overflow-hidden">
            <div className="h-full rounded-full" style={{ width: shown.length ? `${(pCount/shown.length)*100}%` : '0%', background: 'linear-gradient(90deg, #1E45FC, #A3CF2E)' }}/>
          </div>
          <span className="text-sm font-extrabold" style={{ color: '#0B0F2A' }}>
            {pCount}/{shown.length} present {shown.length ? `(${Math.round((pCount/shown.length)*100)}%)` : ''}
          </span>
        </div>
      </Card>

      <Card className="overflow-hidden">
        {shown.map(s => (
          <div key={s.id} className="flex items-center gap-3 px-4 py-3 border-b last:border-0 hover:bg-gray-50/50" style={{ borderColor: '#f5f7fb' }}>
            <div className="flex items-center gap-2.5 flex-1 min-w-0">
              <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0"
                style={{ background: s.present ? '#e8ecff' : '#fee2e2', color: s.present ? '#1E45FC' : '#dc2626' }}>
                {s.name.split(' ').map(w=>w[0]).join('').slice(0,2)}
              </div>
              <span className="text-sm font-semibold truncate" style={{ color: '#0B0F2A' }}>{s.name}</span>
            </div>
            <span className={`w-20 text-center text-xs font-bold px-2 py-1 rounded-full ${s.present ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-600'}`}>
              {s.present ? 'Present' : 'Absent'}
            </span>
            {can(roleId, 'attendance.mark') && (
              <button onClick={() => toggle(s.id)}
                className={`relative w-10 h-5 rounded-full transition-all duration-200 flex-shrink-0 ${s.present ? '' : 'bg-gray-200'}`}
                style={s.present ? { background: '#1E45FC' } : {}}>
                <div className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-all duration-200 ${s.present ? 'left-5' : 'left-0.5'}`}/>
              </button>
            )}
          </div>
        ))}
        {shown.length === 0 && <div className="py-10 text-center text-sm text-gray-400">No students in this class.</div>}
      </Card>
    </div>
  );
}

/* ══════════════════════════════════════════════════
   TIMETABLE
═══════════════════════════════════════════════════ */
const DAYS    = ['Monday','Tuesday','Wednesday','Thursday','Friday'];
const PERIODS = ['7:30–8:30','8:30–9:30','9:30–10:30','Break','11:00–12:00','12:00–13:00','Lunch','14:00–15:00','15:00–16:00'];
const SUBJ    = ['Mathematics','English','Biology','History','Chemistry','Physics','Literature','Geography'];
const SCOL    = { Mathematics:'#1E45FC', English:'#059669', Biology:'#0891b2', History:'#7c3aed', Chemistry:'#dc2626', Physics:'#d97706', Literature:'#db2777', Geography:'#0891b2' };

const GRID = DAYS.reduce((a, d) => {
  a[d] = PERIODS.map(p => {
    if (p === 'Break') return { label:'Break', color:'#f8faff', text:'#94a3b8' };
    if (p === 'Lunch') return { label:'Lunch', color:'#fef3c7', text:'#d97706' };
    const s = SUBJ[Math.floor(Math.random()*SUBJ.length)];
    return { label: s, color: SCOL[s]+'20', text: SCOL[s] };
  });
  return a;
}, {});

function TimetablePage({ roleId }) {
  const [tab, setTab] = useState('school');
  return (
    <div className="animate-fade-in space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-extrabold" style={{ color: '#0B0F2A' }}>Timetables</h2>
          <p className="text-xs text-gray-400 mt-0.5">Term 2 · 2026</p>
        </div>
        {can(roleId, 'timetable.edit') && <button className="btn-brand-primary text-sm py-2 px-4">Edit Timetable</button>}
      </div>
      <div className="flex gap-2">
        {['school','teacher','prep','meals'].map(t => (
          <button key={t} onClick={() => setTab(t)}
            className="text-xs font-semibold px-3 py-1.5 rounded-lg border capitalize transition-colors"
            style={tab === t ? { borderColor: '#1E45FC', background: '#e8ecff', color: '#1E45FC' } : { borderColor: '#e2e8f0', color: '#64748b' }}>
            {t === 'school' ? 'School' : t === 'teacher' ? 'Teacher' : t === 'prep' ? 'Prep' : 'Meals'}
          </button>
        ))}
      </div>
      {tab === 'meals' ? <MealsSchedule /> : (
        <Card className="overflow-x-auto">
          <table className="w-full min-w-[700px]">
            <thead>
              <tr style={{ background: '#f8faff', borderBottom: '1px solid #eef0f6' }}>
                <th className="text-left px-4 py-3 text-xs font-bold text-gray-400 w-32">Time</th>
                {DAYS.map(d => <th key={d} className="text-center px-3 py-3 text-xs font-bold text-gray-400">{d}</th>)}
              </tr>
            </thead>
            <tbody>
              {PERIODS.map((p, pi) => (
                <tr key={p} className="border-b last:border-0" style={{ borderColor: '#f5f7fb' }}>
                  <td className="px-4 py-2.5 text-xs text-gray-400 font-medium whitespace-nowrap">{p}</td>
                  {DAYS.map(d => {
                    const cell = GRID[d][pi];
                    return (
                      <td key={d} className="px-2 py-2 text-center">
                        <span className="inline-block px-2 py-1 rounded-lg text-xs font-semibold whitespace-nowrap"
                          style={{ background: cell.color, color: cell.text }}>{cell.label}</span>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
    </div>
  );
}

function MealsSchedule() {
  const meals = [
    { time:'7:00 AM',  meal:'Morning Porridge', detail:'Millet porridge with sugar', kcal:'180 kcal' },
    { time:'10:30 AM', meal:'Break Snack',       detail:'Groundnuts & fruit',         kcal:'120 kcal' },
    { time:'1:00 PM',  meal:'Lunch',             detail:'Rice, beans, vegetables & juice', kcal:'650 kcal' },
    { time:'4:00 PM',  meal:'Afternoon Tea',     detail:'Bread & tea',                kcal:'200 kcal' },
    { time:'7:00 PM',  meal:'Supper',            detail:'Posho, beans & beef stew',   kcal:'700 kcal' },
  ];
  return (
    <Card className="overflow-hidden">
      {meals.map((m, i) => (
        <div key={i} className="flex items-center gap-4 px-5 py-4 border-b last:border-0 hover:bg-gray-50/50" style={{ borderColor: '#f5f7fb' }}>
          <div className="w-20 text-xs font-bold flex-shrink-0" style={{ color: '#1E45FC' }}>{m.time}</div>
          <span className="text-xl">🍽️</span>
          <div className="flex-1 min-w-0">
            <div className="text-sm font-semibold" style={{ color: '#0B0F2A' }}>{m.meal}</div>
            <div className="text-xs text-gray-400">{m.detail}</div>
          </div>
          <span className="text-xs font-bold px-2 py-1 rounded-full bg-green-50 text-green-700">{m.kcal}</span>
        </div>
      ))}
    </Card>
  );
}

/* ══════════════════════════════════════════════════
   RESULTS
═══════════════════════════════════════════════════ */
const SUBJ_LIST = ['Mathematics','English','Biology','History','Chemistry','Physics'];
function ResultsPage({ roleId, schoolId }) {
  const students = queryStudents(schoolId).slice(0, 5);
  const [marks, setMarks] = useState(
    students.map(s => ({ ...s, scores: SUBJ_LIST.reduce((a, sub) => ({ ...a, [sub]: Math.floor(Math.random()*40+55) }), {}) }))
  );
  const total = sc => Object.values(sc).reduce((a,b)=>a+b,0);
  const avg   = sc => Math.round(total(sc)/SUBJ_LIST.length);
  const grade = a  => a>=80?'D1':a>=70?'D2':a>=65?'C3':a>=60?'C4':a>=55?'C5':a>=50?'C6':'F9';
  const gcol  = a  => a>=70?'#059669':a>=55?'#d97706':'#dc2626';
  const canEdit = can(roleId, 'results.enter');

  return (
    <div className="animate-fade-in space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-extrabold" style={{ color: '#0B0F2A' }}>Academic Results</h2>
          <p className="text-xs text-gray-400 mt-0.5">S.3 East · Term 2 Exams · {schoolId}</p>
        </div>
        {canEdit && (
          <div className="flex gap-2">
            <button className="btn-brand-secondary text-sm py-2 px-4">Import Marks</button>
            <button className="btn-brand-primary text-sm py-2 px-4">Save Results</button>
          </div>
        )}
      </div>
      <Card className="overflow-x-auto">
        <table className="w-full min-w-[700px]">
          <thead>
            <tr style={{ background: '#f8faff', borderBottom: '1px solid #eef0f6' }}>
              <th className="text-left px-4 py-3 text-xs font-bold text-gray-400">Student</th>
              {SUBJ_LIST.map(s => <th key={s} className="text-center px-3 py-3 text-xs font-bold text-gray-400">{s}</th>)}
              <th className="text-center px-3 py-3 text-xs font-bold text-gray-400">Total</th>
              <th className="text-center px-3 py-3 text-xs font-bold text-gray-400">Avg</th>
              <th className="text-center px-3 py-3 text-xs font-bold text-gray-400">Grade</th>
            </tr>
          </thead>
          <tbody className="divide-y" style={{ borderColor: '#f5f7fb' }}>
            {marks.map(s => {
              const a = avg(s.scores);
              return (
                <tr key={s.id} className="hover:bg-gray-50/50">
                  <td className="px-4 py-3 text-sm font-semibold" style={{ color: '#0B0F2A' }}>{s.name}</td>
                  {SUBJ_LIST.map(sub => (
                    <td key={sub} className="px-2 py-2 text-center">
                      {canEdit ? (
                        <input type="number" min="0" max="100" value={s.scores[sub]}
                          onChange={e => setMarks(prev => prev.map(st => st.id===s.id ? {...st, scores:{...st.scores,[sub]:+e.target.value}} : st))}
                          className="w-14 text-center text-sm py-1 rounded-lg border outline-none transition-all" style={{ borderColor: '#e2e8f0' }}/>
                      ) : (
                        <span className="text-sm">{s.scores[sub]}</span>
                      )}
                    </td>
                  ))}
                  <td className="px-3 py-3 text-center text-sm font-bold" style={{ color: '#0B0F2A' }}>{total(s.scores)}</td>
                  <td className="px-3 py-3 text-center text-sm font-bold" style={{ color: gcol(a) }}>{a}%</td>
                  <td className="px-3 py-3 text-center">
                    <span className="text-xs font-bold px-2 py-1 rounded-full" style={{ background: gcol(a)+'20', color: gcol(a) }}>{grade(a)}</span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </Card>
    </div>
  );
}

/* ══════════════════════════════════════════════════
   FINANCE
═══════════════════════════════════════════════════ */
function FinancePage({ roleId, schoolId, tenant }) {
  const basePayments = queryPayments(schoolId);
  const students     = queryStudents(schoolId);
  const canRecord    = can(roleId,'finance.record');
  const canApprove   = can(roleId,'finance.approve');
  const canPayroll   = can(roleId,'finance.payroll');

  /* ── Tab state ── */
  const [tab, setTab] = useState('fees'); // fees | expenses | payroll | approvals

  /* ── Fees state ── */
  const [payments, setPayments] = useState([
    ...basePayments,
    { id:'p-06', school_id: schoolId, student:'Grace Akello',    amount:'450,000', method:'Cash',         date:'2026-05-06', status:'Confirmed', txRef:'CASH-2026-006', term:'Term 2 2026' },
    { id:'p-07', school_id: schoolId, student:'Francis Kiggundu',amount:'225,000', method:'Cheque',        date:'2026-05-05', status:'Pending',   txRef:'CHQ-0042',      term:'Term 2 2026' },
    { id:'p-08', school_id: schoolId, student:'Henry Mugisha',   amount:'150,000', method:'Mobile Money',  date:'2026-05-04', status:'Pending',   txRef:'MTN-789012',    term:'Term 2 2026' },
  ]);
  const [paySearch,  setPaySearch]  = useState('');
  const [payMethod,  setPayMethod]  = useState('all');
  const [payStatus,  setPayStatus]  = useState('all');
  const [showPayModal, setShowPayModal] = useState(false);
  const [receipt, setReceipt]  = useState(null);
  const [newPay, setNewPay]    = useState({ student:'', amount:'', method:'Mobile Money', txRef:'', term:'Term 2 2026' });

  /* ── Expenses state ── */
  const [expenses, setExpenses] = useState([
    { id:'e-01', category:'Utilities',    desc:'Electricity bill – April',         amount:580000,  date:'2026-05-02', status:'Approved',  submittedBy:'Bursar',      approvedBy:'Head Teacher' },
    { id:'e-02', category:'Supplies',     desc:'Stationery & chalk restock',       amount:120000,  date:'2026-05-03', status:'Approved',  submittedBy:'Bursar',      approvedBy:'Head Teacher' },
    { id:'e-03', category:'Maintenance',  desc:'Classroom roof repair – Block B',  amount:950000,  date:'2026-05-04', status:'Pending',   submittedBy:'Bursar',      approvedBy:null },
    { id:'e-04', category:'Transport',    desc:'School bus fuel – May',            amount:340000,  date:'2026-05-05', status:'Pending',   submittedBy:'Bursar',      approvedBy:null },
    { id:'e-05', category:'Events',       desc:'Sports Day catering',              amount:280000,  date:'2026-05-06', status:'Rejected',  submittedBy:'Bursar',      approvedBy:'Director' },
    { id:'e-06', category:'Salaries',     desc:'Support staff – April payroll',   amount:2400000, date:'2026-04-30', status:'Approved',  submittedBy:'Bursar',      approvedBy:'Director' },
  ]);
  const [showExpModal, setShowExpModal] = useState(false);
  const [newExp, setNewExp] = useState({ category:'Utilities', desc:'', amount:'' });
  const expCategories = ['Utilities','Supplies','Maintenance','Transport','Events','Salaries','Other'];

  /* ── Payroll state ── */
  const payroll = [
    { id:'pr-01', name:'Grace Namutebi',  role:'Teacher',        subject:'Mathematics', gross:850000,  tax:85000,  nssf:51000,  net:714000,  status:'Paid' },
    { id:'pr-02', name:'Joseph Okoye',    role:'Teacher',        subject:'English',     gross:820000,  tax:82000,  nssf:49200,  net:688800,  status:'Paid' },
    { id:'pr-03', name:'Stella Akello',   role:'Teacher',        subject:'Biology',     gross:820000,  tax:82000,  nssf:49200,  net:688800,  status:'Pending' },
    { id:'pr-04', name:'Peter Ssemanda',  role:'Teacher',        subject:'History',     gross:800000,  tax:80000,  nssf:48000,  net:672000,  status:'Paid' },
    { id:'pr-05', name:'Irene Nakimera',  role:'Teacher',        subject:'Chemistry',   gross:830000,  tax:83000,  nssf:49800,  net:697200,  status:'Pending' },
    { id:'pr-06', name:'James Okoye',     role:'Bursar',         subject:'—',           gross:900000,  tax:90000,  nssf:54000,  net:756000,  status:'Paid' },
    { id:'pr-07', name:'Agnes Namukwaya', role:'School Admin',   subject:'—',           gross:1100000, tax:110000, nssf:66000,  net:924000,  status:'Paid' },
  ];

  /* ── Derived metrics ── */
  const confirmed  = payments.filter(p=>p.status==='Confirmed');
  const pending    = payments.filter(p=>p.status==='Pending');
  const totalFees  = confirmed.reduce((s,p)=>s+parseInt(p.amount.replace(/,/g,''),10),0);
  const totalExp   = expenses.filter(e=>e.status==='Approved').reduce((s,e)=>s+e.amount,0);
  const totalPayroll = payroll.reduce((s,p)=>s+p.net,0);
  const pendingApprovals = [...expenses.filter(e=>e.status==='Pending'), ...payments.filter(p=>p.status==='Pending')];

  /* ── Filtered fees ── */
  const filteredPay = payments.filter(p=>
    (payMethod==='all' || p.method===payMethod) &&
    (payStatus==='all' || p.status===payStatus) &&
    (p.student.toLowerCase().includes(paySearch.toLowerCase()) || (p.txRef||'').toLowerCase().includes(paySearch.toLowerCase()))
  );

  /* ── Record new payment ── */
  const recordPayment = () => {
    if (!newPay.student || !newPay.amount) return;
    const id = 'p-' + Date.now();
    setPayments(prev=>[{ id, school_id:schoolId, ...newPay, date:new Date().toISOString().slice(0,10), status:'Pending', txRef: newPay.txRef || `TXN-${Date.now()}` }, ...prev]);
    setNewPay({ student:'', amount:'', method:'Mobile Money', txRef:'', term:'Term 2 2026' });
    setShowPayModal(false);
  };

  /* ── Approve payment ── */
  const approvePayment = (id) => setPayments(prev=>prev.map(p=>p.id===id?{...p,status:'Confirmed'}:p));

  /* ── Approve/reject expense ── */
  const approveExp = (id,action) => setExpenses(prev=>prev.map(e=>e.id===id?{...e,status:action,approvedBy:action==='Approved'?'Head Teacher':'Director'}:e));

  /* ── Add expense ── */
  const addExpense = () => {
    if (!newExp.desc || !newExp.amount) return;
    setExpenses(prev=>[{ id:'e-'+Date.now(), ...newExp, amount:parseInt(newExp.amount,10), date:new Date().toISOString().slice(0,10), status:'Pending', submittedBy:'Bursar', approvedBy:null }, ...prev]);
    setNewExp({ category:'Utilities', desc:'', amount:'' });
    setShowExpModal(false);
  };

  const TABS = [
    { id:'fees',      label:'Fee Payments',    badge: pending.length||null },
    { id:'expenses',  label:'Expenses',         badge: expenses.filter(e=>e.status==='Pending').length||null },
    { id:'payroll',   label:'Payroll',          badge: null },
    { id:'approvals', label:'Approvals',        badge: pendingApprovals.length||null },
  ];

  const methodColors = { 'Mobile Money':'#1E45FC', 'Cash':'#059669', 'Cheque':'#7c3aed', 'Bank Transfer':'#0891b2', 'Online':'#d97706' };
  const methodBg     = { 'Mobile Money':'#e8ecff', 'Cash':'#d1fae5',  'Cheque':'#f5f3ff', 'Bank Transfer':'#e0f2fe', 'Online':'#fef3c7' };
  const expStatusColor = { Approved:'#059669', Pending:'#d97706', Rejected:'#dc2626' };
  const expStatusBg    = { Approved:'#d1fae5',  Pending:'#fef3c7',  Rejected:'#fee2e2' };

  return (
    <div className="animate-fade-in space-y-5">

      {/* ── Header ── */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-lg font-extrabold" style={{ color:'#0B0F2A' }}>Finance</h2>
          <p className="text-xs text-gray-400 mt-0.5">School finance management · {tenant?.name ?? schoolId}</p>
        </div>
        <div className="flex gap-2">
          {canRecord && tab==='fees' && (
            <button onClick={()=>setShowPayModal(true)} className="flex items-center gap-2 text-xs font-bold px-4 py-2 rounded-xl text-white" style={{ background:'#1E45FC' }}>
              <svg width="12" height="12" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><path d="M7 2v10M2 7h10"/></svg>
              Record Payment
            </button>
          )}
          {canRecord && tab==='expenses' && (
            <button onClick={()=>setShowExpModal(true)} className="flex items-center gap-2 text-xs font-bold px-4 py-2 rounded-xl text-white" style={{ background:'#7c3aed' }}>
              <svg width="12" height="12" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><path d="M7 2v10M2 7h10"/></svg>
              Add Expense
            </button>
          )}
        </div>
      </div>

      {/* ── Metric cards ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label:'Total Fees Collected', value:`UGX ${(totalFees/1000000).toFixed(2)}M`,       delta:'+18%', color:'#059669', bg:'#d1fae5', path:'M12 1v22M17 5H9.5a3.5 3.5 0 100 7h5a3.5 3.5 0 110 7H6' },
          { label:'Pending Payments',      value:`${pending.length} payments`,                   delta:`UGX ${pending.length*225}K`, color:'#d97706', bg:'#fef3c7', path:'M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z' },
          { label:'Total Expenses',        value:`UGX ${(totalExp/1000000).toFixed(2)}M`,         delta:'This term', color:'#dc2626', bg:'#fee2e2', path:'M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3' },
          { label:'Payroll (Monthly)',     value:`UGX ${(totalPayroll/1000000).toFixed(2)}M`,      delta:'7 staff', color:'#7c3aed', bg:'#f5f3ff', path:'M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2M9 7a4 4 0 100 8 4 4 0 000-8z' },
        ].map(m=>(
          <Card key={m.label} className="p-4">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs text-gray-400 mb-1">{m.label}</p>
                <p className="text-lg font-extrabold" style={{ color:'#0B0F2A' }}>{m.value}</p>
                <p className="text-xs font-semibold mt-0.5" style={{ color:m.color }}>{m.delta}</p>
              </div>
              <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background:m.bg }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={m.color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d={m.path}/></svg>
              </div>
            </div>
          </Card>
        ))}
      </div>

      {/* ── Tabs ── */}
      <div className="flex items-center gap-1 p-1 rounded-xl" style={{ background:'#f0f2f8' }}>
        {TABS.map(t=>(
          <button key={t.id} onClick={()=>setTab(t.id)}
            className="flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-xs font-bold transition-all"
            style={tab===t.id?{ background:'#fff', color:'#1E45FC', boxShadow:'0 1px 4px rgba(0,0,0,0.08)' }:{ color:'#64748b' }}>
            {t.label}
            {t.badge ? <span className="w-4 h-4 rounded-full text-white flex items-center justify-center text-[9px] font-bold" style={{ background:'#dc2626' }}>{t.badge}</span> : null}
          </button>
        ))}
      </div>

      {/* ══ TAB: FEE PAYMENTS ══ */}
      {tab==='fees' && (
        <div className="space-y-4">
          {/* Filters */}
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2 px-3.5 py-2 rounded-xl border bg-white text-sm" style={{ borderColor:'#e2e8f0' }}>
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="#94a3b8" strokeWidth="1.5"><circle cx="6" cy="6" r="4.5"/><path d="M10 10L13 13"/></svg>
              <input value={paySearch} onChange={e=>setPaySearch(e.target.value)} placeholder="Student or Tx ID…" className="outline-none bg-transparent text-sm w-36"/>
            </div>
            <select value={payMethod} onChange={e=>setPayMethod(e.target.value)} className="px-3 py-2 rounded-xl border text-xs font-semibold bg-white outline-none" style={{ borderColor:'#e2e8f0', color:'#0B0F2A' }}>
              <option value="all">All Methods</option>
              {['Mobile Money','Cash','Cheque','Bank Transfer','Online'].map(m=><option key={m}>{m}</option>)}
            </select>
            {['all','Confirmed','Pending'].map(s=>(
              <button key={s} onClick={()=>setPayStatus(s)}
                className="text-xs font-semibold px-3 py-1.5 rounded-lg border transition-colors"
                style={payStatus===s?{borderColor:'#1E45FC',background:'#e8ecff',color:'#1E45FC'}:{borderColor:'#e2e8f0',color:'#64748b'}}>
                {s==='all'?'All':s}
              </button>
            ))}
            <span className="ml-auto text-xs text-gray-400">{filteredPay.length} records</span>
          </div>

          <Card className="overflow-hidden">
            <table className="w-full">
              <thead>
                <tr style={{ background:'#f8faff', borderBottom:'1px solid #eef0f6' }}>
                  {['Student','Amount','Method','Tx Reference','Term','Date','Status',''].map(h=>(
                    <th key={h} className="text-left px-4 py-3 text-[11px] font-bold text-gray-400 uppercase tracking-wider">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y" style={{ borderColor:'#f1f5f9' }}>
                {filteredPay.length===0
                  ? <tr><td colSpan={8} className="px-4 py-10 text-center text-sm text-gray-400">No payments found.</td></tr>
                  : filteredPay.map(p=>(
                  <tr key={p.id} className="hover:bg-gray-50/60 transition-colors">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2.5">
                        <div className="w-7 h-7 rounded-full flex items-center justify-center text-white text-[10px] font-bold flex-shrink-0" style={{ background:'#1E45FC' }}>
                          {p.student.split(' ').map(w=>w[0]).join('').slice(0,2)}
                        </div>
                        <span className="text-sm font-semibold" style={{ color:'#0B0F2A' }}>{p.student}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm font-bold text-green-700">UGX {p.amount}</td>
                    <td className="px-4 py-3">
                      <span className="text-[11px] font-bold px-2 py-1 rounded-lg" style={{ background:methodBg[p.method]||'#f0f0f0', color:methodColors[p.method]||'#64748b' }}>{p.method}</span>
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-gray-500">{p.txRef||'—'}</td>
                    <td className="px-4 py-3 text-xs text-gray-500">{p.term||'Term 2 2026'}</td>
                    <td className="px-4 py-3 text-xs text-gray-400">{p.date}</td>
                    <td className="px-4 py-3">
                      <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${p.status==='Confirmed'?'bg-green-50 text-green-700':'bg-yellow-50 text-yellow-700'}`}>{p.status}</span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1.5">
                        {canApprove && p.status==='Pending' && (
                          <button onClick={()=>approvePayment(p.id)} className="text-[11px] font-bold px-2.5 py-1 rounded-lg text-white" style={{ background:'#059669' }}>Approve</button>
                        )}
                        <button onClick={()=>setReceipt(p)} className="text-[11px] font-semibold px-2.5 py-1 rounded-lg border transition-colors" style={{ borderColor:'#e2e8f0', color:'#1E45FC' }}>Receipt</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        </div>
      )}

      {/* ══ TAB: EXPENSES ══ */}
      {tab==='expenses' && (
        <Card className="overflow-hidden">
          <table className="w-full">
            <thead>
              <tr style={{ background:'#f8faff', borderBottom:'1px solid #eef0f6' }}>
                {['Category','Description','Amount','Date','Submitted By','Status',''].map(h=>(
                  <th key={h} className="text-left px-4 py-3 text-[11px] font-bold text-gray-400 uppercase tracking-wider">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y" style={{ borderColor:'#f1f5f9' }}>
              {expenses.map(e=>(
                <tr key={e.id} className="hover:bg-gray-50/60 transition-colors">
                  <td className="px-4 py-3">
                    <span className="text-[11px] font-bold px-2 py-1 rounded-lg" style={{ background:'#f0f2f8', color:'#0B0F2A' }}>{e.category}</span>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-700">{e.desc}</td>
                  <td className="px-4 py-3 text-sm font-bold" style={{ color:'#dc2626' }}>UGX {e.amount.toLocaleString()}</td>
                  <td className="px-4 py-3 text-xs text-gray-400">{e.date}</td>
                  <td className="px-4 py-3 text-xs text-gray-500">{e.submittedBy}</td>
                  <td className="px-4 py-3">
                    <span className="text-[11px] font-bold px-2 py-0.5 rounded-full" style={{ background:expStatusBg[e.status], color:expStatusColor[e.status] }}>{e.status}</span>
                    {e.approvedBy && <div className="text-[9px] text-gray-400 mt-0.5">by {e.approvedBy}</div>}
                  </td>
                  <td className="px-4 py-3">
                    {canApprove && e.status==='Pending' ? (
                      <div className="flex gap-1.5">
                        <button onClick={()=>approveExp(e.id,'Approved')} className="text-[11px] font-bold px-2.5 py-1 rounded-lg text-white" style={{ background:'#059669' }}>Approve</button>
                        <button onClick={()=>approveExp(e.id,'Rejected')} className="text-[11px] font-bold px-2.5 py-1 rounded-lg text-white" style={{ background:'#dc2626' }}>Reject</button>
                      </div>
                    ) : <span className="text-xs text-gray-300">—</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}

      {/* ══ TAB: PAYROLL ══ */}
      {tab==='payroll' && (
        <div className="space-y-4">
          <div className="grid grid-cols-3 gap-4">
            {[
              { label:'Total Gross', value:`UGX ${(payroll.reduce((s,p)=>s+p.gross,0)/1000000).toFixed(2)}M`, color:'#0B0F2A' },
              { label:'Total Tax Deducted', value:`UGX ${(payroll.reduce((s,p)=>s+p.tax,0)/1000).toFixed(0)}K`, color:'#dc2626' },
              { label:'Total Net Payable', value:`UGX ${(totalPayroll/1000000).toFixed(2)}M`, color:'#059669' },
            ].map(m=>(
              <Card key={m.label} className="p-4 text-center">
                <div className="text-xs text-gray-400 mb-1">{m.label}</div>
                <div className="text-xl font-extrabold" style={{ color:m.color }}>{m.value}</div>
              </Card>
            ))}
          </div>
          <Card className="overflow-hidden">
            <table className="w-full">
              <thead>
                <tr style={{ background:'#f8faff', borderBottom:'1px solid #eef0f6' }}>
                  {['Staff Member','Role','Subject','Gross (UGX)','Tax','NSSF','Net Pay','Status',''].map(h=>(
                    <th key={h} className="text-left px-4 py-3 text-[11px] font-bold text-gray-400 uppercase tracking-wider">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y" style={{ borderColor:'#f1f5f9' }}>
                {payroll.map(p=>(
                  <tr key={p.id} className="hover:bg-gray-50/60 transition-colors">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2.5">
                        <div className="w-7 h-7 rounded-full flex items-center justify-center text-white text-[10px] font-bold flex-shrink-0" style={{ background:'#7c3aed' }}>
                          {p.name.split(' ').map(w=>w[0]).join('').slice(0,2)}
                        </div>
                        <span className="text-sm font-semibold" style={{ color:'#0B0F2A' }}>{p.name}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-500">{p.role}</td>
                    <td className="px-4 py-3 text-xs text-gray-500">{p.subject}</td>
                    <td className="px-4 py-3 text-sm font-semibold text-gray-700">{p.gross.toLocaleString()}</td>
                    <td className="px-4 py-3 text-xs text-red-500">-{p.tax.toLocaleString()}</td>
                    <td className="px-4 py-3 text-xs text-orange-500">-{p.nssf.toLocaleString()}</td>
                    <td className="px-4 py-3 text-sm font-bold text-green-700">{p.net.toLocaleString()}</td>
                    <td className="px-4 py-3">
                      <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${p.status==='Paid'?'bg-green-50 text-green-700':'bg-yellow-50 text-yellow-700'}`}>{p.status}</span>
                    </td>
                    <td className="px-4 py-3">
                      <button className="text-[11px] font-semibold px-2.5 py-1 rounded-lg border text-gray-500" style={{ borderColor:'#e2e8f0' }}>Payslip</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        </div>
      )}

      {/* ══ TAB: APPROVALS ══ */}
      {tab==='approvals' && (
        <div className="space-y-3">
          {pendingApprovals.length===0 ? (
            <Card className="p-12 text-center">
              <div className="text-3xl mb-2">✅</div>
              <p className="text-sm font-semibold text-gray-500">All items are approved. No pending actions.</p>
            </Card>
          ) : pendingApprovals.map((item,i)=>{
            const isFee = !!item.student;
            return (
              <Card key={i} className="p-4 flex items-center gap-4">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                  style={{ background: isFee?'#e8ecff':'#fef3c7' }}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={isFee?'#1E45FC':'#d97706'} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                    <path d={isFee?'M12 1v22M17 5H9.5a3.5 3.5 0 100 7h5a3.5 3.5 0 110 7H6':'M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3'}/>
                  </svg>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-bold" style={{ color:'#0B0F2A' }}>
                    {isFee ? `Fee Payment — ${item.student}` : `Expense — ${item.desc}`}
                  </div>
                  <div className="text-xs text-gray-400 mt-0.5">
                    {isFee
                      ? `UGX ${item.amount} · ${item.method} · ${item.date}`
                      : `UGX ${item.amount?.toLocaleString()} · ${item.category} · ${item.date}`}
                  </div>
                  <div className="text-[10px] mt-0.5 font-semibold" style={{ color:'#d97706' }}>
                    {isFee ? '🔐 Awaiting bursar/admin confirmation' : '🔐 Awaiting head teacher / director approval'}
                  </div>
                </div>
                {canApprove && (
                  <div className="flex gap-2 flex-shrink-0">
                    <button
                      onClick={()=>isFee?approvePayment(item.id):approveExp(item.id,'Approved')}
                      className="text-xs font-bold px-3 py-1.5 rounded-xl text-white" style={{ background:'#059669' }}>
                      Approve
                    </button>
                    {!isFee && (
                      <button onClick={()=>approveExp(item.id,'Rejected')}
                        className="text-xs font-bold px-3 py-1.5 rounded-xl text-white" style={{ background:'#dc2626' }}>
                        Reject
                      </button>
                    )}
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}

      {/* ══ RECORD PAYMENT MODAL ══ */}
      {showPayModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background:'rgba(11,15,42,0.6)' }} onClick={()=>setShowPayModal(false)}>
          <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl" onClick={e=>e.stopPropagation()}>
            <div className="flex items-center justify-between px-6 py-4 border-b" style={{ borderColor:'#eef0f6' }}>
              <h3 className="font-bold text-base" style={{ color:'#0B0F2A' }}>Record School Fee Payment</h3>
              <button onClick={()=>setShowPayModal(false)} className="w-7 h-7 rounded-lg flex items-center justify-center text-gray-400 hover:bg-gray-100">✕</button>
            </div>
            <div className="p-6 space-y-4">
              {/* Student select */}
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1.5">Student <span className="text-red-400">*</span></label>
                <select value={newPay.student} onChange={e=>setNewPay(p=>({...p,student:e.target.value}))}
                  className="w-full px-3 py-2.5 rounded-xl border text-sm bg-white outline-none" style={{ borderColor:'#e2e8f0' }}>
                  <option value="">— Select student —</option>
                  {students.map(s=><option key={s.id}>{s.name}</option>)}
                </select>
              </div>
              {/* Amount */}
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1.5">Amount (UGX) <span className="text-red-400">*</span></label>
                <input type="number" value={newPay.amount} onChange={e=>setNewPay(p=>({...p,amount:e.target.value}))}
                  placeholder="450000" className="w-full px-3 py-2.5 rounded-xl border text-sm outline-none" style={{ borderColor:'#e2e8f0' }}/>
              </div>
              {/* Payment method — big buttons */}
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-2">Payment Method <span className="text-red-400">*</span></label>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { m:'Mobile Money', icon:'📱' },
                    { m:'Cash',         icon:'💵' },
                    { m:'Cheque',       icon:'📝' },
                    { m:'Online',       icon:'🌐' },
                  ].map(({m,icon})=>(
                    <button key={m} type="button" onClick={()=>setNewPay(p=>({...p,method:m}))}
                      className="flex items-center gap-2 px-3 py-2.5 rounded-xl border text-sm font-semibold transition-all"
                      style={newPay.method===m
                        ?{ borderColor:'#1E45FC', background:'#e8ecff', color:'#1E45FC' }
                        :{ borderColor:'#e2e8f0', color:'#64748b' }}>
                      <span>{icon}</span>{m}
                    </button>
                  ))}
                </div>
              </div>
              {/* Tx ref */}
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1.5">Transaction Reference</label>
                <input type="text" value={newPay.txRef} onChange={e=>setNewPay(p=>({...p,txRef:e.target.value}))}
                  placeholder="MTN-XXXXXXXX" className="w-full px-3 py-2.5 rounded-xl border text-sm font-mono outline-none" style={{ borderColor:'#e2e8f0' }}/>
              </div>
              {/* Term */}
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1.5">Term</label>
                <select value={newPay.term} onChange={e=>setNewPay(p=>({...p,term:e.target.value}))}
                  className="w-full px-3 py-2.5 rounded-xl border text-sm bg-white outline-none" style={{ borderColor:'#e2e8f0' }}>
                  {['Term 1 2026','Term 2 2026','Term 3 2025'].map(t=><option key={t}>{t}</option>)}
                </select>
              </div>
            </div>
            <div className="flex gap-3 px-6 pb-6">
              <button onClick={()=>setShowPayModal(false)} className="flex-1 py-2.5 rounded-xl border text-sm font-semibold text-gray-600" style={{ borderColor:'#e2e8f0' }}>Cancel</button>
              <button onClick={recordPayment} className="flex-1 py-2.5 rounded-xl text-sm font-bold text-white" style={{ background:'#1E45FC' }}>Save Payment</button>
            </div>
          </div>
        </div>
      )}

      {/* ══ ADD EXPENSE MODAL ══ */}
      {showExpModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background:'rgba(11,15,42,0.6)' }} onClick={()=>setShowExpModal(false)}>
          <div className="bg-white rounded-2xl w-full max-w-sm shadow-2xl" onClick={e=>e.stopPropagation()}>
            <div className="flex items-center justify-between px-6 py-4 border-b" style={{ borderColor:'#eef0f6' }}>
              <h3 className="font-bold text-base" style={{ color:'#0B0F2A' }}>Submit Expense</h3>
              <button onClick={()=>setShowExpModal(false)} className="w-7 h-7 rounded-lg flex items-center justify-center text-gray-400 hover:bg-gray-100">✕</button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1.5">Category</label>
                <select value={newExp.category} onChange={e=>setNewExp(x=>({...x,category:e.target.value}))}
                  className="w-full px-3 py-2.5 rounded-xl border text-sm bg-white outline-none" style={{ borderColor:'#e2e8f0' }}>
                  {expCategories.map(c=><option key={c}>{c}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1.5">Description <span className="text-red-400">*</span></label>
                <input type="text" value={newExp.desc} onChange={e=>setNewExp(x=>({...x,desc:e.target.value}))}
                  placeholder="e.g. Electricity bill May" className="w-full px-3 py-2.5 rounded-xl border text-sm outline-none" style={{ borderColor:'#e2e8f0' }}/>
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1.5">Amount (UGX) <span className="text-red-400">*</span></label>
                <input type="number" value={newExp.amount} onChange={e=>setNewExp(x=>({...x,amount:e.target.value}))}
                  placeholder="500000" className="w-full px-3 py-2.5 rounded-xl border text-sm outline-none" style={{ borderColor:'#e2e8f0' }}/>
              </div>
              <p className="text-[11px] text-amber-600 bg-amber-50 px-3 py-2 rounded-xl">⚠️ Submitted expenses require approval from the Head Teacher or Director before being finalised.</p>
            </div>
            <div className="flex gap-3 px-6 pb-6">
              <button onClick={()=>setShowExpModal(false)} className="flex-1 py-2.5 rounded-xl border text-sm font-semibold text-gray-600" style={{ borderColor:'#e2e8f0' }}>Cancel</button>
              <button onClick={addExpense} className="flex-1 py-2.5 rounded-xl text-sm font-bold text-white" style={{ background:'#7c3aed' }}>Submit</button>
            </div>
          </div>
        </div>
      )}

      {/* ══ RECEIPT MODAL ══ */}
      {receipt && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background:'rgba(11,15,42,0.65)' }} onClick={()=>setReceipt(null)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm" onClick={e=>e.stopPropagation()}>
            {/* Receipt header */}
            <div className="px-6 py-5 text-center border-b" style={{ borderColor:'#eef0f6' }}>
              <div className="flex items-center justify-center gap-2 mb-1">
                <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background:'#1E45FC' }}>
                  <img src="/skoulhub-logo.png" alt="" style={{ width:14,height:14,objectFit:'contain',filter:'brightness(0) invert(1)' }}/>
                </div>
                <span className="font-extrabold text-base" style={{ color:'#1E45FC' }}>Skoul<span style={{ color:'#A3CF2E' }}>Hub</span></span>
              </div>
              <div className="text-xs text-gray-400">{tenant?.name ?? 'School'}</div>
              <div className="text-xs font-bold mt-2 px-3 py-1 rounded-full inline-block" style={{ background:'#d1fae5', color:'#059669' }}>OFFICIAL RECEIPT</div>
            </div>
            {/* Receipt body */}
            <div className="px-6 py-4 space-y-2.5">
              {[
                ['Receipt No.',   `RCP-${receipt.id?.toUpperCase()}`],
                ['Student',       receipt.student],
                ['Amount Paid',   `UGX ${receipt.amount}`],
                ['Payment Method',receipt.method],
                ['Tx Reference',  receipt.txRef||'—'],
                ['Term',          receipt.term||'Term 2 2026'],
                ['Date',          receipt.date],
                ['Status',        receipt.status],
              ].map(([l,v])=>(
                <div key={l} className="flex items-center justify-between py-1.5 border-b border-dashed" style={{ borderColor:'#f0f0f0' }}>
                  <span className="text-xs text-gray-400">{l}</span>
                  <span className={`text-xs font-bold ${l==='Status'?(receipt.status==='Confirmed'?'text-green-700':'text-yellow-700'):''}`} style={{ color: l==='Amount Paid'?'#059669': l==='Status'?undefined:'#0B0F2A' }}>{v}</span>
                </div>
              ))}
            </div>
            <div className="px-6 pb-3 text-center text-[10px] text-gray-400">
              Generated by SkoulHub · {new Date().toLocaleDateString()}
            </div>
            {/* Divider with scissors */}
            <div className="mx-6 border-t border-dashed text-center text-gray-300 text-xs mb-3" style={{ borderColor:'#e2e8f0' }}>✂</div>
            <div className="flex gap-3 px-6 pb-6">
              <button onClick={()=>setReceipt(null)} className="flex-1 py-2.5 rounded-xl border text-xs font-semibold text-gray-600" style={{ borderColor:'#e2e8f0' }}>Close</button>
              <button className="flex-1 py-2.5 rounded-xl text-xs font-bold text-white" style={{ background:'#1E45FC' }}>Print Receipt</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ══════════════════════════════════════════════════
   REPORT CARDS
═══════════════════════════════════════════════════ */
function ReportCardsPage({ roleId, schoolId }) {
  const allStudents = queryStudents(schoolId);
  const canGen  = can(roleId, 'reports.generate');
  const canSend = can(roleId, 'reports.send');

  // Aggregate mock marks per student
  const SUBJECTS = ['Mathematics','English','Biology','History','Chemistry','Physics','Geography'];
  const MOCK_MARKS = {
    's-01': [88,82,76,71,68,79,85],
    's-02': [62,70,55,68,60,58,65],
    's-03': [91,88,84,79,80,88,90],
    's-04': [45,50,42,55,48,40,52],
    's-05': [78,75,70,72,74,76,80],
    's-06': [55,60,58,62,50,54,60],
    's-07': [83,80,77,74,76,82,85],
    's-08': [40,45,48,42,44,38,50],
  };
  const gradeOf = avg => avg>=80?'D1':avg>=75?'D2':avg>=70?'C3':avg>=65?'C4':avg>=60?'C5':avg>=55?'C6':avg>=50?'P7':avg>=45?'P8':'F9';
  const gradeColor = g => g.startsWith('D')?'#059669':g.startsWith('C')?'#1E45FC':g.startsWith('P')?'#d97706':'#dc2626';
  const gradeBg    = g => g.startsWith('D')?'#d1fae5':g.startsWith('C')?'#e8ecff':g.startsWith('P')?'#fef3c7':'#fee2e2';

  const reportData = allStudents.map((s, idx) => {
    const marks = MOCK_MARKS[s.id] || SUBJECTS.map(() => Math.floor(Math.random()*40+45));
    const avg   = Math.round(marks.reduce((a,b)=>a+b,0)/marks.length);
    const grade = gradeOf(avg);
    const pos   = idx + 1;
    return { ...s, marks, avg, grade, pos, total: allStudents.length };
  }).sort((a,b) => b.avg - a.avg).map((s,i) => ({ ...s, pos: i+1 }));

  const [search,   setSearch]   = useState('');
  const [classF,   setClassF]   = useState('all');
  const [termF,    setTermF]    = useState('Term 2 2026');
  const [selected, setSelected] = useState(null); // view modal
  const [editing,  setEditing]  = useState(null); // edit modal

  const classes = ['all', ...new Set(allStudents.map(s=>s.class))];
  const terms   = ['Term 1 2026','Term 2 2026','Term 3 2025'];

  const filtered = reportData.filter(s =>
    (classF === 'all' || s.class === classF) &&
    s.name.toLowerCase().includes(search.toLowerCase())
  );

  // Grade distribution summary
  const dist = { D:0, C:0, P:0, F:0 };
  reportData.forEach(s => { dist[s.grade[0]]++; });

  return (
    <div className="animate-fade-in space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-lg font-extrabold" style={{ color:'#0B0F2A' }}>Report Cards</h2>
          <p className="text-xs text-gray-400 mt-0.5">{termF} · {allStudents.length} students · {schoolId}</p>
        </div>
        <div className="flex items-center gap-2">
          {canGen && (
            <button className="flex items-center gap-2 text-xs font-bold px-4 py-2 rounded-xl border transition-colors"
              style={{ borderColor:'#e2e8f0', color:'#64748b' }}
              onMouseEnter={e=>{e.currentTarget.style.borderColor='#1E45FC';e.currentTarget.style.color='#1E45FC';}}
              onMouseLeave={e=>{e.currentTarget.style.borderColor='#e2e8f0';e.currentTarget.style.color='#64748b';}}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3"/></svg>
              Export All
            </button>
          )}
          {canGen && (
            <button className="flex items-center gap-2 text-xs font-bold px-4 py-2 rounded-xl text-white"
              style={{ background:'#1E45FC' }}>
              <svg width="13" height="13" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><path d="M7 2v10M2 7h10"/></svg>
              Generate All
            </button>
          )}
        </div>
      </div>

      {/* Grade distribution summary */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label:'Distinctions (D1–D2)', count: dist.D, color:'#059669', bg:'#d1fae5', range:'80–100%' },
          { label:'Credits (C3–C6)',       count: dist.C, color:'#1E45FC', bg:'#e8ecff', range:'55–79%' },
          { label:'Passes (P7–P8)',        count: dist.P, color:'#d97706', bg:'#fef3c7', range:'45–54%' },
          { label:'Failures (F9)',         count: dist.F, color:'#dc2626', bg:'#fee2e2', range:'0–44%' },
        ].map(d => (
          <Card key={d.label} className="p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center text-lg font-extrabold flex-shrink-0"
              style={{ background: d.bg, color: d.color }}>{d.count}</div>
            <div className="min-w-0">
              <div className="text-xs font-bold truncate" style={{ color:'#0B0F2A' }}>{d.label}</div>
              <div className="text-[10px] text-gray-400">{d.range}</div>
            </div>
          </Card>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        {/* Search */}
        <div className="flex items-center gap-2 px-3.5 py-2 rounded-xl border bg-white text-sm" style={{ borderColor:'#e2e8f0' }}>
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="#94a3b8" strokeWidth="1.5"><circle cx="6" cy="6" r="4.5"/><path d="M10 10L13 13"/></svg>
          <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search student…" className="outline-none bg-transparent text-sm w-36"/>
        </div>
        {/* Term filter */}
        <select value={termF} onChange={e=>setTermF(e.target.value)}
          className="px-3 py-2 rounded-xl border text-xs font-semibold bg-white outline-none appearance-none"
          style={{ borderColor:'#e2e8f0', color:'#0B0F2A' }}>
          {terms.map(t=><option key={t}>{t}</option>)}
        </select>
        {/* Class filter */}
        <div className="flex items-center gap-1.5 flex-wrap">
          {classes.map(c=>(
            <button key={c} onClick={()=>setClassF(c)}
              className="text-xs font-semibold px-3 py-1.5 rounded-lg border capitalize transition-colors"
              style={classF===c?{borderColor:'#1E45FC',background:'#e8ecff',color:'#1E45FC'}:{borderColor:'#e2e8f0',color:'#64748b'}}>
              {c==='all'?'All Classes':c}
            </button>
          ))}
        </div>
        <span className="ml-auto text-xs text-gray-400">{filtered.length} students</span>
      </div>

      {/* Student list table */}
      <Card className="overflow-hidden">
        <table className="w-full">
          <thead>
            <tr style={{ background:'#f8faff', borderBottom:'1px solid #eef0f6' }}>
              {['#','Student','Class','Avg Score','Grade','Position','Status',''].map(h=>(
                <th key={h} className="text-left text-[11px] font-bold uppercase tracking-wide text-gray-400 px-4 py-3">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y" style={{ borderColor:'#f1f5f9' }}>
            {filtered.length===0
              ? <tr><td colSpan={8} className="px-4 py-10 text-center text-sm text-gray-400">No students found.</td></tr>
              : filtered.map(s=>(
              <tr key={s.id} className="hover:bg-gray-50/60 transition-colors">
                {/* Rank */}
                <td className="px-4 py-3 text-xs font-bold" style={{ color: s.pos<=3?'#d97706':'#94a3b8' }}>
                  {s.pos<=3?['🥇','🥈','🥉'][s.pos-1]:s.pos}
                </td>
                {/* Name */}
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0"
                      style={{ background:'#1E45FC' }}>
                      {s.name.split(' ').map(w=>w[0]).join('').slice(0,2)}
                    </div>
                    <div>
                      <div className="text-sm font-semibold" style={{ color:'#0B0F2A' }}>{s.name}</div>
                      <div className="text-[10px] text-gray-400">{s.id}</div>
                    </div>
                  </div>
                </td>
                <td className="px-4 py-3 text-xs text-gray-600">{s.class}</td>
                {/* Avg score with bar */}
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <div className="w-20 h-1.5 rounded-full bg-gray-100 flex-shrink-0">
                      <div className="h-1.5 rounded-full" style={{ width:`${s.avg}%`, background: gradeColor(s.grade) }}/>
                    </div>
                    <span className="text-xs font-bold" style={{ color:'#0B0F2A' }}>{s.avg}%</span>
                  </div>
                </td>
                {/* Grade badge */}
                <td className="px-4 py-3">
                  <span className="text-xs font-extrabold px-2.5 py-1 rounded-lg"
                    style={{ background: gradeBg(s.grade), color: gradeColor(s.grade) }}>
                    {s.grade}
                  </span>
                </td>
                {/* Position */}
                <td className="px-4 py-3 text-xs font-semibold text-gray-600">
                  {s.pos}<span className="text-gray-400"> / {s.total}</span>
                </td>
                {/* Report status */}
                <td className="px-4 py-3">
                  <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-green-50 text-green-700">Ready</span>
                </td>
                {/* Actions */}
                <td className="px-4 py-3">
                  <div className="flex items-center gap-1.5">
                    <button onClick={()=>setSelected(s)}
                      className="text-[11px] font-semibold px-2.5 py-1 rounded-lg border transition-colors"
                      style={{ borderColor:'#e2e8f0', color:'#64748b' }}
                      onMouseEnter={e=>{e.currentTarget.style.borderColor='#1E45FC';e.currentTarget.style.color='#1E45FC';}}
                      onMouseLeave={e=>{e.currentTarget.style.borderColor='#e2e8f0';e.currentTarget.style.color='#64748b';}}>
                      View
                    </button>
                    {can(roleId,'reports.comment_head') && (
                      <button onClick={()=>setEditing(s)}
                        className="text-[11px] font-semibold px-2.5 py-1 rounded-lg border transition-colors"
                        style={{ borderColor:'#e2e8f0', color:'#64748b' }}
                        onMouseEnter={e=>{e.currentTarget.style.borderColor='#A3CF2E';e.currentTarget.style.color='#5a7a0a';}}
                        onMouseLeave={e=>{e.currentTarget.style.borderColor='#e2e8f0';e.currentTarget.style.color='#64748b';}}>
                        Edit
                      </button>
                    )}
                    {canSend && (
                      <button className="text-[11px] font-semibold px-2.5 py-1 rounded-lg text-white"
                        style={{ background:'#1E45FC' }}>
                        Send
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      {/* VIEW MODAL */}
      {selected && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background:'rgba(11,15,42,0.55)' }}
          onClick={()=>setSelected(null)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto"
            onClick={e=>e.stopPropagation()}>
            {/* Modal header */}
            <div className="px-6 py-4 border-b flex items-center justify-between" style={{ borderColor:'#eef0f6' }}>
              <div>
                <h3 className="font-bold text-base" style={{ color:'#0B0F2A' }}>Report Card — {selected.name}</h3>
                <p className="text-xs text-gray-400">{selected.class} · {termF}</p>
              </div>
              <button onClick={()=>setSelected(null)} className="w-8 h-8 rounded-lg flex items-center justify-center text-gray-400 hover:bg-gray-100">✕</button>
            </div>
            {/* Summary badges */}
            <div className="grid grid-cols-3 gap-3 px-6 py-4">
              {[['Avg Score',`${selected.avg}%`],['Grade',selected.grade],['Position',`${selected.pos} / ${selected.total}`]].map(([l,v])=>(
                <div key={l} className="text-center rounded-xl p-3" style={{ background:'#f8faff' }}>
                  <div className="text-lg font-extrabold" style={{ color: gradeColor(selected.grade) }}>{v}</div>
                  <div className="text-[10px] text-gray-400 mt-0.5">{l}</div>
                </div>
              ))}
            </div>
            {/* Subject marks */}
            <div className="px-6 pb-2">
              <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">Subject Results</h4>
              <div className="space-y-2.5">
                {SUBJECTS.map((subj,i)=>{
                  const m=selected.marks[i]; const g=gradeOf(m);
                  return (
                    <div key={subj} className="flex items-center gap-3">
                      <div className="w-24 text-xs font-medium text-gray-600 truncate flex-shrink-0">{subj}</div>
                      <div className="flex-1 h-2 rounded-full bg-gray-100">
                        <div className="h-2 rounded-full" style={{ width:`${m}%`, background: gradeColor(g) }}/>
                      </div>
                      <div className="w-8 text-xs font-bold text-right" style={{ color:'#0B0F2A' }}>{m}</div>
                      <span className="text-[10px] font-bold px-1.5 py-0.5 rounded w-7 text-center flex-shrink-0"
                        style={{ background: gradeBg(g), color: gradeColor(g) }}>{g}</span>
                    </div>
                  );
                })}
              </div>
            </div>
            {/* Actions */}
            <div className="flex gap-3 px-6 py-4 border-t mt-3" style={{ borderColor:'#eef0f6' }}>
              {canGen && <button className="flex-1 py-2 rounded-xl border text-xs font-semibold text-gray-600 hover:bg-gray-50" style={{ borderColor:'#e2e8f0' }}>Download PDF</button>}
              {canSend && <button className="flex-1 py-2 rounded-xl text-xs font-bold text-white" style={{ background:'#1E45FC' }}>Send to Parent</button>}
            </div>
          </div>
        </div>
      )}

      {/* EDIT MODAL */}
      {editing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background:'rgba(11,15,42,0.55)' }}
          onClick={()=>setEditing(null)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg"
            onClick={e=>e.stopPropagation()}>
            <div className="px-6 py-4 border-b flex items-center justify-between" style={{ borderColor:'#eef0f6' }}>
              <div>
                <h3 className="font-bold text-base" style={{ color:'#0B0F2A' }}>Edit Report — {editing.name}</h3>
                <p className="text-xs text-gray-400">{editing.class} · {termF}</p>
              </div>
              <button onClick={()=>setEditing(null)} className="w-8 h-8 rounded-lg flex items-center justify-center text-gray-400 hover:bg-gray-100">✕</button>
            </div>
            <div className="px-6 py-4 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1.5">Head Teacher's Comment</label>
                <textarea rows={3} defaultValue="A hardworking student who has shown great improvement this term."
                  className="w-full px-3 py-2 rounded-xl border text-sm outline-none resize-none"
                  style={{ borderColor:'#e2e8f0' }}/>
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1.5">Conduct</label>
                <select className="w-full px-3 py-2 rounded-xl border text-sm bg-white outline-none" style={{ borderColor:'#e2e8f0' }}>
                  {['Excellent','Very Good','Good','Satisfactory','Needs Improvement'].map(o=><option key={o}>{o}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1.5">Next Term Fees (UGX)</label>
                <input type="text" defaultValue="450,000" className="w-full px-3 py-2 rounded-xl border text-sm outline-none" style={{ borderColor:'#e2e8f0' }}/>
              </div>
            </div>
            <div className="flex gap-3 px-6 py-4 border-t" style={{ borderColor:'#eef0f6' }}>
              <button onClick={()=>setEditing(null)} className="flex-1 py-2 rounded-xl border text-xs font-semibold text-gray-600 hover:bg-gray-50" style={{ borderColor:'#e2e8f0' }}>Cancel</button>
              <button onClick={()=>setEditing(null)} className="flex-1 py-2 rounded-xl text-xs font-bold text-white" style={{ background:'#1E45FC' }}>Save Changes</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ══════════════════════════════════════════════════
   ID CARDS
═══════════════════════════════════════════════════ */
/* ── Mini QR code SVG — unique per student ID string ── */
function QRCode({ value, size = 56 }) {
  // Deterministic bit matrix from value string
  const hash = [...value].reduce((h, c) => (Math.imul(31, h) + c.charCodeAt(0)) | 0, 0);
  const N = 11;
  const cells = Array.from({ length: N }, (_, r) =>
    Array.from({ length: N }, (_, c) => {
      // Fixed finder patterns (corners)
      const inFinder = (r < 3 && c < 3) || (r < 3 && c >= N-3) || (r >= N-3 && c < 3);
      if (inFinder) return (r===0||r===2||c===0||c===2||(r===1&&c===1)) ? 1 : 0;
      // Pseudo-random data from hash
      return ((hash >> ((r * N + c) % 31)) & 1) ^ ((r + c) & 1 ? 1 : 0);
    })
  );
  const cell = size / N;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} xmlns="http://www.w3.org/2000/svg">
      <rect width={size} height={size} fill="white" rx="3"/>
      {cells.map((row, r) => row.map((on, c) =>
        on ? <rect key={`${r}-${c}`} x={c*cell} y={r*cell} width={cell} height={cell} fill="#0B0F2A"/> : null
      ))}
    </svg>
  );
}

function IDCardsPage({ roleId, schoolId, tenant }) {
  const allStudents = queryStudents(schoolId);
  const canGen = can(roleId, 'idcards.generate');

  // Stable assigned IDs per student (index-based, editable)
  const [idNumbers, setIdNumbers] = useState(() =>
    Object.fromEntries(allStudents.map((s, i) => [s.id, `SKH-${schoolId.slice(-3).toUpperCase()}-${String(2026000 + i + 1)}`]))
  );
  const [search,    setSearch]    = useState('');
  const [classF,    setClassF]    = useState('all');
  const [statusF,   setStatusF]   = useState('all');
  const [preview,   setPreview]   = useState(null);
  const [assigning, setAssigning] = useState(null); // { studentId, value }

  const classes = ['all', ...new Set(allStudents.map(s => s.class))];

  const filtered = allStudents.filter(s =>
    (classF  === 'all' || s.class  === classF) &&
    (statusF === 'all' || s.status.toLowerCase() === statusF) &&
    (s.name.toLowerCase().includes(search.toLowerCase()) ||
     (idNumbers[s.id] || '').toLowerCase().includes(search.toLowerCase()))
  );

  const saveId = () => {
    if (!assigning) return;
    setIdNumbers(prev => ({ ...prev, [assigning.studentId]: assigning.value }));
    setAssigning(null);
  };

  return (
    <div className="animate-fade-in space-y-5">

      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-lg font-extrabold" style={{ color:'#0B0F2A' }}>Student ID Cards</h2>
          <p className="text-xs text-gray-400 mt-0.5">{allStudents.length} students · {tenant?.name ?? schoolId}</p>
        </div>
        {canGen && (
          <button className="flex items-center gap-2 text-xs font-bold px-4 py-2 rounded-xl text-white" style={{ background:'#1E45FC' }}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3"/></svg>
            Print All
          </button>
        )}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label:'Total Students',   value: allStudents.length,                              bg:'#e8ecff', color:'#1E45FC', path:'M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2M9 7a4 4 0 100 8 4 4 0 000-8z' },
          { label:'IDs Assigned',     value: allStudents.length,                              bg:'#d1fae5', color:'#059669', path:'M9 12l2 2 4-4M7 2a2 2 0 00-2 2v16a2 2 0 002 2h10a2 2 0 002-2V4a2 2 0 00-2-2H7z' },
          { label:'Active Students',  value: allStudents.filter(s=>s.status==='Active').length, bg:'#fef3c7', color:'#d97706', path:'M16 21v-2a4 4 0 00-4-4H6a4 4 0 00-4 4v2M12 11a4 4 0 100-8 4 4 0 000 8z' },
        ].map(s => (
          <Card key={s.label} className="p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background:s.bg }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={s.color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d={s.path}/></svg>
            </div>
            <div>
              <div className="text-xl font-extrabold" style={{ color:'#0B0F2A' }}>{s.value}</div>
              <div className="text-xs text-gray-400">{s.label}</div>
            </div>
          </Card>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2 px-3.5 py-2 rounded-xl border bg-white text-sm" style={{ borderColor:'#e2e8f0' }}>
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="#94a3b8" strokeWidth="1.5"><circle cx="6" cy="6" r="4.5"/><path d="M10 10L13 13"/></svg>
          <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search name or ID…" className="outline-none bg-transparent text-sm w-40"/>
        </div>
        <select value={classF} onChange={e=>setClassF(e.target.value)}
          className="px-3 py-2 rounded-xl border text-xs font-semibold bg-white outline-none"
          style={{ borderColor:'#e2e8f0', color:'#0B0F2A' }}>
          {classes.map(c=><option key={c} value={c}>{c==='all'?'All Classes':c}</option>)}
        </select>
        {['all','active','inactive'].map(f=>(
          <button key={f} onClick={()=>setStatusF(f)}
            className="text-xs font-semibold px-3 py-1.5 rounded-lg border capitalize transition-colors"
            style={statusF===f?{borderColor:'#1E45FC',background:'#e8ecff',color:'#1E45FC'}:{borderColor:'#e2e8f0',color:'#64748b'}}>
            {f==='all'?'All':f}
          </button>
        ))}
        <span className="ml-auto text-xs text-gray-400">{filtered.length} results</span>
      </div>

      {/* Table */}
      <Card className="overflow-hidden">
        <table className="w-full">
          <thead>
            <tr style={{ background:'#f8faff', borderBottom:'1px solid #eef0f6' }}>
              {['Student','Class','Student ID Number','QR Code','Status',''].map(h=>(
                <th key={h} className="text-left text-[11px] font-bold uppercase tracking-wide text-gray-400 px-4 py-3">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y" style={{ borderColor:'#f1f5f9' }}>
            {filtered.length === 0
              ? <tr><td colSpan={6} className="px-4 py-10 text-center text-sm text-gray-400">No students found.</td></tr>
              : filtered.map(s => {
                  const sid = idNumbers[s.id] || '—';
                  return (
                    <tr key={s.id} className="hover:bg-gray-50/60 transition-colors">
                      {/* Student */}
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0"
                            style={{ background:'#1E45FC' }}>
                            {s.name.split(' ').map(w=>w[0]).join('').slice(0,2)}
                          </div>
                          <div>
                            <div className="text-sm font-semibold" style={{ color:'#0B0F2A' }}>{s.name}</div>
                            <div className="text-[10px] text-gray-400">{s.parent}</div>
                          </div>
                        </div>
                      </td>
                      {/* Class */}
                      <td className="px-4 py-3 text-xs text-gray-600">{s.class}</td>
                      {/* ID number */}
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-xs font-bold px-2.5 py-1 rounded-lg" style={{ background:'#f0f4ff', color:'#1E45FC' }}>{sid}</span>
                          {canGen && (
                            <button onClick={()=>setAssigning({ studentId: s.id, value: sid })}
                              className="p-1 rounded-lg text-gray-400 hover:text-brand-blue transition-colors"
                              title="Edit ID"
                              onMouseEnter={e=>e.currentTarget.style.color='#1E45FC'}
                              onMouseLeave={e=>e.currentTarget.style.color='#94a3b8'}>
                              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                            </button>
                          )}
                        </div>
                      </td>
                      {/* QR */}
                      <td className="px-4 py-3">
                        <div className="w-10 h-10 rounded-lg overflow-hidden border" style={{ borderColor:'#eef0f6' }}>
                          <QRCode value={sid} size={40}/>
                        </div>
                      </td>
                      {/* Status */}
                      <td className="px-4 py-3">
                        <span className="text-[11px] font-bold px-2 py-0.5 rounded-full"
                          style={s.status==='Active'?{background:'#d1fae5',color:'#059669'}:{background:'#f3f4f6',color:'#6b7280'}}>
                          {s.status}
                        </span>
                      </td>
                      {/* Actions */}
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1.5">
                          <button onClick={()=>setPreview({ ...s, sid })}
                            className="text-[11px] font-semibold px-2.5 py-1 rounded-lg border transition-colors"
                            style={{ borderColor:'#e2e8f0', color:'#64748b' }}
                            onMouseEnter={e=>{e.currentTarget.style.borderColor='#1E45FC';e.currentTarget.style.color='#1E45FC';}}
                            onMouseLeave={e=>{e.currentTarget.style.borderColor='#e2e8f0';e.currentTarget.style.color='#64748b';}}>
                            Preview
                          </button>
                          {canGen && (
                            <button className="text-[11px] font-semibold px-2.5 py-1 rounded-lg text-white"
                              style={{ background:'#1E45FC' }}>
                              Print
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
            }
          </tbody>
        </table>
      </Card>

      {/* ASSIGN ID MODAL */}
      {assigning && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background:'rgba(11,15,42,0.55)' }}
          onClick={()=>setAssigning(null)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6" onClick={e=>e.stopPropagation()}>
            <h3 className="font-bold text-base mb-1" style={{ color:'#0B0F2A' }}>Assign Student ID</h3>
            <p className="text-xs text-gray-400 mb-5">Enter a unique ID number for this student. It will be embedded in their QR code.</p>
            <label className="block text-xs font-semibold text-gray-600 mb-1.5">Student ID Number</label>
            <input
              type="text"
              value={assigning.value}
              onChange={e=>setAssigning(a=>({ ...a, value: e.target.value }))}
              className="w-full px-3 py-2.5 rounded-xl border text-sm font-mono outline-none mb-1"
              style={{ borderColor:'#1E45FC', boxShadow:'0 0 0 3px #1E45FC18' }}
            />
            <p className="text-[10px] text-gray-400 mb-5">Format suggestion: SKH-XXX-YYYYNNN</p>
            {/* Live QR preview */}
            <div className="flex items-center gap-3 p-3 rounded-xl mb-5" style={{ background:'#f8faff' }}>
              <QRCode value={assigning.value || '—'} size={52}/>
              <div>
                <div className="text-xs font-bold" style={{ color:'#0B0F2A' }}>QR Preview</div>
                <div className="font-mono text-[10px] text-gray-500 mt-0.5 break-all">{assigning.value || '—'}</div>
              </div>
            </div>
            <div className="flex gap-3">
              <button onClick={()=>setAssigning(null)} className="flex-1 py-2 rounded-xl border text-xs font-semibold text-gray-600" style={{ borderColor:'#e2e8f0' }}>Cancel</button>
              <button onClick={saveId} className="flex-1 py-2 rounded-xl text-xs font-bold text-white" style={{ background:'#1E45FC' }}>Save ID</button>
            </div>
          </div>
        </div>
      )}

      {/* PREVIEW MODAL — ID card */}
      {preview && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background:'rgba(11,15,42,0.7)' }}
          onClick={()=>setPreview(null)}>
          <div className="flex flex-col items-center gap-5" onClick={e=>e.stopPropagation()}>
            {/* Card */}
            <div className="rounded-2xl overflow-hidden shadow-2xl" style={{ width:300, background:'linear-gradient(140deg,#0B0F2A 0%,#1535d4 60%,#1E45FC 100%)' }}>
              {/* Header bar */}
              <div className="px-5 py-3 border-b border-white/10 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded-md flex items-center justify-center" style={{ background:'rgba(255,255,255,0.15)' }}>
                    <img src="/skoulhub-logo.png" alt="" style={{ width:14,height:14,objectFit:'contain',filter:'brightness(0) invert(1)' }}/>
                  </div>
                  <span className="text-white text-xs font-extrabold tracking-tight">Skoul<span style={{ color:'#A3CF2E' }}>Hub</span></span>
                </div>
                <span className="text-[10px] text-white/50 truncate max-w-[110px]">{tenant?.name ?? 'School'}</span>
              </div>
              {/* Body */}
              <div className="px-5 py-4 flex items-center gap-4">
                <div className="w-16 h-16 rounded-xl bg-white/20 flex items-center justify-center text-white font-extrabold text-xl flex-shrink-0">
                  {preview.name.split(' ').map(w=>w[0]).join('').slice(0,2)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-white font-extrabold text-sm leading-tight truncate">{preview.name}</div>
                  <div className="text-white/60 text-xs mt-0.5">{preview.class}</div>
                  <div className="font-mono text-[10px] text-white/40 mt-1">{preview.sid}</div>
                  <div className="mt-2 inline-block text-[9px] font-bold px-2 py-0.5 rounded-full" style={{ background:'#A3CF2E22', color:'#A3CF2E' }}>STUDENT</div>
                </div>
                <div className="flex-shrink-0 rounded-lg overflow-hidden" style={{ border:'2px solid rgba(255,255,255,0.15)' }}>
                  <QRCode value={preview.sid} size={56}/>
                </div>
              </div>
              {/* Footer */}
              <div className="px-5 pb-4 flex items-center justify-between">
                <div>
                  <div className="text-[9px] text-white/30 uppercase tracking-wider">Valid</div>
                  <div className="text-[10px] text-white/50 font-semibold">Term 2 · 2026</div>
                </div>
                <div className="text-right">
                  <div className="text-[9px] text-white/30 uppercase tracking-wider">Parent</div>
                  <div className="text-[10px] text-white/50 truncate max-w-[120px]">{preview.parent}</div>
                </div>
              </div>
            </div>
            {/* Actions */}
            <div className="flex gap-3 w-full" style={{ maxWidth:300 }}>
              <button onClick={()=>setPreview(null)} className="flex-1 py-2.5 rounded-xl border text-xs font-semibold bg-white" style={{ borderColor:'#e2e8f0', color:'#64748b' }}>Close</button>
              {canGen && <button className="flex-1 py-2.5 rounded-xl text-xs font-bold text-white" style={{ background:'#1E45FC' }}>Download PDF</button>}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ══════════════════════════════════════════════════
   NOTIFICATIONS
═══════════════════════════════════════════════════ */
function NotificationsPage({ roleId }) {
  const notifs = [
    { icon:'💳', title:'Fee Payment Received',  body:'UGX 450,000 from Kabuye Peter for Aisha Nakato',          time:'2m ago',  type:'finance',       read:false },
    { icon:'👤', title:'New Student Enrolled',  body:'Aisha Nakato enrolled in S.1 West.',                       time:'18m ago', type:'student',       read:false },
    { icon:'📊', title:'Results Submitted',     body:'Term 2 marks for S.3 East submitted by Ms. Grace.',        time:'1h ago',  type:'academic',      read:false },
    { icon:'📧', title:'Emails Sent',           body:'42 parents notified about Term 2 report cards via email.', time:'3h ago',  type:'communication', read:true  },
    { icon:'⚠️', title:'Low Attendance Alert',  body:'David Opiyo (S.1 East) absent 5 consecutive days.',        time:'5h ago',  type:'alert',         read:true  },
  ];
  const tCol = { finance:'#10b981', student:'#1E45FC', academic:'#7c3aed', communication:'#0891b2', alert:'#dc2626' };
  return (
    <div className="animate-fade-in space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-extrabold" style={{ color:'#0B0F2A' }}>Notifications</h2>
          <p className="text-xs text-gray-400 mt-0.5">{notifs.filter(n=>!n.read).length} unread</p>
        </div>
        {can(roleId,'notifs.send') && <button className="btn-brand-primary text-sm py-2 px-4">Send Notification</button>}
      </div>
      <div className="flex flex-col gap-3">
        {notifs.map((n,i) => (
          <div key={i} className={`flex items-start gap-4 p-4 rounded-2xl border transition-all ${n.read?'bg-white opacity-70':'bg-white shadow-sm'}`}
            style={{ borderColor: n.read?'#eef0f6':tCol[n.type]+'30' }}>
            <div className="w-10 h-10 rounded-xl flex items-center justify-center text-xl flex-shrink-0" style={{ background:tCol[n.type]+'15' }}>{n.icon}</div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-0.5">
                <span className="font-bold text-sm" style={{ color:'#0B0F2A' }}>{n.title}</span>
                {!n.read && <span className="w-2 h-2 rounded-full" style={{ background:tCol[n.type] }}/>}
              </div>
              <p className="text-xs text-gray-500 leading-relaxed">{n.body}</p>
            </div>
            <span className="text-xs text-gray-400 flex-shrink-0">{n.time}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════
   SETTINGS
═══════════════════════════════════════════════════ */
function SettingsPage({ schoolId, tenant }) {
  return (
    <div className="animate-fade-in space-y-4">
      <div>
        <h2 className="text-lg font-extrabold" style={{ color:'#0B0F2A' }}>School Settings</h2>
        <p className="text-xs text-gray-400 mt-0.5">Configuration for your tenant</p>
      </div>
      <Card className="divide-y max-w-2xl" style={{ borderColor:'#eef0f6' }}>
        {[
          ['Tenant ID (school_id)', schoolId ?? '—', '🔑', true],
          ['School Name',          tenant?.name ?? '—',       '🏫', false],
          ['District',             tenant?.district ?? '—',   '📍', false],
          ['Plan',                 tenant?.plan ?? '—',       '📋', false],
          ['Status',               tenant?.status ?? '—',     '🟢', false],
          ['Admin Email',          tenant?.admin_email ?? '—','📧', false],
          ['Created',              tenant?.created_at ?? '—', '📅', false],
        ].map(([label, value, icon, locked]) => (
          <div key={label} className="flex items-center gap-4 px-5 py-4">
            <span className="text-xl flex-shrink-0">{icon}</span>
            <div className="flex-1 min-w-0">
              <div className="text-xs text-gray-400">{label}</div>
              <div className="text-sm font-semibold truncate" style={{ color:'#0B0F2A', fontFamily: locked ? 'monospace' : undefined }}>{value}</div>
            </div>
            {!locked && <button className="text-xs font-semibold hover:underline flex-shrink-0" style={{ color:'#1E45FC' }}>Edit</button>}
            {locked && <span className="text-xs text-gray-300 flex-shrink-0">Auto-generated</span>}
          </div>
        ))}
      </Card>
    </div>
  );
}

/* ══════════════════════════════════════════════════
   SAAS ADMIN — OVERVIEW
═══════════════════════════════════════════════════ */
function SaasOverviewPage() {
  const tenants = queryAllTenants();
  const totalStudents = tenants.reduce((a,t)=>a+t.student_count,0);
  const totalMRR      = tenants.reduce((a,t)=>a+calcBilling(t.school_id),0);
  const active        = tenants.filter(t=>t.status==='active').length;
  const bars  = [62,75,58,88,70,95,82];
  const days  = ['M','T','W','T','F','S','S'];

  return (
    <div className="animate-fade-in space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-extrabold" style={{ color:'#0B0F2A' }}>Platform Overview</h2>
          <p className="text-sm text-gray-400 mt-0.5">Global · All tenants · May 2026</p>
        </div>
        <span className="text-xs font-bold px-3 py-1.5 rounded-full" style={{ background:'#f5f3ff', color:'#7c3aed' }}>SaaS Admin</span>
      </div>

      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
        {[
          { label:'Active Schools',  value:active, delta:'total tenants', icon:'🏫', iconBg:'#e8ecff', iconColor:'#1E45FC' },
          { label:'Total Students',  value:totalStudents.toLocaleString(), delta:'Across all schools', icon:'👥', iconBg:'#d1fae5', iconColor:'#059669' },
          { label:'Platform MRR',    value:`UGX ${(totalMRR/1000000).toFixed(1)}M`, delta:'+12% MoM', icon:'💰', iconBg:'#fef3c7', iconColor:'#d97706' },
          { label:'Billing Rate',    value:`UGX ${BILLING_RATE.toLocaleString()}`, delta:'Per student / term', icon:'💳', iconBg:'#f5f3ff', iconColor:'#7c3aed' },
        ].map((s,i) => (
          <StatCard key={i} {...s} />
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card className="overflow-hidden">
          <div className="flex items-center justify-between px-5 py-3.5 border-b" style={{ borderColor:'#eef0f6' }}>
            <h3 className="font-bold text-sm" style={{ color:'#0B0F2A' }}>Top Tenants by Students</h3>
          </div>
          {[...tenants].sort((a,b)=>b.student_count-a.student_count).slice(0,4).map((t,i) => (
            <div key={i} className="flex items-center gap-4 px-5 py-3 border-b last:border-0 hover:bg-gray-50/50" style={{ borderColor:'#f5f7fb' }}>
              <div className="w-8 h-8 rounded-lg flex items-center justify-center font-bold text-xs text-white flex-shrink-0" style={{ background:'#1E45FC' }}>{t.logo_initials}</div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-semibold truncate" style={{ color:'#0B0F2A' }}>{t.name}</div>
                <div className="text-xs text-gray-400 font-mono">{t.school_id}</div>
              </div>
              <div className="text-right flex-shrink-0">
                <div className="text-sm font-bold" style={{ color:'#0B0F2A' }}>{t.student_count.toLocaleString()}</div>
                <div className="text-xs text-gray-400">students</div>
              </div>
              <div className="text-right flex-shrink-0 hidden md:block">
                <div className="text-sm font-bold text-green-700">UGX {(calcBilling(t.school_id)/1000000).toFixed(1)}M</div>
                <div className="text-xs text-gray-400">term billing</div>
              </div>
            </div>
          ))}
        </Card>

        <Card className="p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-bold text-sm" style={{ color:'#0B0F2A' }}>New School Signups</h3>
            <span className="text-xs font-bold text-green-700 bg-green-50 px-2.5 py-1 rounded-lg">↑ 8 this week</span>
          </div>
          <div className="flex items-end gap-1.5 h-28">
            {bars.map((h,i) => (
              <div key={i} className="flex-1 flex flex-col items-center gap-1">
                <div className="w-full rounded-t-lg" style={{ height:`${h}%`, background: i===5?'#A3CF2E':'#e8ecff', minHeight: 6 }}/>
                <span className="text-[10px] text-gray-400">{days[i]}</span>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════
   SAAS — ALL SCHOOLS
═══════════════════════════════════════════════════ */
function SaasSchoolsPage() {
  const tenants = queryAllTenants();
  const planCol = { Starter:'#1E45FC', Growth:'#059669', Enterprise:'#7c3aed' };
  const planBg  = { Starter:'#e8ecff', Growth:'#d1fae5', Enterprise:'#f5f3ff' };
  return (
    <div className="animate-fade-in space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-extrabold" style={{ color:'#0B0F2A' }}>All Schools (Tenants)</h2>
          <p className="text-xs text-gray-400 mt-0.5">{tenants.length} registered · tenant isolation enforced</p>
        </div>
        <button className="btn-brand-primary text-sm py-2 px-4">+ Onboard School</button>
      </div>
      <Card className="overflow-hidden">
        <table className="w-full">
          <thead>
            <tr style={{ background:'#f8faff', borderBottom:'1px solid #eef0f6' }}>
              {['School / Tenant ID','District','Students','Plan','Status','Monthly Billing','Actions'].map(h => (
                <th key={h} className="text-left px-4 py-3 text-xs font-bold text-gray-400 uppercase tracking-wider">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y" style={{ borderColor:'#f5f7fb' }}>
            {tenants.map((t,i) => (
              <tr key={i} className="hover:bg-gray-50/50">
                <td className="px-4 py-3">
                  <div className="font-bold text-sm" style={{ color:'#0B0F2A' }}>{t.name}</div>
                  <div className="text-xs font-mono text-gray-400">{t.school_id}</div>
                </td>
                <td className="px-4 py-3 text-sm text-gray-500">{t.district}</td>
                <td className="px-4 py-3 text-sm font-bold" style={{ color:'#0B0F2A' }}>{t.student_count.toLocaleString()}</td>
                <td className="px-4 py-3">
                  <span className="text-xs font-bold px-2 py-1 rounded-full" style={{ background:planBg[t.plan]??'#e8ecff', color:planCol[t.plan]??'#1E45FC' }}>{t.plan}</span>
                </td>
                <td className="px-4 py-3">
                  <span className={`text-xs font-bold px-2 py-1 rounded-full ${t.status==='active'?'bg-green-50 text-green-700':'bg-yellow-50 text-yellow-700'}`}>{t.status}</span>
                </td>
                <td className="px-4 py-3 text-sm font-bold text-green-700">UGX {calcBilling(t.school_id).toLocaleString()}</td>
                <td className="px-4 py-3">
                  <div className="flex gap-2">
                    <button className="text-xs font-bold hover:underline" style={{ color:'#1E45FC' }}>Manage →</button>
                    <button className="text-xs text-gray-400 hover:text-gray-600">Suspend</button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );
}

/* ══════════════════════════════════════════════════
   SAAS — BILLING
═══════════════════════════════════════════════════ */
function SaasBillingPage() {
  const tenants = queryAllTenants();
  const totalMRR = tenants.reduce((a,t)=>a+calcBilling(t.school_id),0);
  return (
    <div className="animate-fade-in space-y-4">
      <div>
        <h2 className="text-lg font-extrabold" style={{ color:'#0B0F2A' }}>Billing</h2>
        <p className="text-xs text-gray-400 mt-0.5">UGX {BILLING_RATE.toLocaleString()} × students per term</p>
      </div>
      <div className="grid grid-cols-3 gap-4">
        {[
          { label:'Platform MRR',   value:`UGX ${(totalMRR/1000000).toFixed(2)}M`, delta:'+12% MoM',      color:'#1E45FC', bg:'#e8ecff' },
          { label:'Active Schools', value:tenants.filter(t=>t.status==='active').length, delta:'paying tenants', color:'#059669', bg:'#d1fae5' },
          { label:'Total Students', value:tenants.reduce((a,t)=>a+t.student_count,0).toLocaleString(), delta:'billed this term', color:'#7c3aed', bg:'#f5f3ff' },
        ].map((s,i) => (
          <Card key={i} className="p-5">
            <div className="text-xs text-gray-400 mb-1">{s.label}</div>
            <div className="text-2xl font-extrabold mb-0.5" style={{ color:'#0B0F2A' }}>{s.value}</div>
            <div className="text-xs font-bold" style={{ color:s.color }}>{s.delta}</div>
          </Card>
        ))}
      </div>
      <Card className="overflow-hidden">
        <div className="px-5 py-3.5 border-b flex items-center justify-between" style={{ borderColor:'#eef0f6' }}>
          <h3 className="font-bold text-sm" style={{ color:'#0B0F2A' }}>Per-Tenant Billing</h3>
          <button className="text-xs font-semibold" style={{ color:'#1E45FC' }}>Export Invoices →</button>
        </div>
        <table className="w-full">
          <thead>
            <tr style={{ background:'#f8faff', borderBottom:'1px solid #eef0f6' }}>
              {['School','Tenant ID','Plan','Students','Rate','Term Billing'].map(h => (
                <th key={h} className="text-left px-4 py-3 text-xs font-bold text-gray-400 uppercase tracking-wider">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y" style={{ borderColor:'#f5f7fb' }}>
            {tenants.map((t,i) => (
              <tr key={i} className="hover:bg-gray-50/50">
                <td className="px-4 py-3 text-sm font-bold" style={{ color:'#0B0F2A' }}>{t.name}</td>
                <td className="px-4 py-3 text-xs font-mono text-gray-400">{t.school_id}</td>
                <td className="px-4 py-3 text-sm text-gray-500">{t.plan}</td>
                <td className="px-4 py-3 text-sm font-bold" style={{ color:'#0B0F2A' }}>{t.student_count.toLocaleString()}</td>
                <td className="px-4 py-3 text-sm text-gray-400">UGX {BILLING_RATE.toLocaleString()}</td>
                <td className="px-4 py-3 text-sm font-bold text-green-700">UGX {calcBilling(t.school_id).toLocaleString()}</td>
              </tr>
            ))}
            <tr style={{ background:'#f8faff', borderTop:'2px solid #eef0f6' }}>
              <td colSpan={5} className="px-4 py-3 text-sm font-bold text-right" style={{ color:'#0B0F2A' }}>Total MRR</td>
              <td className="px-4 py-3 text-sm font-bold text-green-700">UGX {totalMRR.toLocaleString()}</td>
            </tr>
          </tbody>
        </table>
      </Card>
    </div>
  );
}

/* ══════════════════════════════════════════════════
   SAAS — ONBOARDING
═══════════════════════════════════════════════════ */
function SaasOnboardingPage() {
  const recent = queryAllTenants().slice(-3).reverse();
  return (
    <div className="animate-fade-in space-y-4">
      <div>
        <h2 className="text-lg font-extrabold" style={{ color:'#0B0F2A' }}>Onboarding</h2>
        <p className="text-xs text-gray-400 mt-0.5">Manage new school provisioning</p>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {[
          { icon:'🚀', label:'Schools This Month', value:'3', color:'#1E45FC' },
          { icon:'⏳', label:'Pending Setup',       value:'1', color:'#d97706' },
          { icon:'✅', label:'Fully Onboarded',     value:'4', color:'#059669' },
        ].map((s,i) => (
          <Card key={i} className="p-5 flex items-center gap-4">
            <div className="text-3xl">{s.icon}</div>
            <div>
              <div className="text-2xl font-extrabold" style={{ color:'#0B0F2A' }}>{s.value}</div>
              <div className="text-xs text-gray-400">{s.label}</div>
            </div>
          </Card>
        ))}
      </div>
      <h3 className="font-bold text-sm" style={{ color:'#0B0F2A' }}>Recently Provisioned</h3>
      <div className="flex flex-col gap-3">
        {recent.map((t,i) => (
          <Card key={i} className="p-4 flex items-center gap-4">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center font-bold text-sm text-white flex-shrink-0" style={{ background:'#1E45FC' }}>{t.logo_initials}</div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-bold" style={{ color:'#0B0F2A' }}>{t.name}</div>
              <div className="flex items-center gap-3 mt-0.5">
                <span className="text-xs font-mono text-gray-400">{t.school_id}</span>
                <span className="text-xs text-gray-400">·</span>
                <span className="text-xs text-gray-400">{t.created_at}</span>
              </div>
            </div>
            <span className={`text-xs font-bold px-2 py-1 rounded-full ${t.status==='active'?'bg-green-50 text-green-700':'bg-yellow-50 text-yellow-700'}`}>{t.status}</span>
            <button className="text-xs font-bold hover:underline flex-shrink-0" style={{ color:'#1E45FC' }}>Configure →</button>
          </Card>
        ))}
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════
   SAAS — FEATURE REQUESTS
═══════════════════════════════════════════════════ */
function SaasFeaturesPage() {
  const features = [
    { title:'Bulk SMS to parents',      votes:24, status:'In Progress', school:"St. Mary's College" },
    { title:'Parent mobile app',        votes:19, status:'Planned',     school:'Kampala High School' },
    { title:'Online exam portal',       votes:15, status:'Reviewing',   school:'Arua Public School' },
    { title:'Payroll auto-calculation', votes:12, status:'Planned',     school:'Makerere Hill School' },
    { title:'Library management',       votes:8,  status:'Backlog',     school:'Gulu Academy' },
  ];
  const sc = { 'In Progress':'#059669', Planned:'#1E45FC', Reviewing:'#d97706', Backlog:'#94a3b8' };
  const sb = { 'In Progress':'#d1fae5', Planned:'#e8ecff', Reviewing:'#fef3c7', Backlog:'#f1f5f9' };
  return (
    <div className="animate-fade-in space-y-4">
      <div>
        <h2 className="text-lg font-extrabold" style={{ color:'#0B0F2A' }}>Feature Requests</h2>
        <p className="text-xs text-gray-400 mt-0.5">Aggregated from all tenants</p>
      </div>
      <div className="flex flex-col gap-3">
        {features.map((f,i) => (
          <Card key={i} className="p-4 flex items-center gap-4 hover:shadow-sm transition-all">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center text-sm font-bold flex-shrink-0" style={{ background:'#f8faff', color:'#1E45FC' }}>{f.votes}</div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-bold" style={{ color:'#0B0F2A' }}>{f.title}</div>
              <div className="text-xs text-gray-400">{f.school}</div>
            </div>
            <span className="text-xs font-bold px-2 py-1 rounded-full flex-shrink-0" style={{ background:sb[f.status], color:sc[f.status] }}>{f.status}</span>
            <button className="text-xs font-bold hover:underline flex-shrink-0" style={{ color:'#1E45FC' }}>Update</button>
          </Card>
        ))}
      </div>
    </div>
  );
}

/* ─── Fallback ─────────────────────────────────── */
function ComingSoon({ label }) {
  return (
    <div className="flex flex-col items-center justify-center h-64 gap-3 text-center">
      <div className="text-4xl">🚧</div>
      <p className="text-base font-semibold text-gray-700 capitalize">{label} module</p>
      <p className="text-sm text-gray-400">Under construction.</p>
    </div>
  );
}
