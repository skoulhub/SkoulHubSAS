import { useState } from 'react';
import { can } from '../lib/permissions';
import { updateTenantPlan, quoteForPlan } from '../lib/tenantStore';
import {
  PLANS, PLAN_FEATURES, PRICING_FAQ, PRICING_SOURCE, PRICING_UPDATED, BILLING_UNIT, TRIAL_DAYS, GRACE_DAYS, TERM_DAYS,
  ESTIMATOR_MIN, ESTIMATOR_MAX, getPlan, planLabel, planRate, formatUGX, formatCompactUGX, normalisePlanId,
} from '../lib/plans';
import {
  SUB_STATUS, PAYMENT_METHODS, tenantBilling, markInvoicePaid,
  statusMeta, statusSentence, dateLabel,
} from '../lib/billing';
import { Card, SectionHeader, PrimaryButton, GhostButton, TextInput, Select } from '../components/ui';
import { recordAudit, AUDIT_ACTIONS, AUDIT_SEVERITY } from '../lib/audit';

/* Local badge — the plan pill used in the page header. */
function PlanBadge({ plan }) {
  return (
    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full" style={{ background: plan.tint, color: plan.color }}>
      {plan.name}
    </span>
  );
}

export default function SubscriptionPage({ roleId, tenant, onUpdateTenant }) {
  const plan = getPlan(tenant?.plan);
  const students = tenant?.student_count ?? 0;
  const termCost = quoteForPlan(tenant?.school_id, plan.id);
  const canManage = can(roleId, 'subscription.manage');

  const [estimate, setEstimate] = useState(() =>
    Math.min(ESTIMATOR_MAX, Math.max(ESTIMATOR_MIN, students || 300)));
  const [toast, setToast] = useState(null);
  const [openFaq, setOpenFaq] = useState(null);
  const [confirming, setConfirming] = useState(null);
  const [tick, setTick] = useState(0);                       // re-read billing after a payment
  const [payOpen, setPayOpen] = useState(null);
  const [pay, setPay] = useState({ method: PAYMENT_METHODS[0], reference: '' });

  const { subscription, invoices, openInvoice: open } = tenantBilling(tenant?.school_id);
  const statusMetaNow = statusMeta(subscription?.status);

  const settle = () => {
    if (!payOpen) return;
    markInvoicePaid(payOpen.id, { method: pay.method, reference: pay.reference });
    setPayOpen(null);
    setPay({ method: PAYMENT_METHODS[0], reference: '' });
    setTick(t => t + 1);
    onUpdateTenant?.({ status: SUB_STATUS.ACTIVE });
    notify(`${payOpen.id} paid — access restored for a ${TERM_DAYS}-day term`);
  };

  const notify = (msg, type = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3200);
  };

  const switchPlan = (planId) => {
    updateTenantPlan(tenant.school_id, planId);
    recordAudit({
      action: AUDIT_ACTIONS.PLAN_SWITCHED, target: planLabel(planId),
      detail: `${planLabel(tenant.plan)} → ${planLabel(planId)}`, severity: AUDIT_SEVERITY.CRITICAL,
    });
    onUpdateTenant?.({ plan: planId });
    setConfirming(null);
    notify(`Plan changed to ${planLabel(planId)} — takes effect next term`);
  };

  return (
    <div key={tick} className="animate-fade-in space-y-5 max-w-5xl">

      {/* Current plan */}
      <Card className="p-5">
        <div className="flex items-start justify-between flex-wrap gap-4">
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-lg font-extrabold" style={{ color: 'var(--text)' }}>Subscription</h2>
              <PlanBadge plan={plan} />
              {tenant?.status === 'trial' && (
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full" style={{ background: 'var(--tint-amber)', color: 'var(--warn)' }}>
                  {TRIAL_DAYS}-day trial
                </span>
              )}
            </div>
            <p className="text-xs mt-1" style={{ color: 'var(--text-dim)' }}>{plan.tagline}</p>
            <div className="flex items-center gap-2 mt-2 flex-wrap">
              <span className="text-[11px] font-bold px-2 py-0.5 rounded-full"
                style={{ background: statusMetaNow.tint, color: statusMetaNow.color }}>{statusMetaNow.label}</span>
              <span className="text-[11px]" style={{ color: 'var(--text-muted)' }}>{statusSentence(subscription)}</span>
            </div>
          </div>
          <div className="text-right">
            <div className="text-xs" style={{ color: 'var(--text-dim)' }}>This term</div>
            <div className="text-2xl font-extrabold" style={{ color: 'var(--text)' }}>{formatUGX(termCost)}</div>
            <div className="text-[11px]" style={{ color: 'var(--text-dim)' }}>
              {students.toLocaleString()} students × {formatUGX(plan.pricePerStudentPerTerm)}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-5">
          {[
            { label: 'Students billed', value: students.toLocaleString() },
            { label: 'Rate', value: `${formatUGX(plan.pricePerStudentPerTerm)}` },
            { label: 'Billing cycle', value: 'Per term' },
            { label: 'Next renewal', value: 'Term 3 · 2026' },
          ].map(m => (
            <div key={m.label} className="rounded-xl p-3" style={{ background: 'var(--surface-2)' }}>
              <div className="text-[10px] uppercase tracking-wide" style={{ color: 'var(--text-dim)' }}>{m.label}</div>
              <div className="text-sm font-bold mt-0.5" style={{ color: 'var(--text)' }}>{m.value}</div>
            </div>
          ))}
        </div>
      </Card>

      {/* Trial / payment callout */}
      {subscription?.status === SUB_STATUS.TRIAL && (
        <div className="rounded-2xl border px-5 py-4" style={{ borderColor: 'var(--border)', background: 'var(--tint-amber)' }}>
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div>
              <div className="text-sm font-bold" style={{ color: 'var(--text)' }}>
                {subscription.trialDaysLeft} day{subscription.trialDaysLeft === 1 ? '' : 's'} left in your {TRIAL_DAYS}-day trial
              </div>
              <p className="text-[11px] mt-0.5" style={{ color: 'var(--text-muted)' }}>
                Trial ends {dateLabel(subscription.trialEndsAt)}. We&apos;ll raise an invoice for {formatUGX(subscription.termCost)},
                payable within {GRACE_DAYS} days — after that access is suspended automatically.
              </p>
            </div>
            <div className="h-1.5 rounded-full w-full sm:w-40 overflow-hidden" style={{ background: 'var(--surface-3)' }}>
              <div className="h-full rounded-full" style={{ width: `${Math.round((subscription.trialProgress ?? 0) * 100)}%`, background: 'var(--warn)' }} />
            </div>
          </div>
        </div>
      )}
      {subscription?.status === SUB_STATUS.PAST_DUE && (
        <div className="rounded-2xl border px-5 py-4 flex items-center justify-between flex-wrap gap-3"
          style={{ borderColor: 'var(--danger)', background: 'var(--tint-red)' }}>
          <div>
            <div className="text-sm font-bold" style={{ color: 'var(--text)' }}>{subscription.reason}</div>
            <p className="text-[11px] mt-0.5" style={{ color: 'var(--text-muted)' }}>
              {formatUGX(subscription.outstanding)} outstanding · access ends {dateLabel(subscription.graceEndsAt)}
            </p>
          </div>
          {canManage && open && (
            <PrimaryButton onClick={() => setPayOpen(open)} style={{ background: 'var(--danger)' }}>Pay {formatUGX(open.amount)}</PrimaryButton>
          )}
        </div>
      )}
      {subscription?.locked && (
        <div className="rounded-2xl border px-5 py-4" style={{ borderColor: 'var(--danger)', background: 'var(--tint-red)' }}>
          <div className="text-sm font-bold" style={{ color: 'var(--text)' }}>🔒 {subscription.reason}</div>
          <p className="text-[11px] mt-0.5" style={{ color: 'var(--text-muted)' }}>
            Most areas of SkoulHub are unavailable until the outstanding {formatUGX(subscription.outstanding)} is settled.
          </p>
          {canManage && open && (
            <div className="mt-3"><PrimaryButton onClick={() => setPayOpen(open)}>Settle invoice</PrimaryButton></div>
          )}
        </div>
      )}

      {/* Invoices */}
      <Card className="overflow-hidden">
        <SectionHeader title="Invoices" subtitle={`Billed per term (${TERM_DAYS} days) at your plan rate`}
          right={open && canManage ? <PrimaryButton onClick={() => setPayOpen(open)}>Pay now</PrimaryButton> : null} />
        {invoices.length === 0 ? (
          <div className="px-5 py-8 text-center text-sm" style={{ color: 'var(--text-dim)' }}>
            No invoices yet — you are still inside your {TRIAL_DAYS}-day trial.
          </div>
        ) : (
          <table className="w-full">
            <thead>
              <tr style={{ background: 'var(--surface-2)', borderBottom: '1px solid var(--border)' }}>
                {['Invoice','Period','Amount','Issued','Due','Status',''].map(h => (
                  <th key={h} className="text-left px-5 py-3 text-[11px] font-bold uppercase tracking-wider" style={{ color: 'var(--text-dim)' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y" style={{ borderColor: 'var(--border-subtle)' }}>
              {invoices.map(inv => {
                const m = inv.display_status === 'paid'
                  ? { label: 'Paid', color: 'var(--ok)', tint: 'var(--tint-green)' }
                  : inv.display_status === 'overdue'
                    ? { label: 'Overdue', color: 'var(--danger)', tint: 'var(--tint-red)' }
                    : inv.display_status === 'void'
                      ? { label: 'Void', color: 'var(--text-dim)', tint: 'var(--surface-3)' }
                      : { label: 'Due', color: 'var(--warn)', tint: 'var(--tint-amber)' };
                return (
                  <tr key={inv.id}>
                    <td className="px-5 py-3 text-xs font-mono font-bold" style={{ color: 'var(--text)' }}>{inv.id}</td>
                    <td className="px-5 py-3 text-[11px]" style={{ color: 'var(--text-muted)' }}>
                      {dateLabel(inv.period_start)} → {dateLabel(inv.period_end)}
                    </td>
                    <td className="px-5 py-3 text-sm font-bold" style={{ color: 'var(--text)' }}>{formatUGX(inv.amount)}</td>
                    <td className="px-5 py-3 text-[11px]" style={{ color: 'var(--text-dim)' }}>{dateLabel(inv.issued_at)}</td>
                    <td className="px-5 py-3 text-[11px]" style={{ color: inv.display_status === 'overdue' ? 'var(--danger)' : 'var(--text-dim)' }}>{dateLabel(inv.due_at)}</td>
                    <td className="px-5 py-3">
                      <span className="text-[11px] font-bold px-2 py-0.5 rounded-full" style={{ background: m.tint, color: m.color }}>{m.label}</span>
                      {inv.paid_at && <div className="text-[10px] mt-1" style={{ color: 'var(--text-dim)' }}>{inv.method}</div>}
                    </td>
                    <td className="px-5 py-3">
                      {canManage && inv.status === 'due' && (
                        <button onClick={() => setPayOpen(inv)} className="text-[11px] font-bold px-2.5 py-1 rounded-lg text-white"
                          style={{ background: 'var(--ok)' }}>Pay now</button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </Card>

      {/* Cost estimator */}
      <Card>
        <SectionHeader title="Estimate your cost" subtitle={`Billing is per student, per term — ${BILLING_UNIT}`} />
        <div className="p-5">
          <div className="flex items-center gap-4 mb-1">
            <input
              type="range" min={ESTIMATOR_MIN} max={ESTIMATOR_MAX} step={50} value={estimate}
              onChange={e => setEstimate(Number(e.target.value))}
              className="flex-1 accent-[#1E45FC]" aria-label="Number of students"
            />
            <div className="w-32 text-right">
              <span className="text-xl font-extrabold" style={{ color: 'var(--text)' }}>{estimate.toLocaleString()}</span>
              <span className="text-xs ml-1" style={{ color: 'var(--text-dim)' }}>students</span>
            </div>
          </div>
          <div className="flex justify-between text-[10px] mb-4" style={{ color: 'var(--text-dim)' }}>
            <span>{ESTIMATOR_MIN}</span><span>{ESTIMATOR_MAX.toLocaleString()}</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {PLANS.map(p => {
              const cost = p.pricePerStudentPerTerm * estimate;
              const isCurrent = normalisePlanId(tenant?.plan) === p.id;
              return (
                <div key={p.id} className="rounded-xl border-2 p-4"
                  style={{ borderColor: isCurrent ? p.color : 'var(--border-strong)', background: isCurrent ? p.tint : 'var(--surface)' }}>
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold" style={{ color: 'var(--text)' }}>{p.name}</span>
                    {p.badge && (
                      <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full"
                        style={{ background: p.badge === 'Most Popular' ? '#A3CF2E' : p.tint, color: p.badge === 'Most Popular' ? '#1a2a00' : p.color }}>
                        {p.badge}
                      </span>
                    )}
                  </div>
                  <div className="text-lg font-extrabold mt-1.5" style={{ color: 'var(--text)' }}>{formatCompactUGX(cost)}</div>
                  <div className="text-[10px]" style={{ color: 'var(--text-dim)' }}>per term · {formatUGX(p.pricePerStudentPerTerm)}/student</div>
                </div>
              );
            })}
          </div>
        </div>
      </Card>

      {/* Plan comparison */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {PLANS.map(p => {
          const isCurrent = normalisePlanId(tenant?.plan) === p.id;
          const cost = quoteForPlan(tenant?.school_id, p.id);
          return (
            <Card key={p.id} className="p-5 flex flex-col" style={{ borderColor: isCurrent ? p.color : undefined }}>
              <div className="flex items-center justify-between mb-1">
                <span className="text-sm font-extrabold" style={{ color: 'var(--text)' }}>{p.name}</span>
                {p.badge && (
                  <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full"
                    style={{ background: p.badge === 'Most Popular' ? '#A3CF2E' : p.tint, color: p.badge === 'Most Popular' ? '#1a2a00' : p.color }}>
                    {p.badge}
                  </span>
                )}
              </div>
              <p className="text-[11px] mb-3" style={{ color: 'var(--text-dim)' }}>{p.tagline}</p>
              <div className="text-xl font-extrabold" style={{ color: 'var(--text)' }}>{formatUGX(p.pricePerStudentPerTerm)}</div>
              <div className="text-[10px] mb-3" style={{ color: 'var(--text-dim)' }}>{BILLING_UNIT}</div>
              <div className="rounded-xl px-3 py-2 mb-4" style={{ background: 'var(--surface-2)' }}>
                <div className="text-[10px]" style={{ color: 'var(--text-dim)' }}>Your school ({students.toLocaleString()} students)</div>
                <div className="text-sm font-bold" style={{ color: 'var(--text)' }}>{formatUGX(cost)} / term</div>
              </div>

              <ul className="space-y-1.5 flex-1">
                {PLAN_FEATURES.map(f => {
                  const included = f.tiers.includes(p.id);
                  return (
                    <li key={f.label} className="flex items-start gap-2 text-[11px]"
                      style={{ color: included ? 'var(--text-muted)' : 'var(--text-dim)', opacity: included ? 1 : 0.55 }}>
                      <span style={{ color: included ? 'var(--ok)' : 'var(--text-dim)' }}>{included ? '✓' : '—'}</span>
                      {f.label}
                    </li>
                  );
                })}
              </ul>

              <div className="mt-4">
                {isCurrent ? (
                  <div className="text-center text-xs font-bold py-2.5 rounded-xl"
                    style={{ background: p.tint, color: p.color }}>Current plan</div>
                ) : (
                  <button disabled={!canManage} onClick={() => setConfirming(p.id)}
                    className="w-full py-2.5 rounded-xl text-sm font-bold text-white transition-opacity hover:opacity-90 disabled:opacity-50"
                    style={{ background: p.color }}>
                    Switch to {p.name}
                  </button>
                )}
              </div>
            </Card>
          );
        })}
      </div>

      <p className="text-[11px]" style={{ color: 'var(--text-dim)' }}>
        Plans can be changed at the start of any term. Pricing per{' '}
        <a href={PRICING_SOURCE} target="_blank" rel="noreferrer" className="underline" style={{ color: 'var(--accent)' }}>
          skoulhub.com/pricing
        </a>{' '}
        (retrieved {PRICING_UPDATED}). All plans include a {TRIAL_DAYS}-day free trial.
      </p>

      {/* FAQ */}
      <Card>
        <SectionHeader title="Billing questions" subtitle="Everything you need to know about SkoulHub pricing" />
        <div>
          {PRICING_FAQ.map((item, i) => (
            <div key={item.q} className="border-b last:border-0" style={{ borderColor: 'var(--border-subtle)' }}>
              <button onClick={() => setOpenFaq(openFaq === i ? null : i)}
                className="w-full flex items-center justify-between gap-3 px-5 py-3.5 text-left">
                <span className="text-sm font-semibold" style={{ color: 'var(--text)' }}>{item.q}</span>
                <span className="text-xs flex-shrink-0" style={{ color: 'var(--text-dim)' }}>{openFaq === i ? '−' : '+'}</span>
              </button>
              {openFaq === i && (
                <p className="px-5 pb-4 text-xs leading-relaxed" style={{ color: 'var(--text-muted)' }}>{item.a}</p>
              )}
            </div>
          ))}
        </div>
      </Card>

      {/* Confirm plan change */}
      {confirming && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4"
          style={{ background: 'rgba(11,15,42,0.55)', backdropFilter: 'blur(4px)' }}
          onClick={() => setConfirming(null)}>
          <div className="rounded-2xl shadow-2xl w-full max-w-sm p-6" style={{ background: 'var(--surface)' }} onClick={e => e.stopPropagation()}>
            <h3 className="font-bold text-base mb-1" style={{ color: 'var(--text)' }}>Switch to {planLabel(confirming)}?</h3>
            <p className="text-sm mb-4" style={{ color: 'var(--text-muted)' }}>
              From next term your school ({students.toLocaleString()} students) will be billed{' '}
              <strong style={{ color: 'var(--text)' }}>{formatUGX(quoteForPlan(tenant?.school_id, confirming))}</strong> per term
              at {formatUGX(planRate(confirming))} per student — currently {formatUGX(termCost)}.
            </p>
            <div className="flex gap-3">
              <button onClick={() => setConfirming(null)} className="flex-1 py-2.5 rounded-xl border text-sm font-semibold"
                style={{ borderColor: 'var(--border-strong)', color: 'var(--text-muted)' }}>Cancel</button>
              <button onClick={() => switchPlan(confirming)} className="flex-1 py-2.5 rounded-xl text-sm font-bold text-white"
                style={{ background: getPlan(confirming).color }}>Confirm switch</button>
            </div>
          </div>
        </div>
      )}

      {/* PAY INVOICE MODAL */}
      {payOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4"
          style={{ background: 'rgba(11,15,42,0.55)', backdropFilter: 'blur(4px)' }} onClick={() => setPayOpen(null)}>
          <div className="rounded-2xl shadow-2xl w-full max-w-md p-6" style={{ background: 'var(--surface)' }} onClick={e => e.stopPropagation()}>
            <h3 className="font-bold text-base mb-1" style={{ color: 'var(--text)' }}>Pay invoice {payOpen.id}</h3>
            <p className="text-xs mb-4" style={{ color: 'var(--text-muted)' }}>
              {planLabel(payOpen.plan)} · {payOpen.students.toLocaleString()} students × {formatUGX(payOpen.rate)}
            </p>
            <div className="rounded-xl px-4 py-3 mb-4 flex items-center justify-between" style={{ background: 'var(--surface-2)' }}>
              <span className="text-xs" style={{ color: 'var(--text-dim)' }}>Amount due</span>
              <strong className="text-lg" style={{ color: 'var(--ok)' }}>{formatUGX(payOpen.amount)}</strong>
            </div>
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-semibold mb-1.5" style={{ color: 'var(--text-muted)' }}>Payment method</label>
                <Select value={pay.method} onChange={e => setPay(p => ({ ...p, method: e.target.value }))}>
                  {PAYMENT_METHODS.map(m => <option key={m} value={m}>{m}</option>)}
                </Select>
              </div>
              <div>
                <label className="block text-xs font-semibold mb-1.5" style={{ color: 'var(--text-muted)' }}>Reference (optional)</label>
                <TextInput value={pay.reference} onChange={e => setPay(p => ({ ...p, reference: e.target.value }))} placeholder="MTN-XXXXXXXX" />
              </div>
              <p className="text-[11px]" style={{ color: 'var(--text-dim)' }}>
                Demo mode — no money moves. Confirming restores access for a {TERM_DAYS}-day term.
              </p>
            </div>
            <div className="flex gap-3 mt-5">
              <GhostButton onClick={() => setPayOpen(null)} className="flex-1">Cancel</GhostButton>
              <PrimaryButton onClick={settle} className="flex-1">Confirm payment</PrimaryButton>
            </div>
          </div>
        </div>
      )}

      {toast && (
        <div className="fixed bottom-5 right-5 z-[200] flex items-center gap-3 px-4 py-3 rounded-2xl shadow-lg text-sm font-semibold text-white animate-slide-up"
          style={{ background: toast.type === 'error' ? 'var(--danger)' : 'var(--ok)', minWidth: 240, maxWidth: 340 }}>
          <span>{toast.type === 'error' ? '✕' : '✓'}</span>
          <span className="flex-1">{toast.msg}</span>
        </div>
      )}
    </div>
  );
}
