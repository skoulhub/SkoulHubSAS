/**
 * billing.js
 * ─────────────────────────────────────────────────────────────
 * The subscription lifecycle and billing engine for tenants.
 *
 * Lifecycle
 *   trial ──(trial_ends_at)──▶ past_due ──(+GRACE_DAYS)──▶ suspended
 *   active ─(period_end)─────▶ past_due ──(+GRACE_DAYS)──▶ suspended
 *   any ────(invoice paid)───▶ active            (new TERM_DAYS period)
 *
 * • A new school starts on a TRIAL_DAYS (30-day) trial.
 * • When the trial or a paid term ends, access continues through a
 *   GRACE_DAYS (7-day) grace window while payment is chased.
 * • If the invoice is still unpaid after the grace window the tenant is
 *   automatically suspended (auto-revocation) — `locked: true` — and its
 *   users are refused sign-in until an invoice is settled or a SaaS admin
 *   reactivates the school.
 *
 * Everything is evaluated from timestamps on read (`evaluateTenant`), so
 * there is no cron in the demo: calling `refreshSubscriptions()` is what a
 * nightly job would do. In production this module maps to Stripe-style
 * subscriptions + an invoices table.
 * ─────────────────────────────────────────────────────────────
 */
import {
  TRIAL_DAYS, GRACE_DAYS, TERM_DAYS,
  normalisePlanId, planRate, calcPlanCost, formatUGX,
} from './plans';
import { TENANTS, queryTenant, queryAllTenants, generateUUID } from './tenantStore';

export { TRIAL_DAYS, GRACE_DAYS, TERM_DAYS };

export const DAY_MS = 86_400_000;

export const PAYMENT_METHODS = ['Mobile Money', 'Bank Transfer', 'Cash'];

/* Statuses a tenant subscription can be in. */
export const SUB_STATUS = {
  TRIAL:     'trial',
  ACTIVE:    'active',
  PAST_DUE:  'past_due',
  SUSPENDED: 'suspended',
  CANCELLED: 'cancelled',
};

/* ── date helpers ─────────────────────────────────────────── */
export const addDays   = (ms, days) => ms + days * DAY_MS;
export const isoDate   = (ms) => new Date(ms).toISOString().slice(0, 10);
export const dateLabel = (ms) => (ms == null ? '—' : new Date(ms).toLocaleDateString('en-UG', { day: 'numeric', month: 'short', year: 'numeric' }));
/** Whole days from `from` to `to` (positive when `to` is in the future). */
export const daysUntil = (to, from = Date.now()) => Math.ceil((to - from) / DAY_MS);

/* ── invoice store (in-memory, mirrors an `invoices` table) ── */
const INVOICES = [];
let invoiceSeq = 0;

const invoiceId = () => `INV-${String(++invoiceSeq).padStart(5, '0')}`;

/** An invoice is overdue once its due date has passed and it is unpaid. */
export function invoiceStatus(inv, now = Date.now()) {
  if (inv.status !== 'due') return inv.status;
  return now > inv.due_at ? 'overdue' : 'due';
}

export function createInvoice(school_id, {
  kind = 'subscription',
  issueAt = Date.now(),
  dueInDays = GRACE_DAYS,
  periodStart = issueAt,
  periodEnd = addDays(issueAt, TERM_DAYS),
} = {}) {
  const tenant = queryTenant(school_id);
  if (!tenant) return null;
  const plan = normalisePlanId(tenant.plan);
  const invoice = {
    id: invoiceId(),
    school_id,
    school_name: tenant.name,
    kind,                                  // 'subscription' | 'trial_conversion'
    plan,
    students: tenant.student_count,
    rate: planRate(plan),
    amount: calcPlanCost(plan, tenant.student_count),
    period_start: periodStart,
    period_end: periodEnd,
    issued_at: issueAt,
    due_at: addDays(issueAt, dueInDays),
    status: 'due',
    paid_at: null,
    method: null,
    reference: null,
  };
  INVOICES.push(invoice);
  return invoice;
}

export function listInvoices(school_id = null, now = Date.now()) {
  return INVOICES
    .filter(inv => (school_id ? inv.school_id === school_id : true))
    .map(inv => ({ ...inv, display_status: invoiceStatus(inv, now) }))
    .sort((a, b) => b.issued_at - a.issued_at);
}

