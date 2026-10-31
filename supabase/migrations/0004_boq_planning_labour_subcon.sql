-- =============================================================================
-- Asty ERP — Migration 0004: Phase 2 (BOQ, Quotations, Planning, Transfers, Labour, Subcontractors)
-- =============================================================================

-- 1. BOQ & Quotations
CREATE TABLE public.master_rate_sheets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  project_type text NOT NULL CHECK (project_type IN ('residential', 'commercial')),
  default_concrete_grade text NOT NULL DEFAULT 'M25',
  floor_height_m numeric(4,2) NOT NULL DEFAULT 3.20,
  wastage_pct numeric(5,2) NOT NULL DEFAULT 3.00,
  profit_pct numeric(5,2) NOT NULL DEFAULT 15.00,
  rates_json jsonb NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.boq_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id uuid NOT NULL REFERENCES public.sites(id) ON DELETE RESTRICT,
  version_no integer NOT NULL,
  project_type text NOT NULL CHECK (project_type IN ('residential', 'commercial')),
  built_up_area_sqft numeric(12,2) NOT NULL DEFAULT 0,
  wastage_pct numeric(5,2) NOT NULL DEFAULT 3.00,
  profit_pct numeric(5,2) NOT NULL DEFAULT 15.00,
  rates_snapshot jsonb NOT NULL DEFAULT '{}'::jsonb,
  total_cost_paise bigint NOT NULL DEFAULT 0,
  quoted_total_paise bigint NOT NULL DEFAULT 0,
  rounded_total_paise bigint NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'approved_locked', 'superseded')),
  is_locked boolean NOT NULL DEFAULT false,
  approved_by uuid REFERENCES public.profiles(id),
  approved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (site_id, version_no)
);

CREATE OR REPLACE FUNCTION public.fn_guard_locked_boq()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF OLD.is_locked = true AND (NEW.rates_snapshot IS DISTINCT FROM OLD.rates_snapshot OR NEW.total_cost_paise IS DISTINCT FROM OLD.total_cost_paise) THEN
    RAISE EXCEPTION 'Approved BOQ version is locked. Create a new BOQ version instead.';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_guard_locked_boq BEFORE UPDATE ON public.boq_versions FOR EACH ROW EXECUTE FUNCTION public.fn_guard_locked_boq();

CREATE TABLE public.boq_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  boq_version_id uuid NOT NULL REFERENCES public.boq_versions(id) ON DELETE CASCADE,
  sort_order integer NOT NULL DEFAULT 1,
  stage_name text NOT NULL,
  work_type text NOT NULL,
  concrete_grade text DEFAULT 'M25',
  concrete_m3 numeric(12,3) NOT NULL DEFAULT 0,
  formwork_m2 numeric(12,3) NOT NULL DEFAULT 0,
  steel_kg numeric(12,3) NOT NULL DEFAULT 0,
  staging_m2 numeric(12,3) NOT NULL DEFAULT 0,
  masonry_qty numeric(12,3) NOT NULL DEFAULT 0,
  pour_days numeric(8,2) NOT NULL DEFAULT 1,
  material_cost_paise bigint NOT NULL DEFAULT 0,
  labour_cost_paise bigint NOT NULL DEFAULT 0,
  formwork_cost_paise bigint NOT NULL DEFAULT 0,
  rent_cost_paise bigint NOT NULL DEFAULT 0,
  steel_cost_paise bigint NOT NULL DEFAULT 0,
  total_cost_paise bigint NOT NULL DEFAULT 0,
  quoted_rate_paise bigint NOT NULL DEFAULT 0,
  quoted_amount_paise bigint NOT NULL DEFAULT 0
);

CREATE TABLE public.quotations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  quotation_no text NOT NULL UNIQUE,
  site_id uuid NOT NULL REFERENCES public.sites(id),
  boq_version_id uuid NOT NULL REFERENCES public.boq_versions(id),
  print_style text NOT NULL CHECK (print_style IN ('commercial_11_col', 'residential_boq', 'residential_sqft')),
  terms_and_conditions text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- 2. Site Planning, Gantt, Look-Ahead & Transfers
CREATE TABLE public.crews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  crew_type text NOT NULL CHECK (crew_type IN ('own_concrete', 'own_brick')),
  is_active boolean NOT NULL DEFAULT true
);

