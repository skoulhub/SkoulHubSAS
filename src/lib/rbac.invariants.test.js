import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import {
  PERMISSIONS, NAV_PERMISSION_MAP, NAV_ALWAYS_ALLOWED, ROLE_META, navAllowed,
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

describe('RBAC invariants — no dead permissions', () => {
  it('every permission is enforced (direct can() call) or gates a nav entry', () => {
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
