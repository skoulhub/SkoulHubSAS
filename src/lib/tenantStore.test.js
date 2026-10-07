import { describe, it, expect } from 'vitest';
import {
  queryStudents, queryTeachers, queryParents, queryPayments,
  queryTenant, queryAllTenants, provisionTenant, lookupUser, resolveUser,
  calcBilling, BILLING_RATE, getFormSchema, DEFAULT_FORM_SCHEMA, parentChildren,
  scopedStudents, scopedParents, updateUserProfile,
} from './tenantStore';

describe('tenantStore — tenant isolation', () => {
  it('scopes every query helper to the requested school_id', () => {
    expect(queryStudents('skh-001').every(s => s.school_id === 'skh-001')).toBe(true);
    expect(queryStudents('skh-002').every(s => s.school_id === 'skh-002')).toBe(true);
    // skh-001 and skh-002 must never leak into each other
    const s1 = queryStudents('skh-001').map(s => s.id);
    const s2 = queryStudents('skh-002').map(s => s.id);
    expect(s1.some(id => s2.includes(id))).toBe(false);

    expect(queryTeachers('skh-001').every(t => t.school_id === 'skh-001')).toBe(true);
    expect(queryParents('skh-001').every(p => p.school_id === 'skh-001')).toBe(true);
    expect(queryPayments('skh-001').every(p => p.school_id === 'skh-001')).toBe(true);
  });

  it('returns empty arrays for unknown/empty school ids', () => {
    expect(queryStudents(null)).toEqual([]);
    expect(queryStudents('skh-999')).toEqual([]);
    expect(queryPayments(undefined)).toEqual([]);
  });
});

describe('tenantStore — tenants & billing', () => {
  it('exposes the seeded tenant registry', () => {
    expect(queryAllTenants().length).toBeGreaterThanOrEqual(5);
    expect(queryTenant('skh-001').name).toMatch(/St\. Mary/);
    expect(queryTenant('nope')).toBeNull();
  });

  it('billing = students × rate', () => {
    const tenant = queryTenant('skh-001');
    expect(calcBilling('skh-001')).toBe(tenant.student_count * BILLING_RATE);
    expect(calcBilling('unknown')).toBe(0);
  });
});

describe('tenantStore — provisioning', () => {
  it('auto-generates a unique school_id and links the admin user', () => {
    const before = new Set(queryAllTenants().map(t => t.school_id));
    const { tenant, user } = provisionTenant({
      schoolName: 'Test Hill School',
      district: 'Kampala',
      adminEmail: 'head@testhill.ug',
      adminName: 'Test Admin',
      plan: 'Growth',
    });
    expect(before.has(tenant.school_id)).toBe(false);
    expect(tenant.school_id).toMatch(/^skh-/);
    expect(tenant.status).toBe('trial');
    expect(user.school_id).toBe(tenant.school_id);
    expect(user.role).toBe('school_admin');

    // The new admin can now log in via lookupUser
    expect(lookupUser('HEAD@testhill.ug').user_id).toBe(user.user_id);
  });
});

describe('tenantStore — auth helpers', () => {  it('lookupUser matches case-insensitively and returns null for unknown emails', () => {
    expect(lookupUser('ADMIN@SMCK.UG').role).toBe('school_admin');
    expect(lookupUser('ghost@nowhere.ug')).toBeNull();
  });

  it('resolveUser returns the known user, else a demo fallback session', () => {
    expect(resolveUser('admin@smck.ug', 'school_admin').name).toBe('Agnes Namukwaya');
    const fallback = resolveUser('nobody@x.ug', 'teacher');
    expect(fallback.school_id).toBe('skh-001');
    expect(resolveUser('nobody@x.ug', 'saas_admin').school_id).toBeNull();
  });
});

describe('tenantStore — parent scoping', () => {
  it('returns a parent user’s linked children, and nothing for other roles', () => {
    const parent = lookupUser('parent@smck.ug');
    expect(parentChildren(parent)).toEqual(['Aisha Nakato', 'Grace Akello']);
    expect(parentChildren(lookupUser('admin@smck.ug'))).toEqual([]);
    expect(parentChildren({ role: 'parent' })).toEqual([]); // no children key
    expect(parentChildren(null)).toEqual([]);
  });
});

