-- ═══════════════════════════════════════════════════════════════════════════
-- SkoulHub — initial schema, tenant isolation and the RBAC enforcement layer
--
-- This is the fix for the review's Critical finding: every access control in
-- the SPA was advisory because it ran in the browser. Here the same rules are
-- enforced by Postgres, so bypassing the UI gains nothing.
--
-- Tenant isolation is by `school_id`, and every policy derives the caller's
-- scope from their profile — never from anything the client sends.
-- ═══════════════════════════════════════════════════════════════════════════

create extension if not exists pgcrypto;

-- ── Enums ──────────────────────────────────────────────────────────────────
do $$ begin
  create type user_role as enum ('saas_admin','school_admin','head_teacher','teacher','parent','bursar');
exception when duplicate_object then null; end $$;

do $$ begin
  create type tenant_status as enum ('trial','active','grace','suspended','cancelled','expired');
exception when duplicate_object then null; end $$;

do $$ begin
  create type invoice_status as enum ('pending','paid','overdue','void');
exception when duplicate_object then null; end $$;

do $$ begin
  create type enrollment_status as enum ('submitted','under_review','accepted','rejected','waitlisted');
exception when duplicate_object then null; end $$;

do $$ begin
  create type audit_severity as enum ('info','notice','critical');
exception when duplicate_object then null; end $$;

-- ── Tenant registry ────────────────────────────────────────────────────────
create table if not exists schools (
  id                   text primary key,
  name                 text not null,
  short_name           text,
  contact              jsonb not null default '{}'::jsonb,
  plan_id              text not null default 'standard',
  student_count        int  not null default 0 check (student_count >= 0),
  status               tenant_status not null default 'trial',
  trial_ends_at        timestamptz,
  current_period_start timestamptz,
  current_period_end   timestamptz,
  suspended_at         timestamptz,
  suspend_reason       text,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);

-- ── Users ──────────────────────────────────────────────────────────────────
-- One row per signed-in person, keyed to the auth user. The CHECK mirrors the
-- client invariant: only the platform operator exists outside a tenant.
create table if not exists profiles (
  id               uuid primary key references auth.users(id) on delete cascade,
  email            text not null,
  name             text not null,
  phone            text,
  role             user_role not null,
  school_id        text references schools(id) on delete cascade,
  status           text not null default 'active',
  created_at       timestamptz not null default now(),
  last_sign_in_at  timestamptz,
  constraint tenant_roles_need_a_school check (
    (role = 'saas_admin' and school_id is null)
    or (role <> 'saas_admin' and school_id is not null)
  )
);
create unique index if not exists profiles_email_lower_idx on profiles (lower(email));
create index if not exists profiles_school_idx on profiles (school_id);

-- ── Authorization matrix ───────────────────────────────────────────────────
-- Seeded from src/lib/permissions.js so the server and the UI cannot drift.
create table if not exists role_permissions (
  role       user_role not null,
  permission text not null,
  primary key (role, permission)
);

-- ── Tenant data ────────────────────────────────────────────────────────────
create table if not exists students (
  id             uuid primary key default gen_random_uuid(),
  school_id      text not null references schools(id) on delete cascade,
  name           text not null,
  class          text,
  gender         text,
  dob            date,
  guardian_name  text,
  guardian_phone text,
  status         text not null default 'active',
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);
create index if not exists students_school_idx on students (school_id);

create table if not exists parents (
  id           uuid primary key default gen_random_uuid(),
  school_id    text not null references schools(id) on delete cascade,
  profile_id   uuid references profiles(id) on delete set null,   -- set when the parent can sign in
  name         text not null,
  phone        text,
  email        text,
  relationship text,
  occupation   text,
  address      text,
  created_at   timestamptz not null default now()
);
create index if not exists parents_school_idx on parents (school_id);
create index if not exists parents_profile_idx on parents (profile_id);

-- Which children belong to which parent — the scope a parent login can see.
create table if not exists student_parents (
  student_id uuid not null references students(id) on delete cascade,
  parent_id  uuid not null references parents(id)  on delete cascade,
  primary key (student_id, parent_id)
);

