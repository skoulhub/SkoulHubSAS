/**
 * tenantStore.js
 * ─────────────────────────────────────────────────────────────
 * Simulates a backend multi-tenant data layer.
 *
 * In production this is replaced by Supabase / Postgres with
 * Row-Level Security policies that enforce:
 *   USING (school_id = auth.jwt() ->> 'school_id')
 *
 * Every table record carries school_id. Every query helper
 * here enforces that filter — the UI never receives data
 * outside the authenticated tenant.
 * ─────────────────────────────────────────────────────────────
 */

import { DEFAULT_PLAN_ID, TRIAL_DAYS, normalisePlanId, planRate, calcPlanCost } from './plans';

// ── UUID v4 generator (crypto.randomUUID with fallback) ──────
export function generateUUID() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  // RFC 4122 compliant fallback
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = (Math.random() * 16) | 0;
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  });
}

// ── Tenant (school) registry ─────────────────────────────────
// Subscription timestamps are seeded relative to load time so the demo
// shows the whole lifecycle: active, in trial, in grace, auto-suspended.
const DAY = 86_400_000;
const _now = Date.now();
const daysFromNow = (d) => _now + d * DAY;
export const TENANTS = {
  'skh-001': {
    school_id:   'skh-001',
    name:        "St. Mary's College Kisubi",
    plan:        'standard',
    status:      'active',
    student_count: 1284,
    created_at:  '2024-01-15',
    admin_email: 'admin@smck.ug',
    district:    'Wakiso',
    logo_initials: 'SM',
    current_period_start: daysFromNow(-45),
    current_period_end:   daysFromNow(45),
    last_payment_at:      daysFromNow(-45),
    next_due_at:          daysFromNow(45),
    created_ms:           daysFromNow(-500),
  },
  'skh-002': {
    school_id:   'skh-002',
    name:        'Arua Public School',
    plan:        'basic',
    status:      'active',
    student_count: 634,
    created_at:  '2024-03-02',
    admin_email: 'admin@arua.ug',
    district:    'Arua',
    logo_initials: 'AP',
    current_period_start: daysFromNow(-78),
    current_period_end:   daysFromNow(12),
    last_payment_at:      daysFromNow(-78),
    next_due_at:          daysFromNow(12),
    created_ms:           daysFromNow(-320),
  },
  'skh-003': {
    school_id:   'skh-003',
    name:        'Kampala High School',
    plan:        'standard',
    status:      'active',
    student_count: 890,
    created_at:  '2024-04-11',
    admin_email: 'admin@khs.ug',
    district:    'Kampala',
    logo_initials: 'KH',
    trial_ends_at:        daysFromNow(18),   // day 12 of a 30-day trial
    created_ms:           daysFromNow(-12),
  },
  'skh-004': {
    school_id:   'skh-004',
    name:        'Gulu Academy',
    plan:        'basic',
    status:      'trial',
    student_count: 210,
    created_at:  '2026-04-28',
    admin_email: 'admin@gulu.ug',
    district:    'Gulu',
    logo_initials: 'GA',
    trial_ends_at:        daysFromNow(-3),   // trial lapsed → grace period
    created_ms:           daysFromNow(-33),
  },
  'skh-005': {
    school_id:   'skh-005',
    name:        'Makerere Hill School',
    plan:        'premium',
    status:      'active',
    student_count: 1050,
    created_at:  '2023-09-01',
    admin_email: 'admin@mhs.ug',
    district:    'Kampala',
    logo_initials: 'MH',
    current_period_start: daysFromNow(-110),
    current_period_end:   daysFromNow(-20),  // unpaid 20 days → auto-suspended
    last_payment_at:      daysFromNow(-110),
    created_ms:           daysFromNow(-400),
  },
};

