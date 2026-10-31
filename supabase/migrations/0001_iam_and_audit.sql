-- =============================================================================
-- Asty ERP — Migration 0001: IAM, Configurable Positions/Permissions & Audit
-- Rules:
--   * Zero hard-coded person or position names in SQL, RLS, or approval logic
--   * Money in bigint paise
--   * Universal audit_log trigger on all business tables
-- =============================================================================

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- -----------------------------------------------------------------------------
-- 1. Company Settings & Number Series
-- -----------------------------------------------------------------------------
CREATE TABLE public.company_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_name text NOT NULL DEFAULT 'Asty Constructions',
  gstin text,
  pan text,
  registered_address text DEFAULT 'Kerala, India',
  letterhead_logo_path text,
  default_geofence_radius_m integer NOT NULL DEFAULT 150 CHECK (default_geofence_radius_m >= 25),
  anti_split_window_days integer NOT NULL DEFAULT 7 CHECK (anti_split_window_days >= 1),
  escalation_hours integer NOT NULL DEFAULT 24 CHECK (escalation_hours >= 1),
  fy_start_month integer NOT NULL DEFAULT 4 CHECK (fy_start_month BETWEEN 1 AND 12),
  timezone text NOT NULL DEFAULT 'Asia/Kolkata',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.number_series (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  doc_type text NOT NULL,
  financial_year text NOT NULL,
  prefix text NOT NULL,
  current_number integer NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (doc_type, financial_year)
);

CREATE OR REPLACE FUNCTION public.next_document_number(p_doc_type text, p_fy text, p_prefix text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_num integer;
BEGIN
  INSERT INTO public.number_series (doc_type, financial_year, prefix, current_number)
  VALUES (p_doc_type, p_fy, p_prefix, 1)
  ON CONFLICT (doc_type, financial_year)
  DO UPDATE SET current_number = public.number_series.current_number + 1,
                updated_at = now()
  RETURNING current_number INTO v_num;

  RETURN p_prefix || '/' || p_fy || '/' || lpad(v_num::text, 4, '0');
END;
$$;

-- -----------------------------------------------------------------------------
-- 2. Profiles, Positions, Permissions, Reporting Line & Site Access
-- -----------------------------------------------------------------------------
CREATE TABLE public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE RESTRICT,
  employee_code text UNIQUE,
  full_name text NOT NULL,
  email text,
  phone text,
  preferred_language text NOT NULL DEFAULT 'en' CHECK (preferred_language IN ('en', 'ml')),
  is_active boolean NOT NULL DEFAULT true,
  deactivated_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.positions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  login_type text NOT NULL CHECK (login_type IN ('admin', 'management', 'office', 'field', 'external')),
  device_hint text NOT NULL DEFAULT 'computer',
  description text,
  reports_to_position_id uuid REFERENCES public.positions(id) ON DELETE SET NULL,
  is_system_protected boolean NOT NULL DEFAULT false,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Prevent deleting or deactivating a system-protected position
CREATE OR REPLACE FUNCTION public.fn_guard_protected_position()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_OP = 'DELETE' AND OLD.is_system_protected THEN
    RAISE EXCEPTION 'System-protected position cannot be deleted';
  END IF;
  IF TG_OP = 'UPDATE' AND OLD.is_system_protected AND NEW.is_active = false THEN
    RAISE EXCEPTION 'System-protected position cannot be deactivated';
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$;

CREATE TRIGGER trg_guard_protected_position
BEFORE UPDATE OR DELETE ON public.positions
FOR EACH ROW EXECUTE FUNCTION public.fn_guard_protected_position();

CREATE TABLE public.permissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  module text NOT NULL,
  action text NOT NULL CHECK (action IN ('view', 'create', 'edit', 'approve', 'delete', 'export')),
  description text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.position_permissions (
  position_id uuid NOT NULL REFERENCES public.positions(id) ON DELETE CASCADE,
  permission_id uuid NOT NULL REFERENCES public.permissions(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (position_id, permission_id)
);

CREATE TABLE public.user_positions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  position_id uuid NOT NULL REFERENCES public.positions(id) ON DELETE RESTRICT,
  is_primary boolean NOT NULL DEFAULT false,
  is_active boolean NOT NULL DEFAULT true,
  assigned_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, position_id)
);

