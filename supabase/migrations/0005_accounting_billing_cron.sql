-- =============================================================================
-- Asty ERP — Migration 0005: Phase 3 Accounting (DR = CR), Client Billing, Alerts & pg_cron
-- =============================================================================

-- 1. Chart of Accounts, Cost Centres, Financial Periods & Double-Entry Vouchers
CREATE TABLE public.account_groups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  name text NOT NULL,
  nature text NOT NULL CHECK (nature IN ('assets', 'liabilities', 'income', 'expenses', 'equity')),
  parent_id uuid REFERENCES public.account_groups(id),
  is_direct boolean NOT NULL DEFAULT false,
  is_system boolean NOT NULL DEFAULT true
);

CREATE TABLE public.ledger_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  name text NOT NULL,
  group_id uuid NOT NULL REFERENCES public.account_groups(id),
  gstin text,
  pan text,
  default_tds_section text,
  opening_balance_paise bigint NOT NULL DEFAULT 0,
  opening_dr_cr text NOT NULL DEFAULT 'DR' CHECK (opening_dr_cr IN ('DR', 'CR')),
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.cost_centres (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  name text NOT NULL,
  site_id uuid UNIQUE REFERENCES public.sites(id) ON DELETE RESTRICT,
  is_head_office boolean NOT NULL DEFAULT false,
  is_active boolean NOT NULL DEFAULT true
);

CREATE TABLE public.financial_periods (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  financial_year text NOT NULL,
  period_start date NOT NULL,
  period_end date NOT NULL,
  is_locked boolean NOT NULL DEFAULT false,
  locked_by uuid REFERENCES public.profiles(id),
  locked_at timestamptz
);

CREATE TABLE public.vouchers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  voucher_no text NOT NULL,
  financial_year text NOT NULL,
  voucher_type text NOT NULL CHECK (voucher_type IN (
    'payment', 'receipt', 'contra', 'journal', 'purchase', 'sales', 'debit_note', 'credit_note'
  )),
  voucher_date date NOT NULL,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'pending_posting', 'posted', 'cancelled', 'reversed')),
  source_type text,
  source_id uuid,
  narration text NOT NULL,
  total_dr_paise bigint NOT NULL DEFAULT 0,
  total_cr_paise bigint NOT NULL DEFAULT 0,
  is_rcm boolean NOT NULL DEFAULT false,
  prepared_by uuid REFERENCES public.profiles(id),
  posted_by uuid REFERENCES public.profiles(id),
  posted_at timestamptz,
  reversal_voucher_id uuid REFERENCES public.vouchers(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (financial_year, voucher_type, voucher_no)
);

CREATE TABLE public.voucher_lines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  voucher_id uuid NOT NULL REFERENCES public.vouchers(id) ON DELETE RESTRICT,
  line_no integer NOT NULL,
  ledger_account_id uuid NOT NULL REFERENCES public.ledger_accounts(id),
  cost_centre_id uuid NOT NULL REFERENCES public.cost_centres(id),
  dr_cr text NOT NULL CHECK (dr_cr IN ('DR', 'CR')),
  amount_paise bigint NOT NULL CHECK (amount_paise > 0),
  gst_rate_pct numeric(5,2),
  payment_mode text CHECK (payment_mode IN ('cash', 'cheque', 'upi', 'neft', 'rtgs')),
  instrument_ref text,
  line_note text
);

-- Strict Double-Entry Constraint Trigger (SUM(DR) = SUM(CR) & Period Lock & voucher.post permission)
CREATE OR REPLACE FUNCTION public.fn_enforce_voucher_accounting_rules()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_vch public.vouchers%ROWTYPE;
  v_dr bigint;
  v_cr bigint;
  v_locked boolean;