CREATE TABLE public.subcontractors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  name text NOT NULL,
  trade text NOT NULL,
  phone text,
  pan text,
  gstin text,
  tds_section text NOT NULL DEFAULT '194C',
  tds_rate_pct numeric(5,2) NOT NULL DEFAULT 1.00,
  bank_details jsonb NOT NULL DEFAULT '{}'::jsonb,
  ledger_account_id uuid,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.site_plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id uuid NOT NULL REFERENCES public.sites(id) ON DELETE RESTRICT,
  boq_version_id uuid REFERENCES public.boq_versions(id),
  version_no integer NOT NULL DEFAULT 1,
  is_baseline boolean NOT NULL DEFAULT false,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'pending_approval', 'active', 'superseded')),
  change_reason text,
  approval_request_id uuid REFERENCES public.approval_requests(id),
  approved_by uuid REFERENCES public.profiles(id),
  approved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.plan_activities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  site_plan_id uuid NOT NULL REFERENCES public.site_plans(id) ON DELETE CASCADE,
  site_id uuid NOT NULL REFERENCES public.sites(id) ON DELETE RESTRICT,
  boq_item_id uuid REFERENCES public.boq_items(id),
  code text NOT NULL,
  name text NOT NULL,
  quantity numeric(14,3) NOT NULL DEFAULT 1,
  unit text NOT NULL DEFAULT 'm3',
  daily_output_norm numeric(12,3) NOT NULL DEFAULT 1,
  duration_days integer NOT NULL DEFAULT 1 CHECK (duration_days >= 1),
  baseline_start date,
  baseline_end date,
  planned_start date NOT NULL,
  planned_end date NOT NULL,
  completed_qty numeric(14,3) NOT NULL DEFAULT 0,
  progress_pct numeric(5,2) NOT NULL DEFAULT 0,
  crew_type text NOT NULL CHECK (crew_type IN ('own_concrete', 'own_brick', 'subcontractor')),
  crew_id uuid REFERENCES public.crews(id),
  subcontractor_id uuid REFERENCES public.subcontractors(id),
  status text NOT NULL DEFAULT 'not_started' CHECK (status IN ('not_started', 'in_progress', 'completed', 'delayed', 'quality_checked'))
);

CREATE TABLE public.plan_dependencies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  site_plan_id uuid NOT NULL REFERENCES public.site_plans(id) ON DELETE CASCADE,
  predecessor_id uuid NOT NULL REFERENCES public.plan_activities(id) ON DELETE CASCADE,
  successor_id uuid NOT NULL REFERENCES public.plan_activities(id) ON DELETE CASCADE,
  dep_type text NOT NULL DEFAULT 'FS',
  lag_days integer NOT NULL DEFAULT 0
);

CREATE TABLE public.activity_material_schedules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_activity_id uuid NOT NULL REFERENCES public.plan_activities(id) ON DELETE CASCADE,
  site_id uuid NOT NULL REFERENCES public.sites(id),
  item_id uuid NOT NULL REFERENCES public.items(id),
  required_qty numeric(14,3) NOT NULL,
  needed_on_site_by date NOT NULL,
  purchase_order_id uuid REFERENCES public.purchase_orders(id)
);

CREATE TABLE public.activity_drawing_schedules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_activity_id uuid NOT NULL REFERENCES public.plan_activities(id) ON DELETE CASCADE,
  site_id uuid NOT NULL REFERENCES public.sites(id),
  drawing_name text NOT NULL,
  owed_by_consultant text NOT NULL,
  consultant_phone text,
  due_date date NOT NULL,
  received_date date,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'received', 'overdue'))
);

CREATE TABLE public.stock_transfers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  transfer_no text NOT NULL UNIQUE,
  from_site_id uuid NOT NULL REFERENCES public.sites(id),
  to_site_id uuid NOT NULL REFERENCES public.sites(id),
  item_id uuid NOT NULL REFERENCES public.items(id),
  qty numeric(14,3) NOT NULL CHECK (qty > 0),
  approved_by_coordinator uuid REFERENCES public.profiles(id),
  received_by_supervisor uuid REFERENCES public.profiles(id),
  status text NOT NULL DEFAULT 'pending_coordinator' CHECK (status IN ('pending_coordinator', 'in_transit', 'received', 'cancelled')),
  created_at timestamptz NOT NULL DEFAULT now()
);

-- 3. Own Workers, Attendance & Weekly Wages
CREATE TABLE public.workers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  worker_code text NOT NULL UNIQUE,
  full_name text NOT NULL,
  phone text,
  trade text NOT NULL CHECK (trade IN ('concrete_worker', 'brick_worker', 'mason', 'helper', 'carpenter', 'bar_bender')),
  crew_id uuid REFERENCES public.crews(id),
  daily_wage_paise bigint NOT NULL CHECK (daily_wage_paise > 0),
  joining_date date NOT NULL DEFAULT CURRENT_DATE,
  advance_balance_paise bigint NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true
);

CREATE TABLE public.worker_attendance (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  worker_id uuid NOT NULL REFERENCES public.workers(id),
  site_id uuid NOT NULL REFERENCES public.sites(id),
  attendance_date date NOT NULL,
  daily_report_id uuid REFERENCES public.daily_reports(id),
  attendance_status text NOT NULL CHECK (attendance_status IN ('present', 'half_day', 'absent')),
  earned_paise bigint NOT NULL DEFAULT 0,
  UNIQUE (worker_id, attendance_date, site_id)
);

CREATE TABLE public.wage_sheets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  wage_sheet_no text NOT NULL UNIQUE,
  site_id uuid NOT NULL REFERENCES public.sites(id),
  week_start date NOT NULL,
  week_end date NOT NULL,
  gross_paise bigint NOT NULL DEFAULT 0,
  advance_recovery_paise bigint NOT NULL DEFAULT 0,
  net_payable_paise bigint NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'approved', 'pending_posting', 'posted', 'paid', 'cancelled')),
  voucher_id uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- 4. Subcontractor Work Orders & Measured Bills
