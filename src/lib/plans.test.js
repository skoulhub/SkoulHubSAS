import { describe, it, expect } from 'vitest';
import {
  PLANS, PLAN_FEATURES, DEFAULT_PLAN_ID, PRICING_SOURCE, PRICING_UPDATED,
  TRIAL_DAYS, RATE_RANGE, getPlan, planLabel, planRate, calcPlanCost,
  normalisePlanId, planIncludes, formatUGX, formatCompactUGX,
} from './plans';
import { queryAllTenants } from './tenantStore';

/**
 * The published price list is a business fact, not an implementation detail:
 * these assertions pin the numbers taken from https://skoulhub.com/pricing.
 * If marketing changes a price, this test is the place that must change too.
 */
describe('plans — published catalogue', () => {
  it('matches the live pricing page', () => {
    expect(PLANS.map(p => [p.id, p.pricePerStudentPerTerm])).toEqual([
      ['basic',    10000],
      ['standard', 15000],
      ['premium',  20000],
    ]);
  });

  it('records where the prices came from', () => {
    expect(PRICING_SOURCE).toContain('skoulhub.com/pricing');
    expect(PRICING_UPDATED).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(TRIAL_DAYS).toBe(7);
  });

  it('marks Standard as the most popular tier', () => {
    expect(PLANS.filter(p => p.badge === 'Most Popular').map(p => p.id)).toEqual(['standard']);
  });

  it('exposes the per-student rate range', () => {
    expect(RATE_RANGE).toEqual({ min: 10000, max: 20000 });
  });

  it('uses the default plan for provisioning', () => {
    expect(PLANS.some(p => p.id === DEFAULT_PLAN_ID)).toBe(true);
  });
});

describe('plans — costing', () => {
  it('reproduces the example from the pricing FAQ (400 students on Standard)', () => {
    expect(calcPlanCost('standard', 400)).toBe(6_000_000);
  });

  it('scales linearly with enrolment', () => {
    expect(calcPlanCost('basic', 300)).toBe(3_000_000);
    expect(calcPlanCost('premium', 300)).toBe(6_000_000);
    expect(calcPlanCost('premium', 600)).toBe(calcPlanCost('premium', 300) * 2);
  });

  it('is zero for missing, zero or negative enrolment', () => {
    expect(calcPlanCost('basic', 0)).toBe(0);
    expect(calcPlanCost('basic', undefined)).toBe(0);
    expect(calcPlanCost('basic', -20)).toBe(0);
    expect(calcPlanCost('basic', 'nope')).toBe(0);
  });

  it('formats currency for display', () => {
    expect(formatUGX(6_000_000)).toBe('UGX 6,000,000');
    expect(formatUGX(10000)).toBe('UGX 10,000');
    expect(formatCompactUGX(6_000_000)).toBe('UGX 6.0M');
    expect(formatCompactUGX(450_000)).toBe('UGX 450K');
  });
});

describe('plans — lookup and legacy names', () => {
  it('normalises the prototype’s old plan names', () => {
    expect(normalisePlanId('Starter')).toBe('basic');
    expect(normalisePlanId('growth')).toBe('standard');
    expect(normalisePlanId('Enterprise')).toBe('premium');
  });

  it('falls back to the default for unknown or empty values', () => {
    expect(normalisePlanId('platinum')).toBe(DEFAULT_PLAN_ID);
    expect(normalisePlanId(null)).toBe(DEFAULT_PLAN_ID);
    expect(normalisePlanId('')).toBe(DEFAULT_PLAN_ID);
  });

  it('looks plans up by id, label or legacy name', () => {
    expect(getPlan('premium').name).toBe('Premium');
    expect(getPlan('Growth').id).toBe('standard');
    expect(planLabel('basic')).toBe('Basic');
    expect(planRate('premium')).toBe(20000);
  });
});

describe('plans — feature matrix', () => {
  it('includes the core school modules on every tier', () => {
    const core = [
      'Student Management', 'Teacher Management', 'Attendance Tracking',
      'Results & Grading', 'Fee Collection', 'Timetables',
      'Report Cards (PDF)', 'Email to Parents', 'ID Card Generation',
      'Expense Tracking', 'Parent Mobile App', 'Dedicated Support',
    ];
    for (const plan of PLANS) {
      for (const feature of core) {
        expect(planIncludes(plan.id, feature), `${plan.id} → ${feature}`).toBe(true);
      }
    }
  });

  it('reserves multi-campus and on-site setup for Premium', () => {
    expect(planIncludes('premium', 'Multi-campus management')).toBe(true);
    expect(planIncludes('standard', 'Multi-campus management')).toBe(false);
    expect(planIncludes('basic', 'On-site setup (Kampala region)')).toBe(false);
  });

  it('grades every feature to at least one tier', () => {
    for (const f of PLAN_FEATURES) expect(f.tiers.length).toBeGreaterThan(0);
  });
});

describe('plans — tenant consistency', () => {
  it('every seeded tenant is on a known plan', () => {
    for (const t of queryAllTenants()) {
      expect(PLANS.some(p => p.id === normalisePlanId(t.plan)), `${t.school_id} → ${t.plan}`).toBe(true);
    }
  });
});