BEGIN
  SELECT * INTO v_vch FROM public.vouchers WHERE id = COALESCE(NEW.id, NEW.voucher_id);
  IF NOT FOUND THEN
    RETURN NULL;
  END IF;

  -- Check Locked Period unless Management unlock permission
  SELECT EXISTS (
    SELECT 1 FROM public.financial_periods fp
    WHERE v_vch.voucher_date BETWEEN fp.period_start AND fp.period_end
      AND fp.is_locked = true
  ) INTO v_locked;

  IF v_locked AND NOT public.has_permission(auth.uid(), 'period.unlock_override') THEN
    RAISE EXCEPTION 'Cannot post or modify voucher in a locked financial period';
  END IF;

  IF v_vch.status = 'posted' THEN
    IF auth.uid() IS NOT NULL AND NOT public.has_permission(auth.uid(), 'voucher.post') THEN
      RAISE EXCEPTION 'Only users with voucher.post permission can post vouchers';
    END IF;

    SELECT
      COALESCE(SUM(CASE WHEN dr_cr = 'DR' THEN amount_paise ELSE 0 END), 0),
      COALESCE(SUM(CASE WHEN dr_cr = 'CR' THEN amount_paise ELSE 0 END), 0)
    INTO v_dr, v_cr
    FROM public.voucher_lines
    WHERE voucher_id = v_vch.id;

    IF v_dr <= 0 OR v_dr <> v_cr THEN
      RAISE EXCEPTION 'Double-entry violation on voucher %: Total Debit (% paise) must equal Total Credit (% paise) and be > 0',
        v_vch.voucher_no, v_dr, v_cr;
    END IF;
  END IF;

  RETURN NULL;
END;
$$;

CREATE CONSTRAINT TRIGGER trg_enforce_voucher_balance
AFTER INSERT OR UPDATE ON public.vouchers
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW EXECUTE FUNCTION public.fn_enforce_voucher_accounting_rules();

CREATE CONSTRAINT TRIGGER trg_enforce_voucher_line_balance
AFTER INSERT OR UPDATE ON public.voucher_lines
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW EXECUTE FUNCTION public.fn_enforce_voucher_accounting_rules();

-- Prevent editing already-posted vouchers (must use reversal) and prevent hard-deleting vouchers
CREATE OR REPLACE FUNCTION public.fn_guard_posted_voucher()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF OLD.status = 'posted' AND NEW.status NOT IN ('reversed') THEN
    RAISE EXCEPTION 'Posted vouchers cannot be edited or deleted; post a reversal entry instead';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_guard_posted_voucher BEFORE UPDATE ON public.vouchers FOR EACH ROW EXECUTE FUNCTION public.fn_guard_posted_voucher();
CREATE TRIGGER trg_no_delete_vouchers BEFORE DELETE ON public.vouchers FOR EACH ROW EXECUTE FUNCTION public.fn_block_hard_delete();
CREATE TRIGGER trg_audit_vouchers AFTER INSERT OR UPDATE OR DELETE ON public.vouchers FOR EACH ROW EXECUTE FUNCTION public.fn_audit_trigger();

-- 2. Petty Cash, Bank Reco, Fixed Assets, Loans & Client Billing
CREATE TABLE public.petty_cash_wallets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id uuid NOT NULL REFERENCES public.sites(id),
  supervisor_user_id uuid NOT NULL REFERENCES public.profiles(id),
  balance_paise bigint NOT NULL DEFAULT 0
);

CREATE TABLE public.petty_cash_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  wallet_id uuid NOT NULL REFERENCES public.petty_cash_wallets(id),
  site_id uuid NOT NULL REFERENCES public.sites(id),
  entry_type text NOT NULL CHECK (entry_type IN ('issue', 'spend', 'settlement')),
  entry_date date NOT NULL DEFAULT CURRENT_DATE,
  amount_paise bigint NOT NULL CHECK (amount_paise > 0),
  purpose text NOT NULL,
  bill_photo_path text,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'pending_approval', 'approved', 'pending_posting', 'posted', 'cancelled')),
  voucher_id uuid REFERENCES public.vouchers(id),
  CHECK (entry_type <> 'settlement' OR bill_photo_path IS NOT NULL)
);

CREATE TABLE public.bank_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ledger_account_id uuid NOT NULL UNIQUE REFERENCES public.ledger_accounts(id),
  bank_name text NOT NULL,
  account_no text NOT NULL,
  ifsc text NOT NULL,
  upi_id text,
  is_active boolean NOT NULL DEFAULT true
);

CREATE TABLE public.bank_statement_lines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bank_account_id uuid NOT NULL REFERENCES public.bank_accounts(id),
  value_date date NOT NULL,
  description text NOT NULL,
  utr_ref text,
  withdrawal_paise bigint NOT NULL DEFAULT 0,
  deposit_paise bigint NOT NULL DEFAULT 0,
  matched_voucher_line_id uuid REFERENCES public.voucher_lines(id),
  reconciled_at timestamptz
);