// ── Per-school enrollment configuration ──────────────────────
// Each school controls which classes they accept applications for,
// their fee structure, intake terms, and contact info shown on the form.
export const SCHOOL_ENROLLMENT_CONFIG = {
  'skh-001': {
    open: true,
    tagline: 'Nurturing excellence since 1956',
    contact: { phone: '+256 414 200 123', email: 'admissions@smck.ug', address: 'Kisubi, Wakiso District' },
    intakeClasses: ['P.1','P.3','P.5','S.1 East','S.1 West','S.2 East','S.3 East','S.5 Arts','S.5 Science'],
    intakeTerms: ['Term 1 2026','Term 2 2026','Term 3 2026'],
    fees: [
      { class: 'P.1–P.7',          boarding: 'UGX 850,000',  dayScholar: 'UGX 420,000' },
      { class: 'S.1–S.4',          boarding: 'UGX 1,200,000', dayScholar: 'UGX 600,000' },
      { class: 'S.5–S.6 (A-Level)',boarding: 'UGX 1,450,000', dayScholar: 'UGX 720,000' },
    ],
    requiresTransferLetter: true,
    themeColor: '#1E45FC',
  },
  'skh-002': {
    open: true,
    tagline: 'Quality education for every child',
    contact: { phone: '+256 476 420 456', email: 'admissions@arua.ug', address: 'Arua City, West Nile' },
    intakeClasses: ['P.1','P.2','P.4','P.6','S.1 East','S.1 West','S.2 East','S.3 East'],
    intakeTerms: ['Term 1 2026','Term 2 2026'],
    fees: [
      { class: 'P.1–P.7', boarding: 'UGX 600,000', dayScholar: 'UGX 280,000' },
      { class: 'S.1–S.4', boarding: 'UGX 900,000', dayScholar: 'UGX 450,000' },
    ],
    requiresTransferLetter: false,
    themeColor: '#059669',
  },
  'skh-003': {
    open: true,
    tagline: "Shaping tomorrow's leaders",
    contact: { phone: '+256 414 333 789', email: 'admissions@khs.ug', address: 'Kampala, Nakawa Division' },
    intakeClasses: ['S.1 East','S.1 West','S.2 East','S.2 West','S.3 East','S.5 Arts','S.5 Science'],
    intakeTerms: ['Term 1 2026','Term 2 2026','Term 3 2026'],
    fees: [
      { class: 'S.1–S.4',          boarding: 'UGX 1,100,000', dayScholar: 'UGX 550,000' },
      { class: 'S.5–S.6 (A-Level)',boarding: 'UGX 1,350,000', dayScholar: 'UGX 680,000' },
    ],
    requiresTransferLetter: true,
    themeColor: '#7c3aed',
  },
  'skh-004': {
    open: false, // applications closed
    tagline: 'Building bright futures in Northern Uganda',
    contact: { phone: '+256 471 432 001', email: 'admissions@gulu.ug', address: 'Gulu City' },
    intakeClasses: ['P.1','P.3','S.1 East'],
    intakeTerms: ['Term 1 2026'],
    fees: [
      { class: 'P.1–P.7', boarding: 'UGX 500,000', dayScholar: 'UGX 220,000' },
      { class: 'S.1–S.4', boarding: 'UGX 750,000', dayScholar: 'UGX 380,000' },
    ],
    requiresTransferLetter: false,
    themeColor: '#d97706',
  },
  'skh-005': {
    open: true,
    tagline: 'Excellence. Integrity. Service.',
    contact: { phone: '+256 414 540 200', email: 'admissions@mhs.ug', address: 'Makerere Hill Road, Kampala' },
    intakeClasses: ['P.1','P.2','P.3','P.4','S.1 East','S.1 West','S.2 East','S.2 West','S.3 East','S.5 Arts','S.5 Science'],
    intakeTerms: ['Term 1 2026','Term 2 2026','Term 3 2026'],
    fees: [
      { class: 'P.1–P.7',          boarding: 'UGX 1,000,000', dayScholar: 'UGX 500,000' },
      { class: 'S.1–S.4',          boarding: 'UGX 1,400,000', dayScholar: 'UGX 700,000' },
      { class: 'S.5–S.6 (A-Level)',boarding: 'UGX 1,600,000', dayScholar: 'UGX 800,000' },
    ],
    requiresTransferLetter: true,
    themeColor: '#0891b2',
  },
};

/** Get enrollment config for a school (returns null if not configured) */
export function getEnrollmentConfig(school_id) {
  return SCHOOL_ENROLLMENT_CONFIG[school_id] ?? null;
}

