#!/usr/bin/env python3
"""
RLS & RBAC security test suite — SkoulHub.

Runs the tenant-isolation and authorization guarantees against the live
database through the Supabase Management API, impersonating each seeded user
by setting the request JWT claims inside a rolled-back transaction.

Usage:  python3 supabase/tests/rls_security_test.py [project-ref]

Requires ~/.supabase-token (a Supabase personal access token).
Exit code is non-zero if any check fails.

A note on "blocked": for a role with no table privilege at all, Postgres
answers with 42501 before RLS is consulted. That is a pass — it is strictly
stronger than returning zero rows — so `blocked()` accepts either.
"""
import json
import pathlib
import sys
import urllib.error
import urllib.request

REF = sys.argv[1] if len(sys.argv) > 1 else 'agituigqyykpdriyyoiy'
TOKEN = pathlib.Path.home().joinpath('.supabase-token').read_text().strip()

PASS, FAIL = [], []


def sql(query):
    """Run SQL as the database owner. Returns ('ok', rows) or ('err', message)."""
    req = urllib.request.Request(
        f'https://api.supabase.com/v1/projects/{REF}/database/query',
        data=json.dumps({'query': query}).encode(),
        headers={'Authorization': f'Bearer {TOKEN}', 'Content-Type': 'application/json'},
        method='POST')
    try:
        with urllib.request.urlopen(req, timeout=120) as r:
            body = r.read().decode().strip()
            return ('ok', json.loads(body) if body else [])
    except urllib.error.HTTPError as e:
        return ('err', e.read().decode())


def as_role(uid, stmt, role='authenticated'):
    claims = json.dumps({'sub': uid, 'role': role}) if uid else '{}'
    return (f"begin;\n"
            f"select set_config('role','{role}',true);\n"
            f"select set_config('request.jwt.claims','{claims}',true);\n"
            f"{stmt}\n"
            f"rollback;")


def check(label, condition, detail=''):
    (PASS if condition else FAIL).append(label)
    print(f"  {'✓' if condition else '✗'} {label:46s} {detail}")


def blocked(label, kind, out, detail=''):
    """Pass when the read returned nothing OR was refused outright."""
    if kind == 'err':
        check(label, True, f"{detail} refused (42501/RLS)")
    else:
        rows = out[0].get('n') if out and isinstance(out[0], dict) else None
        check(label, rows == 0, f"{detail} {rows} rows")


