/**
 * Asty ERP — Strongly Typed Domain & Supabase Schema Definitions
 * All monetary columns end in `Paise` (integer paise, never floating-point).
 */

export type LoginType = 'admin' | 'management' | 'office' | 'field' | 'external';
export type PermissionAction = 'view' | 'create' | 'edit' | 'approve' | 'delete' | 'export';

export interface PermissionDef {
  id: string;
  code: string;
  module: string;
  action: PermissionAction;
  description: string;
}

export interface Position {
  id: string;
  name: string;
  loginType: LoginType;
  deviceHint: string;
  description: string;
  reportsToPositionId: string | null;
  isSystemProtected: boolean;
  isActive: boolean;
}

export interface UserProfile {
  id: string;
  employeeCode: string;
  fullName: string;
  email: string;
  phone: string;
  preferredLanguage: 'en' | 'ml';
  isActive: boolean;
  positionIds: string[];
  allSites: boolean;
  assignedSiteIds: string[];
}

export interface AuditLogEntry {
  id: string;
  tableName: string;
  recordId: string;
  operation: 'INSERT' | 'UPDATE' | 'DELETE';
  actorUserId: string;
  actorPositionIds: string[];
  summary: string;
  oldValues?: unknown;
  newValues?: unknown;
  createdAt: string;
}

export interface Client {
  id: string;
  code: string;
  name: string;
  phone: string;
  email: string;
  gstin: string;
  address: string;
  portalUserId?: string;
}

export type ContractType = 'lump_sum' | 'item_rate' | 'labour_only' | 'pmc_percent' | 'cost_plus';
export type ProjectType = 'residential' | 'commercial';
export type SiteStatus = 'planning' | 'active' | 'on_hold' | 'completed' | 'cancelled';

export interface ProfitShareRule {
  partnerLabel: string;
  sharePct: number;
  role: 'partner' | 'referral';
}

export interface Site {
  id: string;
  code: string;
  name: string;
  clientId: string;
  siteAddress: string;
  lat: number;
  lng: number;
  geofenceRadiusM: number;
  projectType: ProjectType;
  contractType: ContractType;
  status: SiteStatus;
  startDate: string;
  targetEndDate: string;
  morningStart: string;
  morningEnd: string;
  afternoonStart: string;
  afternoonEnd: string;
  eveningStart: string;
  eveningEnd: string;
  scheduleHealth: 'on_track' | 'at_risk' | 'delayed';
  daysBehind: number;
  supervisorIds: string[];
  coordinatorId: string;
  documents: Array<{
    id: string;
    category: 'drawing' | 'agreement' | 'permit' | 'boq' | 'other';
    title: string;
    version: string;
    uploadedAt: string;
  }>;
}

export interface SiteFinancialTerms {
  siteId: string;
  contractValuePaise: number;
  pmcFeePct: number;
  retentionPct: number;
  mobilisationAdvancePaise: number;
  profitShareSplit: ProfitShareRule[];
}

export interface DailyPhoto {
  id: string;
  slot: 'morning' | 'afternoon' | 'evening';
  dataUrl: string;
  caption: string;
  capturedAt: string;
  lat: number;
  lng: number;
  accuracyM: number;
}

export interface DailyCheckin {
  slot: 'morning' | 'afternoon' | 'evening';
  checkedInBy: string;
  capturedAt: string;
  lat: number;
  lng: number;
  accuracyM: number;
  distanceFromSiteM: number;
  isLowAccuracy: boolean;
  photos: DailyPhoto[];
}

export interface DailyReport {
  id: string;
  siteId: string;
  reportDate: string;
  status: 'open' | 'morning_done' | 'afternoon_done' | 'closed';
  checkins: Partial<Record<'morning' | 'afternoon' | 'evening', DailyCheckin>>;
  ownWorkerAttendances: Array<{ workerId: string; status: 'present' | 'half_day' | 'absent' }>;
  subcontractorCounts: Array<{ trade: string; headcount: number }>;
  activities: Array<{
    planActivityId?: string;
    title: string;
    completedQty: number;
    unit: string;
    completedPct: number;
  }>;
  materialsUsed: Array<{ itemId: string; qtyUsed: number }>;
  issues: Array<{ id: string; category: string; description: string; isUrgent: boolean; resolved: boolean }>;
  tomorrowPlan: string;
}

export type ApprovalRequestType =
  | 'material_request'
  | 'purchase_order'
  | 'petty_cash'
  | 'subcontractor_bill'
  | 'task_completion'
  | 'extra_work'
  | 'plan_change'
  | 'client_bill';

export interface ApprovalChainStep {
  stepOrder: number;
  positionId: string;
  stepKind: 'technical_check' | 'review' | 'approve';
  minAmountPaise: number | null;
  maxAmountPaise: number | null;
  alwaysRequired: boolean;
}

export interface ApprovalChain {
  id: string;
  requestType: ApprovalRequestType;
  name: string;
  antiSplitEnabled: boolean;
  antiSplitWindowDays: number;
  escalationHours: number;
  steps: ApprovalChainStep[];
}

