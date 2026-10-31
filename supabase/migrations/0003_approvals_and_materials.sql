-- =============================================================================
-- Asty ERP — Migration 0003: Configurable Approvals Engine, Anti-Splitting & Materials
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Items & Vendors
-- -----------------------------------------------------------------------------
CREATE TABLE public.items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  name text NOT NULL,
  name_ml text,
  category text NOT NULL CHECK (category IN ('cement', 'sand', 'aggregate', 'steel', 'rmc', 'masonry', 'timber', 'plumbing', 'electrical', 'consumable', 'other')),
  unit text NOT NULL,
  hsn_code text,
  gst_rate_pct numeric(5,2) NOT NULL DEFAULT 18.00,
  default_wastage_pct numeric(5,2) NOT NULL DEFAULT 3.00,
  reference_rate_paise bigint NOT NULL DEFAULT 0 CHECK (reference_rate_paise >= 0),
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.vendors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  name text NOT NULL,
  contact_name text,
  phone text,
  email text,
  gstin text,
  pan text,
  address text,
  bank_details jsonb NOT NULL DEFAULT '{}'::jsonb,
  ledger_account_id uuid,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.vendor_item_rates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_id uuid NOT NULL REFERENCES public.vendors(id) ON DELETE CASCADE,
  item_id uuid NOT NULL REFERENCES public.items(id) ON DELETE CASCADE,
  rate_paise bigint NOT NULL CHECK (rate_paise >= 0),
  effective_date date NOT NULL DEFAULT CURRENT_DATE,
  UNIQUE (vendor_id, item_id, effective_date)
);

-- -----------------------------------------------------------------------------
-- 2. Configurable Approvals Engine + 7-Day Anti-Splitting
-- -----------------------------------------------------------------------------
CREATE TABLE public.approval_chains (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  request_type text NOT NULL UNIQUE CHECK (request_type IN (
    'material_request', 'purchase_order', 'petty_cash', 'subcontractor_bill',
    'task_completion', 'extra_work', 'plan_change', 'client_bill'
  )),
  name text NOT NULL,
  anti_split_enabled boolean NOT NULL DEFAULT true,
  anti_split_window_days integer NOT NULL DEFAULT 7,
  escalation_hours integer NOT NULL DEFAULT 24,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.approval_chain_steps (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  chain_id uuid NOT NULL REFERENCES public.approval_chains(id) ON DELETE CASCADE,
  step_order integer NOT NULL,
  position_id uuid NOT NULL REFERENCES public.positions(id) ON DELETE RESTRICT,
  step_kind text NOT NULL CHECK (step_kind IN ('technical_check', 'review', 'approve')),
  min_amount_paise bigint, -- NULL = no lower bound
  max_amount_paise bigint, -- NULL = no upper bound (e.g. <= 300000 paise = ₹3,000)
  always_required boolean NOT NULL DEFAULT false,
  UNIQUE (chain_id, step_order)
);

CREATE TABLE public.approval_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  request_number text NOT NULL UNIQUE,
  request_type text NOT NULL REFERENCES public.approval_chains(request_type),
  site_id uuid REFERENCES public.sites(id) ON DELETE RESTRICT,
  source_table text NOT NULL,
  source_id uuid NOT NULL,
  anti_split_item_id uuid REFERENCES public.items(id),
  amount_paise bigint NOT NULL DEFAULT 0 CHECK (amount_paise >= 0),
  rolling_7d_amount_paise bigint NOT NULL DEFAULT 0 CHECK (rolling_7d_amount_paise >= 0),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'sent_back', 'approved', 'rejected', 'cancelled')),
  current_step_order integer NOT NULL DEFAULT 1,
  current_position_id uuid REFERENCES public.positions(id),
  requested_by uuid NOT NULL REFERENCES public.profiles(id),
  submitted_at timestamptz NOT NULL DEFAULT now(),
  step_started_at timestamptz NOT NULL DEFAULT now(),
  escalation_level integer NOT NULL DEFAULT 0,
  resolved_at timestamptz,
  summary jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.approval_actions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id uuid NOT NULL REFERENCES public.approval_requests(id) ON DELETE RESTRICT,
  step_order integer NOT NULL,
  action text NOT NULL CHECK (action IN ('submit', 'technical_ok', 'review_ok', 'approve', 'reject', 'send_back', 'escalate', 'cancel')),
  actor_user_id uuid REFERENCES public.profiles(id),
  actor_position_id uuid REFERENCES public.positions(id),
  comment text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.approval_attachments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id uuid NOT NULL REFERENCES public.approval_requests(id) ON DELETE RESTRICT,
  attachment_kind text NOT NULL,
  storage_path text NOT NULL,
  uploaded_by uuid REFERENCES public.profiles(id),
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Compute Rolling 7-Day Anti-Splitting Total (same site + same item within window)
CREATE OR REPLACE FUNCTION public.compute_anti_split_amount_paise(
  p_site_id uuid,
  p_item_id uuid,
  p_current_amount_paise bigint,
  p_window_days integer DEFAULT 7,
  p_exclude_request_id uuid DEFAULT NULL
)
RETURNS bigint
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p_current_amount_paise + COALESCE((
    SELECT sum(ar.amount_paise)::bigint
    FROM public.approval_requests ar
    WHERE p_site_id IS NOT NULL
      AND p_item_id IS NOT NULL
      AND ar.site_id = p_site_id
      AND ar.anti_split_item_id = p_item_id
      AND ar.status NOT IN ('rejected', 'cancelled')
      AND ar.submitted_at >= (now() - make_interval(days => p_window_days))
      AND (p_exclude_request_id IS NULL OR ar.id <> p_exclude_request_id)
  ), 0);
