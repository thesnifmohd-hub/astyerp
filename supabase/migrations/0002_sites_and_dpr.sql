-- =============================================================================
-- Asty ERP — Migration 0002: Site Master, Geofencing & Daily Site Reporting
-- =============================================================================

CREATE TABLE public.clients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  name text NOT NULL,
  phone text,
  email text,
  gstin text,
  pan text,
  billing_address text,
  portal_user_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.sites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  name text NOT NULL,
  client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE RESTRICT,
  site_address text NOT NULL,
  lat numeric(10,7) NOT NULL,
  lng numeric(10,7) NOT NULL,
  geofence_radius_m integer NOT NULL DEFAULT 150 CHECK (geofence_radius_m BETWEEN 25 AND 2000),
  project_type text NOT NULL CHECK (project_type IN ('residential', 'commercial')),
  contract_type text NOT NULL CHECK (contract_type IN ('lump_sum', 'item_rate', 'labour_only', 'pmc_percent', 'cost_plus')),
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('planning', 'active', 'on_hold', 'completed', 'cancelled')),
  start_date date NOT NULL,
  target_end_date date NOT NULL,
  morning_start time NOT NULL DEFAULT '08:00',
  morning_end time NOT NULL DEFAULT '10:00',
  afternoon_start time NOT NULL DEFAULT '12:30',
  afternoon_end time NOT NULL DEFAULT '14:30',
  evening_start time NOT NULL DEFAULT '16:30',
  evening_end time NOT NULL DEFAULT '19:00',
  schedule_health text NOT NULL DEFAULT 'on_track' CHECK (schedule_health IN ('on_track', 'at_risk', 'delayed')),
  days_behind integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.user_site_access
  ADD CONSTRAINT fk_user_site_access_site
  FOREIGN KEY (site_id) REFERENCES public.sites(id) ON DELETE CASCADE;

-- Isolated Commercial & Partner Profit-Share Table (protected by report.profit.view)
CREATE TABLE public.site_financial_terms (
  site_id uuid PRIMARY KEY REFERENCES public.sites(id) ON DELETE CASCADE,
  contract_value_paise bigint NOT NULL DEFAULT 0 CHECK (contract_value_paise >= 0),
  pmc_fee_pct numeric(5,2) NOT NULL DEFAULT 0 CHECK (pmc_fee_pct BETWEEN 0 AND 100),
  retention_pct numeric(5,2) NOT NULL DEFAULT 5.00 CHECK (retention_pct BETWEEN 0 AND 100),
  mobilisation_advance_paise bigint NOT NULL DEFAULT 0 CHECK (mobilisation_advance_paise >= 0),
  profit_share_split jsonb NOT NULL DEFAULT '[{"partner_label":"Managing Partner 1","share_pct":50,"role":"partner"},{"partner_label":"Managing Partner 2","share_pct":50,"role":"partner"}]'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.site_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id uuid NOT NULL REFERENCES public.sites(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  position_id uuid NOT NULL REFERENCES public.positions(id) ON DELETE RESTRICT,
  is_active boolean NOT NULL DEFAULT true,
  assigned_from date NOT NULL DEFAULT CURRENT_DATE,
  assigned_to date,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (site_id, user_id, position_id)
);

CREATE TABLE public.site_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id uuid NOT NULL REFERENCES public.sites(id) ON DELETE CASCADE,
  category text NOT NULL CHECK (category IN ('drawing', 'agreement', 'permit', 'boq', 'other')),
  title text NOT NULL,
  version text NOT NULL DEFAULT 'v1',
  storage_path text NOT NULL,
  uploaded_by uuid REFERENCES public.profiles(id),
  created_at timestamptz NOT NULL DEFAULT now()
);

-- -----------------------------------------------------------------------------
-- Site Access Helper Function (can_access_site)
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.can_access_site(p_user_id uuid, p_site_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles pr
    WHERE pr.id = p_user_id
      AND pr.is_active = true
      AND (
        EXISTS (
          SELECT 1 FROM public.user_site_access usa
          WHERE usa.user_id = p_user_id
            AND (usa.all_sites = true OR usa.site_id = p_site_id)
        )
        OR EXISTS (
          SELECT 1 FROM public.site_assignments sa
          WHERE sa.user_id = p_user_id
            AND sa.site_id = p_site_id
            AND sa.is_active = true
        )
        OR EXISTS (
          SELECT 1 FROM public.sites s
          JOIN public.clients c ON c.id = s.client_id
          WHERE s.id = p_site_id AND c.portal_user_id = p_user_id
        )
      )
  );
$$;

