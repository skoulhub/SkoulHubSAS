/**
 * permissions.js
 * ─────────────────────────────────────────────────────────────
 * Defines every capability in the system and which roles hold it.
 *
 * In production this mirrors backend middleware / RLS policies.
 * The frontend uses it to:
 *   1. Hide/show UI affordances
 *   2. Guard page-level access
 *   3. Show a clear "Access Denied" when a role tries a deep-link
 *
 * Rule: if can(role, 'action') returns false the UI component
 * must NOT render — and the backend would reject the request too.
 * ─────────────────────────────────────────────────────────────
 */

// ── Permission matrix ────────────────────────────────────────
const PERMISSIONS = {
  // ── Students
  'students.view':         ['saas_admin','school_admin','head_teacher','teacher','bursar'],
  'students.create':       ['school_admin','head_teacher'],
  'students.edit':         ['school_admin','head_teacher'],
  'students.delete':       ['school_admin'],

  // ── Parents
  // teacher can view parents, but Dashboard scopes them to assigned-class students only
  'parents.view':          ['school_admin','head_teacher','bursar','teacher'],
  'parents.create':        ['school_admin'],
  'parents.edit':          ['school_admin','head_teacher'],

  // ── Teachers
  // teacher role cannot view the full teacher list — that's admin/head only
  'teachers.view':         ['saas_admin','school_admin','head_teacher'],
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
  'reports.view':          ['school_admin','head_teacher','teacher','parent','bursar'],
  'reports.generate':      ['school_admin','head_teacher'],
  'reports.send':          ['school_admin','head_teacher'],
  'reports.comment_teacher':['teacher'],
  'reports.comment_head':  ['head_teacher','school_admin'],

  // ── Finance — restricted to bursar/accountant only
  'finance.view':          ['bursar','accountant'],
  'finance.record':        ['bursar','accountant'],
  'finance.approve':       ['bursar','accountant'],
  'finance.payroll':       ['bursar','accountant'],

  // ── ID Cards
  'idcards.view':          ['school_admin','head_teacher','bursar'],
  'idcards.generate':      ['school_admin','bursar'],

  // ── Notifications
  'notifs.view':           ['saas_admin','school_admin','head_teacher','teacher','parent','bursar'],
  'notifs.send':           ['school_admin','head_teacher'],

  // ── SaaS Admin only
  'saas.schools.view':     ['saas_admin'],
  'saas.billing.view':     ['saas_admin'],
  'saas.onboarding.manage':['saas_admin'],
  'saas.features.manage':  ['saas_admin'],

  // ── School settings
  'settings.view':         ['school_admin'],
  'settings.edit':         ['school_admin'],
};

/**
 * can(roleId, permission) → boolean
 * Primary permission check used everywhere in the UI.
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
 * navAllowed(roleId, navId) → boolean
 * Maps sidebar nav IDs to the permission that gates them.
 */
const NAV_PERMISSION_MAP = {
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
  schools:    'saas.schools.view',
  billing:    'saas.billing.view',
  onboarding: 'saas.onboarding.manage',
  features:   'saas.features.manage',
  settings:   'settings.view',
};

export function navAllowed(roleId, navId) {
  const perm = NAV_PERMISSION_MAP[navId];
  if (!perm) return true; // 'overview' always allowed
  return can(roleId, perm);
}

/**
 * Human-readable role labels & metadata
 */
export const ROLE_META = {
  saas_admin:   { label: 'SaaS Admin',        color: '#7c3aed', bg: '#f5f3ff', scope: 'global' },
  school_admin: { label: 'School Admin',       color: '#1E45FC', bg: '#e8ecff', scope: 'tenant' },
  head_teacher: { label: 'Head Teacher',       color: '#0891b2', bg: '#e0f2fe', scope: 'tenant' },
  teacher:      { label: 'Teacher',            color: '#059669', bg: '#d1fae5', scope: 'tenant' },
  parent:       { label: 'Parent',             color: '#d97706', bg: '#fef3c7', scope: 'tenant' },
  bursar:       { label: 'Bursar',             color: '#dc2626', bg: '#fee2e2', scope: 'tenant' },
};