$$;

-- Trigger on approval_requests INSERT to populate rolling_7d_amount_paise and initial position
CREATE OR REPLACE FUNCTION public.fn_init_approval_request()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_chain public.approval_chains%ROWTYPE;
  v_first_step public.approval_chain_steps%ROWTYPE;
BEGIN
  SELECT * INTO v_chain FROM public.approval_chains WHERE request_type = NEW.request_type AND is_active = true;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Active approval chain not found for %', NEW.request_type;
  END IF;

  IF v_chain.anti_split_enabled THEN
    NEW.rolling_7d_amount_paise := public.compute_anti_split_amount_paise(
      NEW.site_id, NEW.anti_split_item_id, NEW.amount_paise, v_chain.anti_split_window_days, NEW.id
    );
  ELSE
    NEW.rolling_7d_amount_paise := NEW.amount_paise;
  END IF;

  SELECT * INTO v_first_step
  FROM public.approval_chain_steps
  WHERE chain_id = v_chain.id
    AND (
      always_required = true
      OR (
        (min_amount_paise IS NULL OR NEW.rolling_7d_amount_paise >= min_amount_paise)
        AND (max_amount_paise IS NULL OR NEW.rolling_7d_amount_paise <= max_amount_paise)
      )
    )
  ORDER BY step_order ASC
  LIMIT 1;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'No matching approval step configured for % at % paise', NEW.request_type, NEW.rolling_7d_amount_paise;
  END IF;

  NEW.current_step_order := v_first_step.step_order;
  NEW.current_position_id := v_first_step.position_id;
  NEW.step_started_at := now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_init_approval_request
BEFORE INSERT ON public.approval_requests
FOR EACH ROW EXECUTE FUNCTION public.fn_init_approval_request();

-- RPC to Act on an Approval Step (enforces position membership, technical_check vs approve, and next-step routing)
CREATE OR REPLACE FUNCTION public.rpc_act_on_approval(
  p_request_id uuid,
  p_action text, -- 'approve' | 'reject' | 'send_back'
  p_comment text DEFAULT NULL
)
RETURNS public.approval_requests
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_req public.approval_requests%ROWTYPE;
  v_chain public.approval_chains%ROWTYPE;
  v_cur_step public.approval_chain_steps%ROWTYPE;
  v_next_step public.approval_chain_steps%ROWTYPE;
  v_uid uuid := auth.uid();
  v_recorded_action text;
