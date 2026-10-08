import { supabase, isSupabaseConfigured } from './supabase';

/**
 * db.js
 * ─────────────────────────────────────────────────────────────
 * The only module that talks to Supabase. It maps database rows into
 * the shapes the existing UI already renders, so pages did not have to
 * be rewritten to move off the mock store.
 *
 * Scoping is deliberately *not* implemented here. Queries are written
 * without a tenant filter and the database applies it: every policy
 * derives the caller's school from auth.uid(). Adding a client-side
 * `where school_id = …` would only hide bugs, so we don't.
 * ─────────────────────────────────────────────────────────────
 */

const ms = (t) => (t ? Date.parse(t) : null);
const n = (v) => (v === null || v === undefined ? 0 : Number(v));

/* ── row → UI shape ──────────────────────────────────────────── */

export const toTenant = (r) => ({
  school_id: r.id,
  name: r.name,
  short_name: r.short_name,
  plan: r.plan_id,
  status: r.status,
  student_count: r.student_count,
  district: r.contact?.district ?? '',
  admin_email: r.contact?.admin_email ?? '',
  logo_initials: r.short_name || (r.name || '').slice(0, 2).toUpperCase(),
  created_ms: ms(r.created_at),
  trial_ends_at: ms(r.trial_ends_at),
  current_period_start: ms(r.current_period_start),
  current_period_end: ms(r.current_period_end),
  suspended_at: ms(r.suspended_at),
  suspend_reason: r.suspend_reason,
});

export const toStudent = (r) => ({
  id: r.id,
  school_id: r.school_id,
  name: r.name,
  class: r.class ?? '',
  gender: r.gender ?? '',
  parent: r.parent_name ?? r.guardian_name ?? '',
  status: r.status === 'active' ? 'Active' : (r.status ?? 'Active'),
  fee: r.fee_status ?? 'Unpaid',
});

export const toTeacher = (r) => ({
  id: r.id,
  school_id: r.school_id,
  name: r.name,
  subject: r.subject ?? '',
  class: r.class ?? '',
  status: r.status ?? 'Present',
  schedule: r.schedule ?? '',
});

export const toPayment = (r) => ({
  id: r.id,
  school_id: r.school_id,
  student: r.student_name,
  amount: n(r.amount).toLocaleString('en-US'),
  method: r.method ?? '',
  date: r.paid_on ?? '',
  status: r.status ?? 'Pending',
});

export const toParent = (r, childrenByParent = {}) => ({
  id: r.id,
  school_id: r.school_id,
  name: r.name,
  phone: r.phone ?? '',
  email: r.email ?? '',
  children: childrenByParent[r.id] ?? [],
  status: r.status ?? 'Active',
  lastContact: r.last_contact ?? '',
  balance: n(r.balance),
});

export const toInvoice = (r, schoolNames = {}) => ({
  id: r.id,
  school_id: r.school_id,
  school_name: schoolNames[r.school_id] ?? r.school_id,
  plan: r.plan_id,
  students: r.students,
  rate: n(r.rate),
  amount: n(r.amount),
  issued_at: ms(r.issued_at),
  due_at: ms(r.due_at),
  paid_at: ms(r.paid_at),
  method: r.method,
  reference: r.reference,
  status: r.status,
});

export const toProfile = (r) => ({
  user_id: r.id,
  school_id: r.school_id,
  role: r.role,
  name: r.name,
  email: r.email,
  phone: r.phone ?? '',
});

/* ── auth ────────────────────────────────────────────────────── */

const REQUIRED = 'Supabase is not configured — set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.';

export async function signIn(email, password) {
  if (!isSupabaseConfigured) return { error: { message: REQUIRED } };
  const { data, error } = await supabase.auth.signInWithPassword({
    email: String(email).trim().toLowerCase(),
    password,
  });
  // supabase already returns a deliberately vague message; do not enrich it,
  // or we hand attackers an account-enumeration oracle.
  return { session: data?.session ?? null, user: data?.user ?? null, error };
}

export async function signOut() {
  if (!isSupabaseConfigured) return;
  await supabase.auth.signOut();
}

export const currentAuthSession = async () => {
  if (!isSupabaseConfigured) return null;
  const { data } = await supabase.auth.getSession();
  return data?.session ?? null;
};

/* ── hydration ───────────────────────────────────────────────── */

/**
 * Load everything the dashboard needs for the signed-in user, in one pass.
 * RLS decides what comes back: a school admin receives their school only,
 * a parent receives their own children, the operator receives everything.
 */
