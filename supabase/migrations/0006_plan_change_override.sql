-- ═══════════════════════════════════════════════════════════════════════════
-- The billing guard was blocking its own sanctioned path.
--
-- request_plan_change() updates schools.plan_id, which fires the guard trigger;
-- the trigger asks is_saas_admin(), which is false for the school admin the RPC
-- exists to serve — so a tenant could never re-plan their own school.
--
-- The trigger now honours a transaction-local flag that only a guarded
-- SECURITY DEFINER function can set. A client cannot set it: it has no way to
-- execute SQL, only to call RPCs, and the only RPC that sets it is guarded.
-- ═══════════════════════════════════════════════════════════════════════════

create or replace function guard_school_billing()
returns trigger language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if auth.uid() is null then return new; end if;          -- migrations, service_role, cron
  if is_saas_admin() then return new; end if;
  -- set by a guarded RPC that has already authorisation-checked the caller
  if current_setting('skoulhub.billing_override', true) = 'on' then return new; end if;

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

create or replace function request_plan_change(p_school text, p_plan text)
returns schools
language plpgsql security definer set search_path = public, pg_temp as $$
declare v schools;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated' using errcode = '42501';
  end if;
  if not (is_saas_admin() or (auth_role() = 'school_admin' and p_school = auth_school_id())) then
    raise exception 'Only a school admin may change their own school''s plan' using errcode = '42501';
  end if;
  if not exists (select 1 from plans where id = p_plan) then
    raise exception 'Unknown plan: %', p_plan using errcode = '22023';
  end if;

  -- authorisation has been checked above; let the guard stand aside for this
  -- transaction only, and only for the plan column this function touches
  perform set_config('skoulhub.billing_override', 'on', true);

  update schools set plan_id = p_plan where id = p_school returning * into v;
  if not found then
    raise exception 'No such school: %', p_school using errcode = 'P0002';
  end if;

  perform billing_audit('billing.plan_switched', p_school, v.name,
          'changed to ' || p_plan || ' (applies from the next invoice)', 'critical');
  return v;
end $$;

grant execute on function request_plan_change(text, text) to authenticated;
