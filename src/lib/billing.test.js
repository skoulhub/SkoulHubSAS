import { describe, it, expect, beforeEach } from 'vitest';
import {
  TRIAL_DAYS, GRACE_DAYS, TERM_DAYS, DAY_MS,
  SUB_STATUS, evaluateTenant, refreshSubscriptions, tenantBilling,
  createInvoice, listInvoices, openInvoice, markInvoicePaid, invoiceStatus,
  billingSummary, assignPlan, startTrial, extendTrial, suspendTenant, reactivateTenant,
  statusSentence, _resetInvoices,
} from './billing';
import { provisionTenant, TENANTS, queryTenant } from './tenantStore';
import { calcPlanCost } from './plans';

/** Provision a school with a known enrolment so costs are predictable. */
function makeSchool(name, students = 400, plan = 'standard') {
  const { tenant } = provisionTenant({
    schoolName: name, district: 'Kampala',
    adminEmail: `${name.replace(/\W+/g, '.').toLowerCase()}@test.ug`, adminName: 'Test Admin',
    plan,
  });
  tenant.student_count = students;
  return tenant;
}

beforeEach(() => _resetInvoices());

/* Captured at import time, before any test mutates the seeded tenants. */
const SEEDED_STATUSES = ['skh-001', 'skh-002', 'skh-003', 'skh-004', 'skh-005']
  .map(id => evaluateTenant(id, Date.now()).status);

describe('billing — policy', () => {
  it('runs a 30-day trial with a 7-day grace period over 90-day terms', () => {
    expect(TRIAL_DAYS).toBe(30);
    expect(GRACE_DAYS).toBe(7);
    expect(TERM_DAYS).toBe(90);
  });
});

describe('billing — trial lifecycle', () => {
  it('a newly provisioned school starts a full 30-day trial', () => {
    const school = makeSchool('Trial Start School');
    const state = evaluateTenant(school.school_id, school.created_ms);   // evaluated at provisioning time
    expect(state.status).toBe(SUB_STATUS.TRIAL);
    expect(state.trialDaysLeft).toBe(TRIAL_DAYS);
    expect(state.locked).toBe(false);
    expect(state.outstanding).toBe(0);
  });

  it('stays in trial until the trial end date', () => {
    const now = Date.now();
    const school = makeSchool('Mid Trial School');
    startTrial(school.school_id, 5, now);
    expect(evaluateTenant(school.school_id, now + 4 * DAY_MS).status).toBe(SUB_STATUS.TRIAL);
  });

  it('moves to past_due (grace) when the trial ends, still unlocked', () => {
    const now = Date.now();
    const school = makeSchool('Grace School');
    startTrial(school.school_id, 1, now);
    const state = evaluateTenant(school.school_id, now + 2 * DAY_MS);
    expect(state.status).toBe(SUB_STATUS.PAST_DUE);
    expect(state.locked).toBe(false);
    expect(state.graceDaysLeft).toBe(GRACE_DAYS - 1);
    expect(state.outstanding).toBe(calcPlanCost('standard', 400));
    expect(statusSentence(state)).toMatch(/payment due/i);
  });

  it('auto-revokes access once the grace period lapses', () => {
    const now = Date.now();
    const school = makeSchool('Revoked School');
    startTrial(school.school_id, 1, now);
    const state = evaluateTenant(school.school_id, now + (1 + GRACE_DAYS + 1) * DAY_MS);
    expect(state.status).toBe(SUB_STATUS.SUSPENDED);
    expect(state.locked).toBe(true);
    expect(state.reason).toMatch(/revoked/i);
  });

  it('refreshSubscriptions applies the revocation and raises one invoice (idempotent)', () => {
    const now = Date.now();
    const school = makeSchool('Job School');
    startTrial(school.school_id, 1, now);
    const later = now + 3 * DAY_MS;

    const first = refreshSubscriptions(later);
    expect(first.created.some(i => i.school_id === school.school_id)).toBe(true);
    expect(queryTenant(school.school_id).status).toBe(SUB_STATUS.PAST_DUE);
    expect(listInvoices(school.school_id)).toHaveLength(1);

    refreshSubscriptions(later + 60_000);
    expect(listInvoices(school.school_id)).toHaveLength(1); // no duplicate invoice

    refreshSubscriptions(now + (1 + GRACE_DAYS + 1) * DAY_MS);
    const tenant = queryTenant(school.school_id);
    expect(tenant.status).toBe(SUB_STATUS.SUSPENDED);
    expect(tenant.suspended_reason).toBeTruthy();
  });
});

