/**
 * TenantContext.jsx
 * ─────────────────────────────────────────────────────────────
 * React context that holds the authenticated session:
 *   - currentUser  (user_id, school_id, role, name)
 *   - tenant       (full school record, null for saas_admin)
 *
 * All data queries in page components read school_id from here.
 * SaaS Admin gets school_id = null and can query all tenants.
 * ─────────────────────────────────────────────────────────────
 */
import { createContext, useContext } from 'react';
import { can, canAny, navAllowed } from './permissions';

export const TenantContext = createContext(null);

export function useTenant() {
  return useContext(TenantContext);
}

/**
 * Convenience hook — returns scoped permission helpers bound
 * to the current user's role so call sites look like:
 *   const { can } = usePermissions();
 *   if (can('finance.record')) { ... }
 */
export function usePermissions() {
  const ctx = useContext(TenantContext);
  const roleId = ctx?.currentUser?.role ?? '';

  return {
    can:        (perm)  => can(roleId, perm),
    canAny:     (perms) => canAny(roleId, perms),
    navAllowed: (navId) => navAllowed(roleId, navId),
    role:       roleId,
    isSaasAdmin: roleId === 'saas_admin',
    schoolId:   ctx?.currentUser?.school_id ?? null,
  };
}
