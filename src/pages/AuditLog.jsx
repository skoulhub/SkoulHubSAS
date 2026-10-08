import { useState } from 'react';
import { can } from '../lib/permissions';
import { listAudit, auditStats, AUDIT_ACTIONS, AUDIT_SEVERITY } from '../lib/audit';
import { csvText } from '../lib/csv';
import { Card, SectionHeader, Select, TextInput, GhostButton } from '../components/ui';

/**
 * Audit Log
 * ─────────────────────────────────────────────────────────────
 * Read-only view of privileged and financial actions.
 *
 * Tenant roles see only their own school's entries; the SaaS admin
 * sees every tenant. That scoping is enforced here because there is
 * no backend yet — in production the query itself must be scoped
 * server-side, and the log must be append-only and tamper-evident.
 * ─────────────────────────────────────────────────────────────
 */

const SEVERITY_STYLE = {
  [AUDIT_SEVERITY.CRITICAL]: { bg: 'var(--tint-red)',   fg: 'var(--danger)', label: 'Critical' },
  [AUDIT_SEVERITY.NOTICE]:   { bg: 'var(--tint-amber)', fg: 'var(--warn)',   label: 'Notice' },
  [AUDIT_SEVERITY.INFO]:     { bg: 'var(--tint-blue)',  fg: 'var(--accent)', label: 'Info' },
};

const ACTION_LABELS = {
  [AUDIT_ACTIONS.SIGN_IN]:            'Sign-in',
  [AUDIT_ACTIONS.SIGN_OUT]:           'Sign-out',
  [AUDIT_ACTIONS.IDLE_SIGN_OUT]:      'Idle sign-out',
  [AUDIT_ACTIONS.MFA_FAILED]:         'MFA failed',
  [AUDIT_ACTIONS.MFA_LOCKED]:         'MFA locked out',
  [AUDIT_ACTIONS.PASSWORD_CHANGED]:   'Password changed',
  [AUDIT_ACTIONS.EMAIL_CHANGED]:      'Email changed',
  [AUDIT_ACTIONS.PHONE_CHANGED]:      'Phone changed',
  [AUDIT_ACTIONS.MFA_CHANGED]:        'MFA changed',
  [AUDIT_ACTIONS.RECOVERY_CODES]:     'Recovery codes regenerated',
  [AUDIT_ACTIONS.PLAN_ASSIGNED]:      'Plan assigned',
  [AUDIT_ACTIONS.PLAN_SWITCHED]:      'Plan switched',
  [AUDIT_ACTIONS.TRIAL_EXTENDED]:     'Trial extended',
  [AUDIT_ACTIONS.INVOICE_PAID]:       'Invoice paid',
  [AUDIT_ACTIONS.TENANT_SUSPENDED]:   'School suspended',
  [AUDIT_ACTIONS.TENANT_REACTIVATED]: 'School reactivated',
  [AUDIT_ACTIONS.STUDENT_CREATED]:    'Student created',
  [AUDIT_ACTIONS.STUDENT_UPDATED]:    'Student updated',
  [AUDIT_ACTIONS.STUDENT_DELETED]:    'Student deleted',
  [AUDIT_ACTIONS.PARENT_CREATED]:     'Parent created',
  [AUDIT_ACTIONS.PARENT_UPDATED]:     'Parent updated',
  [AUDIT_ACTIONS.RESULTS_APPROVED]:   'Results approved',
};

const actionLabel = (a) => ACTION_LABELS[a] ?? a;
const formatWhen = (ms) => new Date(ms).toLocaleString('en-UG', {
  day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', second: '2-digit',
});