/**
 * Load invoices from the database. Rows arrive already scoped by RLS; this is
 * a display cache only — settling happens server-side via mark_invoice_paid().
 * The database's vocabulary is mapped onto the one the UI already uses.
 */
export function __setInvoices(rows) {
  if (!Array.isArray(rows)) return;
  const LOCAL = { pending: 'due', overdue: 'due', paid: 'paid', void: 'void' };
  INVOICES.splice(0, INVOICES.length, ...rows.map(r => ({
    id: r.id, school_id: r.school_id, plan: r.plan, students: r.students,
    rate: r.rate, amount: r.amount, issued_at: r.issued_at, due_at: r.due_at,
    paid_at: r.paid_at, method: r.method, reference: r.reference,
    status: LOCAL[r.status] ?? 'due',
  })));
}

export function getInvoice(id) {
  return INVOICES.find(inv => inv.id === id) ?? null;
}

/** Open (unpaid) invoice for a school, newest first. */
export function openInvoice(school_id) {
  return INVOICES
    .filter(inv => inv.school_id === school_id && inv.status === 'due')
    .sort((a, b) => b.issued_at - a.issued_at)[0] ?? null;
}

/**
 * Settle an invoice and reactivate the school for a fresh term.
 * This is what a payment webhook would call.
 */
export function markInvoicePaid(invoiceId, { method = 'Mobile Money', reference = '', now = Date.now() } = {}) {
  const inv = getInvoice(invoiceId);
  if (!inv) return null;
  inv.status = 'paid';
  inv.paid_at = now;
  inv.method = method;
  inv.reference = reference || `TXN-${invoiceId}-${isoDate(now).replace(/-/g, '')}`;

  const tenant = queryTenant(inv.school_id);
  if (tenant) {
    tenant.status = SUB_STATUS.ACTIVE;
    tenant.manual_suspend = false;
    tenant.suspended_reason = null;
    tenant.current_period_start = inv.period_start;
    tenant.current_period_end = inv.period_end;
    tenant.trial_ends_at = null;              // the school is on a paid term now
    tenant.last_payment_at = now;
    tenant.next_due_at = inv.period_end;
    // a plan parked for "next term" takes effect when the new period starts
    if (tenant.pending_plan) {
      tenant.plan = normalisePlanId(tenant.pending_plan);
      tenant.pending_plan = null;
    }
  }
  return inv;
}

/* ── lifecycle ────────────────────────────────────────────── */

/**
 * Derive a tenant's subscription state from its timestamps.
 * Pure — it never mutates; `refreshSubscriptions()` applies the result.
 */
