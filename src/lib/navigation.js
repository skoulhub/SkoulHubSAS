/**
 * navigation.js
 * ─────────────────────────────────────────────────────────────
 * Sidebar navigation per role.
 *
 * Kept next to permissions.js so RBAC invariants can assert that
 * every entry a role is offered is actually permitted for that
 * role (see rbac.invariants.test.js). Dashboard.jsx only renders
 * this config — it must not contain nav ids of its own.
 *
 * `section` groups items in the sidebar: main | academic | admin | other.
 * ─────────────────────────────────────────────────────────────
 */

export const NAV_BY_ROLE = {
  saas_admin: [
    { id: 'overview',   label: 'Overview',         section: 'main' },
    { id: 'schools',    label: 'All Schools',       section: 'main' },
    { id: 'billing',    label: 'Billing',           section: 'main' },
    { id: 'onboarding', label: 'Onboarding',        section: 'main' },
    { id: 'features',   label: 'Feature Requests',  section: 'main' },
    { id: 'profile',    label: 'My Profile', section: 'other' },
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
    { id: 'finance',    label: 'Finance',       section: 'admin' },
    { id: 'reports',    label: 'Report Cards',  section: 'academic' },
    { id: 'idcards',    label: 'ID Cards',      section: 'admin' },
    { id: 'enrollment', label: 'Enrollment Form', section: 'admin' },
    { id: 'profile',    label: 'My Profile', section: 'other' },
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
    { id: 'finance',    label: 'Finance',       section: 'admin' },
    { id: 'reports',    label: 'Report Cards',  section: 'academic' },
    { id: 'idcards',    label: 'ID Cards',      section: 'admin' },
    { id: 'profile',    label: 'My Profile', section: 'other' },
    { id: 'notifs',     label: 'Notifications', section: 'other' },
  ],
  teacher: [
    { id: 'overview',   label: 'My Overview',   section: 'main' },
    { id: 'students',   label: 'My Students',   section: 'main' },
    { id: 'attendance', label: 'Attendance',    section: 'main' },
    { id: 'timetable',  label: 'My Timetable',  section: 'academic' },
    { id: 'results',    label: 'Enter Marks',   section: 'academic' },
    { id: 'reports',    label: 'Report Cards',  section: 'academic' },
    { id: 'parents',    label: 'Parents',       section: 'main' },
    { id: 'profile',    label: 'My Profile', section: 'other' },
    { id: 'notifs',     label: 'Notifications', section: 'other' },
  ],
  parent: [
    { id: 'overview',   label: 'My Child',      section: 'main' },
    { id: 'attendance', label: 'Attendance',    section: 'main' },
    { id: 'timetable',  label: 'Timetable',     section: 'main' },
    { id: 'results',    label: 'Results',       section: 'main' },
    { id: 'finance',    label: 'Fee Balance',   section: 'main' },
    { id: 'reports',    label: 'Report Cards',  section: 'main' },
    { id: 'profile',    label: 'My Profile', section: 'other' },
    { id: 'notifs',     label: 'Messages',      section: 'other' },
  ],
  bursar: [
    { id: 'overview',   label: 'Finance Overview', section: 'main' },
    { id: 'finance',    label: 'Payments',          section: 'main' },
    { id: 'students',   label: 'Students',          section: 'main' },
    { id: 'idcards',    label: 'ID Cards',          section: 'main' },
    { id: 'profile',    label: 'My Profile', section: 'other' },
    { id: 'notifs',     label: 'Notifications',     section: 'other' },
  ],
};