CREATE TABLE public.fixed_assets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  asset_code text NOT NULL UNIQUE,
  name text NOT NULL,
  category text NOT NULL,
  wdv_rate_pct numeric(5,2) NOT NULL DEFAULT 40.00,
  purchase_date date NOT NULL,
  cost_paise bigint NOT NULL,
  opening_wdv_paise bigint NOT NULL,
  status text NOT NULL DEFAULT 'active'
);

CREATE TABLE public.loans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  loan_no text NOT NULL UNIQUE,
  lender text NOT NULL,
  ledger_account_id uuid NOT NULL REFERENCES public.ledger_accounts(id),
  principal_paise bigint NOT NULL,
  annual_interest_pct numeric(5,2) NOT NULL,
  tenure_months integer NOT NULL,
  first_emi_date date NOT NULL
);

CREATE TABLE public.extra_work_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ewo_no text NOT NULL UNIQUE,
  site_id uuid NOT NULL REFERENCES public.sites(id),
  description text NOT NULL,
  estimate_paise bigint NOT NULL,
  client_approval_method text NOT NULL CHECK (client_approval_method IN ('upload', 'otp')),
  client_proof_path text,
  client_approved_at timestamptz,
  approval_request_id uuid REFERENCES public.approval_requests(id),
  status text NOT NULL DEFAULT 'pending_client' CHECK (status IN ('pending_client', 'approved', 'billed', 'cancelled'))
);

CREATE TABLE public.client_bills (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_no text NOT NULL UNIQUE,
  financial_year text NOT NULL,
  site_id uuid NOT NULL REFERENCES public.sites(id),
  client_id uuid NOT NULL REFERENCES public.clients(id),
  bill_type text NOT NULL CHECK (bill_type IN ('ra_bill', 'final_bill', 'labour_bill', 'extra_work_bill', 'pmc_fee_bill')),
  ra_bill_seq integer,
  invoice_date date NOT NULL DEFAULT CURRENT_DATE,
  due_date date NOT NULL,
  hsn_sac_code text NOT NULL DEFAULT '9954',
  cumulative_work_paise bigint NOT NULL DEFAULT 0,
  prev_certified_paise bigint NOT NULL DEFAULT 0,
  this_bill_gross_paise bigint NOT NULL DEFAULT 0,
  retention_held_paise bigint NOT NULL DEFAULT 0,
  advance_recovery_paise bigint NOT NULL DEFAULT 0,
  taxable_paise bigint NOT NULL DEFAULT 0,
  cgst_paise bigint NOT NULL DEFAULT 0,
  sgst_paise bigint NOT NULL DEFAULT 0,
  igst_paise bigint NOT NULL DEFAULT 0,
  total_invoice_paise bigint NOT NULL DEFAULT 0,
  received_paise bigint NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'ops_checked', 'pending_mgmt_approval', 'approved', 'posted', 'part_paid', 'paid', 'cancelled')),
  approval_request_id uuid REFERENCES public.approval_requests(id),
  voucher_id uuid REFERENCES public.vouchers(id),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TRIGGER trg_no_delete_client_bills BEFORE DELETE ON public.client_bills FOR EACH ROW EXECUTE FUNCTION public.fn_block_hard_delete();
CREATE TRIGGER trg_audit_client_bills AFTER INSERT OR UPDATE OR DELETE ON public.client_bills FOR EACH ROW EXECUTE FUNCTION public.fn_audit_trigger();

-- 3. Position-Addressed Notifications
CREATE TABLE public.notification_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_code text NOT NULL UNIQUE,
  description text NOT NULL,
  recipient_position_ids uuid[] NOT NULL DEFAULT '{}',
  channels text[] NOT NULL DEFAULT ARRAY['in_app', 'web_push'],
  is_active boolean NOT NULL DEFAULT true
);

CREATE TABLE public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id),
  position_id uuid REFERENCES public.positions(id),
  site_id uuid REFERENCES public.sites(id),
  event_code text NOT NULL,
  title_key text NOT NULL,
  body_key text NOT NULL,
  params jsonb NOT NULL DEFAULT '{}'::jsonb,
  priority text NOT NULL DEFAULT 'normal' CHECK (priority IN ('normal', 'high', 'urgent')),
  is_read boolean NOT NULL DEFAULT false,
  read_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Instant Urgent DPR Issue Alert Trigger (addressed to positions via notification_rules)