CREATE TABLE public.user_site_access (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  all_sites boolean NOT NULL DEFAULT false,
  site_id uuid, -- FK added in 0002 after sites table exists
  created_at timestamptz NOT NULL DEFAULT now()
);

-- -----------------------------------------------------------------------------
-- 3. Universal Audit Log (Append-Only)
-- -----------------------------------------------------------------------------
CREATE TABLE public.audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  table_name text NOT NULL,
  record_id text NOT NULL,
  operation text NOT NULL CHECK (operation IN ('INSERT', 'UPDATE', 'DELETE')),
  actor_user_id uuid,
  actor_position_ids uuid[] NOT NULL DEFAULT '{}',
  old_values jsonb,
  new_values jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE OR REPLACE FUNCTION public.fn_prevent_audit_mutation()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'audit_log is append-only and cannot be modified or deleted';
END;
$$;

CREATE TRIGGER trg_audit_immutable
BEFORE UPDATE OR DELETE ON public.audit_log
FOR EACH ROW EXECUTE FUNCTION public.fn_prevent_audit_mutation();

CREATE OR REPLACE FUNCTION public.fn_audit_trigger()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_pos_ids uuid[];
  v_rec_id text;
BEGIN
  IF v_uid IS NOT NULL THEN
    SELECT COALESCE(array_agg(up.position_id), '{}')
    INTO v_pos_ids
    FROM public.user_positions up
    JOIN public.positions p ON p.id = up.position_id AND p.is_active = true
    WHERE up.user_id = v_uid AND up.is_active = true;
  ELSE
    v_pos_ids := '{}';
  END IF;

  IF TG_OP = 'DELETE' THEN
    v_rec_id := COALESCE(to_jsonb(OLD)->>'id', to_jsonb(OLD)->>'site_id', 'composite');
    INSERT INTO public.audit_log (table_name, record_id, operation, actor_user_id, actor_position_ids, old_values)
    VALUES (TG_TABLE_NAME, v_rec_id, TG_OP, v_uid, v_pos_ids, to_jsonb(OLD));
    RETURN OLD;
  ELSIF TG_OP = 'UPDATE' THEN
    v_rec_id := COALESCE(to_jsonb(NEW)->>'id', to_jsonb(NEW)->>'site_id', 'composite');
    INSERT INTO public.audit_log (table_name, record_id, operation, actor_user_id, actor_position_ids, old_values, new_values)
    VALUES (TG_TABLE_NAME, v_rec_id, TG_OP, v_uid, v_pos_ids, to_jsonb(OLD), to_jsonb(NEW));
    RETURN NEW;
  ELSE
    v_rec_id := COALESCE(to_jsonb(NEW)->>'id', to_jsonb(NEW)->>'site_id', 'composite');
    INSERT INTO public.audit_log (table_name, record_id, operation, actor_user_id, actor_position_ids, new_values)
    VALUES (TG_TABLE_NAME, v_rec_id, TG_OP, v_uid, v_pos_ids, to_jsonb(NEW));
    RETURN NEW;
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.fn_block_hard_delete()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'Hard delete is forbidden on %; use status = cancelled or a reversal entry', TG_TABLE_NAME;
END;
$$;

-- -----------------------------------------------------------------------------
-- 4. Permission Helper Function (has_permission)
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.has_permission(p_user_id uuid, p_perm_code text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles pr
    JOIN public.user_positions up ON up.user_id = pr.id AND up.is_active = true
    JOIN public.positions pos ON pos.id = up.position_id AND pos.is_active = true
    JOIN public.position_permissions pp ON pp.position_id = pos.id
    JOIN public.permissions perm ON perm.id = pp.permission_id
    WHERE pr.id = p_user_id
      AND pr.is_active = true
      AND perm.code = p_perm_code
  );
$$;