describe('billing — payments', () => {
  it('settling the invoice reactivates the school for a fresh term', () => {
    const now = Date.now();
    const school = makeSchool('Payer School');
    startTrial(school.school_id, 1, now);
    refreshSubscriptions(now + 2 * DAY_MS);

    const inv = openInvoice(school.school_id);
    expect(inv.amount).toBe(6_000_000);              // 400 students × UGX 15,000
    expect(invoiceStatus(inv)).toBe('due');

    markInvoicePaid(inv.id, { method: 'Mobile Money', reference: 'MTN-123', now: now + 2 * DAY_MS });
    const tenant = queryTenant(school.school_id);
    expect(tenant.status).toBe(SUB_STATUS.ACTIVE);
    expect(tenant.current_period_end - tenant.current_period_start).toBe(TERM_DAYS * DAY_MS);
    expect(tenant.last_payment_at).toBe(now + 2 * DAY_MS);

    const paid = listInvoices(school.school_id)[0];
    expect(paid.status).toBe('paid');
    expect(paid.method).toBe('Mobile Money');
    expect(paid.reference).toBe('MTN-123');
    expect(openInvoice(school.school_id)).toBeNull();
  });

  it('a paid school lapses again when the term ends unpaid', () => {
    const now = Date.now();
    const school = makeSchool('Lapsing School');
    startTrial(school.school_id, 1, now);
    refreshSubscriptions(now + 2 * DAY_MS);
    markInvoicePaid(openInvoice(school.school_id).id, { now: now + 2 * DAY_MS });

    const periodEnd = queryTenant(school.school_id).current_period_end;
    expect(evaluateTenant(school.school_id, periodEnd - DAY_MS).status).toBe(SUB_STATUS.ACTIVE);
    expect(evaluateTenant(school.school_id, periodEnd + DAY_MS).status).toBe(SUB_STATUS.PAST_DUE);
    expect(evaluateTenant(school.school_id, periodEnd + (GRACE_DAYS + 1) * DAY_MS).status).toBe(SUB_STATUS.SUSPENDED);
  });

  it('an unpaid invoice past its due date reads as overdue', () => {
    const now = Date.now();
    const school = makeSchool('Overdue School');
    const inv = createInvoice(school.school_id, { issueAt: now, dueInDays: 3 });
    expect(invoiceStatus(inv, now + 1 * DAY_MS)).toBe('due');
    expect(invoiceStatus(inv, now + 4 * DAY_MS)).toBe('overdue');
    expect(listInvoices(school.school_id, now + 4 * DAY_MS)[0].display_status).toBe('overdue');
  });
});

describe('billing — plan assignment', () => {
  it('parks an upgrade for the next term by default', () => {
    const now = Date.now();
    const school = makeSchool('Upsell School');
    startTrial(school.school_id, 1, now);
    refreshSubscriptions(now + 2 * DAY_MS);
    markInvoicePaid(openInvoice(school.school_id).id, { now: now + 2 * DAY_MS });

    const result = assignPlan(school.school_id, 'premium');
    expect(result.applied).toBe('next_term');
    expect(queryTenant(school.school_id).plan).toBe('standard');       // unchanged for now
    expect(queryTenant(school.school_id).pending_plan).toBe('premium'); // applied at next payment
  });

  it('applies an immediate change and re-rates the open invoice', () => {
    const now = Date.now();
    const school = makeSchool('Immediate School');
    startTrial(school.school_id, 1, now);
    refreshSubscriptions(now + 2 * DAY_MS);
    expect(openInvoice(school.school_id).amount).toBe(6_000_000);

    const result = assignPlan(school.school_id, 'premium', { effective: 'immediate', now: now + 2 * DAY_MS });
    expect(result.applied).toBe('immediate');
    expect(queryTenant(school.school_id).plan).toBe('premium');

    const open = listInvoices(school.school_id).filter(i => i.status === 'due');
    expect(open).toHaveLength(1);                       // the old one was voided
    expect(open[0].amount).toBe(400 * 20000);           // re-rated at Premium
    expect(listInvoices(school.school_id).some(i => i.status === 'void')).toBe(true);
  });

  it('applies a parked plan when the invoice is settled', () => {
    const now = Date.now();
    const school = makeSchool('Parked School');
    startTrial(school.school_id, 1, now);
    refreshSubscriptions(now + 2 * DAY_MS);
    const inv = openInvoice(school.school_id);
    assignPlan(school.school_id, 'basic');              // parked for next term
    markInvoicePaid(inv.id, { now: now + 2 * DAY_MS });
    expect(queryTenant(school.school_id).plan).toBe('basic');
    expect(queryTenant(school.school_id).pending_plan).toBeNull();
  });
});

