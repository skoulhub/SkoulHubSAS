/**
 * audit.js
 * ─────────────────────────────────────────────────────────────
 * Append-only record of privileged and financial actions.
 *
 * Why this exists: the security review found the app had **no audit
 * trail at all** — fee approvals, payments, plan changes and record
 * deletions left no evidence, which makes repudiation total and any
 * dispute uninvestigable (OWASP A09, and a financial-records gap).
 *
 * This is an in-browser ring buffer so the control exists in the
 * prototype. It is NOT tamper-evident and NOT durable: in production
 * this module maps to a server-side, append-only table written by the
 * API, where the client cannot choose what is recorded.
 * ─────────────────────────────────────────────────────────────
 */

export const AUDIT_CAP = 500;

export const AUDIT_SEVERITY = {
  INFO:     'info',      // ordinary privileged action
  NOTICE:   'notice',    // security-relevant (auth, permissions)
  CRITICAL: 'critical',  // money, access revocation, destructive change
};

const ENTRIES = [];
let seq = 0;

/**
 * The signed-in actor, set once at sign-in. A server would derive this from
 * the session/JWT; keeping it ambient means a call site cannot forget to
 * attribute an action (or attribute it to the wrong user).
 */
let CURRENT_ACTOR = { name: 'system', role: null, school_id: null };

export function setAuditActor({ name, role, school_id } = {}) {
  CURRENT_ACTOR = { name: name ?? 'system', role: role ?? null, school_id: school_id ?? null };
}

export const getAuditActor = () => ({ ...CURRENT_ACTOR });

/** Action names are constants so the log stays queryable. */
export const AUDIT_ACTIONS = {
  SIGN_IN:            'auth.sign_in',
  SIGN_OUT:           'auth.sign_out',
  IDLE_SIGN_OUT:      'auth.idle_sign_out',
  MFA_FAILED:         'auth.mfa_failed',
  MFA_LOCKED:         'auth.mfa_locked',
  PASSWORD_CHANGED:   'account.password_changed',
  EMAIL_CHANGED:      'account.email_changed',
  PHONE_CHANGED:      'account.phone_changed',
  MFA_CHANGED:        'account.mfa_changed',
  RECOVERY_CODES:     'account.recovery_codes_regenerated',
  PLAN_ASSIGNED:      'billing.plan_assigned',
  PLAN_SWITCHED:      'billing.plan_switched',
  TRIAL_EXTENDED:     'billing.trial_extended',
  INVOICE_PAID:       'billing.invoice_paid',
  TENANT_SUSPENDED:   'tenant.suspended',
  TENANT_REACTIVATED: 'tenant.reactivated',
  STUDENT_CREATED:    'student.created',
  STUDENT_UPDATED:    'student.updated',
  STUDENT_DELETED:    'student.deleted',
  PARENT_CREATED:     'parent.created',
  PARENT_UPDATED:     'parent.updated',
  RESULTS_APPROVED:   'results.approved',
};

/**
 * Append an entry. Returns it (useful in tests).
 * `detail` should never contain secrets or full PII — record *what happened*,
 * not the data itself.
 */
export function recordAudit({
  action,
  actor = CURRENT_ACTOR.name,
  role = CURRENT_ACTOR.role,
  school_id = CURRENT_ACTOR.school_id,
  target = null,
  detail = null,
  severity = AUDIT_SEVERITY.INFO,
  now = Date.now(),
}) {
  const entry = {
    id: `AUD-${String(++seq).padStart(5, '0')}`,
    at: now,
    action,
    actor,
    role,
    school_id,
    target,
    detail,
    severity,
  };
  ENTRIES.push(entry);
  if (ENTRIES.length > AUDIT_CAP) ENTRIES.splice(0, ENTRIES.length - AUDIT_CAP);
  return entry;
}

/**
 * Read the log, newest first.
 * `school_id` is the tenant scope — callers must pass the signed-in school for
 * tenant roles so one school can never read another's history.
 */
export function listAudit({
  school_id,
  action,
  severity,
  search,
  limit = 200,
} = {}) {
  const needle = search ? search.toLowerCase() : null;
  return ENTRIES
    .filter(e => (school_id === undefined ? true : e.school_id === school_id))
    .filter(e => (action ? e.action === action : true))
    .filter(e => (severity ? e.severity === severity : true))
    .filter(e => (needle
      ? `${e.action} ${e.actor} ${e.target ?? ''} ${e.detail ?? ''}`.toLowerCase().includes(needle)
      : true))
    .slice()
    .reverse()
    .slice(0, limit);
}

export const auditSize = () => ENTRIES.length;

/** Summary counts for the console header. */
export function auditStats(school_id) {
  const scoped = listAudit({ school_id, limit: AUDIT_CAP });
  return {
    total: scoped.length,
    critical: scoped.filter(e => e.severity === AUDIT_SEVERITY.CRITICAL).length,
    notice: scoped.filter(e => e.severity === AUDIT_SEVERITY.NOTICE).length,
  };
}

/** Test helper. */
export function _resetAudit() {
  ENTRIES.length = 0;
  seq = 0;
  CURRENT_ACTOR = { name: 'system', role: null, school_id: null };
}
