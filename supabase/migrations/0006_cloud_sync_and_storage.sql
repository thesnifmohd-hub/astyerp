-- =============================================================================
-- Asty ERP — Migration 0006: Storage Buckets, Position Matrix & Cloud Realtime Sync
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

-- 3. Cloud Workspace Sync Table (Protected by Authenticated RLS + Realtime Enabled)
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