BEGIN
  SELECT * INTO v_req FROM public.approval_requests WHERE id = p_request_id FOR UPDATE;
  IF NOT FOUND OR v_req.status <> 'pending' THEN
    RAISE EXCEPTION 'Approval request is not pending';
  END IF;

  -- Verify caller holds current_position_id
  IF NOT EXISTS (
    SELECT 1 FROM public.user_positions up
    WHERE up.user_id = v_uid
      AND up.position_id = v_req.current_position_id
      AND up.is_active = true
  ) THEN
    RAISE EXCEPTION 'You do not hold the active position required for this approval step';
  END IF;

  SELECT * INTO v_chain FROM public.approval_chains WHERE request_type = v_req.request_type;
  SELECT * INTO v_cur_step FROM public.approval_chain_steps
  WHERE chain_id = v_chain.id AND step_order = v_req.current_step_order;

  IF p_action = 'reject' THEN
    UPDATE public.approval_requests
    SET status = 'rejected', resolved_at = now()
    WHERE id = p_request_id RETURNING * INTO v_req;
    v_recorded_action := 'reject';
  ELSIF p_action = 'send_back' THEN
    UPDATE public.approval_requests
    SET status = 'sent_back', resolved_at = now()
    WHERE id = p_request_id RETURNING * INTO v_req;
    v_recorded_action := 'send_back';
  ELSIF p_action = 'approve' THEN
    -- Look for next applicable step based on rolling_7d_amount_paise
    SELECT * INTO v_next_step
    FROM public.approval_chain_steps
    WHERE chain_id = v_chain.id
      AND step_order > v_req.current_step_order
      AND (
        always_required = true
        OR (
          (min_amount_paise IS NULL OR v_req.rolling_7d_amount_paise >= min_amount_paise)
          AND (max_amount_paise IS NULL OR v_req.rolling_7d_amount_paise <= max_amount_paise)
        )
      )
    ORDER BY step_order ASC
    LIMIT 1;

    IF v_cur_step.step_kind = 'technical_check' THEN
      v_recorded_action := 'technical_ok';
      IF v_next_step.id IS NULL THEN
        RAISE EXCEPTION 'Technical check step cannot grant final spending approval';
      END IF;
    ELSIF v_cur_step.step_kind = 'review' THEN
      v_recorded_action := 'review_ok';
    ELSE
      v_recorded_action := 'approve';
    END IF;

    IF v_next_step.id IS NOT NULL THEN
      UPDATE public.approval_requests
      SET current_step_order = v_next_step.step_order,
          current_position_id = v_next_step.position_id,
          step_started_at = now()
      WHERE id = p_request_id RETURNING * INTO v_req;
    ELSE
      UPDATE public.approval_requests
      SET status = 'approved', resolved_at = now()
      WHERE id = p_request_id RETURNING * INTO v_req;
    END IF;
  ELSE
    RAISE EXCEPTION 'Unsupported approval action: %', p_action;
  END IF;

  INSERT INTO public.approval_actions (request_id, step_order, action, actor_user_id, actor_position_id, comment)
  VALUES (p_request_id, v_cur_step.step_order, v_recorded_action, v_uid, v_req.current_position_id, p_comment);

  RETURN v_req;
END;
$$;

-- 24-Hour Escalation Function (invoked by pg_cron)
CREATE OR REPLACE FUNCTION public.escalate_stale_approvals()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  rec RECORD;
  v_reports_to uuid;
  v_count integer := 0;
BEGIN
  FOR rec IN
    SELECT ar.*, ac.escalation_hours
    FROM public.approval_requests ar
    JOIN public.approval_chains ac ON ac.request_type = ar.request_type
    WHERE ar.status = 'pending'
      AND ar.step_started_at < (now() - make_interval(hours => ac.escalation_hours))
  LOOP
    SELECT reports_to_position_id INTO v_reports_to
    FROM public.positions WHERE id = rec.current_position_id;

    IF v_reports_to IS NOT NULL THEN
      UPDATE public.approval_requests
      SET current_position_id = v_reports_to,
          escalation_level = escalation_level + 1,
          step_started_at = now()
      WHERE id = rec.id;

      INSERT INTO public.approval_actions (request_id, step_order, action, actor_position_id, comment)
      VALUES (rec.id, rec.current_step_order, 'escalate', v_reports_to, 'Auto-escalated after exceeding SLA hours');

      v_count := v_count + 1;
    END IF;
  END LOOP;
  RETURN v_count;
END;
$$;

-- -----------------------------------------------------------------------------
-- 3. Material Requests, Purchase Orders, Goods Receipts & Site Stock
-- -----------------------------------------------------------------------------
CREATE TABLE public.material_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  mr_number text NOT NULL UNIQUE,
  site_id uuid NOT NULL REFERENCES public.sites(id) ON DELETE RESTRICT,
  requested_by uuid NOT NULL REFERENCES public.profiles(id),
  needed_by_date date NOT NULL,
  plan_activity_id uuid,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'pending_approval', 'sent_back', 'approved', 'po_issued', 'fulfilled', 'rejected', 'cancelled')),
  approval_request_id uuid REFERENCES public.approval_requests(id),
  remarks text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.material_request_lines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  material_request_id uuid NOT NULL REFERENCES public.material_requests(id) ON DELETE CASCADE,
  item_id uuid NOT NULL REFERENCES public.items(id),
  qty numeric(14,3) NOT NULL CHECK (qty > 0),
  estimated_rate_paise bigint NOT NULL DEFAULT 0
);