export interface ApprovalRequest {
  id: string;
  requestNumber: string;
  requestType: ApprovalRequestType;
  siteId: string | null;
  sourceTable: string;
  sourceId: string;
  antiSplitItemId: string | null;
  amountPaise: number;
  rolling7dAmountPaise: number;
  status: 'pending' | 'sent_back' | 'approved' | 'rejected' | 'cancelled';
  currentStepOrder: number;
  currentPositionId: string;
  requestedBy: string;
  submittedAt: string;
  stepStartedAt: string;
  escalationLevel: number;
  title: string;
  details: string;
  attachmentLabel?: string;
  actions: Array<{
    stepOrder: number;
    action: string;
    actorUserId: string;
    actorPositionId: string;
    comment: string;
    createdAt: string;
  }>;
}

export interface Item {
  id: string;
  code: string;
  name: string;
  nameMl: string;
  category: string;
  unit: string;
  hsnCode: string;
  gstRatePct: number;
  defaultWastagePct: number;
  referenceRatePaise: number;
}

export interface Vendor {
  id: string;
  code: string;
  name: string;
  phone: string;
  gstin: string;
  address: string;
}

export interface MaterialRequest {
  id: string;
  mrNumber: string;
  siteId: string;
  requestedBy: string;
  neededByDate: string;
  planActivityTitle: string;
  itemId: string;
  qty: number;
  estimatedAmountPaise: number;
  status: 'pending_approval' | 'approved' | 'po_issued' | 'fulfilled' | 'rejected' | 'sent_back';
  approvalRequestId: string;
}

export interface PurchaseOrder {
  id: string;
  poNumber: string;
  siteId: string;
  vendorId: string;
  materialRequestId?: string;
  poDate: string;
  deliveryDate: string;
  itemId: string;
  qtyOrdered: number;
  qtyReceived: number;
  ratePaise: number;
  gstRatePct: number;
  subtotalPaise: number;
  gstPaise: number;
  totalPaise: number;
  status: 'pending_approval' | 'approved' | 'part_received' | 'received' | 'cancelled';
  approvalRequestId: string;
}

export interface GoodsReceipt {
  id: string;
  grnNumber: string;
  siteId: string;
  purchaseOrderId: string;
  vendorId: string;
  itemId: string;
  qtyReceived: number;
  challanNo: string;
  challanPhotoDataUrl: string;
  receivedBy: string;
  receivedAt: string;
}

export interface StockTransfer {
  id: string;
  transferNo: string;
  fromSiteId: string;
  toSiteId: string;
  itemId: string;
  qty: number;
  status: 'pending_coordinator' | 'in_transit' | 'received' | 'cancelled';
  requestedBy: string;
  approvedBy?: string;
}

export interface BoqItemRow {
  id: string;
  stageName: string;
  workType: string;
  concreteGrade: string;
  concreteM3: number;
  formworkM2: number;
  steelKg: number;
  stagingM2: number;
  masonryQty: number;
  pourDays: number;
  materialCostPaise: number;
  labourCostPaise: number;
  formworkCostPaise: number;
  rentCostPaise: number;
  steelCostPaise: number;
  totalCostPaise: number;
  quotedAmountPaise: number;
}

export interface RateSheet {
  cementBagPaise: number;
  mSandCftPaise: number;
  agg20mmCftPaise: number;
  steelKgPaise: number;
  rmcM25M3Paise: number;
  rmcM30M3Paise: number;
  masonDayPaise: number;
  helperDayPaise: number;
  carpenterDayPaise: number;
  barBenderDayPaise: number;
  shutteringSqmPaise: number;
  stagingSqmPaise: number;
  mixerDayPaise: number;
  lateriteStonePaise: number;
  floorHeightM: number;
  wastagePct: number;
  profitPct: number;
}

export interface BoqVersion {
  id: string;
  siteId: string;
  versionNo: number;
  projectType: ProjectType;
  builtUpAreaSqft: number;
  isLocked: boolean;
  status: 'draft' | 'approved_locked' | 'superseded';
  rateSheet: RateSheet;
  items: BoqItemRow[];
  totalCostPaise: number;
  quotedTotalPaise: number;
  roundedTotalPaise: number;
}

export interface PlanActivity {
  id: string;
  siteId: string;
  boqItemId?: string;
  code: string;
  name: string;
  quantity: number;
  unit: string;
  dailyOutput: number;
  durationDays: number;
  predecessorIds: string[];
  baselineStart: string;
  baselineEnd: string;
  plannedStart: string;
  plannedEnd: string;
  completedQty: number;
  progressPct: number;
  crewName: string;
  crewType: 'own_concrete' | 'own_brick' | 'subcontractor';
  materialNeededItemId?: string;
  materialNeededBy?: string;
  drawingTitle?: string;
  drawingConsultant?: string;
  drawingDueDate?: string;
  drawingReceived?: boolean;
}