describe('tenantStore — role-scoped queries', () => {
  const teacher = lookupUser('teacher@smck.ug');   // assigned: S.3 East/West, S.4 West
  const parent  = lookupUser('parent@smck.ug');    // children: Aisha Nakato, Grace Akello
  const admin   = lookupUser('admin@smck.ug');

  it('school admin and head teacher see the whole school', () => {
    expect(scopedStudents('skh-001', admin)).toEqual(queryStudents('skh-001'));
    expect(scopedParents('skh-001', admin)).toEqual(queryParents('skh-001'));
  });

  it('a teacher sees only students in assigned classes', () => {
    const rows = scopedStudents('skh-001', teacher);
    expect(rows.length).toBeGreaterThan(0);
    expect(rows.every(s => ['S.3 East', 'S.3 West', 'S.4 West'].includes(s.class))).toBe(true);
    expect(rows.length).toBeLessThan(queryStudents('skh-001').length);
  });

  it('a parent sees only their own children', () => {
    const rows = scopedStudents('skh-001', parent);
    expect(rows.map(s => s.name).sort()).toEqual(['Aisha Nakato', 'Grace Akello']);
  });

  it('teacher parent-list is limited to their students, parent list to their children', () => {
    const teacherParents = scopedParents('skh-001', teacher);
    const teacherStudentNames = scopedStudents('skh-001', teacher).map(s => s.name);
    expect(teacherParents.every(p => p.children.some(c => teacherStudentNames.includes(c)))).toBe(true);

    const parentParents = scopedParents('skh-001', parent);
    expect(parentParents.every(p => p.children.some(c => ['Aisha Nakato', 'Grace Akello'].includes(c)))).toBe(true);
  });

  it('never leaks across tenants', () => {
    expect(scopedStudents('skh-002', teacher)).toEqual([]);
  });
});

describe('tenantStore — form schema', () => {
  it('returns the defaults (with copies) when nothing is saved', () => {
    const schema = getFormSchema('skh-999');
    expect(schema.length).toBe(DEFAULT_FORM_SCHEMA.length);
    expect(schema).not.toBe(DEFAULT_FORM_SCHEMA); // defensive copy
    expect(schema[0]).not.toBe(DEFAULT_FORM_SCHEMA[0]);
  });

  it('keeps locked core fields present', () => {
    const schema = getFormSchema('skh-999');
    for (const lockedId of ['entry_class', 'first_name', 'parent_name']) {
      expect(schema.some(f => f.id === lockedId && f.locked)).toBe(true);
    }
  });
});

describe('tenantStore — profile updates', () => {
  it('updates name and phone in place', () => {
    provisionTenant({
      schoolName: 'Profile Test School', district: 'Kampala',
      adminEmail: 'profile.test@x.ug', adminName: 'Profile Tester',
    });
    const updated = updateUserProfile('profile.test@x.ug', { name: 'Renamed Tester', phone: '+256 700 999 888' });
    expect(updated.name).toBe('Renamed Tester');
    expect(lookupUser('profile.test@x.ug')).toMatchObject({ name: 'Renamed Tester', phone: '+256 700 999 888' });
  });

  it('re-keys the registry when the email changes so the new address can sign in', () => {
    const before = lookupUser('profile.test@x.ug');
    updateUserProfile('profile.test@x.ug', { email: 'new.profile@x.ug' });

    expect(lookupUser('profile.test@x.ug')).toBeNull();                  // old address retired
    const after = lookupUser('new.profile@x.ug');
    expect(after.email).toBe('new.profile@x.ug');
    expect(after.user_id).toBe(before.user_id);                          // same account, new key
  });

  it('returns null for an unknown user', () => {
    expect(updateUserProfile('ghost@nowhere.ug', { name: 'x' })).toBeNull();
  });
});
