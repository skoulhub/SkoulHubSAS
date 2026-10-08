-- ═══════════════════════════════════════════════════════════════════════════
-- Subscription lifecycle, moved out of the browser.
--
-- The SPA used to derive trials, grace and suspension from Date.now(). That
-- meant a client with a wrong clock — or simply the wrong build — decided
-- whether a school had paid. The rules now live here and run from one place,
-- whether they are invoked by cron, a payment webhook, or the operator.
--
--   trial ──(trial_ends_at)──▶ grace ──(+7 days)──▶ suspended
--   active ─(period_end)─────▶ grace ──(+7 days)──▶ suspended
-- ═══════════════════════════════════════════════════════════════════════════

-- ── Price list as data, so a price change is not a deploy ─────────────────
create table if not exists plans (
  id          text primary key,
  name        text not null,
  tagline     text,
  rate        numeric(12,2) not null check (rate >= 0),   -- UGX per student per term
  term_days   int  not null default 90,
  badge       text,
  sort        int  not null default 0
);
alter table plans enable row level security;
drop policy if exists plans_read on plans;
create policy plans_read on plans for select to authenticated, anon using (true);
grant select on plans to authenticated, anon;

insert into plans (id, name, tagline, rate, term_days, badge, sort) values
  ('basic',    'Basic',    'Perfect for small schools',        10000, 90, null,           1),
  ('standard', 'Standard', 'For growing secondary schools',    15000, 90, 'Most Popular', 2),
  ('premium',  'Premium',  'For large multi-campus schools',   20000, 90, 'Full Suite',   3)
on conflict (id) do update set rate = excluded.rate, term_days = excluded.term_days;

-- Schools now reference the catalogue (loose FK so a custom plan never blocks)
alter table schools drop constraint if exists schools_plan_fk;
alter table schools add constraint schools_plan_fk foreign key (plan_id) references plans(id);

create sequence if not exists invoice_seq start 1;

-- ── Helpers ────────────────────────────────────────────────────────────────
create or replace function plan_rate(p_plan text)
returns numeric language sql stable security definer set search_path = public, pg_temp as $$
  select coalesce((select rate from plans where id = p_plan), 0);
$$;

create or replace function plan_term_days(p_plan text)
returns int language sql stable security definer set search_path = public, pg_temp as $$
  select coalesce((select term_days from plans where id = p_plan), 90);
$$;

create or replace function next_invoice_id()
returns text language sql volatile as $$
  select 'INV-' || lpad(nextval('invoice_seq')::text, 5, '0');
$$;

-- Internal: write to the append-only trail as the system, not as a user.
create or replace function billing_audit(
  p_action text, p_school text, p_target text, p_detail text, p_severity audit_severity
) returns void language sql security definer set search_path = public, pg_temp as $$
  insert into audit_log (actor, role, school_id, action, target, detail, severity)
  values ('system', null, p_school, p_action, p_target, p_detail, p_severity);
$$;

-- ═══════════════════════════════════════════════════════════════════════════
-- 1. Reconcile every tenant's status against the clock
-- ═══════════════════════════════════════════════════════════════════════════
create or replace function evaluate_subscriptions(p_now timestamptz default now())
returns table (school text, from_status tenant_status, to_status tenant_status, reason text)
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  r record;
  grace constant interval := interval '7 days';   -- GRACE_DAYS in src/lib/plans.js
  deadline timestamptz;
begin
  for r in select * from schools where status in ('trial','active','grace','expired') loop
    -- Whichever deadline applies. A trial that has moved into grace no longer
    -- has status 'trial', so keying off the status alone left it in grace for
    -- ever — the suspension that auto-revocation depends on never fired.
    deadline := coalesce(r.current_period_end, r.trial_ends_at);

    if deadline is null then
      continue;                                   -- nothing to enforce yet
    end if;

    if p_now > deadline + grace then
      if r.status is distinct from 'suspended' then
        update schools set status = 'suspended', suspended_at = p_now,
               suspend_reason = case when r.status = 'trial'
                                     then 'Trial ended and no payment received'
                                     else 'Unpaid after the grace period' end
         where id = r.id;
        perform billing_audit('tenant.suspended', r.id, r.name,
                'auto-revoked: ' || r.status || ' deadline ' || deadline::date, 'critical');
        school := r.id; from_status := r.status; to_status := 'suspended'; reason := 'grace_expired';
        return next;
      end if;
    elsif p_now > deadline then
      if r.status in ('trial','active') then
        update schools set status = 'grace' where id = r.id;
        perform billing_audit('tenant.grace_started', r.id, r.name,
                'deadline ' || deadline::date || ', suspension on ' || (deadline + grace)::date, 'notice');
        school := r.id; from_status := r.status; to_status := 'grace'; reason := 'deadline_passed';
        return next;
      end if;
    end if;
  end loop;
end $$;

-- ═══════════════════════════════════════════════════════════════════════════
-- 2. Raise an invoice for every tenant whose paid term has ended
-- ═══════════════════════════════════════════════════════════════════════════
create or replace function raise_due_invoices(p_now timestamptz default now())
returns int
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  r record;
  v_amount numeric(14,2);
  v_created int := 0;
  v_period_end timestamptz;