export function _computeTenantState(school_id, now = Date.now()) {
  const tenant = queryTenant(school_id);
  if (!tenant) return null;

  const plan = normalisePlanId(tenant.plan);
  const students = tenant.student_count ?? 0;
  const termCost = calcPlanCost(plan, students);
  const base = {
    school_id, plan, students, rate: planRate(plan), termCost,
    trialEndsAt: null, trialDaysLeft: null, trialProgress: null,
    periodStart: tenant.current_period_start ?? null,
    periodEnd: tenant.current_period_end ?? null,
    daysUntilDue: null, graceEndsAt: null, graceDaysLeft: null,
    nextDueAt: tenant.next_due_at ?? null,
    locked: false, reason: '', outstanding: 0,
  };

  if (tenant.status === SUB_STATUS.CANCELLED) {
    return { ...base, status: SUB_STATUS.CANCELLED, locked: true, reason: 'Subscription cancelled' };
  }

  if (tenant.manual_suspend || tenant.status === SUB_STATUS.SUSPENDED) {
    return {
      ...base,
      status: SUB_STATUS.SUSPENDED,
      locked: true,
      reason: tenant.suspended_reason || 'Suspended by the platform administrator',
      outstanding: openInvoice(school_id)?.amount ?? 0,
    };
  }

  /* ── trial ── (only while no paid period exists) */
  if (tenant.trial_ends_at && !tenant.current_period_end) {
    const trialEndsAt = tenant.trial_ends_at ?? addDays(tenant.created_ms ?? now, TRIAL_DAYS);
    const trialDaysLeft = daysUntil(trialEndsAt, now);
    if (now <= trialEndsAt) {
      return {
        ...base,
        status: SUB_STATUS.TRIAL,
        trialEndsAt, trialDaysLeft,
        trialProgress: 1 - Math.max(0, Math.min(1, trialDaysLeft / TRIAL_DAYS)),
        nextDueAt: trialEndsAt,
      };
    }
    const graceEndsAt = addDays(trialEndsAt, GRACE_DAYS);
    const graceDaysLeft = daysUntil(graceEndsAt, now);
    if (now <= graceEndsAt) {
      return {
        ...base,
        status: SUB_STATUS.PAST_DUE,
        trialEndsAt, trialDaysLeft: 0, graceEndsAt, graceDaysLeft,
        outstanding: termCost, nextDueAt: graceEndsAt,
        reason: `Trial ended — payment due within ${graceDaysLeft} day${graceDaysLeft === 1 ? '' : 's'}`,
      };
    }
    return {
      ...base,
      status: SUB_STATUS.SUSPENDED,
      trialEndsAt, trialDaysLeft: 0, graceEndsAt, graceDaysLeft: 0,
      outstanding: termCost,
      locked: true,
      reason: 'Trial ended and no payment received — access revoked',
    };
  }

  /* ── paid subscription ── */
  const periodEnd = tenant.current_period_end ?? now;
  const daysUntilDue = daysUntil(periodEnd, now);
  if (now <= periodEnd) {
    return { ...base, status: SUB_STATUS.ACTIVE, daysUntilDue };
  }
  const graceEndsAt = addDays(periodEnd, GRACE_DAYS);
  const graceDaysLeft = daysUntil(graceEndsAt, now);
  if (now <= graceEndsAt) {
    return {
      ...base,
      status: SUB_STATUS.PAST_DUE,
      daysUntilDue: 0, graceEndsAt, graceDaysLeft,
      outstanding: termCost, nextDueAt: graceEndsAt,
      reason: `Payment overdue — access ends in ${graceDaysLeft} day${graceDaysLeft === 1 ? '' : 's'}`,
    };
  }
  return {
    ...base,
    status: SUB_STATUS.SUSPENDED,
    daysUntilDue: 0, graceEndsAt, graceDaysLeft: 0,
    outstanding: termCost,
    locked: true,
    reason: 'Subscription unpaid — access revoked',
  };
}

/**
 * Apply derived states back onto the tenants and raise the invoices that a
 * nightly billing job would raise. Idempotent — safe to call on every read.
 * Returns a summary of what changed.
 */
/**
 * The database owns the lifecycle now: a scheduled function runs
 * evaluate_subscriptions() hourly and row level security already refuses data
 * to a tenant that has lapsed. This wrapper keeps the browser from contradicting
 * it in either direction — a wrong client clock must not lock out a paying
 * school, nor let a suspended one in.
 */
export function evaluateTenant(school_id, now = Date.now()) {
  const computed = _computeTenantState(school_id, now);
  if (!computed) return null;

  const dbStatus = queryTenant(school_id)?.status;
  const IN_GOOD_STANDING = ['active', 'trial', 'grace'];

  if (IN_GOOD_STANDING.includes(dbStatus)) {
    // server says they are fine — display it, whatever the local clock thinks
    return { ...computed, locked: false, reason: '', status: dbStatus };
  }
  if (dbStatus && !IN_GOOD_STANDING.includes(dbStatus)) {
    const display = dbStatus === 'expired' ? SUB_STATUS.SUSPENDED : dbStatus;
    return {
      ...computed, locked: true, status: display,
      reason: queryTenant(school_id)?.suspend_reason || computed.reason,
    };
  }
  return computed;
}

