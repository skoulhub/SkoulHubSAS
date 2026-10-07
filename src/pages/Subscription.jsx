import { useState } from 'react';
import { can } from '../lib/permissions';
import { updateTenantPlan, quoteForPlan } from '../lib/tenantStore';
import {
  PLANS, PLAN_FEATURES, PRICING_FAQ, PRICING_SOURCE, PRICING_UPDATED, BILLING_UNIT, TRIAL_DAYS,
  ESTIMATOR_MIN, ESTIMATOR_MAX, getPlan, planLabel, planRate, formatUGX, formatCompactUGX, normalisePlanId,
} from '../lib/plans';

/* ── Primitives (token-based so they follow the theme) ───────── */

function Card({ children, className = '' }) {
  return (
    <div className={`rounded-2xl border ${className}`} style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}>
      {children}
    </div>
  );
}

function SectionHeader({ title, subtitle, right }) {
  return (
    <div className="flex items-start justify-between gap-3 px-5 py-4 border-b" style={{ borderColor: 'var(--border)' }}>
      <div>
        <h3 className="font-bold text-sm" style={{ color: 'var(--text)' }}>{title}</h3>
        {subtitle && <p className="text-xs mt-0.5" style={{ color: 'var(--text-dim)' }}>{subtitle}</p>}
      </div>
      {right}
    </div>
  );
}

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

  const notify = (msg, type = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3200);
  };

  const switchPlan = (planId) => {
    updateTenantPlan(tenant.school_id, planId);
    onUpdateTenant?.({ plan: planId });
    setConfirming(null);
    notify(`Plan changed to ${planLabel(planId)} — takes effect next term`);
  };

  return (
    <div className="animate-fade-in space-y-5 max-w-5xl">

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
