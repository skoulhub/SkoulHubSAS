-- ═══════════════════════════════════════════════════════════════════════════
-- Self-service plan change.
--
-- The billing guard trigger deliberately blocks direct updates to subscription
-- columns by anyone but the operator, which left the tenant-facing "switch
-- plan" screen with nowhere to go: it changed the UI and nothing else. This
-- RPC is the sanctioned path — a school admin may re-plan their own school,
-- and the action is recorded either way.
-- ═══════════════════════════════════════════════════════════════════════════
create or replace function request_plan_change(p_school text, p_plan text)
returns schools
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v schools;
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

  update schools set plan_id = p_plan where id = p_school returning * into v;
  if not found then
    raise exception 'No such school: %', p_school using errcode = 'P0002';
  end if;

  -- the current term is untouched; the new rate applies from the next invoice
  perform billing_audit('billing.plan_switched', p_school, v.name,
          'changed to ' || p_plan || ' (applies from the next invoice)', 'critical');
  return v;
end $$;

grant execute on function request_plan_change(text, text) to authenticated;