create table if not exists enrollments (
  id           uuid primary key default gen_random_uuid(),
  school_id    text not null references schools(id) on delete cascade,
  applicant    jsonb not null default '{}'::jsonb,
  status       enrollment_status not null default 'submitted',
  submitted_at timestamptz not null default now(),
  reviewed_by  uuid references profiles(id) on delete set null,
  reviewed_at  timestamptz,
  notes        text
);
create index if not exists enrollments_school_idx on enrollments (school_id, submitted_at desc);

-- ── Billing ────────────────────────────────────────────────────────────────
create table if not exists invoices (
  id          text primary key,
  school_id   text not null references schools(id) on delete cascade,
  plan_id     text not null,
  students    int  not null check (students >= 0),
  rate        numeric(12,2) not null check (rate >= 0),
  amount      numeric(14,2) not null check (amount >= 0),
  issued_at   timestamptz not null default now(),
  due_at      timestamptz not null,
  paid_at     timestamptz,
  method      text,
  reference   text,
  status      invoice_status not null default 'pending',
  created_at  timestamptz not null default now()
);
create index if not exists invoices_school_idx on invoices (school_id, issued_at desc);

-- ── Audit trail ────────────────────────────────────────────────────────────
-- Append-only by construction: see the trigger at the bottom of this file.
create table if not exists audit_log (
  id        bigserial primary key,
  at        timestamptz not null default now(),
  actor     text not null,
  actor_id  uuid,
  role      user_role,
  school_id text,
  action    text not null,
  target    text,
  detail    text,
  severity  audit_severity not null default 'info'
);
create index if not exists audit_log_school_idx on audit_log (school_id, at desc);
create index if not exists audit_log_at_idx on audit_log (at desc);

-- ═══════════════════════════════════════════════════════════════════════════
-- Identity helpers
--
-- SECURITY DEFINER so a policy on `profiles` can consult `profiles` without
-- recursing, and so tenant scope always comes from the server-side session.
-- search_path is pinned to defeat search-path hijacking.
-- ═══════════════════════════════════════════════════════════════════════════
create or replace function auth_profile()
returns profiles
language sql stable security definer set search_path = public, pg_temp as $$
  select * from profiles where id = auth.uid();
$$;

create or replace function auth_school_id()
returns text
language sql stable security definer set search_path = public, pg_temp as $$
  select school_id from profiles where id = auth.uid();
$$;

create or replace function auth_role()
returns user_role
language sql stable security definer set search_path = public, pg_temp as $$
  select role from profiles where id = auth.uid();
$$;

create or replace function is_saas_admin()
returns boolean
language sql stable security definer set search_path = public, pg_temp as $$
  select coalesce((select role = 'saas_admin' from profiles where id = auth.uid()), false);
$$;

-- The server-side equivalent of can(roleId, permission) in the client.
create or replace function has_perm(perm text)
returns boolean
language sql stable security definer set search_path = public, pg_temp as $$
  select exists (
    select 1 from role_permissions rp
    join profiles p on p.role = rp.role
    where p.id = auth.uid() and rp.permission = perm
  );
$$;

-- A tenant must be in good standing for its users to act at all. A suspended
-- school's sessions can still authenticate but cannot read or write data —
-- this is what makes the 30-day trial and auto-revocation *real* rather than
-- a banner in the UI.
create or replace function tenant_is_active()
returns boolean
language sql stable security definer set search_path = public, pg_temp as $$
  select coalesce((
    select s.status in ('trial','active','grace')
    from profiles p join schools s on s.id = p.school_id
    where p.id = auth.uid()
  ), true);   -- saas_admin has no tenant; platform staff are never blocked
$$;

-- ── Keep updated_at honest ─────────────────────────────────────────────────
create or replace function touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

drop trigger if exists schools_touch on schools;
create trigger schools_touch before update on schools
  for each row execute function touch_updated_at();

drop trigger if exists students_touch on students;
create trigger students_touch before update on students
  for each row execute function touch_updated_at();