export async function loadTenantData() {
  if (!isSupabaseConfigured) return null;

  const [schools, profiles, students, teachers, parents, links, payments, invoices] =
    await Promise.all([
      supabase.from('schools').select('*'),
      supabase.from('profiles').select('*'),
      supabase.from('students').select('*').order('name'),
      supabase.from('teachers').select('*').order('name'),
      supabase.from('parents').select('*').order('name'),
      supabase.from('student_parents').select('student_id, parent_id'),
      supabase.from('payments').select('*').order('paid_on', { ascending: false }),
      supabase.from('invoices').select('*').order('issued_at', { ascending: false }),
    ]);

  const failure = [schools, profiles, students, teachers, parents, links, payments, invoices]
    .map(r => r.error).find(Boolean);
  if (failure) return { error: failure };

  // children per parent, for the parent-facing views
  const nameById = Object.fromEntries((students.data ?? []).map(s => [s.id, s.name]));
  const childrenByParent = {};
  for (const l of links.data ?? []) {
    if (!nameById[l.student_id]) continue;
    (childrenByParent[l.parent_id] ??= []).push(nameById[l.student_id]);
  }

  const schoolNames = Object.fromEntries((schools.data ?? []).map(s => [s.id, s.name]));

  const parentsShaped = (parents.data ?? []).map(p => toParent(p, childrenByParent));
  const parentsByProfile = {};
  for (const p of parents.data ?? []) if (p.profile_id) parentsByProfile[p.profile_id] = p;

  const users = {};
  for (const row of profiles.data ?? []) {
    const shaped = toProfile(row);
    const parentRow = parentsByProfile[row.id];
    users[row.email.toLowerCase()] = {
      ...shaped,
      ...(parentRow ? { children: childrenByParent[parentRow.id] ?? [] } : {}),
    };
  }

  return {
    tenants: Object.fromEntries((schools.data ?? []).map(s => [s.id, toTenant(s)])),
    users,
    students: (students.data ?? []).map(toStudent),
    teachers: (teachers.data ?? []).map(toTeacher),
    parents: parentsShaped,
    payments: (payments.data ?? []).map(toPayment),
    invoices: (invoices.data ?? []).map(r => toInvoice(r, schoolNames)),
  };
}

/* ── writes ──────────────────────────────────────────────────── */

const one = async (promise) => {
  const { data, error } = await promise;
  if (error) throw error;
  return data;
};

export const studentsApi = {
  create: (row) => one(supabase.from('students').insert(row).select().single()).then(toStudent),
  update: (id, patch) => one(supabase.from('students').update(patch).eq('id', id).select().single()).then(toStudent),
  remove: (id) => one(supabase.from('students').delete().eq('id', id)),
};

export const parentsApi = {
  create: (row) => one(supabase.from('parents').insert(row).select().single()),
  update: (id, patch) => one(supabase.from('parents').update(patch).eq('id', id).select().single()),
  linkChild: (student_id, parent_id) =>
    one(supabase.from('student_parents').insert({ student_id, parent_id })),
};

export const tenantsApi = {
  /** Operator-only in the database; a school admin calling this will be refused. */
  assignPlan: (school_id, plan_id) =>
    one(supabase.from('schools').update({ plan_id }).eq('id', school_id).select().single()).then(toTenant),
  setStatus: (school_id, status, extra = {}) =>
    one(supabase.from('schools').update({ status, ...extra }).eq('id', school_id).select().single()).then(toTenant),
  updateContact: (school_id, contact) =>
    one(supabase.from('schools').update({ contact }).eq('id', school_id).select().single()).then(toTenant),
  create: (row) => one(supabase.from('schools').insert(row).select().single()).then(toTenant),
};

export const invoicesApi = {
  markPaid: (id, { method, reference }) =>
    one(supabase.from('invoices')
      .update({ status: 'paid', paid_at: new Date().toISOString(), method, reference })
      .eq('id', id).select().single()),
  create: (row) => one(supabase.from('invoices').insert(row).select().single()),
};

export const profileApi = {
  update: (id, patch) => one(supabase.from('profiles').update(patch).eq('id', id).select().single()).then(toProfile),
};

/**
 * Append to the audit trail. The table is append-only (UPDATE/DELETE are
 * revoked), so this is the only operation available against it.
 */
export async function writeAudit(entry) {
  if (!isSupabaseConfigured) return null;
  const { error } = await supabase.from('audit_log').insert(entry);
  if (error) return { error };
  return { ok: true };
}

export const enrollmentApi = {
  /**
   * Public application submission.
   *
   * Runs unauthenticated and is admitted by an INSERT-only policy for schools
   * in good standing. Deliberately does NOT chain .select(): anon has no read
   * policy on this table (applications must not be readable by the public),
   * and asking for the row back would fail the request.
   */
  submit: async ({ school_id, ref, answers }) => {
    if (!isSupabaseConfigured) return { ref };            // offline demo
    const { error } = await supabase.from('enrollments').insert({
      school_id,
      applicant: { ref, ...answers },
    });
    return error ? { error } : { ref };
  },
};

/** Convenience wrapper for the public application form. */
export const submitEnrollment = (payload) => enrollmentApi.submit(payload);

export const auditApi = {
  list: async (limit = 300) => {
    const { data, error } = await supabase
      .from('audit_log').select('*').order('at', { ascending: false }).limit(limit);
    if (error) throw error;
    return data;
  },
};