export function refreshSubscriptions(now = Date.now()) {
  const created = [];
  const suspended = [];

  for (const tenant of queryAllTenants()) {
    const state = _computeTenantState(tenant.school_id, now);
    if (!state) continue;

    // auto-revocation
    if (state.locked && !tenant.manual_suspend && tenant.status !== SUB_STATUS.CANCELLED) {
      tenant.status = SUB_STATUS.SUSPENDED;
      tenant.suspended_reason = state.reason;
      tenant.suspended_at = now;
      suspended.push(tenant.school_id);
    } else if (!state.locked) {
      tenant.status = state.status;
    }

    // raise the invoice once payment is being chased — including for schools
    // already auto-suspended, so the debt is always visible and settleable
    const owesForLapsedPeriod = state.status === SUB_STATUS.PAST_DUE
      || (state.locked && !tenant.manual_suspend);
    if (owesForLapsedPeriod && !openInvoice(tenant.school_id)) {
      const trialConversion = !!state.trialEndsAt && !tenant.current_period_end;
      created.push(createInvoice(tenant.school_id, {
        kind: trialConversion ? 'trial_conversion' : 'subscription',
        issueAt: state.trialEndsAt ?? state.periodEnd ?? now,
        periodStart: state.trialEndsAt ?? state.periodEnd ?? now,
        periodEnd: addDays(state.trialEndsAt ?? state.periodEnd ?? now, TERM_DAYS),
      }));
    }
  }
  return { created: created.filter(Boolean), suspended };
}

/* ── read models ──────────────────────────────────────────── */

export function tenantBilling(school_id, now = Date.now()) {
  const subscription = _computeTenantState(school_id, now);
  const invoices = listInvoices(school_id, now);
  const open = invoices.find(i => i.status === 'due') ?? null;
  return { subscription, invoices, openInvoice: open };
}

export function billingSummary(now = Date.now()) {
  const invoices = listInvoices(null, now);
  const paid = invoices.filter(i => i.status === 'paid');
  const due = invoices.filter(i => i.status === 'due');
  const overdue = invoices.filter(i => i.display_status === 'overdue');
  const tenants = queryAllTenants();
  const states = tenants.map(t => _computeTenantState(t.school_id, now)).filter(Boolean);

  return {
    collected: paid.reduce((s, i) => s + i.amount, 0),
    outstanding: due.reduce((s, i) => s + i.amount, 0),
    overdue: overdue.reduce((s, i) => s + i.amount, 0),
    paidCount: paid.length,
    dueCount: due.length,
    overdueCount: overdue.length,
    invoiceCount: invoices.length,
    contractedValue: states.reduce((s, st) => s + st.termCost, 0),
    atRisk: states.filter(st => st.status === SUB_STATUS.PAST_DUE).length,
    suspended: states.filter(st => st.locked).length,
    byPlan: tenants.reduce((acc, t) => {
      const id = normalisePlanId(t.plan);
      acc[id] = acc[id] ?? { schools: 0, students: 0, value: 0 };
      acc[id].schools += 1;
      acc[id].students += t.student_count;
      acc[id].value += calcPlanCost(id, t.student_count);
      return acc;
    }, {}),
  };
}

/* ── SaaS admin actions ───────────────────────────────────── */

/**
 * Assign or change a school's plan.
 *   effective 'immediate' → re-rate now (voids the open invoice and issues a
 *                           replacement for a fresh term)
 *   effective 'next_term' → parked on the tenant and applied when the next
 *                           invoice is paid (matches the pricing FAQ)
 */
export function assignPlan(school_id, plan_id, { effective = 'next_term', now = Date.now() } = {}) {
  const tenant = queryTenant(school_id);
  if (!tenant) return null;
  const plan = normalisePlanId(plan_id);
  const previous = normalisePlanId(tenant.plan);

  if (effective === 'next_term' && tenant.status !== SUB_STATUS.TRIAL) {
    tenant.pending_plan = plan;
    return { tenant, previous, plan, applied: 'next_term', invoice: null };
  }

  tenant.plan = plan;
  tenant.pending_plan = null;

  // re-rate the open invoice (if any) for a fresh term from now
  const open = openInvoice(school_id);
  if (open) { open.status = 'void'; open.voided_at = now; }

  let invoice = null;
  if (tenant.status === SUB_STATUS.PAST_DUE || tenant.status === SUB_STATUS.SUSPENDED || open) {
    tenant.current_period_start = now;
    tenant.current_period_end = addDays(now, TERM_DAYS);
    tenant.next_due_at = tenant.current_period_end;
    invoice = createInvoice(school_id, { kind: 'subscription', issueAt: now, periodStart: now, periodEnd: addDays(now, TERM_DAYS) });
  }
  return { tenant, previous, plan, applied: 'immediate', invoice };
}

