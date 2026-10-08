import { describe, it, expect, beforeEach } from 'vitest';
import {
  recordAudit, listAudit, auditSize, auditStats, _resetAudit, setAuditActor,
  AUDIT_ACTIONS, AUDIT_SEVERITY, AUDIT_CAP,
} from './audit';

const T0 = 1_700_000_000_000;
beforeEach(() => _resetAudit());

describe('audit — recording', () => {
  it('appends an entry with a stable id, timestamp and severity', () => {
    const e = recordAudit({
      action: AUDIT_ACTIONS.INVOICE_PAID, actor: 'James Okoye', role: 'bursar',
      school_id: 'skh-001', target: 'INV-00001', detail: 'UGX 6,000,000 · Mobile Money',
      severity: AUDIT_SEVERITY.CRITICAL, now: T0,
    });
    expect(e.id).toBe('AUD-00001');
    expect(e.at).toBe(T0);
    expect(e.action).toBe('billing.invoice_paid');
    expect(e.severity).toBe('critical');
    expect(auditSize()).toBe(1);
  });

  it('defaults the actor and severity safely', () => {
    const e = recordAudit({ action: 'x', now: T0 });
    expect(e.actor).toBe('system');
    expect(e.severity).toBe(AUDIT_SEVERITY.INFO);
    expect(e.school_id).toBeNull();
  });

  it('caps the buffer so it cannot grow unbounded', () => {
    for (let i = 0; i < AUDIT_CAP + 25; i++) recordAudit({ action: 'noise', now: T0 + i });
    expect(auditSize()).toBe(AUDIT_CAP);
    // oldest entries were dropped, newest kept
    expect(listAudit({ limit: 1 })[0].at).toBe(T0 + AUDIT_CAP + 24);
  });
});

describe('audit — ambient actor', () => {
  it('attributes entries to the signed-in actor without passing it at each call site', () => {
    setAuditActor({ name: 'Robert Ssemanda', role: 'head_teacher', school_id: 'skh-001' });
    const e = recordAudit({ action: AUDIT_ACTIONS.RESULTS_APPROVED, target: 'S.3 East' });
    expect(e.actor).toBe('Robert Ssemanda');
    expect(e.role).toBe('head_teacher');
    expect(e.school_id).toBe('skh-001');
  });

  it('can still be overridden explicitly (e.g. a pre-login failure)', () => {
    setAuditActor({ name: 'someone', role: 'teacher', school_id: 'skh-001' });
    const e = recordAudit({ action: AUDIT_ACTIONS.MFA_FAILED, actor: 'attacker@x.ug', role: null, school_id: null });
    expect(e.actor).toBe('attacker@x.ug');
    expect(e.school_id).toBeNull();
  });

  it('falls back to system when nobody is signed in', () => {
    expect(recordAudit({ action: 'x' }).actor).toBe('system');
  });
});

describe('audit — reading', () => {
  beforeEach(() => {
    recordAudit({ action: AUDIT_ACTIONS.STUDENT_CREATED, actor: 'Agnes', role: 'school_admin', school_id: 'skh-001', target: 'Aisha Nakato', now: T0 });
    recordAudit({ action: AUDIT_ACTIONS.INVOICE_PAID, actor: 'James', role: 'bursar', school_id: 'skh-002', target: 'INV-00009', severity: AUDIT_SEVERITY.CRITICAL, now: T0 + 1000 });
    recordAudit({ action: AUDIT_ACTIONS.SIGN_IN, actor: 'Grace', role: 'teacher', school_id: 'skh-001', severity: AUDIT_SEVERITY.NOTICE, now: T0 + 2000 });
  });

  it('returns newest first', () => {
    expect(listAudit().map(e => e.actor)).toEqual(['Grace', 'James', 'Agnes']);
  });

  it('scopes to a single tenant — schools cannot read each other', () => {
    const scoped = listAudit({ school_id: 'skh-001' });
    expect(scoped).toHaveLength(2);
    expect(scoped.every(e => e.school_id === 'skh-001')).toBe(true);
  });

  it('filters by action, severity and free text', () => {
    expect(listAudit({ action: AUDIT_ACTIONS.INVOICE_PAID })).toHaveLength(1);
    expect(listAudit({ severity: AUDIT_SEVERITY.NOTICE })).toHaveLength(1);
    expect(listAudit({ search: 'aisha' })).toHaveLength(1);
    expect(listAudit({ search: 'nothing-here' })).toHaveLength(0);
  });

  it('honours the limit', () => {
    expect(listAudit({ limit: 2 })).toHaveLength(2);
  });

  it('summarises counts for the console header', () => {
    expect(auditStats('skh-001')).toEqual({ total: 2, critical: 0, notice: 1 });
    expect(auditStats(undefined).total).toBe(3);
  });

  it('does not mutate the log when reading', () => {
    const before = auditSize();
    listAudit({ school_id: 'skh-001' }).pop();
    expect(auditSize()).toBe(before);
  });
});
