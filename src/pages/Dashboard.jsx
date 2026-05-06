import { useState } from 'react';
import { LogoIcon } from './Login';
import LMSPage from './LMS';
import { TenantContext } from '../lib/TenantContext';
import { can, navAllowed, ROLE_META } from '../lib/permissions';
import {
  queryStudents, queryTeachers, queryPayments,
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
  lms:        'M12 14l9-5-9-5-9 5 9 5zM12 14l6.16-3.422a12.083 12.083 0 01.665 6.479A11.952 11.952 0 0012 20.055a11.952 11.952 0 00-6.824-2.998 12.078 12.078 0 01.665-6.479L12 14z',
  idcards:    'M2 7a2 2 0 012-2h16a2 2 0 012 2v10a2 2 0 01-2 2H4a2 2 0 01-2-2V7zM16 11h2M16 15h2M8 11a2 2 0 100 4 2 2 0 000-4z',
  notifs:     'M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9M13.73 21a2 2 0 01-3.46 0',
  settings:   'M12 15a3 3 0 100-6 3 3 0 000 6zM19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z',
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
    { id: 'attendance', label: 'Attendance',    section: 'main' },
    { id: 'timetable',  label: 'Timetables',    section: 'academic' },
    { id: 'results',    label: 'Results',       section: 'academic' },
    { id: 'reports',    label: 'Report Cards',  section: 'academic' },
    { id: 'lms',        label: 'A-Level LMS',   section: 'academic' },
    { id: 'finance',    label: 'Finance',       section: 'admin' },
    { id: 'idcards',    label: 'ID Cards',      section: 'admin' },
    { id: 'notifs',     label: 'Notifications', section: 'other' },
    { id: 'settings',   label: 'Settings',      section: 'other' },
  ],
  head_teacher: [
    { id: 'overview',   label: 'Dashboard',     section: 'main' },
    { id: 'students',   label: 'Students',      section: 'main' },
    { id: 'teachers',   label: 'Teachers',      section: 'main' },
    { id: 'attendance', label: 'Attendance',    section: 'main' },
    { id: 'timetable',  label: 'Timetables',    section: 'academic' },
    { id: 'results',    label: 'Results',       section: 'academic' },
    { id: 'reports',    label: 'Report Cards',  section: 'academic' },
    { id: 'lms',        label: 'A-Level LMS',   section: 'academic' },
    { id: 'finance',    label: 'Finance',       section: 'admin' },
    { id: 'notifs',     label: 'Notifications', section: 'other' },
  ],
  teacher: [
    { id: 'overview',   label: 'My Classes',    section: 'main' },
    { id: 'attendance', label: 'Attendance',    section: 'main' },
    { id: 'timetable',  label: 'My Timetable',  section: 'main' },
    { id: 'results',    label: 'Enter Marks',   section: 'main' },
    { id: 'students',   label: 'Students',      section: 'main' },
    { id: 'lms',        label: 'A-Level LMS',   section: 'main' },
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
          className={`flex-shrink-0 flex flex-col transition-all duration-300 ${collapsed ? 'w-[70px]' : 'w-[230px]'}`}
          style={{ background: '#fff', borderRight: '1px solid #eef0f6', marginTop: '32px', boxShadow: '2px 0 12px rgba(30,69,252,0.04)' }}
        >
          {/* Logo */}
          <div className={`flex items-center gap-3 px-4 py-4 border-b ${collapsed ? 'justify-center' : ''}`}
            style={{ borderColor: '#eef0f6' }}>
            {!collapsed && (
              <div className="flex items-center gap-2 flex-1 min-w-0">
                <img src="/skoulhub-logo.png" alt="SkoulHub" style={{ width: 30, height: 30, objectFit: 'contain' }} />
                <span className="font-extrabold text-base tracking-tight leading-none">
                  <span style={{ color: '#1E45FC' }}>Skoul</span><span style={{ color: '#A3CF2E' }}>Hub</span>
                </span>
              </div>
            )}
            {collapsed && (
              <img src="/skoulhub-logo.png" alt="SkoulHub" style={{ width: 28, height: 28, objectFit: 'contain' }} />
            )}
            <button
              onClick={() => setCollapsed(!collapsed)}
              className="p-1 rounded-lg transition-colors flex-shrink-0"
              style={{ color: '#94a3b8' }}
              onMouseEnter={e => e.currentTarget.style.background = '#f1f5f9'}
              onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
            >
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
                {collapsed
                  ? <><path d="M5 3L10 8L5 13"/></>
                  : <><path d="M11 3L6 8L11 13"/></>
                }
              </svg>
            </button>
          </div>

          {/* School badge */}
          {!collapsed && (
            <div className="px-3 py-3 border-b" style={{ borderColor: '#eef0f6' }}>
              <div className="flex items-center gap-2.5 px-2.5 py-2 rounded-xl" style={{ background: '#f5f7ff' }}>
                <div className="w-8 h-8 rounded-lg flex items-center justify-center text-white font-bold text-xs flex-shrink-0"
                  style={{ background: '#1E45FC' }}>
                  {tenant ? tenant.logo_initials : 'SH'}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-xs font-bold truncate" style={{ color: '#0B0F2A' }}>{tenant?.name ?? 'SkoulHub Admin'}</div>
                  <div className="text-xs truncate" style={{ color: '#A3CF2E', fontWeight: 600 }}>
                    {tenant ? tenant.school_id : 'Global · All Tenants'}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Nav */}
          <nav className="flex-1 overflow-y-auto py-3" style={{ scrollbarWidth: 'none' }}>
            {sectionGroups.map((group, gi) => (
              <div key={gi} className="mb-1">
                {!collapsed && group.label && (
                  <div className="px-4 pb-1 pt-2 text-[10px] font-bold tracking-widest uppercase" style={{ color: '#b0b8cc' }}>
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
                      className={`w-full flex items-center gap-3 mx-2 mb-0.5 rounded-xl transition-all text-sm font-medium ${collapsed ? 'justify-center px-2 py-2.5 w-auto' : 'px-3 py-2.5'}`}
                      style={active
                        ? { background: '#1E45FC', color: '#fff', width: collapsed ? 46 : 'calc(100% - 16px)' }
                        : { color: '#64748b', width: collapsed ? 46 : 'calc(100% - 16px)', background: 'transparent' }
                      }
                      onMouseEnter={e => { if (!active) { e.currentTarget.style.background = '#f1f5f9'; e.currentTarget.style.color = '#0B0F2A'; } }}
                      onMouseLeave={e => { if (!active) { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = '#64748b'; } }}
                    >
                      <span className="flex-shrink-0" style={{ opacity: active ? 1 : 0.7 }}>
                        <Icon d={NAV_ICONS[item.id] || NAV_ICONS.overview} size={17} strokeWidth={active ? 2.2 : 1.8} />
                      </span>
                      {!collapsed && <span className="truncate">{item.label}</span>}
                    </button>
                  );
                })}
              </div>
            ))}
          </nav>

          {/* Bottom: user + logout */}
          <div className="p-3 border-t" style={{ borderColor: '#eef0f6' }}>
            {!collapsed && (
              <div className="flex items-center gap-2.5 px-2 py-2 rounded-xl mb-2" style={{ background: '#f8faff' }}>
                <div className="w-7 h-7 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0"
                  style={{ background: rl.color }}>
                  {currentUser.name?.split(' ').map(w => w[0]).join('').slice(0, 2) ?? 'U'}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-semibold truncate" style={{ color: '#0B0F2A' }}>{currentUser.name}</div>
                  <div className="text-[10px] font-semibold" style={{ color: rl.color }}>{rl.label}</div>
                </div>
              </div>
            )}
            <button
              onClick={onLogout}
              className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs transition-all ${collapsed ? 'justify-center' : ''}`}
              style={{ color: '#94a3b8' }}
              onMouseEnter={e => { e.currentTarget.style.background = '#fee2e2'; e.currentTarget.style.color = '#dc2626'; }}
              onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = '#94a3b8'; }}
            >
              <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="flex-shrink-0">
                <path d="M6 14H3a1 1 0 01-1-1V3a1 1 0 011-1h3M11 11l3-3-3-3M14 8H6"/>
              </svg>
              {!collapsed && <span className="font-semibold">Sign Out</span>}
            </button>

            {!collapsed && (
              <div className="mt-3 px-2 py-2.5 rounded-xl text-center" style={{ background: 'linear-gradient(135deg, #1E45FC 0%, #0B0F2A 100%)' }}>
                <div className="flex items-center justify-center gap-1.5 mb-1">
                  <img src="/skoulhub-logo.png" alt="" style={{ width: 14, height: 14, objectFit: 'contain', filter: 'brightness(0) invert(1)' }} />
                  <span className="text-[10px] font-bold text-white/80">SkoulHub</span>
                </div>
                <p className="text-[9px] text-white/50 leading-relaxed">Smart School. Better Future.</p>
              </div>
            )}
          </div>
        </aside>

        {/* ── Main ────────────────────────────────── */}
        <div className="flex-1 flex flex-col min-w-0 overflow-hidden" style={{ marginTop: '32px' }}>
          {/* Topbar */}
          <header className="flex-shrink-0 h-[60px] flex items-center gap-4 px-6 bg-white border-b"
            style={{ borderColor: '#eef0f6', boxShadow: '0 1px 0 #eef0f6' }}>

            {/* Welcome */}
            <div className="flex-1 min-w-0">
              <div className="text-sm font-bold truncate" style={{ color: '#0B0F2A' }}>
                Welcome back, <span style={{ color: '#1E45FC' }}>{currentUser.name?.split(' ')[0]}</span> 👋
              </div>
              <div className="text-[11px] text-gray-400 truncate">
                Here's what's happening at {tenant?.name ?? 'SkoulHub'}
              </div>
            </div>

            {/* Search */}
            <div className="hidden md:flex items-center gap-2 px-3.5 py-2 rounded-xl border text-sm w-56"
              style={{ borderColor: '#e2e8f0', background: '#f8faff' }}>
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="#94a3b8" strokeWidth="1.6">
                <circle cx="6" cy="6" r="4.5"/><path d="M10 10L13 13"/>
              </svg>
              <span className="text-xs text-gray-400">Search anything…</span>
              <span className="ml-auto text-[10px] px-1.5 py-0.5 rounded border text-gray-300" style={{ borderColor: '#e2e8f0' }}>⌘K</span>
            </div>

            {/* Notif */}
            <div className="relative">
              <button
                onClick={() => setNotifOpen(!notifOpen)}
                className="relative w-9 h-9 rounded-xl border flex items-center justify-center transition-colors"
                style={{ borderColor: '#e2e8f0', background: '#f8faff' }}
                onMouseEnter={e => e.currentTarget.style.background = '#f1f5f9'}
                onMouseLeave={e => e.currentTarget.style.background = '#f8faff'}
              >
                <Icon d={NAV_ICONS.notifs} size={16} />
                <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-red-500 border-2 border-white" />
              </button>
              {notifOpen && <NotifDropdown onClose={() => setNotifOpen(false)} />}
            </div>

            {/* Quick action */}
            {can(roleId, 'students.create') && (
              <button
                className="hidden md:flex items-center gap-2 text-xs font-bold px-4 py-2 rounded-xl text-white transition-all"
                style={{ background: '#1E45FC' }}
                onMouseEnter={e => e.currentTarget.style.background = '#1535d4'}
                onMouseLeave={e => e.currentTarget.style.background = '#1E45FC'}
              >
                <svg width="13" height="13" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
                  <path d="M7 2v10M2 7h10"/>
                </svg>
                Quick Action
              </button>
            )}

            {/* Avatar */}
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold"
                style={{ background: rl.color }}>
                {currentUser.name?.split(' ').map(w => w[0]).join('').slice(0, 2) ?? 'U'}
              </div>
              <div className="hidden md:block">
                <div className="text-xs font-bold leading-tight" style={{ color: '#0B0F2A' }}>{currentUser.name}</div>
                <div className="text-[10px] font-semibold" style={{ color: rl.color }}>{rl.label}</div>
              </div>
            </div>
          </header>

          {/* Page content */}
          <main className="flex-1 overflow-y-auto" style={{ background: '#f5f7fb', padding: '20px 24px' }}>
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
    case 'lms':        return <LMSPage currentUser={currentUser} />;
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
function StatCard({ label, value, delta, deltaPositive = true, icon, iconBg, iconColor }) {
  return (
    <Card className="p-5">
      <div className="flex items-start justify-between mb-3">
        <div className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0"
          style={{ background: iconBg }}>
          <span style={{ color: iconColor, fontSize: 20 }}>{icon}</span>
        </div>
        <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${deltaPositive ? 'text-green-700 bg-green-50' : 'text-red-600 bg-red-50'}`}>
          {deltaPositive ? '↑' : '↓'} {delta}
        </span>
      </div>
      <div className="text-2xl font-extrabold mb-0.5" style={{ color: '#0B0F2A' }}>{value}</div>
      <div className="text-xs font-medium text-gray-400">{label}</div>
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

  return (
    <div className="animate-fade-in space-y-5">
      {/* Stats row */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
        <StatCard label="Total Students"   value={students.length}  delta="12 this week"       icon="👥" iconBg="#e8ecff" iconColor="#1E45FC" />
        <StatCard label="Total Teachers"   value={teachers.length}  delta="8% last term"        icon="🎓" iconBg="#d1fae5" iconColor="#059669" />
        <StatCard label="Attendance Rate"  value="92%"              delta="4% from last term"   icon="📋" iconBg="#e0f2fe" iconColor="#0891b2" />
        <StatCard label="Fees Collected"   value={`UGX ${(feeCollected/1000000).toFixed(1)}M`} delta="12% from last term" icon="💰" iconBg="#fef3c7" iconColor="#d97706" />
      </div>

      {/* Charts + Recent Activities */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Attendance bar chart */}
        <Card className="p-5 col-span-1">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="font-bold text-sm" style={{ color: '#0B0F2A' }}>Attendance Overview</h3>
              <p className="text-xs text-gray-400 mt-0.5">This Week</p>
            </div>
            <span className="text-xs font-bold text-green-700 bg-green-50 px-2.5 py-1 rounded-lg">↑ 3.2%</span>
          </div>
          <div className="flex items-end gap-1.5 h-32">
            {bars.map((h, i) => (
              <div key={i} className="flex-1 flex flex-col items-center gap-1">
                <div className="w-full rounded-t-lg transition-all"
                  style={{ height: `${h}%`, background: i === 5 ? '#1E45FC' : i === 4 ? '#A3CF2E' : '#e8ecff', minHeight: 8 }} />
                <span className="text-[10px] text-gray-400">{days[i]}</span>
              </div>
            ))}
          </div>
        </Card>

        {/* Fee collection donut */}
        <Card className="p-5 col-span-1">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="font-bold text-sm" style={{ color: '#0B0F2A' }}>Fee Collection Overview</h3>
              <p className="text-xs text-gray-400 mt-0.5">This Term</p>
            </div>
          </div>
          <div className="flex items-center justify-center">
            <div className="relative" style={{ width: 140, height: 140 }}>
              <svg width="140" height="140" viewBox="0 0 140 140">
                <circle cx="70" cy="70" r={radius} fill="none" stroke="#eef0f6" strokeWidth="14"/>
                <circle cx="70" cy="70" r={radius} fill="none" stroke="#1E45FC" strokeWidth="14"
                  strokeDasharray={circumference} strokeDashoffset={offset}
                  strokeLinecap="round" transform="rotate(-90 70 70)"/>
                <circle cx="70" cy="70" r={radius - 14} fill="none" stroke="#A3CF2E33" strokeWidth="6"/>
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-2xl font-extrabold" style={{ color: '#0B0F2A' }}>UGX</span>
                <span className="text-base font-bold" style={{ color: '#1E45FC' }}>{(feeCollected/1000000).toFixed(1)}M</span>
                <span className="text-[10px] text-gray-400">{feePct}% collected</span>
              </div>
            </div>
          </div>
          <div className="flex justify-center gap-4 mt-2">
            <div className="flex items-center gap-1.5">
              <div className="w-2.5 h-2.5 rounded-full" style={{ background: '#1E45FC' }} />
              <span className="text-xs text-gray-500">Paid</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-2.5 h-2.5 rounded-full" style={{ background: '#eef0f6' }} />
              <span className="text-xs text-gray-500">Outstanding</span>
            </div>
          </div>
        </Card>

        {/* Recent Activities */}
        <Card className="col-span-1 flex flex-col">
          <div className="flex items-center justify-between px-5 py-4 border-b" style={{ borderColor: '#eef0f6' }}>
            <h3 className="font-bold text-sm" style={{ color: '#0B0F2A' }}>Recent Activities</h3>
            <button className="text-xs font-semibold" style={{ color: '#1E45FC' }}>View all →</button>
          </div>
          <div className="flex-1 divide-y overflow-y-auto" style={{ borderColor: '#f8faff' }}>
            {activity.map((a, i) => (
              <div key={i} className="flex items-start gap-3 px-4 py-3 hover:bg-gray-50/60 transition-colors">
                <div className="w-8 h-8 rounded-lg flex items-center justify-center text-sm flex-shrink-0 mt-0.5"
                  style={{ background: a.dot + '15' }}>{a.icon}</div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-gray-600 leading-relaxed line-clamp-2">{a.text}</p>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded" style={{ background: a.dot + '18', color: a.dot }}>{a.category}</span>
                    <span className="text-[10px] text-gray-400">{a.time}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>

      {/* Bottom row */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
        {/* Students by Class */}
        <Card className="col-span-1 p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-bold text-sm" style={{ color: '#0B0F2A' }}>Students by Class</h3>
            <button className="text-xs font-semibold" style={{ color: '#1E45FC' }}>View All</button>
          </div>
          <div className="space-y-3">
            {classData.map((c, i) => (
              <div key={i} className="flex items-center gap-2.5">
                <div className="text-xs font-semibold w-12 truncate" style={{ color: '#0B0F2A' }}>{c.cls}</div>
                <div className="flex-1 h-2 rounded-full" style={{ background: '#eef0f6' }}>
                  <div className="h-2 rounded-full transition-all" style={{ width: `${c.pct}%`, background: i % 2 === 0 ? '#1E45FC' : '#A3CF2E' }} />
                </div>
                <div className="text-xs font-bold w-6 text-right" style={{ color: '#0B0F2A' }}>{c.count}</div>
              </div>
            ))}
          </div>
        </Card>

        {/* Top Performing Subjects */}
        <Card className="col-span-1 p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-bold text-sm" style={{ color: '#0B0F2A' }}>Top Performing Subjects</h3>
            <button className="text-xs font-semibold" style={{ color: '#1E45FC' }}>View All</button>
          </div>
          <div className="space-y-3">
            {subjects.map((s, i) => (
              <div key={i} className="flex items-center gap-2.5">
                <div className="text-[10px] font-semibold w-16 truncate text-gray-500">{s.name}</div>
                <div className="flex-1 h-2 rounded-full" style={{ background: '#eef0f6' }}>
                  <div className="h-2 rounded-full" style={{ width: `${s.score}%`, background: s.color }} />
                </div>
                <div className="text-xs font-bold w-8 text-right" style={{ color: s.color }}>{s.score}%</div>
              </div>
            ))}
          </div>
        </Card>

        {/* Upcoming Events */}
        <Card className="col-span-1 p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-bold text-sm" style={{ color: '#0B0F2A' }}>Upcoming Events</h3>
            <button className="text-xs font-semibold" style={{ color: '#1E45FC' }}>View Calendar</button>
          </div>
          <div className="space-y-2.5">
            {events.map((ev, i) => (
              <div key={i} className="flex items-center gap-3 p-2.5 rounded-xl" style={{ background: '#f8faff' }}>
                <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: eventColors[ev.type] }} />
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-semibold truncate" style={{ color: '#0B0F2A' }}>{ev.title}</div>
                  <div className="text-[10px] text-gray-400">{ev.date}</div>
                </div>
                <span className="text-[9px] font-bold px-1.5 py-0.5 rounded" style={{ background: eventBg[ev.type], color: eventColors[ev.type] }}>{ev.type}</span>
              </div>
            ))}
          </div>
        </Card>

        {/* Quick Links */}
        <Card className="col-span-1 p-5">
          <div className="mb-4">
            <h3 className="font-bold text-sm" style={{ color: '#0B0F2A' }}>Quick Links</h3>
          </div>
          <div className="grid grid-cols-2 gap-2">
            {quickLinks.map((ql, i) => (
              <button key={i} className="flex flex-col items-center gap-2 p-3 rounded-xl transition-all text-center"
                style={{ background: ql.bg }}
                onMouseEnter={e => e.currentTarget.style.opacity = '0.8'}
                onMouseLeave={e => e.currentTarget.style.opacity = '1'}
              >
                <span className="text-lg">{ql.icon}</span>
                <span className="text-[10px] font-bold leading-tight" style={{ color: ql.color }}>{ql.label}</span>
              </button>
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
function FinancePage({ roleId, schoolId }) {
  const payments = queryPayments(schoolId);
  const [showModal, setModal] = useState(false);
  const canRecord  = can(roleId, 'finance.record');
  const canApprove = can(roleId, 'finance.approve');
  const confirmed = payments.filter(p=>p.status==='Confirmed');
  const pending   = payments.filter(p=>p.status==='Pending');

  return (
    <div className="animate-fade-in space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-extrabold" style={{ color: '#0B0F2A' }}>Finance</h2>
          <p className="text-xs text-gray-400 mt-0.5">Fee collection · {schoolId}</p>
        </div>
        {canRecord && <button onClick={() => setModal(true)} className="btn-brand-primary text-sm py-2 px-4">+ Record Payment</button>}
      </div>

      <div className="grid grid-cols-3 gap-4">
        {[
          { label:'Confirmed',   value:`${confirmed.length} payments`, sub:`UGX ${(confirmed.length*450000/1000000).toFixed(1)}M`, color:'#059669', bg:'#d1fae5' },
          { label:'Pending',     value:`${pending.length} payments`,   sub:'Awaiting confirmation', color:'#d97706', bg:'#fef3c7' },
          { label:'Rate (term)', value:`UGX ${BILLING_RATE.toLocaleString()}`, sub:'Per student', color:'#1E45FC', bg:'#e8ecff' },
        ].map((s,i) => (
          <Card key={i} className="p-4">
            <div className="text-xs text-gray-400 mb-1">{s.label}</div>
            <div className="text-xl font-extrabold mb-0.5" style={{ color: '#0B0F2A' }}>{s.value}</div>
            <div className="text-xs font-bold" style={{ color: s.color }}>{s.sub}</div>
          </Card>
        ))}
      </div>

      <Card className="overflow-hidden">
        <div className="flex items-center justify-between px-5 py-3.5 border-b" style={{ borderColor: '#eef0f6' }}>
          <h3 className="font-bold text-sm" style={{ color: '#0B0F2A' }}>Payment Records</h3>
          <button className="text-xs font-semibold" style={{ color: '#1E45FC' }}>Export CSV →</button>
        </div>
        <table className="w-full">
          <thead>
            <tr style={{ background: '#f8faff', borderBottom: '1px solid #eef0f6' }}>
              {['Student','Amount','Method','Date','Status', canApprove ? 'Approve' : 'Receipt'].map(h => (
                <th key={h} className="text-left px-4 py-3 text-xs font-bold text-gray-400 uppercase tracking-wider">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y" style={{ borderColor: '#f5f7fb' }}>
            {payments.map((p,i) => (
              <tr key={i} className="hover:bg-gray-50/50">
                <td className="px-4 py-3 text-sm font-semibold" style={{ color: '#0B0F2A' }}>{p.student}</td>
                <td className="px-4 py-3 text-sm font-bold text-green-700">UGX {p.amount}</td>
                <td className="px-4 py-3 text-sm text-gray-500">{p.method}</td>
                <td className="px-4 py-3 text-sm text-gray-400">{p.date}</td>
                <td className="px-4 py-3">
                  <span className={`text-xs font-bold px-2 py-1 rounded-full ${p.status==='Confirmed'?'bg-green-50 text-green-700':'bg-yellow-50 text-yellow-700'}`}>{p.status}</span>
                </td>
                <td className="px-4 py-3">
                  {canApprove && p.status === 'Pending'
                    ? <button className="text-xs font-bold text-green-600 hover:underline">Approve</button>
                    : <button className="text-xs font-bold hover:underline" style={{ color: '#1E45FC' }}>Receipt</button>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(11,15,42,0.55)', backdropFilter: 'blur(4px)' }}>
          <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl animate-slide-up">
            <div className="flex items-center justify-between px-6 py-4 border-b" style={{ borderColor: '#eef0f6' }}>
              <h3 className="font-bold text-base" style={{ color: '#0B0F2A' }}>Record Payment</h3>
              <button onClick={() => setModal(false)} className="w-7 h-7 rounded-lg flex items-center justify-center text-gray-400 hover:bg-gray-100">✕</button>
            </div>
            <div className="p-6 flex flex-col gap-4">
              {[['Student Name','text','Aisha Nakato'],['Amount (UGX)','number','450000'],['Payment Method','text','Mobile Money'],['Transaction ID','text','MTN-123456']].map(([lbl,type,ph]) => (
                <div key={lbl}>
                  <label className="block text-xs font-semibold text-gray-500 mb-1.5">{lbl}</label>
                  <input type={type} placeholder={ph} className="w-full px-3 py-2.5 rounded-xl border text-sm outline-none transition-all" style={{ borderColor: '#e2e8f0' }}/>
                </div>
              ))}
            </div>
            <div className="flex gap-3 px-6 pb-6">
              <button onClick={() => setModal(false)} className="flex-1 py-2.5 rounded-xl border text-sm font-semibold text-gray-600 hover:bg-gray-50" style={{ borderColor: '#e2e8f0' }}>Cancel</button>
              <button onClick={() => setModal(false)} className="flex-1 btn-brand-primary">Save Payment</button>
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
  const students = queryStudents(schoolId).slice(0,4);
  const canGen   = can(roleId, 'reports.generate');
  const canSend  = can(roleId, 'reports.send');
  return (
    <div className="animate-fade-in space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-extrabold" style={{ color: '#0B0F2A' }}>Report Cards</h2>
          <p className="text-xs text-gray-400 mt-0.5">End of term reports · {schoolId}</p>
        </div>
        {canGen && <button className="btn-brand-primary text-sm py-2 px-4">Generate All</button>}
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {students.map((s,i) => (
          <Card key={i} className="p-5">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center font-bold text-sm flex-shrink-0" style={{ background:'#e8ecff', color:'#1E45FC' }}>
                {s.name.split(' ').map(w=>w[0]).join('').slice(0,2)}
              </div>
              <div>
                <div className="font-bold text-sm" style={{ color:'#0B0F2A' }}>{s.name}</div>
                <div className="text-xs text-gray-400">{s.class} · Term 2 2026</div>
              </div>
              <span className="ml-auto text-xs font-bold px-2 py-1 rounded-full bg-green-50 text-green-700">Ready</span>
            </div>
            <div className="grid grid-cols-3 gap-2 text-center mb-4">
              {[['Avg Score','76%'],['Grade','C3'],['Position','4th / 42']].map(([l,v]) => (
                <div key={l} className="rounded-xl p-2" style={{ background:'#f8faff' }}>
                  <div className="text-sm font-extrabold" style={{ color:'#0B0F2A' }}>{v}</div>
                  <div className="text-[10px] text-gray-400">{l}</div>
                </div>
              ))}
            </div>
            {can(roleId, 'reports.comment_teacher') && (
              <textarea placeholder="Teacher's comment…" rows={2} className="w-full px-3 py-2 rounded-xl border text-xs outline-none mb-3 resize-none" style={{ borderColor:'#e2e8f0' }}/>
            )}
            {can(roleId, 'reports.comment_head') && (
              <textarea placeholder="Head teacher's comment…" rows={2} className="w-full px-3 py-2 rounded-xl border text-xs outline-none mb-3 resize-none" style={{ borderColor:'#e2e8f0' }}/>
            )}
            <div className="flex gap-2">
              {canGen && <button className="flex-1 py-2 rounded-xl border text-xs font-semibold text-gray-600 hover:bg-gray-50" style={{ borderColor:'#e2e8f0' }}>📄 Download PDF</button>}
              {canSend && <button className="flex-1 py-2 rounded-xl text-xs font-bold text-white" style={{ background:'#1E45FC' }}>📧 Send to Parent</button>}
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════
   ID CARDS
═══════════════════════════════════════════════════ */
function IDCardsPage({ roleId, schoolId, tenant }) {
  const students = queryStudents(schoolId).slice(0,3);
  return (
    <div className="animate-fade-in space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-extrabold" style={{ color:'#0B0F2A' }}>ID Cards</h2>
          <p className="text-xs text-gray-400 mt-0.5">Student ID cards · {schoolId}</p>
        </div>
        {can(roleId,'idcards.generate') && <button className="btn-brand-primary text-sm py-2 px-4">Generate All</button>}
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
        {students.map((s,i) => (
          <div key={i} className="flex flex-col gap-3">
            <div className="rounded-2xl overflow-hidden shadow-lg" style={{ background:'linear-gradient(135deg, #0B0F2A 0%, #1E45FC 100%)' }}>
              <div className="px-5 py-3 border-b border-white/10 flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <img src="/skoulhub-logo.png" alt="SkoulHub" style={{ width: 20, height: 20, objectFit: 'contain', filter: 'brightness(0) invert(1)' }} />
                  <span className="text-white text-xs font-bold">SkoulHub</span>
                </div>
                <span className="text-xs text-white/50">{tenant?.name ?? 'School'}</span>
              </div>
              <div className="p-4 flex items-center gap-4">
                <div className="w-14 h-14 rounded-xl bg-white/20 flex items-center justify-center text-white font-bold text-lg flex-shrink-0">
                  {s.name.split(' ').map(w=>w[0]).join('').slice(0,2)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-white font-bold text-sm truncate">{s.name}</div>
                  <div className="text-white/60 text-xs">{s.class}</div>
                  <div className="text-white/50 text-xs font-mono">ID: SKH-2026-{1000+i}</div>
                </div>
                <div className="w-12 h-12 bg-white rounded-lg p-1 flex-shrink-0">
                  <svg viewBox="0 0 7 7" xmlns="http://www.w3.org/2000/svg">
                    {[[1,1,1,0,1,1,1],[1,0,1,0,1,0,1],[1,1,1,0,1,1,1],[0,1,0,1,0,1,0],[1,1,1,0,1,1,1],[1,0,1,0,1,0,1],[1,1,1,0,1,1,1]]
                      .map((row,r) => row.map((c,col) => c ? <rect key={`${r}-${col}`} x={col} y={r} width="1" height="1" fill="#0B0F2A"/> : null))}
                  </svg>
                </div>
              </div>
              <div className="px-4 pb-3 flex justify-between text-xs text-white/40">
                <span>Term 2 · 2026</span>
                <span style={{ color:'#A3CF2E' }}>STUDENT</span>
              </div>
            </div>
            <div className="flex gap-2">
              <button className="flex-1 py-2 rounded-xl border text-xs font-semibold text-gray-600 hover:bg-gray-50" style={{ borderColor:'#e2e8f0' }}>Preview</button>
              {can(roleId,'idcards.generate') && <button className="flex-1 py-2 rounded-xl text-xs font-bold text-white" style={{ background:'#1E45FC' }}>Download PDF</button>}
            </div>
          </div>
        ))}
      </div>
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
