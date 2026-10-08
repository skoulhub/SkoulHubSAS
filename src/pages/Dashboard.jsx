import { useState, useCallback, useRef } from 'react';
import ProfilePage from './Profile';
import SubscriptionPage from './Subscription';
import AuditLogPage from './AuditLog';
import { can, navAllowed, ROLE_META } from '../lib/permissions';
import { NAV_BY_ROLE } from '../lib/navigation';
import {
  queryStudents, queryTeachers, queryPayments, queryTenant,
  queryAllTenants, calcBilling, getTeacherAssignment,
  getEnrollmentConfig, getFormSchema, saveFormSchema, DEFAULT_FORM_SCHEMA,
  parentChildren, scopedStudents, scopedParents,
} from '../lib/tenantStore';
import {
  PLANS, BILLING_UNIT, DEFAULT_PLAN_ID, RATE_RANGE, TRIAL_DAYS, GRACE_DAYS, TERM_DAYS,
  getPlan, planLabel, planRate, calcPlanCost, formatUGX, formatCompactUGX, normalisePlanId,
} from '../lib/plans';
import { csvText, parseCsvLine, unguard, CSV_BOM } from '../lib/csv';
import { recordAudit, AUDIT_ACTIONS, AUDIT_SEVERITY } from '../lib/audit';
import {
  SUB_STATUS, PAYMENT_METHODS, evaluateTenant, refreshSubscriptions, billingSummary,
  listInvoices, openInvoice, markInvoicePaid, assignPlan, startTrial, extendTrial,
  suspendTenant, reactivateTenant, statusMeta, statusSentence, dateLabel, daysUntil,
} from '../lib/billing';

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
  enrollment: 'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2M12 12h.01M8 12h.01M16 12h.01M12 16h.01M8 16h.01',
  parents:    'M20 21v-2a4 4 0 00-4-4h-4M14 11a4 4 0 10-8 0 4 4 0 008 0zM1 21v-2a4 4 0 014-4h.5',
  schools:    'M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z',
  billing:    'M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z',
  onboarding: 'M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5',
  features:   'M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3M6.343 6.343l-.707-.707M6.343 17.657l-.707.707M15.657 6.343l.707-.707M15.657 17.657l.707.707M9 12a3 3 0 116 0 3 3 0 01-6 0z',
};