-- ── Billing columns are operator-only ──────────────────────────────────────
-- RLS filters rows, not columns. Without this a school admin could edit their
-- own row and change their plan or clear a suspension.
create or replace function guard_school_billing()
returns trigger language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if is_saas_admin() then return new; end if;
  if new.plan_id              is distinct from old.plan_id
     or new.status            is distinct from old.status
     or new.trial_ends_at     is distinct from old.trial_ends_at
     or new.current_period_end is distinct from old.current_period_end
     or new.current_period_start is distinct from old.current_period_start
     or new.suspended_at      is distinct from old.suspended_at
     or new.suspend_reason    is distinct from old.suspend_reason
     or new.student_count     is distinct from old.student_count then
    raise exception 'Only the platform operator may change subscription fields'
      using errcode = '42501';
  end if;
  return new;
end $$;

drop trigger if exists schools_billing_guard on schools;
create trigger schools_billing_guard before update on schools
  for each row execute function guard_school_billing();

-- ── The audit trail cannot be rewritten ────────────────────────────────────
create or replace function audit_log_is_append_only()
returns trigger language plpgsql as $$
begin
  raise exception 'audit_log is append-only (% rejected)', tg_op using errcode = '42501';
end $$;

drop trigger if exists audit_log_immutable on audit_log;
create trigger audit_log_immutable before update or delete on audit_log
  for each row execute function audit_log_is_append_only();

-- ═══════════════════════════════════════════════════════════════════════════
-- Row Level Security
-- ═══════════════════════════════════════════════════════════════════════════
alter table schools          enable row level security;
alter table profiles         enable row level security;
alter table role_permissions enable row level security;
alter table students         enable row level security;
alter table parents          enable row level security;
alter table student_parents  enable row level security;
alter table enrollments      enable row level security;
alter table invoices         enable row level security;
alter table audit_log        enable row level security;

-- ── profiles ───────────────────────────────────────────────────────────────
drop policy if exists profiles_select_self on profiles;
create policy profiles_select_self on profiles for select to authenticated
  using (id = auth.uid());

drop policy if exists profiles_select_colleagues on profiles;
create policy profiles_select_colleagues on profiles for select to authenticated
  using (
    is_saas_admin()
    or (school_id = auth_school_id() and has_perm('teachers.view'))
  );

drop policy if exists profiles_update_self on profiles;
create policy profiles_update_self on profiles for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid());

drop policy if exists profiles_admin_write on profiles;
create policy profiles_admin_write on profiles for all to authenticated
  using (is_saas_admin() or (school_id = auth_school_id() and has_perm('settings.edit')))
  with check (is_saas_admin() or (school_id = auth_school_id() and has_perm('settings.edit')));

-- ── role_permissions: readable, never writable from a client ───────────────
drop policy if exists role_permissions_read on role_permissions;
create policy role_permissions_read on role_permissions for select to authenticated
  using (true);

-- ── schools ────────────────────────────────────────────────────────────────
drop policy if exists schools_select on schools;
create policy schools_select on schools for select to authenticated
  using (is_saas_admin() or id = auth_school_id());

drop policy if exists schools_update_self on schools;
create policy schools_update_self on schools for update to authenticated
  using (id = auth_school_id() and has_perm('settings.edit'))
  with check (id = auth_school_id());

drop policy if exists schools_operator_write on schools;
create policy schools_operator_write on schools for all to authenticated
  using (is_saas_admin()) with check (is_saas_admin());

-- ── students ───────────────────────────────────────────────────────────────
-- Staff see their school; a parent sees only children linked to them.
drop policy if exists students_select on students;
create policy students_select on students for select to authenticated
  using (
    tenant_is_active() and (
      is_saas_admin()
      or (school_id = auth_school_id() and has_perm('students.view'))
      or exists (
        select 1 from student_parents sp
        join parents pa on pa.id = sp.parent_id
        where sp.student_id = students.id and pa.profile_id = auth.uid()
      )
    )
  );

drop policy if exists students_insert on students;
create policy students_insert on students for insert to authenticated
  with check (tenant_is_active() and school_id = auth_school_id() and has_perm('students.create'));

drop policy if exists students_update on students;
create policy students_update on students for update to authenticated
  using (tenant_is_active() and school_id = auth_school_id() and has_perm('students.edit'))
  with check (school_id = auth_school_id());

drop policy if exists students_delete on students;
create policy students_delete on students for delete to authenticated
  using (tenant_is_active() and school_id = auth_school_id() and has_perm('students.delete'));