-- Attach Audit Triggers to 0001 Tables
CREATE TRIGGER trg_audit_company_settings AFTER INSERT OR UPDATE OR DELETE ON public.company_settings FOR EACH ROW EXECUTE FUNCTION public.fn_audit_trigger();
CREATE TRIGGER trg_audit_profiles AFTER INSERT OR UPDATE OR DELETE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.fn_audit_trigger();
CREATE TRIGGER trg_audit_positions AFTER INSERT OR UPDATE OR DELETE ON public.positions FOR EACH ROW EXECUTE FUNCTION public.fn_audit_trigger();
CREATE TRIGGER trg_audit_position_permissions AFTER INSERT OR UPDATE OR DELETE ON public.position_permissions FOR EACH ROW EXECUTE FUNCTION public.fn_audit_trigger();
CREATE TRIGGER trg_audit_user_positions AFTER INSERT OR UPDATE OR DELETE ON public.user_positions FOR EACH ROW EXECUTE FUNCTION public.fn_audit_trigger();
CREATE TRIGGER trg_audit_user_site_access AFTER INSERT OR UPDATE OR DELETE ON public.user_site_access FOR EACH ROW EXECUTE FUNCTION public.fn_audit_trigger();

-- Prevent deleting profiles (deactivate instead)
CREATE TRIGGER trg_no_delete_profiles BEFORE DELETE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.fn_block_hard_delete();

-- -----------------------------------------------------------------------------
-- 5. Enable RLS on 0001 Tables
-- -----------------------------------------------------------------------------
ALTER TABLE public.company_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.number_series ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.positions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.position_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_positions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_site_access ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY company_settings_select ON public.company_settings FOR SELECT TO authenticated USING (true);
CREATE POLICY company_settings_modify ON public.company_settings FOR ALL TO authenticated
  USING (public.has_permission(auth.uid(), 'admin.settings.edit'))
  WITH CHECK (public.has_permission(auth.uid(), 'admin.settings.edit'));

CREATE POLICY number_series_select ON public.number_series FOR SELECT TO authenticated USING (true);

CREATE POLICY profiles_select ON public.profiles FOR SELECT TO authenticated
  USING (id = auth.uid() OR public.has_permission(auth.uid(), 'admin.users.view') OR public.has_permission(auth.uid(), 'site.view'));
CREATE POLICY profiles_manage ON public.profiles FOR ALL TO authenticated
  USING (public.has_permission(auth.uid(), 'admin.users.edit'))
  WITH CHECK (public.has_permission(auth.uid(), 'admin.users.edit'));

CREATE POLICY positions_select ON public.positions FOR SELECT TO authenticated USING (true);
CREATE POLICY positions_manage ON public.positions FOR ALL TO authenticated
  USING (public.has_permission(auth.uid(), 'admin.positions.edit'))
  WITH CHECK (public.has_permission(auth.uid(), 'admin.positions.edit'));

CREATE POLICY permissions_select ON public.permissions FOR SELECT TO authenticated USING (true);

CREATE POLICY position_permissions_select ON public.position_permissions FOR SELECT TO authenticated USING (true);
CREATE POLICY position_permissions_manage ON public.position_permissions FOR ALL TO authenticated
  USING (public.has_permission(auth.uid(), 'admin.positions.edit'))
  WITH CHECK (public.has_permission(auth.uid(), 'admin.positions.edit'));

CREATE POLICY user_positions_select ON public.user_positions FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.has_permission(auth.uid(), 'admin.users.view') OR public.has_permission(auth.uid(), 'site.view'));
CREATE POLICY user_positions_manage ON public.user_positions FOR ALL TO authenticated
  USING (public.has_permission(auth.uid(), 'admin.users.edit'))
  WITH CHECK (public.has_permission(auth.uid(), 'admin.users.edit'));

CREATE POLICY user_site_access_select ON public.user_site_access FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.has_permission(auth.uid(), 'admin.users.view'));
CREATE POLICY user_site_access_manage ON public.user_site_access FOR ALL TO authenticated
  USING (public.has_permission(auth.uid(), 'admin.users.edit'))
  WITH CHECK (public.has_permission(auth.uid(), 'admin.users.edit'));

CREATE POLICY audit_log_select ON public.audit_log FOR SELECT TO authenticated
  USING (public.has_permission(auth.uid(), 'admin.audit.view'));