/* ══════════════════════════════════════════════════
   Dashboard Shell
═══════════════════════════════════════════════════ */
export default function Dashboard({ currentUser, tenant, onLogout, theme, onTheme, onUpdateUser, onUpdateTenant }) {
  const [activeNav, setActiveNav] = useState('overview');
  const [collapsed, setCollapsed] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const roleId   = currentUser.role;
  const nav      = NAV_BY_ROLE[roleId];
  const rl       = ROLE_META[roleId];
  const schoolId = currentUser.school_id;

  /* Fail closed: a role with no configuration gets no dashboard at all
     (never inherit the school-admin nav/label by default) */
  if (!nav || !rl) return <UnknownRole roleId={roleId} onLogout={onLogout} />;

  /* Global search: Enter → jump to the Students page with the query applied */
  const handleSearchKey = (e) => {
    if (e.key !== 'Enter') return;
    setActiveNav(can(roleId, 'students.view') ? 'students' : 'overview');
  };

  /* Auto-revocation: a school whose subscription lapsed keeps access only to
     the pages needed to settle the invoice. SaaS admins are never locked out. */
  const billing = tenant ? evaluateTenant(tenant.school_id) : null;
  const LOCKED_NAV = ['subscription', 'profile'];
  const locked = !!billing?.locked && roleId !== 'saas_admin';
  const visibleNav = locked ? nav.filter(i => LOCKED_NAV.includes(i.id)) : nav;

  const allowedNav = visibleNav.filter(item => navAllowed(roleId, item.id));
  // render the paywall instead of an unreachable page
  const effectiveNav = locked && !LOCKED_NAV.includes(activeNav) ? 'subscription' : activeNav;

  const sectionGroups = [
    { label: null,       items: allowedNav.filter(i => i.section === 'main') },
    { label: 'Academic', items: allowedNav.filter(i => i.section === 'academic') },
    { label: 'Admin',    items: allowedNav.filter(i => i.section === 'admin') },
    { label: 'Other',    items: allowedNav.filter(i => i.section === 'other') },
  ].filter(g => g.items.length > 0);

  return (
    <div className="flex h-screen overflow-hidden bg-gray-50" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
        <DemoBanner />

        {/* ── Sidebar ─────────────────────────────── */}
        <aside
          className={`flex-shrink-0 flex flex-col transition-all duration-300 ${collapsed ? 'w-[68px]' : 'w-[220px]'}`}
          style={{ background: 'var(--menu-bg)', borderRight: '1px solid var(--menu-border)', marginTop: '32px' }}
        >
          {/* Logo + collapse toggle */}
          <div className={`flex items-center px-4 py-4 ${collapsed ? 'justify-center gap-2' : 'gap-1.5'}`}>
            {!collapsed && (
              <div className="flex items-center gap-2.5 flex-1 min-w-0">
                <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: '#1E45FC' }}>
                  <img src="/skoulhub-logo.png" alt="SkoulHub" style={{ width: 20, height: 20, objectFit: 'contain', filter: 'brightness(0) invert(1)' }} />
                </div>
                <span className="font-extrabold text-base tracking-tight leading-none"
                  style={{ color: 'var(--menu-text)' }}>
                  Skoul<span style={{ color: 'var(--menu-accent)' }}>Hub</span>
                </span>
              </div>
            )}
            {collapsed && (
              <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: '#1E45FC' }}>
                <img src="/skoulhub-logo.png" alt="SkoulHub" style={{ width: 18, height: 18, objectFit: 'contain', filter: 'brightness(0) invert(1)' }} />
              </div>
            )}
            <button
              onClick={() => setCollapsed(c => !c)}
              title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
              className="flex-shrink-0 w-7 h-7 rounded-lg flex items-center justify-center transition-colors"
              style={{ color: 'var(--menu-text-muted)' }}
              onMouseEnter={e => { e.currentTarget.style.color = 'var(--menu-text)'; e.currentTarget.style.background = 'var(--menu-hover)'; }}
              onMouseLeave={e => { e.currentTarget.style.color = 'var(--menu-text-muted)'; e.currentTarget.style.background = 'transparent'; }}
            >
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                {collapsed
                  ? <path d="M5 3l4 4-4 4"/>
                  : <path d="M9 3L5 7l4 4"/>}
              </svg>
            </button>
          </div>

          {/* Nav */}
          <nav className="flex-1 overflow-y-auto px-3 pb-3" style={{ scrollbarWidth: 'none' }}>
            {sectionGroups.map((group, gi) => (
              <div key={gi} className="mb-1">
                {!collapsed && group.label && (
                  <div className="px-3 pb-1 pt-3 text-[10px] font-bold tracking-widest uppercase" style={{ color: 'var(--menu-section)' }}>
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
                        : { color: 'var(--menu-text)', background: 'transparent' }
                      }
                      onMouseEnter={e => { if (!active) { e.currentTarget.style.background = 'var(--menu-hover)'; e.currentTarget.style.color = 'var(--menu-text)'; } }}
                      onMouseLeave={e => { if (!active) { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--menu-text)'; } }}
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
          <div className="px-3 pb-4 pt-2" style={{ borderTop: '1px solid var(--menu-border)' }}>
            <div className={`flex items-center gap-2.5 px-2 py-2.5 rounded-xl mb-1 ${collapsed ? 'justify-center' : ''}`}>
              <button onClick={() => setActiveNav('profile')} title="My profile"
                className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0 cursor-pointer transition-transform hover:scale-105"
                style={{ background: rl.color }}>
                {currentUser.name?.split(' ').map(w => w[0]).join('').slice(0, 2) ?? 'U'}
              </button>
              {!collapsed && (
                <button onClick={() => setActiveNav('profile')} className="flex-1 min-w-0 text-left cursor-pointer">
                  <div className="text-xs font-semibold truncate" style={{ color: 'var(--menu-text)' }}>{currentUser.name}</div>
                  <div className="text-[10px]" style={{ color: tenant?.name ? 'var(--menu-accent)' : 'var(--menu-text-muted)' }}>
                    {tenant?.name ?? rl.label}
                  </div>
                </button>
              )}
              {!collapsed && (
                <button
                  onClick={onLogout}
                  title="Sign out"
                  className="p-1 rounded-lg flex-shrink-0 transition-colors"
                  style={{ color: 'var(--menu-text-muted)' }}
                  onMouseEnter={e => { e.currentTarget.style.color = '#f87171'; }}
                  onMouseLeave={e => { e.currentTarget.style.color = 'var(--menu-text-muted)'; }}
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
            style={{ borderColor: 'var(--border)' }}>

            {/* Page title */}
            <div className="flex-1 min-w-0">
              <h1 className="text-xl font-bold truncate" style={{ color: 'var(--text)' }}>
                {allowedNav.find(n => n.id === effectiveNav)?.label ?? 'Dashboard'}
              </h1>
            </div>

            {/* Search */}
            <div className="hidden md:flex items-center gap-2 px-3.5 py-2 rounded-xl border text-sm w-60"
              style={{ borderColor: 'var(--border-strong)', background: 'var(--surface-2)' }}>
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="#94a3b8" strokeWidth="1.6">
                <circle cx="6" cy="6" r="4.5"/><path d="M10 10L13 13"/>
              </svg>
              <input
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                onKeyDown={handleSearchKey}
                placeholder="Search students… (Enter)"
                className="outline-none bg-transparent text-sm w-full text-gray-700 placeholder:text-gray-400"
              />
            </div>

            {/* Bell */}
            <div className="relative">
              <button
                onClick={() => setNotifOpen(!notifOpen)}
                className="relative w-9 h-9 rounded-full border flex items-center justify-center transition-colors"
                style={{ borderColor: 'var(--border-strong)', background: 'var(--surface)' }}
                onMouseEnter={e => e.currentTarget.style.background = 'var(--surface-3)'}
                onMouseLeave={e => e.currentTarget.style.background = '#fff'}
              >
                <Icon d={NAV_ICONS.notifs} size={16} stroke="#64748b" />
                <span className="absolute top-1 right-1 w-2.5 h-2.5 rounded-full bg-red-500 border-2 border-white flex items-center justify-center">
                  <span className="text-[6px] text-white font-bold">3</span>
                </span>
              </button>
              {notifOpen && <NotifDropdown onClose={() => setNotifOpen(false)} />}
            </div>

            {/* Avatar → profile */}
            <button onClick={() => setActiveNav('profile')} title="My profile"
              className="w-9 h-9 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0 cursor-pointer transition-transform hover:scale-105"
              style={{ background: rl.color }}>
              {currentUser.name?.split(' ').map(w => w[0]).join('').slice(0, 2) ?? 'U'}
            </button>
          </header>

          {/* Page content */}
          <main className="flex-1 overflow-y-auto" style={{ background: 'var(--app-bg)', padding: '20px 24px' }}>
            {billing && roleId !== 'saas_admin' && billing.status !== SUB_STATUS.ACTIVE && (
              <BillingBanner billing={billing} locked={locked} onOpen={() => setActiveNav('subscription')} />
            )}
            <PermissionGate roleId={roleId} navId={effectiveNav}>
              <PageContent activeNav={effectiveNav} roleId={roleId} schoolId={schoolId} tenant={tenant} currentUser={currentUser} searchQuery={searchQuery}
                theme={theme} onTheme={onTheme} onUpdateUser={onUpdateUser} onUpdateTenant={onUpdateTenant} onLogout={onLogout} />
            </PermissionGate>
          </main>
        </div>
      </div>
  );
}

/* ─── Unknown role (fail closed) ─────────────────────────────── */
function UnknownRole({ roleId, onLogout }) {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-3 px-6 text-center" style={{ background: 'var(--app-bg)' }}>
      <div className="w-14 h-14 rounded-2xl bg-red-50 flex items-center justify-center text-2xl">🚫</div>
      <p className="text-base font-semibold" style={{ color: 'var(--text)' }}>Unrecognised role</p>
      <p className="text-sm text-gray-500 max-w-sm">
        The role <code className="font-mono text-xs px-1.5 py-0.5 rounded bg-white border" style={{ borderColor: 'var(--border-strong)' }}>{String(roleId)}</code> has
        no access configuration. Contact your platform administrator.
      </p>
      <button onClick={onLogout} className="btn-brand-primary text-sm py-2 px-4 mt-1">Back to sign-in</button>
    </div>
  );
}

/* ─── Subscription banner (trial / past due / revoked) ───────── */
function BillingBanner({ billing, locked, onOpen }) {
  const meta = statusMeta(billing.status);
  const tone = locked ? 'var(--danger)' : billing.status === SUB_STATUS.PAST_DUE ? 'var(--danger)' : 'var(--warn)';
  const tint = locked ? 'var(--tint-red)' : 'var(--tint-amber)';

  return (
    <div className="mb-4 rounded-2xl border px-4 py-3 flex items-start gap-3 flex-wrap"
      style={{ background: tint, borderColor: tone + '55' }}>
      <span className="text-lg flex-shrink-0">{locked ? '🔒' : billing.status === SUB_STATUS.PAST_DUE ? '⚠️' : '⏳'}</span>
      <div className="flex-1 min-w-[200px]">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs font-bold px-2 py-0.5 rounded-full" style={{ background: meta.tint, color: meta.color }}>
            {meta.label}
          </span>
          <span className="text-sm font-bold" style={{ color: 'var(--text)' }}>
            {locked ? 'School access paused' : statusSentence(billing)}
          </span>
        </div>
        <p className="text-[11px] mt-1" style={{ color: 'var(--text-muted)' }}>
          {locked
            ? `${billing.reason}. Settle the outstanding invoice to restore access.`
            : billing.status === SUB_STATUS.TRIAL
              ? `Your ${TRIAL_DAYS}-day trial ends ${dateLabel(billing.trialEndsAt)}. Add a payment method to keep access.`
              : `Outstanding ${formatUGX(billing.outstanding)} — access ends in ${billing.graceDaysLeft} day${billing.graceDaysLeft === 1 ? '' : 's'}.`}
        </p>
      </div>
      <button onClick={onOpen} className="text-xs font-bold px-4 py-2 rounded-xl text-white flex-shrink-0"
        style={{ background: tone }}>
        {locked || billing.status === SUB_STATUS.PAST_DUE ? 'Settle invoice' : 'View plans'}
      </button>
    </div>
  );
}

/* ─── Permission Gate ────────────────────────────────────────── */
function PermissionGate({ roleId, navId, children }) {
  if (!navAllowed(roleId, navId)) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-3 text-center">
        <div className="w-14 h-14 rounded-2xl bg-red-50 flex items-center justify-center text-2xl">🔒</div>
        <p className="text-base font-semibold" style={{ color: 'var(--text)' }}>Access Denied</p>
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
      style={{ background: '#A3CF2E', color: 'var(--text)', height: '32px' }}>
      <span className="w-1.5 h-1.5 rounded-full bg-green-700 animate-pulse" />
      Demo Mode — Real payments disabled · Data resets on refresh · Tenant isolation simulated
      <button onClick={() => setVis(false)} className="ml-3 opacity-50 hover:opacity-100">✕</button>
    </div>
  );
}

/* ─── Notification dropdown ───────────────────────────────────── */
function NotifDropdown() {
  const notifs = [
    { icon: '💳', text: 'Fee payment received from Kabuye Peter', time: '2m ago',  dot: '#10b981' },
    { icon: '👥', text: 'New student enrolled: Aisha Nakato, S.1', time: '15m ago', dot: '#1E45FC' },
    { icon: '📊', text: 'Term 2 results submitted by Ms. Grace',   time: '1h ago',  dot: '#f59e0b' },
  ];
  return (
    <div className="absolute right-0 top-11 w-72 bg-white rounded-2xl shadow-xl border z-50 overflow-hidden"
      style={{ borderColor: 'var(--border)' }}>
      <div className="px-4 py-3 border-b flex items-center justify-between" style={{ borderColor: '#f0f0f0' }}>
        <span className="text-sm font-semibold" style={{ color: 'var(--text)' }}>Notifications</span>
        <span className="text-xs font-bold px-2 py-0.5 rounded-full" style={{ background: 'var(--tint-blue)', color: 'var(--accent)' }}>3 new</span>
      </div>
      {notifs.map((n, i) => (
        <div key={i} className="flex items-start gap-3 px-4 py-3 hover:bg-gray-50 cursor-pointer border-b last:border-0"
          style={{ borderColor: '#f8f8f8' }}>
          <div className="w-8 h-8 rounded-lg flex items-center justify-center text-sm flex-shrink-0" style={{ background: 'var(--surface-2)' }}>{n.icon}</div>
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
function PageContent({ activeNav, roleId, schoolId, tenant, currentUser, searchQuery, theme, onTheme, onUpdateUser, onUpdateTenant, onLogout }) {
  const props = { roleId, schoolId, tenant, currentUser };
  switch (activeNav) {
    case 'overview':   return roleId === 'saas_admin' ? <SaasOverviewPage /> : <OverviewPage {...props} />;
    case 'profile':    return <ProfilePage {...props} theme={theme} onTheme={onTheme} onUpdateUser={onUpdateUser} onLogout={onLogout} />;
    case 'subscription': return <SubscriptionPage {...props} onUpdateTenant={onUpdateTenant} />;
    case 'audit':      return <AuditLogPage {...props} />;
    case 'students':   return <StudentsPage {...props} initialSearch={searchQuery} />;
    case 'parents':    return <ParentsPage    {...props} />;
    case 'teachers':   return <TeachersPage   {...props} />;
    case 'attendance': return <AttendancePage {...props} />;
    case 'timetable':  return <TimetablePage  {...props} />;
    case 'results':    return <ResultsPage    {...props} />;
    case 'finance':    return <FinancePage    {...props} />;
    case 'reports':    return <ReportCardsPage {...props} />;
    case 'idcards':    return <IDCardsPage    {...props} />;
    case 'enrollment': return <EnrollmentBuilderPage {...props} />;
    case 'notifs':     return <NotificationsPage {...props} />;
    case 'schools':    return <SaasSchoolsPage roleId={roleId} />;
    case 'billing':    return <SaasBillingPage roleId={roleId} />;
    case 'onboarding': return <SaasOnboardingPage roleId={roleId} />;
    case 'features':   return <SaasFeaturesPage roleId={roleId} />;
    case 'settings':   return <SettingsPage   {...props} />;
    default:           return <ComingSoon label={activeNav} />;
  }
}

/* ── Shared card wrapper ── */
function Card({ children, className = '', style = {} }) {
  return (
    <div className={`bg-white rounded-2xl border ${className}`} style={{ borderColor: 'var(--border)', ...style }}>
      {children}
    </div>
  );
}

/* ── Toast notification ── */
function Toast({ toasts }) {
  return (
    <div className="fixed bottom-5 right-5 z-[200] flex flex-col gap-2 pointer-events-none">
      {toasts.map(t => (
        <div key={t.id} className="flex items-center gap-3 px-4 py-3 rounded-2xl shadow-lg text-sm font-semibold text-white animate-slide-up pointer-events-auto"
          style={{ background: t.type === 'error' ? '#dc2626' : t.type === 'warn' ? '#d97706' : '#059669', minWidth: 240, maxWidth: 340 }}>
          <span>{t.type === 'error' ? '✕' : t.type === 'warn' ? '⚠' : '✓'}</span>
          <span className="flex-1">{t.msg}</span>
        </div>
      ))}
    </div>
  );
}
function useToast() {
  const [toasts, setToasts] = useState([]);
  const show = useCallback((msg, type = 'success') => {
    const id = Date.now();
    setToasts(t => [...t, { id, msg, type }]);
    setTimeout(() => setToasts(t => t.filter(x => x.id !== id)), 3000);
  }, []);
  return { toasts, show };
}

/* ── Generic confirm dialog ── */
function ConfirmDialog({ title, body, confirmLabel = 'Confirm', danger = false, onConfirm, onClose }) {
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4" style={{ background: 'rgba(11,15,42,0.5)', backdropFilter: 'blur(4px)' }} onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6 animate-slide-up" onClick={e => e.stopPropagation()}>
        <h3 className="font-bold text-base mb-2" style={{ color: 'var(--text)' }}>{title}</h3>
        <p className="text-sm text-gray-500 mb-6">{body}</p>
        <div className="flex gap-3">
          <button onClick={onClose} className="flex-1 py-2.5 rounded-xl border text-sm font-semibold text-gray-600 hover:bg-gray-50" style={{ borderColor: 'var(--border-strong)' }}>Cancel</button>
          <button onClick={onConfirm} className="flex-1 py-2.5 rounded-xl text-sm font-bold text-white" style={{ background: danger ? '#dc2626' : '#1E45FC' }}>{confirmLabel}</button>
        </div>
      </div>
    </div>
  );
}

/* ── Generic info modal ── */
function InfoModal({ title, subtitle, children, onClose, footer }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(11,15,42,0.55)', backdropFilter: 'blur(4px)' }} onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto animate-slide-up" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-4 border-b" style={{ borderColor: 'var(--border)' }}>
          <div>
            <h3 className="font-bold text-base" style={{ color: 'var(--text)' }}>{title}</h3>
            {subtitle && <p className="text-xs text-gray-400 mt-0.5">{subtitle}</p>}
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-lg flex items-center justify-center text-gray-400 hover:bg-gray-100 text-lg">✕</button>
        </div>
        <div className="px-6 py-4">{children}</div>
        {footer && <div className="px-6 pb-5">{footer}</div>}
      </div>
    </div>
  );
}

/* ── Stat card ── */
function StatCard({ label, value, delta, deltaPositive = true, sub = 'this month', iconBg, iconColor, svgPath }) {
  return (
    <Card className="p-5">
      <div className="flex items-start justify-between">
        <div className="flex-1 min-w-0">
          <p className="text-xs font-medium text-gray-400 mb-1">{label}</p>
          <div className="text-2xl font-extrabold mb-1" style={{ color: 'var(--text)' }}>{value}</div>
          {delta ? (
            <div className="flex items-center gap-1">
              <span className={`text-xs font-semibold ${deltaPositive ? 'text-green-600' : 'text-red-500'}`}>
                {delta}
              </span>
              {sub && <span className="text-xs text-gray-400">{sub}</span>}
            </div>
          ) : null}
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
function OverviewPage({ roleId, schoolId, currentUser }) {
  const isTeacher  = roleId === 'teacher';
  const isParent   = roleId === 'parent';
  const isHeadTeacher = roleId === 'head_teacher';
  const assignment = isTeacher ? getTeacherAssignment(currentUser?.user_id) : null;
  const children   = parentChildren(currentUser);

  const allStudents = queryStudents(schoolId);
  // Role-scoped rows (teacher → assigned classes, parent → own children)
  const students = scopedStudents(schoolId, currentUser);
  const teachers  = queryTeachers(schoolId);
  const payments  = queryPayments(schoolId);
  const confirmedPay = payments.filter(p => p.status === 'Confirmed');
  const totalFees = confirmedPay.reduce((sum, p) => sum + (parseInt(String(p.amount).replace(/,/g, ''), 10) || 0), 0);

  /* ── Parent portal overview: scoped to the parent's children only ── */
  if (isParent) {
    const childGrade = (name) => {
      // Deterministic mock average derived from the child's name (stable across reloads)
      const h = [...name].reduce((a, c) => a + c.charCodeAt(0), 0);
      const avg = 62 + (h % 26); // 62–87
      return { avg, grade: avg >= 80 ? 'D1' : avg >= 70 ? 'D2' : avg >= 65 ? 'C3' : avg >= 60 ? 'C4' : avg >= 55 ? 'C5' : 'C6' };
    };
    return (
      <div className="animate-fade-in space-y-5">
        <div>
          <h2 className="text-lg font-extrabold" style={{ color: 'var(--text)' }}>My Child</h2>
          <p className="text-xs text-gray-400 mt-0.5">{currentUser.name} · Parent Portal · {schoolId}</p>
        </div>

        {children.length === 0 && (
          <Card className="p-10 text-center">
            <div className="text-3xl mb-2">👶</div>
            <p className="text-sm font-semibold text-gray-500">No children linked to your account yet.</p>
            <p className="text-xs text-gray-400 mt-1">Contact your school administrator to link your children.</p>
          </Card>
        )}

        {children.map(name => {
          const st = allStudents.find(s => s.name === name);
          const { avg, grade } = childGrade(name);
          const childPay = payments.filter(p => p.student === name);
          const paidTotal = childPay.filter(p => p.status === 'Confirmed')
            .reduce((s, p) => s + (parseInt(String(p.amount).replace(/,/g, ''), 10) || 0), 0);
          return (
            <Card key={name} className="p-5">
              <div className="flex items-start justify-between flex-wrap gap-3">
                <div className="flex items-center gap-3">
                  <div className="w-11 h-11 rounded-full flex items-center justify-center text-white text-sm font-bold flex-shrink-0" style={{ background: '#1E45FC' }}>
                    {name.split(' ').map(w => w[0]).join('').slice(0, 2)}
                  </div>
                  <div>
                    <div className="text-base font-extrabold" style={{ color: 'var(--text)' }}>{name}</div>
                    <div className="text-xs text-gray-400">{st?.class ?? '—'}</div>
                  </div>
                </div>
                <div className="flex gap-2 flex-wrap">
                  <span className="text-xs font-bold px-2.5 py-1 rounded-full"
                    style={{ background: st?.fee === 'Paid' ? 'var(--tint-green)' : st?.fee === 'Partial' ? 'var(--tint-amber)' : 'var(--tint-red)',
                             color: st?.fee === 'Paid' ? 'var(--ok)' : st?.fee === 'Partial' ? '#d97706' : '#dc2626' }}>
                    Fees: {st?.fee ?? '—'}
                  </span>
                  <span className="text-xs font-bold px-2.5 py-1 rounded-full" style={{ background: 'var(--tint-blue)', color: 'var(--accent)' }}>
                    Avg {avg}% · {grade}
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mt-4">
                <div className="rounded-xl p-3 text-center" style={{ background: 'var(--surface-2)' }}>
                  <div className="text-lg font-extrabold" style={{ color: 'var(--accent)' }}>{st?.class ?? '—'}</div>
                  <div className="text-[10px] text-gray-400 mt-0.5">Class</div>
                </div>
                <div className="rounded-xl p-3 text-center" style={{ background: '#f0fdf4' }}>
                  <div className="text-lg font-extrabold" style={{ color: 'var(--ok)' }}>{st?.status ?? '—'}</div>
                  <div className="text-[10px] text-gray-400 mt-0.5">Status</div>
                </div>
                <div className="rounded-xl p-3 text-center" style={{ background: 'var(--tint-amber)' }}>
                  <div className="text-lg font-extrabold" style={{ color: 'var(--warn)' }}>UGX {paidTotal.toLocaleString()}</div>
                  <div className="text-[10px] text-gray-400 mt-0.5">Paid This Term</div>
                </div>
              </div>

              {childPay.length > 0 && (
                <div className="mt-4">
                  <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Recent Payments</p>
                  <div className="space-y-1.5">
                    {childPay.map((p, i) => (
                      <div key={i} className="flex items-center justify-between text-xs px-3 py-2 rounded-lg" style={{ background: 'var(--surface-2)', border: '1px solid var(--border)' }}>
                        <span className="font-semibold" style={{ color: 'var(--text)' }}>UGX {p.amount}</span>
                        <span className="text-gray-400">{p.method} · {p.date}</span>
                        <span className="font-bold" style={{ color: p.status === 'Confirmed' ? 'var(--ok)' : '#d97706' }}>{p.status}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </Card>
          );
        })}
      </div>
    );
  }

  // Timetable metrics (teacher & head teacher)
  const showTimetable = isTeacher || isHeadTeacher;

  const TODAY_SCHEDULE_TEACHER = [
    { time: '7:30 – 8:30',   subject: 'Mathematics', class: 'S.3 East',  room: 'LB-04', status: 'done' },
    { time: '8:30 – 9:30',   subject: 'Mathematics', class: 'S.3 West',  room: 'LB-06', status: 'done' },
    { time: '9:30 – 10:30',  subject: 'Mathematics', class: 'S.4 West',  room: 'LB-02', status: 'current' },
    { time: '10:30 – 11:00', subject: 'Break',        class: '—',          room: '—',     status: 'break' },
    { time: '11:00 – 12:00', subject: 'Mathematics', class: 'S.3 East',  room: 'LB-04', status: 'upcoming' },
    { time: '12:00 – 13:00', subject: 'Free Period',  class: '—',          room: '—',     status: 'free' },
    { time: '14:00 – 15:00', subject: 'Mathematics', class: 'S.4 West',  room: 'LB-02', status: 'upcoming' },
  ];
  const TODAY_SCHEDULE_HEAD = [
    { time: '7:30 – 8:30',   subject: 'Assembly / Admin',  class: 'All',       room: 'Hall',  status: 'done' },
    { time: '8:30 – 9:30',   subject: 'Staff Briefing',    class: 'Staff',     room: 'B-01',  status: 'done' },
    { time: '9:30 – 10:30',  subject: 'Class Observation', class: 'S.4 East',  room: 'LB-01', status: 'current' },
    { time: '10:30 – 11:00', subject: 'Break',              class: '—',          room: '—',     status: 'break' },
    { time: '11:00 – 12:00', subject: 'Dept. Meeting',     class: 'HODs',      room: 'B-02',  status: 'upcoming' },
    { time: '14:00 – 15:00', subject: 'Parent Meeting',    class: 'P.7 Parents', room: 'Hall', status: 'upcoming' },
  ];
  const todaySchedule = isTeacher ? TODAY_SCHEDULE_TEACHER : TODAY_SCHEDULE_HEAD;
  const periodsTeaching = todaySchedule.filter(p => p.status !== 'break' && p.status !== 'free' && p.subject !== 'Free Period').length;
  const freePeriods = todaySchedule.filter(p => p.status === 'free' || p.subject === 'Free Period').length;
  const nextClass = todaySchedule.find(p => p.status === 'upcoming');
  const currentClass = todaySchedule.find(p => p.status === 'current');

  // School-wide timetable coverage for head teacher
  const HEAD_COVERAGE = [
    { dept: 'Sciences',     covered: 8, total: 8, color: 'var(--accent)' },
    { dept: 'Languages',    covered: 6, total: 7, color: 'var(--ok)' },
    { dept: 'Mathematics',  covered: 5, total: 5, color: 'var(--info)' },
    { dept: 'Humanities',   covered: 4, total: 6, color: 'var(--warn)' },
    { dept: 'Technical',    covered: 3, total: 4, color: 'var(--violet)' },
  ];

  // Quick links to other modules are handled by the sidebar — no separate widget

  const feeCollected = totalFees;

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
    { label: 'New student enrolled', time: '2 mins ago',  iconBg: 'var(--tint-blue)', iconColor: '#1E45FC', svgPath: 'M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2M9 7a4 4 0 100 8 4 4 0 000-8z' },
    ...(!isTeacher ? [{ label: 'Payment received', time: '15 mins ago', iconBg: 'var(--tint-green)', iconColor: '#059669', svgPath: 'M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z' }] : []),
    { label: 'Exam scheduled',       time: '1 hour ago',  iconBg: 'var(--tint-amber)', iconColor: '#d97706', svgPath: 'M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z' },
    { label: 'Report card generated',time: '2 hours ago', iconBg: 'var(--tint-violet)', iconColor: '#7c3aed', svgPath: 'M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8zM14 2v6h6M16 13H8M16 17H8' },
  ];

  return (
    <div className="animate-fade-in space-y-5">
      {/* Stats row */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
        <StatCard label={isTeacher ? 'My Students' : 'Total Students'} value={students.length.toLocaleString()} delta="12%" deltaPositive iconBg="#e8ecff" iconColor="#1E45FC" svgPath="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2M9 7a4 4 0 100 8 4 4 0 000-8zM23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75" />
        {isTeacher ? (
          <StatCard label="My Classes"    value={assignment?.classes.length ?? 0} delta="" deltaPositive iconBg="#fce7f3" iconColor="#db2777" svgPath="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z" />
        ) : (
          <StatCard label="Teachers"      value={teachers.length}                 delta="5%"  deltaPositive iconBg="#dbeafe" iconColor="#2563eb" svgPath="M22 10v6M2 10l10-5 10 5-10 5zM6 12v5c3 3 9 3 12 0v-5" />
        )}
        {isTeacher ? (
          <StatCard label="My Subjects"   value={assignment?.subjects.length ?? 0} delta="" deltaPositive iconBg="#d1fae5" iconColor="#059669" svgPath="M12 20h9M16.5 3.5a2.121 2.121 0 013 3L7 19l-4 1 1-4L16.5 3.5z" />
        ) : (
          <StatCard label="Classes"       value="48"                              delta="8%"  deltaPositive iconBg="#fce7f3" iconColor="#db2777" svgPath="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z" />
        )}
        {isTeacher ? (
          <StatCard label="Attendance Today" value="85%" delta="3%" deltaPositive iconBg="#e0f2fe" iconColor="#0891b2" svgPath="M9 11l3 3L22 4M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11" />
        ) : (
          <StatCard label="Total Revenue" value={`UGX ${(feeCollected/1000000).toFixed(1)}M`} delta="18%" deltaPositive iconBg="#d1fae5" iconColor="#059669" svgPath="M12 1v22M17 5H9.5a3.5 3.5 0 100 7h5a3.5 3.5 0 110 7H6" />
        )}
      </div>

      {/* Middle row — Fee chart + Attendance donut + Recent Activities */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">

        {/* Fee Collection bar chart — hidden for teacher */}
        {!isTeacher && (
          <Card className="lg:col-span-2 p-5 flex flex-col">
            <div className="mb-1">
              <h3 className="font-bold text-sm" style={{ color: 'var(--text)' }}>Fees Collection</h3>
            </div>
            <div className="mb-3">
              <p className="text-xs text-gray-400">This Month</p>
              <p className="text-2xl font-extrabold mt-0.5" style={{ color: 'var(--text)' }}>
                UGX {(feeCollected/1000000).toFixed(1)}M
              </p>
              <span className="text-xs font-semibold text-green-600">+18% from last month</span>
            </div>
            <div className="flex items-end gap-1 flex-1" style={{ minHeight: 90 }}>
              {feeBars.map((h, i) => (
                <div key={i} className="flex-1 flex flex-col items-center gap-0.5">
                  <div className="w-full rounded-xs transition-all"
                    style={{ height: `${h}%`, minHeight: 4, background: i === feeBars.length - 3 ? '#1E45FC' : '#c7d4fd' }} />
                  <span className="text-[8px] text-gray-400">{feeMonths[i].slice(0,1)}</span>
                </div>
              ))}
            </div>
          </Card>
        )}
        {/* Teacher: Subject Performance (replaces fee chart) */}
        {isTeacher && (
          <Card className="lg:col-span-2 p-5 flex flex-col">
            <h3 className="font-bold text-sm mb-3" style={{ color: 'var(--text)' }}>Subject Performance</h3>
            <p className="text-xs text-gray-400 mb-4">{assignment?.subjects.join(', ') || 'No subjects assigned'}</p>
            <div className="space-y-3 flex-1">
              {(assignment?.classes ?? []).map((cls, i) => {
                const scores = [88, 76, 82];
                const score = scores[i % scores.length];
                return (
                  <div key={cls}>
                    <div className="flex justify-between text-xs mb-1">
                      <span className="font-medium text-gray-700">{cls}</span>
                      <span className="font-bold" style={{ color: 'var(--accent)' }}>{score}%</span>
                    </div>
                    <div className="h-2 rounded-full bg-gray-100 overflow-hidden">
                      <div className="h-full rounded-full" style={{ width: `${score}%`, background: '#1E45FC' }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </Card>
        )}

        {/* Attendance donut */}
        <Card className="lg:col-span-2 p-5">
          <h3 className="font-bold text-sm mb-4" style={{ color: 'var(--text)' }}>Attendance Overview</h3>
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
                { label: 'Present', pct: '85%', color: 'var(--accent)' },
                { label: 'Absent',  pct: '10%', color: '#f97316' },
                { label: 'Late',    pct: '5%',  color: '#22c55e' },
              ].map((item) => (
                <div key={item.label} className="flex items-center gap-2">
                  <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: item.color }} />
                  <span className="text-xs text-gray-500 flex-1">{item.label}</span>
                  <span className="text-xs font-bold" style={{ color: 'var(--text)' }}>{item.pct}</span>
                </div>
              ))}
            </div>
          </div>
        </Card>

        {/* Recent Activities */}
        <Card className="lg:col-span-1 flex flex-col">
          <div className="flex items-center justify-between px-4 py-3.5 border-b" style={{ borderColor: 'var(--border)' }}>
            <h3 className="font-bold text-sm" style={{ color: 'var(--text)' }}>Recent Activities</h3>
            <button className="text-xs font-semibold" style={{ color: 'var(--accent)' }}>View all</button>
          </div>
          <div className="flex-1 divide-y" style={{ borderColor: 'var(--border-subtle)' }}>
            {recentActivities.map((a, i) => (
              <div key={i} className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50/60 transition-colors">
                <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: a.iconBg }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={a.iconColor} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                    <path d={a.svgPath}/>
                  </svg>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold truncate" style={{ color: 'var(--text)' }}>{a.label}</p>
                  <p className="text-[10px] text-gray-400">{a.time}</p>
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>

      {/* ── Timetable Metrics row (teacher & head teacher only) ── */}
      {showTimetable && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

          {/* Today's Schedule */}
          <Card className="lg:col-span-2 flex flex-col">
            <div className="flex items-center justify-between px-5 py-4 border-b" style={{ borderColor: 'var(--border)' }}>
              <div>
                <h3 className="font-bold text-sm" style={{ color: 'var(--text)' }}>
                  {isTeacher ? "Today's Teaching Schedule" : "Today's Schedule"}
                </h3>
                <p className="text-[11px] text-gray-400 mt-0.5">
                  {new Date().toLocaleDateString('en-UG', { weekday: 'long', day: 'numeric', month: 'long' })}
                </p>
              </div>
              <div className="flex items-center gap-3">
                <div className="text-center">
                  <div className="text-base font-extrabold" style={{ color: 'var(--accent)' }}>{periodsTeaching}</div>
                  <div className="text-[9px] text-gray-400 uppercase tracking-wide">Periods</div>
                </div>
                <div className="w-px h-8 bg-gray-100" />
                <div className="text-center">
                  <div className="text-base font-extrabold" style={{ color: '#22c55e' }}>{freePeriods}</div>
                  <div className="text-[9px] text-gray-400 uppercase tracking-wide">Free</div>
                </div>
              </div>
            </div>

            {/* Current / Next class banner */}
            {(currentClass || nextClass) && (
              <div className="mx-5 mt-4 rounded-xl px-4 py-3 flex items-center gap-3"
                style={{ background: currentClass ? 'var(--tint-blue)' : '#f0fdf4', border: `1px solid ${currentClass ? '#c7d4fd' : '#bbf7d0'}` }}>
                <div className="w-2 h-2 rounded-full flex-shrink-0 animate-pulse"
                  style={{ background: currentClass ? '#1E45FC' : '#22c55e' }} />
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-bold truncate" style={{ color: currentClass ? 'var(--accent)' : '#15803d' }}>
                    {currentClass ? 'Now in progress' : 'Up next'}
                  </p>
                  <p className="text-[11px] text-gray-600 truncate">
                    {(currentClass || nextClass).subject} &nbsp;·&nbsp; {(currentClass || nextClass).class} &nbsp;·&nbsp; {(currentClass || nextClass).room}
                  </p>
                </div>
                <span className="text-[10px] font-semibold text-gray-400 flex-shrink-0">
                  {(currentClass || nextClass).time}
                </span>
              </div>
            )}

            {/* Schedule list */}
            <div className="flex-1 divide-y mt-3 pb-2" style={{ borderColor: 'var(--border-subtle)' }}>
              {todaySchedule.map((p, i) => {
                const isDone     = p.status === 'done';
                const isCurrent  = p.status === 'current';
                const isBreak    = p.status === 'break';
                const isFree     = p.status === 'free' || p.subject === 'Free Period';
                const subjectColor = isCurrent ? '#1E45FC' : isDone ? 'var(--text-dim)' : isBreak || isFree ? '#d97706' : 'var(--text)';
                return (
                  <div key={i}
                    className="flex items-center gap-3 px-5 py-2.5 hover:bg-gray-50/50 transition-colors"
                    style={isCurrent ? { background: '#f5f7ff' } : {}}>
                    {/* Status dot */}
                    <div className="w-2 h-2 rounded-full flex-shrink-0"
                      style={{ background: isDone ? 'var(--border-strong)' : isCurrent ? '#1E45FC' : isBreak || isFree ? '#fbbf24' : 'var(--border-strong)', border: !isDone && !isCurrent && !isBreak && !isFree ? '2px solid #cbd5e1' : 'none' }} />
                    {/* Time */}
                    <span className="text-[10px] font-mono text-gray-400 w-24 flex-shrink-0">{p.time}</span>
                    {/* Subject */}
                    <div className="flex-1 min-w-0">
                      <span className={`text-xs font-semibold truncate ${isDone ? 'line-through' : ''}`}
                        style={{ color: subjectColor }}>
                        {p.subject}
                      </span>
                      {p.class !== '—' && (
                        <span className="text-[10px] text-gray-400 ml-2">{p.class}</span>
                      )}
                    </div>
                    {/* Room badge */}
                    {p.room !== '—' && (
                      <span className="text-[10px] font-semibold px-2 py-0.5 rounded-md flex-shrink-0"
                        style={{ background: isCurrent ? 'var(--tint-blue)' : 'var(--surface-2)', color: isCurrent ? 'var(--accent)' : 'var(--text-muted)' }}>
                        {p.room}
                      </span>
                    )}
                    {/* Current badge */}
                    {isCurrent && (
                      <span className="text-[9px] font-bold px-2 py-0.5 rounded-full flex-shrink-0"
                        style={{ background: '#1E45FC', color: 'white' }}>LIVE</span>
                    )}
                  </div>
                );
              })}
            </div>
          </Card>

          {/* Right column: stats + coverage */}
          <div className="flex flex-col gap-4">

            {/* Mini stat cards */}
            <div className="grid grid-cols-2 gap-3">
              {[
                { label: 'Periods Today',   value: periodsTeaching, icon: 'M12 8v4l3 3M21 12a9 9 0 11-18 0 9 9 0 0118 0', color: 'var(--accent)', bg: 'var(--tint-blue)' },
                { label: 'Free Periods',    value: freePeriods,     icon: 'M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z', color: '#22c55e', bg: '#f0fdf4' },
                { label: isTeacher ? 'Classes Covered' : 'Depts Today', value: isTeacher ? (assignment?.classes.length ?? 0) : 3, icon: 'M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z', color: 'var(--info)', bg: 'var(--tint-sky)' },
                { label: 'Lessons This Week', value: isTeacher ? 14 : 22, icon: 'M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z', color: 'var(--violet)', bg: 'var(--tint-violet)' },
              ].map(s => (
                <div key={s.label} className="rounded-xl p-3 flex items-center gap-2.5" style={{ background: s.bg, border: `1px solid ${s.color}22` }}>
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: 'var(--surface)' }}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={s.color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                      <path d={s.icon}/>
                    </svg>
                  </div>
                  <div>
                    <div className="text-base font-extrabold leading-tight" style={{ color: s.color }}>{s.value}</div>
                    <div className="text-[10px] text-gray-500 leading-tight">{s.label}</div>
                  </div>
                </div>
              ))}
            </div>

            {/* Department / subject coverage */}
            <Card className="p-4 flex-1">
              <h4 className="text-xs font-bold mb-3" style={{ color: 'var(--text)' }}>
                {isTeacher ? 'Weekly Load by Class' : 'Dept. Coverage Today'}
              </h4>
              <div className="space-y-2.5">
                {(isTeacher
                  ? (assignment?.classes ?? []).map((cls, i) => ({
                      dept: cls,
                      covered: [5, 4, 6][i % 3],
                      total: 6,
                      color: ['var(--accent)','#0891b2','#7c3aed'][i % 3],
                    }))
                  : HEAD_COVERAGE
                ).map(item => (
                  <div key={item.dept}>
                    <div className="flex justify-between text-[11px] mb-1">
                      <span className="font-medium text-gray-600 truncate">{item.dept}</span>
                      <span className="font-bold flex-shrink-0 ml-2" style={{ color: item.color }}>
                        {item.covered}/{item.total}
                      </span>
                    </div>
                    <div className="h-1.5 rounded-full bg-gray-100 overflow-hidden">
                      <div className="h-full rounded-full transition-all"
                        style={{ width: `${Math.round((item.covered / item.total) * 100)}%`, background: item.color }} />
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          </div>

        </div>
      )}

    </div>
  );
}

/* ══════════════════════════════════════════════════
   STUDENTS
═══════════════════════════════════════════════════ */
function StudentsPage({ roleId, schoolId, currentUser, initialSearch = '' }) {
  const isTeacher = roleId === 'teacher';
  const assignment = isTeacher ? getTeacherAssignment(currentUser?.user_id) : null;
  const all = scopedStudents(schoolId, currentUser);

  const [students, setStudents] = useState(all);
  const [search, setSearch] = useState(initialSearch || '');
  const [filter, setFilter] = useState('all');
  const [showModal, setModal] = useState(false);
  const [viewStudent, setViewStudent] = useState(null);
  const [editStudent, setEditStudent] = useState(null);
  const [deleteStudent, setDeleteStudent] = useState(null);
  const { toasts, show: toast } = useToast();

  // Keep in sync with the global topbar search (adjust state during render,
  // per the React docs — avoids a cascading-render effect)
  const [prevInitial, setPrevInitial] = useState(initialSearch);
  if (prevInitial !== initialSearch) {
    setPrevInitial(initialSearch);
    setSearch(initialSearch);
  }

  const filtered = students.filter(s =>
    (filter === 'all' || s.status.toLowerCase() === filter) &&
    s.name.toLowerCase().includes(search.toLowerCase())
  );

  const feeColor = { Paid: '#059669', Partial: '#d97706', Unpaid: '#dc2626' };
  const feeBg    = { Paid: 'var(--tint-green)', Partial: 'var(--tint-amber)', Unpaid: 'var(--tint-red)' };

  return (
    <div className="animate-fade-in space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-extrabold" style={{ color: 'var(--text)' }}>
            {isTeacher ? 'My Students' : 'Students'}
          </h2>
          <p className="text-xs text-gray-400 mt-0.5">
            {all.length} {isTeacher ? `students across ${assignment?.classes.length} class${assignment?.classes.length !== 1 ? 'es' : ''}` : `enrolled · ${schoolId}`}
          </p>
        </div>
        {can(roleId, 'students.create') && (
          <button onClick={() => setModal(true)} className="btn-brand-primary text-sm py-2 px-4">+ Add Student</button>
        )}
      </div>

      {/* Teacher scope notice */}
      {isTeacher && assignment && (
        <div className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-medium" style={{ background: 'var(--tint-sky)', color: 'var(--info)', border: '1px solid #bae6fd' }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
          Showing students from your assigned classes: <strong className="ml-1">{assignment.classes.join(', ')}</strong>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2 px-3.5 py-2 rounded-xl border bg-white text-sm" style={{ borderColor: 'var(--border-strong)' }}>
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="#94a3b8" strokeWidth="1.5"><circle cx="6" cy="6" r="4.5"/><path d="M10 10L13 13"/></svg>
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search students…" className="outline-none bg-transparent text-sm w-40" />
        </div>
        {isTeacher ? (
          // Teacher filters by class
          assignment?.classes.map(cls => (
            <button key={cls} onClick={() => setFilter(filter === cls ? 'all' : cls)}
              className="text-xs font-semibold px-3 py-1.5 rounded-lg border transition-colors"
              style={filter === cls ? { borderColor: '#1E45FC', background: 'var(--tint-blue)', color: 'var(--accent)' } : { borderColor: 'var(--border-strong)', color: 'var(--text-muted)' }}>
              {cls}
            </button>
          ))
        ) : (
          ['all', 'active', 'inactive'].map(f => (
            <button key={f} onClick={() => setFilter(f)}
              className="text-xs font-semibold px-3 py-1.5 rounded-lg border capitalize transition-colors"
              style={filter === f ? { borderColor: '#1E45FC', background: 'var(--tint-blue)', color: 'var(--accent)' } : { borderColor: 'var(--border-strong)', color: 'var(--text-muted)' }}>
              {f === 'all' ? 'All' : f}
            </button>
          ))
        )}
      </div>

      <Card className="overflow-hidden">
        <table className="w-full">
          <thead>
            <tr style={{ background: 'var(--surface-2)', borderBottom: '1px solid var(--border)' }}>
              {['Name', 'Class', 'Parent', !isTeacher && 'Fee', 'Status', 'Actions'].filter(Boolean).map(h => (
                <th key={h} className="text-left px-4 py-3 text-xs font-bold text-gray-400 uppercase tracking-wider">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y" style={{ borderColor: 'var(--border-subtle)' }}>
            {filtered.filter(s => filter === 'all' || s.class === filter || s.status.toLowerCase() === filter).map(s => (
              <tr key={s.id} className="hover:bg-gray-50/50 transition-colors">
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2.5">
                    <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0" style={{ background: 'var(--tint-blue)', color: 'var(--accent)' }}>
                      {s.name.split(' ').map(w => w[0]).join('').slice(0, 2)}
                    </div>
                    <span className="text-sm font-semibold" style={{ color: 'var(--text)' }}>{s.name}</span>
                  </div>
                </td>
                <td className="px-4 py-3 text-sm text-gray-500">{s.class}</td>
                <td className="px-4 py-3 text-sm text-gray-400">{s.parent}</td>
                {!isTeacher && (
                  <td className="px-4 py-3">
                    <span className="text-xs font-bold px-2 py-1 rounded-full" style={{ background: feeBg[s.fee], color: feeColor[s.fee] }}>{s.fee}</span>
                  </td>
                )}
                <td className="px-4 py-3">
                  <span className={`text-xs font-bold px-2 py-1 rounded-full ${s.status === 'Active' ? 'bg-green-50 text-green-700' : 'bg-gray-100 text-gray-500'}`}>{s.status}</span>
                </td>
                <td className="px-4 py-3">
                  <div className="flex gap-2">
                    <button onClick={() => setViewStudent(s)} className="text-xs font-semibold hover:underline" style={{ color: 'var(--accent)' }}>View</button>
                    {can(roleId, 'students.edit') && <button onClick={() => setEditStudent(s)} className="text-xs text-gray-400 hover:text-gray-600">Edit</button>}
                    {can(roleId, 'students.delete') && <button onClick={() => setDeleteStudent(s)} className="text-xs text-gray-400 hover:text-red-500 transition-colors">Delete</button>}
                  </div>
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr><td colSpan={isTeacher ? 5 : 6} className="py-12 text-center text-sm text-gray-400">No students match your search.</td></tr>
            )}
          </tbody>
        </table>
      </Card>

      {showModal && <AddStudentModal schoolId={schoolId} onClose={() => setModal(false)} onAdd={s => { setStudents(p => [...p, s]); recordAudit({ action: AUDIT_ACTIONS.STUDENT_CREATED, target: s.name, detail: s.class }); setModal(false); toast('Student added successfully'); }} />}

      {viewStudent && (
        <InfoModal title={viewStudent.name} subtitle={`${viewStudent.class} · ${viewStudent.status}`} onClose={() => setViewStudent(null)}
          footer={<button onClick={() => setViewStudent(null)} className="w-full py-2.5 rounded-xl text-sm font-bold text-white" style={{ background: '#1E45FC' }}>Close</button>}>
          <div className="space-y-3">
            {[['Student ID', viewStudent.id], ['Class', viewStudent.class], ['Parent / Guardian', viewStudent.parent], ['Fee Status', viewStudent.fee], ['Enrolment Status', viewStudent.status]].map(([l, v]) => (
              <div key={l} className="flex justify-between py-2 border-b text-sm" style={{ borderColor: 'var(--border-subtle)' }}>
                <span className="text-gray-400">{l}</span><span className="font-semibold" style={{ color: 'var(--text)' }}>{v}</span>
              </div>
            ))}
          </div>
        </InfoModal>
      )}

      {editStudent && (
        <EditStudentModal student={editStudent} onClose={() => setEditStudent(null)}
          onSave={updated => { setStudents(p => p.map(s => s.id === updated.id ? updated : s)); recordAudit({ action: AUDIT_ACTIONS.STUDENT_UPDATED, target: updated.name, detail: `class ${updated.class}` }); setEditStudent(null); toast('Student record updated'); }} />
      )}

      {deleteStudent && (
        <ConfirmDialog
          title={`Delete ${deleteStudent.name}?`}
          body="This removes the student record from this school. This action cannot be undone."
          confirmLabel="Delete student"
          danger
          onConfirm={() => {
            setStudents(p => p.filter(s => s.id !== deleteStudent.id));
            recordAudit({ action: AUDIT_ACTIONS.STUDENT_DELETED, target: deleteStudent.name, detail: deleteStudent.class, severity: AUDIT_SEVERITY.CRITICAL });
            toast(`${deleteStudent.name} deleted`, 'error');
            setDeleteStudent(null);
          }}
          onClose={() => setDeleteStudent(null)}
        />
      )}

      <Toast toasts={toasts} />
    </div>
  );
}

const CLASSES_ALL = ['P.1','P.2','P.3','P.4','P.5','P.6','P.7','S.1 East','S.1 West','S.2 East','S.2 West','S.3 East','S.3 West','S.4 East','S.4 West','S.5 Arts','S.5 Science','S.6 Arts','S.6 Science'];

function AddStudentModal({ schoolId, onClose, onAdd }) {
  const [form, setForm] = useState({ name: '', class: '', parent: '', phone: '', fee: 'Unpaid', status: 'Active' });
  const [err, setErr] = useState({});
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));
  const submit = () => {
    const e = {};
    if (!form.name.trim()) e.name = 'Required';
    if (!form.class) e.class = 'Required';
    if (!form.parent.trim()) e.parent = 'Required';
    setErr(e);
    if (Object.keys(e).length) return;
    onAdd({ ...form, id: 's-' + Date.now(), school_id: schoolId });
  };
  const f = (label, key, type = 'text', ph = '') => (
    <div key={key}>
      <label className="block text-xs font-semibold text-gray-500 mb-1.5">{label}{err[key] && <span className="text-red-400 ml-1 text-[10px]">{err[key]}</span>}</label>
      <input type={type} value={form[key]} onChange={e => set(key, e.target.value)} placeholder={ph}
        className={`w-full px-3 py-2.5 rounded-xl border text-sm outline-none transition-all focus:border-[#1E45FC] ${err[key] ? 'border-red-300' : 'border-gray-200'}`}/>
    </div>
  );
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(11,15,42,0.55)', backdropFilter: 'blur(4px)' }} onClick={onClose}>
      <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl animate-slide-up" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-4 border-b" style={{ borderColor: 'var(--border)' }}>
          <h3 className="font-bold text-base" style={{ color: 'var(--text)' }}>Add New Student</h3>
          <button onClick={onClose} className="w-7 h-7 rounded-lg flex items-center justify-center text-gray-400 hover:bg-gray-100">✕</button>
        </div>
        <div className="p-6 flex flex-col gap-4">
          {f('Full Name', 'name', 'text', 'e.g. Aisha Nakato')}
          <div>
            <label className="block text-xs font-semibold text-gray-500 mb-1.5">Class{err.class && <span className="text-red-400 ml-1 text-[10px]">{err.class}</span>}</label>
            <select value={form.class} onChange={e => set('class', e.target.value)} className={`w-full px-3 py-2.5 rounded-xl border text-sm outline-none bg-white ${err.class ? 'border-red-300' : 'border-gray-200'}`}>
              <option value="">— Select class —</option>
              {CLASSES_ALL.map(c => <option key={c}>{c}</option>)}
            </select>
          </div>
          {f('Parent / Guardian Name', 'parent', 'text', 'e.g. Grace Nakato')}
          {f('Parent Phone', 'phone', 'tel', '+256 700 000 000')}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1.5">Fee Status</label>
              <select value={form.fee} onChange={e => set('fee', e.target.value)} className="w-full px-3 py-2.5 rounded-xl border text-sm outline-none bg-white border-gray-200">
                {['Paid','Partial','Unpaid'].map(s => <option key={s}>{s}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1.5">Status</label>
              <select value={form.status} onChange={e => set('status', e.target.value)} className="w-full px-3 py-2.5 rounded-xl border text-sm outline-none bg-white border-gray-200">
                {['Active','Inactive'].map(s => <option key={s}>{s}</option>)}
              </select>
            </div>
          </div>
        </div>
        <div className="flex gap-3 px-6 pb-6">
          <button onClick={onClose} className="flex-1 py-2.5 rounded-xl border text-sm font-semibold text-gray-600 hover:bg-gray-50" style={{ borderColor: 'var(--border-strong)' }}>Cancel</button>
          <button onClick={submit} className="flex-1 btn-brand-primary">Add Student</button>
        </div>
      </div>
    </div>
  );
}

function EditStudentModal({ student, onClose, onSave }) {
  const [form, setForm] = useState({ ...student });
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(11,15,42,0.55)', backdropFilter: 'blur(4px)' }} onClick={onClose}>
      <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl animate-slide-up" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-4 border-b" style={{ borderColor: 'var(--border)' }}>
          <h3 className="font-bold text-base" style={{ color: 'var(--text)' }}>Edit Student — {student.name}</h3>
          <button onClick={onClose} className="w-7 h-7 rounded-lg flex items-center justify-center text-gray-400 hover:bg-gray-100">✕</button>
        </div>
        <div className="p-6 flex flex-col gap-4">
          {[['Full Name','name'],['Parent / Guardian','parent']].map(([lbl, key]) => (
            <div key={key}>
              <label className="block text-xs font-semibold text-gray-500 mb-1.5">{lbl}</label>
              <input value={form[key]} onChange={e => set(key, e.target.value)} className="w-full px-3 py-2.5 rounded-xl border text-sm outline-none focus:border-[#1E45FC] border-gray-200"/>
            </div>
          ))}
          <div>
            <label className="block text-xs font-semibold text-gray-500 mb-1.5">Class</label>
            <select value={form.class} onChange={e => set('class', e.target.value)} className="w-full px-3 py-2.5 rounded-xl border text-sm outline-none bg-white border-gray-200">
              {CLASSES_ALL.map(c => <option key={c}>{c}</option>)}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1.5">Fee Status</label>
              <select value={form.fee} onChange={e => set('fee', e.target.value)} className="w-full px-3 py-2.5 rounded-xl border text-sm outline-none bg-white border-gray-200">
                {['Paid','Partial','Unpaid'].map(s => <option key={s}>{s}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1.5">Status</label>
              <select value={form.status} onChange={e => set('status', e.target.value)} className="w-full px-3 py-2.5 rounded-xl border text-sm outline-none bg-white border-gray-200">
                {['Active','Inactive'].map(s => <option key={s}>{s}</option>)}
              </select>
            </div>
          </div>
        </div>
        <div className="flex gap-3 px-6 pb-6">
          <button onClick={onClose} className="flex-1 py-2.5 rounded-xl border text-sm font-semibold text-gray-600 hover:bg-gray-50" style={{ borderColor: 'var(--border-strong)' }}>Cancel</button>
          <button onClick={() => onSave(form)} className="flex-1 btn-brand-primary">Save Changes</button>
        </div>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════
   PARENTS
═══════════════════════════════════════════════════ */
function ParentsPage({ roleId, schoolId, currentUser }) {
  const isTeacher  = roleId === 'teacher';
  const assignment = isTeacher ? getTeacherAssignment(currentUser?.user_id) : null;

  const baseAll = scopedParents(schoolId, currentUser);

  const [parents, setParents] = useState(baseAll);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('all');
  const [viewParent, setViewParent] = useState(null);
  const [contactParent, setContactParent] = useState(null);
  const [editParent, setEditParent] = useState(null);
  const [addModal, setAddModal] = useState(false);
  const { toasts, show: toast } = useToast();

  const filtered = parents.filter(p =>
    (filter === 'all' || p.status.toLowerCase() === filter) &&
    (p.name.toLowerCase().includes(search.toLowerCase()) ||
     (!isTeacher && p.email.toLowerCase().includes(search.toLowerCase())))
  );

  const balColor = (b) => b > 0 ? '#dc2626' : '#059669';
  const balBg    = (b) => b > 0 ? 'var(--tint-red)'  : 'var(--tint-green)';

  const totalParents  = parents.length;
  const outstanding   = parents.filter(p => p.balance > 0).length;
  const activeParents = parents.filter(p => p.status === 'Active').length;

  return (
    <div className="animate-fade-in space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-extrabold" style={{ color: 'var(--text)' }}>
            {isTeacher ? "My Students' Parents" : 'Parents & Guardians'}
          </h2>
          <p className="text-xs text-gray-400 mt-0.5">
            {isTeacher
              ? `${totalParents} parents for your assigned classes`
              : `${totalParents} registered · ${schoolId}`}
          </p>
        </div>
        {can(roleId, 'parents.create') && (
          <button onClick={() => setAddModal(true)} className="flex items-center gap-2 text-xs font-bold px-4 py-2 rounded-xl text-white" style={{ background: '#1E45FC' }}>
            <svg width="12" height="12" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><path d="M7 2v10M2 7h10"/></svg>
            Add Parent
          </button>
        )}
      </div>

      {/* Teacher scope notice */}
      {isTeacher && assignment && (
        <div className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-medium" style={{ background: 'var(--tint-sky)', color: 'var(--info)', border: '1px solid #bae6fd' }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
          Showing parents of students in: <strong className="ml-1">{assignment.classes.join(', ')}</strong>
        </div>
      )}

      {/* Stats */}
      <div className={`grid gap-4 ${isTeacher ? 'grid-cols-2' : 'grid-cols-3'}`}>
        {[
          { label: isTeacher ? 'Parents in My Classes' : 'Total Parents', value: totalParents,  iconBg: 'var(--tint-blue)', iconColor: '#1E45FC', svgPath: 'M20 21v-2a4 4 0 00-4-4h-4M14 11a4 4 0 10-8 0 4 4 0 008 0zM1 21v-2a4 4 0 014-4h.5' },
          { label: 'Active',  value: activeParents, iconBg: 'var(--tint-green)', iconColor: '#059669', svgPath: 'M22 11.08V12a10 10 0 11-5.93-9.14M22 4L12 14.01l-3-3' },
          ...(!isTeacher ? [{ label: 'Outstanding Fees', value: outstanding, iconBg: 'var(--tint-red)', iconColor: '#dc2626', svgPath: 'M12 1v22M17 5H9.5a3.5 3.5 0 100 7h5a3.5 3.5 0 110 7H6' }] : []),
        ].map(s => (
          <Card key={s.label} className="p-5">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs font-medium text-gray-400 mb-1">{s.label}</p>
                <p className="text-2xl font-extrabold" style={{ color: 'var(--text)' }}>{s.value}</p>
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
        <div className="flex items-center gap-2 px-3.5 py-2 rounded-xl border bg-white text-sm" style={{ borderColor: 'var(--border-strong)' }}>
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="#94a3b8" strokeWidth="1.5"><circle cx="6" cy="6" r="4.5"/><path d="M10 10L13 13"/></svg>
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search parents…" className="outline-none bg-transparent text-sm w-40" />
        </div>
        {['all', 'active', 'inactive'].map(f => (
          <button key={f} onClick={() => setFilter(f)}
            className="text-xs font-semibold px-3 py-1.5 rounded-lg border capitalize transition-colors"
            style={filter === f ? { borderColor: '#1E45FC', background: 'var(--tint-blue)', color: 'var(--accent)' } : { borderColor: 'var(--border-strong)', color: 'var(--text-muted)' }}>
            {f === 'all' ? 'All' : f}
          </button>
        ))}
        <span className="ml-auto text-xs text-gray-400">{filtered.length} result{filtered.length !== 1 ? 's' : ''}</span>
      </div>

      {/* Table */}
      <Card className="overflow-hidden">
        <table className="w-full">
          <thead>
            <tr style={{ background: 'var(--surface-2)', borderBottom: '1px solid var(--border)' }}>
              {[
                'Parent / Guardian',
                'Phone',
                'Children',
                !isTeacher && 'Fee Balance',
                !isTeacher && 'Last Contact',
                'Status',
                '',
              ].filter(Boolean).map(h => (
                <th key={h} className="text-left text-[11px] font-bold uppercase tracking-wide text-gray-400 px-4 py-3">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y" style={{ borderColor: 'var(--border-subtle)' }}>
            {filtered.length === 0 ? (
              <tr><td colSpan={isTeacher ? 4 : 7} className="px-4 py-10 text-center text-sm text-gray-400">No parents found.</td></tr>
            ) : filtered.map(p => (
              <tr key={p.id} className="hover:bg-gray-50/60 transition-colors">
                {/* Name + avatar — teacher sees name only, no email */}
                <td className="px-4 py-3">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0"
                      style={{ background: '#1E45FC' }}>
                      {p.name.split(' ').map(w => w[0]).join('').slice(0, 2)}
                    </div>
                    <div>
                      <div className="text-sm font-semibold" style={{ color: 'var(--text)' }}>{p.name}</div>
                      {!isTeacher && <div className="text-xs text-gray-400">{p.email}</div>}
                    </div>
                  </div>
                </td>
                {/* Phone — visible to teacher */}
                <td className="px-4 py-3 text-sm text-gray-600">{p.phone}</td>
                {/* Children */}
                <td className="px-4 py-3">
                  <div className="flex flex-wrap gap-1">
                    {p.children.map(c => (
                      <span key={c} className="text-[11px] font-semibold px-2 py-0.5 rounded-full" style={{ background: 'var(--tint-blue)', color: 'var(--accent)' }}>{c}</span>
                    ))}
                  </div>
                </td>
                {/* Balance — hidden from teacher */}
                {!isTeacher && (
                  <td className="px-4 py-3">
                    <span className="text-xs font-bold px-2 py-1 rounded-lg" style={{ background: balBg(p.balance), color: balColor(p.balance) }}>
                      {p.balance > 0 ? `UGX ${p.balance.toLocaleString()}` : 'Cleared'}
                    </span>
                  </td>
                )}
                {/* Last contact — hidden from teacher */}
                {!isTeacher && <td className="px-4 py-3 text-xs text-gray-500">{p.lastContact}</td>}
                {/* Status */}
                <td className="px-4 py-3">
                  <span className="text-[11px] font-bold px-2 py-0.5 rounded-full"
                    style={p.status === 'Active' ? { background: 'var(--tint-green)', color: 'var(--ok)' } : { background: '#f3f4f6', color: 'var(--text-muted)' }}>
                    {p.status}
                  </span>
                </td>
                {/* Actions */}
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    {can(roleId, 'parents.contact') && (
                      <button onClick={() => setContactParent(p)}
                        className="text-[11px] font-semibold px-2.5 py-1 rounded-lg border transition-colors"
                        style={{ borderColor: 'var(--border-strong)', color: 'var(--text-muted)' }}
                        onMouseEnter={e => { e.currentTarget.style.borderColor = '#1E45FC'; e.currentTarget.style.color = '#1E45FC'; }}
                        onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border-strong)'; e.currentTarget.style.color = 'var(--text-muted)'; }}>
                        Contact
                      </button>
                    )}
                    {!isTeacher && (
                      <button onClick={() => setViewParent(p)}
                        className="text-[11px] font-semibold px-2.5 py-1 rounded-lg border transition-colors"
                        style={{ borderColor: 'var(--border-strong)', color: 'var(--text-muted)' }}
                        onMouseEnter={e => { e.currentTarget.style.borderColor = '#1E45FC'; e.currentTarget.style.color = '#1E45FC'; }}
                        onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border-strong)'; e.currentTarget.style.color = 'var(--text-muted)'; }}>
                        View
                      </button>
                    )}
                    {can(roleId, 'parents.edit') && (
                      <button onClick={() => setEditParent(p)}
                        className="text-[11px] font-semibold px-2.5 py-1 rounded-lg border transition-colors"
                        style={{ borderColor: 'var(--border-strong)', color: 'var(--text-muted)' }}
                        onMouseEnter={e => { e.currentTarget.style.borderColor = '#A3CF2E'; e.currentTarget.style.color = '#5a7a0a'; }}
                        onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border-strong)'; e.currentTarget.style.color = 'var(--text-muted)'; }}>
                        Edit
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      {/* VIEW PARENT MODAL */}
      {viewParent && (
        <InfoModal
          title={viewParent.name}
          subtitle={`${viewParent.relationship ?? 'Parent/Guardian'} · ${viewParent.status}`}
          onClose={() => setViewParent(null)}
          footer={
            <div className="flex gap-3">
              <button onClick={() => setViewParent(null)} className="flex-1 py-2.5 rounded-xl border text-sm font-semibold text-gray-600 hover:bg-gray-50" style={{ borderColor: 'var(--border-strong)' }}>Close</button>
              {can(roleId, 'parents.contact') && (
                <button onClick={() => { setContactParent(viewParent); setViewParent(null); }} className="flex-1 py-2.5 rounded-xl text-sm font-bold text-white" style={{ background: '#1E45FC' }}>Contact</button>
              )}
            </div>
          }>
          <div className="space-y-1">
            {[
              ['Full Name',    viewParent.name],
              ['Phone',        viewParent.phone],
              ['Email',        viewParent.email],
              ['Status',       viewParent.status],
              ['Children',     viewParent.children?.join(', ') ?? '—'],
              ...(!isTeacher ? [['Fee Balance', viewParent.balance > 0 ? `UGX ${viewParent.balance.toLocaleString()} (Outstanding)` : 'Cleared'], ['Last Contact', viewParent.lastContact ?? '—']] : []),
            ].map(([l, v]) => (
              <div key={l} className="flex justify-between py-2 border-b last:border-0 text-sm" style={{ borderColor: 'var(--border-subtle)' }}>
                <span className="text-gray-400 text-xs">{l}</span>
                <span className="font-semibold text-xs" style={{ color: 'var(--text)' }}>{v}</span>
              </div>
            ))}
          </div>
        </InfoModal>
      )}

      {/* CONTACT PARENT MODAL */}
      {contactParent && (
        <ContactParentModal
          parent={contactParent}
          onClose={() => setContactParent(null)}
          onSent={() => { setContactParent(null); toast(`Message sent to ${contactParent.name}`); }}
        />
      )}

      {/* ADD PARENT MODAL */}
      {addModal && (
        <AddParentModal
          onClose={() => setAddModal(false)}
          onAdd={(p) => { setParents(prev => [...prev, p]); recordAudit({ action: AUDIT_ACTIONS.PARENT_CREATED, target: p.name }); setAddModal(false); toast('Parent added successfully'); }}
        />
      )}

      {/* EDIT PARENT MODAL */}
      {editParent && (
        <AddParentModal
          parent={editParent}
          onClose={() => setEditParent(null)}
          onAdd={(p) => {
            setParents(prev => prev.map(x => x.id === p.id ? p : x));
            recordAudit({ action: AUDIT_ACTIONS.PARENT_UPDATED, target: p.name });
            setEditParent(null);
            toast(`${p.name} updated`);
          }}
        />
      )}

      <Toast toasts={toasts} />
    </div>
  );
}

/* ── Contact Parent Modal ────────────────────────────────── */
function ContactParentModal({ parent, onClose, onSent }) {
  const [channel, setChannel] = useState('sms');
  const [message, setMessage] = useState(`Dear ${parent.name}, this is a message from the school administration.`);
  const [sending, setSending] = useState(false);

  const handleSend = () => {
    if (!message.trim()) return;
    setSending(true);
    setTimeout(() => { setSending(false); onSent(message); }, 800);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(11,15,42,0.55)', backdropFilter: 'blur(4px)' }}
      onClick={onClose}>
      <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-4 border-b" style={{ borderColor: 'var(--border)' }}>
          <div>
            <h3 className="font-bold text-base" style={{ color: 'var(--text)' }}>Contact Parent</h3>
            <p className="text-xs text-gray-400">{parent.name} · {parent.phone}</p>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-lg flex items-center justify-center text-gray-400 hover:bg-gray-100">✕</button>
        </div>
        <div className="p-6 space-y-4">
          {/* Channel selector */}
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-2">Send Via</label>
            <div className="grid grid-cols-3 gap-2">
              {[{ id:'sms', label:'SMS', icon:'💬' }, { id:'email', label:'Email', icon:'📧' }, { id:'call', label:'Call Log', icon:'📞' }].map(c => (
                <button key={c.id} onClick={() => setChannel(c.id)}
                  className="flex items-center justify-center gap-1.5 py-2.5 rounded-xl border text-xs font-semibold transition-all"
                  style={channel === c.id ? { borderColor: '#1E45FC', background: 'var(--tint-blue)', color: 'var(--accent)' } : { borderColor: 'var(--border-strong)', color: 'var(--text-muted)' }}>
                  <span>{c.icon}</span>{c.label}
                </button>
              ))}
            </div>
          </div>
          {/* Recipient */}
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1.5">Recipient</label>
            <div className="px-3 py-2.5 rounded-xl border text-sm text-gray-600 bg-gray-50" style={{ borderColor: 'var(--border-strong)' }}>
              {channel === 'email' ? parent.email || '(no email on file)' : parent.phone}
            </div>
          </div>
          {channel !== 'call' && (
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1.5">Message <span className="text-red-400">*</span></label>
              <textarea rows={4} value={message} onChange={e => setMessage(e.target.value)}
                className="w-full px-3 py-2.5 rounded-xl border text-sm outline-none resize-none focus:border-[#1E45FC] transition-all"
                style={{ borderColor: 'var(--border-strong)' }}/>
              <p className="text-[10px] text-gray-400 mt-1">{message.length} characters</p>
            </div>
          )}
          {channel === 'call' && (
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1.5">Call Notes</label>
              <textarea rows={3} placeholder="Log the outcome of your call…"
                className="w-full px-3 py-2.5 rounded-xl border text-sm outline-none resize-none focus:border-[#1E45FC] transition-all"
                style={{ borderColor: 'var(--border-strong)' }}/>
            </div>
          )}
        </div>
        <div className="flex gap-3 px-6 pb-6">
          <button onClick={onClose} className="flex-1 py-2.5 rounded-xl border text-sm font-semibold text-gray-600 hover:bg-gray-50" style={{ borderColor: 'var(--border-strong)' }}>Cancel</button>
          <button onClick={handleSend} disabled={sending}
            className="flex-1 py-2.5 rounded-xl text-sm font-bold text-white transition-opacity disabled:opacity-70"
            style={{ background: '#1E45FC' }}>
            {sending ? 'Sending…' : channel === 'call' ? 'Save Log' : 'Send Message'}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ── Add / Edit Parent Modal ─────────────────────────────── */
function AddParentModal({ parent = null, onClose, onAdd }) {
  const isEdit = !!parent;
  const [form, setForm] = useState({
    name:         parent?.name ?? '',
    phone:        parent?.phone ?? '',
    email:        parent?.email ?? '',
    relationship: parent?.relationship ?? 'Parent',
    children:     (parent?.children ?? []).join(', '),
    status:       parent?.status ?? 'Active',
    balance:      parent?.balance ?? 0,
  });
  const [err, setErr] = useState({});

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const validate = () => {
    const e = {};
    if (!form.name.trim())  e.name  = 'Name is required.';
    if (!form.phone.trim()) e.phone = 'Phone is required.';
    setErr(e);
    return Object.keys(e).length === 0;
  };

  const handleAdd = () => {
    if (!validate()) return;
    onAdd({
      id: parent?.id ?? ('par-' + Date.now()),
      name: form.name.trim(),
      phone: form.phone.trim(),
      email: form.email.trim(),
      relationship: form.relationship,
      children: form.children.split(',').map(c => c.trim()).filter(Boolean),
      status: form.status,
      balance: parseInt(form.balance, 10) || 0,
      lastContact: parent?.lastContact ?? new Date().toISOString().slice(0, 10),
    });
  };

  const inputCls = (e) => `w-full px-3 py-2.5 rounded-xl border text-sm outline-none transition-all focus:ring-2 focus:ring-[#1E45FC]/20 ${e ? 'border-red-400 bg-red-50' : 'border-gray-200 bg-white focus:border-[#1E45FC]'}`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(11,15,42,0.55)', backdropFilter: 'blur(4px)' }}
      onClick={onClose}>
      <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl max-h-[90vh] flex flex-col" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-4 border-b flex-shrink-0" style={{ borderColor: 'var(--border)' }}>
          <h3 className="font-bold text-base" style={{ color: 'var(--text)' }}>{isEdit ? 'Edit Parent / Guardian' : 'Add Parent / Guardian'}</h3>
          <button onClick={onClose} className="w-8 h-8 rounded-lg flex items-center justify-center text-gray-400 hover:bg-gray-100">✕</button>
        </div>
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <label className="block text-xs font-semibold text-gray-600 mb-1.5">Full Name <span className="text-red-400">*</span></label>
              <input value={form.name} onChange={e => { set('name', e.target.value); setErr(x => ({ ...x, name: undefined })); }}
                placeholder="e.g. Nakato Grace" className={inputCls(err.name)} />
              {err.name && <p className="text-[11px] text-red-500 mt-1">{err.name}</p>}
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1.5">Phone <span className="text-red-400">*</span></label>
              <input value={form.phone} onChange={e => { set('phone', e.target.value); setErr(x => ({ ...x, phone: undefined })); }}
                placeholder="+256 700 000 000" className={inputCls(err.phone)} />
              {err.phone && <p className="text-[11px] text-red-500 mt-1">{err.phone}</p>}
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1.5">Relationship</label>
              <select value={form.relationship} onChange={e => set('relationship', e.target.value)}
                className="w-full px-3 py-2.5 rounded-xl border text-sm bg-white outline-none" style={{ borderColor: 'var(--border-strong)' }}>
                {['Parent','Mother','Father','Guardian','Uncle','Aunt','Other'].map(r => <option key={r}>{r}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1.5">Email Address</label>
            <input type="email" value={form.email} onChange={e => set('email', e.target.value)}
              placeholder="email@example.com" className={inputCls()} />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1.5">Children (comma-separated names)</label>
            <input value={form.children} onChange={e => set('children', e.target.value)}
              placeholder="e.g. Aisha Nakato, David Nakato" className={inputCls()} />
          </div>
        </div>
        <div className="flex gap-3 px-6 py-4 border-t flex-shrink-0" style={{ borderColor: 'var(--border)' }}>
          <button onClick={onClose} className="flex-1 py-2.5 rounded-xl border text-sm font-semibold text-gray-600 hover:bg-gray-50" style={{ borderColor: 'var(--border-strong)' }}>Cancel</button>
          <button onClick={handleAdd} className="flex-1 py-2.5 rounded-xl text-sm font-bold text-white" style={{ background: '#1E45FC' }}>{isEdit ? 'Save Changes' : 'Add Parent'}</button>
        </div>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════
   TEACHERS
═══════════════════════════════════════════════════ */
const ALL_CLASSES_LIST = [
  'P.1','P.2','P.3','P.4','P.5','P.6','P.7',
  'S.1 East','S.1 West','S.2 East','S.2 West',
  'S.3 East','S.3 West','S.4 East','S.4 West',
  'S.5 Arts','S.5 Science','S.6 Arts','S.6 Science',
];
const ALL_SUBJECTS_LIST = ['Mathematics','English','Biology','History','Chemistry','Physics','Literature','Geography','CRE','Fine Art','Agriculture','Computer'];
const SCHEDULE_DAYS = ['Mon','Tue','Wed','Thu','Fri'];
const SCHEDULE_PERIODS = ['7:30–8:30','8:30–9:30','9:30–10:30','11:00–12:00','12:00–13:00','14:00–15:00','15:00–16:00'];

function TeachersPage({ roleId, schoolId }) {
  const [teachers, setTeachers] = useState(() => queryTeachers(schoolId));
  const [scheduleModal, setScheduleModal] = useState(null); // teacher object
  const [assignModal,   setAssignModal]   = useState(null); // teacher object
  const [addTeacher,    setAddTeacher]    = useState(false);
  const { toasts, show: toast } = useToast();

  return (
    <div className="animate-fade-in space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-extrabold" style={{ color: 'var(--text)' }}>Teachers</h2>
          <p className="text-xs text-gray-400 mt-0.5">{teachers.length} staff · {schoolId}</p>
        </div>
        {can(roleId, 'teachers.create') && <button onClick={() => setAddTeacher(true)} className="btn-brand-primary text-sm py-2 px-4">+ Add Teacher</button>}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {teachers.map((t, i) => (
          <Card key={i} className="p-5 hover:shadow-md transition-all">
            <div className="flex items-start gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center font-bold text-sm flex-shrink-0" style={{ background: 'var(--tint-blue)', color: 'var(--accent)' }}>
                {t.name.split(' ').map(w=>w[0]).join('').slice(0,2)}
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-bold text-sm" style={{ color: 'var(--text)' }}>{t.name}</div>
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
                <button
                  onClick={() => setScheduleModal(t)}
                  className="flex-1 py-2 rounded-xl border text-xs font-semibold text-gray-600 hover:bg-[#f5f7ff] hover:border-[#1E45FC] hover:text-[#1E45FC] transition-colors"
                  style={{ borderColor: 'var(--border-strong)' }}>
                  Schedule
                </button>
                <button
                  onClick={() => setAssignModal(t)}
                  className="flex-1 py-2 rounded-xl text-xs font-bold text-white transition-opacity hover:opacity-90"
                  style={{ background: '#1E45FC' }}>
                  Assign Class
                </button>
              </div>
            )}
          </Card>
        ))}
      </div>

      {/* Schedule Modal */}
      {scheduleModal && (
        <TeacherScheduleModal
          teacher={scheduleModal}
          onClose={() => setScheduleModal(null)}
          onSave={(updated) => {
            setTeachers(ts => ts.map(t => t.id === updated.id ? updated : t));
            setScheduleModal(null);
          }}
        />
      )}

      {/* Assign Class Modal */}
      {assignModal && (
        <AssignClassModal
          teacher={assignModal}
          onClose={() => setAssignModal(null)}
          onSave={(updated) => {
            setTeachers(ts => ts.map(t => t.id === updated.id ? updated : t));
            setAssignModal(null);
            toast('Class assignment saved');
          }}
        />
      )}

      {/* Add Teacher Modal */}
      {addTeacher && (
        <AddTeacherModal
          onClose={() => setAddTeacher(false)}
          onAdd={(t) => { setTeachers(ts => [...ts, t]); setAddTeacher(false); toast('Teacher added successfully'); }}
        />
      )}
      <Toast toasts={toasts} />
    </div>
  );
}

/* ── Add Teacher Modal ───────────────────────────────────── */
function AddTeacherModal({ onClose, onAdd }) {
  const [form, setForm] = useState({ name: '', subject: '', class: '', phone: '', email: '', status: 'Present' });
  const [err, setErr] = useState({});
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const handleAdd = () => {
    const e = {};
    if (!form.name.trim())    e.name    = 'Name is required.';
    if (!form.subject)        e.subject = 'Select a subject.';
    setErr(e);
    if (Object.keys(e).length) return;
    onAdd({ id: 't-' + Date.now(), ...form, schedule: 'Mon, Wed, Fri' });
  };

  const inputCls = (hasErr) => `w-full px-3 py-2.5 rounded-xl border text-sm outline-none transition-all focus:ring-2 focus:ring-[#1E45FC]/20 ${hasErr ? 'border-red-400 bg-red-50' : 'border-gray-200 focus:border-[#1E45FC]'}`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(11,15,42,0.55)', backdropFilter: 'blur(4px)' }}
      onClick={onClose}>
      <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-4 border-b" style={{ borderColor: 'var(--border)' }}>
          <h3 className="font-bold text-base" style={{ color: 'var(--text)' }}>Add New Teacher</h3>
          <button onClick={onClose} className="w-8 h-8 rounded-lg flex items-center justify-center text-gray-400 hover:bg-gray-100">✕</button>
        </div>
        <div className="p-6 space-y-4">
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1.5">Full Name <span className="text-red-400">*</span></label>
            <input value={form.name} onChange={e => { set('name', e.target.value); setErr(x => ({ ...x, name: undefined })); }}
              placeholder="e.g. Grace Namutebi" className={inputCls(err.name)} />
            {err.name && <p className="text-[11px] text-red-500 mt-1">{err.name}</p>}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1.5">Main Subject <span className="text-red-400">*</span></label>
              <select value={form.subject} onChange={e => { set('subject', e.target.value); setErr(x => ({ ...x, subject: undefined })); }}
                className={inputCls(err.subject).replace('focus:ring-2 focus:ring-[#1E45FC]/20', 'bg-white appearance-none')}>
                <option value="">— Select —</option>
                {ALL_SUBJECTS_LIST.map(s => <option key={s}>{s}</option>)}
              </select>
              {err.subject && <p className="text-[11px] text-red-500 mt-1">{err.subject}</p>}
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1.5">Primary Class</label>
              <select value={form.class} onChange={e => set('class', e.target.value)}
                className="w-full px-3 py-2.5 rounded-xl border text-sm bg-white outline-none appearance-none" style={{ borderColor: 'var(--border-strong)' }}>
                <option value="">— Select —</option>
                {ALL_CLASSES_LIST.map(c => <option key={c}>{c}</option>)}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1.5">Phone</label>
              <input value={form.phone} onChange={e => set('phone', e.target.value)} placeholder="+256 700 000 000" className={inputCls()} />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1.5">Email</label>
              <input type="email" value={form.email} onChange={e => set('email', e.target.value)} placeholder="teacher@school.ac.ug" className={inputCls()} />
            </div>
          </div>
        </div>
        <div className="flex gap-3 px-6 pb-6">
          <button onClick={onClose} className="flex-1 py-2.5 rounded-xl border text-sm font-semibold text-gray-600 hover:bg-gray-50" style={{ borderColor: 'var(--border-strong)' }}>Cancel</button>
          <button onClick={handleAdd} className="flex-1 py-2.5 rounded-xl text-sm font-bold text-white" style={{ background: '#1E45FC' }}>Add Teacher</button>
        </div>
      </div>
    </div>
  );
}

/* ── Teacher Schedule Modal ─────────────────────────────── */
function TeacherScheduleModal({ teacher, onClose, onSave }) {
  // Build initial grid: day → period → { subject, room }
  const makeGrid = () => {
    const g = {};
    SCHEDULE_DAYS.forEach(d => {
      g[d] = {};
      SCHEDULE_PERIODS.forEach(p => { g[d][p] = { subject: '', room: '' }; });
    });
    // Pre-fill a few slots based on teacher's schedule string
    const days = teacher.schedule?.split(', ') ?? [];
    days.forEach(d => {
      const short = d.slice(0,3);
      if (g[short]) {
        g[short]['7:30–8:30']   = { subject: teacher.subject, room: 'LB-01' };
        g[short]['9:30–10:30']  = { subject: teacher.subject, room: 'LB-02' };
        g[short]['14:00–15:00'] = { subject: teacher.subject, room: 'LB-03' };
      }
    });
    return g;
  };

  const [grid, setGrid] = useState(makeGrid);
  const [activeDay, setActiveDay] = useState(SCHEDULE_DAYS[0]);

  const setCell = (day, period, field, val) =>
    setGrid(g => ({ ...g, [day]: { ...g[day], [period]: { ...g[day][period], [field]: val } } }));

  const totalPeriods = Object.values(grid).flatMap(d => Object.values(d)).filter(c => c.subject).length;

  const handleSave = () => {
    // Build schedule string from active days
    const activeDays = SCHEDULE_DAYS.filter(d => Object.values(grid[d]).some(c => c.subject));
    onSave({ ...teacher, schedule: activeDays.join(', ') });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4"
      style={{ background: 'rgba(11,15,42,0.55)', backdropFilter: 'blur(4px)' }}
      onClick={onClose}>
      <div className="bg-white rounded-2xl w-full max-w-2xl shadow-2xl animate-slide-up max-h-[90vh] flex flex-col"
        onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b flex-shrink-0" style={{ borderColor: 'var(--border)' }}>
          <div>
            <h3 className="font-bold text-base" style={{ color: 'var(--text)' }}>Teaching Schedule — {teacher.name}</h3>
            <p className="text-xs text-gray-400 mt-0.5">{teacher.subject} · {totalPeriods} periods assigned</p>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-lg flex items-center justify-center text-gray-400 hover:bg-gray-100">✕</button>
        </div>

        {/* Day tabs */}
        <div className="flex gap-1 px-6 pt-4 flex-shrink-0">
          {SCHEDULE_DAYS.map(d => {
            const hasPeriods = Object.values(grid[d]).some(c => c.subject);
            return (
              <button key={d} onClick={() => setActiveDay(d)}
                className="flex-1 py-2 rounded-xl text-xs font-bold transition-all relative"
                style={activeDay === d
                  ? { background: '#1E45FC', color: 'white' }
                  : { background: 'var(--surface-2)', color: 'var(--text-muted)' }}>
                {d}
                {hasPeriods && (
                  <span className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full" style={{ background: '#22c55e', border: '1.5px solid white' }}/>
                )}
              </button>
            );
          })}
        </div>

        {/* Period grid */}
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-2">
          {SCHEDULE_PERIODS.map(period => {
            const cell = grid[activeDay][period];
            const hasSubject = !!cell.subject;
            return (
              <div key={period} className="rounded-xl border p-3 transition-all"
                style={{ borderColor: hasSubject ? '#c7d4fd' : 'var(--surface-3)', background: hasSubject ? '#f5f7ff' : '#fafafa' }}>
                <div className="flex items-center gap-3">
                  <div className="text-[10px] font-mono text-gray-400 w-20 flex-shrink-0">{period}</div>
                  <div className="flex-1 grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-[10px] text-gray-400 font-semibold block mb-1">Subject</label>
                      <select
                        value={cell.subject}
                        onChange={e => setCell(activeDay, period, 'subject', e.target.value)}
                        className="w-full px-2.5 py-1.5 rounded-lg border text-xs outline-none bg-white transition-all focus:border-[#1E45FC]"
                        style={{ borderColor: 'var(--border-strong)' }}>
                        <option value="">— Free —</option>
                        {ALL_SUBJECTS_LIST.map(s => <option key={s}>{s}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="text-[10px] text-gray-400 font-semibold block mb-1">Room</label>
                      <input
                        value={cell.room}
                        onChange={e => setCell(activeDay, period, 'room', e.target.value)}
                        placeholder="e.g. LB-01"
                        className="w-full px-2.5 py-1.5 rounded-lg border text-xs outline-none transition-all focus:border-[#1E45FC]"
                        style={{ borderColor: 'var(--border-strong)' }}/>
                    </div>
                  </div>
                  {hasSubject && (
                    <button onClick={() => setCell(activeDay, period, 'subject', '') }
                      className="w-6 h-6 rounded-lg flex items-center justify-center text-gray-300 hover:text-red-400 hover:bg-red-50 flex-shrink-0 transition-colors">✕</button>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Footer */}
        <div className="flex gap-3 px-6 py-4 border-t flex-shrink-0" style={{ borderColor: 'var(--border)' }}>
          <button onClick={onClose} className="flex-1 py-2.5 rounded-xl border text-sm font-semibold text-gray-600 hover:bg-gray-50" style={{ borderColor: 'var(--border-strong)' }}>Cancel</button>
          <button onClick={handleSave} className="flex-1 py-2.5 rounded-xl text-sm font-bold text-white" style={{ background: '#1E45FC' }}>Save Schedule</button>
        </div>
      </div>
    </div>
  );
}

/* ── Assign Class Modal ──────────────────────────────────── */
function AssignClassModal({ teacher, onClose, onSave }) {
  // Parse existing classes (comma/slash separated)
  const parseClasses = (str) =>
    str ? str.split(/[/,]/).map(s => s.trim()).filter(Boolean) : [];

  const [selectedClasses, setSelectedClasses] = useState(parseClasses(teacher.class));
  const [selectedSubject, setSelectedSubject] = useState(teacher.subject || '');
  const [note, setNote] = useState('');

  const toggle = (cls) =>
    setSelectedClasses(prev =>
      prev.includes(cls) ? prev.filter(c => c !== cls) : [...prev, cls]
    );

  const handleSave = () => {
    onSave({
      ...teacher,
      class:   selectedClasses.join(' / '),
      subject: selectedSubject,
    });
  };

  const grouped = {
    Primary:    ALL_CLASSES_LIST.filter(c => c.startsWith('P.')),
    'O-Level':  ALL_CLASSES_LIST.filter(c => /^S\.[1-4]/.test(c)),
    'A-Level':  ALL_CLASSES_LIST.filter(c => /^S\.[5-6]/.test(c)),
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4"
      style={{ background: 'rgba(11,15,42,0.55)', backdropFilter: 'blur(4px)' }}
      onClick={onClose}>
      <div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl animate-slide-up max-h-[90vh] flex flex-col"
        onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b flex-shrink-0" style={{ borderColor: 'var(--border)' }}>
          <div>
            <h3 className="font-bold text-base" style={{ color: 'var(--text)' }}>Assign Classes — {teacher.name}</h3>
            <p className="text-xs text-gray-400 mt-0.5">{selectedClasses.length} class{selectedClasses.length !== 1 ? 'es' : ''} selected</p>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-lg flex items-center justify-center text-gray-400 hover:bg-gray-100">✕</button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-5">
          {/* Subject */}
          <div>
            <label className="block text-xs font-bold text-gray-600 mb-2">Subject Taught</label>
            <div className="flex flex-wrap gap-2">
              {ALL_SUBJECTS_LIST.map(s => (
                <button key={s} onClick={() => setSelectedSubject(s)}
                  className="text-xs font-semibold px-3 py-1.5 rounded-xl border transition-all"
                  style={selectedSubject === s
                    ? { background: '#1E45FC', color: 'white', borderColor: '#1E45FC' }
                    : { background: 'var(--surface)', color: 'var(--text-muted)', borderColor: 'var(--border-strong)' }}>
                  {s}
                </button>
              ))}
            </div>
          </div>

          {/* Classes grouped */}
          {Object.entries(grouped).map(([group, classes]) => (
            <div key={group}>
              <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-2">{group}</p>
              <div className="flex flex-wrap gap-2">
                {classes.map(cls => {
                  const active = selectedClasses.includes(cls);
                  return (
                    <button key={cls} onClick={() => toggle(cls)}
                      className="text-xs font-semibold px-3 py-1.5 rounded-xl border transition-all"
                      style={active
                        ? { background: 'var(--tint-blue)', color: 'var(--accent)', borderColor: '#1E45FC' }
                        : { background: 'var(--surface)', color: 'var(--text-muted)', borderColor: 'var(--border-strong)' }}>
                      {active && <span className="mr-1">✓</span>}{cls}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}

          {/* Note */}
          <div>
            <label className="block text-xs font-bold text-gray-600 mb-1.5">Note (optional)</label>
            <textarea value={note} onChange={e => setNote(e.target.value)}
              rows={2} placeholder="e.g. Temporarily covering for absent teacher…"
              className="w-full px-3.5 py-2.5 rounded-xl border text-sm outline-none resize-none focus:border-[#1E45FC] transition-all"
              style={{ borderColor: 'var(--border-strong)' }}/>
          </div>

          {/* Summary chip */}
          {selectedClasses.length > 0 && (
            <div className="rounded-xl px-4 py-3 flex items-start gap-3" style={{ background: '#f5f7ff', border: '1px solid #c7d4fd' }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#1E45FC" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mt-0.5 flex-shrink-0">
                <path d="M22 10v6M2 10l10-5 10 5-10 5zM6 12v5c3 3 9 3 12 0v-5"/>
              </svg>
              <div className="text-xs" style={{ color: 'var(--accent)' }}>
                <strong>{teacher.name}</strong> will teach <strong>{selectedSubject || '—'}</strong> in:{' '}
                <span className="font-medium">{selectedClasses.join(', ')}</span>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex gap-3 px-6 py-4 border-t flex-shrink-0" style={{ borderColor: 'var(--border)' }}>
          <button onClick={onClose} className="flex-1 py-2.5 rounded-xl border text-sm font-semibold text-gray-600 hover:bg-gray-50" style={{ borderColor: 'var(--border-strong)' }}>Cancel</button>
          <button onClick={handleSave} className="flex-1 py-2.5 rounded-xl text-sm font-bold text-white" style={{ background: '#1E45FC' }}>Save Assignment</button>
        </div>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════
   ATTENDANCE
═══════════════════════════════════════════════════ */
function AttendancePage({ roleId, schoolId, currentUser }) {
  const isTeacher  = roleId === 'teacher';
  const isParent   = roleId === 'parent';
  const assignment = isTeacher ? getTeacherAssignment(currentUser?.user_id) : null;
  const children   = parentChildren(currentUser);
  // Role-scoped rows (teacher → assigned classes, parent → own children, read-only)
  const students = scopedStudents(schoolId, currentUser);
  const classes  = isTeacher && assignment
    ? assignment.classes
    : [...new Set(students.map(s => s.class))];
  const [selClass, setSel]   = useState(classes[0] ?? '');
  const [records, setRecords] = useState(students.map(s => ({ ...s, present: true })));
  const toggle = id => setRecords(r => r.map(s => s.id === id ? { ...s, present: !s.present } : s));
  const shown  = records.filter(s => !selClass || s.class === selClass);
  const pCount = shown.filter(s => s.present).length;
  const { toasts, show: toast } = useToast();

  const saveAttendance = () => {
    const absent = shown.filter(s => !s.present).length;
    toast(`Attendance saved · ${pCount} present, ${absent} absent`);
  };

  return (
    <div className="animate-fade-in space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-extrabold" style={{ color: 'var(--text)' }}>
            {isParent ? "My Child's Attendance" : 'Attendance'}
          </h2>
          <p className="text-xs text-gray-400 mt-0.5">Today · {new Date().toLocaleDateString('en-UG', { weekday:'long', month:'long', day:'numeric', year:'numeric' })}</p>
        </div>
        {can(roleId, 'attendance.mark') && <button onClick={saveAttendance} className="btn-brand-primary text-sm py-2 px-4">Save Attendance</button>}
      </div>

      {isParent && (
        <div className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-medium" style={{ background: 'var(--tint-amber)', color: 'var(--warn)', border: '1px solid #fde68a' }}>
          <span>👨‍👩‍👧</span>
          Showing attendance for your children only: <strong className="ml-1">{children.join(', ')}</strong>
        </div>
      )}

      {isTeacher && assignment && (
        <div className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-medium" style={{ background: 'var(--tint-sky)', color: 'var(--info)', border: '1px solid #bae6fd' }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
          Marking attendance for your assigned classes: <strong className="ml-1">{assignment.classes.join(', ')}</strong>
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        {classes.map(c => (
          <button key={c} onClick={() => setSel(c)}
            className="text-xs font-semibold px-3 py-1.5 rounded-lg border transition-colors"
            style={selClass === c ? { borderColor: '#1E45FC', background: 'var(--tint-blue)', color: 'var(--accent)' } : { borderColor: 'var(--border-strong)', color: 'var(--text-muted)' }}>
            {c}
          </button>
        ))}
      </div>

      <Card className="p-4">
        <div className="flex items-center gap-4">
          <div className="flex-1 h-2.5 rounded-full bg-gray-100 overflow-hidden">
            <div className="h-full rounded-full" style={{ width: shown.length ? `${(pCount/shown.length)*100}%` : '0%', background: 'linear-gradient(90deg, #1E45FC, #A3CF2E)' }}/>
          </div>
          <span className="text-sm font-extrabold" style={{ color: 'var(--text)' }}>
            {pCount}/{shown.length} present {shown.length ? `(${Math.round((pCount/shown.length)*100)}%)` : ''}
          </span>
        </div>
      </Card>

      <Card className="overflow-hidden">
        {shown.map(s => (
          <div key={s.id} className="flex items-center gap-3 px-4 py-3 border-b last:border-0 hover:bg-gray-50/50" style={{ borderColor: 'var(--border-subtle)' }}>
            <div className="flex items-center gap-2.5 flex-1 min-w-0">
              <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0"
                style={{ background: s.present ? 'var(--tint-blue)' : 'var(--tint-red)', color: s.present ? 'var(--accent)' : '#dc2626' }}>
                {s.name.split(' ').map(w=>w[0]).join('').slice(0,2)}
              </div>
              <span className="text-sm font-semibold truncate" style={{ color: 'var(--text)' }}>{s.name}</span>
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
      <Toast toasts={toasts} />
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

/* Deterministic pseudo-random generator — the timetable is stable across reloads */
function mulberry32(seed) {
  return function () {
    let t = (seed += 0x6D2B79F5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const GRID = (() => {
  const rng = mulberry32(20260501); // Term 2 2026 seed
  return DAYS.reduce((a, d) => {
    a[d] = PERIODS.map(p => ({
      label: p === 'Break' ? 'Break' : p === 'Lunch' ? 'Lunch' : SUBJ[Math.floor(rng() * SUBJ.length)],
    }));
    return a;
  }, {});
})();

/* Cell colouring — derived from the label so edited cells stay consistent */
const cellStyle = (label) => {
  if (label === 'Break') return { bg: 'var(--surface-2)', text: 'var(--text-dim)' };
  if (label === 'Lunch') return { bg: 'var(--tint-amber)', text: '#d97706' };
  if (label === 'Free')  return { bg: 'var(--surface-3)', text: 'var(--text-dim)' };
  const c = SCOL[label] || 'var(--text-dim)';
  return { bg: c + '20', text: c };
};

function TimetablePage({ roleId, currentUser }) {
  const [tab, setTab] = useState('school');
  const [editMode, setEditMode] = useState(false);
  const [grid, setGrid] = useState(GRID);
  const { toasts, show: toast } = useToast();
  const canEdit = can(roleId, 'timetable.edit');
  const isTeacher = roleId === 'teacher';
  const assignment = isTeacher ? getTeacherAssignment(currentUser?.user_id) : null;
  const teacherSubjects = assignment?.subjects ?? [];

  const setCell = (d, pi, label) =>
    setGrid(g => ({ ...g, [d]: g[d].map((c, i) => (i === pi ? { ...c, label } : c)) }));

  return (
    <div className="animate-fade-in space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-extrabold" style={{ color: 'var(--text)' }}>Timetables</h2>
          <p className="text-xs text-gray-400 mt-0.5">Term 2 · 2026</p>
        </div>
        {canEdit && (
          <button
            onClick={() => { setEditMode(m => !m); if (editMode) toast('Timetable saved'); }}
            className={`text-sm py-2 px-4 rounded-xl font-bold ${editMode ? 'btn-brand-secondary' : 'btn-brand-primary'}`}>
            {editMode ? 'Done Editing' : 'Edit Timetable'}
          </button>
        )}
      </div>
      <div className="flex gap-2">
        {['school','teacher','prep','meals'].map(t => (
          <button key={t} onClick={() => setTab(t)}
            className="text-xs font-semibold px-3 py-1.5 rounded-lg border capitalize transition-colors"
            style={tab === t ? { borderColor: '#1E45FC', background: 'var(--tint-blue)', color: 'var(--accent)' } : { borderColor: 'var(--border-strong)', color: 'var(--text-muted)' }}>
            {t === 'school' ? 'School' : t === 'teacher' ? 'Teacher' : t === 'prep' ? 'Prep' : 'Meals'}
          </button>
        ))}
      </div>
      {tab === 'meals' ? <MealsSchedule /> : (
        <Card className="overflow-x-auto">
          <table className="w-full min-w-[700px]">
            <thead>
              <tr style={{ background: 'var(--surface-2)', borderBottom: '1px solid var(--border)' }}>
                <th className="text-left px-4 py-3 text-xs font-bold text-gray-400 w-32">Time</th>
                {DAYS.map(d => <th key={d} className="text-center px-3 py-3 text-xs font-bold text-gray-400">{d}</th>)}
              </tr>
            </thead>
            <tbody>
              {PERIODS.map((p, pi) => (
                <tr key={p} className="border-b last:border-0" style={{ borderColor: 'var(--border-subtle)' }}>
                  <td className="px-4 py-2.5 text-xs text-gray-400 font-medium whitespace-nowrap">{p}</td>
                  {DAYS.map(d => {
                    const cell = grid[d][pi];
                    const isBreakOrLunch = ['Break', 'Lunch'].includes(cell.label);
                    // In "My Timetable" a teacher only sees their own subjects
                    const notMine = tab === 'teacher' && teacherSubjects.length > 0
                      && !isBreakOrLunch && !teacherSubjects.includes(cell.label);
                    const { bg, text } = cellStyle(cell.label);
                    return (
                      <td key={d} className="px-2 py-2 text-center">
                        {editMode && canEdit ? (
                          <select
                            value={cell.label}
                            onChange={e => setCell(d, pi, e.target.value)}
                            className="text-xs px-1 py-1 rounded-lg border bg-white outline-none"
                            style={{ borderColor: 'var(--border-strong)' }}>
                            {['Free', 'Break', 'Lunch', ...SUBJ].map(s => <option key={s} value={s}>{s}</option>)}
                          </select>
                        ) : notMine ? (
                          <span className="inline-block px-2 py-1 text-xs text-gray-200">—</span>
                        ) : (
                          <span className="inline-block px-2 py-1 rounded-lg text-xs font-semibold whitespace-nowrap"
                            style={{ background: bg, color: text }}>{cell.label}</span>
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
      <Toast toasts={toasts} />
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
        <div key={i} className="flex items-center gap-4 px-5 py-4 border-b last:border-0 hover:bg-gray-50/50" style={{ borderColor: 'var(--border-subtle)' }}>
          <div className="w-20 text-xs font-bold flex-shrink-0" style={{ color: 'var(--accent)' }}>{m.time}</div>
          <span className="text-xl">🍽️</span>
          <div className="flex-1 min-w-0">
            <div className="text-sm font-semibold" style={{ color: 'var(--text)' }}>{m.meal}</div>
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

/* ── Tiny CSV download helper (used by marks import & invoice export) ── */
function downloadCSV(filename, content) {
  // BOM so Excel detects UTF-8; content is already formula-neutralised by lib/csv
  const blob = new Blob([CSV_BOM + content], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function ResultsPage({ roleId, schoolId, currentUser }) {
  const isTeacher  = roleId === 'teacher';
  const isParent   = roleId === 'parent';
  const assignment = isTeacher ? getTeacherAssignment(currentUser?.user_id) : null;
  const children   = parentChildren(currentUser);
  // Teacher: only see and enter marks for assigned subjects in assigned classes
  const activeSubjects = isTeacher && assignment
    ? SUBJ_LIST.filter(s => assignment.subjects.includes(s))
    : SUBJ_LIST;
  const scoped = scopedStudents(schoolId, currentUser);
  const baseStudents = isTeacher ? scoped.slice(0, 10)
    : isParent ? scoped
    : scoped.slice(0, 5);

  const [marks, setMarks] = useState(
    baseStudents.map(s => ({ ...s, scores: activeSubjects.reduce((a, sub) => ({ ...a, [sub]: Math.floor(Math.random()*40+55) }), {}) }))
  );
  const total = sc => Object.values(sc).reduce((a,b)=>a+b,0);
  const avg   = sc => Math.round(total(sc)/activeSubjects.length);
  const grade = a  => a>=80?'D1':a>=70?'D2':a>=65?'C3':a>=60?'C4':a>=55?'C5':a>=50?'C6':'F9';
  const gcol  = a  => a>=70?'#059669':a>=55?'#d97706':'#dc2626';
  const canEdit = can(roleId, 'results.enter');
  const canApproveResults = can(roleId, 'results.approve');
  const { toasts, show: toast } = useToast();
  const [importModal, setImportModal] = useState(false);
  const [importData, setImportData] = useState(null); // { rows: [{ name, scores }] }
  const [approved, setApproved] = useState(false);
  const fileRef = useRef(null);

  // Saving (or importing) marks sends the set back for approval
  const saveResults = () => { setApproved(false); toast(`Results saved for ${marks.length} students — pending approval`); };

  /* ── CSV import: download template ── */
  const downloadTemplate = () => {
    const rows = [
      ['Student Name', ...activeSubjects],
      ...baseStudents.map(s => [s.name, ...activeSubjects.map(() => '')]),
    ];
    downloadCSV('marks-template.csv', csvText(rows));
    toast('Template downloaded');
    setImportModal(false);
  };

  /* ── CSV import: parse the selected file ── */
  const handleFile = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const text = String(reader.result || '');
      const lines = text.replace(/^\ufeff/, '').split(/\r?\n/).filter(l => l.trim());
      if (lines.length < 2) { toast('CSV must have a header row plus data rows', 'error'); return; }
      const headers = parseCsvLine(lines[0]);
      const nameIdx = headers.findIndex(h => /student|name/i.test(h));
      if (nameIdx < 0) { toast('CSV must contain a "Student Name" column', 'error'); return; }
      const rows = lines.slice(1).map(line => {
        const cols = parseCsvLine(line).map(unguard);
        const scores = {};
        activeSubjects.forEach(sub => {
          const idx = headers.findIndex(h => h === sub);
          const val = idx >= 0 ? parseInt(cols[idx], 10) : NaN;
          if (!Number.isNaN(val) && val >= 0 && val <= 100) scores[sub] = val;
        });
        return { name: cols[nameIdx], scores };
      }).filter(r => r.name);
      setImportData({ rows });
      toast(`Parsed ${rows.length} rows from ${file.name}`);
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  /* ── CSV import: apply parsed marks to matching students ── */
  const applyImport = () => {
    if (!importData) return;
    let applied = 0;
    setMarks(prev => prev.map(st => {
      const match = importData.rows.find(r => r.name.toLowerCase() === st.name.toLowerCase());
      if (match && Object.keys(match.scores).length) {
        applied++;
        return { ...st, scores: { ...st.scores, ...match.scores } };
      }
      return st;
    }));
    setImportModal(false);
    setImportData(null);
    setApproved(false);
    toast(`Imported marks for ${applied} student${applied !== 1 ? 's' : ''} — pending approval`);
  };

  return (
    <div className="animate-fade-in space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-extrabold" style={{ color: 'var(--text)' }}>
            {isParent ? "My Child's Results" : 'Academic Results'}
          </h2>
          <p className="text-xs text-gray-400 mt-0.5">
            {isParent
              ? `Viewing results for: ${children.join(', ')}`
              : isTeacher && assignment
                ? `${assignment.subjects.join(', ')} · ${assignment.classes.join(', ')}`
                : `S.3 East · Term 2 Exams · ${schoolId}`}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs font-bold px-2.5 py-1 rounded-full"
            style={approved ? { background: 'var(--tint-green)', color: 'var(--ok)' } : { background: 'var(--tint-amber)', color: 'var(--warn)' }}>
            {approved ? 'Approved' : 'Pending approval'}
          </span>
          {canEdit && (
            <>
              <button onClick={() => setImportModal(true)} className="btn-brand-secondary text-sm py-2 px-4">Import Marks</button>
              <button onClick={saveResults} className="btn-brand-primary text-sm py-2 px-4">Save Results</button>
            </>
          )}
          {canApproveResults && !approved && (
            <button onClick={() => { setApproved(true); recordAudit({ action: AUDIT_ACTIONS.RESULTS_APPROVED, target: schoolId, detail: `${marks.length} students`, severity: AUDIT_SEVERITY.NOTICE }); toast('Results approved'); }}
              className="text-sm py-2 px-4 rounded-xl font-bold text-white" style={{ background: '#059669' }}>
              Approve Results
            </button>
          )}
        </div>
      </div>
      {isParent && (
        <div className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-medium" style={{ background: 'var(--tint-amber)', color: 'var(--warn)', border: '1px solid #fde68a' }}>
          <span>👨‍👩‍👧</span>
          Showing results for your children only: <strong className="ml-1">{children.join(', ')}</strong>
        </div>
      )}
      {isTeacher && assignment && (
        <div className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-medium" style={{ background: 'var(--tint-sky)', color: 'var(--info)', border: '1px solid #bae6fd' }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
          You can only enter marks for <strong className="mx-1">{assignment.subjects.join(', ')}</strong> across your assigned classes.
        </div>
      )}
      <Card className="overflow-x-auto">
        <table className="w-full min-w-[700px]">
          <thead>
            <tr style={{ background: 'var(--surface-2)', borderBottom: '1px solid var(--border)' }}>
              <th className="text-left px-4 py-3 text-xs font-bold text-gray-400">Student</th>
              {isTeacher && <th className="text-left px-3 py-3 text-xs font-bold text-gray-400">Class</th>}
              {activeSubjects.map(s => <th key={s} className="text-center px-3 py-3 text-xs font-bold text-gray-400">{s}</th>)}
              <th className="text-center px-3 py-3 text-xs font-bold text-gray-400">Avg</th>
              <th className="text-center px-3 py-3 text-xs font-bold text-gray-400">Grade</th>
            </tr>
          </thead>
          <tbody className="divide-y" style={{ borderColor: 'var(--border-subtle)' }}>
            {marks.map(s => {
              const a = avg(s.scores);
              return (
                <tr key={s.id} className="hover:bg-gray-50/50">
                  <td className="px-4 py-3 text-sm font-semibold" style={{ color: 'var(--text)' }}>{s.name}</td>
                  {isTeacher && <td className="px-3 py-3 text-xs text-gray-400">{s.class}</td>}
                  {activeSubjects.map(sub => (
                    <td key={sub} className="px-2 py-2 text-center">
                      {canEdit ? (
                        <input type="number" min="0" max="100" value={s.scores[sub]}
                          onChange={e => setMarks(prev => prev.map(st => st.id===s.id ? {...st, scores:{...st.scores,[sub]:+e.target.value}} : st))}
                          className="w-14 text-center text-sm py-1 rounded-lg border outline-none transition-all" style={{ borderColor: 'var(--border-strong)' }}/>
                      ) : (
                        <span className="text-sm">{s.scores[sub]}</span>
                      )}
                    </td>
                  ))}
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

      {/* IMPORT MARKS MODAL */}
      {importModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: 'rgba(11,15,42,0.55)', backdropFilter: 'blur(4px)' }}
          onClick={() => setImportModal(false)}>
          <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-6 py-4 border-b" style={{ borderColor: 'var(--border)' }}>
              <h3 className="font-bold text-base" style={{ color: 'var(--text)' }}>Import Marks</h3>
              <button onClick={() => setImportModal(false)} className="w-8 h-8 rounded-lg flex items-center justify-center text-gray-400 hover:bg-gray-100">✕</button>
            </div>
            <div className="p-6 space-y-4">
              <input
                ref={fileRef}
                type="file"
                accept=".csv,text/csv"
                className="hidden"
                onChange={handleFile}
              />
              <div
                onClick={() => fileRef.current?.click()}
                className="rounded-xl border-2 border-dashed flex flex-col items-center justify-center py-10 gap-3 cursor-pointer hover:border-[#1E45FC] hover:bg-[#f5f7ff] transition-colors"
                style={{ borderColor: importData ? '#1E45FC' : 'var(--border-strong)' }}>
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke={importData ? '#1E45FC' : 'var(--text-dim)'} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M17 8l-5-5-5 5M12 3v12"/></svg>
                {importData ? (
                  <div className="text-sm font-semibold text-[#1E45FC]">
                    {importData.rows.length} rows ready to import
                  </div>
                ) : (
                  <>
                    <div className="text-sm font-semibold text-gray-500">Click to upload a CSV file</div>
                    <div className="text-xs text-gray-400">Columns: Student Name, {activeSubjects.join(', ')}</div>
                  </>
                )}
              </div>
              <a href="#" className="block text-center text-xs font-semibold text-[#1E45FC] hover:underline"
                onClick={e => { e.preventDefault(); downloadTemplate(); }}>
                Download import template →
              </a>
            </div>
            <div className="flex gap-3 px-6 pb-6">
              <button onClick={() => setImportModal(false)} className="flex-1 py-2.5 rounded-xl border text-sm font-semibold text-gray-600 hover:bg-gray-50" style={{ borderColor: 'var(--border-strong)' }}>Cancel</button>
              <button onClick={applyImport} disabled={!importData}
                className="flex-1 py-2.5 rounded-xl text-sm font-bold text-white transition-opacity disabled:opacity-50"
                style={{ background: '#1E45FC' }}>Import</button>
            </div>
          </div>
        </div>
      )}
      <Toast toasts={toasts} />
    </div>
  );
}

/* ══════════════════════════════════════════════════
   FINANCE
═══════════════════════════════════════════════════ */
function FinancePage({ roleId, schoolId, tenant, currentUser }) {
  const basePayments = queryPayments(schoolId);
  const students     = queryStudents(schoolId);
  const canRecord    = can(roleId,'finance.record');
  const canApprove   = can(roleId,'finance.approve');
  const canPayroll   = can(roleId,'finance.payroll');
  const isParent     = roleId === 'parent';
  const children     = isParent ? parentChildren(currentUser) : [];

  /* ── Tab state ── */
  const [tab, setTab] = useState(roleId === 'head_teacher' ? 'approvals' : 'fees'); // fees | expenses | payroll | approvals

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

  /* ── Payslip modal ── */
  const [payslip, setPayslip] = useState(null);

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
    ...(canPayroll ? [{ id:'payroll',   label:'Payroll',   badge: null }] : []),
    ...(canApprove ? [{ id:'approvals', label:'Approvals', badge: pendingApprovals.length||null }] : []),
  ];

  const methodColors = { 'Mobile Money':'#1E45FC', 'Cash':'#059669', 'Cheque':'#7c3aed', 'Bank Transfer':'#0891b2', 'Online':'#d97706' };
  const methodBg     = { 'Mobile Money':'var(--tint-blue)', 'Cash':'var(--tint-green)',  'Cheque':'var(--tint-violet)', 'Bank Transfer':'var(--tint-sky)', 'Online':'var(--tint-amber)' };
  const expStatusColor = { Approved:'#059669', Pending:'#d97706', Rejected:'#dc2626' };
  const expStatusBg    = { Approved:'var(--tint-green)',  Pending:'var(--tint-amber)',  Rejected:'var(--tint-red)' };

  /* ── Parent view: their children's fee balance only (read-only) ── */
  if (isParent) {
    const myStudents = students.filter(s => children.includes(s.name));
    return (
      <div className="animate-fade-in space-y-5">
        <div>
          <h2 className="text-lg font-extrabold" style={{ color:'var(--text)' }}>Fee Balance</h2>
          <p className="text-xs text-gray-400 mt-0.5">{currentUser.name} · {tenant?.name ?? schoolId}</p>
        </div>
        {myStudents.length === 0 && (
          <Card className="p-10 text-center">
            <div className="text-3xl mb-2">👶</div>
            <p className="text-sm font-semibold text-gray-500">No children linked to your account yet.</p>
          </Card>
        )}
        {myStudents.map(s => {
          const childPay = payments.filter(p => p.student === s.name);
          const paid = childPay.filter(p => p.status === 'Confirmed').reduce((sum, p) => sum + (parseInt(String(p.amount).replace(/,/g, ''), 10) || 0), 0);
          const feeTarget = 450000; // mock term fee
          const balance = Math.max(0, feeTarget - paid);
          return (
            <Card key={s.id} className="p-5">
              <div className="flex items-center justify-between flex-wrap gap-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0" style={{ background: '#1E45FC' }}>
                    {s.name.split(' ').map(w => w[0]).join('').slice(0, 2)}
                  </div>
                  <div>
                    <div className="text-sm font-bold" style={{ color:'var(--text)' }}>{s.name}</div>
                    <div className="text-xs text-gray-400">{s.class}</div>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-xs text-gray-400">Outstanding Balance</div>
                  <div className="text-xl font-extrabold" style={{ color: balance > 0 ? 'var(--danger)' : '#059669' }}>
                    UGX {balance.toLocaleString()}
                  </div>
                </div>
              </div>
              {childPay.length > 0 && (
                <div className="mt-4">
                  <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Payments</p>
                  <div className="space-y-1.5">
                    {childPay.map((p, i) => (
                      <div key={i} className="flex items-center justify-between text-xs px-3 py-2 rounded-lg" style={{ background: 'var(--surface-2)', border: '1px solid var(--border)' }}>
                        <span className="font-semibold" style={{ color: 'var(--text)' }}>UGX {p.amount}</span>
                        <span className="text-gray-400">{p.method} · {p.date}</span>
                        <span className="font-bold" style={{ color: p.status === 'Confirmed' ? 'var(--ok)' : '#d97706' }}>{p.status}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </Card>
          );
        })}
      </div>
    );
  }

  return (
    <div className="animate-fade-in space-y-5">

      {/* ── Header ── */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-lg font-extrabold" style={{ color:'var(--text)' }}>Finance</h2>
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
          { label:'Total Fees Collected', value:`UGX ${(totalFees/1000000).toFixed(2)}M`,       delta:'+18%', color:'var(--ok)', bg:'var(--tint-green)', path:'M12 1v22M17 5H9.5a3.5 3.5 0 100 7h5a3.5 3.5 0 110 7H6' },
          { label:'Pending Payments',      value:`${pending.length} payments`,                   delta:`UGX ${pending.length*225}K`, color:'var(--warn)', bg:'var(--tint-amber)', path:'M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z' },
          { label:'Total Expenses',        value:`UGX ${(totalExp/1000000).toFixed(2)}M`,         delta:'This term', color:'var(--danger)', bg:'var(--tint-red)', path:'M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3' },
          { label:'Payroll (Monthly)',     value:`UGX ${(totalPayroll/1000000).toFixed(2)}M`,      delta:'7 staff', color:'var(--violet)', bg:'var(--tint-violet)', path:'M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2M9 7a4 4 0 100 8 4 4 0 000-8z' },
        ].map(m=>(
          <Card key={m.label} className="p-4">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs text-gray-400 mb-1">{m.label}</p>
                <p className="text-lg font-extrabold" style={{ color:'var(--text)' }}>{m.value}</p>
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
      <div className="flex items-center gap-1 p-1 rounded-xl" style={{ background:'var(--app-bg)' }}>
        {TABS.map(t=>(
          <button key={t.id} onClick={()=>setTab(t.id)}
            className="flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-xs font-bold transition-all"
            style={tab===t.id?{ background:'var(--surface)', color:'var(--accent)', boxShadow:'0 1px 4px rgba(0,0,0,0.08)' }:{ color:'var(--text-muted)' }}>
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
            <div className="flex items-center gap-2 px-3.5 py-2 rounded-xl border bg-white text-sm" style={{ borderColor:'var(--border-strong)' }}>
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="#94a3b8" strokeWidth="1.5"><circle cx="6" cy="6" r="4.5"/><path d="M10 10L13 13"/></svg>
              <input value={paySearch} onChange={e=>setPaySearch(e.target.value)} placeholder="Student or Tx ID…" className="outline-none bg-transparent text-sm w-36"/>
            </div>
            <select value={payMethod} onChange={e=>setPayMethod(e.target.value)} className="px-3 py-2 rounded-xl border text-xs font-semibold bg-white outline-none" style={{ borderColor:'var(--border-strong)', color:'var(--text)' }}>
              <option value="all">All Methods</option>
              {['Mobile Money','Cash','Cheque','Bank Transfer','Online'].map(m=><option key={m}>{m}</option>)}
            </select>
            {['all','Confirmed','Pending'].map(s=>(
              <button key={s} onClick={()=>setPayStatus(s)}
                className="text-xs font-semibold px-3 py-1.5 rounded-lg border transition-colors"
                style={payStatus===s?{borderColor:'#1E45FC',background:'var(--tint-blue)',color:'var(--accent)'}:{borderColor:'var(--border-strong)',color:'var(--text-muted)'}}>
                {s==='all'?'All':s}
              </button>
            ))}
            <span className="ml-auto text-xs text-gray-400">{filteredPay.length} records</span>
          </div>

          <Card className="overflow-hidden">
            <table className="w-full">
              <thead>
                <tr style={{ background:'var(--surface-2)', borderBottom:'1px solid var(--border)' }}>
                  {['Student','Amount','Method','Tx Reference','Term','Date','Status',''].map(h=>(
                    <th key={h} className="text-left px-4 py-3 text-[11px] font-bold text-gray-400 uppercase tracking-wider">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y" style={{ borderColor:'var(--border-subtle)' }}>
                {filteredPay.length===0
                  ? <tr><td colSpan={8} className="px-4 py-10 text-center text-sm text-gray-400">No payments found.</td></tr>
                  : filteredPay.map(p=>(
                  <tr key={p.id} className="hover:bg-gray-50/60 transition-colors">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2.5">
                        <div className="w-7 h-7 rounded-full flex items-center justify-center text-white text-[10px] font-bold flex-shrink-0" style={{ background:'#1E45FC' }}>
                          {p.student.split(' ').map(w=>w[0]).join('').slice(0,2)}
                        </div>
                        <span className="text-sm font-semibold" style={{ color:'var(--text)' }}>{p.student}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm font-bold text-green-700">UGX {p.amount}</td>
                    <td className="px-4 py-3">
                      <span className="text-[11px] font-bold px-2 py-1 rounded-lg" style={{ background:methodBg[p.method]||'#f0f0f0', color:methodColors[p.method]||'var(--text-muted)' }}>{p.method}</span>
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
                        <button onClick={()=>setReceipt(p)} className="text-[11px] font-semibold px-2.5 py-1 rounded-lg border transition-colors" style={{ borderColor:'var(--border-strong)', color:'var(--accent)' }}>Receipt</button>
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
              <tr style={{ background:'var(--surface-2)', borderBottom:'1px solid var(--border)' }}>
                {['Category','Description','Amount','Date','Submitted By','Status',''].map(h=>(
                  <th key={h} className="text-left px-4 py-3 text-[11px] font-bold text-gray-400 uppercase tracking-wider">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y" style={{ borderColor:'var(--border-subtle)' }}>
              {expenses.map(e=>(
                <tr key={e.id} className="hover:bg-gray-50/60 transition-colors">
                  <td className="px-4 py-3">
                    <span className="text-[11px] font-bold px-2 py-1 rounded-lg" style={{ background:'var(--app-bg)', color:'var(--text)' }}>{e.category}</span>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-700">{e.desc}</td>
                  <td className="px-4 py-3 text-sm font-bold" style={{ color:'var(--danger)' }}>UGX {e.amount.toLocaleString()}</td>
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
              { label:'Total Gross', value:`UGX ${(payroll.reduce((s,p)=>s+p.gross,0)/1000000).toFixed(2)}M`, color:'var(--text)' },
              { label:'Total Tax Deducted', value:`UGX ${(payroll.reduce((s,p)=>s+p.tax,0)/1000).toFixed(0)}K`, color:'var(--danger)' },
              { label:'Total Net Payable', value:`UGX ${(totalPayroll/1000000).toFixed(2)}M`, color:'var(--ok)' },
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
                <tr style={{ background:'var(--surface-2)', borderBottom:'1px solid var(--border)' }}>
                  {['Staff Member','Role','Subject','Gross (UGX)','Tax','NSSF','Net Pay','Status',''].map(h=>(
                    <th key={h} className="text-left px-4 py-3 text-[11px] font-bold text-gray-400 uppercase tracking-wider">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y" style={{ borderColor:'var(--border-subtle)' }}>
                {payroll.map(p=>(
                  <tr key={p.id} className="hover:bg-gray-50/60 transition-colors">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2.5">
                        <div className="w-7 h-7 rounded-full flex items-center justify-center text-white text-[10px] font-bold flex-shrink-0" style={{ background:'#7c3aed' }}>
                          {p.name.split(' ').map(w=>w[0]).join('').slice(0,2)}
                        </div>
                        <span className="text-sm font-semibold" style={{ color:'var(--text)' }}>{p.name}</span>
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
                      <button onClick={() => setPayslip(p)} className="text-[11px] font-semibold px-2.5 py-1 rounded-lg border text-gray-500 hover:border-[#7c3aed] hover:text-[#7c3aed] transition-colors" style={{ borderColor:'var(--border-strong)' }}>Payslip</button>
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
                  style={{ background: isFee?'var(--tint-blue)':'var(--tint-amber)' }}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={isFee?'#1E45FC':'#d97706'} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                    <path d={isFee?'M12 1v22M17 5H9.5a3.5 3.5 0 100 7h5a3.5 3.5 0 110 7H6':'M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3'}/>
                  </svg>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-bold" style={{ color:'var(--text)' }}>
                    {isFee ? `Fee Payment — ${item.student}` : `Expense — ${item.desc}`}
                  </div>
                  <div className="text-xs text-gray-400 mt-0.5">
                    {isFee
                      ? `UGX ${item.amount} · ${item.method} · ${item.date}`
                      : `UGX ${item.amount?.toLocaleString()} · ${item.category} · ${item.date}`}
                  </div>
                  <div className="text-[10px] mt-0.5 font-semibold" style={{ color:'var(--warn)' }}>
                    🔐 Awaiting head teacher approval
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
            <div className="flex items-center justify-between px-6 py-4 border-b" style={{ borderColor:'var(--border)' }}>
              <h3 className="font-bold text-base" style={{ color:'var(--text)' }}>Record School Fee Payment</h3>
              <button onClick={()=>setShowPayModal(false)} className="w-7 h-7 rounded-lg flex items-center justify-center text-gray-400 hover:bg-gray-100">✕</button>
            </div>
            <div className="p-6 space-y-4">
              {/* Student select */}
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1.5">Student <span className="text-red-400">*</span></label>
                <select value={newPay.student} onChange={e=>setNewPay(p=>({...p,student:e.target.value}))}
                  className="w-full px-3 py-2.5 rounded-xl border text-sm bg-white outline-none" style={{ borderColor:'var(--border-strong)' }}>
                  <option value="">— Select student —</option>
                  {students.map(s=><option key={s.id}>{s.name}</option>)}
                </select>
              </div>
              {/* Amount */}
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1.5">Amount (UGX) <span className="text-red-400">*</span></label>
                <input type="number" value={newPay.amount} onChange={e=>setNewPay(p=>({...p,amount:e.target.value}))}
                  placeholder="450000" className="w-full px-3 py-2.5 rounded-xl border text-sm outline-none" style={{ borderColor:'var(--border-strong)' }}/>
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
                        ?{ borderColor:'#1E45FC', background:'var(--tint-blue)', color:'var(--accent)' }
                        :{ borderColor:'var(--border-strong)', color:'var(--text-muted)' }}>
                      <span>{icon}</span>{m}
                    </button>
                  ))}
                </div>
              </div>
              {/* Tx ref */}
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1.5">Transaction Reference</label>
                <input type="text" value={newPay.txRef} onChange={e=>setNewPay(p=>({...p,txRef:e.target.value}))}
                  placeholder="MTN-XXXXXXXX" className="w-full px-3 py-2.5 rounded-xl border text-sm font-mono outline-none" style={{ borderColor:'var(--border-strong)' }}/>
              </div>
              {/* Term */}
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1.5">Term</label>
                <select value={newPay.term} onChange={e=>setNewPay(p=>({...p,term:e.target.value}))}
                  className="w-full px-3 py-2.5 rounded-xl border text-sm bg-white outline-none" style={{ borderColor:'var(--border-strong)' }}>
                  {['Term 1 2026','Term 2 2026','Term 3 2025'].map(t=><option key={t}>{t}</option>)}
                </select>
              </div>
            </div>
            <div className="flex gap-3 px-6 pb-6">
              <button onClick={()=>setShowPayModal(false)} className="flex-1 py-2.5 rounded-xl border text-sm font-semibold text-gray-600" style={{ borderColor:'var(--border-strong)' }}>Cancel</button>
              <button onClick={recordPayment} className="flex-1 py-2.5 rounded-xl text-sm font-bold text-white" style={{ background:'#1E45FC' }}>Save Payment</button>
            </div>
          </div>
        </div>
      )}

      {/* ══ ADD EXPENSE MODAL ══ */}
      {showExpModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background:'rgba(11,15,42,0.6)' }} onClick={()=>setShowExpModal(false)}>
          <div className="bg-white rounded-2xl w-full max-w-sm shadow-2xl" onClick={e=>e.stopPropagation()}>
            <div className="flex items-center justify-between px-6 py-4 border-b" style={{ borderColor:'var(--border)' }}>
              <h3 className="font-bold text-base" style={{ color:'var(--text)' }}>Submit Expense</h3>
              <button onClick={()=>setShowExpModal(false)} className="w-7 h-7 rounded-lg flex items-center justify-center text-gray-400 hover:bg-gray-100">✕</button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1.5">Category</label>
                <select value={newExp.category} onChange={e=>setNewExp(x=>({...x,category:e.target.value}))}
                  className="w-full px-3 py-2.5 rounded-xl border text-sm bg-white outline-none" style={{ borderColor:'var(--border-strong)' }}>
                  {expCategories.map(c=><option key={c}>{c}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1.5">Description <span className="text-red-400">*</span></label>
                <input type="text" value={newExp.desc} onChange={e=>setNewExp(x=>({...x,desc:e.target.value}))}
                  placeholder="e.g. Electricity bill May" className="w-full px-3 py-2.5 rounded-xl border text-sm outline-none" style={{ borderColor:'var(--border-strong)' }}/>
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1.5">Amount (UGX) <span className="text-red-400">*</span></label>
                <input type="number" value={newExp.amount} onChange={e=>setNewExp(x=>({...x,amount:e.target.value}))}
                  placeholder="500000" className="w-full px-3 py-2.5 rounded-xl border text-sm outline-none" style={{ borderColor:'var(--border-strong)' }}/>
              </div>
              <p className="text-[11px] text-amber-600 bg-amber-50 px-3 py-2 rounded-xl">⚠️ Submitted expenses require approval from the Head Teacher or Director before being finalised.</p>
            </div>
            <div className="flex gap-3 px-6 pb-6">
              <button onClick={()=>setShowExpModal(false)} className="flex-1 py-2.5 rounded-xl border text-sm font-semibold text-gray-600" style={{ borderColor:'var(--border-strong)' }}>Cancel</button>
              <button onClick={addExpense} className="flex-1 py-2.5 rounded-xl text-sm font-bold text-white" style={{ background:'#7c3aed' }}>Submit</button>
            </div>
          </div>
        </div>
      )}

      {/* ══ PAYSLIP MODAL ══ */}
      {payslip && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background:'rgba(11,15,42,0.65)' }} onClick={() => setPayslip(null)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm" onClick={e => e.stopPropagation()}>
            <div className="px-6 py-5 text-center border-b" style={{ borderColor:'var(--border)' }}>
              <div className="text-sm font-extrabold" style={{ color:'var(--violet)' }}>PAYSLIP</div>
              <div className="text-xs text-gray-400 mt-0.5">May 2026 · {payslip.role}</div>
            </div>
            <div className="px-6 py-4 space-y-2.5">
              {[
                ['Staff Member', payslip.name],
                ['Role',         payslip.role],
                ['Subject',      payslip.subject],
                ['Gross Pay',    `UGX ${payslip.gross.toLocaleString()}`],
                ['Tax (PAYE)',   `-UGX ${payslip.tax.toLocaleString()}`],
                ['NSSF',         `-UGX ${payslip.nssf.toLocaleString()}`],
                ['NET PAY',      `UGX ${payslip.net.toLocaleString()}`],
                ['Status',       payslip.status],
              ].map(([l, v]) => (
                <div key={l} className="flex items-center justify-between py-1.5 border-b border-dashed" style={{ borderColor:'#f0f0f0' }}>
                  <span className="text-xs text-gray-400">{l}</span>
                  <span className={`text-xs font-bold ${l==='NET PAY'?'text-green-700':l.includes('Tax')||l==='NSSF'?'text-red-500':''}`} style={{ color: l==='NET PAY'?undefined:l.includes('Tax')||l==='NSSF'?undefined:'var(--text)' }}>{v}</span>
                </div>
              ))}
            </div>
            <div className="mx-6 border-t border-dashed text-center text-gray-300 text-xs mb-3" style={{ borderColor:'var(--border-strong)' }}>✂</div>
            <div className="flex gap-3 px-6 pb-6">
              <button onClick={() => setPayslip(null)} className="flex-1 py-2.5 rounded-xl border text-xs font-semibold text-gray-600" style={{ borderColor:'var(--border-strong)' }}>Close</button>
              <button onClick={() => window.print()} className="flex-1 py-2.5 rounded-xl text-xs font-bold text-white" style={{ background:'#7c3aed' }}>Print Payslip</button>
            </div>
          </div>
        </div>
      )}

      {/* ══ RECEIPT MODAL ══ */}
      {receipt && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background:'rgba(11,15,42,0.65)' }} onClick={()=>setReceipt(null)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm" onClick={e=>e.stopPropagation()}>
            {/* Receipt header */}
            <div className="px-6 py-5 text-center border-b" style={{ borderColor:'var(--border)' }}>
              <div className="flex items-center justify-center gap-2 mb-1">
                <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background:'#1E45FC' }}>
                  <img src="/skoulhub-logo.png" alt="" style={{ width:14,height:14,objectFit:'contain',filter:'brightness(0) invert(1)' }}/>
                </div>
                <span className="font-extrabold text-base" style={{ color:'var(--accent)' }}>Skoul<span style={{ color:'#A3CF2E' }}>Hub</span></span>
              </div>
              <div className="text-xs text-gray-400">{tenant?.name ?? 'School'}</div>
              <div className="text-xs font-bold mt-2 px-3 py-1 rounded-full inline-block" style={{ background:'var(--tint-green)', color:'var(--ok)' }}>OFFICIAL RECEIPT</div>
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
                  <span className={`text-xs font-bold ${l==='Status'?(receipt.status==='Confirmed'?'text-green-700':'text-yellow-700'):''}`} style={{ color: l==='Amount Paid'?'var(--ok)': l==='Status'?undefined:'var(--text)' }}>{v}</span>
                </div>
              ))}
            </div>
            <div className="px-6 pb-3 text-center text-[10px] text-gray-400">
              Generated by SkoulHub · {new Date().toLocaleDateString()}
            </div>
            {/* Divider with scissors */}
            <div className="mx-6 border-t border-dashed text-center text-gray-300 text-xs mb-3" style={{ borderColor:'var(--border-strong)' }}>✂</div>
            <div className="flex gap-3 px-6 pb-6">
              <button onClick={()=>setReceipt(null)} className="flex-1 py-2.5 rounded-xl border text-xs font-semibold text-gray-600" style={{ borderColor:'var(--border-strong)' }}>Close</button>
              <button onClick={() => window.print()} className="flex-1 py-2.5 rounded-xl text-xs font-bold text-white" style={{ background:'#1E45FC' }}>Print Receipt</button>
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
function ReportCardsPage({ roleId, schoolId, currentUser }) {
  const isTeacher  = roleId === 'teacher';
  const isParent   = roleId === 'parent';
  const assignment = isTeacher ? getTeacherAssignment(currentUser?.user_id) : null;
  const children   = parentChildren(currentUser);
  // Role-scoped rows (teacher → assigned classes, parent → own children)
  const allStudents = scopedStudents(schoolId, currentUser);

  const canGen  = can(roleId, 'reports.generate');
  const canSend = can(roleId, 'reports.send');

  // Teacher: only their assigned subjects shown in the marks view
  // All subjects for full view, teacher's subjects for teacher view
  const ALL_SUBJECTS = ['Mathematics','English','Biology','History','Chemistry','Physics','Geography'];
  const SUBJECTS = isTeacher && assignment
    ? ALL_SUBJECTS.filter(s => assignment.subjects.includes(s))
    : ALL_SUBJECTS;

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
  const gradeBg    = g => g.startsWith('D')?'var(--tint-green)':g.startsWith('C')?'var(--tint-blue)':g.startsWith('P')?'var(--tint-amber)':'var(--tint-red)';

  // For teacher: compute avg only over assigned subjects
  const subjectIndexes = isTeacher && assignment
    ? assignment.subjects.map(sub => ALL_SUBJECTS.indexOf(sub)).filter(i => i >= 0)
    : ALL_SUBJECTS.map((_, i) => i);

  const reportData = allStudents.map((s, idx) => {
    const allMarks = MOCK_MARKS[s.id] || ALL_SUBJECTS.map(() => Math.floor(Math.random()*40+45));
    const relevantMarks = subjectIndexes.map(i => allMarks[i]);
    const avg   = Math.round(relevantMarks.reduce((a,b)=>a+b,0)/relevantMarks.length);
    const grade = gradeOf(avg);
    const pos   = idx + 1;
    return { ...s, marks: allMarks, relevantMarks, avg, grade, pos, total: allStudents.length };
  }).sort((a,b) => b.avg - a.avg).map((s,i) => ({ ...s, pos: i+1 }));

  const [search,   setSearch]   = useState('');
  const [classF,   setClassF]   = useState('all');
  const [termF,    setTermF]    = useState('Term 2 2026');
  const [selected, setSelected] = useState(null); // view modal
  const [editing,  setEditing]  = useState(null); // edit modal
  const { toasts, show: toast } = useToast();

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
          <h2 className="text-lg font-extrabold" style={{ color:'var(--text)' }}>
            {isParent ? "My Child's Report Card" : 'Report Cards'}
          </h2>
          <p className="text-xs text-gray-400 mt-0.5">
            {termF} · {allStudents.length} student{allStudents.length !== 1 ? 's' : ''}
            {isParent ? ` · ${children.join(', ')}` : isTeacher && assignment ? ` · ${assignment.subjects.join(', ')}` : ` · ${schoolId}`}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {canGen && (
            <button onClick={() => { window.print(); toast('Exporting all report cards…'); }}
              className="flex items-center gap-2 text-xs font-bold px-4 py-2 rounded-xl border transition-colors"
              style={{ borderColor:'var(--border-strong)', color:'var(--text-muted)' }}
              onMouseEnter={e=>{e.currentTarget.style.borderColor='#1E45FC';e.currentTarget.style.color='#1E45FC';}}
              onMouseLeave={e=>{e.currentTarget.style.borderColor='var(--border-strong)';e.currentTarget.style.color='var(--text-muted)';}}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3"/></svg>
              Export All
            </button>
          )}
          {canGen && (
            <button onClick={() => toast(`Generated ${filtered.length} report cards for ${termF}`)}
              className="flex items-center gap-2 text-xs font-bold px-4 py-2 rounded-xl text-white"
              style={{ background:'#1E45FC' }}>
              <svg width="13" height="13" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><path d="M7 2v10M2 7h10"/></svg>
              Generate All
            </button>
          )}
        </div>
      </div>

      {/* Teacher scope notice */}
      {isTeacher && assignment && (
        <div className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-medium" style={{ background: 'var(--tint-sky)', color: 'var(--info)', border: '1px solid #bae6fd' }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
          Showing performance for <strong className="mx-1">{assignment.subjects.join(', ')}</strong> in <strong className="mx-1">{assignment.classes.join(', ')}</strong>. Averages are calculated for your subjects only.
        </div>
      )}

      {/* Parent scope notice */}
      {isParent && (
        <div className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-medium" style={{ background: 'var(--tint-amber)', color: 'var(--warn)', border: '1px solid #fde68a' }}>
          <span>👨‍👩‍👧</span>
          Showing report cards for your children only: <strong className="ml-1">{children.join(', ')}</strong>
        </div>
      )}

      {/* Grade distribution summary */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label:'Distinctions (D1–D2)', count: dist.D, color:'var(--ok)', bg:'var(--tint-green)', range:'80–100%' },
          { label:'Credits (C3–C6)',       count: dist.C, color:'var(--accent)', bg:'var(--tint-blue)', range:'55–79%' },
          { label:'Passes (P7–P8)',        count: dist.P, color:'var(--warn)', bg:'var(--tint-amber)', range:'45–54%' },
          { label:'Failures (F9)',         count: dist.F, color:'var(--danger)', bg:'var(--tint-red)', range:'0–44%' },
        ].map(d => (
          <Card key={d.label} className="p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center text-lg font-extrabold flex-shrink-0"
              style={{ background: d.bg, color: d.color }}>{d.count}</div>
            <div className="min-w-0">
              <div className="text-xs font-bold truncate" style={{ color:'var(--text)' }}>{d.label}</div>
              <div className="text-[10px] text-gray-400">{d.range}</div>
            </div>
          </Card>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        {/* Search */}
        <div className="flex items-center gap-2 px-3.5 py-2 rounded-xl border bg-white text-sm" style={{ borderColor:'var(--border-strong)' }}>
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="#94a3b8" strokeWidth="1.5"><circle cx="6" cy="6" r="4.5"/><path d="M10 10L13 13"/></svg>
          <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search student…" className="outline-none bg-transparent text-sm w-36"/>
        </div>
        {/* Term filter */}
        <select value={termF} onChange={e=>setTermF(e.target.value)}
          className="px-3 py-2 rounded-xl border text-xs font-semibold bg-white outline-none appearance-none"
          style={{ borderColor:'var(--border-strong)', color:'var(--text)' }}>
          {terms.map(t=><option key={t}>{t}</option>)}
        </select>
        {/* Class filter */}
        <div className="flex items-center gap-1.5 flex-wrap">
          {classes.map(c=>(
            <button key={c} onClick={()=>setClassF(c)}
              className="text-xs font-semibold px-3 py-1.5 rounded-lg border capitalize transition-colors"
              style={classF===c?{borderColor:'#1E45FC',background:'var(--tint-blue)',color:'var(--accent)'}:{borderColor:'var(--border-strong)',color:'var(--text-muted)'}}>
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
            <tr style={{ background:'var(--surface-2)', borderBottom:'1px solid var(--border)' }}>
              {['#','Student','Class','Avg Score','Grade','Position','Status',''].map(h=>(
                <th key={h} className="text-left text-[11px] font-bold uppercase tracking-wide text-gray-400 px-4 py-3">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y" style={{ borderColor:'var(--border-subtle)' }}>
            {filtered.length===0
              ? <tr><td colSpan={8} className="px-4 py-10 text-center text-sm text-gray-400">No students found.</td></tr>
              : filtered.map(s=>(
              <tr key={s.id} className="hover:bg-gray-50/60 transition-colors">
                {/* Rank */}
                <td className="px-4 py-3 text-xs font-bold" style={{ color: s.pos<=3?'var(--warn)':'var(--text-dim)' }}>
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
                      <div className="text-sm font-semibold" style={{ color:'var(--text)' }}>{s.name}</div>
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
                    <span className="text-xs font-bold" style={{ color:'var(--text)' }}>{s.avg}%</span>
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
                      style={{ borderColor:'var(--border-strong)', color:'var(--text-muted)' }}
                      onMouseEnter={e=>{e.currentTarget.style.borderColor='#1E45FC';e.currentTarget.style.color='#1E45FC';}}
                      onMouseLeave={e=>{e.currentTarget.style.borderColor='var(--border-strong)';e.currentTarget.style.color='var(--text-muted)';}}>
                      View
                    </button>
                    {(can(roleId,'reports.comment_head') || can(roleId,'reports.comment_teacher')) && (
                      <button onClick={()=>setEditing(s)}
                        className="text-[11px] font-semibold px-2.5 py-1 rounded-lg border transition-colors"
                        style={{ borderColor:'var(--border-strong)', color:'var(--text-muted)' }}
                        onMouseEnter={e=>{e.currentTarget.style.borderColor='#A3CF2E';e.currentTarget.style.color='#5a7a0a';}}
                        onMouseLeave={e=>{e.currentTarget.style.borderColor='var(--border-strong)';e.currentTarget.style.color='var(--text-muted)';}}>
                        Edit
                      </button>
                    )}
                    {canSend && (
                      <button onClick={() => toast(`Report card sent to parent of ${s.name}`)}
                        className="text-[11px] font-semibold px-2.5 py-1 rounded-lg text-white"
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
            <div className="px-6 py-4 border-b flex items-center justify-between" style={{ borderColor:'var(--border)' }}>
              <div>
                <h3 className="font-bold text-base" style={{ color:'var(--text)' }}>Report Card — {selected.name}</h3>
                <p className="text-xs text-gray-400">{selected.class} · {termF}</p>
              </div>
              <button onClick={()=>setSelected(null)} className="w-8 h-8 rounded-lg flex items-center justify-center text-gray-400 hover:bg-gray-100">✕</button>
            </div>
            {/* Summary badges */}
            <div className="grid grid-cols-3 gap-3 px-6 py-4">
              {[['Avg Score',`${selected.avg}%`],['Grade',selected.grade],['Position',`${selected.pos} / ${selected.total}`]].map(([l,v])=>(
                <div key={l} className="text-center rounded-xl p-3" style={{ background:'var(--surface-2)' }}>
                  <div className="text-lg font-extrabold" style={{ color: gradeColor(selected.grade) }}>{v}</div>
                  <div className="text-[10px] text-gray-400 mt-0.5">{l}</div>
                </div>
              ))}
            </div>
            {/* Subject marks */}
            <div className="px-6 pb-2">
              <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">
                {isTeacher ? `My Subjects — ${SUBJECTS.join(', ')}` : 'Subject Results'}
              </h4>
              <div className="space-y-2.5">
                {SUBJECTS.map((subj) => {
                  const origIdx = ALL_SUBJECTS.indexOf(subj);
                  const m = selected.marks[origIdx]; const g=gradeOf(m);
                  return (
                    <div key={subj} className="flex items-center gap-3">
                      <div className="w-24 text-xs font-medium text-gray-600 truncate flex-shrink-0">{subj}</div>
                      <div className="flex-1 h-2 rounded-full bg-gray-100">
                        <div className="h-2 rounded-full" style={{ width:`${m}%`, background: gradeColor(g) }}/>
                      </div>
                      <div className="w-8 text-xs font-bold text-right" style={{ color:'var(--text)' }}>{m}</div>
                      <span className="text-[10px] font-bold px-1.5 py-0.5 rounded w-7 text-center flex-shrink-0"
                        style={{ background: gradeBg(g), color: gradeColor(g) }}>{g}</span>
                    </div>
                  );
                })}
              </div>
            </div>
            {/* Actions */}
            <div className="flex gap-3 px-6 py-4 border-t mt-3" style={{ borderColor:'var(--border)' }}>
              {canGen && <button onClick={() => { window.print(); toast(`Downloading PDF for ${selected.name}`); }} className="flex-1 py-2 rounded-xl border text-xs font-semibold text-gray-600 hover:bg-gray-50" style={{ borderColor:'var(--border-strong)' }}>Download PDF</button>}
              {canSend && <button onClick={() => { toast(`Report card sent to parent of ${selected.name}`); setSelected(null); }} className="flex-1 py-2 rounded-xl text-xs font-bold text-white" style={{ background:'#1E45FC' }}>Send to Parent</button>}
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
            <div className="px-6 py-4 border-b flex items-center justify-between" style={{ borderColor:'var(--border)' }}>
              <div>
                <h3 className="font-bold text-base" style={{ color:'var(--text)' }}>Edit Report — {editing.name}</h3>
                <p className="text-xs text-gray-400">{editing.class} · {termF}</p>
              </div>
              <button onClick={()=>setEditing(null)} className="w-8 h-8 rounded-lg flex items-center justify-center text-gray-400 hover:bg-gray-100">✕</button>
            </div>
            <div className="px-6 py-4 space-y-4">
              {can(roleId,'reports.comment_teacher') && (
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1.5">Teacher's Comment</label>
                  <textarea rows={3} defaultValue="A hardworking student who has shown great improvement this term."
                    className="w-full px-3 py-2 rounded-xl border text-sm outline-none resize-none"
                    style={{ borderColor:'var(--border-strong)' }}/>
                </div>
              )}
              {can(roleId,'reports.comment_head') && (
                <>
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 mb-1.5">Head Teacher's Comment</label>
                    <textarea rows={3} defaultValue="A hardworking student who has shown great improvement this term."
                      className="w-full px-3 py-2 rounded-xl border text-sm outline-none resize-none"
                      style={{ borderColor:'var(--border-strong)' }}/>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 mb-1.5">Conduct</label>
                    <select className="w-full px-3 py-2 rounded-xl border text-sm bg-white outline-none" style={{ borderColor:'var(--border-strong)' }}>
                      {['Excellent','Very Good','Good','Satisfactory','Needs Improvement'].map(o=><option key={o}>{o}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 mb-1.5">Next Term Fees (UGX)</label>
                    <input type="text" defaultValue="450,000" className="w-full px-3 py-2 rounded-xl border text-sm outline-none" style={{ borderColor:'var(--border-strong)' }}/>
                  </div>
                </>
              )}
            </div>
            <div className="flex gap-3 px-6 py-4 border-t" style={{ borderColor:'var(--border)' }}>
              <button onClick={()=>setEditing(null)} className="flex-1 py-2 rounded-xl border text-xs font-semibold text-gray-600 hover:bg-gray-50" style={{ borderColor:'var(--border-strong)' }}>Cancel</button>
              <button onClick={()=>{ toast(`Report for ${editing.name} updated`); setEditing(null); }} className="flex-1 py-2 rounded-xl text-xs font-bold text-white" style={{ background:'#1E45FC' }}>Save Changes</button>
            </div>
          </div>
        </div>
      )}
      <Toast toasts={toasts} />
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
  const { toasts, show: toast } = useToast();

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
          <h2 className="text-lg font-extrabold" style={{ color:'var(--text)' }}>Student ID Cards</h2>
          <p className="text-xs text-gray-400 mt-0.5">{allStudents.length} students · {tenant?.name ?? schoolId}</p>
        </div>
        {canGen && (
          <button onClick={() => { window.print(); toast(`Printing ${filtered.length} ID cards`); }}
            className="flex items-center gap-2 text-xs font-bold px-4 py-2 rounded-xl text-white" style={{ background:'#1E45FC' }}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3"/></svg>
            Print All
          </button>
        )}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label:'Total Students',   value: allStudents.length,                              bg:'var(--tint-blue)', color:'var(--accent)', path:'M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2M9 7a4 4 0 100 8 4 4 0 000-8z' },
          { label:'IDs Assigned',     value: allStudents.length,                              bg:'var(--tint-green)', color:'var(--ok)', path:'M9 12l2 2 4-4M7 2a2 2 0 00-2 2v16a2 2 0 002 2h10a2 2 0 002-2V4a2 2 0 00-2-2H7z' },
          { label:'Active Students',  value: allStudents.filter(s=>s.status==='Active').length, bg:'var(--tint-amber)', color:'var(--warn)', path:'M16 21v-2a4 4 0 00-4-4H6a4 4 0 00-4 4v2M12 11a4 4 0 100-8 4 4 0 000 8z' },
        ].map(s => (
          <Card key={s.label} className="p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background:s.bg }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={s.color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d={s.path}/></svg>
            </div>
            <div>
              <div className="text-xl font-extrabold" style={{ color:'var(--text)' }}>{s.value}</div>
              <div className="text-xs text-gray-400">{s.label}</div>
            </div>
          </Card>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2 px-3.5 py-2 rounded-xl border bg-white text-sm" style={{ borderColor:'var(--border-strong)' }}>
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="#94a3b8" strokeWidth="1.5"><circle cx="6" cy="6" r="4.5"/><path d="M10 10L13 13"/></svg>
          <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search name or ID…" className="outline-none bg-transparent text-sm w-40"/>
        </div>
        <select value={classF} onChange={e=>setClassF(e.target.value)}
          className="px-3 py-2 rounded-xl border text-xs font-semibold bg-white outline-none"
          style={{ borderColor:'var(--border-strong)', color:'var(--text)' }}>
          {classes.map(c=><option key={c} value={c}>{c==='all'?'All Classes':c}</option>)}
        </select>
        {['all','active','inactive'].map(f=>(
          <button key={f} onClick={()=>setStatusF(f)}
            className="text-xs font-semibold px-3 py-1.5 rounded-lg border capitalize transition-colors"
            style={statusF===f?{borderColor:'#1E45FC',background:'var(--tint-blue)',color:'var(--accent)'}:{borderColor:'var(--border-strong)',color:'var(--text-muted)'}}>
            {f==='all'?'All':f}
          </button>
        ))}
        <span className="ml-auto text-xs text-gray-400">{filtered.length} results</span>
      </div>

      {/* Table */}
      <Card className="overflow-hidden">
        <table className="w-full">
          <thead>
            <tr style={{ background:'var(--surface-2)', borderBottom:'1px solid var(--border)' }}>
              {['Student','Class','Student ID Number','QR Code','Status',''].map(h=>(
                <th key={h} className="text-left text-[11px] font-bold uppercase tracking-wide text-gray-400 px-4 py-3">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y" style={{ borderColor:'var(--border-subtle)' }}>
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
                            <div className="text-sm font-semibold" style={{ color:'var(--text)' }}>{s.name}</div>
                            <div className="text-[10px] text-gray-400">{s.parent}</div>
                          </div>
                        </div>
                      </td>
                      {/* Class */}
                      <td className="px-4 py-3 text-xs text-gray-600">{s.class}</td>
                      {/* ID number */}
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-xs font-bold px-2.5 py-1 rounded-lg" style={{ background:'#f0f4ff', color:'var(--accent)' }}>{sid}</span>
                          {canGen && (
                            <button onClick={()=>setAssigning({ studentId: s.id, value: sid })}
                              className="p-1 rounded-lg text-gray-400 hover:text-brand-blue transition-colors"
                              title="Edit ID"
                              onMouseEnter={e=>e.currentTarget.style.color='#1E45FC'}
                              onMouseLeave={e=>e.currentTarget.style.color='var(--text-dim)'}>
                              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                            </button>
                          )}
                        </div>
                      </td>
                      {/* QR */}
                      <td className="px-4 py-3">
                        <div className="w-10 h-10 rounded-lg overflow-hidden border" style={{ borderColor:'var(--border)' }}>
                          <QRCode value={sid} size={40}/>
                        </div>
                      </td>
                      {/* Status */}
                      <td className="px-4 py-3">
                        <span className="text-[11px] font-bold px-2 py-0.5 rounded-full"
                          style={s.status==='Active'?{background:'var(--tint-green)',color:'var(--ok)'}:{background:'#f3f4f6',color:'var(--text-muted)'}}>
                          {s.status}
                        </span>
                      </td>
                      {/* Actions */}
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1.5">
                          <button onClick={()=>setPreview({ ...s, sid })}
                            className="text-[11px] font-semibold px-2.5 py-1 rounded-lg border transition-colors"
                            style={{ borderColor:'var(--border-strong)', color:'var(--text-muted)' }}
                            onMouseEnter={e=>{e.currentTarget.style.borderColor='#1E45FC';e.currentTarget.style.color='#1E45FC';}}
                            onMouseLeave={e=>{e.currentTarget.style.borderColor='var(--border-strong)';e.currentTarget.style.color='var(--text-muted)';}}>
                            Preview
                          </button>
                          {canGen && (
                            <button onClick={() => { setPreview({ ...s, sid }); }}
                              className="text-[11px] font-semibold px-2.5 py-1 rounded-lg text-white"
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
            <h3 className="font-bold text-base mb-1" style={{ color:'var(--text)' }}>Assign Student ID</h3>
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
            <div className="flex items-center gap-3 p-3 rounded-xl mb-5" style={{ background:'var(--surface-2)' }}>
              <QRCode value={assigning.value || '—'} size={52}/>
              <div>
                <div className="text-xs font-bold" style={{ color:'var(--text)' }}>QR Preview</div>
                <div className="font-mono text-[10px] text-gray-500 mt-0.5 break-all">{assigning.value || '—'}</div>
              </div>
            </div>
            <div className="flex gap-3">
              <button onClick={()=>setAssigning(null)} className="flex-1 py-2 rounded-xl border text-xs font-semibold text-gray-600" style={{ borderColor:'var(--border-strong)' }}>Cancel</button>
              <button onClick={saveId} className="flex-1 py-2 rounded-xl text-xs font-bold text-white" style={{ background:'#1E45FC' }}>Save ID</button>
            </div>
          </div>
        </div>
      )}

      <Toast toasts={toasts} />

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
              <button onClick={()=>setPreview(null)} className="flex-1 py-2.5 rounded-xl border text-xs font-semibold bg-white" style={{ borderColor:'var(--border-strong)', color:'var(--text-muted)' }}>Close</button>
              {canGen && <button onClick={() => { window.print(); toast(`Downloading ID card for ${preview.name}`); }} className="flex-1 py-2.5 rounded-xl text-xs font-bold text-white" style={{ background:'#1E45FC' }}>Download PDF</button>}
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
function NotificationsPage({ roleId, currentUser }) {
  const [notifs, setNotifs] = useState([
    { id:1, icon:'💳', title:'Fee Payment Received',  body:'UGX 450,000 from Kabuye Peter for Aisha Nakato',          time:'2m ago',  type:'finance',       read:false, audience:['school_admin','head_teacher','bursar','parent'] },
    { id:2, icon:'👤', title:'New Student Enrolled',  body:'Aisha Nakato enrolled in S.1 West.',                       time:'18m ago', type:'student',       read:false, audience:['school_admin','head_teacher','teacher','parent'] },
    { id:3, icon:'📊', title:'Results Submitted',     body:'Term 2 marks for S.3 East submitted by Ms. Grace.',        time:'1h ago',  type:'academic',      read:false, audience:['school_admin','head_teacher','teacher'] },
    { id:4, icon:'📧', title:'Emails Sent',           body:'42 parents notified about Term 2 report cards via email.', time:'3h ago',  type:'communication', read:true,  audience:['school_admin','head_teacher'] },
    { id:5, icon:'⚠️', title:'Low Attendance Alert',  body:'David Opiyo (S.1 East) absent 5 consecutive days.',        time:'5h ago',  type:'alert',         read:true,  audience:['school_admin','head_teacher','teacher'] },
  ]);
  const [sendModal, setSendModal] = useState(false);
  const { toasts, show: toast } = useToast();
  const tCol = { finance:'#10b981', student:'#1E45FC', academic:'#7c3aed', communication:'#0891b2', alert:'#dc2626' };

  const markRead = (id) => setNotifs(ns => ns.map(n => n.id === id ? { ...n, read: true } : n));

  // Only show notifications addressed to this role; parents additionally only
  // see items that concern their own children.
  const children = parentChildren(currentUser);
  const visible = notifs.filter(n => {
    if (!n.audience?.includes(roleId)) return false;
    if (roleId === 'parent') return children.some(k => `${n.title} ${n.body}`.includes(k));
    return true;
  });

  return (
    <div className="animate-fade-in space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-extrabold" style={{ color:'var(--text)' }}>Notifications</h2>
          <p className="text-xs text-gray-400 mt-0.5">{visible.filter(n=>!n.read).length} unread</p>
        </div>
        {can(roleId,'notifs.send') && <button onClick={() => setSendModal(true)} className="btn-brand-primary text-sm py-2 px-4">Send Notification</button>}
      </div>
      <div className="flex flex-col gap-3">
        {visible.length === 0 && (
          <Card className="p-10 text-center">
            <div className="text-3xl mb-2">🔔</div>
            <p className="text-sm font-semibold text-gray-500">No notifications for you right now.</p>
          </Card>
        )}
        {visible.map((n) => (
          <div key={n.id} className={`flex items-start gap-4 p-4 rounded-2xl border transition-all cursor-pointer ${n.read?'bg-white opacity-70':'bg-white shadow-sm'}`}
            style={{ borderColor: n.read?'var(--border)':tCol[n.type]+'30' }}
            onClick={() => markRead(n.id)}>
            <div className="w-10 h-10 rounded-xl flex items-center justify-center text-xl flex-shrink-0" style={{ background:tCol[n.type]+'15' }}>{n.icon}</div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-0.5">
                <span className="font-bold text-sm" style={{ color:'var(--text)' }}>{n.title}</span>
                {!n.read && <span className="w-2 h-2 rounded-full" style={{ background:tCol[n.type] }}/>}
              </div>
              <p className="text-xs text-gray-500 leading-relaxed">{n.body}</p>
            </div>
            <span className="text-xs text-gray-400 flex-shrink-0">{n.time}</span>
          </div>
        ))}
      </div>

      {/* SEND NOTIFICATION MODAL */}
      {sendModal && (
        <SendNotificationModal
          onClose={() => setSendModal(false)}
          onSent={(msg, audience) => {
            setSendModal(false);
            setNotifs(ns => [{
              id: Date.now(), icon: '📢', title: 'Notification Sent',
              body: `"${msg.slice(0, 60)}${msg.length > 60 ? '…' : ''}" sent to ${audience}`,
              time: 'just now', type: 'communication', read: false,
            }, ...ns]);
            toast(`Notification sent to ${audience}`);
          }}
        />
      )}
      <Toast toasts={toasts} />
    </div>
  );
}

/* ── Send Notification Modal ─────────────────────────────── */
function SendNotificationModal({ onClose, onSent }) {
  const [audience, setAudience] = useState('All Parents');
  const [channel,  setChannel]  = useState('sms');
  const [message,  setMessage]  = useState('');
  const [sending,  setSending]  = useState(false);

  const handleSend = () => {
    if (!message.trim()) return;
    setSending(true);
    setTimeout(() => { setSending(false); onSent(message, audience); }, 900);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background:'rgba(11,15,42,0.55)', backdropFilter:'blur(4px)' }}
      onClick={onClose}>
      <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-4 border-b" style={{ borderColor:'var(--border)' }}>
          <h3 className="font-bold text-base" style={{ color:'var(--text)' }}>Send Notification</h3>
          <button onClick={onClose} className="w-8 h-8 rounded-lg flex items-center justify-center text-gray-400 hover:bg-gray-100">✕</button>
        </div>
        <div className="p-6 space-y-4">
          {/* Audience */}
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-2">Audience</label>
            <select value={audience} onChange={e => setAudience(e.target.value)}
              className="w-full px-3 py-2.5 rounded-xl border text-sm bg-white outline-none" style={{ borderColor:'var(--border-strong)' }}>
              {['All Parents','All Teachers','All Students','S.1 East Parents','S.3 East Parents','All Staff'].map(a => <option key={a}>{a}</option>)}
            </select>
          </div>
          {/* Channel */}
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-2">Channel</label>
            <div className="grid grid-cols-3 gap-2">
              {[{ id:'sms',   label:'SMS',   icon:'💬' }, { id:'email', label:'Email', icon:'📧' }, { id:'push',  label:'Push',  icon:'🔔' }].map(c => (
                <button key={c.id} onClick={() => setChannel(c.id)}
                  className="flex items-center justify-center gap-1.5 py-2.5 rounded-xl border text-xs font-semibold transition-all"
                  style={channel === c.id ? { borderColor:'#1E45FC', background:'var(--tint-blue)', color:'var(--accent)' } : { borderColor:'var(--border-strong)', color:'var(--text-muted)' }}>
                  <span>{c.icon}</span>{c.label}
                </button>
              ))}
            </div>
          </div>
          {/* Message */}
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1.5">Message <span className="text-red-400">*</span></label>
            <textarea rows={4} value={message} onChange={e => setMessage(e.target.value)}
              placeholder="Type your message here…"
              className="w-full px-3 py-2.5 rounded-xl border text-sm outline-none resize-none focus:border-[#1E45FC] transition-all"
              style={{ borderColor: message ? 'var(--border-strong)' : 'var(--border-strong)' }}/>
            <p className="text-[10px] text-gray-400 mt-1">{message.length} characters</p>
          </div>
        </div>
        <div className="flex gap-3 px-6 pb-6">
          <button onClick={onClose} className="flex-1 py-2.5 rounded-xl border text-sm font-semibold text-gray-600 hover:bg-gray-50" style={{ borderColor:'var(--border-strong)' }}>Cancel</button>
          <button onClick={handleSend} disabled={sending || !message.trim()}
            className="flex-1 py-2.5 rounded-xl text-sm font-bold text-white transition-opacity disabled:opacity-60"
            style={{ background:'#1E45FC' }}>
            {sending ? 'Sending…' : 'Send Notification'}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════
   SETTINGS
═══════════════════════════════════════════════════ */
function SettingsPage({ roleId, schoolId, tenant }) {
  const canEditSettings = can(roleId, 'settings.edit');
  const [editField, setEditField] = useState(null);
  const [settings, setSettings] = useState({
    'School Name': tenant?.name ?? '—',
    'District':    tenant?.district ?? '—',
    'Plan':        `${planLabel(tenant?.plan)} · ${formatUGX(planRate(tenant?.plan))}/student`,
    'Status':      tenant?.status ?? '—',
    'Admin Email': tenant?.admin_email ?? '—',
  });
  const [editVal, setEditVal] = useState('');
  const { toasts, show: toast } = useToast();

  const rows = [
    ['Tenant ID (school_id)', schoolId ?? '—',       '🔑', true],
    ['School Name',          settings['School Name'], '🏫', false],
    ['District',             settings['District'],   '📍', false],
    ['Plan',                 settings['Plan'],       '📋', true, 'Manage in Subscription'],
    ['Status',               settings['Status'],     '🟢', false],
    ['Admin Email',          settings['Admin Email'],'📧', false],
    ['Created',              tenant?.created_at ?? '—', '📅', true],
  ];

  const openEdit = (label, value) => { setEditField(label); setEditVal(value === '—' ? '' : value); };
  const saveEdit = () => { setSettings(s => ({ ...s, [editField]: editVal || '—' })); toast(`${editField} updated`); setEditField(null); };

  return (
    <div className="animate-fade-in space-y-4">
      <div>
        <h2 className="text-lg font-extrabold" style={{ color:'var(--text)' }}>School Settings</h2>
        <p className="text-xs text-gray-400 mt-0.5">Configuration for your tenant</p>
      </div>
      <Card className="divide-y max-w-2xl" style={{ borderColor:'var(--border)' }}>
        {rows.map(([label, value, icon, locked, hint]) => (
          <div key={label} className="flex items-center gap-4 px-5 py-4">
            <span className="text-xl flex-shrink-0">{icon}</span>
            <div className="flex-1 min-w-0">
              <div className="text-xs text-gray-400">{label}</div>
              <div className="text-sm font-semibold truncate" style={{ color:'var(--text)', fontFamily: locked ? 'monospace' : undefined }}>{value}</div>
            </div>
            {!locked && canEditSettings && <button onClick={() => openEdit(label, value)} className="text-xs font-semibold hover:underline flex-shrink-0" style={{ color:'var(--accent)' }}>Edit</button>}
            {!locked && !canEditSettings && <span className="text-xs text-gray-300 flex-shrink-0">View only</span>}
            {locked && <span className="text-xs text-gray-300 flex-shrink-0">{hint ?? 'Auto-generated'}</span>}
          </div>
        ))}
      </Card>

      {editField && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background:'rgba(11,15,42,0.55)', backdropFilter:'blur(4px)' }}
          onClick={() => setEditField(null)}>
          <div className="bg-white rounded-2xl w-full max-w-sm shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-6 py-4 border-b" style={{ borderColor:'var(--border)' }}>
              <h3 className="font-bold text-base" style={{ color:'var(--text)' }}>Edit — {editField}</h3>
              <button onClick={() => setEditField(null)} className="w-8 h-8 rounded-lg flex items-center justify-center text-gray-400 hover:bg-gray-100">✕</button>
            </div>
            <div className="p-6">
              <label className="block text-xs font-semibold text-gray-600 mb-1.5">{editField}</label>
              <input type="text" value={editVal} onChange={e => setEditVal(e.target.value)}
                className="w-full px-3 py-2.5 rounded-xl border text-sm outline-none focus:border-[#1E45FC] focus:ring-2 focus:ring-[#1E45FC]/20 transition-all"
                style={{ borderColor:'var(--border-strong)' }}
                onKeyDown={e => e.key === 'Enter' && saveEdit()} autoFocus />
            </div>
            <div className="flex gap-3 px-6 pb-6">
              <button onClick={() => setEditField(null)} className="flex-1 py-2.5 rounded-xl border text-sm font-semibold text-gray-600 hover:bg-gray-50" style={{ borderColor:'var(--border-strong)' }}>Cancel</button>
              <button onClick={saveEdit} className="flex-1 py-2.5 rounded-xl text-sm font-bold text-white" style={{ background:'#1E45FC' }}>Save</button>
            </div>
          </div>
        </div>
      )}
      <Toast toasts={toasts} />
    </div>
  );
}

/* ══════════════════════════════════════════════════
   ENROLLMENT FORM BUILDER
═══════════════════════════════════════════════════ */
const SECTION_META = {
  application: { label: 'Application',          color: 'var(--accent)' },
  student:     { label: 'Student Information',   color: 'var(--ok)' },
  parent:      { label: 'Parent / Guardian',     color: 'var(--warn)' },
  academic:    { label: 'Academic History',      color: 'var(--violet)' },
  documents:   { label: 'Documents Checklist',   color: 'var(--info)' },
};

function EnrollmentBuilderPage({ roleId, schoolId, tenant }) {
  const canManage = can(roleId, 'enrollment.manage');
  const cfg = getEnrollmentConfig(schoolId);
  const themeColor = cfg?.themeColor ?? '#1E45FC';

  const [schema, setSchema]   = useState(() => getFormSchema(schoolId));
  const [activeTab, setActiveTab] = useState('student');
  const [addModal, setAddModal]   = useState(null); // section id when open
  const [editField, setEditField] = useState(null);  // field object
  const { toasts, show: toast } = useToast();

  const sectionFields = (sec) => schema.filter(f => f.section === sec);

  const toggle = (id) => {
    setSchema(s => s.map(f => f.id === id ? { ...f, enabled: !f.enabled } : f));
  };
  const toggleRequired = (id) => {
    setSchema(s => s.map(f => f.id === id ? { ...f, required: !f.required } : f));
  };
  const remove = (id) => {
    setSchema(s => s.filter(f => f.id !== id));
  };
  const moveUp = (id) => {
    setSchema(s => {
      const idx = s.findIndex(f => f.id === id);
      if (idx <= 0) return s;
      const next = [...s];
      [next[idx-1], next[idx]] = [next[idx], next[idx-1]];
      return next;
    });
  };
  const moveDown = (id) => {
    setSchema(s => {
      const idx = s.findIndex(f => f.id === id);
      if (idx < 0 || idx >= s.length-1) return s;
      const next = [...s];
      [next[idx], next[idx+1]] = [next[idx+1], next[idx]];
      return next;
    });
  };
  const saveLabel = (id, newLabel) => {
    setSchema(s => s.map(f => f.id === id ? { ...f, label: newLabel } : f));
    setEditField(null);
    toast('Field label updated');
  };
  const addCustomField = (section, label, type, required) => {
    const id = 'custom_' + Math.random().toString(36).slice(2, 8);
    setSchema(s => [...s, { id, section, label, type: type || 'text', required, locked: false, enabled: true }]);
    setAddModal(null);
    toast('Custom field added');
  };
  const handleSave = () => {
    saveFormSchema(schoolId, schema);
    toast('Enrollment form saved! Share the enrollment link with parents.');
  };
  const handleReset = () => {
    const fresh = DEFAULT_FORM_SCHEMA.map(f => ({ ...f }));
    setSchema(fresh);
    toast('Form reset to defaults');
  };

  const enrollLink = `${window.location.origin}${window.location.pathname}?enroll=${schoolId}`;
  const [copied, setCopied] = useState(false);
  const copyLink = () => {
    navigator.clipboard.writeText(enrollLink).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const tabs = ['application','student','parent','academic','documents'];

  return (
    <div className="animate-fade-in space-y-5">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-extrabold" style={{ color:'var(--text)' }}>Enrollment Form Builder</h2>
          <p className="text-xs text-gray-400 mt-0.5">Customise the fields shown on your school's online enrollment form</p>
        </div>
        <div className="flex gap-2">
          <button onClick={handleReset} disabled={!canManage}
            className="px-3.5 py-2 rounded-xl border text-xs font-semibold text-gray-600 hover:bg-gray-50 transition-colors disabled:opacity-50"
            style={{ borderColor:'var(--border-strong)' }}>
            Reset to Default
          </button>
          <button onClick={handleSave} disabled={!canManage}
            className="px-4 py-2 rounded-xl text-xs font-bold text-white transition-all hover:opacity-90 disabled:opacity-50"
            style={{ background: themeColor }}>
            Save Form
          </button>
        </div>
      </div>

      {/* Enrollment link card */}
      <Card className="p-4">
        <div className="flex items-start gap-3">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: themeColor + '15' }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={themeColor} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71"/>
              <path d="M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71"/>
            </svg>
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-xs font-bold mb-1" style={{ color:'var(--text)' }}>Enrollment Link</div>
            <div className="flex items-center gap-2">
              <code className="flex-1 text-[11px] px-3 py-2 rounded-lg truncate" style={{ background:'var(--surface-2)', color: themeColor, border:'1px solid var(--border)' }}>
                {enrollLink}
              </code>
              <button onClick={copyLink}
                className="flex-shrink-0 px-3 py-2 rounded-lg text-xs font-bold transition-all"
                style={{ background: copied ? 'var(--tint-green)' : themeColor + '15', color: copied ? 'var(--ok)' : themeColor, border:`1px solid ${copied ? '#a7f3d0' : themeColor + '30'}` }}>
                {copied ? '✓ Copied!' : 'Copy'}
              </button>
            </div>
            <p className="text-[10px] text-gray-400 mt-1.5">Share this link with parents. It opens the enrollment form directly for <strong>{tenant?.name}</strong>.</p>
          </div>
        </div>
      </Card>

      {/* Section tabs */}
      <div className="flex gap-1.5 flex-wrap">
        {tabs.map(sec => (
          <button key={sec} onClick={() => setActiveTab(sec)}
            className="px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all"
            style={activeTab === sec
              ? { background: SECTION_META[sec].color, color:'white' }
              : { background:'var(--surface-3)', color:'var(--text-muted)' }}>
            {SECTION_META[sec].label}
            <span className="ml-1.5 px-1.5 py-0.5 rounded-full text-[9px]"
              style={{ background: activeTab === sec ? 'rgba(255,255,255,0.25)' : 'var(--border-strong)', color: activeTab === sec ? 'white' : 'var(--text-dim)' }}>
              {sectionFields(activeTab === sec ? activeTab : sec).filter(f=>f.enabled).length}/{sectionFields(activeTab === sec ? activeTab : sec).length}
            </span>
          </button>
        ))}
      </div>

      {/* Field list */}
      <Card className="overflow-hidden">
        <div className="px-5 py-3 border-b flex items-center justify-between" style={{ borderColor:'var(--border)', background: SECTION_META[activeTab].color + '08' }}>
          <div>
            <span className="text-sm font-bold" style={{ color: SECTION_META[activeTab].color }}>{SECTION_META[activeTab].label}</span>
            <span className="text-xs text-gray-400 ml-2">{sectionFields(activeTab).filter(f=>f.enabled).length} of {sectionFields(activeTab).length} fields enabled</span>
          </div>
          <button onClick={() => setAddModal(activeTab)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all"
            style={{ background: SECTION_META[activeTab].color + '15', color: SECTION_META[activeTab].color }}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M12 5v14M5 12h14"/></svg>
            Add Field
          </button>
        </div>

        {sectionFields(activeTab).length === 0 && (
          <div className="py-12 text-center text-sm text-gray-400">No fields in this section yet.</div>
        )}

        <div className="divide-y" style={{ borderColor:'var(--border-subtle)' }}>
          {sectionFields(activeTab).map((field) => {
            const absIdx = schema.findIndex(f => f.id === field.id);
            return (
              <div key={field.id} className={`flex items-center gap-3 px-5 py-3.5 transition-colors ${!field.enabled ? 'opacity-50' : ''}`}>
                {/* Drag handles / reorder */}
                <div className="flex flex-col gap-0.5 flex-shrink-0">
                  <button onClick={() => moveUp(field.id)} disabled={absIdx === 0}
                    className="w-5 h-5 flex items-center justify-center rounded text-gray-300 hover:text-gray-500 disabled:opacity-20 transition-colors">
                    <svg width="9" height="9" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M2 8l4-4 4 4"/></svg>
                  </button>
                  <button onClick={() => moveDown(field.id)} disabled={absIdx === schema.length - 1}
                    className="w-5 h-5 flex items-center justify-center rounded text-gray-300 hover:text-gray-500 disabled:opacity-20 transition-colors">
                    <svg width="9" height="9" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M2 4l4 4 4-4"/></svg>
                  </button>
                </div>

                {/* Toggle on/off */}
                <button onClick={() => !field.locked && toggle(field.id)}
                  className="w-9 h-5 rounded-full flex-shrink-0 transition-all relative"
                  style={{ background: field.enabled ? SECTION_META[activeTab].color : 'var(--border-strong)', cursor: field.locked ? 'default' : 'pointer' }}
                  title={field.locked ? 'This field cannot be disabled' : (field.enabled ? 'Disable field' : 'Enable field')}>
                  <span className="absolute top-0.5 w-4 h-4 bg-white rounded-full shadow-xs transition-all"
                    style={{ left: field.enabled ? 'calc(100% - 18px)' : '2px' }} />
                </button>

                {/* Field info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold truncate" style={{ color:'var(--text)' }}>{field.label}</span>
                    {field.locked && <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-gray-100 text-gray-400 font-bold flex-shrink-0">CORE</span>}
                    {field.required && <span className="text-[9px] px-1.5 py-0.5 rounded-full font-bold flex-shrink-0" style={{ background: SECTION_META[activeTab].color + '15', color: SECTION_META[activeTab].color }}>REQUIRED</span>}
                  </div>
                  <div className="text-[10px] text-gray-400 mt-0.5">
                    Type: <span className="font-medium">{field.type}</span>
                    {' · '}ID: <span className="font-mono">{field.id}</span>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-1 flex-shrink-0">
                  {!field.locked && (
                    <button onClick={() => toggleRequired(field.id)}
                      className="px-2 py-1 rounded-lg text-[10px] font-semibold transition-all"
                      style={{ background: field.required ? SECTION_META[activeTab].color + '15' : 'var(--surface-3)', color: field.required ? SECTION_META[activeTab].color : 'var(--text-dim)' }}
                      title="Toggle required">
                      {field.required ? 'Required' : 'Optional'}
                    </button>
                  )}
                  <button onClick={() => setEditField({ ...field })}
                    className="w-7 h-7 flex items-center justify-center rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
                    title="Edit label">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                  </button>
                  {!field.locked && (
                    <button onClick={() => remove(field.id)}
                      className="w-7 h-7 flex items-center justify-center rounded-lg text-gray-300 hover:text-red-500 hover:bg-red-50 transition-colors"
                      title="Remove field">
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M3 6h18M19 6l-1 14H6L5 6M10 11v6M14 11v6M9 6V4h6v2"/></svg>
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </Card>

      {/* Edit label modal */}
      {editField && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background:'rgba(11,15,42,0.55)', backdropFilter:'blur(4px)' }}
          onClick={() => setEditField(null)}>
          <div className="bg-white rounded-2xl w-full max-w-sm shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-6 py-4 border-b" style={{ borderColor:'var(--border)' }}>
              <h3 className="font-bold text-base" style={{ color:'var(--text)' }}>Edit Field Label</h3>
              <button onClick={() => setEditField(null)} className="w-8 h-8 rounded-lg flex items-center justify-center text-gray-400 hover:bg-gray-100">✕</button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1.5">Field Label</label>
                <input autoFocus type="text"
                  value={editField.label}
                  onChange={e => setEditField(f => ({ ...f, label: e.target.value }))}
                  className="w-full px-3 py-2.5 rounded-xl border text-sm outline-none focus:border-[#1E45FC] focus:ring-2 focus:ring-[#1E45FC]/20 transition-all"
                  style={{ borderColor:'var(--border-strong)' }}
                  onKeyDown={e => e.key === 'Enter' && saveLabel(editField.id, editField.label)} />
                <p className="text-[10px] text-gray-400 mt-1">Field ID: <code className="font-mono">{editField.id}</code> · Type: {editField.type}</p>
              </div>
            </div>
            <div className="flex gap-3 px-6 pb-6">
              <button onClick={() => setEditField(null)} className="flex-1 py-2.5 rounded-xl border text-sm font-semibold text-gray-600 hover:bg-gray-50" style={{ borderColor:'var(--border-strong)' }}>Cancel</button>
              <button onClick={() => saveLabel(editField.id, editField.label)} className="flex-1 py-2.5 rounded-xl text-sm font-bold text-white" style={{ background: themeColor }}>Save</button>
            </div>
          </div>
        </div>
      )}

      {/* Add custom field modal */}
      {addModal && <AddCustomFieldModal
        section={addModal}
        sectionMeta={SECTION_META[addModal]}
        onClose={() => setAddModal(null)}
        onAdd={addCustomField}
      />}

      <Toast toasts={toasts} />
    </div>
  );
}

function AddCustomFieldModal({ section, sectionMeta, onClose, onAdd }) {
  const [label, setLabel]     = useState('');
  const [type, setType]       = useState('text');
  const [required, setRequired] = useState(false);
  const [err, setErr]         = useState('');

  const TYPES = [
    { v:'text',      l:'Text Input' },
    { v:'textarea',  l:'Paragraph / Long Text' },
    { v:'tel',       l:'Phone Number' },
    { v:'email',     l:'Email' },
    { v:'date',      l:'Date Picker' },
    { v:'checkbox',  l:'Checkbox (Yes/No)' },
  ];

  const handleAdd = () => {
    if (!label.trim()) { setErr('Label is required.'); return; }
    onAdd(section, label.trim(), type, required);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background:'rgba(11,15,42,0.55)', backdropFilter:'blur(4px)' }}
      onClick={onClose}>
      <div className="bg-white rounded-2xl w-full max-w-sm shadow-2xl" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-4 border-b" style={{ borderColor:'var(--border)' }}>
          <h3 className="font-bold text-base" style={{ color:'var(--text)' }}>Add Custom Field</h3>
          <button onClick={onClose} className="w-8 h-8 rounded-lg flex items-center justify-center text-gray-400 hover:bg-gray-100">✕</button>
        </div>
        <div className="p-6 space-y-4">
          <div>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full text-white" style={{ background: sectionMeta.color }}>{sectionMeta.label}</span>
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1.5">Field Label <span className="text-red-500">*</span></label>
            <input autoFocus type="text" value={label} onChange={e => { setLabel(e.target.value); setErr(''); }}
              placeholder="e.g. Emergency Contact Name"
              className={`w-full px-3 py-2.5 rounded-xl border text-sm outline-none transition-all focus:ring-2 focus:ring-[#1E45FC]/20 ${err ? 'border-red-400 bg-red-50' : 'border-gray-200 focus:border-[#1E45FC]'}`} />
            {err && <p className="text-[11px] text-red-500 mt-1">{err}</p>}
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1.5">Field Type</label>
            <select value={type} onChange={e => setType(e.target.value)}
              className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm outline-none bg-white appearance-none focus:border-[#1E45FC] transition-all">
              {TYPES.map(t => <option key={t.v} value={t.v}>{t.l}</option>)}
            </select>
          </div>
          <label className="flex items-center gap-3 cursor-pointer">
            <div onClick={() => setRequired(r => !r)}
              className="w-5 h-5 rounded flex items-center justify-center flex-shrink-0 transition-all"
              style={{ background: required ? sectionMeta.color : 'white', border: `2px solid ${required ? sectionMeta.color : 'var(--border-strong)'}` }}>
              {required && <svg width="10" height="10" viewBox="0 0 12 12" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round"><path d="M2 6l3 3 5-5"/></svg>}
            </div>
            <span className="text-sm text-gray-600">Mark as required</span>
          </label>
        </div>
        <div className="flex gap-3 px-6 pb-6">
          <button onClick={onClose} className="flex-1 py-2.5 rounded-xl border text-sm font-semibold text-gray-600 hover:bg-gray-50" style={{ borderColor:'var(--border-strong)' }}>Cancel</button>
          <button onClick={handleAdd} className="flex-1 py-2.5 rounded-xl text-sm font-bold text-white" style={{ background: sectionMeta.color }}>Add Field</button>
        </div>
      </div>
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
          <h2 className="text-lg font-extrabold" style={{ color:'var(--text)' }}>Platform Overview</h2>
          <p className="text-sm text-gray-400 mt-0.5">Global · All tenants · May 2026</p>
        </div>
        <span className="text-xs font-bold px-3 py-1.5 rounded-full" style={{ background:'var(--tint-violet)', color:'var(--violet)' }}>SaaS Admin</span>
      </div>

      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
        {[
          { label:'Active Schools',  value:active, delta:'', iconBg:'var(--tint-blue)', iconColor:'#1E45FC', svgPath:'M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z' },
          { label:'Total Students',  value:totalStudents.toLocaleString(), delta:'', iconBg:'var(--tint-green)', iconColor:'#059669', svgPath:'M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2M9 7a4 4 0 100 8 4 4 0 000-8zM23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75' },
          { label:'Platform MRR',    value:`UGX ${(totalMRR/1000000).toFixed(1)}M`, delta:'+12%', sub:'vs last month', iconBg:'var(--tint-amber)', iconColor:'#d97706', svgPath:'M12 1v22M17 5H9.5a3.5 3.5 0 100 7h5a3.5 3.5 0 110 7H6' },
          { label:'Per-student rate', value:`${formatUGX(RATE_RANGE.min)} – ${formatCompactUGX(RATE_RANGE.max)}`, delta:'', sub:BILLING_UNIT, iconBg:'var(--tint-violet)', iconColor:'#7c3aed', svgPath:'M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z' },
        ].map((s,i) => (
          <StatCard key={i} {...s} />
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card className="overflow-hidden">
          <div className="flex items-center justify-between px-5 py-3.5 border-b" style={{ borderColor:'var(--border)' }}>
            <h3 className="font-bold text-sm" style={{ color:'var(--text)' }}>Top Tenants by Students</h3>
          </div>
          {[...tenants].sort((a,b)=>b.student_count-a.student_count).slice(0,4).map((t,i) => (
            <div key={i} className="flex items-center gap-4 px-5 py-3 border-b last:border-0 hover:bg-gray-50/50" style={{ borderColor:'var(--border-subtle)' }}>
              <div className="w-8 h-8 rounded-lg flex items-center justify-center font-bold text-xs text-white flex-shrink-0" style={{ background:'#1E45FC' }}>{t.logo_initials}</div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-semibold truncate" style={{ color:'var(--text)' }}>{t.name}</div>
                <div className="text-xs text-gray-400 font-mono">{t.school_id}</div>
              </div>
              <div className="text-right flex-shrink-0">
                <div className="text-sm font-bold" style={{ color:'var(--text)' }}>{t.student_count.toLocaleString()}</div>
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
            <h3 className="font-bold text-sm" style={{ color:'var(--text)' }}>New School Signups</h3>
            <span className="text-xs font-bold text-green-700 bg-green-50 px-2.5 py-1 rounded-lg">↑ 8 this week</span>
          </div>
          <div className="flex items-end gap-1.5 h-28">
            {bars.map((h,i) => (
              <div key={i} className="flex-1 flex flex-col items-center gap-1">
                <div className="w-full rounded-t-lg" style={{ height:`${h}%`, background: i===5?'#A3CF2E':'var(--tint-blue)', minHeight: 6 }}/>
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
function SaasSchoolsPage({ roleId }) {
  const canManage = can(roleId, 'saas.schools.manage');
  const [schools, setSchools] = useState(queryAllTenants());
  const [onboard, setOnboard] = useState(false);
  const [manage,  setManage]  = useState(null);
  const [suspend, setSuspend] = useState(null);
  const { toasts, show: toast } = useToast();

  const planColor = (id) => getPlan(id).color;
  const planTint  = (id) => getPlan(id).tint;
  const refresh = () => setSchools([...queryAllTenants()]);

  const doSuspend = (t) => {
    const state = evaluateTenant(t.school_id);
    if (state.locked) reactivateTenant(t.school_id);
    else suspendTenant(t.school_id, 'Suspended from the SaaS console');
    refresh();
    toast(`${t.name} ${state.locked ? 'reactivated' : 'suspended'}`);
    setSuspend(null);
  };

  return (
    <div className="animate-fade-in space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-extrabold" style={{ color:'var(--text)' }}>All Schools (Tenants)</h2>
          <p className="text-xs text-gray-400 mt-0.5">{schools.length} registered · tenant isolation enforced</p>
        </div>
        {canManage && (
          <button onClick={() => setOnboard(true)} className="btn-brand-primary text-sm py-2 px-4">+ Onboard School</button>
        )}
      </div>
      <Card className="overflow-hidden">
        <table className="w-full">
          <thead>
            <tr style={{ background:'var(--surface-2)', borderBottom:'1px solid var(--border)' }}>
              {['School / Tenant ID','District','Students','Plan','Status','Term billing','Actions'].map(h => (
                <th key={h} className="text-left px-4 py-3 text-xs font-bold text-gray-400 uppercase tracking-wider">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y" style={{ borderColor:'var(--border-subtle)' }}>
            {schools.map((t,i) => (
              <tr key={i} className="hover:bg-gray-50/50">
                <td className="px-4 py-3">
                  <div className="font-bold text-sm" style={{ color:'var(--text)' }}>{t.name}</div>
                  <div className="text-xs font-mono text-gray-400">{t.school_id}</div>
                </td>
                <td className="px-4 py-3 text-sm text-gray-500">{t.district}</td>
                <td className="px-4 py-3 text-sm font-bold" style={{ color:'var(--text)' }}>{t.student_count.toLocaleString()}</td>
                <td className="px-4 py-3">
                  <span className="text-xs font-bold px-2 py-1 rounded-full" style={{ background:planTint(t.plan), color:planColor(t.plan) }}>{planLabel(t.plan)}</span>
                </td>
                <td className="px-4 py-3">
                  {(() => {
                    const st = evaluateTenant(t.school_id);
                    const meta = statusMeta(st.status);
                    return (
                      <>
                        <span className="text-xs font-bold px-2 py-1 rounded-full" style={{ background: meta.tint, color: meta.color }}>{meta.label}</span>
                        <div className="text-[10px] text-gray-400 mt-1">{statusSentence(st)}</div>
                      </>
                    );
                  })()}
                </td>
                <td className="px-4 py-3 text-sm font-bold" style={{ color:'var(--ok)' }}>{formatUGX(calcBilling(t.school_id))}</td>
                <td className="px-4 py-3">
                  <div className="flex gap-2">
                    {canManage ? (
                      <>
                        <button onClick={() => setManage(t)} className="text-xs font-bold hover:underline" style={{ color:'var(--accent)' }}>Manage →</button>
                        <button onClick={() => setSuspend(t)} className="text-xs text-gray-400 hover:text-red-500 transition-colors">
                          {evaluateTenant(t.school_id).locked ? 'Reactivate' : 'Suspend'}
                        </button>
                      </>
                    ) : <span className="text-xs text-gray-300">View only</span>}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      {/* ONBOARD SCHOOL MODAL */}
      {onboard && (
        <OnboardSchoolModal
          onClose={() => setOnboard(false)}
          onAdd={(t) => { setSchools(ss => [...ss, t]); setOnboard(false); toast(`${t.name} onboarded successfully`); }}
        />
      )}

      {/* MANAGE SCHOOL MODAL */}
      {manage && (
        <ManageSchoolModal
          tenant={manage}
          onClose={() => setManage(null)}
          onChanged={(msg) => { refresh(); toast(msg); }}
        />
      )}

      {/* SUSPEND CONFIRM */}
      {suspend && (
        <ConfirmDialog
          title={evaluateTenant(suspend.school_id).locked ? `Reactivate ${suspend.name}?` : `Suspend ${suspend.name}?`}
          body={evaluateTenant(suspend.school_id).locked
            ? 'This restores full access for this school.'
            : 'This revokes access for every user at this school immediately, except its administrator who can still settle invoices.'}
          confirmLabel={evaluateTenant(suspend.school_id).locked ? 'Reactivate' : 'Suspend'}
          danger={!evaluateTenant(suspend.school_id).locked}
          onConfirm={() => doSuspend(suspend)}
          onClose={() => setSuspend(null)}
        />
      )}
      <Toast toasts={toasts} />
    </div>
  );
}

/* ── Onboard School Modal ─────────────────────────────────── */
function OnboardSchoolModal({ onClose, onAdd }) {
  const [form, setForm] = useState({ name:'', district:'', plan:DEFAULT_PLAN_ID, admin_email:'' });
  const [err, setErr] = useState({});
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const handleAdd = () => {
    const e = {};
    if (!form.name.trim())  e.name  = 'School name is required.';
    if (!form.district.trim()) e.district = 'District is required.';
    setErr(e);
    if (Object.keys(e).length) return;
    onAdd({
      school_id: 'skh-' + Math.random().toString(36).slice(2, 7),
      name: form.name.trim(),
      district: form.district.trim(),
      plan: form.plan,
      status: 'active',
      admin_email: form.admin_email.trim(),
      student_count: 0,
      logo_initials: form.name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase(),
      created_at: new Date().toISOString().slice(0, 10),
    });
  };

  const inputCls = (hasErr) => `w-full px-3 py-2.5 rounded-xl border text-sm outline-none transition-all focus:ring-2 focus:ring-[#1E45FC]/20 ${hasErr ? 'border-red-400 bg-red-50' : 'border-gray-200 focus:border-[#1E45FC]'}`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background:'rgba(11,15,42,0.55)', backdropFilter:'blur(4px)' }}
      onClick={onClose}>
      <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-4 border-b" style={{ borderColor:'var(--border)' }}>
          <h3 className="font-bold text-base" style={{ color:'var(--text)' }}>Onboard New School</h3>
          <button onClick={onClose} className="w-8 h-8 rounded-lg flex items-center justify-center text-gray-400 hover:bg-gray-100">✕</button>
        </div>
        <div className="p-6 space-y-4">
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1.5">School Name <span className="text-red-400">*</span></label>
            <input value={form.name} onChange={e => { set('name', e.target.value); setErr(x => ({ ...x, name: undefined })); }} placeholder="e.g. Kampala High School" className={inputCls(err.name)} />
            {err.name && <p className="text-[11px] text-red-500 mt-1">{err.name}</p>}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1.5">District <span className="text-red-400">*</span></label>
              <input value={form.district} onChange={e => { set('district', e.target.value); setErr(x => ({ ...x, district: undefined })); }} placeholder="e.g. Kampala" className={inputCls(err.district)} />
              {err.district && <p className="text-[11px] text-red-500 mt-1">{err.district}</p>}
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1.5">Plan</label>
              <select value={form.plan} onChange={e => set('plan', e.target.value)} className="w-full px-3 py-2.5 rounded-xl border text-sm bg-white outline-none" style={{ borderColor:'var(--border-strong)' }}>
                {PLANS.map(p => <option key={p.id} value={p.id}>{p.name} — {formatUGX(p.pricePerStudentPerTerm)}/student</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1.5">Admin Email</label>
            <input type="email" value={form.admin_email} onChange={e => set('admin_email', e.target.value)} placeholder="admin@school.ac.ug" className={inputCls()} />
          </div>
        </div>
        <div className="flex gap-3 px-6 pb-6">
          <button onClick={onClose} className="flex-1 py-2.5 rounded-xl border text-sm font-semibold text-gray-600 hover:bg-gray-50" style={{ borderColor:'var(--border-strong)' }}>Cancel</button>
          <button onClick={handleAdd} className="flex-1 py-2.5 rounded-xl text-sm font-bold text-white" style={{ background:'#1E45FC' }}>Onboard School</button>
        </div>
      </div>
    </div>
  );
}

/* ── Manage School Modal — plan assignment, trials, access ── */
function ManageSchoolModal({ tenant, onClose, onChanged }) {
  const [form, setForm] = useState({
    name: tenant.name,
    district: tenant.district,
    admin_email: tenant.admin_email ?? '',
  });
  const [planId, setPlanId] = useState(normalisePlanId(tenant.plan));
  const [effective, setEffective] = useState('next_term');
  const t = queryTenant(tenant.school_id) ?? tenant;
  const state = evaluateTenant(t.school_id);
  const plan = getPlan(planId);
  const changedPlan = planId !== normalisePlanId(t.plan);
  const students = t.student_count;

  const saveProfile = () => {
    Object.assign(t, { name: form.name, district: form.district, admin_email: form.admin_email });
    onChanged('School details updated');
  };
  const applyPlan = () => {
    assignPlan(t.school_id, planId, { effective });
    recordAudit({
      action: AUDIT_ACTIONS.PLAN_ASSIGNED, target: t.name, school_id: t.school_id,
      detail: `${planLabel(planId)} · ${effective === 'next_term' ? 'from next term' : 'immediate'} · ${t.student_count} students`,
      severity: AUDIT_SEVERITY.CRITICAL,
    });
    onChanged(effective === 'next_term'
      ? `${plan.name} scheduled for next term`
      : `Plan changed to ${plan.name} — invoice re-rated`);
  };
  const trial = (days) => {
    extendTrial(t.school_id, days);
    recordAudit({ action: AUDIT_ACTIONS.TRIAL_EXTENDED, target: t.name, school_id: t.school_id, detail: `+${days} days`, severity: AUDIT_SEVERITY.NOTICE });
    onChanged(`Trial extended by ${days} days`);
  };
  const restartTrial = () => {
    startTrial(t.school_id, TRIAL_DAYS);
    recordAudit({ action: AUDIT_ACTIONS.TRIAL_EXTENDED, target: t.name, school_id: t.school_id, detail: `restarted (${TRIAL_DAYS} days)`, severity: AUDIT_SEVERITY.NOTICE });
    onChanged(`${TRIAL_DAYS}-day trial restarted`);
  };
  const doSuspend = () => {
    suspendTenant(t.school_id, 'Suspended from the SaaS console');
    recordAudit({ action: AUDIT_ACTIONS.TENANT_SUSPENDED, target: t.name, school_id: t.school_id, detail: 'access revoked', severity: AUDIT_SEVERITY.CRITICAL });
    onChanged('School suspended — access revoked');
  };
  const doReactivate = () => {
    reactivateTenant(t.school_id);
    recordAudit({ action: AUDIT_ACTIONS.TENANT_REACTIVATED, target: t.name, school_id: t.school_id, severity: AUDIT_SEVERITY.CRITICAL });
    onChanged('School reactivated');
  };

  const meta = statusMeta(state.status);
  const daysToDue = state.nextDueAt ? daysUntil(state.nextDueAt) : null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(11,15,42,0.55)', backdropFilter: 'blur(4px)' }}
      onClick={onClose}>
      <div className="rounded-2xl shadow-2xl w-full max-w-2xl max-h-[92vh] overflow-y-auto"
        style={{ background: 'var(--surface)' }} onClick={e => e.stopPropagation()}>

        <div className="flex items-center justify-between px-6 py-4 border-b" style={{ borderColor: 'var(--border)' }}>
          <div>
            <h3 className="font-bold text-base" style={{ color: 'var(--text)' }}>Manage school</h3>
            <p className="text-xs text-gray-400 font-mono">{t.school_id}</p>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-bold px-2 py-1 rounded-full" style={{ background: meta.tint, color: meta.color }}>{meta.label}</span>
            <button onClick={onClose} className="w-8 h-8 rounded-lg flex items-center justify-center text-gray-400 hover:bg-gray-100">✕</button>
          </div>
        </div>

        <div className="p-6 space-y-5">
          {/* status summary */}
          <div className="rounded-xl px-4 py-3" style={{ background: 'var(--surface-2)' }}>
            <div className="text-xs font-semibold" style={{ color: 'var(--text)' }}>{statusSentence(state)}</div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-3 text-[11px]">
              <div><div style={{ color: 'var(--text-dim)' }}>Students</div><strong style={{ color: 'var(--text)' }}>{students.toLocaleString()}</strong></div>
              <div><div style={{ color: 'var(--text-dim)' }}>Rate</div><strong style={{ color: 'var(--text)' }}>{formatUGX(state.rate)}</strong></div>
              <div><div style={{ color: 'var(--text-dim)' }}>Term cost</div><strong style={{ color: 'var(--text)' }}>{formatUGX(state.termCost)}</strong></div>
              <div><div style={{ color: 'var(--text-dim)' }}>{state.status === SUB_STATUS.TRIAL ? 'Trial ends' : 'Next due'}</div>
                <strong style={{ color: daysToDue != null && daysToDue < 0 ? 'var(--danger)' : 'var(--text)' }}>
                  {dateLabel(state.nextDueAt)}{daysToDue != null ? ` (${daysToDue}d)` : ''}
                </strong></div>
            </div>
          </div>

          {/* school details */}
          <div className="space-y-3">
            <p className="text-xs font-bold uppercase tracking-wider" style={{ color: 'var(--text-dim)' }}>School details</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold mb-1.5" style={{ color: 'var(--text-muted)' }}>School name</label>
                <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                  className="w-full px-3 py-2.5 rounded-xl border text-sm outline-none"
                  style={{ background: 'var(--surface)', borderColor: 'var(--border-strong)', color: 'var(--text)' }} />
              </div>
              <div>
                <label className="block text-xs font-semibold mb-1.5" style={{ color: 'var(--text-muted)' }}>District</label>
                <input value={form.district} onChange={e => setForm(f => ({ ...f, district: e.target.value }))}
                  className="w-full px-3 py-2.5 rounded-xl border text-sm outline-none"
                  style={{ background: 'var(--surface)', borderColor: 'var(--border-strong)', color: 'var(--text)' }} />
              </div>
            </div>
            <div>
              <label className="block text-xs font-semibold mb-1.5" style={{ color: 'var(--text-muted)' }}>Admin email</label>
              <input value={form.admin_email} onChange={e => setForm(f => ({ ...f, admin_email: e.target.value }))}
                placeholder="admin@school.ac.ug" className="w-full px-3 py-2.5 rounded-xl border text-sm outline-none"
                style={{ background: 'var(--surface)', borderColor: 'var(--border-strong)', color: 'var(--text)' }} />
            </div>
            <button onClick={saveProfile} className="text-xs font-bold px-4 py-2 rounded-xl border"
              style={{ borderColor: 'var(--border-strong)', color: 'var(--text-muted)' }}>Save details</button>
          </div>

          {/* plan assignment */}
          <div className="space-y-3 pt-1 border-t" style={{ borderColor: 'var(--border)' }}>
            <div className="flex items-center justify-between pt-4">
              <p className="text-xs font-bold uppercase tracking-wider" style={{ color: 'var(--text-dim)' }}>Assign plan</p>
              {t.pending_plan && (
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full" style={{ background: 'var(--tint-amber)', color: 'var(--warn)' }}>
                  {planLabel(t.pending_plan)} scheduled for next term
                </span>
              )}
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {PLANS.map(p => {
                const active = planId === p.id;
                return (
                  <button key={p.id} onClick={() => setPlanId(p.id)}
                    className="text-left rounded-xl border-2 p-3.5 transition-all"
                    style={{ borderColor: active ? p.color : 'var(--border-strong)', background: active ? p.tint : 'var(--surface)' }}>
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-bold" style={{ color: 'var(--text)' }}>{p.name}</span>
                      {p.badge && <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full"
                        style={{ background: p.badge === 'Most Popular' ? '#A3CF2E' : p.tint, color: p.badge === 'Most Popular' ? '#1a2a00' : p.color }}>{p.badge}</span>}
                    </div>
                    <div className="text-xs font-bold mt-1" style={{ color: 'var(--text)' }}>{formatUGX(p.pricePerStudentPerTerm)}</div>
                    <div className="text-[10px]" style={{ color: 'var(--text-dim)' }}>per student / term</div>
                    <div className="text-[11px] font-semibold mt-2" style={{ color: p.color }}>
                      {formatUGX(calcPlanCost(p.id, students))} / term
                    </div>
                  </button>
                );
              })}
            </div>
            <div className="flex items-end gap-3 flex-wrap">
              <div className="w-52">
                <label className="block text-xs font-semibold mb-1.5" style={{ color: 'var(--text-muted)' }}>Apply from</label>
                <select value={effective} onChange={e => setEffective(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-xl border text-sm outline-none"
                  style={{ background: 'var(--surface)', borderColor: 'var(--border-strong)', color: 'var(--text)' }}>
                  <option value="next_term">Next term (standard)</option>
                  <option value="immediate">Immediately (re-rate invoice)</option>
                </select>
              </div>
              <button onClick={applyPlan} disabled={!changedPlan && effective !== 'next_term'}
                className="text-sm font-bold px-4 py-2.5 rounded-xl text-white disabled:opacity-50" style={{ background: plan.color }}>
                {changedPlan ? `Assign ${plan.name}` : 'Re-apply plan'}
              </button>
            </div>
          </div>

          {/* trial + access controls */}
          <div className="space-y-3 pt-1 border-t" style={{ borderColor: 'var(--border)' }}>
            <p className="text-xs font-bold uppercase tracking-wider pt-4" style={{ color: 'var(--text-dim)' }}>
              Trial &amp; access
            </p>
            <div className="flex flex-wrap gap-2">
              <button onClick={() => trial(7)} className="text-xs font-bold px-3 py-2 rounded-xl border"
                style={{ borderColor: 'var(--border-strong)', color: 'var(--text-muted)' }}>Extend trial +7d</button>
              <button onClick={() => trial(30)} className="text-xs font-bold px-3 py-2 rounded-xl border"
                style={{ borderColor: 'var(--border-strong)', color: 'var(--text-muted)' }}>Extend trial +30d</button>
              <button onClick={restartTrial} className="text-xs font-bold px-3 py-2 rounded-xl border"
                style={{ borderColor: 'var(--border-strong)', color: 'var(--text-muted)' }}>Restart {TRIAL_DAYS}-day trial</button>
              {state.locked
                ? <button onClick={doReactivate} className="text-xs font-bold px-3 py-2 rounded-xl text-white" style={{ background: 'var(--ok)' }}>Reactivate school</button>
                : <button onClick={doSuspend} className="text-xs font-bold px-3 py-2 rounded-xl text-white" style={{ background: 'var(--danger)' }}>Suspend school</button>}
            </div>
            <p className="text-[11px]" style={{ color: 'var(--text-dim)' }}>
              A school is auto-suspended {GRACE_DAYS} days after an unpaid invoice is due. Suspending revokes access for
              every user at the school except its administrator, who can still settle the invoice.
            </p>
          </div>

          <div className="flex gap-3 pt-2">
            <button onClick={onClose} className="flex-1 py-2.5 rounded-xl border text-sm font-semibold"
              style={{ borderColor: 'var(--border-strong)', color: 'var(--text-muted)' }}>Close</button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════
   SAAS — BILLING
═══════════════════════════════════════════════════ */
function SaasBillingPage({ roleId }) {
  const canManage = can(roleId, 'saas.billing.view');
  const [tab, setTab] = useState('invoices');
  const [tick, setTick] = useState(0);                 // re-read the stores after a mutation
  const [payTarget, setPayTarget] = useState(null);
  const [pay, setPay] = useState({ method: PAYMENT_METHODS[0], reference: '' });
  const { toasts, show: toast } = useToast();
  const refresh = () => setTick(t => t + 1);

  const tenants  = queryAllTenants();
  const summary  = billingSummary();
  const invoices = listInvoices();
  const states   = tenants.map(t => ({ tenant: t, state: evaluateTenant(t.school_id) }));

  const runBilling = () => {
    const { created, suspended } = refreshSubscriptions();
    refresh();
    const bits = [];
    if (created.length) bits.push(`${created.length} invoice${created.length === 1 ? '' : 's'} raised`);
    if (suspended.length) bits.push(`${suspended.length} school${suspended.length === 1 ? '' : 's'} suspended`);
    toast(bits.length ? bits.join(' · ') : 'Nothing due — all schools are up to date');
  };

  const settle = () => {
    if (!payTarget) return;
    markInvoicePaid(payTarget.id, { method: pay.method, reference: pay.reference });
    recordAudit({
      action: AUDIT_ACTIONS.INVOICE_PAID, target: `${payTarget.id} · ${payTarget.school_name}`,
      school_id: payTarget.school_id, detail: `${formatUGX(payTarget.amount)} via ${pay.method}`,
      severity: AUDIT_SEVERITY.CRITICAL,
    });
    toast(`${payTarget.id} marked paid — ${payTarget.school_name} reactivated`);
    setPayTarget(null);
    setPay({ method: PAYMENT_METHODS[0], reference: '' });
    refresh();
  };

  const exportInvoices = () => {
    const rows = invoices.map(i => [
      i.id, i.school_name, i.school_id, planLabel(i.plan), i.students, i.rate, i.amount,
      dateLabel(i.issued_at), dateLabel(i.due_at), i.display_status,
    ]);
    downloadCSV('skoulhub-invoices.csv', csvText([
      ['Invoice','School','Tenant ID','Plan','Students','Rate (UGX)','Amount (UGX)','Issued','Due','Status'],
      ...rows,
    ]));
    toast('Invoices exported to CSV');
  };

  const STATS = [
    { label: 'Collected',    value: formatUGX(summary.collected),    sub: `${summary.paidCount} paid`,            color: 'var(--ok)' },
    { label: 'Outstanding',  value: formatUGX(summary.outstanding),  sub: `${summary.dueCount} open`,             color: 'var(--warn)' },
    { label: 'Overdue',      value: formatUGX(summary.overdue),      sub: `${summary.overdueCount} past due date`, color: 'var(--danger)' },
    { label: 'Schools at risk', value: `${summary.atRisk}`,          sub: `${summary.suspended} suspended`,       color: 'var(--violet)' },
  ];

  const TABS = [['invoices', `Invoices (${summary.invoiceCount})`], ['tenants', `By tenant (${tenants.length})`], ['plans', 'By plan']];

  return (
    <div key={tick} className="animate-fade-in space-y-4">
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-lg font-extrabold" style={{ color: 'var(--text)' }}>Billing</h2>
          <p className="text-xs text-gray-400 mt-0.5">
            {formatUGX(RATE_RANGE.min)} – {formatUGX(RATE_RANGE.max)} {BILLING_UNIT} · {TRIAL_DAYS}-day trial · {GRACE_DAYS}-day grace
          </p>
        </div>
        {canManage && (
          <div className="flex gap-2">
            <button onClick={exportInvoices} className="text-xs font-bold px-4 py-2 rounded-xl border"
              style={{ borderColor: 'var(--border-strong)', color: 'var(--text-muted)' }}>Export CSV</button>
            <button onClick={runBilling} className="btn-brand-primary text-xs py-2 px-4">Run billing</button>
          </div>
        )}
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {STATS.map(st => (
          <Card key={st.label} className="p-4">
            <div className="text-xs text-gray-400 mb-1">{st.label}</div>
            <div className="text-lg font-extrabold" style={{ color: 'var(--text)' }}>{st.value}</div>
            <div className="text-[11px] font-semibold mt-0.5" style={{ color: st.color }}>{st.sub}</div>
          </Card>
        ))}
      </div>

      <div className="flex gap-1.5 flex-wrap">
        {TABS.map(([id, label]) => (
          <button key={id} onClick={() => setTab(id)}
            className="px-3.5 py-2 rounded-xl text-xs font-bold transition-all"
            style={tab === id ? { background: '#1E45FC', color: 'white' } : { background: 'var(--surface-2)', color: 'var(--text-muted)' }}>
            {label}
          </button>
        ))}
      </div>

      {tab === 'invoices' && (
        <Card className="overflow-x-auto">
          <table className="w-full min-w-[900px]">
            <thead>
              <tr style={{ background: 'var(--surface-2)', borderBottom: '1px solid var(--border)' }}>
                {['Invoice','School','Plan','Period','Amount','Issued','Due','Status',''].map(h => (
                  <th key={h} className="text-left px-4 py-3 text-[11px] font-bold text-gray-400 uppercase tracking-wider">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y" style={{ borderColor: 'var(--border-subtle)' }}>
              {invoices.length === 0 && (
                <tr><td colSpan={9} className="px-4 py-10 text-center text-sm text-gray-400">
                  No invoices yet — press “Run billing” to raise what is due.
                </td></tr>
              )}
              {invoices.map(inv => {
                const meta = inv.display_status === 'paid'
                  ? { label: 'Paid', color: 'var(--ok)', tint: 'var(--tint-green)' }
                  : inv.display_status === 'overdue'
                    ? { label: 'Overdue', color: 'var(--danger)', tint: 'var(--tint-red)' }
                    : inv.display_status === 'void'
                      ? { label: 'Void', color: 'var(--text-dim)', tint: 'var(--surface-3)' }
                      : { label: 'Due', color: 'var(--warn)', tint: 'var(--tint-amber)' };
                return (
                  <tr key={inv.id} className="hover:bg-gray-50/50">
                    <td className="px-4 py-3 text-xs font-mono font-bold" style={{ color: 'var(--text)' }}>{inv.id}</td>
                    <td className="px-4 py-3">
                      <div className="text-sm font-semibold" style={{ color: 'var(--text)' }}>{inv.school_name}</div>
                      <div className="text-[10px] font-mono text-gray-400">{inv.school_id}</div>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-xs font-bold px-2 py-1 rounded-full"
                        style={{ background: getPlan(inv.plan).tint, color: getPlan(inv.plan).color }}>{planLabel(inv.plan)}</span>
                      <div className="text-[10px] text-gray-400 mt-1">{inv.students.toLocaleString()} × {formatUGX(inv.rate)}</div>
                    </td>
                    <td className="px-4 py-3 text-[11px] text-gray-500">
                      {dateLabel(inv.period_start)} → {dateLabel(inv.period_end)}
                    </td>
                    <td className="px-4 py-3 text-sm font-bold" style={{ color: 'var(--text)' }}>{formatUGX(inv.amount)}</td>
                    <td className="px-4 py-3 text-[11px] text-gray-500">{dateLabel(inv.issued_at)}</td>
                    <td className="px-4 py-3 text-[11px]" style={{ color: inv.display_status === 'overdue' ? 'var(--danger)' : 'var(--text-dim)' }}>
                      {dateLabel(inv.due_at)}
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-[11px] font-bold px-2 py-0.5 rounded-full" style={{ background: meta.tint, color: meta.color }}>{meta.label}</span>
                      {inv.paid_at && <div className="text-[10px] text-gray-400 mt-1">{inv.method} · {inv.reference}</div>}
                    </td>
                    <td className="px-4 py-3">
                      {canManage && inv.status === 'due' && (
                        <button onClick={() => { setPayTarget(inv); setPay({ method: PAYMENT_METHODS[0], reference: '' }); }}
                          className="text-[11px] font-bold px-2.5 py-1 rounded-lg text-white" style={{ background: 'var(--ok)' }}>
                          Mark paid
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </Card>
      )}

      {tab === 'tenants' && (
        <Card className="overflow-x-auto">
          <table className="w-full min-w-[900px]">
            <thead>
              <tr style={{ background: 'var(--surface-2)', borderBottom: '1px solid var(--border)' }}>
                {['School','Plan','Students','Rate','Term cost','Status','Next due',''].map(h => (
                  <th key={h} className="text-left px-4 py-3 text-[11px] font-bold text-gray-400 uppercase tracking-wider">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y" style={{ borderColor: 'var(--border-subtle)' }}>
              {states.map(({ tenant: t, state }) => {
                const meta = statusMeta(state.status);
                const open = openInvoice(t.school_id);
                return (
                  <tr key={t.school_id} className="hover:bg-gray-50/50">
                    <td className="px-4 py-3">
                      <div className="text-sm font-bold" style={{ color: 'var(--text)' }}>{t.name}</div>
                      <div className="text-[10px] font-mono text-gray-400">{t.school_id}</div>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-xs font-bold px-2 py-1 rounded-full"
                        style={{ background: getPlan(t.plan).tint, color: getPlan(t.plan).color }}>{planLabel(t.plan)}</span>
                      {t.pending_plan && <div className="text-[10px] text-gray-400 mt-1">→ {planLabel(t.pending_plan)} next term</div>}
                    </td>
                    <td className="px-4 py-3 text-sm" style={{ color: 'var(--text)' }}>{t.student_count.toLocaleString()}</td>
                    <td className="px-4 py-3 text-xs text-gray-500">{formatUGX(state.rate)}</td>
                    <td className="px-4 py-3 text-sm font-bold" style={{ color: 'var(--text)' }}>{formatUGX(state.termCost)}</td>
                    <td className="px-4 py-3">
                      <span className="text-[11px] font-bold px-2 py-0.5 rounded-full" style={{ background: meta.tint, color: meta.color }}>{meta.label}</span>
                      <div className="text-[10px] text-gray-400 mt-1">{statusSentence(state)}</div>
                    </td>
                    <td className="px-4 py-3 text-[11px] text-gray-500">{dateLabel(state.nextDueAt)}</td>
                    <td className="px-4 py-3">
                      {canManage && open && (
                        <button onClick={() => { setPayTarget(open); setPay({ method: PAYMENT_METHODS[0], reference: '' }); }}
                          className="text-[11px] font-bold px-2.5 py-1 rounded-lg text-white" style={{ background: 'var(--ok)' }}>
                          Record payment
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </Card>
      )}

      {tab === 'plans' && (
        <Card className="p-5">
          <h3 className="font-bold text-sm mb-4" style={{ color: 'var(--text)' }}>Revenue by plan</h3>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {PLANS.map(plan => {
              const onPlan = tenants.filter(t => normalisePlanId(t.plan) === plan.id);
              const revenue = onPlan.reduce((a, t) => a + calcBilling(t.school_id), 0);
              const students = onPlan.reduce((a, t) => a + t.student_count, 0);
              const share = summary.contractedValue ? Math.round((revenue / summary.contractedValue) * 100) : 0;
              return (
                <div key={plan.id} className="rounded-xl border p-4" style={{ borderColor: 'var(--border)', background: 'var(--surface-2)' }}>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-bold px-2 py-1 rounded-full" style={{ background: plan.tint, color: plan.color }}>{plan.name}</span>
                    <span className="text-[10px] text-gray-400">{formatUGX(plan.pricePerStudentPerTerm)}/student</span>
                  </div>
                  <div className="text-lg font-extrabold" style={{ color: 'var(--text)' }}>{formatUGX(revenue)}</div>
                  <div className="text-[11px] text-gray-400 mt-0.5">{onPlan.length} school{onPlan.length !== 1 ? 's' : ''} · {students.toLocaleString()} students</div>
                  <div className="h-1.5 rounded-full mt-3 overflow-hidden" style={{ background: 'var(--surface-3)' }}>
                    <div className="h-full rounded-full" style={{ width: `${share}%`, background: plan.color }} />
                  </div>
                  <div className="text-[10px] text-gray-400 mt-1">{share}% of contracted value</div>
                </div>
              );
            })}
          </div>
        </Card>
      )}

      {/* RECORD PAYMENT MODAL */}
      {payTarget && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4"
          style={{ background: 'rgba(11,15,42,0.55)', backdropFilter: 'blur(4px)' }} onClick={() => setPayTarget(null)}>
          <div className="rounded-2xl shadow-2xl w-full max-w-md p-6" style={{ background: 'var(--surface)' }} onClick={e => e.stopPropagation()}>
            <h3 className="font-bold text-base mb-1" style={{ color: 'var(--text)' }}>Record payment</h3>
            <p className="text-xs mb-4" style={{ color: 'var(--text-muted)' }}>
              {payTarget.id} · {payTarget.school_name} · {planLabel(payTarget.plan)}
            </p>
            <div className="rounded-xl px-4 py-3 mb-4 space-y-1 text-xs" style={{ background: 'var(--surface-2)' }}>
              <div className="flex justify-between"><span style={{ color: 'var(--text-dim)' }}>Students</span>
                <strong style={{ color: 'var(--text)' }}>{payTarget.students.toLocaleString()}</strong></div>
              <div className="flex justify-between"><span style={{ color: 'var(--text-dim)' }}>Rate</span>
                <strong style={{ color: 'var(--text)' }}>{formatUGX(payTarget.rate)}</strong></div>
              <div className="flex justify-between"><span style={{ color: 'var(--text-dim)' }}>Amount due</span>
                <strong style={{ color: 'var(--ok)' }}>{formatUGX(payTarget.amount)}</strong></div>
            </div>
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-semibold mb-1.5" style={{ color: 'var(--text-muted)' }}>Method</label>
                <select value={pay.method} onChange={e => setPay(p => ({ ...p, method: e.target.value }))}
                  className="w-full px-3 py-2.5 rounded-xl border text-sm outline-none"
                  style={{ background: 'var(--surface)', borderColor: 'var(--border-strong)', color: 'var(--text)' }}>
                  {PAYMENT_METHODS.map(m => <option key={m} value={m}>{m}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold mb-1.5" style={{ color: 'var(--text-muted)' }}>Reference (optional)</label>
                <input value={pay.reference} onChange={e => setPay(p => ({ ...p, reference: e.target.value }))}
                  placeholder="MTN-XXXXXXXX" className="w-full px-3 py-2.5 rounded-xl border text-sm font-mono outline-none"
                  style={{ background: 'var(--surface)', borderColor: 'var(--border-strong)', color: 'var(--text)' }} />
              </div>
              <p className="text-[11px]" style={{ color: 'var(--text-dim)' }}>
                Settling this invoice reactivates {payTarget.school_name} for a {TERM_DAYS}-day term.
              </p>
            </div>
            <div className="flex gap-3 mt-5">
              <button onClick={() => setPayTarget(null)} className="flex-1 py-2.5 rounded-xl border text-sm font-semibold"
                style={{ borderColor: 'var(--border-strong)', color: 'var(--text-muted)' }}>Cancel</button>
              <button onClick={settle} className="flex-1 py-2.5 rounded-xl text-sm font-bold text-white" style={{ background: 'var(--ok)' }}>
                Confirm payment
              </button>
            </div>
          </div>
        </div>
      )}

      <Toast toasts={toasts} />
    </div>
  );
}

/* ══════════════════════════════════════════════════
   SAAS — ONBOARDING
═══════════════════════════════════════════════════ */
function SaasOnboardingPage({ roleId }) {
  const canManage = can(roleId, 'saas.onboarding.manage');
  const tenants = queryAllTenants();
  const recent = tenants.slice(-3).reverse();
  const thisMonth = tenants.filter(t => (t.created_at || '').startsWith('2026-05')).length;
  const pending = tenants.filter(t => t.status === 'trial').length;
  const onboarded = tenants.filter(t => t.status === 'active').length;
  const [configModal, setConfigModal] = useState(null);
  const { toasts, show: toast } = useToast();
  return (
    <div className="animate-fade-in space-y-4">
      <div>
        <h2 className="text-lg font-extrabold" style={{ color:'var(--text)' }}>Onboarding</h2>
        <p className="text-xs text-gray-400 mt-0.5">Manage new school provisioning</p>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {[
          { icon:'🚀', label:'Schools This Month', value:thisMonth, color:'var(--accent)' },
          { icon:'⏳', label:'Pending Setup',       value:pending, color:'var(--warn)' },
          { icon:'✅', label:'Fully Onboarded',     value:onboarded, color:'var(--ok)' },
        ].map((s,i) => (
          <Card key={i} className="p-5 flex items-center gap-4">
            <div className="text-3xl">{s.icon}</div>
            <div>
              <div className="text-2xl font-extrabold" style={{ color:'var(--text)' }}>{s.value}</div>
              <div className="text-xs text-gray-400">{s.label}</div>
            </div>
          </Card>
        ))}
      </div>
      <h3 className="font-bold text-sm" style={{ color:'var(--text)' }}>Recently Provisioned</h3>
      <div className="flex flex-col gap-3">
        {recent.map((t,i) => (
          <Card key={i} className="p-4 flex items-center gap-4">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center font-bold text-sm text-white flex-shrink-0" style={{ background:'#1E45FC' }}>{t.logo_initials}</div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-bold" style={{ color:'var(--text)' }}>{t.name}</div>
              <div className="flex items-center gap-3 mt-0.5">
                <span className="text-xs font-mono text-gray-400">{t.school_id}</span>
                <span className="text-xs text-gray-400">·</span>
                <span className="text-xs text-gray-400">{t.created_at}</span>
              </div>
            </div>
            <span className={`text-xs font-bold px-2 py-1 rounded-full ${t.status==='active'?'bg-green-50 text-green-700':'bg-yellow-50 text-yellow-700'}`}>{t.status}</span>
            {canManage
              ? <button onClick={() => setConfigModal(t)} className="text-xs font-bold hover:underline flex-shrink-0" style={{ color:'var(--accent)' }}>Configure →</button>
              : <span className="text-xs text-gray-300 flex-shrink-0">View only</span>}
          </Card>
        ))}
      </div>

      {/* CONFIGURE MODAL */}
      {configModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background:'rgba(11,15,42,0.55)', backdropFilter:'blur(4px)' }}
          onClick={() => setConfigModal(null)}>
          <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-6 py-4 border-b" style={{ borderColor:'var(--border)' }}>
              <div>
                <h3 className="font-bold text-base" style={{ color:'var(--text)' }}>Configure — {configModal.name}</h3>
                <p className="text-xs font-mono text-gray-400">{configModal.school_id}</p>
              </div>
              <button onClick={() => setConfigModal(null)} className="w-8 h-8 rounded-lg flex items-center justify-center text-gray-400 hover:bg-gray-100">✕</button>
            </div>
            <div className="p-6 space-y-4">
              {[
                { label:'SMS Notifications', key:'sms', checked: true },
                { label:'Parent Portal Access', key:'portal', checked: true },
                { label:'Online Fee Payments', key:'payments', checked: normalisePlanId(configModal.plan) !== 'basic' },
                { label:'Bulk Import (CSV)', key:'csv', checked: true },
                { label:'API Access', key:'api', checked: normalisePlanId(configModal.plan) === 'premium' },
              ].map(f => (
                <label key={f.key} className="flex items-center justify-between cursor-pointer">
                  <span className="text-sm font-medium text-gray-700">{f.label}</span>
                  <div className={`relative w-10 h-5 rounded-full transition-all duration-200 ${f.checked ? '' : 'bg-gray-200'}`}
                    style={f.checked ? { background: '#1E45FC' } : {}}>
                    <div className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-all duration-200 ${f.checked ? 'left-5' : 'left-0.5'}`}/>
                  </div>
                </label>
              ))}
            </div>
            <div className="flex gap-3 px-6 pb-6">
              <button onClick={() => setConfigModal(null)} className="flex-1 py-2.5 rounded-xl border text-sm font-semibold text-gray-600 hover:bg-gray-50" style={{ borderColor:'var(--border-strong)' }}>Cancel</button>
              <button onClick={() => { toast(`Configuration saved for ${configModal.name}`); setConfigModal(null); }}
                className="flex-1 py-2.5 rounded-xl text-sm font-bold text-white" style={{ background:'#1E45FC' }}>Save Config</button>
            </div>
          </div>
        </div>
      )}
      <Toast toasts={toasts} />
    </div>
  );
}

/* ══════════════════════════════════════════════════
   SAAS — FEATURE REQUESTS
═══════════════════════════════════════════════════ */
function SaasFeaturesPage({ roleId }) {
  const canManage = can(roleId, 'saas.features.manage');
  const [features, setFeatures] = useState([
    { id:1, title:'Bulk SMS to parents',      votes:24, status:'In Progress', school:"St. Mary's College" },
    { id:2, title:'Parent mobile app',        votes:19, status:'Planned',     school:'Kampala High School' },
    { id:3, title:'Online exam portal',       votes:15, status:'Reviewing',   school:'Arua Public School' },
    { id:4, title:'Payroll auto-calculation', votes:12, status:'Planned',     school:'Makerere Hill School' },
    { id:5, title:'Library management',       votes:8,  status:'Backlog',     school:'Gulu Academy' },
  ]);
  const [updateModal, setUpdateModal] = useState(null);
  const { toasts, show: toast } = useToast();

  const sc = { 'In Progress':'#059669', Planned:'#1E45FC', Reviewing:'#d97706', Backlog:'var(--text-dim)' };
  const sb = { 'In Progress':'var(--tint-green)', Planned:'var(--tint-blue)', Reviewing:'var(--tint-amber)', Backlog:'var(--surface-3)' };
  const statuses = ['Backlog','Reviewing','Planned','In Progress','Shipped'];

  return (
    <div className="animate-fade-in space-y-4">
      <div>
        <h2 className="text-lg font-extrabold" style={{ color:'var(--text)' }}>Feature Requests</h2>
        <p className="text-xs text-gray-400 mt-0.5">Aggregated from all tenants</p>
      </div>
      <div className="flex flex-col gap-3">
        {features.map((f) => (
          <Card key={f.id} className="p-4 flex items-center gap-4 hover:shadow-xs transition-all">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center text-sm font-bold flex-shrink-0" style={{ background:'var(--surface-2)', color:'var(--accent)' }}>{f.votes}</div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-bold" style={{ color:'var(--text)' }}>{f.title}</div>
              <div className="text-xs text-gray-400">{f.school}</div>
            </div>
            <span className="text-xs font-bold px-2 py-1 rounded-full flex-shrink-0" style={{ background:sb[f.status]??'var(--surface-3)', color:sc[f.status]??'var(--text-dim)' }}>{f.status}</span>
            {canManage
              ? <button onClick={() => setUpdateModal({ ...f })} className="text-xs font-bold hover:underline flex-shrink-0" style={{ color:'var(--accent)' }}>Update</button>
              : <span className="text-xs text-gray-300 flex-shrink-0">View only</span>}
          </Card>
        ))}
      </div>

      {/* UPDATE STATUS MODAL */}
      {updateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background:'rgba(11,15,42,0.55)', backdropFilter:'blur(4px)' }}
          onClick={() => setUpdateModal(null)}>
          <div className="bg-white rounded-2xl w-full max-w-sm shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-6 py-4 border-b" style={{ borderColor:'var(--border)' }}>
              <h3 className="font-bold text-base" style={{ color:'var(--text)' }}>Update Feature Status</h3>
              <button onClick={() => setUpdateModal(null)} className="w-8 h-8 rounded-lg flex items-center justify-center text-gray-400 hover:bg-gray-100">✕</button>
            </div>
            <div className="p-6 space-y-4">
              <div className="text-sm font-semibold" style={{ color:'var(--text)' }}>{updateModal.title}</div>
              <div className="text-xs text-gray-400">{updateModal.school} · {updateModal.votes} votes</div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-2">New Status</label>
                <div className="flex flex-col gap-2">
                  {statuses.map(s => (
                    <button key={s} onClick={() => setUpdateModal(m => ({ ...m, status: s }))}
                      className="flex items-center gap-3 px-3 py-2.5 rounded-xl border text-sm font-semibold transition-all text-left"
                      style={updateModal.status === s ? { borderColor: sc[s]??'#1E45FC', background: sb[s]??'var(--tint-blue)', color: sc[s]??'var(--accent)' } : { borderColor:'var(--border-strong)', color:'var(--text-muted)' }}>
                      {updateModal.status === s && <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M20 6L9 17l-5-5"/></svg>}
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            </div>
            <div className="flex gap-3 px-6 pb-6">
              <button onClick={() => setUpdateModal(null)} className="flex-1 py-2.5 rounded-xl border text-sm font-semibold text-gray-600 hover:bg-gray-50" style={{ borderColor:'var(--border-strong)' }}>Cancel</button>
              <button onClick={() => {
                setFeatures(fs => fs.map(f => f.id === updateModal.id ? { ...f, status: updateModal.status } : f));
                toast(`"${updateModal.title}" marked as ${updateModal.status}`);
                setUpdateModal(null);
              }} className="flex-1 py-2.5 rounded-xl text-sm font-bold text-white" style={{ background:'#1E45FC' }}>Save Status</button>
            </div>
          </div>
        </div>
      )}
      <Toast toasts={toasts} />
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