-- Haversine Distance in Meters
CREATE OR REPLACE FUNCTION public.haversine_distance_m(
  lat1 numeric, lng1 numeric, lat2 numeric, lng2 numeric
)
RETURNS numeric
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT round((
    6371000 * 2 * asin(sqrt(
      power(sin(radians((lat2 - lat1)::double precision) / 2), 2) +
      cos(radians(lat1::double precision)) * cos(radians(lat2::double precision)) *
      power(sin(radians((lng2 - lng1)::double precision) / 2), 2)
    ))
  )::numeric, 2);
$$;

-- -----------------------------------------------------------------------------
-- Daily Site Reporting (DPR) Tables
-- -----------------------------------------------------------------------------
CREATE TABLE public.daily_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id uuid NOT NULL REFERENCES public.sites(id) ON DELETE RESTRICT,
  report_date date NOT NULL,
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'morning_done', 'afternoon_done', 'closed')),
  tomorrow_plan text,
  closed_at timestamptz,
  closed_by uuid REFERENCES public.profiles(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (site_id, report_date)
);

CREATE TABLE public.daily_checkins (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  daily_report_id uuid NOT NULL REFERENCES public.daily_reports(id) ON DELETE RESTRICT,
  site_id uuid NOT NULL REFERENCES public.sites(id) ON DELETE RESTRICT,
  slot text NOT NULL CHECK (slot IN ('morning', 'afternoon', 'evening')),
  checked_in_by uuid NOT NULL REFERENCES public.profiles(id),
  captured_at timestamptz NOT NULL DEFAULT now(),
  synced_at timestamptz NOT NULL DEFAULT now(),
  lat numeric(10,7) NOT NULL,
  lng numeric(10,7) NOT NULL,
  accuracy_m numeric(8,2) NOT NULL,
  distance_from_site_m numeric(8,2) NOT NULL,
  is_within_window boolean NOT NULL DEFAULT true,
  is_low_accuracy boolean NOT NULL DEFAULT false,
  is_mock_flagged boolean NOT NULL DEFAULT false,
  offline_submission_id uuid UNIQUE,
  notes text,
  UNIQUE (daily_report_id, slot)
);

CREATE TABLE public.daily_photos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  daily_checkin_id uuid NOT NULL REFERENCES public.daily_checkins(id) ON DELETE RESTRICT,
  site_id uuid NOT NULL REFERENCES public.sites(id) ON DELETE RESTRICT,
  slot text NOT NULL CHECK (slot IN ('morning', 'afternoon', 'evening')),
  storage_path text NOT NULL,
  captured_at timestamptz NOT NULL DEFAULT now(),
  lat numeric(10,7) NOT NULL,
  lng numeric(10,7) NOT NULL,
  accuracy_m numeric(8,2) NOT NULL,
  caption text
);

CREATE TABLE public.daily_subcontractor_counts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  daily_report_id uuid NOT NULL REFERENCES public.daily_reports(id) ON DELETE RESTRICT,
  trade text NOT NULL,
  headcount integer NOT NULL CHECK (headcount >= 0)
);

CREATE TABLE public.daily_activity_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  daily_report_id uuid NOT NULL REFERENCES public.daily_reports(id) ON DELETE RESTRICT,
  plan_activity_id uuid,
  activity_title text NOT NULL,
  selected_in_morning boolean NOT NULL DEFAULT true,
  completed_qty numeric(14,3) NOT NULL DEFAULT 0,
  unit text NOT NULL DEFAULT 'm3',
  completed_pct numeric(5,2) NOT NULL DEFAULT 0,
  notes text
);

CREATE TABLE public.daily_material_usages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  daily_report_id uuid NOT NULL REFERENCES public.daily_reports(id) ON DELETE RESTRICT,
  site_id uuid NOT NULL REFERENCES public.sites(id) ON DELETE RESTRICT,
  item_id uuid NOT NULL,
  qty_used numeric(14,3) NOT NULL CHECK (qty_used > 0),
  plan_activity_id uuid,
  notes text
);

CREATE TABLE public.daily_issues (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  daily_report_id uuid NOT NULL REFERENCES public.daily_reports(id) ON DELETE RESTRICT,
  site_id uuid NOT NULL REFERENCES public.sites(id) ON DELETE RESTRICT,
  category text NOT NULL CHECK (category IN ('material', 'drawing', 'labour', 'weather', 'client', 'equipment', 'other')),
  description text NOT NULL,
  is_urgent boolean NOT NULL DEFAULT false,
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'resolved')),
  resolved_at timestamptz,
  resolved_by uuid REFERENCES public.profiles(id),
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Geofence Enforcement Trigger on daily_checkins
CREATE OR REPLACE FUNCTION public.fn_validate_checkin_geofence()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_site public.sites%ROWTYPE;
  v_dist numeric(8,2);