// ── Teacher assignment map (teacher user_id → assigned scope) ─
// In production this lives in a teacher_assignments table with RLS.
export const TEACHER_ASSIGNMENTS = {
  'u-003': {
    // Grace Namutebi — teacher@smck.ug
    classes:  ['S.3 East', 'S.3 West', 'S.4 West'],
    subjects: ['Mathematics'],
  },
};

/** Get a teacher's assignment by user_id (returns null if not a teacher or no record) */
export function getTeacherAssignment(user_id) {
  return TEACHER_ASSIGNMENTS[user_id] ?? null;
}

// ── Mock users (maps email → user record) ────────────────────
const USERS = {
  'admin@smck.ug':    { user_id: 'u-001', school_id: 'skh-001', role: 'school_admin', name: 'Agnes Namukwaya', email: 'admin@smck.ug',    phone: '+256 700 111 001' },
  'head@smck.ug':     { user_id: 'u-002', school_id: 'skh-001', role: 'head_teacher', name: 'Robert Ssemanda', email: 'head@smck.ug',     phone: '+256 700 111 002' },
  'teacher@smck.ug':  { user_id: 'u-003', school_id: 'skh-001', role: 'teacher',      name: 'Grace Namutebi',  email: 'teacher@smck.ug',  phone: '+256 700 111 003' },
  'parent@smck.ug':   { user_id: 'u-004', school_id: 'skh-001', role: 'parent',       name: 'Peter Kabuye',    email: 'parent@smck.ug',   phone: '+256 700 111 004', children: ['Aisha Nakato', 'Grace Akello'] },
  'bursar@smck.ug':   { user_id: 'u-005', school_id: 'skh-001', role: 'bursar',       name: 'James Okoye',     email: 'bursar@smck.ug',   phone: '+256 700 111 005' },
  'saas@skoulhub.com':{ user_id: 'u-000', school_id: null,      role: 'saas_admin',   name: 'SkoulHub Admin',  email: 'saas@skoulhub.com', phone: '+256 700 111 000' },
};

/**
 * Update a user's profile (name / email / phone …).
 * Re-keys the registry when the email changes so the new address can sign in.
 * In production this is a PATCH /me call with the same re-keying in the DB.
 */
export function updateUserProfile(currentEmail, patch) {
  const key = String(currentEmail ?? '').toLowerCase();
  const user = USERS[key];
  if (!user) return null;

  Object.assign(user, patch);

  if (patch?.email && patch.email.toLowerCase() !== key) {
    const nextKey = patch.email.toLowerCase();
    delete USERS[key];
    user.email = patch.email;
    USERS[nextKey] = user;
  }
  return user;
}

/**
 * Children visible to a parent user (empty for non-parent roles).
 * In production this comes from a parent_students join table with RLS.
 */
export function parentChildren(user) {
  if (!user || user.role !== 'parent') return [];
  return Array.isArray(user.children) ? user.children : [];
}

/* ── Role-scoped queries ────────────────────────────────────────
 * The single place where "which rows may this role see?" is decided.
 * Pages must use these rather than re-implementing the filter, so a
 * new page cannot accidentally leak the whole school to a teacher or
 * parent. Mirrors what per-role RLS would do in production. */

/** Students visible to the given user within a school. */
export function scopedStudents(school_id, user) {
  const all = queryStudents(school_id);
  if (!user) return all;
  if (user.role === 'teacher') {
    const assignment = getTeacherAssignment(user.user_id);
    return assignment ? all.filter(s => assignment.classes.includes(s.class)) : all;
  }
  if (user.role === 'parent') {
    const children = parentChildren(user);
    return all.filter(s => children.includes(s.name));
  }
  return all;
}

/** Parents visible to the given user within a school. */
export function scopedParents(school_id, user) {
  const all = queryParents(school_id);
  if (!user) return all;
  if (user.role === 'teacher') {
    const names = scopedStudents(school_id, user).map(s => s.name);
    return all.filter(p => p.children.some(c => names.includes(c)));
  }
  if (user.role === 'parent') {
    const children = parentChildren(user);
    return all.filter(p => p.children.some(c => children.includes(c)));
  }
  return all;
}

