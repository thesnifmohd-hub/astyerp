import type {
  AppNotification,
  ApprovalChain,
  ApprovalRequest,
  AuditLogEntry,
  BankStatementRow,
  BoqVersion,
  Client,
  ClientBill,
  DailyReport,
  ExtraWorkItem,
  FixedAsset,
  GoodsReceipt,
  Item,
  LedgerAccount,
  LoanRecord,
  MaterialRequest,
  PermissionDef,
  PettyCashWallet,
  PlanActivity,
  Position,
  PurchaseOrder,
  RateSheet,
  Site,
  SiteFinancialTerms,
  StockTransfer,
  Subcontractor,
  SubcontractorBill,
  UserProfile,
  Vendor,
  Voucher,
  WageSheet,
  WorkOrder,
  Worker,
} from './database.types';
import { todayISOInIST } from './dates';

export interface ErpDatabaseState {
  company: {
    name: string;
    gstin: string;
    pan: string;
    address: string;
    antiSplitDays: number;
    escalationHours: number;
    defaultRadiusM: number;
    lockedPeriodBefore: string | null;
  };
  permissions: PermissionDef[];
  positions: Position[];
  positionPermissions: Record<string, string[]>; // positionId -> permissionCode[]
  users: UserProfile[];
  clients: Client[];
  sites: Site[];
  siteFinancials: Record<string, SiteFinancialTerms>;
  dailyReports: DailyReport[];
  approvalChains: ApprovalChain[];
  approvalRequests: ApprovalRequest[];
  items: Item[];
  vendors: Vendor[];
  materialRequests: MaterialRequest[];
  purchaseOrders: PurchaseOrder[];
  goodsReceipts: GoodsReceipt[];
  stockTransfers: StockTransfer[];
  siteOpeningStock: Record<string, Record<string, number>>; // siteId -> itemId -> qty
  boqVersions: BoqVersion[];
  planActivities: PlanActivity[];
  workers: Worker[];
  wageSheets: WageSheet[];
  subcontractors: Subcontractor[];
  workOrders: WorkOrder[];
  subcontractorBills: SubcontractorBill[];
  ledgers: LedgerAccount[];
  vouchers: Voucher[];
  clientBills: ClientBill[];
  fixedAssets: FixedAsset[];
  loans: LoanRecord[];
  pettyCashWallets: PettyCashWallet[];
  bankStatementRows: BankStatementRow[];
  extraWorkItems: ExtraWorkItem[];
  notifications: AppNotification[];
  auditLog: AuditLogEntry[];
}

export const PERMISSION_CATALOGUE: PermissionDef[] = [
  { id: 'perm-1', code: 'admin.users.view', module: 'admin', action: 'view', description: 'View users & assignments' },
  { id: 'perm-2', code: 'admin.users.edit', module: 'admin', action: 'edit', description: 'Create, assign & deactivate users' },
  { id: 'perm-3', code: 'admin.positions.view', module: 'admin', action: 'view', description: 'View positions & permissions' },
  { id: 'perm-4', code: 'admin.positions.edit', module: 'admin', action: 'edit', description: 'Create/edit positions & permission matrix' },
  { id: 'perm-5', code: 'admin.approvals.edit', module: 'admin', action: 'edit', description: 'Configure approval chains & limits' },
  { id: 'perm-6', code: 'admin.audit.view', module: 'admin', action: 'view', description: 'View immutable audit log' },
  { id: 'perm-7', code: 'site.view', module: 'sites', action: 'view', description: 'View accessible sites & maps' },
  { id: 'perm-8', code: 'site.create', module: 'sites', action: 'create', description: 'Create new sites' },
  { id: 'perm-9', code: 'site.edit', module: 'sites', action: 'edit', description: 'Edit sites, GPS radius & team' },
  { id: 'perm-10', code: 'dpr.view', module: 'dpr', action: 'view', description: 'View site Daily Progress Reports' },
  { id: 'perm-11', code: 'dpr.create', module: 'dpr', action: 'create', description: 'Submit GPS check-ins & live photos' },
  { id: 'perm-12', code: 'dpr.export', module: 'dpr', action: 'export', description: 'Export printable DPR PDF' },
  { id: 'perm-13', code: 'approval.view', module: 'approvals', action: 'view', description: 'View approval requests' },
  { id: 'perm-14', code: 'approval.create', module: 'approvals', action: 'create', description: 'Raise approval requests' },
  { id: 'perm-15', code: 'approval.approve', module: 'approvals', action: 'approve', description: 'Act on assigned approval steps' },
  { id: 'perm-16', code: 'material.view', module: 'materials', action: 'view', description: 'View items, vendors & site stock' },
  { id: 'perm-17', code: 'material.create', module: 'materials', action: 'create', description: 'Raise material requests' },
  { id: 'perm-18', code: 'material.edit', module: 'materials', action: 'edit', description: 'Manage items & vendors' },
  { id: 'perm-19', code: 'material.po.view', module: 'materials', action: 'view', description: 'View purchase orders & last 3 rates' },
  { id: 'perm-20', code: 'material.po.create', module: 'materials', action: 'create', description: 'Create purchase orders' },
  { id: 'perm-21', code: 'material.grn.create', module: 'materials', action: 'create', description: 'Confirm site goods receipt with challan photo' },
  { id: 'perm-22', code: 'material.transfer.approve', module: 'materials', action: 'approve', description: 'Approve site-to-site transfers' },
  { id: 'perm-23', code: 'boq.view', module: 'boq', action: 'view', description: 'View BOQ, rate sheets & quotations' },
  { id: 'perm-24', code: 'boq.edit', module: 'boq', action: 'edit', description: 'Create/edit BOQ & Excel import' },
  { id: 'perm-25', code: 'boq.approve', module: 'boq', action: 'approve', description: 'Approve & lock BOQ versions' },
  { id: 'perm-26', code: 'plan.view', module: 'planning', action: 'view', description: 'View schedule, Gantt & 14-day look-ahead' },
  { id: 'perm-27', code: 'plan.edit', module: 'planning', action: 'edit', description: 'Create/edit site plans & dependencies' },
  { id: 'perm-28', code: 'plan.approve', module: 'planning', action: 'approve', description: 'Approve baseline plans & plan changes' },
  { id: 'perm-29', code: 'labour.view', module: 'labour', action: 'view', description: 'View workers, attendance & wage sheets' },
  { id: 'perm-30', code: 'labour.edit', module: 'labour', action: 'edit', description: 'Manage workers & generate wage sheets' },
  { id: 'perm-31', code: 'subcon.view', module: 'subcontractors', action: 'view', description: 'View subcontractors, work orders & bills' },
  { id: 'perm-32', code: 'subcon.edit', module: 'subcontractors', action: 'edit', description: 'Manage subcontractors & measured bills' },
  { id: 'perm-33', code: 'client_bill.view', module: 'billing', action: 'view', description: 'View client invoices & ageing' },
  { id: 'perm-34', code: 'client_bill.create', module: 'billing', action: 'create', description: 'Prepare & check client bills' },
  { id: 'perm-35', code: 'client_bill.approve', module: 'billing', action: 'approve', description: 'Final approval of client bills' },
  { id: 'perm-36', code: 'voucher.view', module: 'accounting', action: 'view', description: 'View CoA, vouchers, ledgers, GST & TDS' },
  { id: 'perm-37', code: 'voucher.draft', module: 'accounting', action: 'create', description: 'Enter draft vouchers, bills & reconciliations' },
  { id: 'perm-38', code: 'voucher.post', module: 'accounting', action: 'approve', description: 'Review & post vouchers to books' },
  { id: 'perm-39', code: 'period.lock', module: 'accounting', action: 'edit', description: 'Lock accounting periods' },
  { id: 'perm-40', code: 'period.unlock_override', module: 'accounting', action: 'approve', description: 'Unlock locked period (Management override)' },
  { id: 'perm-41', code: 'report.operations.view', module: 'reports', action: 'view', description: 'View delay, supervisor & Tuesday pack reports' },
  { id: 'perm-42', code: 'report.accounts.view', module: 'reports', action: 'view', description: 'View financial statements & ageing' },
  { id: 'perm-43', code: 'report.profit.view', module: 'reports', action: 'view', description: 'View contract value, margins, site profit & partner split' },
  { id: 'perm-44', code: 'report.export', module: 'reports', action: 'export', description: 'Export PDF & Excel reports' },
  { id: 'perm-45', code: 'client_portal.view', module: 'portal', action: 'view', description: 'Client view of own site progress & bills' },
  { id: 'perm-46', code: 'client_portal.approve_extra', module: 'portal', action: 'approve', description: 'Client approval for extra work' },
];

