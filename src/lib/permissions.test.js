import { describe, it, expect } from 'vitest';
import { can, canAny, navAllowed, ROLE_META } from './permissions';

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
  });

  it('unknown permission returns false', () => {
    expect(can('school_admin', 'does.not.exist')).toBe(false);
    expect(can('anything', 'students.view')).toBe(false);
  });
});

describe('permissions — finance segregation of duties', () => {
  it('bursar/accountant can record but NOT approve (no self-approval)', () => {
    expect(can('bursar', 'finance.record')).toBe(true);
    expect(can('bursar', 'finance.approve')).toBe(false);
    expect(can('accountant', 'finance.record')).toBe(true);
    expect(can('accountant', 'finance.approve')).toBe(false);
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

  it('parents have no finance access', () => {
    expect(can('parent', 'finance.view')).toBe(false);
    expect(can('parent', 'finance.record')).toBe(false);
    expect(can('parent', 'finance.approve')).toBe(false);
  });
});

describe('permissions — canAny / navAllowed / ROLE_META', () => {
  it('canAny is true when at least one permission is held', () => {
    expect(canAny('teacher', ['finance.view', 'results.enter'])).toBe(true);
    expect(canAny('parent', ['finance.view', 'students.delete'])).toBe(false);
  });

  it('finance nav is gated by finance.view', () => {
    expect(navAllowed('head_teacher', 'finance')).toBe(true);
    expect(navAllowed('bursar', 'finance')).toBe(true);
    expect(navAllowed('teacher', 'finance')).toBe(false);
    expect(navAllowed('parent', 'finance')).toBe(false);
  });

  it('overview is always allowed for any role', () => {
    expect(navAllowed('parent', 'overview')).toBe(true);
    expect(navAllowed('saas_admin', 'overview')).toBe(true);
  });

  it('defines a label for every known role', () => {
    for (const role of ['saas_admin', 'school_admin', 'head_teacher', 'teacher', 'parent', 'bursar']) {
      expect(ROLE_META[role].label).toBeTruthy();
    }
  });
});
