import { isSupabaseConfigured, supabase } from './supabase';
import { toTenant } from './db';
import { __applyTenant } from './tenantStore';
import {
  assignPlan as localAssignPlan,
  suspendTenant as localSuspend,
  reactivateTenant as localReactivate,
  startTrial as localStartTrial,
  extendTrial as localExtendTrial,
  markInvoicePaid as localMarkPaid,
  __applyInvoice,
} from './billing';

/**
 * billingActions.js
 * ─────────────────────────────────────────────────────────────
 * Every billing action the operator console can take, with one rule: when a
 * backend is configured it goes to the database, and the UI only changes once
 * the database has accepted the change.
 *
 * These used to call the local store directly. The screen updated, the toast
 * said "School suspended", and nothing was persisted — the most dangerous
 * shape of bug, because it looks like it worked.
 *
 * Each action returns { ok } or { ok: false, error }. Callers surface the
 * error rather than reporting success they did not get.
 *
 * The local store is still updated, but from the row the database returns, so
 * the cache cannot drift from the truth.
 */

const offline = () => !isSupabaseConfigured;

const fail = (error) => ({ ok: false, error: error ?? { message: 'The change was rejected.' } });

export async function applyPlan(schoolId, planId, { effective = 'next_term' } = {}) {
  if (offline()) {
    localAssignPlan(schoolId, planId, { effective });
    return { ok: true, offline: true };
  }
  const { data, error } = await supabase.rpc('assign_plan', {
    p_school: schoolId,
    p_plan: planId,
    p_immediate: effective === 'immediate',
  });
  if (error) return fail(error);
  __applyTenant(toTenant(data));
  return { ok: true, tenant: toTenant(data) };
}

export async function setTenantStatus(schoolId, status, reason = null) {
  if (offline()) {
    if (status === 'suspended') localSuspend(schoolId, reason ?? undefined);
    else localReactivate(schoolId);
    return { ok: true, offline: true };
  }
  const { data, error } = await supabase.rpc('set_tenant_status', {
    p_school: schoolId, p_status: status, p_reason: reason,
  });
  if (error) return fail(error);
  __applyTenant(toTenant(data));
  return { ok: true, tenant: toTenant(data) };
}

export async function beginTrial(schoolId, days = 30) {
  if (offline()) {
    localStartTrial(schoolId, days);
    return { ok: true, offline: true };
  }
  const { data, error } = await supabase.rpc('start_trial', { p_school: schoolId, p_days: days });
  if (error) return fail(error);
  __applyTenant(toTenant(data));
  return { ok: true, tenant: toTenant(data) };
}

export async function addTrialDays(schoolId, days) {
  if (offline()) {
    localExtendTrial(schoolId, days);
    return { ok: true, offline: true };
  }
  // extendTrial is a local convenience; on the backend it is start_trial with
  // the extra days, which keeps the same single source of truth.
  const { data, error } = await supabase.rpc('start_trial', { p_school: schoolId, p_days: days });
  if (error) return fail(error);
  __applyTenant(toTenant(data));
  return { ok: true, tenant: toTenant(data) };
}

export async function settleInvoice(invoiceId, { method = 'Mobile Money', reference = '' } = {}) {
  if (offline()) {
    localMarkPaid(invoiceId, { method, reference });
    return { ok: true, offline: true };
  }
  const { data, error } = await supabase.rpc('mark_invoice_paid', {
    p_invoice: invoiceId, p_method: method, p_reference: reference,
  });
  if (error) return fail(error);
  __applyInvoice(data);
  return { ok: true, invoice: data };
}

/** A school admin changing their own plan (see migration 0005). */
export async function requestPlanChange(schoolId, planId) {
  if (offline()) {
    localAssignPlan(schoolId, planId, { effective: 'immediate' });
    return { ok: true, offline: true };
  }
  const { data, error } = await supabase.rpc('request_plan_change', {
    p_school: schoolId, p_plan: planId,
  });
  if (error) return fail(error);
  __applyTenant(toTenant(data));
  return { ok: true, tenant: toTenant(data) };
}

/** Used by the Pay-now dialog and tests. */
export const __isOffline = offline;