CREATE TABLE public.work_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  wo_no text NOT NULL UNIQUE,
  site_id uuid NOT NULL REFERENCES public.sites(id),
  subcontractor_id uuid NOT NULL REFERENCES public.subcontractors(id),
  scope text NOT NULL,
  start_date date NOT NULL,
  end_date date NOT NULL,
  retention_pct numeric(5,2) NOT NULL DEFAULT 5.00,
  total_paise bigint NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('draft', 'approved', 'active', 'closed', 'cancelled'))
);

CREATE TABLE public.subcontractor_bills (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bill_no text NOT NULL UNIQUE,
  work_order_id uuid NOT NULL REFERENCES public.work_orders(id),
  site_id uuid NOT NULL REFERENCES public.sites(id),
  subcontractor_id uuid NOT NULL REFERENCES public.subcontractors(id),
  bill_date date NOT NULL DEFAULT CURRENT_DATE,
  measured_qty numeric(14,3) NOT NULL DEFAULT 0,
  gross_paise bigint NOT NULL,
  gst_paise bigint NOT NULL DEFAULT 0,
  retention_paise bigint NOT NULL DEFAULT 0,
  tds_194c_paise bigint NOT NULL DEFAULT 0,
  net_payable_paise bigint NOT NULL,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'pending_approval', 'approved', 'pending_posting', 'posted', 'paid', 'cancelled')),
  approval_request_id uuid REFERENCES public.approval_requests(id),
  voucher_id uuid
);

-- Enable RLS across all Phase 2 tables
ALTER TABLE public.master_rate_sheets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.boq_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.boq_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quotations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crews ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subcontractors ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.site_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.plan_activities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.plan_dependencies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.activity_material_schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.activity_drawing_schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stock_transfers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.worker_attendance ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wage_sheets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.work_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subcontractor_bills ENABLE ROW LEVEL SECURITY;

CREATE POLICY p2_master_rates_select ON public.master_rate_sheets FOR SELECT TO authenticated USING (public.has_permission(auth.uid(), 'boq.view'));
CREATE POLICY p2_boq_select ON public.boq_versions FOR SELECT TO authenticated USING (public.has_permission(auth.uid(), 'boq.view') AND public.can_access_site(auth.uid(), site_id));
CREATE POLICY p2_boq_items_select ON public.boq_items FOR SELECT TO authenticated USING (public.has_permission(auth.uid(), 'boq.view'));
CREATE POLICY p2_quotations_select ON public.quotations FOR SELECT TO authenticated USING (public.has_permission(auth.uid(), 'boq.view') AND public.can_access_site(auth.uid(), site_id));
CREATE POLICY p2_crews_select ON public.crews FOR SELECT TO authenticated USING (true);
CREATE POLICY p2_subcon_select ON public.subcontractors FOR SELECT TO authenticated USING (public.has_permission(auth.uid(), 'subcon.view'));
CREATE POLICY p2_plans_select ON public.site_plans FOR SELECT TO authenticated USING (public.can_access_site(auth.uid(), site_id));
CREATE POLICY p2_activities_select ON public.plan_activities FOR SELECT TO authenticated USING (public.can_access_site(auth.uid(), site_id));
CREATE POLICY p2_deps_select ON public.plan_dependencies FOR SELECT TO authenticated USING (true);
CREATE POLICY p2_mat_sched_select ON public.activity_material_schedules FOR SELECT TO authenticated USING (public.can_access_site(auth.uid(), site_id));
CREATE POLICY p2_drw_sched_select ON public.activity_drawing_schedules FOR SELECT TO authenticated USING (public.can_access_site(auth.uid(), site_id));
CREATE POLICY p2_transfers_select ON public.stock_transfers FOR SELECT TO authenticated USING (public.can_access_site(auth.uid(), from_site_id) OR public.can_access_site(auth.uid(), to_site_id));
CREATE POLICY p2_workers_select ON public.workers FOR SELECT TO authenticated USING (public.has_permission(auth.uid(), 'labour.view') OR public.has_permission(auth.uid(), 'dpr.create'));
CREATE POLICY p2_attendance_select ON public.worker_attendance FOR SELECT TO authenticated USING (public.can_access_site(auth.uid(), site_id));
CREATE POLICY p2_wages_select ON public.wage_sheets FOR SELECT TO authenticated USING (public.has_permission(auth.uid(), 'labour.view') AND public.can_access_site(auth.uid(), site_id));
CREATE POLICY p2_wo_select ON public.work_orders FOR SELECT TO authenticated USING (public.has_permission(auth.uid(), 'subcon.view') AND public.can_access_site(auth.uid(), site_id));
CREATE POLICY p2_sbills_select ON public.subcontractor_bills FOR SELECT TO authenticated USING (public.has_permission(auth.uid(), 'subcon.view') AND public.can_access_site(auth.uid(), site_id));