// ── Tenant-scoped data store ──────────────────────────────────
const STUDENTS_DB = [
  { id: 's-01', school_id: 'skh-001', name: 'Aisha Nakato',     class: 'S.1 West', parent: 'Nakato Grace',   status: 'Active', fee: 'Paid' },
  { id: 's-02', school_id: 'skh-001', name: 'Brian Ssemanda',   class: 'S.2 East', parent: 'Ssemanda John',  status: 'Active', fee: 'Partial' },
  { id: 's-03', school_id: 'skh-001', name: 'Catherine Atim',   class: 'S.3 East', parent: 'Atim Stella',    status: 'Active', fee: 'Paid' },
  { id: 's-04', school_id: 'skh-001', name: 'David Opiyo',      class: 'S.1 East', parent: 'Opiyo Moses',    status: 'Inactive', fee: 'Unpaid' },
  { id: 's-05', school_id: 'skh-001', name: 'Esther Namutebi',  class: 'S.4 West', parent: 'Namutebi Rose',  status: 'Active', fee: 'Paid' },
  { id: 's-06', school_id: 'skh-001', name: 'Francis Kiggundu', class: 'S.2 West', parent: 'Kiggundu Paul',  status: 'Active', fee: 'Partial' },
  { id: 's-07', school_id: 'skh-001', name: 'Grace Akello',     class: 'S.3 West', parent: 'Akello Janet',   status: 'Active', fee: 'Paid' },
  { id: 's-08', school_id: 'skh-001', name: 'Henry Mugisha',    class: 'S.1 East', parent: 'Mugisha Robert', status: 'Active', fee: 'Unpaid' },
  { id: 's-09', school_id: 'skh-002', name: 'Ibrahim Okello',   class: 'P.6A',     parent: 'Okello Sam',     status: 'Active', fee: 'Paid' },
  { id: 's-10', school_id: 'skh-002', name: 'Joy Adong',        class: 'P.7B',     parent: 'Adong Mary',     status: 'Active', fee: 'Partial' },
];

const TEACHERS_DB = [
  { id: 't-01', school_id: 'skh-001', name: 'Grace Namutebi',  subject: 'Mathematics', class: 'S.3 / S.4', status: 'Present', schedule: 'Mon, Wed, Fri' },
  { id: 't-02', school_id: 'skh-001', name: 'Joseph Okoye',    subject: 'English',     class: 'S.1 / S.2', status: 'Present', schedule: 'Tue, Thu' },
  { id: 't-03', school_id: 'skh-001', name: 'Stella Akello',   subject: 'Biology',     class: 'S.3 / S.4', status: 'On Leave', schedule: 'Mon, Thu' },
  { id: 't-04', school_id: 'skh-001', name: 'Peter Ssemanda',  subject: 'History',     class: 'S.2 / S.3', status: 'Present', schedule: 'Wed, Fri' },
  { id: 't-05', school_id: 'skh-001', name: 'Irene Nakimera',  subject: 'Chemistry',   class: 'S.4',        status: 'Present', schedule: 'Mon–Fri' },
  { id: 't-06', school_id: 'skh-002', name: 'Moses Ogenga',    subject: 'Science',     class: 'P.6 / P.7', status: 'Present', schedule: 'Mon–Fri' },
];

