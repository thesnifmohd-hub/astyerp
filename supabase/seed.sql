-- =============================================================================
-- Asty ERP — Seed Data (SPEC Sections 3.1, 4.1, 4.5, 4.10 & 6)
-- Note: Zero real person names — positions and permissions are pure data.
-- =============================================================================

INSERT INTO public.company_settings (company_name, gstin, pan, registered_address, default_geofence_radius_m, anti_split_window_days, escalation_hours)
VALUES ('Asty Constructions', '32AABCA8821K1Z4', 'AABCA8821K', '2nd Floor, Asty Chambers, Thrissur, Kerala - 680001', 150, 7, 24)
ON CONFLICT DO NOTHING;

-- 1. Permissions Catalogue
INSERT INTO public.permissions (code, module, action, description) VALUES
  ('admin.users.view', 'admin', 'view', 'View users and site assignments'),
  ('admin.users.create', 'admin', 'create', 'Create new user logins'),
  ('admin.users.edit', 'admin', 'edit', 'Edit users, assign positions/sites, deactivate'),
  ('admin.positions.view', 'admin', 'view', 'View positions and permission matrix'),
  ('admin.positions.edit', 'admin', 'edit', 'Create/rename/deactivate positions and edit permissions'),
  ('admin.approvals.edit', 'admin', 'edit', 'Configure approval chains and rupee limits'),
  ('admin.settings.edit', 'admin', 'edit', 'Configure company letterhead and system settings'),
  ('admin.audit.view', 'admin', 'view', 'Inspect immutable audit log'),

  ('site.view', 'sites', 'view', 'View accessible sites, maps and documents'),
  ('site.create', 'sites', 'create', 'Create new construction sites'),
  ('site.edit', 'sites', 'edit', 'Edit site details, geofence and team'),

  ('dpr.view', 'dpr', 'view', 'View Daily Progress Reports and stamped photos'),
  ('dpr.create', 'dpr', 'create', 'Submit GPS check-ins, live photos and daily site reports'),
  ('dpr.export', 'dpr', 'export', 'Export printable DPR PDFs'),

  ('approval.view', 'approvals', 'view', 'View approval inbox and history'),
  ('approval.create', 'approvals', 'create', 'Raise approval requests'),
  ('approval.approve', 'approvals', 'approve', 'Act on assigned approval steps'),

  ('material.view', 'materials', 'view', 'View items, vendors, stock and requests'),
  ('material.create', 'materials', 'create', 'Raise material requests'),
  ('material.edit', 'materials', 'edit', 'Manage item master and vendor master'),
  ('material.po.view', 'materials', 'view', 'View purchase orders and vendor rates'),
  ('material.po.create', 'materials', 'create', 'Create purchase orders'),
  ('material.grn.create', 'materials', 'create', 'Confirm goods receipt at site with challan photo'),
  ('material.transfer.approve', 'materials', 'approve', 'Approve site-to-site material transfers'),

  ('boq.view', 'boq', 'view', 'View BOQ, rate sheets and quotations'),
  ('boq.edit', 'boq', 'edit', 'Create/edit BOQ versions and import Excel'),
  ('boq.approve', 'boq', 'approve', 'Approve and lock BOQ versions'),

  ('plan.view', 'planning', 'view', 'View site schedule, Gantt and 14-day look-ahead'),
  ('plan.edit', 'planning', 'edit', 'Create and update site plans and dependencies'),
  ('plan.approve', 'planning', 'approve', 'Approve baseline site plans and plan changes'),

  ('labour.view', 'labour', 'view', 'View worker master, attendance and weekly wage sheets'),
  ('labour.edit', 'labour', 'edit', 'Manage own workers, attendance and wage sheets'),

  ('subcon.view', 'subcontractors', 'view', 'View subcontractors, work orders and bills'),
  ('subcon.edit', 'subcontractors', 'edit', 'Manage subcontractors, work orders and measured bills'),

  ('client_bill.view', 'billing', 'view', 'View client RA/Final/Labour/Extra/PMC invoices'),
  ('client_bill.create', 'billing', 'create', 'Prepare and check client bills'),
  ('client_bill.approve', 'billing', 'approve', 'Final approval of client bills'),

  ('voucher.view', 'accounting', 'view', 'View chart of accounts, vouchers, ledgers and GST/TDS'),
  ('voucher.draft', 'accounting', 'create', 'Prepare draft vouchers, bills, receipts and reconciliations'),
  ('voucher.post', 'accounting', 'approve', 'Review and post vouchers to books'),
  ('period.lock', 'accounting', 'edit', 'Lock accounting periods'),
  ('period.unlock_override', 'accounting', 'approve', 'Unlock locked periods (Management override)'),

  ('report.operations.view', 'reports', 'view', 'View operational, delay and look-ahead reports'),
  ('report.accounts.view', 'reports', 'view', 'View trial balance, P&L, balance sheet and ageing'),
  ('report.profit.view', 'reports', 'view', 'View contract values, margins, site profit and partner profit split'),
  ('report.export', 'reports', 'export', 'Export reports to PDF and Excel'),

  ('client_portal.view', 'portal', 'view', 'Client view of own site photos and approved bills'),
  ('client_portal.approve_extra', 'portal', 'approve', 'Client written/OTP approval for extra work')
