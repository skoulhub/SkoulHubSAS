-- ═══════════════════════════════════════════════════════════════════════════
-- Tables the dashboard renders that 0001 did not model: staff records and
-- fee payments, plus the display fields the UI expects on students/parents.
-- Policies follow the same permission matrix as everything else.
-- ═══════════════════════════════════════════════════════════════════════════

alter table students add column if not exists fee_status  text not null default 'Unpaid';
alter table students add column if not exists parent_name text;
alter table parents  add column if not exists status       text not null default 'Active';
alter table parents  add column if not exists balance      numeric(14,2) not null default 0;
alter table parents  add column if not exists last_contact date;

create table if not exists teachers (
  id         uuid primary key default gen_random_uuid(),
  school_id  text not null references schools(id) on delete cascade,
  profile_id uuid references profiles(id) on delete set null,
  name       text not null,
  subject    text,
  class      text,
  status     text not null default 'Present',
  schedule   text,
  created_at timestamptz not null default now()
);
create index if not exists teachers_school_idx on teachers (school_id);

create table if not exists payments (
  id           uuid primary key default gen_random_uuid(),
  school_id    text not null references schools(id) on delete cascade,
  student_name text not null,
  amount       numeric(14,2) not null check (amount >= 0),
  method       text,
  paid_on      date not null default current_date,
  status       text not null default 'Pending',
  recorded_by  uuid references profiles(id) on delete set null,
  created_at   timestamptz not null default now()
);
create index if not exists payments_school_idx on payments (school_id, paid_on desc);

-- Does the signed-in parent have a child by this name?
create or replace function is_parent_of_name(p_name text)
returns boolean language sql stable security definer set search_path = public, pg_temp as $$
  select exists (
    select 1 from student_parents sp
    join parents  pa on pa.id = sp.parent_id
    join students s  on s.id  = sp.student_id
    where pa.profile_id = auth.uid() and lower(s.name) = lower(p_name)
  );
$$;

alter table teachers enable row level security;
alter table payments enable row level security;

-- ── teachers ───────────────────────────────────────────────────────────────
drop policy if exists teachers_select on teachers;
create policy teachers_select on teachers for select to authenticated
  using (
    is_saas_admin()
    or (tenant_is_active() and school_id = auth_school_id() and has_perm('teachers.view'))
    or profile_id = auth.uid()
  );

drop policy if exists teachers_insert on teachers;
create policy teachers_insert on teachers for insert to authenticated
  with check (tenant_is_active() and school_id = auth_school_id() and has_perm('teachers.create'));

drop policy if exists teachers_update on teachers;
create policy teachers_update on teachers for update to authenticated
  using (tenant_is_active() and school_id = auth_school_id() and has_perm('teachers.edit'))
  with check (school_id = auth_school_id());

drop policy if exists teachers_delete on teachers;
create policy teachers_delete on teachers for delete to authenticated
  using (tenant_is_active() and school_id = auth_school_id() and has_perm('teachers.create'));

-- ── payments ───────────────────────────────────────────────────────────────
-- Staff with finance.view see the school's payments; a parent sees only
-- payments recorded against their own children.
drop policy if exists payments_select on payments;
create policy payments_select on payments for select to authenticated
  using (
    is_saas_admin()
    or is_parent_of_name(student_name)
    or (tenant_is_active() and school_id = auth_school_id() and has_perm('finance.view'))
  );

drop policy if exists payments_insert on payments;
create policy payments_insert on payments for insert to authenticated
  with check (tenant_is_active() and school_id = auth_school_id() and has_perm('finance.record'));

drop policy if exists payments_update on payments;
create policy payments_update on payments for update to authenticated
  using (tenant_is_active() and school_id = auth_school_id() and has_perm('finance.record'))
  with check (school_id = auth_school_id());

drop policy if exists payments_delete on payments;
create policy payments_delete on payments for delete to authenticated
  using (tenant_is_active() and school_id = auth_school_id() and has_perm('finance.approve'));

grant select, insert, update, delete on teachers, payments to authenticated;