function makePlaceholderPhotoSvg(siteName: string, slot: string, dateStr: string, lat: number, lng: number): string {
  const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='640' height='420' viewBox='0 0 640 420'>
    <defs>
      <linearGradient id='g' x1='0' y1='0' x2='1' y2='1'>
        <stop offset='0%' stop-color='#2A3639'/>
        <stop offset='100%' stop-color='#546A76'/>
      </linearGradient>
    </defs>
    <rect width='640' height='420' fill='url(#g)'/>
    <rect x='40' y='80' width='220' height='210' fill='#8DA1B1' opacity='0.35'/>
    <rect x='290' y='120' width='290' height='170' fill='#CBD5E1' opacity='0.28'/>
    <line x1='0' y1='290' x2='640' y2='290' stroke='#94A3B8' stroke-width='3'/>
    <text x='48' y='64' fill='#FFFFFF' font-family='Arial' font-size='18' font-weight='bold'>LIVE CAMERA CAPTURE — ${slot.toUpperCase()}</text>
    <rect x='0' y='330' width='640' height='90' fill='#0B0B0B' opacity='0.86'/>
    <text x='20' y='358' fill='#FFFFFF' font-family='monospace' font-size='15' font-weight='bold'>SITE: ${siteName}</text>
    <text x='20' y='382' fill='#8DA1B1' font-family='monospace' font-size='13'>DATE: ${dateStr} IST | SLOT: ${slot.toUpperCase()}</text>
    <text x='20' y='404' fill='#E2E8F0' font-family='monospace' font-size='12'>GPS: ${lat.toFixed(5)}, ${lng.toFixed(5)} (±9.4m VERIFIED)</text>
  </svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

function shiftDays(iso: string, delta: number): string {
  const d = new Date(`${iso}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + delta);
  return d.toISOString().slice(0, 10);
}

export function createInitialErpState(): ErpDatabaseState {
  const today = todayISOInIST();
  const allPermCodes = PERMISSION_CATALOGUE.map((p) => p.code);

  const positions: Position[] = [
    {
      id: 'pos-admin',
      name: 'System Admin',
      loginType: 'admin',
      deviceHint: 'Computer',
      description: 'Creates users, positions and permissions; company settings, approval rules, number series; cannot be deleted',
      reportsToPositionId: null,
      isSystemProtected: true,
      isActive: true,
    },
    {
      id: 'pos-mgmt',
      name: 'Management (Director)',
      loginType: 'management',
      deviceHint: 'Mobile + Computer',
      description: 'Final approval above ₹3,000; approves site plans, plan changes and client bills; sees costs, margins, profit and partner split',
      reportsToPositionId: null,
      isSystemProtected: false,
      isActive: true,
    },
    {
      id: 'pos-ops',
      name: 'Operations Executive',
      loginType: 'office',
      deviceHint: 'Computer',
      description: 'Approves requests up to ₹3,000; reviews > ₹3,000; manages sites, purchases, vendors, labour and delay follow-ups',
      reportsToPositionId: 'pos-mgmt',
      isSystemProtected: false,
      isActive: true,
    },
    {
      id: 'pos-coord',
      name: 'Project Coordinator',
      loginType: 'field',
      deviceHint: 'Mobile + Computer',
      description: 'Technical check of requests before spend approval; builds site plans; quality checks; approves stock transfers',
      reportsToPositionId: 'pos-ops',
      isSystemProtected: false,
      isActive: true,
    },
    {
      id: 'pos-sup',
      name: 'Site Supervisor',
      loginType: 'field',
      deviceHint: 'Mobile',
      description: 'Daily GPS check-ins and live stamped DPR photos for assigned sites only; raises requests and confirms GRN',
      reportsToPositionId: 'pos-coord',
      isSystemProtected: false,
      isActive: true,
    },
    {
      id: 'pos-acc-head',
      name: 'Accounts Head',
      loginType: 'office',
      deviceHint: 'Computer',
      description: 'Reviews and posts vouchers, bank reconciliation, GST/TDS, client bills, payments, financial reports and period locks',
      reportsToPositionId: 'pos-mgmt',
      isSystemProtected: false,
      isActive: true,
    },
    {
      id: 'pos-jr-acc',
      name: 'Junior Accountant',
      loginType: 'office',
      deviceHint: 'Computer',
      description: 'Enters vouchers, purchase bills, petty cash settlements, receipts and wages as drafts; no posting or profit access',
      reportsToPositionId: 'pos-acc-head',
      isSystemProtected: false,
      isActive: true,
    },
    {
      id: 'pos-client',
      name: 'Client',
      loginType: 'external',
      deviceHint: 'Mobile',
      description: 'Sees own site progress photos and approved bills; approves extra work',
      reportsToPositionId: null,
      isSystemProtected: false,
      isActive: true,
    },
  ];

  const positionPermissions: Record<string, string[]> = {
    'pos-admin': allPermCodes,
    'pos-mgmt': allPermCodes.filter((c) => !c.startsWith('client_portal.')),
    'pos-ops': [
      'site.view', 'site.create', 'site.edit',
      'dpr.view', 'dpr.export',
      'approval.view', 'approval.create', 'approval.approve',
      'material.view', 'material.create', 'material.edit', 'material.po.view', 'material.po.create', 'material.grn.create',
      'boq.view', 'boq.edit',
      'plan.view', 'plan.edit',
      'labour.view', 'labour.edit',
      'subcon.view', 'subcon.edit',
      'client_bill.view', 'client_bill.create',
      'report.operations.view', 'report.export',
    ],
    'pos-coord': [
      'site.view',
      'dpr.view', 'dpr.create', 'dpr.export',
      'approval.view', 'approval.create', 'approval.approve',
      'material.view', 'material.create', 'material.grn.create', 'material.transfer.approve',
      'boq.view',
      'plan.view', 'plan.edit',
      'labour.view',
      'subcon.view', 'subcon.edit',
      'report.operations.view',
    ],
    'pos-sup': [
      'site.view',
      'dpr.view', 'dpr.create',
      'approval.view', 'approval.create',
      'material.view', 'material.create', 'material.grn.create',
    ],
    'pos-acc-head': [
      'site.view',
      'dpr.view',
      'approval.view',
      'material.view', 'material.po.view',
      'labour.view', 'labour.edit',
      'subcon.view',
      'client_bill.view', 'client_bill.create',
      'voucher.view', 'voucher.draft', 'voucher.post', 'period.lock',
      'report.accounts.view', 'report.export',
    ],
    'pos-jr-acc': [
      'site.view',
      'material.view', 'material.po.view',
      'labour.view',
      'subcon.view',
      'client_bill.view',
      'voucher.view', 'voucher.draft',
      'report.accounts.view',
    ],
    'pos-client': ['site.view', 'dpr.view', 'client_portal.view', 'client_portal.approve_extra'],
  };

  // Demo Users Named Strictly by Position (SPEC Section 6 — No real names)
  const users: UserProfile[] = [
    {
      id: 'usr-admin',
      employeeCode: 'ASTY-001',
      fullName: 'Demo System Admin',
      email: 'admin@asty.demo',
      phone: '+91 98470 00001',
      preferredLanguage: 'en',
      isActive: true,
      positionIds: ['pos-admin'],
      allSites: true,
      assignedSiteIds: [],
    },
    {
      id: 'usr-mgmt-1',
      employeeCode: 'ASTY-002',
      fullName: 'Demo Management Partner 1',
      email: 'director1@asty.demo',
      phone: '+91 98470 00002',
      preferredLanguage: 'en',
      isActive: true,
      positionIds: ['pos-mgmt'],
      allSites: true,
      assignedSiteIds: [],
    },
    {
      id: 'usr-ops-1',
      employeeCode: 'ASTY-003',
      fullName: 'Demo Operations Executive',
      email: 'operations@asty.demo',
      phone: '+91 98470 00003',
      preferredLanguage: 'en',
      isActive: true,
      positionIds: ['pos-ops'],
      allSites: true,
      assignedSiteIds: [],
    },
    {
      id: 'usr-coord-1',
      employeeCode: 'ASTY-004',
      fullName: 'Demo Project Coordinator',
      email: 'coordinator@asty.demo',
      phone: '+91 98470 00004',
      preferredLanguage: 'en',
      isActive: true,
      positionIds: ['pos-coord'],
      allSites: true,
      assignedSiteIds: [],
    },
    {
      id: 'usr-sup-1',
      employeeCode: 'ASTY-005',
      fullName: 'Demo Site Supervisor 1',
      email: 'supervisor1@asty.demo',
      phone: '+91 98470 00005',
      preferredLanguage: 'ml',
      isActive: true,
      positionIds: ['pos-sup'],
      allSites: false,
      assignedSiteIds: ['site-hadi', 'site-talikulam'],
    },
    {
      id: 'usr-sup-2',
      employeeCode: 'ASTY-006',
      fullName: 'Demo Site Supervisor 2',
      email: 'supervisor2@asty.demo',
      phone: '+91 98470 00006',
      preferredLanguage: 'en',
      isActive: true,
      positionIds: ['pos-sup'],
      allSites: false,
      assignedSiteIds: ['site-wayanad', 'site-tkm'],
    },
    {
      id: 'usr-acc-head',
      employeeCode: 'ASTY-007',
      fullName: 'Demo Accounts Head',
      email: 'accountshead@asty.demo',
      phone: '+91 98470 00007',
      preferredLanguage: 'en',
      isActive: true,
      positionIds: ['pos-acc-head'],
      allSites: true,
      assignedSiteIds: [],
    },
    {
      id: 'usr-jr-acc',
      employeeCode: 'ASTY-008',
      fullName: 'Demo Junior Accountant',
      email: 'jraccountant@asty.demo',
      phone: '+91 98470 00008',
      preferredLanguage: 'en',
      isActive: true,
      positionIds: ['pos-jr-acc'],
      allSites: true,
      assignedSiteIds: [],
    },
    {
      id: 'usr-client-wayanad',
      employeeCode: 'CL-003',
      fullName: 'Demo Client (Wayanad Resort)',
      email: 'client.wayanad@asty.demo',
      phone: '+91 98470 00009',
      preferredLanguage: 'en',
      isActive: true,
      positionIds: ['pos-client'],
      allSites: false,
      assignedSiteIds: ['site-wayanad'],
    },
  ];

  const clients: Client[] = [
    { id: 'cl-1', code: 'CL-HADI', name: 'Hadi Residence Client', phone: '+91 94471 10101', email: 'hadi.client@example.com', gstin: '', address: 'Punkunnam, Thrissur, Kerala' },
    { id: 'cl-2', code: 'CL-TALI', name: 'Talikulam Beach Hospitality Pvt Ltd', phone: '+91 94471 20202', email: 'projects@talikulamresort.in', gstin: '32AABCT4412L1Z2', address: 'Snehatheeram Road, Talikulam, Thrissur, Kerala' },
    { id: 'cl-3', code: 'CL-WAYA', name: 'Misty Hills Wayanad Estates LLP', phone: '+91 94471 30303', email: 'accounts@wayanadresort.in', gstin: '32AAEFM9910P1Z8', address: 'Vythiri-Kalpetta Highway, Wayanad, Kerala', portalUserId: 'usr-client-wayanad' },
    { id: 'cl-4', code: 'CL-TKMB', name: 'TKM Industrial Enterprises', phone: '+91 94471 40404', email: 'infra@tkmenterprises.in', gstin: '32AABCT7781H1Z1', address: 'Karicode Industrial Estate, Kollam, Kerala' },
  ];

  // 4 Canonical Sites from SPEC Section 4.1
  const sites: Site[] = [
    {
      id: 'site-hadi',
      code: 'ASTY-S01',
      name: 'Hadi Bedroom',
      clientId: 'cl-1',
      siteAddress: 'Punkunnam, Thrissur, Kerala',
      lat: 10.5354,
      lng: 76.2041,
      geofenceRadiusM: 150,
      projectType: 'residential',
      contractType: 'lump_sum',
      status: 'active',
      startDate: shiftDays(today, -45),
      targetEndDate: shiftDays(today, 75),
      morningStart: '08:00',
      morningEnd: '10:00',
      afternoonStart: '12:30',
      afternoonEnd: '14:30',
      eveningStart: '16:30',
      eveningEnd: '19:00',
      scheduleHealth: 'on_track',
      daysBehind: 0,
      supervisorIds: ['usr-sup-1'],
      coordinatorId: 'usr-coord-1',
      documents: [
        { id: 'doc-1', category: 'drawing', title: 'Architectural Plan & Elevation A-101', version: 'v2', uploadedAt: shiftDays(today, -40) },
        { id: 'doc-2', category: 'agreement', title: 'Signed Lump-Sum Construction Agreement', version: 'v1', uploadedAt: shiftDays(today, -45) },
      ],
    },
    {
      id: 'site-talikulam',
      code: 'ASTY-S02',
      name: 'Talikulam Resort',
      clientId: 'cl-2',
      siteAddress: 'Snehatheeram Coastal Belt, Talikulam, Thrissur',
      lat: 10.4312,
      lng: 76.0884,
      geofenceRadiusM: 200,
      projectType: 'commercial',
      contractType: 'item_rate',
      status: 'active',
      startDate: shiftDays(today, -60),
      targetEndDate: shiftDays(today, 150),
      morningStart: '08:00',
      morningEnd: '10:00',
      afternoonStart: '12:30',
      afternoonEnd: '14:30',
      eveningStart: '16:30',
      eveningEnd: '19:00',
      scheduleHealth: 'delayed',
      daysBehind: 4,
      supervisorIds: ['usr-sup-1'],
      coordinatorId: 'usr-coord-1',
      documents: [
        { id: 'doc-3', category: 'drawing', title: 'Cottage Cluster Structural Footing GA', version: 'v3', uploadedAt: shiftDays(today, -50) },
        { id: 'doc-4', category: 'boq', title: 'Approved Item-Rate Master BOQ', version: 'v1', uploadedAt: shiftDays(today, -58) },
      ],
    },
    {
      id: 'site-wayanad',
      code: 'ASTY-S03',
      name: 'Wayanad Resort',
      clientId: 'cl-3',
      siteAddress: 'Chundale, Kalpetta, Wayanad, Kerala',
      lat: 11.5819,
      lng: 76.0586,
      geofenceRadiusM: 250,
      projectType: 'commercial',
      contractType: 'pmc_percent',
      status: 'active',
      startDate: shiftDays(today, -50),
      targetEndDate: shiftDays(today, 180),
      morningStart: '08:00',
      morningEnd: '10:00',
      afternoonStart: '12:30',
      afternoonEnd: '14:30',
      eveningStart: '16:30',
      eveningEnd: '19:00',
      scheduleHealth: 'at_risk',
      daysBehind: 2,
      supervisorIds: ['usr-sup-2'],
      coordinatorId: 'usr-coord-1',
      documents: [
        { id: 'doc-5', category: 'agreement', title: 'PMC 12% Cost-Plus Management Contract', version: 'v1', uploadedAt: shiftDays(today, -50) },
      ],
    },
    {
      id: 'site-tkm',
      code: 'ASTY-S04',
      name: 'TKM Building',
      clientId: 'cl-4',
      siteAddress: 'Karicode Industrial Zone, Kollam, Kerala',
      lat: 8.9142,
      lng: 76.6320,
      geofenceRadiusM: 150,
      projectType: 'commercial',
      contractType: 'item_rate',
      status: 'active',
      startDate: shiftDays(today, -35),
      targetEndDate: shiftDays(today, 120),
      morningStart: '08:00',
      morningEnd: '10:00',
      afternoonStart: '12:30',
      afternoonEnd: '14:30',
      eveningStart: '16:30',
      eveningEnd: '19:00',
      scheduleHealth: 'on_track',
      daysBehind: 0,
      supervisorIds: ['usr-sup-2'],
      coordinatorId: 'usr-coord-1',
      documents: [
        { id: 'doc-6', category: 'drawing', title: 'Industrial High-Bay Column & Truss Drawing', version: 'v1', uploadedAt: shiftDays(today, -32) },
      ],
    },
  ];

  const siteFinancials: Record<string, SiteFinancialTerms> = {
    'site-hadi': {
      siteId: 'site-hadi',
      contractValuePaise: 285000000, // ₹28,50,000
      pmcFeePct: 0,
      retentionPct: 5,
      mobilisationAdvancePaise: 30000000,
      profitShareSplit: [
        { partnerLabel: 'Managing Partner 1', sharePct: 50, role: 'partner' },
        { partnerLabel: 'Managing Partner 2', sharePct: 50, role: 'partner' },
      ],
    },
    'site-talikulam': {
      siteId: 'site-talikulam',
      contractValuePaise: 1850000000, // ₹1,85,00,000
      pmcFeePct: 0,
      retentionPct: 5,
      mobilisationAdvancePaise: 150000000,
      profitShareSplit: [
        { partnerLabel: 'Managing Partner 1', sharePct: 45, role: 'partner' },
        { partnerLabel: 'Managing Partner 2', sharePct: 45, role: 'partner' },
        { partnerLabel: 'Referral Partner (Coastal Lead)', sharePct: 10, role: 'referral' },
      ],
    },
    'site-wayanad': {
      siteId: 'site-wayanad',
      contractValuePaise: 2400000000, // ₹2,40,00,000 estimated project outlay (12% PMC fee)
      pmcFeePct: 12,
      retentionPct: 0,
      mobilisationAdvancePaise: 50000000,
      profitShareSplit: [
        { partnerLabel: 'Managing Partner 1', sharePct: 50, role: 'partner' },
        { partnerLabel: 'Managing Partner 2', sharePct: 50, role: 'partner' },
      ],
    },
    'site-tkm': {
      siteId: 'site-tkm',
      contractValuePaise: 1420000000, // ₹1,42,00,000
      pmcFeePct: 0,
      retentionPct: 5,
      mobilisationAdvancePaise: 100000000,
      profitShareSplit: [
        { partnerLabel: 'Managing Partner 1', sharePct: 50, role: 'partner' },
        { partnerLabel: 'Managing Partner 2', sharePct: 50, role: 'partner' },
      ],
    },
  };

  const items: Item[] = [
    { id: 'itm-cement', code: 'MAT-001', name: 'OPC 53 Grade Cement (50kg)', nameMl: 'സിമന്റ് OPC 53 (50kg)', category: 'cement', unit: 'bag', hsnCode: '2523', gstRatePct: 28, defaultWastagePct: 2, referenceRatePaise: 39500 },
    { id: 'itm-msand', code: 'MAT-002', name: 'Washed M-Sand (Plaster/Concrete)', nameMl: 'എം-സാൻഡ്', category: 'sand', unit: 'cft', hsnCode: '2505', gstRatePct: 5, defaultWastagePct: 4, referenceRatePaise: 5800 },
    { id: 'itm-agg20', code: 'MAT-003', name: '20mm Crushed Aggregate Metal', nameMl: '20mm മെറ്റൽ', category: 'aggregate', unit: 'cft', hsnCode: '2517', gstRatePct: 5, defaultWastagePct: 3, referenceRatePaise: 4600 },
    { id: 'itm-agg40', code: 'MAT-004', name: '40mm Soling Aggregate', nameMl: '40mm മെറ്റൽ', category: 'aggregate', unit: 'cft', hsnCode: '2517', gstRatePct: 5, defaultWastagePct: 3, referenceRatePaise: 4200 },
    { id: 'itm-steel', code: 'MAT-005', name: 'Fe550D TMT Steel Bars', nameMl: 'TMT കമ്പി Fe550D', category: 'steel', unit: 'kg', hsnCode: '7214', gstRatePct: 18, defaultWastagePct: 3, referenceRatePaise: 6800 },
    { id: 'itm-wire', code: 'MAT-006', name: 'Annealed Binding Wire', nameMl: 'കെട്ടുകമ്പി', category: 'steel', unit: 'kg', hsnCode: '7217', gstRatePct: 18, defaultWastagePct: 5, referenceRatePaise: 9500 },
    { id: 'itm-rmc25', code: 'MAT-007', name: 'Ready Mix Concrete M25', nameMl: 'RMC കോൺക്രീറ്റ് M25', category: 'rmc', unit: 'm3', hsnCode: '3824', gstRatePct: 18, defaultWastagePct: 2, referenceRatePaise: 560000 },
    { id: 'itm-rmc30', code: 'MAT-008', name: 'Ready Mix Concrete M30', nameMl: 'RMC കോൺക്രീറ്റ് M30', category: 'rmc', unit: 'm3', hsnCode: '3824', gstRatePct: 18, defaultWastagePct: 2, referenceRatePaise: 610000 },
    { id: 'itm-laterite', code: 'MAT-009', name: ' dressed Laterite Stone (vettukallu)', nameMl: 'വെട്ടുകല്ല്', category: 'masonry', unit: 'nos', hsnCode: '2516', gstRatePct: 5, defaultWastagePct: 4, referenceRatePaise: 3800 },
    { id: 'itm-ply', code: 'MAT-010', name: '18mm Film-Faced Shuttering Plywood', nameMl: 'ഷട്ടറിംഗ് പ്ലൈവുഡ്', category: 'timber', unit: 'nos', hsnCode: '4412', gstRatePct: 18, defaultWastagePct: 5, referenceRatePaise: 245000 },
  ];

  // 10 Seeded Vendors (SPEC Section 6)
  const vendors: Vendor[] = [
    { id: 'vnd-1', code: 'VND-001', name: 'Malabar Cement Traders', phone: '+91 98460 11001', gstin: '32AAACM1122D1Z1', address: 'Ollur, Thrissur' },
    { id: 'vnd-2', code: 'VND-002', name: 'Periyar Crusher & M-Sand', phone: '+91 98460 11002', gstin: '32AAACP2233E1Z9', address: 'Chalakudy, Thrissur' },
    { id: 'vnd-3', code: 'VND-003', name: 'Kerala Steels & Alloys', phone: '+91 98460 11003', gstin: '32AAACK3344F1Z7', address: 'Kanjikode, Palakkad' },
    { id: 'vnd-4', code: 'VND-004', name: 'Apex ReadyMix Concrete India', phone: '+91 98460 11004', gstin: '32AAACA4455G1Z5', address: 'Mannuthy Bypass, Thrissur' },
    { id: 'vnd-5', code: 'VND-005', name: 'Wayanad Quarry & Aggregates', phone: '+91 98460 11005', gstin: '32AAACW5566H1Z3', address: 'Meenangadi, Wayanad' },
    { id: 'vnd-6', code: 'VND-006', name: 'Kollam Industrial Steel Mart', phone: '+91 98460 11006', gstin: '32AAACK6677J1Z1', address: 'Chinnakada, Kollam' },
    { id: 'vnd-7', code: 'VND-007', name: 'Valluvanad Laterite Suppliers', phone: '+91 98460 11007', gstin: '32AAACV7788K1Z8', address: 'Kunnamkulam, Thrissur' },
    { id: 'vnd-8', code: 'VND-008', name: 'Cochin Formwork & Plywoods', phone: '+91 98460 11008', gstin: '32AAACC8899L1Z6', address: 'Edappally, Kochi' },
    { id: 'vnd-9', code: 'VND-009', name: 'Travancore RMC Batching', phone: '+91 98460 11009', gstin: '32AAACT9900M1Z4', address: 'Kottiyam, Kollam' },
    { id: 'vnd-10', code: 'VND-010', name: 'Sahyadri Hardware & Fasteners', phone: '+91 98460 11010', gstin: '32AAACS1010N1Z2', address: 'Kalpetta, Wayanad' },
  ];

  // Default Configurable Approval Chains (SPEC Section 4.5)
  const standardSpendSteps = [
    { stepOrder: 1, positionId: 'pos-coord', stepKind: 'technical_check' as const, minAmountPaise: null, maxAmountPaise: null, alwaysRequired: true },
    { stepOrder: 2, positionId: 'pos-ops', stepKind: 'approve' as const, minAmountPaise: 0, maxAmountPaise: 300000, alwaysRequired: false },
    { stepOrder: 3, positionId: 'pos-ops', stepKind: 'review' as const, minAmountPaise: 300001, maxAmountPaise: null, alwaysRequired: false },
    { stepOrder: 4, positionId: 'pos-mgmt', stepKind: 'approve' as const, minAmountPaise: 300001, maxAmountPaise: null, alwaysRequired: false },
  ];

  const approvalChains: ApprovalChain[] = [
    { id: 'ch-mr', requestType: 'material_request', name: 'Material Request Chain', antiSplitEnabled: true, antiSplitWindowDays: 7, escalationHours: 24, steps: standardSpendSteps },
    { id: 'ch-po', requestType: 'purchase_order', name: 'Purchase Order Chain', antiSplitEnabled: true, antiSplitWindowDays: 7, escalationHours: 24, steps: standardSpendSteps },
    { id: 'ch-pc', requestType: 'petty_cash', name: 'Petty Cash Chain', antiSplitEnabled: true, antiSplitWindowDays: 7, escalationHours: 24, steps: standardSpendSteps },
    { id: 'ch-sb', requestType: 'subcontractor_bill', name: 'Subcontractor Measured Bill Chain', antiSplitEnabled: false, antiSplitWindowDays: 7, escalationHours: 24, steps: standardSpendSteps },
    {
      id: 'ch-tc',
      requestType: 'task_completion',
      name: 'Task Completion Quality Check',
      antiSplitEnabled: false,
      antiSplitWindowDays: 7,
      escalationHours: 24,
      steps: [
        { stepOrder: 1, positionId: 'pos-coord', stepKind: 'approve', minAmountPaise: null, maxAmountPaise: null, alwaysRequired: true },
      ],
    },
    {
      id: 'ch-ew',
      requestType: 'extra_work',
      name: 'Extra Work Chain (Requires Client Written/OTP Proof)',
      antiSplitEnabled: false,
      antiSplitWindowDays: 7,
      escalationHours: 24,
      steps: [
        { stepOrder: 1, positionId: 'pos-coord', stepKind: 'technical_check', minAmountPaise: null, maxAmountPaise: null, alwaysRequired: true },
        { stepOrder: 2, positionId: 'pos-mgmt', stepKind: 'approve', minAmountPaise: null, maxAmountPaise: null, alwaysRequired: true },
      ],
    },
    {
      id: 'ch-pl',
      requestType: 'plan_change',
      name: 'Site Plan & Baseline Change Chain',
      antiSplitEnabled: false,
      antiSplitWindowDays: 7,
      escalationHours: 24,
      steps: [
        { stepOrder: 1, positionId: 'pos-mgmt', stepKind: 'approve', minAmountPaise: null, maxAmountPaise: null, alwaysRequired: true },
      ],
    },
    {
      id: 'ch-cb',
      requestType: 'client_bill',
      name: 'Client Invoice Chain (Ops Check -> Management)',
      antiSplitEnabled: false,
      antiSplitWindowDays: 7,
      escalationHours: 24,
      steps: [
        { stepOrder: 1, positionId: 'pos-ops', stepKind: 'review', minAmountPaise: null, maxAmountPaise: null, alwaysRequired: true },
        { stepOrder: 2, positionId: 'pos-mgmt', stepKind: 'approve', minAmountPaise: null, maxAmountPaise: null, alwaysRequired: true },
      ],
    },
  ];

  // 10 Own Workers (Concrete & Brick Crews — SPEC Sections 4.7 & 6)
  const workers: Worker[] = [
    { id: 'wrk-1', code: 'WRK-01', fullName: 'Own Crew Worker 01 (Head Mason)', phone: '+91 97450 20001', trade: 'mason', crewName: 'Own Concrete Crew A', dailyWagePaise: 150000, joiningDate: '2025-04-10', advanceBalancePaise: 300000 },
    { id: 'wrk-2', code: 'WRK-02', fullName: 'Own Crew Worker 02 (Concrete)', phone: '+91 97450 20002', trade: 'concrete_worker', crewName: 'Own Concrete Crew A', dailyWagePaise: 135000, joiningDate: '2025-05-01', advanceBalancePaise: 150000 },
    { id: 'wrk-3', code: 'WRK-03', fullName: 'Own Crew Worker 03 (Helper)', phone: '+91 97450 20003', trade: 'helper', crewName: 'Own Concrete Crew A', dailyWagePaise: 120000, joiningDate: '2025-05-12', advanceBalancePaise: 0 },
    { id: 'wrk-4', code: 'WRK-04', fullName: 'Own Crew Worker 04 (Bar Bender)', phone: '+91 97450 20004', trade: 'bar_bender', crewName: 'Own Concrete Crew B', dailyWagePaise: 145000, joiningDate: '2025-06-01', advanceBalancePaise: 200000 },
    { id: 'wrk-5', code: 'WRK-05', fullName: 'Own Crew Worker 05 (Carpenter)', phone: '+91 97450 20005', trade: 'carpenter', crewName: 'Own Concrete Crew B', dailyWagePaise: 150000, joiningDate: '2025-06-15', advanceBalancePaise: 0 },
    { id: 'wrk-6', code: 'WRK-06', fullName: 'Own Crew Worker 06 (Concrete)', phone: '+91 97450 20006', trade: 'concrete_worker', crewName: 'Own Concrete Crew B', dailyWagePaise: 135000, joiningDate: '2025-07-01', advanceBalancePaise: 100000 },
    { id: 'wrk-7', code: 'WRK-07', fullName: 'Own Crew Worker 07 (Laterite Mason)', phone: '+91 97450 20007', trade: 'brick_worker', crewName: 'Own Brick Crew A', dailyWagePaise: 150000, joiningDate: '2025-04-20', advanceBalancePaise: 250000 },
    { id: 'wrk-8', code: 'WRK-08', fullName: 'Own Crew Worker 08 (Brick Mason)', phone: '+91 97450 20008', trade: 'brick_worker', crewName: 'Own Brick Crew A', dailyWagePaise: 150000, joiningDate: '2025-08-05', advanceBalancePaise: 0 },
    { id: 'wrk-9', code: 'WRK-09', fullName: 'Own Crew Worker 09 (Helper)', phone: '+91 97450 20009', trade: 'helper', crewName: 'Own Brick Crew A', dailyWagePaise: 120000, joiningDate: '2025-08-19', advanceBalancePaise: 50000 },
    { id: 'wrk-10', code: 'WRK-10', fullName: 'Own Crew Worker 10 (Helper)', phone: '+91 97450 20010', trade: 'helper', crewName: 'Own Brick Crew A', dailyWagePaise: 120000, joiningDate: '2025-09-01', advanceBalancePaise: 0 },
  ];

  // 5 Subcontractors (SPEC Sections 4.8 & 6)
  const subcontractors: Subcontractor[] = [
    { id: 'sub-1', code: 'SUB-01', name: 'Nila MEP & Electrical Works', trade: 'Electrical & Conduit', pan: 'ABCPN1234F', gstin: '32ABCPN1234F1Z2', tdsRatePct: 1 },
    { id: 'sub-2', code: 'SUB-02', name: 'Kaveri Plumbing & Waterproofing LLP', trade: 'Plumbing & Waterproofing', pan: 'AAEFK5678G', gstin: '32AAEFK5678G1Z9', tdsRatePct: 2 },
    { id: 'sub-3', code: 'SUB-03', name: 'Vembanad Structural Fabrication Co', trade: 'Structural Steel & Roof Truss', pan: 'AAACV9012H', gstin: '32AAACV9012H1Z5', tdsRatePct: 2 },
    { id: 'sub-4', code: 'SUB-04', name: 'Malabar Plastering & Tile Crafts', trade: 'Flooring & Plastering', pan: 'ABCPM3456J', gstin: '32ABCPM3456J1Z1', tdsRatePct: 1 },
    { id: 'sub-5', code: 'SUB-05', name: 'Greenhill Earthmovers & Piling', trade: 'Excavation & Piling', pan: 'AAACG7890K', gstin: '32AAACG7890K1Z8', tdsRatePct: 2 },
  ];

  // Seed 30 days of realistic Daily Reports across the 4 sites (SPEC Section 6)
  const dailyReports: DailyReport[] = [];
  for (let d = 29; d >= 0; d--) {
    const repDate = shiftDays(today, -d);
    for (const site of sites) {
      const supId = site.supervisorIds[0];
      // Today: leave Wayanad afternoon/evening open & Talikulam evening open so Management Dashboard shows real live action items!
      const isToday = d === 0;
      if (isToday && site.id === 'site-talikulam') {
        dailyReports.push({
          id: `dpr-${site.id}-${repDate}`,
          siteId: site.id,
          reportDate: repDate,
          status: 'morning_done',
          checkins: {
            morning: {
              slot: 'morning',
              checkedInBy: supId,
              capturedAt: `${repDate}T08:32:00+05:30`,
              lat: site.lat + 0.0002,
              lng: site.lng + 0.0001,
              accuracyM: 11.2,
              distanceFromSiteM: 24.8,
              isLowAccuracy: false,
              photos: [
                {
                  id: `ph-${site.id}-${repDate}-m1`,
                  slot: 'morning',
                  dataUrl: makePlaceholderPhotoSvg(site.name, 'morning', repDate, site.lat, site.lng),
                  caption: 'Cottage Block B rebar cages ready',
                  capturedAt: `${repDate}T08:33:00+05:30`,
                  lat: site.lat,
                  lng: site.lng,
                  accuracyM: 11.2,
                },
              ],
            },
          },
          ownWorkerAttendances: [
            { workerId: 'wrk-1', status: 'present' },
            { workerId: 'wrk-2', status: 'present' },
            { workerId: 'wrk-3', status: 'present' },
          ],
          subcontractorCounts: [{ trade: 'Plumbing & Waterproofing', headcount: 4 }],
          activities: [{ title: 'First-floor Slab Shuttering & Rebar', completedQty: 0, unit: 'm2', completedPct: 65 }],
          materialsUsed: [],
          issues: [
            {
              id: `iss-urgent-tali`,
              category: 'drawing',
              description: 'Staircase structural beam detailing awaiting architect revision; pour on hold.',
              isUrgent: true,
              resolved: false,
            },
          ],
          tomorrowPlan: '',
        });
        continue;
      }

      if (isToday && site.id === 'site-wayanad') {
        // Not checked in yet today -> shows Missing Check-In alert on Management Dashboard!
        continue;
      }

      dailyReports.push({
        id: `dpr-${site.id}-${repDate}`,
        siteId: site.id,
        reportDate: repDate,
        status: 'closed',
        checkins: {
          morning: {
            slot: 'morning',
            checkedInBy: supId,
            capturedAt: `${repDate}T08:25:00+05:30`,
            lat: site.lat + 0.0001,
            lng: site.lng + 0.0001,
            accuracyM: 9.4,
            distanceFromSiteM: 15.6,
            isLowAccuracy: false,
            photos: [
              {
                id: `ph-${site.id}-${repDate}-m`,
                slot: 'morning',
                dataUrl: makePlaceholderPhotoSvg(site.name, 'morning', repDate, site.lat, site.lng),
                caption: 'Morning crew muster & material yard',
                capturedAt: `${repDate}T08:25:00+05:30`,
                lat: site.lat,
                lng: site.lng,
                accuracyM: 9.4,
              },
            ],
          },
          afternoon: {
            slot: 'afternoon',
            checkedInBy: supId,
            capturedAt: `${repDate}T13:10:00+05:30`,
            lat: site.lat + 0.00015,
            lng: site.lng - 0.0001,
            accuracyM: 10.8,
            distanceFromSiteM: 19.2,
            isLowAccuracy: false,
            photos: [1, 2, 3].map((n) => ({
              id: `ph-${site.id}-${repDate}-a${n}`,
              slot: 'afternoon' as const,
              dataUrl: makePlaceholderPhotoSvg(site.name, `afternoon #${n}`, repDate, site.lat, site.lng),
              caption: `Mid-day work progress view ${n}`,
              capturedAt: `${repDate}T13:1${n}:00+05:30`,
              lat: site.lat,
              lng: site.lng,
              accuracyM: 10.8,
            })),
          },
          evening: {
            slot: 'evening',
            checkedInBy: supId,
            capturedAt: `${repDate}T17:40:00+05:30`,
            lat: site.lat - 0.0001,
            lng: site.lng + 0.0001,
            accuracyM: 8.9,
            distanceFromSiteM: 14.1,
            isLowAccuracy: false,
            photos: [1, 2, 3].map((n) => ({
              id: `ph-${site.id}-${repDate}-e${n}`,
              slot: 'evening' as const,
              dataUrl: makePlaceholderPhotoSvg(site.name, `evening #${n}`, repDate, site.lat, site.lng),
              caption: `Completed evening progress ${n}`,
              capturedAt: `${repDate}T17:4${n}:00+05:30`,
              lat: site.lat,
              lng: site.lng,
              accuracyM: 8.9,
            })),
          },
        },
        ownWorkerAttendances:
          site.id === 'site-hadi'
            ? [
                { workerId: 'wrk-7', status: 'present' },
                { workerId: 'wrk-8', status: 'present' },
                { workerId: 'wrk-9', status: 'present' },
              ]
            : [
                { workerId: 'wrk-4', status: 'present' },
                { workerId: 'wrk-5', status: 'present' },
                { workerId: 'wrk-6', status: 'half_day' },
              ],
        subcontractorCounts: [{ trade: 'Electrical & Conduit', headcount: 3 }],
        activities: [
          {
            title: site.projectType === 'residential' ? 'Laterite Superstructure Masonry' : 'RCC Column & Plinth Beam Pour',
            completedQty: site.projectType === 'residential' ? 140 : 6.5,
            unit: site.projectType === 'residential' ? 'nos' : 'm3',
            completedPct: Math.min(100, (30 - d) * 3),
          },
        ],
        materialsUsed: d < 5 ? [{ itemId: 'itm-cement', qtyUsed: 8 }] : [],
        issues: [],
        tomorrowPlan: 'Continue scheduled shuttering alignment, curing, and bar bending inspection.',
      });
    }
  }

  // BOQ Rate Sheets & 1 BOQ per Site (SPEC Sections 4.2 & 6)
  const baseResidentialRates: RateSheet = {
    cementBagPaise: 39500,
    mSandCftPaise: 5800,
    agg20mmCftPaise: 4600,
    steelKgPaise: 6800,
    rmcM25M3Paise: 560000,
    rmcM30M3Paise: 610000,
    masonDayPaise: 150000,
    helperDayPaise: 120000,
    carpenterDayPaise: 150000,
    barBenderDayPaise: 145000,
    shutteringSqmPaise: 32000,
    stagingSqmPaise: 18000,
    mixerDayPaise: 250000,
    lateriteStonePaise: 3800,
    floorHeightM: 3.3,
    wastagePct: 3,
    profitPct: 15,
  };

  const baseCommercialRates: RateSheet = {
    ...baseResidentialRates,
    floorHeightM: 4.5,
    stagingSqmPaise: 26000,
    profitPct: 16,
  };

  const boqVersions: BoqVersion[] = sites.map((s) => {
    const isRes = s.projectType === 'residential';
    const rs = isRes ? baseResidentialRates : baseCommercialRates;
    const rows = [
      {
        id: `boq-${s.id}-1`,
        stageName: 'Stage 1 — RCC Footing & Neck Column',
        workType: 'footing',
        concreteGrade: 'M25',
        concreteM3: isRes ? 18 : 65,
        formworkM2: isRes ? 42 : 160,
        steelKg: isRes ? 1650 : 6400,
        stagingM2: 0,
        masonryQty: 0,
        pourDays: isRes ? 2 : 5,
      },
      {
        id: `boq-${s.id}-2`,
        stageName: 'Stage 2 — Plinth Beam & Columns',
        workType: 'column',
        concreteGrade: isRes ? 'M25' : 'M30',
        concreteM3: isRes ? 14 : 58,
        formworkM2: isRes ? 85 : 310,
        steelKg: isRes ? 1900 : 7800,
        stagingM2: isRes ? 30 : 140,
        masonryQty: 0,
        pourDays: isRes ? 3 : 6,
      },
      {
        id: `boq-${s.id}-3`,
        stageName: isRes ? 'Stage 3 — Laterite Masonry & Lintel' : 'Stage 3 — First Floor Beam & Slab',
        workType: isRes ? 'laterite_masonry' : 'slab',
        concreteGrade: isRes ? 'M25' : 'M30',
        concreteM3: isRes ? 22 : 95,
        formworkM2: isRes ? 110 : 480,
        steelKg: isRes ? 2400 : 11200,
        stagingM2: isRes ? 110 : 480,
        masonryQty: isRes ? 4200 : 0,
        pourDays: isRes ? 4 : 8,
      },
    ].map((r) => {
      const rmcRate = r.concreteGrade === 'M30' ? rs.rmcM30M3Paise : rs.rmcM25M3Paise;
      const materialCostPaise = Math.round(r.concreteM3 * rmcRate + r.masonryQty * rs.lateriteStonePaise);
      const labourCostPaise = Math.round(r.pourDays * 4 * (rs.masonDayPaise + rs.helperDayPaise));
      const formworkCostPaise = Math.round(r.formworkM2 * rs.shutteringSqmPaise);
      const rentCostPaise = Math.round(r.stagingM2 * rs.stagingSqmPaise + r.pourDays * rs.mixerDayPaise);
      const steelCostPaise = Math.round(r.steelKg * rs.steelKgPaise);
      const totalCostPaise = materialCostPaise + labourCostPaise + formworkCostPaise + rentCostPaise + steelCostPaise;
      const quotedAmountPaise = Math.round(totalCostPaise * (1 + rs.profitPct / 100));
      return {
        ...r,
        materialCostPaise,
        labourCostPaise,
        formworkCostPaise,
        rentCostPaise,
        steelCostPaise,
        totalCostPaise,
        quotedAmountPaise,
      };
    });

    const totalCostPaise = rows.reduce((a, b) => a + b.totalCostPaise, 0);
    const quotedTotalPaise = rows.reduce((a, b) => a + b.quotedAmountPaise, 0);
    const roundedTotalPaise = Math.round(quotedTotalPaise / 100000) * 100000; // Nearest ₹1,000

    return {
      id: `boqv-${s.id}-v1`,
      siteId: s.id,
      versionNo: 1,
      projectType: s.projectType,
      builtUpAreaSqft: isRes ? 1450 : 9200,
      isLocked: true,
      status: 'approved_locked',
      rateSheet: rs,
      items: rows,
      totalCostPaise,
      quotedTotalPaise,
      roundedTotalPaise,
    };
  });

  // Site Schedule Activities + Intentional Alerts (Material needed in 5d, Drawing due in 7d, Crew Clash!)
  const planActivities: PlanActivity[] = [
    {
      id: 'act-hadi-1',
      siteId: 'site-hadi',
      code: 'A10',
      name: 'Footing & Plinth Beam',
      quantity: 32,
      unit: 'm3',
      dailyOutput: 4,
      durationDays: 8,
      predecessorIds: [],
      baselineStart: shiftDays(today, -30),
      baselineEnd: shiftDays(today, -22),
      plannedStart: shiftDays(today, -30),
      plannedEnd: shiftDays(today, -22),
      completedQty: 32,
      progressPct: 100,
      crewName: 'Own Concrete Crew A',
      crewType: 'own_concrete',
    },
    {
      id: 'act-hadi-2',
      siteId: 'site-hadi',
      code: 'A20',
      name: 'Laterite Bedroom Superstructure',
      quantity: 4200,
      unit: 'nos',
      dailyOutput: 300,
      durationDays: 14,
      predecessorIds: ['act-hadi-1'],
      baselineStart: shiftDays(today, -10),
      baselineEnd: shiftDays(today, 4),
      plannedStart: shiftDays(today, -10),
      plannedEnd: shiftDays(today, 4),
      completedQty: 3150,
      progressPct: 75,
      crewName: 'Own Brick Crew A',
      crewType: 'own_brick',
    },
    {
      id: 'act-tali-1',
      siteId: 'site-talikulam',
      code: 'T10',
      name: 'Resort Cottage Cluster Columns',
      quantity: 58,
      unit: 'm3',
      dailyOutput: 5,
      durationDays: 12,
      predecessorIds: [],
      baselineStart: shiftDays(today, -25),
      baselineEnd: shiftDays(today, -13),
      plannedStart: shiftDays(today, -25),
      plannedEnd: shiftDays(today, -9),
      completedQty: 58,
      progressPct: 100,
      crewName: 'Own Concrete Crew A',
      crewType: 'own_concrete',
    },
    {
      id: 'act-tali-2',
      siteId: 'site-talikulam',
      code: 'T20',
      name: 'First-Floor Slab & Coastal Staircase',
      quantity: 95,
      unit: 'm3',
      dailyOutput: 6,
      durationDays: 16,
      predecessorIds: ['act-tali-1'],
      baselineStart: shiftDays(today, -8),
      baselineEnd: shiftDays(today, 8),
      plannedStart: shiftDays(today, -4),
      plannedEnd: shiftDays(today, 12),
      completedQty: 24,
      progressPct: 25,
      crewName: 'Own Concrete Crew A',
      crewType: 'own_concrete',
      materialNeededItemId: 'itm-steel',
      materialNeededBy: shiftDays(today, 5), // Alert: Steel needed in 5 days!
      drawingTitle: 'Staircase Structural Beam Detailing S-204',
      drawingConsultant: 'Ar. Menon & Structural Associates',
      drawingDueDate: shiftDays(today, 6), // Alert: Drawing due in < 7 days not received!
      drawingReceived: false,
    },
    {
      id: 'act-waya-1',
      siteId: 'site-wayanad',
      code: 'W10',
      name: 'Hillside Retaining Wall & Deck Slab',
      quantity: 80,
      unit: 'm3',
      dailyOutput: 5,
      durationDays: 16,
      predecessorIds: [],
      baselineStart: shiftDays(today, -2),
      baselineEnd: shiftDays(today, 14),
      plannedStart: shiftDays(today, 0),
      plannedEnd: shiftDays(today, 16),
      completedQty: 18,
      progressPct: 22,
      crewName: 'Own Concrete Crew A', // Intentional crew clash with Talikulam on Own Concrete Crew A!
      crewType: 'own_concrete',
    },
    {
      id: 'act-tkm-1',
      siteId: 'site-tkm',
      code: 'K10',
      name: 'Industrial High-Bay Pedestal & Truss',
      quantity: 70,
      unit: 'm3',
      dailyOutput: 7,
      durationDays: 10,
      predecessorIds: [],
      baselineStart: shiftDays(today, -6),
      baselineEnd: shiftDays(today, 4),
      plannedStart: shiftDays(today, -6),
      plannedEnd: shiftDays(today, 4),
      completedQty: 52,
      progressPct: 74,
      crewName: 'Own Concrete Crew B',
      crewType: 'own_concrete',
    },
  ];

  // Historical Approved POs (so Last 3 Rates displays immediately when creating a PO!)
  const purchaseOrders: PurchaseOrder[] = [
    {
      id: 'po-1',
      poNumber: 'PO/2026-27/0001',
      siteId: 'site-hadi',
      vendorId: 'vnd-1',
      poDate: shiftDays(today, -28),
      deliveryDate: shiftDays(today, -25),
      itemId: 'itm-cement',
      qtyOrdered: 200,
      qtyReceived: 200,
      ratePaise: 39000,
      gstRatePct: 28,
      subtotalPaise: 7800000,
      gstPaise: 2184000,
      totalPaise: 9984000,
      status: 'received',
      approvalRequestId: 'apr-hist-1',
    },
    {
      id: 'po-2',
      poNumber: 'PO/2026-27/0002',
      siteId: 'site-talikulam',
      vendorId: 'vnd-1',
      poDate: shiftDays(today, -18),
      deliveryDate: shiftDays(today, -15),
      itemId: 'itm-cement',
      qtyOrdered: 350,
      qtyReceived: 350,
      ratePaise: 39500,
      gstRatePct: 28,
      subtotalPaise: 13825000,
      gstPaise: 3871000,
      totalPaise: 17696000,
      status: 'received',
      approvalRequestId: 'apr-hist-2',
    },
    {
      id: 'po-3',
      poNumber: 'PO/2026-27/0003',
      siteId: 'site-tkm',
      vendorId: 'vnd-1',
      poDate: shiftDays(today, -9),
      deliveryDate: shiftDays(today, -7),
      itemId: 'itm-cement',
      qtyOrdered: 300,
      qtyReceived: 300,
      ratePaise: 40000,
      gstRatePct: 28,
      subtotalPaise: 12000000,
      gstPaise: 3360000,
      totalPaise: 15360000,
      status: 'received',
      approvalRequestId: 'apr-hist-3',
    },
    {
      id: 'po-4',
      poNumber: 'PO/2026-27/0004',
      siteId: 'site-talikulam',
      vendorId: 'vnd-3',
      poDate: shiftDays(today, -14),
      deliveryDate: shiftDays(today, -10),
      itemId: 'itm-steel',
      qtyOrdered: 4000,
      qtyReceived: 4000,
      ratePaise: 6750,
      gstRatePct: 18,
      subtotalPaise: 27000000,
      gstPaise: 4860000,
      totalPaise: 31860000,
      status: 'received',
      approvalRequestId: 'apr-hist-4',
    },
  ];

  const goodsReceipts: GoodsReceipt[] = purchaseOrders.map((po, idx) => ({
    id: `grn-${idx + 1}`,
    grnNumber: `GRN/2026-27/000${idx + 1}`,
    siteId: po.siteId,
    purchaseOrderId: po.id,
    vendorId: po.vendorId,
    itemId: po.itemId,
    qtyReceived: po.qtyOrdered,
    challanNo: `DC-${1040 + idx}`,
    challanPhotoDataUrl: makePlaceholderPhotoSvg(po.siteId, 'CHALLAN', po.deliveryDate, 10.52, 76.21),
    receivedBy: 'usr-sup-1',
    receivedAt: `${po.deliveryDate}T11:20:00+05:30`,
  }));

  const approvalRequests: ApprovalRequest[] = [
    {
      id: 'apr-live-1',
      requestNumber: 'APR/2026-27/0011',
      requestType: 'petty_cash',
      siteId: 'site-hadi',
      sourceTable: 'petty_cash_entries',
      sourceId: 'pc-1',
      antiSplitItemId: 'itm-wire',
      amountPaise: 240000, // ₹2,400 (<= ₹3,000 -> Ops Executive can final approve after Coordinator check)
      rolling7dAmountPaise: 240000,
      status: 'pending',
      currentStepOrder: 2,
      currentPositionId: 'pos-ops',
      requestedBy: 'usr-sup-1',
      submittedAt: `${shiftDays(today, -1)}T10:15:00+05:30`,
      stepStartedAt: `${shiftDays(today, -1)}T11:00:00+05:30`,
      escalationLevel: 0,
      title: 'Binding Wire & Cutting Discs Urgent Site Petty Cash',
      details: '25 kg binding wire + 10 cutting discs for Hadi Bedroom lintel bar bending',
      attachmentLabel: 'quotation_slip_hadi.jpg',
      actions: [
        {
          stepOrder: 1,
          action: 'technical_ok',
          actorUserId: 'usr-coord-1',
          actorPositionId: 'pos-coord',
          comment: 'Verified against Stage 3 lintel bar schedule.',
          createdAt: `${shiftDays(today, -1)}T11:00:00+05:30`,
        },
      ],
    },
    {
      id: 'apr-live-2',
      requestNumber: 'APR/2026-27/0012',
      requestType: 'purchase_order',
      siteId: 'site-talikulam',
      sourceTable: 'purchase_orders',
      sourceId: 'po-pending-5',
      antiSplitItemId: 'itm-steel',
      amountPaise: 41300000, // ₹4,13,000 (> ₹3,000 -> Needs Management final approval)
      rolling7dAmountPaise: 41300000,
      status: 'pending',
      currentStepOrder: 4,
      currentPositionId: 'pos-mgmt',
      requestedBy: 'usr-ops-1',
      submittedAt: `${shiftDays(today, -2)}T09:30:00+05:30`,
      stepStartedAt: `${shiftDays(today, -1)}T08:00:00+05:30`,
      escalationLevel: 0,
      title: 'PO for 5,000 kg Fe550D TMT Steel — Talikulam First-Floor Slab',
      details: 'Kerala Steels & Alloys @ ₹68/kg + 18% GST for Cottage Cluster Slab T20',
      attachmentLabel: 'vendor_quote_kerala_steels.pdf',
      actions: [
        {
          stepOrder: 1,
          action: 'technical_ok',
          actorUserId: 'usr-coord-1',
          actorPositionId: 'pos-coord',
          comment: 'Matches BOQ Stage 3 slab steel requirement.',
          createdAt: `${shiftDays(today, -2)}T14:10:00+05:30`,
        },
        {
          stepOrder: 3,
          action: 'review_ok',
          actorUserId: 'usr-ops-1',
          actorPositionId: 'pos-ops',
          comment: 'Compared last 3 PO rates (₹67.50/kg); best delivery lead time.',
          createdAt: `${shiftDays(today, -1)}T08:00:00+05:30`,
        },
      ],
    },
  ];

  const materialRequests: MaterialRequest[] = [
    {
      id: 'mr-1',
      mrNumber: 'MR/2026-27/0001',
      siteId: 'site-talikulam',
      requestedBy: 'usr-sup-1',
      neededByDate: shiftDays(today, 5),
      planActivityTitle: 'First-Floor Slab & Coastal Staircase',
      itemId: 'itm-steel',
      qty: 5000,
      estimatedAmountPaise: 34000000,
      status: 'approved',
      approvalRequestId: 'apr-live-2',
    },
  ];

  // Chart of Accounts Ledgers (Indian Standard Groups — SPEC Section 4.10)
  const ledgers: LedgerAccount[] = [
    { id: 'ldg-cap', code: '1001', name: 'Partners Capital Account', groupName: 'Capital Account', nature: 'equity', isDirect: false, openingBalancePaise: 500000000, openingDrCr: 'CR' },
    { id: 'ldg-hdfc', code: '2001', name: 'HDFC Bank Current A/c - Thrissur', groupName: 'Bank Accounts', nature: 'assets', isDirect: false, openingBalancePaise: 425000000, openingDrCr: 'DR' },
    { id: 'ldg-fed', code: '2002', name: 'Federal Bank OD/Current A/c', groupName: 'Bank Accounts', nature: 'assets', isDirect: false, openingBalancePaise: 185000000, openingDrCr: 'DR' },
    { id: 'ldg-cash', code: '2010', name: 'Site & Head Office Petty Cash', groupName: 'Cash-in-Hand', nature: 'assets', isDirect: false, openingBalancePaise: 15000000, openingDrCr: 'DR' },
    { id: 'ldg-ar', code: '2100', name: 'Sundry Debtors — Project Clients', groupName: 'Sundry Debtors', nature: 'assets', isDirect: false, openingBalancePaise: 120000000, openingDrCr: 'DR' },
    { id: 'ldg-fa', code: '2200', name: 'Tipper Lorry & Site Machinery (Fixed Assets)', groupName: 'Fixed Assets', nature: 'assets', isDirect: false, openingBalancePaise: 320000000, openingDrCr: 'DR' },
    { id: 'ldg-ap', code: '3100', name: 'Sundry Creditors — Material Vendors & Subcon', groupName: 'Sundry Creditors', nature: 'liabilities', isDirect: false, openingBalancePaise: 95000000, openingDrCr: 'CR' },
    { id: 'ldg-loan', code: '3200', name: 'BharatBenz Tipper Vehicle Loan', groupName: 'Loans (Liability)', nature: 'liabilities', isDirect: false, openingBalancePaise: 210000000, openingDrCr: 'CR' },
    { id: 'ldg-gst-in', code: '3301', name: 'Input GST Credit (CGST + SGST / IGST)', groupName: 'Duties & Taxes', nature: 'assets', isDirect: false, openingBalancePaise: 0, openingDrCr: 'DR' },
    { id: 'ldg-gst-out', code: '3302', name: 'Output GST Payable', groupName: 'Duties & Taxes', nature: 'liabilities', isDirect: false, openingBalancePaise: 0, openingDrCr: 'CR' },
    { id: 'ldg-tds', code: '3303', name: 'TDS Payable (194C / 194J)', groupName: 'Duties & Taxes', nature: 'liabilities', isDirect: false, openingBalancePaise: 0, openingDrCr: 'CR' },
    { id: 'ldg-ret', code: '3304', name: 'Subcontractor Retention Held', groupName: 'Current Liabilities', nature: 'liabilities', isDirect: false, openingBalancePaise: 0, openingDrCr: 'CR' },
    { id: 'ldg-rev', code: '4001', name: 'Contract Billing & PMC Fee Revenue', groupName: 'Direct Income', nature: 'income', isDirect: true, openingBalancePaise: 0, openingDrCr: 'CR' },
    { id: 'ldg-mat-exp', code: '5001', name: 'Site Material Consumption & Purchases', groupName: 'Direct Expenses', nature: 'expenses', isDirect: true, openingBalancePaise: 0, openingDrCr: 'DR' },
    { id: 'ldg-lab-exp', code: '5002', name: 'Site Own Crew Wages', groupName: 'Direct Expenses', nature: 'expenses', isDirect: true, openingBalancePaise: 0, openingDrCr: 'DR' },
    { id: 'ldg-sub-exp', code: '5003', name: 'Subcontractor Measured Work Cost', groupName: 'Direct Expenses', nature: 'expenses', isDirect: true, openingBalancePaise: 0, openingDrCr: 'DR' },
    { id: 'ldg-ho-exp', code: '6001', name: 'Head Office Rent, Salaries & Software Overheads', groupName: 'Indirect Expenses', nature: 'expenses', isDirect: false, openingBalancePaise: 0, openingDrCr: 'DR' },
  ];

  // Balanced Double-Entry Vouchers (Posted + Pending Posting Auto-Queue!)
  const vouchers: Voucher[] = [
    {
      id: 'vch-1',
      voucherNo: 'FY26-27/SLS/0001',
      financialYear: '2026-27',
      voucherType: 'sales',
      voucherDate: shiftDays(today, -20),
      status: 'posted',
      sourceLabel: 'RA Bill #1 — Hadi Bedroom',
      narration: 'RA Bill 01 certified for Hadi Bedroom RCC Foundation & Plinth',
      lines: [
        { ledgerId: 'ldg-ar', costCentreSiteId: 'site-hadi', drCr: 'DR', amountPaise: 141600000 },
        { ledgerId: 'ldg-rev', costCentreSiteId: 'site-hadi', drCr: 'CR', amountPaise: 120000000 },
        { ledgerId: 'ldg-gst-out', costCentreSiteId: 'site-hadi', drCr: 'CR', amountPaise: 21600000 },
      ],
      totalDrPaise: 141600000,
      totalCrPaise: 141600000,
      gstOutputPaise: 21600000,
      preparedBy: 'usr-jr-acc',
      postedBy: 'usr-acc-head',
    },
    {
      id: 'vch-2',
      voucherNo: 'FY26-27/SLS/0002',
      financialYear: '2026-27',
      voucherType: 'sales',
      voucherDate: shiftDays(today, -15),
      status: 'posted',
      sourceLabel: 'RA Bill #1 — Talikulam Resort',
      narration: 'RA Bill 01 certified for Talikulam Resort Cottage Foundations',
      lines: [
        { ledgerId: 'ldg-ar', costCentreSiteId: 'site-talikulam', drCr: 'DR', amountPaise: 413000000 },
        { ledgerId: 'ldg-rev', costCentreSiteId: 'site-talikulam', drCr: 'CR', amountPaise: 350000000 },
        { ledgerId: 'ldg-gst-out', costCentreSiteId: 'site-talikulam', drCr: 'CR', amountPaise: 63000000 },
      ],
      totalDrPaise: 413000000,
      totalCrPaise: 413000000,
      gstOutputPaise: 63000000,
      preparedBy: 'usr-jr-acc',
      postedBy: 'usr-acc-head',
    },
    {
      id: 'vch-3',
      voucherNo: 'FY26-27/SLS/0003',
      financialYear: '2026-27',
      voucherType: 'sales',
      voucherDate: shiftDays(today, -10),
      status: 'posted',
      sourceLabel: 'PMC Fee Bill #1 (12%) — Wayanad Resort',
      narration: '12% PMC Fee on ₹85,00,000 actual certified cost at Wayanad Resort',
      lines: [
        { ledgerId: 'ldg-ar', costCentreSiteId: 'site-wayanad', drCr: 'DR', amountPaise: 120360000 },
        { ledgerId: 'ldg-rev', costCentreSiteId: 'site-wayanad', drCr: 'CR', amountPaise: 102000000 },
        { ledgerId: 'ldg-gst-out', costCentreSiteId: 'site-wayanad', drCr: 'CR', amountPaise: 18360000 },
      ],
      totalDrPaise: 120360000,
      totalCrPaise: 120360000,
      gstOutputPaise: 18360000,
      preparedBy: 'usr-acc-head',
      postedBy: 'usr-acc-head',
    },
    {
      id: 'vch-4',
      voucherNo: 'FY26-27/PUR/0001',
      financialYear: '2026-27',
      voucherType: 'purchase',
      voucherDate: shiftDays(today, -12),
      status: 'posted',
      sourceLabel: 'PO/2026-27/0002 & 0004 — Talikulam Materials',
      narration: 'Cement & TMT Steel purchase bills for Talikulam Resort',
      lines: [
        { ledgerId: 'ldg-mat-exp', costCentreSiteId: 'site-talikulam', drCr: 'DR', amountPaise: 195000000 },
        { ledgerId: 'ldg-gst-in', costCentreSiteId: 'site-talikulam', drCr: 'DR', amountPaise: 35100000 },
        { ledgerId: 'ldg-ap', costCentreSiteId: 'site-talikulam', drCr: 'CR', amountPaise: 230100000 },
      ],
      totalDrPaise: 230100000,
      totalCrPaise: 230100000,
      gstInputPaise: 35100000,
      preparedBy: 'usr-jr-acc',
      postedBy: 'usr-acc-head',
    },
    {
      id: 'vch-5',
      voucherNo: 'FY26-27/PUR/0002',
      financialYear: '2026-27',
      voucherType: 'purchase',
      voucherDate: shiftDays(today, -16),
      status: 'posted',
      sourceLabel: 'PO/2026-27/0001 — Hadi Bedroom Materials',
      narration: 'Cement, M-Sand & Laterite bills for Hadi Bedroom',
      lines: [
        { ledgerId: 'ldg-mat-exp', costCentreSiteId: 'site-hadi', drCr: 'DR', amountPaise: 62000000 },
        { ledgerId: 'ldg-gst-in', costCentreSiteId: 'site-hadi', drCr: 'DR', amountPaise: 11160000 },
        { ledgerId: 'ldg-ap', costCentreSiteId: 'site-hadi', drCr: 'CR', amountPaise: 73160000 },
      ],
      totalDrPaise: 73160000,
      totalCrPaise: 73160000,
      gstInputPaise: 11160000,
      preparedBy: 'usr-jr-acc',
      postedBy: 'usr-acc-head',
    },
    {
      id: 'vch-6',
      voucherNo: 'FY26-27/PMT/0001',
      financialYear: '2026-27',
      voucherType: 'payment',
      voucherDate: shiftDays(today, -7),
      status: 'posted',
      sourceLabel: 'Weekly Own Crew Wages',
      narration: 'Own crew concrete & brick weekly wage payout via HDFC NEFT',
      lines: [
        { ledgerId: 'ldg-lab-exp', costCentreSiteId: 'site-hadi', drCr: 'DR', amountPaise: 18500000 },
        { ledgerId: 'ldg-lab-exp', costCentreSiteId: 'site-talikulam', drCr: 'DR', amountPaise: 34000000 },
        { ledgerId: 'ldg-lab-exp', costCentreSiteId: 'site-wayanad', drCr: 'DR', amountPaise: 22000000 },
        { ledgerId: 'ldg-hdfc', costCentreSiteId: 'HEAD_OFFICE', drCr: 'CR', amountPaise: 74500000 },
      ],
      totalDrPaise: 74500000,
      totalCrPaise: 74500000,
      preparedBy: 'usr-jr-acc',
      postedBy: 'usr-acc-head',
    },
    {
      id: 'vch-7',
      voucherNo: 'FY26-27/RCT/0001',
      financialYear: '2026-27',
      voucherType: 'receipt',
      voucherDate: shiftDays(today, -6),
      status: 'posted',
      sourceLabel: 'Client RTGS Receipt — Hadi Bedroom',
      narration: 'Part receipt against RA Bill #1 via HDFC RTGS UTR HDFCR520261025',
      lines: [
        { ledgerId: 'ldg-hdfc', costCentreSiteId: 'site-hadi', drCr: 'DR', amountPaise: 110000000 },
        { ledgerId: 'ldg-ar', costCentreSiteId: 'site-hadi', drCr: 'CR', amountPaise: 110000000 },
      ],
      totalDrPaise: 110000000,
      totalCrPaise: 110000000,
      preparedBy: 'usr-jr-acc',
      postedBy: 'usr-acc-head',
    },
    {
      id: 'vch-8',
      voucherNo: 'FY26-27/JRN/0001',
      financialYear: '2026-27',
      voucherType: 'journal',
      voucherDate: shiftDays(today, -2),
      status: 'pending_posting',
      sourceLabel: 'Auto-Posted: Subcontractor Bill SUB-B01 (194C TDS + 5% Retention)',
      narration: 'Kaveri Plumbing Measured Bill #1 at Talikulam Resort (Awaiting Accounts Head Post)',
      lines: [
        { ledgerId: 'ldg-sub-exp', costCentreSiteId: 'site-talikulam', drCr: 'DR', amountPaise: 45000000 },
        { ledgerId: 'ldg-ret', costCentreSiteId: 'site-talikulam', drCr: 'CR', amountPaise: 2250000 },
        { ledgerId: 'ldg-tds', costCentreSiteId: 'site-talikulam', drCr: 'CR', amountPaise: 900000 },
        { ledgerId: 'ldg-ap', costCentreSiteId: 'site-talikulam', drCr: 'CR', amountPaise: 41850000 },
      ],
      totalDrPaise: 45000000,
      totalCrPaise: 45000000,
      tdsSection: '194C',
      tdsPaise: 900000,
      preparedBy: 'usr-jr-acc',
    },
  ];

  const clientBills: ClientBill[] = [
    {
      id: 'cb-1',
      invoiceNo: 'ASTY/26-27/INV-001',
      siteId: 'site-hadi',
      clientId: 'cl-1',
      billType: 'ra_bill',
      invoiceDate: shiftDays(today, -20),
      dueDate: shiftDays(today, -5),
      prevCertifiedPaise: 0,
      thisBillGrossPaise: 135000000,
      retentionHeldPaise: 6750000,
      advanceRecoveryPaise: 8250000,
      taxablePaise: 120000000,
      cgstPaise: 10800000,
      sgstPaise: 10800000,
      totalInvoicePaise: 141600000,
      receivedPaise: 110000000,
      status: 'posted',
    },
    {
      id: 'cb-2',
      invoiceNo: 'ASTY/26-27/INV-002',
      siteId: 'site-talikulam',
      clientId: 'cl-2',
      billType: 'ra_bill',
      invoiceDate: shiftDays(today, -15),
      dueDate: shiftDays(today, 0),
      prevCertifiedPaise: 0,
      thisBillGrossPaise: 380000000,
      retentionHeldPaise: 19000000,
      advanceRecoveryPaise: 11000000,
      taxablePaise: 350000000,
      cgstPaise: 31500000,
      sgstPaise: 31500000,
      totalInvoicePaise: 413000000,
      receivedPaise: 200000000,
      status: 'posted',
    },
    {
      id: 'cb-3',
      invoiceNo: 'ASTY/26-27/INV-003',
      siteId: 'site-wayanad',
      clientId: 'cl-3',
      billType: 'pmc_fee_bill',
      invoiceDate: shiftDays(today, -10),
      dueDate: shiftDays(today, 5),
      prevCertifiedPaise: 0,
      thisBillGrossPaise: 102000000, // 12% PMC fee on ₹85,00,000 actual spend
      retentionHeldPaise: 0,
      advanceRecoveryPaise: 0,
      taxablePaise: 102000000,
      cgstPaise: 9180000,
      sgstPaise: 9180000,
      totalInvoicePaise: 120360000,
      receivedPaise: 120360000,
      status: 'paid',
    },
  ];

  const workOrders: WorkOrder[] = [
    {
      id: 'wo-1',
      woNo: 'WO/26-27/001',
      siteId: 'site-talikulam',
      subcontractorId: 'sub-2',
      scope: 'Cottage Cluster Concealed Plumbing & Bathroom Waterproofing',
      ratePaise: 60000,
      qty: 1200,
      unit: 'sqft',
      retentionPct: 5,
      totalPaise: 72000000,
    },
    {
      id: 'wo-2',
      woNo: 'WO/26-27/002',
      siteId: 'site-tkm',
      subcontractorId: 'sub-3',
      scope: 'Industrial PEB Roof Truss Fabrication & Erection',
      ratePaise: 9500,
      qty: 12000,
      unit: 'kg',
      retentionPct: 5,
      totalPaise: 114000000,
    },
  ];

  const subcontractorBills: SubcontractorBill[] = [
    {
      id: 'sb-1',
      billNo: 'SUB-B01',
      workOrderId: 'wo-1',
      siteId: 'site-talikulam',
      subcontractorId: 'sub-2',
      billDate: shiftDays(today, -2),
      measuredQty: 750,
      grossPaise: 45000000,
      retentionPaise: 2250000,
      tds194cPaise: 900000,
      netPayablePaise: 41850000,
      status: 'pending_posting',
      approvalRequestId: 'apr-hist-sb1',
    },
  ];

  const wageSheets: WageSheet[] = [
    {
      id: 'ws-1',
      sheetNo: 'WS/26-27/W18',
      siteId: 'site-hadi',
      weekStart: shiftDays(today, -7),
      weekEnd: shiftDays(today, -1),
      grossPaise: 20500000,
      advanceRecoveryPaise: 2000000,
      netPayablePaise: 18500000,
      status: 'paid',
    },
  ];

  const fixedAssets: FixedAsset[] = [
    { id: 'fa-1', assetCode: 'FA-VEH-01', name: 'BharatBenz 1617R Tipper Goods Vehicle', category: 'Goods Vehicle', wdvRatePct: 40, purchaseDate: '2025-05-15', costPaise: 265000000, openingWdvPaise: 265000000 },
    { id: 'fa-2', assetCode: 'FA-MCH-01', name: '10/7 Hopper Concrete Mixer & Needle Vibrators (Set of 4)', category: 'Plant & Machinery', wdvRatePct: 15, purchaseDate: '2025-07-01', costPaise: 55000000, openingWdvPaise: 55000000 },
  ];

  const loans: LoanRecord[] = [
    { id: 'ln-1', loanNo: 'LN-HDFC-CV901', lender: 'HDFC Bank Commercial Vehicle Loan', assetName: 'BharatBenz 1617R Tipper', principalPaise: 210000000, annualInterestPct: 9.25, tenureMonths: 48, emiPaise: 5251000, paidMonths: 6 },
  ];

  const pettyCashWallets: PettyCashWallet[] = [
    { id: 'pcw-1', siteId: 'site-hadi', supervisorId: 'usr-sup-1', issuedPaise: 1500000, spentSettledPaise: 920000, pendingUnsettledPaise: 240000 },
    { id: 'pcw-2', siteId: 'site-wayanad', supervisorId: 'usr-sup-2', issuedPaise: 2000000, spentSettledPaise: 1450000, pendingUnsettledPaise: 0 },
  ];

  const bankStatementRows: BankStatementRow[] = [
    { id: 'bs-1', bankName: 'HDFC Bank Current A/c', date: shiftDays(today, -7), description: 'NEFT BULK OWN CREW WAGES WK18', utrRef: 'HDFCN261024881', withdrawalPaise: 74500000, depositPaise: 0, matchedVoucherNo: 'FY26-27/PMT/0001' },
    { id: 'bs-2', bankName: 'HDFC Bank Current A/c', date: shiftDays(today, -6), description: 'RTGS CR HADI RESIDENCE CLIENT', utrRef: 'HDFCR520261025', withdrawalPaise: 0, depositPaise: 110000000, matchedVoucherNo: 'FY26-27/RCT/0001' },
    { id: 'bs-3', bankName: 'HDFC Bank Current A/c', date: shiftDays(today, -2), description: 'IMPS BANK CHARGES & SMS ALERT', utrRef: 'CHG992011', withdrawalPaise: 59000, depositPaise: 0 },
  ];

  const extraWorkItems: ExtraWorkItem[] = [
    {
      id: 'ew-1',
      ewoNo: 'EWO/26-27/001',
      siteId: 'site-wayanad',
      description: 'Additional Infinity Deck Pergola & Stone Cladding requested by Client',
      estimatePaise: 68000000,
      clientApproved: false,
      clientApprovalMode: 'otp',
      status: 'pending_client',
    },
  ];

  const notifications: AppNotification[] = [
    {
      id: 'ntf-1',
      targetPositionIds: ['pos-mgmt'],
      siteId: 'site-talikulam',
      title: 'URGENT Hold-Up at Talikulam Resort',
      body: 'Staircase structural beam detailing awaiting architect revision; pour on hold.',
      priority: 'urgent',
      createdAt: `${today}T08:35:00+05:30`,
      readByUserIds: [],
    },
    {
      id: 'ntf-2',
      targetPositionIds: ['pos-coord', 'pos-ops'],
      siteId: 'site-wayanad',
      title: 'Missed Morning Check-In (+30m Grace Exceeded)',
      body: 'Wayanad Resort morning GPS check-in window (08:00–10:00) closed without submission.',
      priority: 'high',
      createdAt: `${today}T10:30:00+05:30`,
      readByUserIds: [],
    },
    {
      id: 'ntf-3',
      targetPositionIds: ['pos-ops', 'pos-coord'],
      siteId: 'site-talikulam',
      title: 'Plan Watchdog: Crew Clash Detected',
      body: 'Own Concrete Crew A is scheduled simultaneously on Talikulam Resort and Wayanad Resort.',
      priority: 'high',
      createdAt: `${today}T06:30:00+05:30`,
      readByUserIds: [],
    },
  ];

  const auditLog: AuditLogEntry[] = [
    {
      id: 'aud-1',
      tableName: 'sites',
      recordId: 'site-wayanad',
      operation: 'INSERT',
      actorUserId: 'usr-admin',
      actorPositionIds: ['pos-admin'],
      summary: 'Seeded Wayanad Resort (PMC 12%) with 250m geofence radius',
      createdAt: `${shiftDays(today, -50)}T09:00:00+05:30`,
    },
    {
      id: 'aud-2',
      tableName: 'daily_issues',
      recordId: 'iss-urgent-tali',
      operation: 'INSERT',
      actorUserId: 'usr-sup-1',
      actorPositionIds: ['pos-sup'],
      summary: 'Flagged URGENT structural drawing hold-up on Talikulam Resort',
      createdAt: `${today}T08:34:00+05:30`,
    },
  ];

  return {
    company: {
      name: 'Asty Constructions',
      gstin: '32AABCA8821K1Z4',
      pan: 'AABCA8821K',
      address: '2nd Floor, Asty Chambers, Thrissur, Kerala - 680001',
      antiSplitDays: 7,
      escalationHours: 24,
      defaultRadiusM: 150,
      lockedPeriodBefore: null,
    },
    permissions: PERMISSION_CATALOGUE,
    positions,
    positionPermissions,
    users,
    clients,
    sites,
    siteFinancials,
    dailyReports,
    approvalChains,
    approvalRequests,
    items,
    vendors,
    materialRequests,
    purchaseOrders,
    goodsReceipts,
    stockTransfers: [],
    siteOpeningStock: {
      'site-hadi': { 'itm-laterite': 5000, 'itm-msand': 600 },
      'site-talikulam': { 'itm-msand': 1200, 'itm-agg20': 1500 },
      'site-wayanad': { 'itm-cement': 180, 'itm-steel': 2200 },
      'site-tkm': { 'itm-steel': 3500 },
    },
    boqVersions,
    planActivities,
    workers,
    wageSheets,
    subcontractors,
    workOrders,
    subcontractorBills,
    ledgers,
    vouchers,
    clientBills,
    fixedAssets,
    loans,
    pettyCashWallets,
    bankStatementRows,
    extraWorkItems,
    notifications,
    auditLog,
  };
}

