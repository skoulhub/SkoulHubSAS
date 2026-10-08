# SkoulHub — database, tenant isolation and authorization

The SPA used to hold all of its access control in the browser, which meant every
rule was advisory. This directory moves those rules into Postgres, where they
are enforced regardless of what the client does.

| | |
|---|---|
| Project ref | `agituigqyykpdriyyoiy` |
| Region | `eu-central-1` (Frankfurt) |
| Postgres | 17.11 |
| Tables | 9, **all with RLS enabled** |
| Policies | 25 |
| Authorization tests | 30, all passing |

## Layout

```
supabase/
  migrations/
    0001_init.sql        schema, RLS policies, helper functions, triggers
    0002_hardening.sql   fixes found by running the policies (see below)
  tests/
    rls_security_test.py end-to-end authorization suite against a live project
```

## Applying migrations

Migrations are plain SQL and are applied through the Supabase Management API, so
no database password or dashboard login is needed:

```bash
printf 'sbp_your_token\n' > ~/.supabase-token && chmod 600 ~/.supabase-token

curl -s -X POST \
  -H "Authorization: Bearer $(cat ~/.supabase-token)" \
  -H "Content-Type: application/json" \
  "https://api.supabase.com/v1/projects/agituigqyykpdriyyoiy/database/query" \
  -d "$(python3 -c 'import json,sys; print(json.dumps({"query": open(sys.argv[1]).read()}))' \
        supabase/migrations/0001_init.sql)"
```

They are also `supabase db push` compatible if you prefer the CLI.

## Running the authorization tests

```bash
python3 supabase/tests/rls_security_test.py
```

It impersonates each seeded user by setting the request JWT claims inside a
transaction that is rolled back, so it is safe to run against live data. A
non-zero exit means something regressed.

## How isolation works

`school_id` is the tenant key. Nothing about the caller's scope is ever taken
from the client — every policy derives it from `auth.uid()`:

| Helper | Answers |
|---|---|
| `auth_school_id()` | which tenant the caller belongs to |
| `auth_role()` | the caller's role |
| `is_saas_admin()` | is this the platform operator |
| `has_perm(perm)` | the server-side twin of `can(role, permission)` in `src/lib/permissions.js` |
| `tenant_is_active()` | is the caller's tenant paying / in trial / in grace |
| `is_parent_of(student)` | is this child the caller's |

`has_perm` reads the `role_permissions` table, which is **seeded directly from
`src/lib/permissions.js`** so the client and the server cannot drift apart.

Two guarantees worth calling out:

- **Suspension is real.** `tenant_is_active()` is consulted by every data
  policy, so a school that stops paying loses access at the database, even with
  a valid session. `trial`, `active` and `grace` allow access; `suspended` and
  `expired` do not.
- **The audit log is append-only.** `UPDATE`/`DELETE` are revoked from the API
  roles, and a trigger rejects them as a second layer.

## Defects found by testing (fixed in 0002)

Running the policies against the live database caught three problems that
reading them did not:

1. **Infinite recursion (42P17).** `students_select` queried `student_parents`,
   whose policy queried `students` back, so *any* read of students failed.
   Resolved with `SECURITY DEFINER` helpers that break the cycle.
2. **Billing guard blocked legitimate writes.** The trigger required
   `is_saas_admin()`, which is false when there is no end-user JWT — so the
   service role, migrations and scheduled billing jobs could not touch a
   subscription. Now short-circuits when `auth.uid()` is null.
3. **Anonymous enrollment was impossible.** The public form's INSERT policy
   checked the school through a normal SELECT, which is itself RLS-protected,
   so `anon` could never satisfy it. Now uses `school_accepts_enrollments()`.

## Demo accounts

Seeded users (one per role, plus a suspended tenant) are listed with a shared
password in `~/.skoulhub-demo-users`, which is **not** in this repository.
Change or delete them before real use.

## Still to do

- Wire the SPA to this database (replace `src/lib/tenantStore.js`) and move the
  client to Supabase Auth.
- Move the billing lifecycle (`src/lib/billing.js`) into a scheduled function
  plus a payment webhook, so trials and revocation no longer depend on the
  browser's clock.
- Move `src/lib/audit.js` writes to the `audit_log` table.
- Storage buckets for enrollment documents and student photographs.
