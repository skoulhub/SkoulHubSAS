-- ═══════════════════════════════════════════════════════════════════════════
-- Hardening found by testing 0001 against the live database.
--
-- Three real defects were caught by running the policies rather than reading
-- them; each is fixed here so the migration set is reproducible from scratch.
-- ═══════════════════════════════════════════════════════════════════════════

-- ── 1. Billing guard blocked migrations and the service role ───────────────
-- The trigger required is_saas_admin(), which is false when there is no
-- end-user JWT — so scheduled billing jobs and migrations could not touch a
-- subscription.
create or replace function guard_school_billing()
returns trigger language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if auth.uid() is null then return new; end if;          -- migrations, service_role, cron
  if is_saas_admin() then return new; end if;
  if new.plan_id               is distinct from old.plan_id
     or new.status             is distinct from old.status
     or new.trial_ends_at      is distinct from old.trial_ends_at
     or new.current_period_end is distinct from old.current_period_end
     or new.current_period_start is distinct from old.current_period_start
     or new.suspended_at       is distinct from old.suspended_at
     or new.suspend_reason     is distinct from old.suspend_reason
     or new.student_count      is distinct from old.student_count then
    raise exception 'Only the platform operator may change subscription fields'
      using errcode = '42501';
  end if;
  return new;
end $$;

-- ── 2. Infinite recursion between students and student_parents ─────────────
-- students_select referenced student_parents, whose policy referenced
-- students, so any read raised 42P17: infinite recursion detected.
-- These helpers are SECURITY DEFINER: they read the link tables with RLS
-- bypassed, breaking the cycle, and only ever answer about the caller.
create or replace function is_parent_of(p_student uuid)
returns boolean language sql stable security definer set search_path = public, pg_temp as $$
  select exists (
    select 1 from student_parents sp
    join parents pa on pa.id = sp.parent_id
    where sp.student_id = p_student and pa.profile_id = auth.uid()
  );
$$;

create or replace function is_own_parent_record(p_parent uuid)
returns boolean language sql stable security definer set search_path = public, pg_temp as $$
  select exists (select 1 from parents where id = p_parent and profile_id = auth.uid());
$$;

create or replace function student_school(p_student uuid)
returns text language sql stable security definer set search_path = public, pg_temp as $$
  select school_id from students where id = p_student;
$$;

create or replace function parent_school(p_parent uuid)
returns text language sql stable security definer set search_path = public, pg_temp as $$
  select school_id from parents where id = p_parent;
$$;

drop policy if exists students_select on students;
create policy students_select on students for select to authenticated
  using (
    is_saas_admin()
    or (tenant_is_active() and (
         (school_id = auth_school_id() and has_perm('students.view'))
         or is_parent_of(id)
       ))
  );

drop policy if exists student_parents_select on student_parents;
create policy student_parents_select on student_parents for select to authenticated
  using (
    is_saas_admin()
    or is_own_parent_record(parent_id)
    or (tenant_is_active() and student_school(student_id) = auth_school_id() and has_perm('students.view'))
  );

drop policy if exists student_parents_write on student_parents;
create policy student_parents_write on student_parents for all to authenticated
  using (tenant_is_active() and student_school(student_id) = auth_school_id() and has_perm('students.edit'))
  with check (tenant_is_active() and student_school(student_id) = auth_school_id() and has_perm('students.edit'));

drop policy if exists parents_select on parents;
create policy parents_select on parents for select to authenticated
  using (
    is_saas_admin()
    or is_own_parent_record(id)
    or (tenant_is_active() and school_id = auth_school_id() and has_perm('parents.view'))
  );

-- ── 3. Anonymous enrollment submissions were impossible ────────────────────
-- The INSERT policy checked the school through a normal SELECT, which is
-- itself RLS-protected, so anon could never satisfy it. Resolve it through a
-- definer helper so the public form works while staying school-scoped.
create or replace function school_accepts_enrollments(p_school text)
returns boolean language sql stable security definer set search_path = public, pg_temp as $$
  select exists (
    select 1 from schools
    where id = p_school and status in ('trial','active','grace')
  );
$$;

drop policy if exists enrollments_public_insert on enrollments;
create policy enrollments_public_insert on enrollments for insert to anon, authenticated
  with check (school_accepts_enrollments(school_id));