CREATE TABLE public.purchase_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  po_number text NOT NULL UNIQUE,
  site_id uuid NOT NULL REFERENCES public.sites(id) ON DELETE RESTRICT,
  vendor_id uuid NOT NULL REFERENCES public.vendors(id) ON DELETE RESTRICT,
  material_request_id uuid REFERENCES public.material_requests(id),
  po_date date NOT NULL DEFAULT CURRENT_DATE,
  delivery_date date NOT NULL,
  subtotal_paise bigint NOT NULL DEFAULT 0,
  cgst_paise bigint NOT NULL DEFAULT 0,
  sgst_paise bigint NOT NULL DEFAULT 0,
  igst_paise bigint NOT NULL DEFAULT 0,
  total_paise bigint NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'pending_approval', 'approved', 'sent_to_vendor', 'part_received', 'received', 'cancelled')),
  approval_request_id uuid REFERENCES public.approval_requests(id),
  terms text,
  created_by uuid REFERENCES public.profiles(id),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.purchase_order_lines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  purchase_order_id uuid NOT NULL REFERENCES public.purchase_orders(id) ON DELETE CASCADE,
  item_id uuid NOT NULL REFERENCES public.items(id),
  qty_ordered numeric(14,3) NOT NULL CHECK (qty_ordered > 0),
  qty_received numeric(14,3) NOT NULL DEFAULT 0,
  rate_paise bigint NOT NULL CHECK (rate_paise >= 0),
  gst_rate_pct numeric(5,2) NOT NULL DEFAULT 18.00,
  amount_paise bigint NOT NULL CHECK (amount_paise >= 0),
  last_3_rates_json jsonb NOT NULL DEFAULT '[]'::jsonb
);

-- Helper RPC: Get Last 3 Purchase Rates for an Item
CREATE OR REPLACE FUNCTION public.rpc_get_last_3_po_rates(p_item_id uuid)
RETURNS TABLE (
  po_number text,
  po_date date,
  vendor_name text,
  site_name text,
  rate_paise bigint
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT po.po_number, po.po_date, v.name, s.name, pol.rate_paise
  FROM public.purchase_order_lines pol
  JOIN public.purchase_orders po ON po.id = pol.purchase_order_id
  JOIN public.vendors v ON v.id = po.vendor_id
  JOIN public.sites s ON s.id = po.site_id
  WHERE pol.item_id = p_item_id
    AND po.status IN ('approved', 'sent_to_vendor', 'part_received', 'received')
  ORDER BY po.po_date DESC, po.created_at DESC
  LIMIT 3;
$$;

CREATE TABLE public.goods_receipts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  grn_number text NOT NULL UNIQUE,
  site_id uuid NOT NULL REFERENCES public.sites(id) ON DELETE RESTRICT,
  purchase_order_id uuid REFERENCES public.purchase_orders(id),
  vendor_id uuid NOT NULL REFERENCES public.vendors(id),
  received_by uuid NOT NULL REFERENCES public.profiles(id),
  received_at timestamptz NOT NULL DEFAULT now(),
  challan_no text NOT NULL,
  challan_photo_path text NOT NULL,
  vehicle_no text,
  daily_report_id uuid REFERENCES public.daily_reports(id),
  status text NOT NULL DEFAULT 'confirmed' CHECK (status IN ('confirmed', 'cancelled'))
);

CREATE TABLE public.goods_receipt_lines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  goods_receipt_id uuid NOT NULL REFERENCES public.goods_receipts(id) ON DELETE CASCADE,
  po_line_id uuid REFERENCES public.purchase_order_lines(id),
  item_id uuid NOT NULL REFERENCES public.items(id),
  qty_received numeric(14,3) NOT NULL CHECK (qty_received > 0),
  qty_accepted numeric(14,3) NOT NULL CHECK (qty_accepted >= 0)
);