begin
  for r in
    select s.* from schools s
    where s.status in ('active','trial','grace')
      and coalesce(s.current_period_end, s.trial_ends_at) is not null
      and coalesce(s.current_period_end, s.trial_ends_at) <= p_now
      -- no invoice already waiting for this period
      and not exists (
        select 1 from invoices i
        where i.school_id = s.id and i.status in ('pending','overdue','paid')
          and i.due_at >= coalesce(s.current_period_end, s.trial_ends_at)
      )
  loop
    v_amount := r.student_count * plan_rate(r.plan_id);
    v_period_end := coalesce(r.current_period_end, r.trial_ends_at);

    insert into invoices (id, school_id, plan_id, students, rate, amount,
                          issued_at, due_at, status)
    values (next_invoice_id(), r.id, r.plan_id, r.student_count,
            plan_rate(r.plan_id), v_amount,
            p_now, v_period_end + interval '7 days', 'pending');

    perform billing_audit('billing.invoice_raised', r.id, r.name,
            v_amount || ' UGX — ' || r.student_count || ' students on ' || r.plan_id, 'critical');
    v_created := v_created + 1;
  end loop;
  return v_created;
end $$;

-- One entry point for the scheduler.
create or replace function run_billing_cycle(p_now timestamptz default now())
returns text language plpgsql security definer set search_path = public, pg_temp as $$
declare v_invoices int;
begin
  perform evaluate_subscriptions(p_now);
  v_invoices := raise_due_invoices(p_now);
  return 'reconciled; ' || v_invoices || ' invoice(s) raised';
end $$;

-- ═══════════════════════════════════════════════════════════════════════════
-- 3. Settling an invoice — the operation a payment webhook will call
-- ═══════════════════════════════════════════════════════════════════════════
create or replace function mark_invoice_paid(
  p_invoice text, p_method text default null, p_reference text default null
) returns invoices
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_inv invoices;
  v_term int;
begin
  -- operator or trusted server context only
  if auth.uid() is not null and not is_saas_admin() then
    raise exception 'Only the platform operator may settle an invoice' using errcode = '42501';
  end if;

  select * into v_inv from invoices where id = p_invoice for update;
  if not found then
    raise exception 'No such invoice: %', p_invoice using errcode = 'P0002';
  end if;
  if v_inv.status = 'paid' then
    return v_inv;                                  -- idempotent: a webhook may retry
  end if;

  v_term := plan_term_days(v_inv.plan_id);

  update invoices
     set status = 'paid', paid_at = now(), method = p_method, reference = p_reference
   where id = p_invoice
  returning * into v_inv;

  -- paying clears the trial, restores access and opens a fresh term
  update schools
     set status = 'active',
         trial_ends_at = null,
         suspended_at = null,
         suspend_reason = null,
         current_period_start = now(),
         current_period_end = now() + make_interval(days => v_term)
   where id = v_inv.school_id;

  perform billing_audit('billing.invoice_paid', v_inv.school_id, v_inv.id,
          v_inv.amount || ' UGX via ' || coalesce(p_method, 'unspecified') ||
          ' — access restored for ' || v_term || ' days', 'critical');

  return v_inv;
end $$;

-- ═══════════════════════════════════════════════════════════════════════════
-- 4. Operator actions
-- ═══════════════════════════════════════════════════════════════════════════
create or replace function assign_plan(p_school text, p_plan text, p_immediate boolean default true)
returns schools
language plpgsql security definer set search_path = public, pg_temp as $$
declare v schools;
begin
  if auth.uid() is not null and not is_saas_admin() then
    raise exception 'Only the platform operator may assign a plan' using errcode = '42501';
  end if;
  if not exists (select 1 from plans where id = p_plan) then
    raise exception 'Unknown plan: %', p_plan using errcode = '22023';
  end if;

  update schools
     set plan_id = p_plan,
         current_period_start = case when p_immediate then now() else current_period_start end,
         current_period_end   = case when p_immediate then now() + make_interval(days => plan_term_days(p_plan))
                                     else current_period_end end
   where id = p_school
  returning * into v;

  if not found then raise exception 'No such school: %', p_school using errcode = 'P0002'; end if;

  perform billing_audit('billing.plan_assigned', p_school, v.name,
          p_plan || case when p_immediate then ' (immediate)' else ' (from next term)' end, 'critical');
  return v;
end $$;

create or replace function start_trial(p_school text, p_days int default 30)
returns schools
language plpgsql security definer set search_path = public, pg_temp as $$
declare v schools;
begin
  if auth.uid() is not null and not is_saas_admin() then
    raise exception 'Only the platform operator may start a trial' using errcode = '42501';
  end if;

  update schools
     set status = 'trial',
         trial_ends_at = now() + make_interval(days => p_days),
         suspended_at = null, suspend_reason = null
   where id = p_school
  returning * into v;

  if not found then raise exception 'No such school: %', p_school using errcode = 'P0002'; end if;

  perform billing_audit('billing.trial_started', p_school, v.name, p_days || '-day trial', 'notice');
  return v;
end $$;

create or replace function set_tenant_status(p_school text, p_status tenant_status, p_reason text default null)
returns schools
language plpgsql security definer set search_path = public, pg_temp as $$
declare v schools;
begin
  if auth.uid() is not null and not is_saas_admin() then
    raise exception 'Only the platform operator may change tenant status' using errcode = '42501';
  end if;

  update schools
     set status = p_status,
         suspended_at = case when p_status = 'suspended' then now() else null end,
         suspend_reason = case when p_status = 'suspended' then coalesce(p_reason, 'Suspended by operator') else null end
   where id = p_school
  returning * into v;

  if not found then raise exception 'No such school: %', p_school using errcode = 'P0002'; end if;

  perform billing_audit(
    case when p_status = 'suspended' then 'tenant.suspended' else 'tenant.reactivated' end,
    p_school, v.name, coalesce(p_reason, p_status::text), 'critical');
  return v;
end $$;

grant execute on function mark_invoice_paid(text, text, text) to authenticated;
grant execute on function assign_plan(text, text, boolean)   to authenticated;
grant execute on function start_trial(text, int)             to authenticated;
grant execute on function set_tenant_status(text, tenant_status, text) to authenticated;
grant execute on function run_billing_cycle(timestamptz)     to service_role;