const PARENTS_DB = [
  { id: 'par-01', school_id: 'skh-001', name: 'Nakato Grace',    phone: '+256 701 234 567', email: 'grace.nakato@gmail.com',   children: ['Aisha Nakato'],            status: 'Active',   lastContact: '2026-05-04', balance: 0 },
  { id: 'par-02', school_id: 'skh-001', name: 'Ssemanda John',   phone: '+256 702 345 678', email: 'john.ssemanda@gmail.com',  children: ['Brian Ssemanda'],          status: 'Active',   lastContact: '2026-05-03', balance: 225000 },
  { id: 'par-03', school_id: 'skh-001', name: 'Atim Stella',     phone: '+256 703 456 789', email: 'stella.atim@yahoo.com',    children: ['Catherine Atim'],          status: 'Active',   lastContact: '2026-05-02', balance: 0 },
  { id: 'par-04', school_id: 'skh-001', name: 'Opiyo Moses',     phone: '+256 704 567 890', email: 'moses.opiyo@gmail.com',    children: ['David Opiyo'],             status: 'Inactive', lastContact: '2026-04-10', balance: 450000 },
  { id: 'par-05', school_id: 'skh-001', name: 'Namutebi Rose',   phone: '+256 705 678 901', email: 'rose.namutebi@gmail.com',  children: ['Esther Namutebi'],         status: 'Active',   lastContact: '2026-05-05', balance: 0 },
  { id: 'par-06', school_id: 'skh-001', name: 'Kiggundu Paul',   phone: '+256 706 789 012', email: 'paul.kiggundu@gmail.com',  children: ['Francis Kiggundu'],        status: 'Active',   lastContact: '2026-05-01', balance: 225000 },
  { id: 'par-07', school_id: 'skh-001', name: 'Akello Janet',    phone: '+256 707 890 123', email: 'janet.akello@yahoo.com',   children: ['Grace Akello'],            status: 'Active',   lastContact: '2026-04-28', balance: 0 },
  { id: 'par-08', school_id: 'skh-001', name: 'Mugisha Robert',  phone: '+256 708 901 234', email: 'robert.mugisha@gmail.com', children: ['Henry Mugisha'],           status: 'Active',   lastContact: '2026-04-20', balance: 450000 },
  { id: 'par-09', school_id: 'skh-002', name: 'Okello Sam',      phone: '+256 709 012 345', email: 'sam.okello@gmail.com',     children: ['Ibrahim Okello'],          status: 'Active',   lastContact: '2026-05-01', balance: 0 },
  { id: 'par-10', school_id: 'skh-002', name: 'Adong Mary',      phone: '+256 710 123 456', email: 'mary.adong@yahoo.com',     children: ['Joy Adong'],               status: 'Active',   lastContact: '2026-04-29', balance: 160000 },
];

const PAYMENTS_DB = [
  { id: 'p-01', school_id: 'skh-001', student: 'Aisha Nakato',     amount: '450,000', method: 'Mobile Money',  date: '2026-05-05', status: 'Confirmed' },
  { id: 'p-02', school_id: 'skh-001', student: 'Brian Ssemanda',   amount: '225,000', method: 'Bank Transfer', date: '2026-05-04', status: 'Confirmed' },
  { id: 'p-03', school_id: 'skh-001', student: 'Catherine Atim',   amount: '450,000', method: 'Cash',          date: '2026-05-03', status: 'Confirmed' },
  { id: 'p-04', school_id: 'skh-001', student: 'David Opiyo',      amount: '150,000', method: 'Mobile Money',  date: '2026-05-02', status: 'Pending' },
  { id: 'p-05', school_id: 'skh-002', student: 'Ibrahim Okello',   amount: '320,000', method: 'Mobile Money',  date: '2026-05-01', status: 'Confirmed' },
];

// ── Query helpers — always enforce school_id filter ──────────
// (Mirrors RLS: SELECT * FROM students WHERE school_id = $school_id)

export function queryStudents(school_id) {
  if (!school_id) return [];
  return STUDENTS_DB.filter(s => s.school_id === school_id);
}

export function queryTeachers(school_id) {
  if (!school_id) return [];
  return TEACHERS_DB.filter(t => t.school_id === school_id);
}

export function queryParents(school_id) {
  if (!school_id) return [];
  return PARENTS_DB.filter(p => p.school_id === school_id);
}

export function queryPayments(school_id) {
  if (!school_id) return [];
  return PAYMENTS_DB.filter(p => p.school_id === school_id);
}

export function queryTenant(school_id) {
  return TENANTS[school_id] ?? null;
}

import { __setInvoices } from './billing';

/**
 * Replace the in-memory fixtures with rows loaded from the database.
 *
 * Clears first, deliberately: merging would let demo fixtures survive into a
 * real session. The database is the only source of truth once signed in.
 */
export function __hydrateStore(data) {
  if (!data) return;
  const swapObj = (target, next) => {
    if (!next) return;
    for (const k of Object.keys(target)) delete target[k];
    Object.assign(target, next);
  };
  const swapArr = (target, next) => {
    if (Array.isArray(next)) target.splice(0, target.length, ...next);
  };
  swapObj(TENANTS, data.tenants);
  swapObj(USERS, data.users);
  swapArr(STUDENTS_DB, data.students);
  swapArr(TEACHERS_DB, data.teachers);
  swapArr(PARENTS_DB, data.parents);
  swapArr(PAYMENTS_DB, data.payments);
  // invoices live in billing.js; it owns their display cache
  if (data.invoices) __setInvoices(data.invoices);
}