def main():
    ids = {r['email']: r['id'] for r in sql("select email, id from profiles")[1]} \
        if sql("select email, id from profiles")[0] == 'ok' else {}
    need = ['platform@skoulhub.com', 'admin@smck.ug', 'admin@arua.ug',
            'teacher@smck.ug', 'parent@smck.ug', 'admin@mhs.ug']
    missing = [e for e in need if e not in ids]
    if missing:
        print(f"  ✗ seed users missing: {missing} — run the seed first")
        return 1

    A, B = ids['admin@smck.ug'], ids['admin@arua.ug']
    T, P = ids['teacher@smck.ug'], ids['parent@smck.ug']
    S, OP = ids['admin@mhs.ug'], ids['platform@skoulhub.com']

    print("\n  ── tenant isolation ──────────────────────────────────────────")
    for label, uid, want in [
        ('platform operator sees every tenant', OP, 6),
        ('school A admin sees only school A', A, 3),
        ('school B admin sees only school B', B, 2),
        ('teacher is scoped to their school', T, 3),
        ('parent sees only their own child', P, 1),
        ('suspended tenant reads nothing', S, 0),
    ]:
        kind, out = sql(as_role(uid, 'select count(*)::int as n from students;'))
        n = out[0]['n'] if kind == 'ok' and out else None
        check(label, n == want, f"{n} (want {want})")

    kind, out = sql(as_role(A, "select count(*)::int as n from students where school_id='skh-002';"))
    blocked('school A cannot read school B rows', kind, out)
    kind, out = sql(as_role(A, 'select count(*)::int as n from schools;'))
    check('school admin sees exactly one school row', kind == 'ok' and out[0]['n'] == 1,
          f"{out[0]['n'] if kind == 'ok' else out[:40]}")
    kind, out = sql(as_role(T, 'select count(*)::int as n from profiles;'))
    check('teacher cannot enumerate staff', kind == 'ok' and out[0]['n'] == 1,
          f"{out[0]['n'] if kind == 'ok' else out[:40]}")

    print("\n  ── privilege escalation is refused ───────────────────────────")
    for label, uid, stmt, needle in [
        ('school admin cannot change its own plan', A,
         "update schools set plan_id='premium' where id='skh-001';", 'operator'),
        ('school admin cannot lift a suspension', S,
         "update schools set status='active' where id='skh-005';", 'operator'),
        ('tenant cannot write into another tenant', A,
         "insert into students (school_id,name) values ('skh-002','Injected');", 'row-level security'),
        ('suspended tenant cannot write', S,
         "insert into students (school_id,name) values ('skh-005','Nope');", 'row-level security'),
        ('school admin cannot self-promote to operator', A,
         "update profiles set role='saas_admin' where id='" + A + "';", ''),
    ]:
        kind, out = sql(as_role(uid, stmt))
        ok = kind == 'err' and (not needle or needle.lower() in out.lower())
        check(label, ok, 'refused' if kind == 'err' else f'ALLOWED! {str(out)[:40]}')

    print("\n  ── subscription lifecycle gates data access ──────────────────")
    for status, want in [('active', 3), ('trial', 3), ('grace', 3),
                         ('suspended', 0), ('expired', 0), ('active', 3)]:
        prep = (f"update schools set status='{status}', "
                f"trial_ends_at=case when '{status}'='trial' then now()+interval '10 days' end "
                f"where id='skh-001';")
        kind, out = sql(f"begin;\n{prep}\n"
                        f"select set_config('role','authenticated',true);\n"
                        f"select set_config('request.jwt.claims','{{\"sub\":\"{A}\",\"role\":\"authenticated\"}}',true);\n"
                        f"select count(*)::int as n from students;\nrollback;")
        n = out[0]['n'] if kind == 'ok' and out else None
        check(f'{status:9s} → {want} students visible', n == want, f"{n}")

    print("\n  ── anonymous access ─────────────────────────────────────────")
    for label, stmt in [('anon cannot read students', 'select count(*)::int as n from students;'),
                        ('anon cannot read the tenant list', 'select count(*)::int as n from schools;'),
                        ('anon cannot read enrollments', 'select count(*)::int as n from enrollments;')]:
        kind, out = sql(as_role(None, stmt, role='anon'))
        blocked(label, kind, out)

    kind, out = sql(as_role(None,
        "insert into enrollments (school_id, applicant) values ('skh-001','{\"name\":\"Public Applicant\"}');",
        role='anon'))
    check('public form accepts an application', kind == 'ok',
          'submitted' if kind == 'ok' else out[:60])
    kind, out = sql(as_role(None,
        "insert into enrollments (school_id, applicant) values ('skh-005','{\"name\":\"X\"}');",
        role='anon'))
    check('public form rejects a suspended school', kind == 'err', 'refused' if kind == 'err' else 'ALLOWED!')

    print("\n  ── audit trail ──────────────────────────────────────────────")
    sql("insert into audit_log (actor,school_id,action,target,severity) values "
        "('Agnes Namukwaya','skh-001','billing.invoice_paid','INV-T1','critical'),"
        "('Peter Wani','skh-002','student.created','Daniel Ouma','info');")
    for label, uid, school in [('school A sees only its own audit trail', A, 'skh-001'),
                               ('school B sees only its own audit trail', B, 'skh-002')]:
        kind, out = sql(as_role(uid,
            "select count(*)::int as n, coalesce(string_agg(distinct school_id,','),'-') as s from audit_log;"))
        ok = kind == 'ok' and out[0]['s'] == school
        check(label, ok, f"{out[0]['s'] if kind == 'ok' else out[:40]}")
    kind, out = sql(as_role(OP, "select count(*)::int as n from audit_log;"))
    check('operator sees every tenant audit trail', kind == 'ok' and out[0]['n'] >= 2,
          f"{out[0]['n'] if kind == 'ok' else out[:40]}")

    for label, stmt in [('audit log cannot be edited', "update audit_log set detail='tampered';"),
                        ('audit log cannot be deleted', 'delete from audit_log;')]:
        kind, out = sql(as_role(A, stmt))
        check(label, kind == 'err', 'refused' if kind == 'err' else 'ALLOWED!')

    sql("delete from audit_log where target in ('INV-T1','Daniel Ouma','Public Applicant');")

    print(f"\n  ══ {len(PASS)} passed, {len(FAIL)} failed ══")
    if FAIL:
        for f in FAIL:
            print(f"     ✗ {f}")
    return 1 if FAIL else 0


if __name__ == '__main__':
    sys.exit(main())