BEGIN
  IF NEW.is_mock_flagged THEN
    RAISE EXCEPTION 'Mock GPS location detected. Live physical check-in at site is required.';
  END IF;

  SELECT * INTO v_site FROM public.sites WHERE id = NEW.site_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Site not found';
  END IF;

  v_dist := public.haversine_distance_m(NEW.lat, NEW.lng, v_site.lat, v_site.lng);
  NEW.distance_from_site_m := v_dist;
  NEW.is_low_accuracy := (NEW.accuracy_m > 50);

  IF v_dist > v_site.geofence_radius_m THEN
    RAISE EXCEPTION 'Check-in blocked: you are % m away from % (allowed radius: % m)',
      v_dist, v_site.name, v_site.geofence_radius_m;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_validate_checkin_geofence
BEFORE INSERT ON public.daily_checkins
FOR EACH ROW EXECUTE FUNCTION public.fn_validate_checkin_geofence();

-- Enforce Day Cannot Be Closed Without Evening Check-in & >= 3 Evening Photos
CREATE OR REPLACE FUNCTION public.fn_validate_day_close()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v_evening_id uuid;
  v_photo_count integer;
BEGIN
  IF NEW.status = 'closed' AND (OLD.status IS DISTINCT FROM 'closed') THEN
    SELECT id INTO v_evening_id
    FROM public.daily_checkins
    WHERE daily_report_id = NEW.id AND slot = 'evening';

    IF v_evening_id IS NULL THEN
      RAISE EXCEPTION 'Day cannot be closed without the evening GPS check-in';
    END IF;

    SELECT count(*) INTO v_photo_count
    FROM public.daily_photos
    WHERE daily_checkin_id = v_evening_id;

    IF v_photo_count < 3 THEN
      RAISE EXCEPTION 'Evening report requires at least 3 live stamped photos (found %)', v_photo_count;
    END IF;

    IF COALESCE(btrim(NEW.tomorrow_plan), '') = '' THEN
      RAISE EXCEPTION 'Evening report requires tomorrow''s plan before closing the day';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_validate_day_close
BEFORE UPDATE ON public.daily_reports
FOR EACH ROW EXECUTE FUNCTION public.fn_validate_day_close();

-- Audit & No-Delete Triggers
CREATE TRIGGER trg_audit_clients AFTER INSERT OR UPDATE OR DELETE ON public.clients FOR EACH ROW EXECUTE FUNCTION public.fn_audit_trigger();
CREATE TRIGGER trg_audit_sites AFTER INSERT OR UPDATE OR DELETE ON public.sites FOR EACH ROW EXECUTE FUNCTION public.fn_audit_trigger();
CREATE TRIGGER trg_audit_site_financial_terms AFTER INSERT OR UPDATE OR DELETE ON public.site_financial_terms FOR EACH ROW EXECUTE FUNCTION public.fn_audit_trigger();
CREATE TRIGGER trg_audit_site_assignments AFTER INSERT OR UPDATE OR DELETE ON public.site_assignments FOR EACH ROW EXECUTE FUNCTION public.fn_audit_trigger();
CREATE TRIGGER trg_audit_daily_reports AFTER INSERT OR UPDATE OR DELETE ON public.daily_reports FOR EACH ROW EXECUTE FUNCTION public.fn_audit_trigger();
CREATE TRIGGER trg_audit_daily_checkins AFTER INSERT OR UPDATE OR DELETE ON public.daily_checkins FOR EACH ROW EXECUTE FUNCTION public.fn_audit_trigger();
CREATE TRIGGER trg_audit_daily_issues AFTER INSERT OR UPDATE OR DELETE ON public.daily_issues FOR EACH ROW EXECUTE FUNCTION public.fn_audit_trigger();

CREATE TRIGGER trg_no_delete_daily_reports BEFORE DELETE ON public.daily_reports FOR EACH ROW EXECUTE FUNCTION public.fn_block_hard_delete();
CREATE TRIGGER trg_no_delete_daily_checkins BEFORE DELETE ON public.daily_checkins FOR EACH ROW EXECUTE FUNCTION public.fn_block_hard_delete();

-- RLS Policies
ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sites ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.site_financial_terms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.site_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.site_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.daily_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.daily_checkins ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.daily_photos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.daily_subcontractor_counts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.daily_activity_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.daily_material_usages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.daily_issues ENABLE ROW LEVEL SECURITY;

CREATE POLICY clients_select ON public.clients FOR SELECT TO authenticated
  USING (public.has_permission(auth.uid(), 'site.view') OR portal_user_id = auth.uid());