/** Merge a single school row (e.g. returned by an RPC) into the cache. */
export function __applyTenant(tenant) {
  if (tenant?.school_id) TENANTS[tenant.school_id] = { ...TENANTS[tenant.school_id], ...tenant };
}

/** True once real data has been loaded (used to gate the UI). */
export const __isHydrated = () => Object.keys(TENANTS).length > 0;

export function queryAllTenants() {
  return Object.values(TENANTS);
}

// ── Tenant provisioning (onboarding) ────────────────────────
export function provisionTenant({ schoolName, district, adminEmail, adminName, plan = DEFAULT_PLAN_ID }) {
  const school_id = 'skh-' + generateUUID().slice(0, 8);
  const tenant = {
    school_id,
    name:          schoolName,
    plan:          normalisePlanId(plan),
    status:        'trial',                    // new schools start on the trial
    trial_ends_at: Date.now() + TRIAL_DAYS * 86_400_000,
    created_ms:    Date.now(),
    student_count: 0,
    created_at:    new Date().toISOString().slice(0, 10),
    admin_email:   adminEmail,
    district,
    logo_initials: schoolName.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase(),
  };
  // Persist to in-memory store
  TENANTS[school_id] = tenant;

  // Create admin user linked to new tenant
  USERS[adminEmail] = {
    user_id:   generateUUID(),
    school_id,
    role:      'school_admin',
    name:      adminName,
  };

  return { tenant, user: USERS[adminEmail] };
}

// ── Auth: strict user lookup (returns null if not enrolled) ──
export function lookupUser(email) {
  return USERS[email.toLowerCase()] ?? null;
}

// ── Auth: resolve user from email+role (demo) ────────────────
export function resolveUser(email) {
  // Only a known user yields a session. An unrecognised address must fail
  // closed here — the UI must never mint a session for an arbitrary email.
  return USERS[String(email ?? '').toLowerCase()] ?? null;
}

// ── Enrollment Form Schema ───────────────────────────────────
// Each field has: id, section, label, type, required, locked (can't be removed), enabled
// Schools can toggle, relabel, reorder, and add custom fields.
export const DEFAULT_FORM_SCHEMA = [
  // ── School / Application section (school-mode: hidden) ──
  { id: 'entry_class',      section: 'application', label: 'Applying for Class',         type: 'class_select',  required: true,  locked: true,  enabled: true },
  { id: 'entry_term',       section: 'application', label: 'Entry Term',                 type: 'term_select',   required: true,  locked: true,  enabled: true },
  { id: 'boarding',         section: 'application', label: 'Residence Type',             type: 'boarding_pick', required: false, locked: true,  enabled: true },
  // ── Student section ──
  { id: 'first_name',       section: 'student', label: 'First Name',                     type: 'text',          required: true,  locked: true,  enabled: true },
  { id: 'last_name',        section: 'student', label: 'Last Name',                      type: 'text',          required: true,  locked: true,  enabled: true },
  { id: 'dob',              section: 'student', label: 'Date of Birth',                  type: 'date',          required: true,  locked: true,  enabled: true },
  { id: 'gender',           section: 'student', label: 'Gender',                         type: 'gender_select', required: true,  locked: true,  enabled: true },
  { id: 'nationality',      section: 'student', label: 'Nationality',                    type: 'nationality_select', required: false, locked: false, enabled: true },
  { id: 'religion',         section: 'student', label: 'Religion',                       type: 'religion_select', required: false, locked: false, enabled: true },
  { id: 'previous_school',  section: 'student', label: 'Previous School',               type: 'text',          required: false, locked: false, enabled: true },
  { id: 'special_needs',    section: 'student', label: 'Special Needs / Medical',        type: 'textarea',      required: false, locked: false, enabled: true },
  // ── Parent / Guardian section ──
  { id: 'parent_name',      section: 'parent', label: 'Parent / Guardian Name',          type: 'text',          required: true,  locked: true,  enabled: true },
  { id: 'relationship',     section: 'parent', label: 'Relationship to Student',         type: 'relationship_select', required: true, locked: true, enabled: true },
  { id: 'parent_phone',     section: 'parent', label: 'Primary Phone',                  type: 'tel',           required: true,  locked: true,  enabled: true },
  { id: 'parent_phone2',    section: 'parent', label: 'Secondary Phone',                type: 'tel',           required: false, locked: false, enabled: true },
  { id: 'parent_email',     section: 'parent', label: 'Email Address',                  type: 'email',         required: false, locked: false, enabled: true },
  { id: 'parent_address',   section: 'parent', label: 'Home Address',                   type: 'text',          required: false, locked: false, enabled: true },
  { id: 'parent_occupation',section: 'parent', label: 'Occupation',                     type: 'text',          required: false, locked: false, enabled: false },
  // ── Academic / Documents section ──
  { id: 'last_school',      section: 'academic', label: 'Last School Attended',          type: 'text',          required: false, locked: false, enabled: true },
  { id: 'last_class',       section: 'academic', label: 'Last Class Completed',          type: 'class_select',  required: false, locked: false, enabled: true },
  { id: 'reason',           section: 'academic', label: 'Reason for Joining / Transfer', type: 'textarea',      required: false, locked: false, enabled: true },
  { id: 'docs_passport',    section: 'documents', label: 'Passport-size photograph (×4)', type: 'checkbox',    required: false, locked: false, enabled: true },
  { id: 'docs_birth',       section: 'documents', label: 'Birth certificate (original + copy)', type: 'checkbox', required: false, locked: false, enabled: true },
  { id: 'docs_reports',     section: 'documents', label: 'Last school report card',      type: 'checkbox',      required: false, locked: false, enabled: true },
  { id: 'docs_transfer',    section: 'documents', label: 'Transfer letter',              type: 'checkbox',      required: false, locked: false, enabled: true },
];