CREATE TABLE public.site_stock_ledger (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id uuid NOT NULL REFERENCES public.sites(id) ON DELETE RESTRICT,
  item_id uuid NOT NULL REFERENCES public.items(id) ON DELETE RESTRICT,
  txn_type text NOT NULL CHECK (txn_type IN ('grn_in', 'usage_out', 'transfer_out', 'transfer_in', 'opening', 'adjustment')),
  qty_signed numeric(14,3) NOT NULL,
  source_table text NOT NULL,
  source_id uuid NOT NULL,
  txn_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.site_stock_balances (
  site_id uuid NOT NULL REFERENCES public.sites(id) ON DELETE CASCADE,
  item_id uuid NOT NULL REFERENCES public.items(id) ON DELETE CASCADE,
  qty_on_hand numeric(14,3) NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (site_id, item_id)
);

CREATE OR REPLACE FUNCTION public.fn_sync_site_stock_balance()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  INSERT INTO public.site_stock_balances (site_id, item_id, qty_on_hand, updated_at)
  VALUES (NEW.site_id, NEW.item_id, NEW.qty_signed, now())
  ON CONFLICT (site_id, item_id)
  DO UPDATE SET qty_on_hand = public.site_stock_balances.qty_on_hand + EXCLUDED.qty_on_hand,
                updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_sync_site_stock_balance
AFTER INSERT ON public.site_stock_ledger
FOR EACH ROW EXECUTE FUNCTION public.fn_sync_site_stock_balance();

-- Automatically deduct stock on Evening Material Usage insert
CREATE OR REPLACE FUNCTION public.fn_deduct_daily_material_usage()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  INSERT INTO public.site_stock_ledger (site_id, item_id, txn_type, qty_signed, source_table, source_id)
  VALUES (NEW.site_id, NEW.item_id, 'usage_out', -1 * NEW.qty_used, 'daily_material_usages', NEW.id);
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_deduct_daily_material_usage
AFTER INSERT ON public.daily_material_usages
FOR EACH ROW EXECUTE FUNCTION public.fn_deduct_daily_material_usage();

-- Automatically add stock on GRN line insert
CREATE OR REPLACE FUNCTION public.fn_add_grn_stock()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v_site_id uuid;
BEGIN
  SELECT site_id INTO v_site_id FROM public.goods_receipts WHERE id = NEW.goods_receipt_id;
  INSERT INTO public.site_stock_ledger (site_id, item_id, txn_type, qty_signed, source_table, source_id)
  VALUES (v_site_id, NEW.item_id, 'grn_in', NEW.qty_accepted, 'goods_receipt_lines', NEW.id);
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_add_grn_stock
AFTER INSERT ON public.goods_receipt_lines
FOR EACH ROW EXECUTE FUNCTION public.fn_add_grn_stock();

-- Audit & Immutability Triggers
CREATE TRIGGER trg_audit_approval_requests AFTER INSERT OR UPDATE OR DELETE ON public.approval_requests FOR EACH ROW EXECUTE FUNCTION public.fn_audit_trigger();
CREATE TRIGGER trg_audit_material_requests AFTER INSERT OR UPDATE OR DELETE ON public.material_requests FOR EACH ROW EXECUTE FUNCTION public.fn_audit_trigger();
CREATE TRIGGER trg_audit_purchase_orders AFTER INSERT OR UPDATE OR DELETE ON public.purchase_orders FOR EACH ROW EXECUTE FUNCTION public.fn_audit_trigger();
CREATE TRIGGER trg_audit_goods_receipts AFTER INSERT OR UPDATE OR DELETE ON public.goods_receipts FOR EACH ROW EXECUTE FUNCTION public.fn_audit_trigger();

CREATE TRIGGER trg_no_delete_approval_requests BEFORE DELETE ON public.approval_requests FOR EACH ROW EXECUTE FUNCTION public.fn_block_hard_delete();
CREATE TRIGGER trg_no_delete_purchase_orders BEFORE DELETE ON public.purchase_orders FOR EACH ROW EXECUTE FUNCTION public.fn_block_hard_delete();
CREATE TRIGGER trg_no_delete_goods_receipts BEFORE DELETE ON public.goods_receipts FOR EACH ROW EXECUTE FUNCTION public.fn_block_hard_delete();

-- Enable RLS
ALTER TABLE public.items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vendors ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vendor_item_rates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.approval_chains ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.approval_chain_steps ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.approval_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.approval_actions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.approval_attachments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.material_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.material_request_lines ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.purchase_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.purchase_order_lines ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.goods_receipts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.goods_receipt_lines ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.site_stock_ledger ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.site_stock_balances ENABLE ROW LEVEL SECURITY;

CREATE POLICY items_select ON public.items FOR SELECT TO authenticated USING (true);
CREATE POLICY items_manage ON public.items FOR ALL TO authenticated
  USING (public.has_permission(auth.uid(), 'material.edit')) WITH CHECK (public.has_permission(auth.uid(), 'material.edit'));

CREATE POLICY vendors_select ON public.vendors FOR SELECT TO authenticated
  USING (public.has_permission(auth.uid(), 'material.view') OR public.has_permission(auth.uid(), 'voucher.view'));
CREATE POLICY vendors_manage ON public.vendors FOR ALL TO authenticated
  USING (public.has_permission(auth.uid(), 'material.edit')) WITH CHECK (public.has_permission(auth.uid(), 'material.edit'));

CREATE POLICY vendor_rates_select ON public.vendor_item_rates FOR SELECT TO authenticated
  USING (public.has_permission(auth.uid(), 'material.po.view'));

CREATE POLICY approval_chains_select ON public.approval_chains FOR SELECT TO authenticated USING (true);
CREATE POLICY approval_chains_manage ON public.approval_chains FOR ALL TO authenticated
  USING (public.has_permission(auth.uid(), 'admin.approvals.edit')) WITH CHECK (public.has_permission(auth.uid(), 'admin.approvals.edit'));

CREATE POLICY approval_steps_select ON public.approval_chain_steps FOR SELECT TO authenticated USING (true);
CREATE POLICY approval_steps_manage ON public.approval_chain_steps FOR ALL TO authenticated
  USING (public.has_permission(auth.uid(), 'admin.approvals.edit')) WITH CHECK (public.has_permission(auth.uid(), 'admin.approvals.edit'));

CREATE POLICY approval_requests_select ON public.approval_requests FOR SELECT TO authenticated
  USING (requested_by = auth.uid() OR site_id IS NULL OR public.can_access_site(auth.uid(), site_id));
CREATE POLICY approval_requests_insert ON public.approval_requests FOR INSERT TO authenticated
  WITH CHECK (public.has_permission(auth.uid(), 'approval.create'));

CREATE POLICY approval_actions_select ON public.approval_actions FOR SELECT TO authenticated USING (true);
CREATE POLICY approval_attachments_select ON public.approval_attachments FOR SELECT TO authenticated USING (true);

CREATE POLICY mr_select ON public.material_requests FOR SELECT TO authenticated USING (public.can_access_site(auth.uid(), site_id));
CREATE POLICY mr_write ON public.material_requests FOR ALL TO authenticated
  USING (public.has_permission(auth.uid(), 'material.create') AND public.can_access_site(auth.uid(), site_id))
  WITH CHECK (public.has_permission(auth.uid(), 'material.create') AND public.can_access_site(auth.uid(), site_id));

CREATE POLICY mr_lines_all ON public.material_request_lines FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.material_requests mr WHERE mr.id = material_request_id AND public.can_access_site(auth.uid(), mr.site_id)));

