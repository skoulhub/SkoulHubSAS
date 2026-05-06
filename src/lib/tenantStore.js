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
export const TENANTS = {
  'skh-001': {
    school_id:   'skh-001',
    name:        "St. Mary's College Kisubi",
    plan:        'Growth',
    status:      'active',
    student_count: 1284,
    created_at:  '2024-01-15',
    admin_email: 'admin@smck.ug',
    district:    'Wakiso',
    logo_initials: 'SM',
  },
  'skh-002': {
    school_id:   'skh-002',
    name:        'Arua Public School',
    plan:        'Starter',
    status:      'active',
    student_count: 634,
    created_at:  '2024-03-02',
    admin_email: 'admin@arua.ug',
    district:    'Arua',
    logo_initials: 'AP',
  },
  'skh-003': {
    school_id:   'skh-003',
    name:        'Kampala High School',
    plan:        'Growth',
    status:      'active',
    student_count: 890,
    created_at:  '2024-04-11',
    admin_email: 'admin@khs.ug',
    district:    'Kampala',
    logo_initials: 'KH',
  },
  'skh-004': {
    school_id:   'skh-004',
    name:        'Gulu Academy',
    plan:        'Starter',
    status:      'trial',
    student_count: 210,
    created_at:  '2026-04-28',
    admin_email: 'admin@gulu.ug',
    district:    'Gulu',
    logo_initials: 'GA',
  },
  'skh-005': {
    school_id:   'skh-005',
    name:        'Makerere Hill School',
    plan:        'Enterprise',
    status:      'active',
    student_count: 1050,
    created_at:  '2023-09-01',
    admin_email: 'admin@mhs.ug',
    district:    'Kampala',
    logo_initials: 'MH',
  },
};

// ── Mock users (maps email → user record) ────────────────────
const USERS = {
  'admin@smck.ug':    { user_id: 'u-001', school_id: 'skh-001', role: 'school_admin', name: 'Agnes Namukwaya' },
  'head@smck.ug':     { user_id: 'u-002', school_id: 'skh-001', role: 'head_teacher', name: 'Robert Ssemanda' },
  'teacher@smck.ug':  { user_id: 'u-003', school_id: 'skh-001', role: 'teacher',      name: 'Grace Namutebi' },
  'parent@smck.ug':   { user_id: 'u-004', school_id: 'skh-001', role: 'parent',       name: 'Peter Kabuye' },
  'bursar@smck.ug':   { user_id: 'u-005', school_id: 'skh-001', role: 'bursar',       name: 'James Okoye' },
  'saas@skoulhub.com':{ user_id: 'u-000', school_id: null,      role: 'saas_admin',   name: 'SkoulHub Admin' },
};

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

export function queryAllTenants() {
  return Object.values(TENANTS);
}

// ── Tenant provisioning (onboarding) ────────────────────────
export function provisionTenant({ schoolName, district, adminEmail, adminName, plan = 'Starter' }) {
  const school_id = 'skh-' + generateUUID().slice(0, 8);
  const tenant = {
    school_id,
    name:          schoolName,
    plan,
    status:        'trial',
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
export function resolveUser(email, roleId) {
  // Demo: if email matches a known user, use it; else create a
  // scoped session for the selected role on the first tenant
  const known = USERS[email.toLowerCase()];
  if (known) return known;

  // For demo purposes: map role to default tenant skh-001
  // (In prod this would fail with 401 if user not found)
  const fallbackSchool = roleId === 'saas_admin' ? null : 'skh-001';
  return {
    user_id:   generateUUID(),
    school_id: fallbackSchool,
    role:      roleId,
    name:      email.split('@')[0],
  };
}

// ── Billing calculator ───────────────────────────────────────
export const BILLING_RATE = 15000; // UGX per student per term

export function calcBilling(school_id) {
  const tenant = queryTenant(school_id);
  if (!tenant) return 0;
  return tenant.student_count * BILLING_RATE;
}