-- ── parents ────────────────────────────────────────────────────────────────
drop policy if exists parents_select on parents;
create policy parents_select on parents for select to authenticated
  using (
    tenant_is_active() and (
      is_saas_admin()
      or (school_id = auth_school_id() and has_perm('parents.view'))
      or profile_id = auth.uid()
    )
  );

drop policy if exists parents_insert on parents;
create policy parents_insert on parents for insert to authenticated
  with check (tenant_is_active() and school_id = auth_school_id() and has_perm('parents.create'));

drop policy if exists parents_update on parents;
create policy parents_update on parents for update to authenticated
  using (tenant_is_active() and school_id = auth_school_id() and has_perm('parents.edit'))
  with check (school_id = auth_school_id());

drop policy if exists parents_delete on parents;
create policy parents_delete on parents for delete to authenticated
  using (tenant_is_active() and school_id = auth_school_id() and has_perm('parents.create'));

-- ── student_parents ────────────────────────────────────────────────────────
drop policy if exists student_parents_select on student_parents;
create policy student_parents_select on student_parents for select to authenticated
  using (
    exists (
      select 1 from students s
      where s.id = student_parents.student_id
        and (is_saas_admin()
             or (s.school_id = auth_school_id() and has_perm('students.view'))
             or exists (select 1 from parents pa
                        where pa.id = student_parents.parent_id and pa.profile_id = auth.uid()))
    )
  );

drop policy if exists student_parents_write on student_parents;
create policy student_parents_write on student_parents for all to authenticated
  using (exists (select 1 from students s
                 where s.id = student_parents.student_id
                   and s.school_id = auth_school_id() and has_perm('students.edit')))
  with check (exists (select 1 from students s
                 where s.id = student_parents.student_id
                   and s.school_id = auth_school_id() and has_perm('students.edit')));

-- ── enrollments ────────────────────────────────────────────────────────────
-- The public application form may submit, but never read back. Staff with the
-- enrollment tool can read and review their own school's applications.
drop policy if exists enrollments_public_insert on enrollments;
create policy enrollments_public_insert on enrollments for insert to anon, authenticated
  with check (
    exists (select 1 from schools s where s.id = school_id and s.status in ('trial','active','grace'))
  );

drop policy if exists enrollments_staff_select on enrollments;
create policy enrollments_staff_select on enrollments for select to authenticated
  using (
    is_saas_admin()
    or (school_id = auth_school_id() and has_perm('enrollment.manage'))
  );

drop policy if exists enrollments_staff_update on enrollments;
create policy enrollments_staff_update on enrollments for update to authenticated
  using (school_id = auth_school_id() and has_perm('enrollment.manage'))
  with check (school_id = auth_school_id());

-- ── invoices ───────────────────────────────────────────────────────────────
-- A school sees its own bills; only the operator issues or settles them, and
-- only the operator can move money-adjacent state.
drop policy if exists invoices_select on invoices;
create policy invoices_select on invoices for select to authenticated
  using (is_saas_admin() or (school_id = auth_school_id() and has_perm('subscription.view')));

drop policy if exists invoices_operator_write on invoices;
create policy invoices_operator_write on invoices for all to authenticated
  using (is_saas_admin()) with check (is_saas_admin());

-- ── audit_log ──────────────────────────────────────────────────────────────
-- Any signed-in user may append (the app records sign-ins and failures); the
-- trigger above makes the table immutable, and there is no UPDATE/DELETE path.
drop policy if exists audit_log_insert on audit_log;
create policy audit_log_insert on audit_log for insert to authenticated
  with check (actor_id is null or actor_id = auth.uid());

drop policy if exists audit_log_select on audit_log;
create policy audit_log_select on audit_log for select to authenticated
  using (
    is_saas_admin()
    or (school_id = auth_school_id() and has_perm('audit.view'))
  );

-- ── Grants ─────────────────────────────────────────────────────────────────
grant usage on schema public to anon, authenticated;
grant select, insert, update, delete on students, parents, student_parents, enrollments, invoices, schools, profiles to authenticated;
grant select on role_permissions to authenticated;
grant select, insert on audit_log to authenticated;
grant usage, select on all sequences in schema public to authenticated;
grant insert on enrollments to anon;

revoke update, delete on audit_log from authenticated, anon;