ON CONFLICT (code) DO NOTHING;

-- 2. Starting 8 Positions + Reporting Hierarchy (Site Supervisor -> Project Coordinator -> Operations Executive -> Management)
WITH ins_admin AS (
  INSERT INTO public.positions (name, login_type, device_hint, description, is_system_protected)
  VALUES ('System Admin', 'admin', 'Computer', 'Creates users, positions and permissions; company settings, approval rules, number series; cannot be deleted', true)
  RETURNING id
),
ins_mgmt AS (
  INSERT INTO public.positions (name, login_type, device_hint, description)
  VALUES ('Management (Director)', 'management', 'Mobile + Computer', 'Final approval above ₹3,000; approves site plans, plan changes and client bills; sees costs, margins, profit and partner split')
  RETURNING id
),
ins_ops AS (
  INSERT INTO public.positions (name, login_type, device_hint, description, reports_to_position_id)
  SELECT 'Operations Executive', 'office', 'Computer', 'Approves requests up to ₹3,000; reviews > ₹3,000; manages sites, purchases, vendors, labour and delay follow-ups', id FROM ins_mgmt
  RETURNING id
),
ins_coord AS (
  INSERT INTO public.positions (name, login_type, device_hint, description, reports_to_position_id)
  SELECT 'Project Coordinator', 'field', 'Mobile + Computer', 'Technical check of requests; builds site plans; oversees Site Supervisors; quality checks; approves stock transfers', id FROM ins_ops
  RETURNING id
),
ins_sup AS (
  INSERT INTO public.positions (name, login_type, device_hint, description, reports_to_position_id)
  SELECT 'Site Supervisor', 'field', 'Mobile', 'Daily GPS check-ins and live photo DPRs for assigned sites only; raises requests and confirms GRN', id FROM ins_coord
  RETURNING id
),
ins_acc_head AS (
  INSERT INTO public.positions (name, login_type, device_hint, description, reports_to_position_id)
  SELECT 'Accounts Head', 'office', 'Computer', 'Reviews and posts vouchers, bank reconciliation, GST/TDS, client bills, payments, financial reports and period locks', id FROM ins_mgmt
  RETURNING id
),
ins_jr_acc AS (
  INSERT INTO public.positions (name, login_type, device_hint, description, reports_to_position_id)
  SELECT 'Junior Accountant', 'office', 'Computer', 'Enters vouchers, purchase bills, petty cash settlements, receipts and wages as drafts; no posting or profit access', id FROM ins_acc_head
  RETURNING id
)
INSERT INTO public.positions (name, login_type, device_hint, description)
VALUES ('Client', 'external', 'Mobile', 'Sees own site progress photos and approved bills; approves extra work');

-- Grant all permissions to System Admin & Management (except Management uses Admin only if granted; Management gets full business + report.profit.view)
INSERT INTO public.position_permissions (position_id, permission_id)
SELECT p.id, perm.id
FROM public.positions p CROSS JOIN public.permissions perm
WHERE p.name IN ('System Admin', 'Management (Director)')
ON CONFLICT DO NOTHING;

-- Indian Standard Chart of Accounts Groups
INSERT INTO public.account_groups (code, name, nature, is_direct) VALUES
  ('CAP', 'Capital Account', 'equity', false),
  ('LOAN', 'Loans (Liability)', 'liabilities', false),
  ('CL', 'Current Liabilities', 'liabilities', false),
  ('SC', 'Sundry Creditors', 'liabilities', false),
  ('DT', 'Duties & Taxes (GST / TDS)', 'liabilities', false),
  ('FA', 'Fixed Assets', 'assets', false),
  ('CA', 'Current Assets', 'assets', false),
  ('SD', 'Sundry Debtors', 'assets', false),
  ('BANK', 'Bank Accounts', 'assets', false),
  ('CASH', 'Cash-in-Hand & Petty Cash', 'assets', false),
  ('DI', 'Direct Income (Contract & PMC Revenue)', 'income', true),
  ('II', 'Indirect Income', 'income', false),
  ('DE', 'Direct Site Expenses (Material, Labour, Subcon)', 'expenses', true),
  ('IE', 'Indirect Head Office Expenses', 'expenses', false)
ON CONFLICT (code) DO NOTHING;

INSERT INTO public.cost_centres (code, name, is_head_office)
VALUES ('CC-HO', 'Head Office — Asty Constructions', true)
ON CONFLICT (code) DO NOTHING;