describe('billing — SaaS admin controls', () => {
  it('suspends and reactivates a school', () => {
    const now = Date.now();
    const school = makeSchool('Manual School');
    expect(evaluateTenant(school.school_id, now).locked).toBe(false);

    suspendTenant(school.school_id, 'Non-payment (manual)');
    const suspended = evaluateTenant(school.school_id, now);
    expect(suspended.status).toBe(SUB_STATUS.SUSPENDED);
    expect(suspended.locked).toBe(true);
    expect(suspended.reason).toBe('Non-payment (manual)');

    reactivateTenant(school.school_id, now);
    expect(evaluateTenant(school.school_id, now).locked).toBe(false);
  });

  it('extends a trial, and restarts it from now if it already lapsed', () => {
    const now = Date.now();
    const school = makeSchool('Extend School');
    startTrial(school.school_id, 10, now);

    extendTrial(school.school_id, 5, now);
    expect(evaluateTenant(school.school_id, now).trialDaysLeft).toBe(15);

    extendTrial(school.school_id, 30, now + 20 * DAY_MS);   // lapsed → from now
    const state = evaluateTenant(school.school_id, now + 20 * DAY_MS);
    expect(state.status).toBe(SUB_STATUS.TRIAL);
    expect(state.trialDaysLeft).toBe(30);
  });
});

describe('billing — reporting', () => {
  it('summarises collected, outstanding and overdue', () => {
    const now = Date.now();
    const a = makeSchool('Summary A', 100, 'basic');     // 1,000,000
    const b = makeSchool('Summary B', 100, 'premium');   // 2,000,000

    const invA = createInvoice(a.school_id, { issueAt: now, dueInDays: 3 });
    createInvoice(b.school_id, { issueAt: now, dueInDays: 30 });
    markInvoicePaid(invA.id, { now: now + DAY_MS });

    const summary = billingSummary(now + 4 * DAY_MS);
    expect(summary.collected).toBe(1_000_000);
    expect(summary.outstanding).toBe(2_000_000);
    expect(summary.overdue).toBe(0);                      // B is due but not yet overdue
    expect(summary.paidCount).toBe(1);
    expect(summary.dueCount).toBe(1);

    const laterSummary = billingSummary(now + 40 * DAY_MS);
    expect(laterSummary.overdue).toBe(2_000_000);
    expect(laterSummary.overdueCount).toBe(1);
    expect(laterSummary.byPlan.basic.schools).toBeGreaterThanOrEqual(1);
  });

  it('tenantBilling returns the subscription, invoices and the open invoice', () => {
    const now = Date.now();
    const school = makeSchool('Report School');
    createInvoice(school.school_id, { issueAt: now });
    const { subscription, invoices, openInvoice: open } = tenantBilling(school.school_id, now);
    expect(subscription.school_id).toBe(school.school_id);
    expect(invoices).toHaveLength(1);
    expect(open.invoice ?? open.id).toBeTruthy();
  });

  it('ships a seeded demo covering the whole lifecycle', () => {
    expect(SEEDED_STATUSES).toContain(SUB_STATUS.ACTIVE);
    expect(SEEDED_STATUSES).toContain(SUB_STATUS.TRIAL);
    expect(SEEDED_STATUSES).toContain(SUB_STATUS.PAST_DUE);
    expect(SEEDED_STATUSES).toContain(SUB_STATUS.SUSPENDED);
    expect(TENANTS['skh-001'].student_count).toBeGreaterThan(0);
  });
});