export function startTrial(school_id, days = TRIAL_DAYS, now = Date.now()) {
  const tenant = queryTenant(school_id);
  if (!tenant) return null;
  tenant.status = SUB_STATUS.TRIAL;
  tenant.manual_suspend = false;
  tenant.suspended_reason = null;
  tenant.trial_ends_at = addDays(now, days);
  tenant.created_ms = tenant.created_ms ?? now;
  return tenant;
}

/** Add days to a running trial (or start one if it already lapsed). */
export function extendTrial(school_id, days, now = Date.now()) {
  const tenant = queryTenant(school_id);
  if (!tenant) return null;
  const from = tenant.trial_ends_at && tenant.trial_ends_at > now ? tenant.trial_ends_at : now;
  tenant.trial_ends_at = addDays(from, days);
  if (tenant.status === SUB_STATUS.SUSPENDED || tenant.status === SUB_STATUS.PAST_DUE) {
    tenant.status = SUB_STATUS.TRIAL;
    tenant.manual_suspend = false;
    tenant.suspended_reason = null;
  }
  return tenant;
}

export function suspendTenant(school_id, reason = 'Suspended by the platform administrator', now = Date.now()) {
  const tenant = queryTenant(school_id);
  if (!tenant) return null;
  tenant.status = SUB_STATUS.SUSPENDED;
  tenant.manual_suspend = true;
  tenant.suspended_reason = reason;
  tenant.suspended_at = now;
  return tenant;
}

export function reactivateTenant(school_id, now = Date.now()) {
  const tenant = queryTenant(school_id);
  if (!tenant) return null;
  tenant.manual_suspend = false;
  tenant.suspended_reason = null;
  const open = openInvoice(school_id);
  if (open) {
    tenant.status = SUB_STATUS.PAST_DUE;              // still owes money
  } else if (tenant.trial_ends_at && now <= addDays(tenant.trial_ends_at, GRACE_DAYS)) {
    tenant.status = SUB_STATUS.TRIAL;
  } else {
    tenant.status = SUB_STATUS.ACTIVE;
    tenant.current_period_start = now;
    tenant.current_period_end = addDays(now, TERM_DAYS);
    tenant.next_due_at = tenant.current_period_end;
  }
  return tenant;
}

/* ── demo/presentational helpers ──────────────────────────── */

export const STATUS_META = {
  trial:     { label: 'Trial',      color: 'var(--warn)',   tint: 'var(--tint-amber)' },
  active:    { label: 'Active',     color: 'var(--ok)',     tint: 'var(--tint-green)' },
  past_due:  { label: 'Past due',   color: 'var(--warn)',   tint: 'var(--tint-amber)' },
  suspended: { label: 'Suspended',  color: 'var(--danger)', tint: 'var(--tint-red)' },
  cancelled: { label: 'Cancelled',  color: 'var(--text-muted)', tint: 'var(--surface-3)' },
};

export const statusMeta = (status) => STATUS_META[status] ?? STATUS_META.active;

/** Human sentence describing where a school stands. */
export function statusSentence(state) {
  if (!state) return '';
  switch (state.status) {
    case SUB_STATUS.TRIAL:     return `${state.trialDaysLeft} day${state.trialDaysLeft === 1 ? '' : 's'} left in the ${TRIAL_DAYS}-day trial`;
    case SUB_STATUS.ACTIVE:    return `Active — renews in ${state.daysUntilDue} day${state.daysUntilDue === 1 ? '' : 's'}`;
    case SUB_STATUS.PAST_DUE:  return state.reason || 'Payment overdue';
    case SUB_STATUS.SUSPENDED: return state.reason || 'Access revoked';
    case SUB_STATUS.CANCELLED: return 'Subscription cancelled';
    default:                   return '';
  }
}

export const money = (n) => formatUGX(n);
export const newId = () => generateUUID();

/** Test/demo helper: wipe the invoice book. */
export function _resetInvoices() {
  INVOICES.length = 0;
  invoiceSeq = 0;
}

/** Exposed for tests that need to seed tenant timestamps directly. */
export const _tenants = TENANTS;