CREATE POLICY po_select ON public.purchase_orders FOR SELECT TO authenticated
  USING (public.has_permission(auth.uid(), 'material.po.view') AND public.can_access_site(auth.uid(), site_id));
CREATE POLICY po_write ON public.purchase_orders FOR ALL TO authenticated
  USING (public.has_permission(auth.uid(), 'material.po.create') AND public.can_access_site(auth.uid(), site_id))
  WITH CHECK (public.has_permission(auth.uid(), 'material.po.create') AND public.can_access_site(auth.uid(), site_id));

CREATE POLICY po_lines_all ON public.purchase_order_lines FOR ALL TO authenticated
  USING (public.has_permission(auth.uid(), 'material.po.view'));

CREATE POLICY grn_select ON public.goods_receipts FOR SELECT TO authenticated USING (public.can_access_site(auth.uid(), site_id));
CREATE POLICY grn_write ON public.goods_receipts FOR ALL TO authenticated
  USING (public.has_permission(auth.uid(), 'material.grn.create') AND public.can_access_site(auth.uid(), site_id))
  WITH CHECK (public.has_permission(auth.uid(), 'material.grn.create') AND public.can_access_site(auth.uid(), site_id));

CREATE POLICY grn_lines_all ON public.goods_receipt_lines FOR ALL TO authenticated USING (true);
CREATE POLICY stock_ledger_select ON public.site_stock_ledger FOR SELECT TO authenticated USING (public.can_access_site(auth.uid(), site_id));
CREATE POLICY stock_balances_select ON public.site_stock_balances FOR SELECT TO authenticated USING (public.can_access_site(auth.uid(), site_id));