export interface Worker {
  id: string;
  code: string;
  fullName: string;
  phone: string;
  trade: 'concrete_worker' | 'brick_worker' | 'mason' | 'helper' | 'carpenter' | 'bar_bender';
  crewName: 'Own Concrete Crew A' | 'Own Concrete Crew B' | 'Own Brick Crew A';
  dailyWagePaise: number;
  joiningDate: string;
  advanceBalancePaise: number;
}

export interface WageSheet {
  id: string;
  sheetNo: string;
  siteId: string;
  weekStart: string;
  weekEnd: string;
  grossPaise: number;
  advanceRecoveryPaise: number;
  netPayablePaise: number;
  status: 'draft' | 'approved' | 'pending_posting' | 'posted' | 'paid';
}

export interface Subcontractor {
  id: string;
  code: string;
  name: string;
  trade: string;
  pan: string;
  gstin: string;
  tdsRatePct: number; // 194C: 1% or 2%
}

export interface WorkOrder {
  id: string;
  woNo: string;
  siteId: string;
  subcontractorId: string;
  scope: string;
  ratePaise: number;
  qty: number;
  unit: string;
  retentionPct: number;
  totalPaise: number;
}

export interface SubcontractorBill {
  id: string;
  billNo: string;
  workOrderId: string;
  siteId: string;
  subcontractorId: string;
  billDate: string;
  measuredQty: number;
  grossPaise: number;
  retentionPaise: number;
  tds194cPaise: number;
  netPayablePaise: number;
  status: 'pending_approval' | 'approved' | 'pending_posting' | 'posted' | 'paid';
  approvalRequestId: string;
}

export type VoucherType =
  | 'payment'
  | 'receipt'
  | 'contra'
  | 'journal'
  | 'purchase'
  | 'sales'
  | 'debit_note'
  | 'credit_note';

export interface LedgerAccount {
  id: string;
  code: string;
  name: string;
  groupName: string;
  nature: 'assets' | 'liabilities' | 'income' | 'expenses' | 'equity';
  isDirect: boolean;
  openingBalancePaise: number;
  openingDrCr: 'DR' | 'CR';
}

export interface VoucherLine {
  ledgerId: string;
  costCentreSiteId: string | 'HEAD_OFFICE';
  drCr: 'DR' | 'CR';
  amountPaise: number;
  note?: string;
}

export interface Voucher {
  id: string;
  voucherNo: string;
  financialYear: string;
  voucherType: VoucherType;
  voucherDate: string;
  status: 'draft' | 'pending_posting' | 'posted' | 'reversed' | 'cancelled';
  sourceLabel?: string;
  narration: string;
  lines: VoucherLine[];
  totalDrPaise: number;
  totalCrPaise: number;
  isRcm?: boolean;
  gstInputPaise?: number;
  gstOutputPaise?: number;
  tdsSection?: '194C' | '194J';
  tdsPaise?: number;
  preparedBy: string;
  postedBy?: string;
}

export interface ClientBill {
  id: string;
  invoiceNo: string;
  siteId: string;
  clientId: string;
  billType: 'ra_bill' | 'final_bill' | 'labour_bill' | 'extra_work_bill' | 'pmc_fee_bill';
  invoiceDate: string;
  dueDate: string;
  prevCertifiedPaise: number;
  thisBillGrossPaise: number;
  retentionHeldPaise: number;
  advanceRecoveryPaise: number;
  taxablePaise: number;
  cgstPaise: number;
  sgstPaise: number;
  totalInvoicePaise: number;
  receivedPaise: number;
  status: 'ops_checked' | 'pending_mgmt_approval' | 'approved' | 'posted' | 'paid';
  approvalRequestId?: string;
}

export interface FixedAsset {
  id: string;
  assetCode: string;
  name: string;
  category: string;
  wdvRatePct: number;
  purchaseDate: string;
  costPaise: number;
  openingWdvPaise: number;
}

export interface LoanRecord {
  id: string;
  loanNo: string;
  lender: string;
  assetName: string;
  principalPaise: number;
  annualInterestPct: number;
  tenureMonths: number;
  emiPaise: number;
  paidMonths: number;
}

export interface PettyCashWallet {
  id: string;
  siteId: string;
  supervisorId: string;
  issuedPaise: number;
  spentSettledPaise: number;
  pendingUnsettledPaise: number;
}

export interface BankStatementRow {
  id: string;
  bankName: string;
  date: string;
  description: string;
  utrRef: string;
  withdrawalPaise: number;
  depositPaise: number;
  matchedVoucherNo?: string;
}

export interface ExtraWorkItem {
  id: string;
  ewoNo: string;
  siteId: string;
  description: string;
  estimatePaise: number;
  clientApproved: boolean;
  clientApprovalMode: 'upload' | 'otp';
  status: 'pending_client' | 'approved' | 'billed';
}

export interface AppNotification {
  id: string;
  targetPositionIds: string[];
  siteId?: string;
  title: string;
  body: string;
  priority: 'normal' | 'high' | 'urgent';
  createdAt: string;
  readByUserIds: string[];
}