CREATE OR REPLACE FUNCTION public.fn_notify_urgent_issue()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_rule public.notification_rules%ROWTYPE;
BEGIN
  IF NEW.is_urgent = true THEN
    SELECT * INTO v_rule FROM public.notification_rules WHERE event_code = 'dpr.urgent_issue' AND is_active = true;
    IF FOUND THEN
      INSERT INTO public.notifications (user_id, position_id, site_id, event_code, title_key, body_key, params, priority)
      SELECT DISTINCT up.user_id, up.position_id, NEW.site_id, 'dpr.urgent_issue',
             'alerts.urgent_issue_title', 'alerts.urgent_issue_body',
             jsonb_build_object('description', NEW.description), 'urgent'
      FROM public.user_positions up
      WHERE up.position_id = ANY(v_rule.recipient_position_ids)
        AND up.is_active = true
        AND public.can_access_site(up.user_id, NEW.site_id);
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_notify_urgent_issue
AFTER INSERT ON public.daily_issues
FOR EACH ROW EXECUTE FUNCTION public.fn_notify_urgent_issue();

-- Enable RLS on Phase 3 & Alert Tables
ALTER TABLE public.account_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ledger_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cost_centres ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.financial_periods ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vouchers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.voucher_lines ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.petty_cash_wallets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.petty_cash_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bank_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bank_statement_lines ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fixed_assets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.loans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.extra_work_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.client_bills ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notification_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY p3_coa_select ON public.account_groups FOR SELECT TO authenticated USING (public.has_permission(auth.uid(), 'voucher.view'));
CREATE POLICY p3_ledgers_select ON public.ledger_accounts FOR SELECT TO authenticated USING (public.has_permission(auth.uid(), 'voucher.view'));
CREATE POLICY p3_cc_select ON public.cost_centres FOR SELECT TO authenticated USING (public.has_permission(auth.uid(), 'voucher.view'));
CREATE POLICY p3_fp_select ON public.financial_periods FOR SELECT TO authenticated USING (public.has_permission(auth.uid(), 'voucher.view'));
CREATE POLICY p3_vouchers_select ON public.vouchers FOR SELECT TO authenticated USING (public.has_permission(auth.uid(), 'voucher.view'));
CREATE POLICY p3_vouchers_draft ON public.vouchers FOR INSERT TO authenticated WITH CHECK (public.has_permission(auth.uid(), 'voucher.draft'));
CREATE POLICY p3_voucher_lines_select ON public.voucher_lines FOR SELECT TO authenticated USING (public.has_permission(auth.uid(), 'voucher.view'));
CREATE POLICY p3_petty_select ON public.petty_cash_wallets FOR SELECT TO authenticated USING (public.can_access_site(auth.uid(), site_id));
CREATE POLICY p3_petty_entries_select ON public.petty_cash_entries FOR SELECT TO authenticated USING (public.can_access_site(auth.uid(), site_id));
CREATE POLICY p3_banks_select ON public.bank_accounts FOR SELECT TO authenticated USING (public.has_permission(auth.uid(), 'voucher.view'));
CREATE POLICY p3_bank_lines_select ON public.bank_statement_lines FOR SELECT TO authenticated USING (public.has_permission(auth.uid(), 'voucher.view'));
CREATE POLICY p3_assets_select ON public.fixed_assets FOR SELECT TO authenticated USING (public.has_permission(auth.uid(), 'voucher.view'));
CREATE POLICY p3_loans_select ON public.loans FOR SELECT TO authenticated USING (public.has_permission(auth.uid(), 'voucher.view'));
CREATE POLICY p3_ewo_select ON public.extra_work_requests FOR SELECT TO authenticated USING (public.can_access_site(auth.uid(), site_id));
CREATE POLICY p3_client_bills_select ON public.client_bills FOR SELECT TO authenticated
  USING ((public.has_permission(auth.uid(), 'client_bill.view') OR public.has_permission(auth.uid(), 'client_portal.view'))
         AND public.can_access_site(auth.uid(), site_id));
CREATE POLICY notif_rules_select ON public.notification_rules FOR SELECT TO authenticated USING (true);
CREATE POLICY notif_own_select ON public.notifications FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY notif_own_update ON public.notifications FOR UPDATE TO authenticated USING (user_id = auth.uid());

-- Optional pg_cron Registrations (guarded in DO block so local environments without pg_cron succeed cleanly)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_available_extensions WHERE name = 'pg_cron') THEN
    CREATE EXTENSION IF NOT EXISTS pg_cron;
    PERFORM cron.schedule('asty-escalate-approvals', '0 * * * *', 'SELECT public.escalate_stale_approvals();');
  END IF;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'pg_cron registration skipped in non-superuser context';
END;
$$;

