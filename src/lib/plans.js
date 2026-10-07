/**
 * plans.js
 * ─────────────────────────────────────────────────────────────
 * The subscription plan catalogue — the single source of truth for
 * what a school (tenant) pays and what each tier includes.
 *
 * Values mirror the published pricing page:
 *   https://skoulhub.com/pricing   (retrieved 2026-10-07)
 *
 *   Basic     UGX 10,000 / student / term   "Perfect for small schools"
 *   Standard  UGX 15,000 / student / term   "For growing secondary schools"  ← Most Popular
 *   Premium   UGX 20,000 / student / term   "For large multi-campus schools" ← Full Suite
 *
 * Billing is per student, per term (the site's own example: 400 students on
 * Standard = 400 × UGX 15,000 = UGX 6,000,000 per term).
 *
 * NOTE ON FEATURES: the live page renders the same twelve capabilities on all
 * three tiers (Basic additionally lists "Basic Report Cards"), so those twelve
 * are modelled as included everywhere. The two Premium-only rows come from the
 * tier's own copy ("large multi-campus schools") and the pricing FAQ ("Premium
 * plans include on-site setup assistance in the Kampala region").
 * ─────────────────────────────────────────────────────────────
 */

export const PRICING_SOURCE  = 'https://skoulhub.com/pricing';
export const PRICING_UPDATED = '2026-10-07';
export const CURRENCY        = 'UGX';
export const BILLING_UNIT    = 'per student / term';
export const ESTIMATOR_MIN   = 50;
export const ESTIMATOR_MAX   = 2000;

/* ── Billing policy ──────────────────────────────────────────
 * Platform defaults that drive the subscription lifecycle in
 * lib/billing.js. Collected here so every screen quotes the same
 * numbers.
 *
 * NOTE: the marketing page currently advertises a 7-day trial; the
 * platform policy implemented here is a 30-day trial with a 7-day
 * grace period before automatic revocation. Change TRIAL_DAYS to
 * bring the two back in line. */
export const TRIAL_DAYS = 30;
export const GRACE_DAYS = 7;   // access retained after a period/trial ends while payment is chased
export const TERM_DAYS  = 90;  // one school term ≈ 90 days

export const PLANS = [
  {
    id: 'basic',
    name: 'Basic',
    tagline: 'Perfect for small schools',
    pricePerStudentPerTerm: 10000,
    badge: null,
    color: '#1E45FC',
    tint: 'var(--tint-blue)',
  },
  {
    id: 'standard',
    name: 'Standard',
    tagline: 'For growing secondary schools',
    pricePerStudentPerTerm: 15000,
    badge: 'Most Popular',
    color: '#059669',
    tint: 'var(--tint-green)',
  },
  {
    id: 'premium',
    name: 'Premium',
    tagline: 'For large multi-campus schools',
    pricePerStudentPerTerm: 20000,
    badge: 'Full Suite',
    color: '#7c3aed',
    tint: 'var(--tint-violet)',
  },
];

export const DEFAULT_PLAN_ID = 'standard';

const ALL = ['basic', 'standard', 'premium'];

/** Capability matrix — `tiers` lists the plans that include the row. */
export const PLAN_FEATURES = [
  { label: 'Student Management',              tiers: ALL },
  { label: 'Teacher Management',              tiers: ALL },
  { label: 'Attendance Tracking',             tiers: ALL },
  { label: 'Results & Grading',               tiers: ALL },
  { label: 'Fee Collection',                  tiers: ALL },
  { label: 'Timetables',                      tiers: ALL },
  { label: 'Report Cards (PDF)',              tiers: ALL },
  { label: 'Email to Parents',                tiers: ALL },
  { label: 'ID Card Generation',              tiers: ALL },
  { label: 'Expense Tracking',                tiers: ALL },
  { label: 'Parent Mobile App',               tiers: ALL },
  { label: 'Dedicated Support',               tiers: ALL },
  { label: 'Multi-campus management',         tiers: ['premium'] },
  { label: 'On-site setup (Kampala region)',  tiers: ['premium'] },
];

/** Facts taken from the pricing FAQ, shown on the subscription screen. */
export const PRICING_FAQ = [
  { q: 'How is billing calculated?',
    a: 'Per student, per term. 400 students on Standard is 400 × UGX 15,000 = UGX 6,000,000 per term.' },
  { q: 'Is there a free trial?',
    a: `Yes — every new school gets a ${TRIAL_DAYS}-day full-access trial with realistic seeded data. No credit card required.` },
  { q: 'Can I switch plans?',
    a: 'Yes. Upgrade or downgrade at the start of any new term; your data migrates with you.' },
  { q: 'What payment methods are accepted?',
    a: 'Mobile Money (MTN, Airtel), bank transfer and cash. Every payment is recorded and receipted in SkoulHub.' },
  { q: 'Is our data secure?',
    a: 'Each school is isolated with Supabase Row-Level Security, with a 99.9% uptime SLA.' },
  { q: 'Do you offer training?',
    a: 'Remote onboarding training on every plan; Premium adds on-site setup in the Kampala region.' },
];

/** Legacy plan names from the first prototype → current plan ids. */
export const LEGACY_PLAN_IDS = {
  starter: 'basic',
  growth: 'standard',
  enterprise: 'premium',
  free: 'basic',
};

/** Accepts a plan id or a legacy name (case-insensitive) → canonical id. */
export function normalisePlanId(id) {
  const key = String(id ?? '').trim().toLowerCase();
  if (PLANS.some(p => p.id === key)) return key;
  return LEGACY_PLAN_IDS[key] ?? DEFAULT_PLAN_ID;
}

export function getPlan(id) {
  const key = normalisePlanId(id);
  return PLANS.find(p => p.id === key);
}

export function planLabel(id) {
  return getPlan(id).name;
}

/** UGX per student per term for a plan. */
export function planRate(id) {
  return getPlan(id).pricePerStudentPerTerm;
}

/** Term cost for a school of `students` on `planId`. */
export function calcPlanCost(planId, students) {
  const n = Number(students);
  return (Number.isFinite(n) && n > 0 ? Math.floor(n) : 0) * planRate(planId);
}

export function planIncludes(planId, featureLabel) {
  const row = PLAN_FEATURES.find(f => f.label === featureLabel);
  return row ? row.tiers.includes(normalisePlanId(planId)) : false;
}

export const formatUGX = (n) => `${CURRENCY} ${Math.round(Number(n) || 0).toLocaleString('en-UG')}`;

/** 4500000 → "UGX 4.5M" (compact form used on stat cards). */
export function formatCompactUGX(n) {
  const v = Number(n) || 0;
  if (v >= 1_000_000) return `${CURRENCY} ${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000)     return `${CURRENCY} ${Math.round(v / 1_000)}K`;
  return formatUGX(v);
}

/** Cheapest and dearest per-student rates, for "from … to …" summaries. */
export const RATE_RANGE = {
  min: Math.min(...PLANS.map(p => p.pricePerStudentPerTerm)),
  max: Math.max(...PLANS.map(p => p.pricePerStudentPerTerm)),
};
