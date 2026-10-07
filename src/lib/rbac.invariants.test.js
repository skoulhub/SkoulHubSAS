import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import {
  PERMISSIONS, NAV_PERMISSION_MAP, NAV_ALWAYS_ALLOWED, ROLE_META, navAllowed, can,
} from './permissions';
import { NAV_BY_ROLE } from './navigation';

/**
 * Structural RBAC invariants.
 *
 * These lock the permission matrix, the role metadata and the sidebar
 * configuration together so the three cannot drift apart again — the
 * class of bug where a nav entry is offered to a role the matrix denies
 * (or a permission is granted to a role that has no way to reach it).
 */

const rolesInMatrix = [...new Set(Object.values(PERMISSIONS).flat())].sort();
const navIds = [...new Set(Object.values(NAV_BY_ROLE).flat().map(i => i.id))].sort();

describe('RBAC invariants — roles', () => {
  it('every role used in the matrix has ROLE_META', () => {
    const missing = rolesInMatrix.filter(r => !ROLE_META[r]);
    expect(missing).toEqual([]);
  });

  it('every role has sidebar navigation, and vice versa', () => {
    const meta = Object.keys(ROLE_META).sort();
    const nav = Object.keys(NAV_BY_ROLE).sort();
    expect(nav).toEqual(meta);
  });

  it('each role has at least one navigation entry', () => {
    for (const [role, items] of Object.entries(NAV_BY_ROLE)) {
      expect(items.length, `${role} has no nav`).toBeGreaterThan(0);
    }
  });
});

describe('RBAC invariants — navigation vs permissions', () => {
  it('every nav id is either permission-mapped or explicitly public', () => {
    const unmapped = navIds.filter(id => !NAV_PERMISSION_MAP[id] && !NAV_ALWAYS_ALLOWED.includes(id));
    expect(unmapped).toEqual([]);
  });

  it('every nav entry offered to a role is permitted for that role', () => {
    const violations = [];
    for (const [role, items] of Object.entries(NAV_BY_ROLE)) {
      for (const item of items) {
        if (!navAllowed(role, item.id)) violations.push(`${role} → ${item.id}`);
      }
    }
    expect(violations).toEqual([]);
  });

  it('the nav map contains no stale entries', () => {
    const stale = Object.keys(NAV_PERMISSION_MAP).filter(id => !navIds.includes(id));
    expect(stale).toEqual([]);
  });

  it('every nav-map value is a real permission', () => {
    const bogus = Object.values(NAV_PERMISSION_MAP).filter(p => !PERMISSIONS[p]);
    expect(bogus).toEqual([]);
  });
});

describe('RBAC invariants — no dead permissions', () => {  it('every permission is enforced (direct can() call) or gates a nav entry', () => {
    // Scan the UI for direct `can(role, 'permission')` usages.
    const files = readdirSync('src', { recursive: true })
      .filter(f => /\.(js|jsx)$/.test(f))
      .filter(f => !f.endsWith('.test.js') && !f.endsWith('permissions.js'));
    const source = files.map(f => readFileSync(join('src', f), 'utf8')).join('\n');

    const navGated = new Set(Object.values(NAV_PERMISSION_MAP));
    const unused = Object.keys(PERMISSIONS).filter(
      p => !navGated.has(p) && !source.includes(`'${p}'`)
    );
    expect(unused).toEqual([]);
  });
});

/**
 * Read-only guarantees.
 *
 * Parents are strictly read-only; teachers may only mark attendance, enter
 * marks and write their own report-card comment. Everything else that mutates
 * (approve, generate, send, create, edit, delete, payroll, settings, platform
 * admin) is refused. These assertions are the contract, not a snapshot.
 */
const WRITE_PERMISSIONS = [
  'students.create', 'students.edit', 'students.delete',
  'parents.create', 'parents.edit', 'parents.contact',
  'teachers.create', 'teachers.edit',
  'attendance.mark', 'timetable.edit',
  'results.enter', 'results.approve',
  'reports.generate', 'reports.send', 'reports.comment_teacher', 'reports.comment_head',
  'finance.record', 'finance.approve', 'finance.payroll',
  'idcards.generate', 'notifs.send', 'enrollment.manage',
  'saas.schools.manage', 'saas.onboarding.manage', 'saas.features.manage',
  'settings.edit',
];

const heldWrites = role => WRITE_PERMISSIONS.filter(p => can(role, p)).sort();

describe('RBAC invariants — read-only guarantees', () => {
  it('every mutating permission is listed in the write inventory', () => {
    const unclassified = Object.keys(PERMISSIONS).filter(
      p => !p.endsWith('.view') && !WRITE_PERMISSIONS.includes(p)
    );
    expect(unclassified).toEqual([]);
  });

  it('a parent holds no write permission at all', () => {
    expect(heldWrites('parent')).toEqual([]);
  });

  it('a teacher may only mark attendance, enter marks, comment on reports and contact parents', () => {
    expect(heldWrites('teacher')).toEqual([
      'attendance.mark', 'parents.contact', 'reports.comment_teacher', 'results.enter',
    ]);
  });

  it('a teacher can never approve, generate, send, create, edit or delete', () => {
    const forbidden = [
      'results.approve', 'reports.generate', 'reports.send', 'notifs.send',
      'students.create', 'students.edit', 'students.delete',
      'parents.create', 'parents.edit', 'teachers.create', 'teachers.edit',
      'finance.record', 'finance.approve', 'finance.payroll',
      'timetable.edit', 'idcards.generate', 'settings.edit', 'enrollment.manage',
    ];
    const leaked = forbidden.filter(p => can('teacher', p));
    expect(leaked).toEqual([]);
  });

  it('a parent can never mutate anything a teacher can', () => {
    expect(can('parent', 'attendance.mark')).toBe(false);
    expect(can('parent', 'results.enter')).toBe(false);
    expect(can('parent', 'reports.comment_teacher')).toBe(false);
    expect(can('parent', 'reports.comment_head')).toBe(false);
  });
});
