/**
 * permissions.js
 * ─────────────────────────────────────────────────────────────
 * The single source of truth for authorisation in the UI.
 *
 * ⚠️  IMPORTANT — this is a PRESENTATION-LAYER policy. There is
 * no backend/API yet, so these checks hide and guard UI
 * affordances only; they are NOT a security boundary. When the
 * API lands, this matrix must be mirrored in server middleware
 * and Postgres RLS policies — the client checks then become
 * advisory hints, never the authority.
 *
 * Conventions:
 *   - `can()` is default-deny: an unknown permission → false.
 *   - `navAllowed()` is default-deny: an unmapped nav id → false.
 *     (`NAV_ALWAYS_ALLOWED` lists the explicitly public screens.)
 *   - Every role in the matrix MUST have a ROLE_META entry and a
 *     NAV_BY_ROLE entry — enforced by rbac.invariants.test.js.
 * ─────────────────────────────────────────────────────────────
 */

// ── Permission matrix ────────────────────────────────────────
export const PERMISSIONS = {
  // ── Students
  'students.view':         ['school_admin','head_teacher','teacher','bursar'],
  'students.create':       ['school_admin','head_teacher'],
  'students.edit':         ['school_admin','head_teacher'],
  'students.delete':       ['school_admin'],

  // ── Parents
  // teacher can view parents, but Dashboard scopes them to assigned-class students only
  'parents.view':          ['school_admin','head_teacher','teacher'],
  'parents.contact':       ['school_admin','head_teacher','teacher'], // 1:1 SMS / email / call log
  'parents.create':        ['school_admin'],
  'parents.edit':          ['school_admin','head_teacher'],

  // ── Teachers
  // teacher role cannot view the full teacher list — that's admin/head only
  'teachers.view':         ['school_admin','head_teacher'],
  'teachers.create':       ['school_admin'],
  'teachers.edit':         ['school_admin','head_teacher'],

  // ── Attendance
  'attendance.view':       ['school_admin','head_teacher','teacher','parent'],
  'attendance.mark':       ['school_admin','head_teacher','teacher'],

  // ── Timetable
  'timetable.view':        ['school_admin','head_teacher','teacher','parent'],
  'timetable.edit':        ['school_admin','head_teacher'],

  // ── Results / Marks
  'results.view':          ['school_admin','head_teacher','teacher','parent'],
  'results.enter':         ['school_admin','head_teacher','teacher'],
  'results.approve':       ['head_teacher','school_admin'],

  // ── Report Cards
  'reports.view':          ['school_admin','head_teacher','teacher','parent'],
  'reports.generate':      ['school_admin','head_teacher'],
  'reports.send':          ['school_admin','head_teacher'],
  'reports.comment_teacher':['teacher'],
  'reports.comment_head':  ['head_teacher','school_admin'],

  // ── Finance — bursar records & submits; head teacher/school admin approve
  //    (segregation of duties: the role that records cannot be the sole approver)
  //    Parents get view-only access; FinancePage scopes them to their own children.
  'finance.view':          ['school_admin','head_teacher','bursar','parent'],
  'finance.record':        ['school_admin','bursar'],
  'finance.approve':       ['school_admin','head_teacher'],
  'finance.payroll':       ['school_admin','bursar'],

  // ── ID Cards
  'idcards.view':          ['school_admin','head_teacher','bursar'],
  'idcards.generate':      ['school_admin','bursar'],

  // ── Notifications
  'notifs.view':           ['saas_admin','school_admin','head_teacher','teacher','parent','bursar'],
  'notifs.send':           ['school_admin','head_teacher'],

  // ── Enrollment form builder (school-admin tool)
  'enrollment.manage':     ['school_admin'],

  // ── SaaS Admin only
  'saas.schools.view':     ['saas_admin'],
  'saas.schools.manage':   ['saas_admin'],
  'saas.billing.view':     ['saas_admin'],
  'saas.onboarding.manage':['saas_admin'],
  'saas.features.manage':  ['saas_admin'],

  // ── School settings
  'settings.view':         ['school_admin'],
  'settings.edit':         ['school_admin'],

  // ── Audit trail — school admins see their own school, SaaS admin sees all
  'audit.view':            ['saas_admin','school_admin'],

  // ── Subscription / billing (tenant-facing plan management)
  'subscription.view':     ['school_admin'],
  'subscription.manage':   ['school_admin'],
};

/**
 * can(roleId, permission) → boolean
 * Primary permission check used everywhere in the UI. Default-deny.
 */
export function can(roleId, permission) {
  const allowed = PERMISSIONS[permission];
  if (!allowed) return false;
  return allowed.includes(roleId);
}

/**
 * canAny(roleId, permissions[]) → boolean
 * True if the role holds at least one of the listed permissions.
 */
export function canAny(roleId, permissions) {
  return permissions.some(p => can(roleId, p));
}

/**
 * Maps every sidebar nav id to the permission that gates it.
 * Anything not listed here is denied (except NAV_ALWAYS_ALLOWED).
 */
export const NAV_PERMISSION_MAP = {
  students:   'students.view',
  parents:    'parents.view',
  teachers:   'teachers.view',
  attendance: 'attendance.view',
  timetable:  'timetable.view',
  results:    'results.view',
  reports:    'reports.view',
  finance:    'finance.view',
  idcards:    'idcards.view',
  notifs:     'notifs.view',
  enrollment: 'enrollment.manage',
  schools:    'saas.schools.view',
  billing:    'saas.billing.view',
  onboarding: 'saas.onboarding.manage',
  features:   'saas.features.manage',
  settings:   'settings.view',
  subscription: 'subscription.view',
  audit:      'audit.view',
};

/** Screens that are public to every authenticated role. */
export const NAV_ALWAYS_ALLOWED = ['overview', 'profile'];

export function navAllowed(roleId, navId) {
  if (NAV_ALWAYS_ALLOWED.includes(navId)) return true;
  const perm = NAV_PERMISSION_MAP[navId];
  if (!perm) return false; // fail closed — never leak an unmapped screen
  return can(roleId, perm);
}

/**
 * Human-readable role labels & metadata.
 * Every role used in PERMISSIONS must appear here (invariant-tested).
 */
export const ROLE_META = {
  saas_admin:   { label: 'SaaS Admin',           color: '#7c3aed', bg: '#f5f3ff', scope: 'global' },
  school_admin: { label: 'School Admin',          color: '#1E45FC', bg: '#e8ecff', scope: 'tenant' },
  head_teacher: { label: 'Head Teacher',          color: '#0891b2', bg: '#e0f2fe', scope: 'tenant' },
  teacher:      { label: 'Teacher',               color: '#059669', bg: '#d1fae5', scope: 'tenant' },
  parent:       { label: 'Parent',                color: '#d97706', bg: '#fef3c7', scope: 'tenant' },
  bursar:       { label: 'Bursar / Accountant',   color: '#dc2626', bg: '#fee2e2', scope: 'tenant' },
};
