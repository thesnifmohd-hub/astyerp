-- =============================================================================
-- Asty ERP — Migration 0006: Storage Buckets, Relational Kerala Seed & Cloud Realtime Sync
-- =============================================================================

-- 1. Supabase Storage Buckets (site-photos, site-documents, bills-and-receipts)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES
  ('site-photos', 'site-photos', false, 10485760, ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/svg+xml']),
  ('site-documents', 'site-documents', false, 26214400, ARRAY['application/pdf', 'image/jpeg', 'image/png', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet']),
  ('bills-and-receipts', 'bills-and-receipts', false, 15728640, ARRAY['application/pdf', 'image/jpeg', 'image/png', 'image/webp'])
ON CONFLICT (id) DO NOTHING;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'asty_authenticated_storage_read'
  ) THEN
    CREATE POLICY "asty_authenticated_storage_read"
      ON storage.objects FOR SELECT
      USING (auth.role() = 'authenticated' AND bucket_id IN ('site-photos', 'site-documents', 'bills-and-receipts'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'asty_authenticated_storage_insert'
  ) THEN
    CREATE POLICY "asty_authenticated_storage_insert"
      ON storage.objects FOR INSERT
      WITH CHECK (auth.role() = 'authenticated' AND bucket_id IN ('site-photos', 'site-documents', 'bills-and-receipts'));
  END IF;
END $$;

-- 2. Complete Position-Permission Matrix for Operational, Field, Accounting & Client Positions
INSERT INTO public.position_permissions (position_id, permission_id)
SELECT p.id, perm.id
FROM public.positions p
JOIN public.permissions perm ON (
  (p.name = 'Operations Executive' AND perm.code IN (
    'site.view', 'site.create', 'site.edit',
    'dpr.view', 'dpr.export',
    'approval.view', 'approval.create', 'approval.approve',
    'material.view', 'material.create', 'material.edit', 'material.po.view', 'material.po.create', 'material.grn.create',
    'boq.view', 'boq.edit',
    'plan.view', 'plan.edit',
    'labour.view', 'labour.edit',
    'subcon.view', 'subcon.edit',
    'client_bill.view', 'client_bill.create',
    'report.operations.view', 'report.export'
  ))
  OR (p.name = 'Project Coordinator' AND perm.code IN (
    'site.view',
    'dpr.view', 'dpr.create', 'dpr.export',
    'approval.view', 'approval.create', 'approval.approve',
    'material.view', 'material.create', 'material.grn.create', 'material.transfer.approve',
    'boq.view',
    'plan.view', 'plan.edit',
    'labour.view',
    'subcon.view', 'subcon.edit',
    'report.operations.view'
  ))
  OR (p.name = 'Site Supervisor' AND perm.code IN (
    'site.view',
    'dpr.view', 'dpr.create',
    'approval.view', 'approval.create',
    'material.view', 'material.create', 'material.grn.create'
  ))
  OR (p.name = 'Accounts Head' AND perm.code IN (
    'site.view', 'dpr.view', 'approval.view',
    'material.view', 'material.po.view',
    'labour.view', 'labour.edit', 'subcon.view',
    'client_bill.view', 'client_bill.create',
    'voucher.view', 'voucher.draft', 'voucher.post', 'period.lock',
    'report.accounts.view', 'report.export'
  ))
  OR (p.name = 'Junior Accountant' AND perm.code IN (
    'site.view', 'material.view', 'material.po.view',
    'labour.view', 'subcon.view', 'client_bill.view',
    'voucher.view', 'voucher.draft', 'report.accounts.view'
  ))
  OR (p.name = 'Client' AND perm.code IN (
    'site.view', 'dpr.view', 'client_portal.view', 'client_portal.approve_extra'
  ))
)
ON CONFLICT DO NOTHING;

-- 3. Seed 4 Kerala Clients, Sites, Isolated Financial Terms & Cost Centres
INSERT INTO public.clients (code, name, phone, email, gstin, billing_address)
VALUES
  ('CL-HADI', 'Hadi Residence Client', '+91 94471 10101', 'hadi.client@example.com', NULL, 'Punkunnam, Thrissur, Kerala'),
  ('CL-TALI', 'Talikulam Beach Hospitality Pvt Ltd', '+91 94471 20202', 'projects@talikulamresort.in', '32AABCT4412L1Z2', 'Snehatheeram Road, Talikulam, Thrissur, Kerala'),
  ('CL-WAYA', 'Misty Hills Wayanad Estates LLP', '+91 94471 30303', 'accounts@wayanadresort.in', '32AAEFM9910P1Z8', 'Vythiri-Kalpetta Highway, Wayanad, Kerala'),
  ('CL-TKMB', 'TKM Industrial Enterprises', '+91 94471 40404', 'infra@tkmenterprises.in', '32AABCT7781H1Z1', 'Karicode Industrial Estate, Kollam, Kerala')
ON CONFLICT (code) DO NOTHING;

INSERT INTO public.sites (code, name, client_id, site_address, lat, lng, geofence_radius_m, project_type, contract_type, status, start_date, target_end_date, schedule_health, days_behind)
SELECT 'SITE-HADI', 'Hadi Bedroom', c.id, 'Punkunnam Residential Enclave, Thrissur, Kerala', 10.5354000, 76.2028000, 120, 'residential', 'lump_sum', 'active', CURRENT_DATE - 35, CURRENT_DATE + 40, 'on_track', 0
FROM public.clients c WHERE c.code = 'CL-HADI'
ON CONFLICT (code) DO NOTHING;

INSERT INTO public.sites (code, name, client_id, site_address, lat, lng, geofence_radius_m, project_type, contract_type, status, start_date, target_end_date, schedule_health, days_behind)
SELECT 'SITE-TALI', 'Talikulam Resort', c.id, 'Snehatheeram Coastal Belt, Talikulam, Thrissur, Kerala', 10.4281000, 76.0865000, 180, 'commercial', 'item_rate', 'active', CURRENT_DATE - 60, CURRENT_DATE + 150, 'delayed', 6
FROM public.clients c WHERE c.code = 'CL-TALI'
ON CONFLICT (code) DO NOTHING;

INSERT INTO public.sites (code, name, client_id, site_address, lat, lng, geofence_radius_m, project_type, contract_type, status, start_date, target_end_date, schedule_health, days_behind)
SELECT 'SITE-WAYA', 'Wayanad Resort', c.id, 'Vythiri Hill Crest, Wayanad, Kerala', 11.5518000, 76.0403000, 200, 'commercial', 'pmc_percent', 'active', CURRENT_DATE - 45, CURRENT_DATE + 180, 'at_risk', 3
FROM public.clients c WHERE c.code = 'CL-WAYA'
ON CONFLICT (code) DO NOTHING;

INSERT INTO public.sites (code, name, client_id, site_address, lat, lng, geofence_radius_m, project_type, contract_type, status, start_date, target_end_date, schedule_health, days_behind)
SELECT 'SITE-TKMB', 'TKM Building', c.id, 'Karicode Commercial Junction, Kollam, Kerala', 8.9142000, 76.6320000, 150, 'commercial', 'labour_only', 'active', CURRENT_DATE - 50, CURRENT_DATE + 95, 'on_track', 0
FROM public.clients c WHERE c.code = 'CL-TKMB'
ON CONFLICT (code) DO NOTHING;

INSERT INTO public.site_financial_terms (site_id, contract_value_paise, pmc_fee_pct, retention_pct, mobilisation_advance_paise, profit_share_split)
SELECT s.id,
  CASE s.code
    WHEN 'SITE-HADI' THEN 185000000::bigint
    WHEN 'SITE-TALI' THEN 1650000000::bigint
    WHEN 'SITE-WAYA' THEN 2400000000::bigint
    WHEN 'SITE-TKMB' THEN 620000000::bigint
  END,
  CASE WHEN s.code = 'SITE-WAYA' THEN 12.00 ELSE 0.00 END,
  CASE WHEN s.code = 'SITE-WAYA' THEN 0.00 ELSE 5.00 END,
  CASE s.code
    WHEN 'SITE-HADI' THEN 18500000::bigint
    WHEN 'SITE-TALI' THEN 165000000::bigint
    WHEN 'SITE-WAYA' THEN 0::bigint
    WHEN 'SITE-TKMB' THEN 50000000::bigint
  END,
  '[{"partner_label":"Managing Partner 1","share_pct":50,"role":"partner"},{"partner_label":"Managing Partner 2","share_pct":50,"role":"partner"}]'::jsonb
FROM public.sites s
ON CONFLICT (site_id) DO NOTHING;

INSERT INTO public.cost_centres (code, name, site_id, is_head_office)
SELECT 'CC-' || REPLACE(s.code, 'SITE-', ''), s.name || ' Cost Centre', s.id, false
FROM public.sites s
ON CONFLICT (code) DO NOTHING;

-- 4. Seed Construction Materials & Kerala Vendors
INSERT INTO public.items (code, name, name_ml, category, unit, hsn_code, gst_rate_pct, default_wastage_pct, reference_rate_paise)
VALUES
  ('MAT-CEM-53', 'OPC 53 Grade Cement (50kg)', 'സിമന്റ് OPC 53 ഗ്രേഡ് (50kg)', 'cement', 'Bag', '2523', 28.00, 2.00, 39500),
  ('MAT-MSAND', 'Crushed M-Sand (Double Washed)', 'എം-സാൻഡ്', 'sand', 'CFT', '2505', 5.00, 4.00, 5600),
  ('MAT-AGG-20', '20mm Crushed Stone Aggregate', '20mm മെറ്റൽ', 'aggregate', 'CFT', '2517', 5.00, 3.00, 4800),
  ('MAT-TMT-12', 'Fe550D TMT Steel Bar 12mm', 'TMT കമ്പി 12mm', 'steel', 'Kg', '7214', 18.00, 2.50, 6800),
  ('MAT-RMC-M25', 'Ready Mix Concrete M25 Grade', 'റെഡി മിക്സ് കോൺക്രീറ്റ് M25', 'rmc', 'Cum', '3824', 18.00, 1.50, 545000),
  ('MAT-LAT-BLK', 'Malabar Dressed Laterite Stone', 'വെട്ടുകല്ല്', 'masonry', 'Nos', '2516', 5.00, 3.50, 3800)
ON CONFLICT (code) DO NOTHING;

INSERT INTO public.vendors (code, name, contact_name, phone, gstin, pan, address)
VALUES
  ('VND-001', 'Malabar Cements & Steels Trading', 'Sales Desk', '+91 487 2421100', '32AABCM1209D1Z5', 'AABCM1209D', 'Shornur Road, Thrissur, Kerala'),
  ('VND-002', 'Thrissur Blue Metals & M-Sand Crusher', 'Dispatch Office', '+91 487 2389900', '32AACFT8832E1Z1', 'AACFT8832E', 'Peechi-Mannuthy Belt, Thrissur, Kerala'),
  ('VND-003', 'Wayanad ReadyMix Concrete Plant', 'Plant Coordinator', '+91 4936 204455', '32AADCW5519Q1Z9', 'AADCW5519Q', 'Kalpetta Industrial Zone, Wayanad, Kerala')
ON CONFLICT (code) DO NOTHING;

-- 5. Cloud Workspace Sync Table (Protected by Authenticated RLS + Realtime Enabled)
CREATE TABLE IF NOT EXISTS public.erp_workspace_sync (
  workspace_key text PRIMARY KEY DEFAULT 'asty-main',
  payload jsonb NOT NULL,
  version bigint NOT NULL DEFAULT 1,
  updated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_by_label text,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.erp_workspace_sync ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'erp_workspace_sync' AND policyname = 'erp_workspace_sync_authenticated_select'
  ) THEN
    CREATE POLICY "erp_workspace_sync_authenticated_select"
      ON public.erp_workspace_sync FOR SELECT
      USING (auth.role() = 'authenticated');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'erp_workspace_sync' AND policyname = 'erp_workspace_sync_authenticated_insert'
  ) THEN
    CREATE POLICY "erp_workspace_sync_authenticated_insert"
      ON public.erp_workspace_sync FOR INSERT
      WITH CHECK (auth.role() = 'authenticated');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'erp_workspace_sync' AND policyname = 'erp_workspace_sync_authenticated_update'
  ) THEN
    CREATE POLICY "erp_workspace_sync_authenticated_update"
      ON public.erp_workspace_sync FOR UPDATE
      USING (auth.role() = 'authenticated')
      WITH CHECK (auth.role() = 'authenticated');
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'erp_workspace_sync'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.erp_workspace_sync;
  END IF;
END $$;

