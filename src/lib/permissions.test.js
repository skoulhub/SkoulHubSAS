import { describe, it, expect } from 'vitest';
import { can, canAny, navAllowed, NAV_PERMISSION_MAP, ROLE_META } from './permissions';

describe('permissions — can()', () => {
  it('grants students.view to staff roles', () => {
    for (const role of ['school_admin', 'head_teacher', 'teacher', 'bursar']) {
      expect(can(role, 'students.view')).toBe(true);
    }
  });

  it('only school admin can delete students', () => {
    expect(can('school_admin', 'students.delete')).toBe(true);
    expect(can('head_teacher', 'students.delete')).toBe(false);
    expect(can('teacher', 'students.delete')).toBe(false);
  });

  it('parents can view attendance/results/reports but not manage them', () => {
    expect(can('parent', 'attendance.view')).toBe(true);
    expect(can('parent', 'attendance.mark')).toBe(false);
    expect(can('parent', 'results.view')).toBe(true);
    expect(can('parent', 'results.enter')).toBe(false);
    expect(can('parent', 'reports.view')).toBe(true);
    expect(can('parent', 'parents.contact')).toBe(false);
  });

  it('staff who can see the parent directory can contact parents', () => {
    expect(can('teacher', 'parents.contact')).toBe(true);
    expect(can('head_teacher', 'parents.contact')).toBe(true);
    expect(can('school_admin', 'parents.contact')).toBe(true);
    expect(can('bursar', 'parents.contact')).toBe(false);
  });

  it('unknown permission returns false (default-deny)', () => {
    expect(can('school_admin', 'does.not.exist')).toBe(false);
    expect(can('anything', 'students.view')).toBe(false);
  });
});

describe('permissions — finance segregation of duties', () => {
  it('bursar can record but NOT approve (no self-approval)', () => {
    expect(can('bursar', 'finance.record')).toBe(true);
    expect(can('bursar', 'finance.approve')).toBe(false);
  });

  it('head teacher approves but cannot record', () => {
    expect(can('head_teacher', 'finance.approve')).toBe(true);
    expect(can('head_teacher', 'finance.record')).toBe(false);
  });

  it('school admin has full finance control', () => {
    expect(can('school_admin', 'finance.view')).toBe(true);
    expect(can('school_admin', 'finance.record')).toBe(true);
    expect(can('school_admin', 'finance.approve')).toBe(true);
  });

  it('parents can view finance (fee balance) but never record or approve', () => {
    expect(can('parent', 'finance.view')).toBe(true);
    expect(can('parent', 'finance.record')).toBe(false);
    expect(can('parent', 'finance.approve')).toBe(false);
    expect(can('parent', 'finance.payroll')).toBe(false);
  });

  it('there is no half-implemented accountant role', () => {
    expect(ROLE_META.accountant).toBeUndefined();
    expect(can('accountant', 'finance.view')).toBe(false);
  });
});

describe('permissions — canAny / navAllowed / ROLE_META', () => {
  it('canAny is true when at least one permission is held', () => {
    expect(canAny('teacher', ['finance.view', 'results.enter'])).toBe(true);
    expect(canAny('parent', ['finance.record', 'students.delete'])).toBe(false);
  });

  it('finance nav is gated by finance.view', () => {
    expect(navAllowed('head_teacher', 'finance')).toBe(true);
    expect(navAllowed('bursar', 'finance')).toBe(true);
    expect(navAllowed('parent', 'finance')).toBe(true);   // fee-balance view
    expect(navAllowed('teacher', 'finance')).toBe(false);
  });

  it('every nav id used by the app is gated by a permission', () => {
    expect(navAllowed('school_admin', 'enrollment')).toBe(true);
    expect(navAllowed('teacher', 'enrollment')).toBe(false);
    expect(navAllowed('parent', 'enrollment')).toBe(false);
  });

  it('unmapped nav ids and unknown roles fail closed', () => {
    expect(navAllowed('school_admin', 'no_such_screen')).toBe(false);
    expect(navAllowed('made_up_role', 'students')).toBe(false);
    expect(navAllowed('made_up_role', 'enrollment')).toBe(false);
  });

  it('overview is explicitly public to every role', () => {
    for (const role of Object.keys(ROLE_META)) {
      expect(navAllowed(role, 'overview')).toBe(true);
    }
  });

  it('defines a label for every known role', () => {
    for (const role of ['saas_admin', 'school_admin', 'head_teacher', 'teacher', 'parent', 'bursar']) {
      expect(ROLE_META[role].label).toBeTruthy();
    }
  });

  it('every value in the nav map is a real permission', () => {
    expect(Object.values(NAV_PERMISSION_MAP).length).toBeGreaterThan(0);
  });
});