CREATE POLICY clients_manage ON public.clients FOR ALL TO authenticated
  USING (public.has_permission(auth.uid(), 'site.edit'))
  WITH CHECK (public.has_permission(auth.uid(), 'site.edit'));

CREATE POLICY sites_select ON public.sites FOR SELECT TO authenticated
  USING ((public.has_permission(auth.uid(), 'site.view') OR public.has_permission(auth.uid(), 'client_portal.view'))
         AND public.can_access_site(auth.uid(), id));
CREATE POLICY sites_insert ON public.sites FOR INSERT TO authenticated
  WITH CHECK (public.has_permission(auth.uid(), 'site.create'));
CREATE POLICY sites_update ON public.sites FOR UPDATE TO authenticated
  USING (public.has_permission(auth.uid(), 'site.edit') AND public.can_access_site(auth.uid(), id))
  WITH CHECK (public.has_permission(auth.uid(), 'site.edit') AND public.can_access_site(auth.uid(), id));

-- Commercials & Profit Share strictly gated by report.profit.view
CREATE POLICY site_financial_terms_select ON public.site_financial_terms FOR SELECT TO authenticated
  USING (public.has_permission(auth.uid(), 'report.profit.view') AND public.can_access_site(auth.uid(), site_id));
CREATE POLICY site_financial_terms_manage ON public.site_financial_terms FOR ALL TO authenticated
  USING (public.has_permission(auth.uid(), 'report.profit.view') AND public.has_permission(auth.uid(), 'site.edit'))
  WITH CHECK (public.has_permission(auth.uid(), 'report.profit.view') AND public.has_permission(auth.uid(), 'site.edit'));

CREATE POLICY site_assignments_select ON public.site_assignments FOR SELECT TO authenticated
  USING (public.can_access_site(auth.uid(), site_id));
CREATE POLICY site_assignments_manage ON public.site_assignments FOR ALL TO authenticated
  USING (public.has_permission(auth.uid(), 'site.edit'))
  WITH CHECK (public.has_permission(auth.uid(), 'site.edit'));

CREATE POLICY site_documents_select ON public.site_documents FOR SELECT TO authenticated
  USING (public.can_access_site(auth.uid(), site_id));
CREATE POLICY site_documents_manage ON public.site_documents FOR ALL TO authenticated
  USING (public.has_permission(auth.uid(), 'site.edit') AND public.can_access_site(auth.uid(), site_id))
  WITH CHECK (public.has_permission(auth.uid(), 'site.edit') AND public.can_access_site(auth.uid(), site_id));

CREATE POLICY dpr_select ON public.daily_reports FOR SELECT TO authenticated
  USING ((public.has_permission(auth.uid(), 'dpr.view') OR public.has_permission(auth.uid(), 'dpr.create'))
         AND public.can_access_site(auth.uid(), site_id));
CREATE POLICY dpr_write ON public.daily_reports FOR ALL TO authenticated
  USING (public.has_permission(auth.uid(), 'dpr.create') AND public.can_access_site(auth.uid(), site_id))
  WITH CHECK (public.has_permission(auth.uid(), 'dpr.create') AND public.can_access_site(auth.uid(), site_id));

CREATE POLICY checkins_select ON public.daily_checkins FOR SELECT TO authenticated
  USING (public.can_access_site(auth.uid(), site_id));
CREATE POLICY checkins_insert ON public.daily_checkins FOR INSERT TO authenticated
  WITH CHECK (public.has_permission(auth.uid(), 'dpr.create') AND public.can_access_site(auth.uid(), site_id));

CREATE POLICY photos_select ON public.daily_photos FOR SELECT TO authenticated
  USING (public.can_access_site(auth.uid(), site_id));
CREATE POLICY photos_insert ON public.daily_photos FOR INSERT TO authenticated
  WITH CHECK (public.has_permission(auth.uid(), 'dpr.create') AND public.can_access_site(auth.uid(), site_id));

CREATE POLICY subcon_counts_all ON public.daily_subcontractor_counts FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.daily_reports dr WHERE dr.id = daily_report_id AND public.can_access_site(auth.uid(), dr.site_id)));
CREATE POLICY activity_logs_all ON public.daily_activity_logs FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.daily_reports dr WHERE dr.id = daily_report_id AND public.can_access_site(auth.uid(), dr.site_id)));
CREATE POLICY mat_usage_all ON public.daily_material_usages FOR ALL TO authenticated
  USING (public.can_access_site(auth.uid(), site_id));
CREATE POLICY issues_all ON public.daily_issues FOR ALL TO authenticated
  USING (public.can_access_site(auth.uid(), site_id));