const _formSchemaCache = {}; // in-memory cache (production: use DB)

/** Get the enrollment form schema for a school.
 *  Merges DEFAULT_FORM_SCHEMA with any saved customisations (localStorage). */
export function getFormSchema(school_id) {
  if (!school_id) return DEFAULT_FORM_SCHEMA;
  const key = `enroll_schema_${school_id}`;
  try {
    const saved = localStorage.getItem(key);
    if (saved) {
      const parsed = JSON.parse(saved);
      // Merge: saved fields override defaults; new locked fields added at end
      const savedIds = new Set(parsed.map(f => f.id));
      const newDefaults = DEFAULT_FORM_SCHEMA.filter(f => f.locked && !savedIds.has(f.id));
      return [...parsed, ...newDefaults];
    }
  } catch { /* localStorage unavailable (SSR/private mode) — use defaults */ }
  return DEFAULT_FORM_SCHEMA.map(f => ({ ...f }));
}

/** Persist a customised form schema for a school. */
export function saveFormSchema(school_id, schema) {
  if (!school_id) return;
  const key = `enroll_schema_${school_id}`;
  try {
    localStorage.setItem(key, JSON.stringify(schema));
    _formSchemaCache[school_id] = schema;
  } catch { /* localStorage unavailable — schema not persisted this session */ }
}

// ── Billing calculator ───────────────────────────────────────
/** Term cost for a school, priced at its own plan's per-student rate. */
export function calcBilling(school_id) {
  const tenant = queryTenant(school_id);
  if (!tenant) return 0;
  return calcPlanCost(tenant.plan, tenant.student_count);
}

/** What a school would pay on a different plan (used by the plan switcher). */
export function quoteForPlan(school_id, plan_id) {
  const tenant = queryTenant(school_id);
  if (!tenant) return 0;
  return calcPlanCost(plan_id, tenant.student_count);
}

/** Switch a tenant's plan (up/down-grade at the start of a term). */
export function updateTenantPlan(school_id, plan_id) {
  const tenant = queryTenant(school_id);
  if (!tenant) return null;
  tenant.plan = normalisePlanId(plan_id);
  return tenant;
}

/** Effective per-student rate for a school. */
export function tenantRate(school_id) {
  const tenant = queryTenant(school_id);
  return tenant ? planRate(tenant.plan) : 0;
}