export default function AuditLogPage({ roleId, schoolId }) {
  const canView = can(roleId, 'audit.view');
  const isSaasAdmin = roleId === 'saas_admin';
  const scope = isSaasAdmin ? undefined : schoolId;   // tenant roles: own school only

  const [severity, setSeverity] = useState('');
  const [action, setAction]     = useState('');
  const [search, setSearch]     = useState('');
  const [limit, setLimit]       = useState(200);

  if (!canView) {
    return (
      <Card className="p-10 text-center">
        <div className="text-3xl mb-2">🔒</div>
        <p className="text-sm font-semibold" style={{ color: 'var(--text)' }}>Audit log access denied</p>
      </Card>
    );
  }

  const entries = listAudit({ school_id: scope, severity: severity || undefined, action: action || undefined, search: search || undefined, limit });
  const stats = auditStats(scope);

  const exportCsv = () => {
    const rows = entries.map(e => [
      e.id, formatWhen(e.at), actionLabel(e.action), e.severity, e.actor, e.role ?? '', e.school_id ?? '', e.target ?? '', e.detail ?? '',
    ]);
    const csv = csvText([['ID', 'When', 'Action', 'Severity', 'Actor', 'Role', 'Tenant', 'Target', 'Detail'], ...rows]);
    const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'skoulhub-audit-log.csv';
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="animate-fade-in space-y-4">
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-lg font-extrabold" style={{ color: 'var(--text)' }}>Audit Log</h2>
          <p className="text-xs mt-0.5" style={{ color: 'var(--text-dim)' }}>
            {isSaasAdmin ? 'All tenants' : 'Your school only'} · privileged and financial actions
          </p>
        </div>
        {entries.length > 0 && <GhostButton onClick={exportCsv}>Export CSV</GhostButton>}
      </div>

      <div className="grid grid-cols-3 gap-4">
        {[
          { label: 'Entries', value: stats.total, color: 'var(--accent)' },
          { label: 'Critical', value: stats.critical, color: 'var(--danger)' },
          { label: 'Security notices', value: stats.notice, color: 'var(--warn)' },
        ].map(s => (
          <Card key={s.label} className="p-4">
            <div className="text-xs" style={{ color: 'var(--text-dim)' }}>{s.label}</div>
            <div className="text-xl font-extrabold" style={{ color: s.color }}>{s.value}</div>
          </Card>
        ))}
      </div>

      <Card>
        <SectionHeader title="Filters" subtitle="Narrow the trail by severity, action or free text" />
        <div className="p-4 grid grid-cols-1 sm:grid-cols-4 gap-3">
          <Select value={severity} onChange={e => setSeverity(e.target.value)} aria-label="Severity">
            <option value="">All severities</option>
            <option value={AUDIT_SEVERITY.CRITICAL}>Critical</option>
            <option value={AUDIT_SEVERITY.NOTICE}>Notice</option>
            <option value={AUDIT_SEVERITY.INFO}>Info</option>
          </Select>
          <Select value={action} onChange={e => setAction(e.target.value)} aria-label="Action">
            <option value="">All actions</option>
            {Object.values(AUDIT_ACTIONS).map(a => <option key={a} value={a}>{actionLabel(a)}</option>)}
          </Select>
          <TextInput value={search} onChange={e => setSearch(e.target.value)} placeholder="Search actor, target…" />
          <Select value={String(limit)} onChange={e => setLimit(Number(e.target.value))} aria-label="Limit">
            {[50, 200, 500].map(n => <option key={n} value={n}>Latest {n}</option>)}
          </Select>
        </div>
      </Card>

      <Card className="overflow-x-auto">
        <table className="w-full min-w-[900px]">
          <thead>
            <tr style={{ background: 'var(--surface-2)', borderBottom: '1px solid var(--border)' }}>
              {['When', 'Action', 'Severity', 'Actor', 'Role', 'Tenant', 'Target', 'Detail'].map(h => (
                <th key={h} className="text-left px-4 py-3 text-[11px] font-bold uppercase tracking-wider" style={{ color: 'var(--text-dim)' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y" style={{ borderColor: 'var(--border-subtle)' }}>
            {entries.length === 0 && (
              <tr><td colSpan={8} className="px-4 py-12 text-center text-sm" style={{ color: 'var(--text-dim)' }}>
                Nothing recorded yet. Privileged and financial actions appear here as they happen.
              </td></tr>
            )}
            {entries.map(e => {
              const st = SEVERITY_STYLE[e.severity] ?? SEVERITY_STYLE[AUDIT_SEVERITY.INFO];
              return (
                <tr key={e.id} className="hover:bg-gray-50/50">
                  <td className="px-4 py-3 text-[11px] whitespace-nowrap" style={{ color: 'var(--text-muted)' }}>{formatWhen(e.at)}</td>
                  <td className="px-4 py-3 text-xs font-semibold" style={{ color: 'var(--text)' }}>{actionLabel(e.action)}</td>
                  <td className="px-4 py-3">
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full" style={{ background: st.bg, color: st.fg }}>{st.label}</span>
                  </td>
                  <td className="px-4 py-3 text-xs" style={{ color: 'var(--text)' }}>{e.actor}</td>
                  <td className="px-4 py-3 text-[11px]" style={{ color: 'var(--text-dim)' }}>{e.role ?? '—'}</td>
                  <td className="px-4 py-3 text-[11px] font-mono" style={{ color: 'var(--text-dim)' }}>{e.school_id ?? '—'}</td>
                  <td className="px-4 py-3 text-xs" style={{ color: 'var(--text-muted)' }}>{e.target ?? '—'}</td>
                  <td className="px-4 py-3 text-[11px]" style={{ color: 'var(--text-dim)' }}>{e.detail ?? '—'}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </Card>

      <p className="text-[11px]" style={{ color: 'var(--text-dim)' }}>
        Recorded in-browser for the prototype (last 500 events, not tamper-evident). In production this
        must be a server-side append-only table written by the API.
      </p>
    </div>
  );
}
