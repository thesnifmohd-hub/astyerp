/**
 * Asty ERP — Business Rules, RBAC/RLS Enforcement, Approvals, Stock & Accounting Engine
 * Zero hard-coded person names or position names! Everything checks permissions & configured chains.
 */

import type {
  ApprovalChainStep,
  ApprovalRequest,
  ApprovalRequestType,
  AuditLogEntry,
  DailyPhoto,
  Site,
  SiteFinancialTerms,
  Voucher,
  VoucherLine,
  VoucherType,
} from './database.types';
import { getFinancialYear, todayISOInIST } from './dates';
import { evaluateGeofence } from './geo';
import { applyPercentagePaise, splitGST } from './money';
import type { ErpDatabaseState } from './seedData';

export function hasPermission(state: ErpDatabaseState, userId: string, permCode: string): boolean {
  const user = state.users.find((u) => u.id === userId && u.isActive);
  if (!user) return false;
  for (const posId of user.positionIds) {
    const pos = state.positions.find((p) => p.id === posId && p.isActive);
    if (!pos) continue;
    const perms = state.positionPermissions[pos.id] ?? [];
    if (perms.includes(permCode)) return true;
  }
  return false;
}

export function canAccessSite(state: ErpDatabaseState, userId: string, siteId: string): boolean {
  const user = state.users.find((u) => u.id === userId && u.isActive);
  if (!user) return false;
  if (user.allSites) return true;
  if (user.assignedSiteIds.includes(siteId)) return true;
  const site = state.sites.find((s) => s.id === siteId);
  if (!site) return false;
  if (site.supervisorIds.includes(userId) || site.coordinatorId === userId) return true;
  const client = state.clients.find((c) => c.id === site.clientId);
  return client?.portalUserId === userId;
}

export function getVisibleSites(state: ErpDatabaseState, userId: string): Site[] {
  if (!hasPermission(state, userId, 'site.view') && !hasPermission(state, userId, 'client_portal.view')) {
    return [];
  }
  return state.sites.filter((s) => canAccessSite(state, userId, s.id));
}

export function getVisibleSiteFinancials(
  state: ErpDatabaseState,
  userId: string,
  siteId: string,
): SiteFinancialTerms | null {
  if (!hasPermission(state, userId, 'report.profit.view')) return null;
  if (!canAccessSite(state, userId, siteId)) return null;
  return state.siteFinancials[siteId] ?? null;
}

export function appendAudit(
  state: ErpDatabaseState,
  actorUserId: string,
  tableName: string,
  recordId: string,
  operation: 'INSERT' | 'UPDATE' | 'DELETE',
  summary: string,
  oldValues?: unknown,
  newValues?: unknown,
): AuditLogEntry {
  const actor = state.users.find((u) => u.id === actorUserId);
  const entry: AuditLogEntry = {
    id: `aud-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    tableName,
    recordId,
    operation,
    actorUserId,
    actorPositionIds: actor?.positionIds ?? [],
    summary,
    oldValues,
    newValues,
    createdAt: new Date().toISOString(),
  };
  state.auditLog.unshift(entry);
  return entry;
}

// -----------------------------------------------------------------------------
// Approvals & 7-Day Anti-Splitting Engine (SPEC Section 4.5)
// -----------------------------------------------------------------------------
export function stepMatchesAmount(step: ApprovalChainStep, effectiveAmountPaise: number): boolean {
  if (step.alwaysRequired) return true;
  if (step.minAmountPaise !== null && effectiveAmountPaise < step.minAmountPaise) return false;
  if (step.maxAmountPaise !== null && effectiveAmountPaise > step.maxAmountPaise) return false;
  return true;
}

export function computeRolling7DayAmountPaise(
  state: ErpDatabaseState,
  siteId: string | null,
  itemId: string | null,
  currentAmountPaise: number,
  windowDays = 7,
  nowMs: number = Date.now(),
): number {
  if (!siteId || !itemId) return currentAmountPaise;
  const cutoffMs = nowMs - windowDays * 24 * 60 * 60 * 1000;
  let priorSum = 0;
  for (const req of state.approvalRequests) {
    if (req.status === 'rejected' || req.status === 'cancelled') continue;
    if (req.siteId !== siteId || req.antiSplitItemId !== itemId) continue;
    const subMs = new Date(req.submittedAt).getTime();
    if (subMs >= cutoffMs && subMs <= nowMs) {
      priorSum += req.amountPaise;
    }
  }
  return priorSum + currentAmountPaise;
}

export function createApprovalRequest(
  state: ErpDatabaseState,
  params: {
    actorUserId: string;
    requestType: ApprovalRequestType;
    siteId: string | null;
    sourceTable: string;
    sourceId: string;
    antiSplitItemId: string | null;
    amountPaise: number;
    title: string;
    details: string;
    attachmentLabel?: string;
    submittedAtIso?: string;
  },
): ApprovalRequest {
  if (!hasPermission(state, params.actorUserId, 'approval.create')) {
    throw new Error('Permission denied: approval.create required');
  }

  const chain = state.approvalChains.find((c) => c.requestType === params.requestType);
  if (!chain) throw new Error(`Approval chain not configured for ${params.requestType}`);

  const nowIso = params.submittedAtIso ?? new Date().toISOString();
  const rolling7dAmountPaise = chain.antiSplitEnabled
    ? computeRolling7DayAmountPaise(
        state,
        params.siteId,
        params.antiSplitItemId,
        params.amountPaise,
        chain.antiSplitWindowDays,
        new Date(nowIso).getTime(),
      )
    : params.amountPaise;

  const applicableSteps = [...chain.steps]
    .sort((a, b) => a.stepOrder - b.stepOrder)
    .filter((s) => stepMatchesAmount(s, rolling7dAmountPaise));

  if (applicableSteps.length === 0) {
    throw new Error('No applicable approval step found for request');
  }

  const firstStep = applicableSteps[0];
  const reqNumber = `APR/${getFinancialYear()}/${String(state.approvalRequests.length + 101).padStart(4, '0')}`;

  const req: ApprovalRequest = {
    id: `apr-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    requestNumber: reqNumber,
    requestType: params.requestType,
    siteId: params.siteId,
    sourceTable: params.sourceTable,
    sourceId: params.sourceId,
    antiSplitItemId: params.antiSplitItemId,
    amountPaise: params.amountPaise,
    rolling7dAmountPaise,
    status: 'pending',
    currentStepOrder: firstStep.stepOrder,
    currentPositionId: firstStep.positionId,
    requestedBy: params.actorUserId,
    submittedAt: nowIso,
    stepStartedAt: nowIso,
    escalationLevel: 0,
    title: params.title,
    details: params.details,
    attachmentLabel: params.attachmentLabel,
    actions: [],
  };

  state.approvalRequests.unshift(req);
  appendAudit(state, params.actorUserId, 'approval_requests', req.id, 'INSERT', `Raised ${req.requestNumber} (${params.title})`, undefined, req);
  return req;
}

export function processApprovalAction(
  state: ErpDatabaseState,
  params: {
    actorUserId: string;
    requestId: string;
    decision: 'approve' | 'reject' | 'send_back';
    comment: string;
  },
): ApprovalRequest {
  const req = state.approvalRequests.find((r) => r.id === params.requestId);
  if (!req || req.status !== 'pending') {
    throw new Error('Approval request is not pending');
  }

  const actor = state.users.find((u) => u.id === params.actorUserId && u.isActive);
  if (!actor || !actor.positionIds.includes(req.currentPositionId)) {
    throw new Error('Permission denied: user does not hold the active step position');
  }

  const chain = state.approvalChains.find((c) => c.requestType === req.requestType)!;
  const applicableSteps = [...chain.steps]
    .sort((a, b) => a.stepOrder - b.stepOrder)
    .filter((s) => stepMatchesAmount(s, req.rolling7dAmountPaise));

  const currentIdx = applicableSteps.findIndex((s) => s.stepOrder === req.currentStepOrder);
  const currentStep = applicableSteps[currentIdx] ?? {
    stepOrder: req.currentStepOrder,
    positionId: req.currentPositionId,
    stepKind: 'approve' as const,
    minAmountPaise: null,
    maxAmountPaise: null,
    alwaysRequired: true,
  };

  const actingPosId = req.currentPositionId;

  if (params.decision === 'reject') {
    req.status = 'rejected';
    req.actions.push({
      stepOrder: currentStep.stepOrder,
      action: 'reject',
      actorUserId: actor.id,
      actorPositionId: actingPosId,
      comment: params.comment,
      createdAt: new Date().toISOString(),
    });
  } else if (params.decision === 'send_back') {
    req.status = 'sent_back';
    req.actions.push({
      stepOrder: currentStep.stepOrder,
      action: 'send_back',
      actorUserId: actor.id,
      actorPositionId: actingPosId,
      comment: params.comment,
      createdAt: new Date().toISOString(),
    });
  } else {
    const nextStep = currentIdx >= 0 ? applicableSteps[currentIdx + 1] : undefined;
    if (currentStep.stepKind === 'technical_check' && !nextStep) {
      throw new Error('Technical check position cannot grant final spending approval');
    }

    const actionCode =
      currentStep.stepKind === 'technical_check'
        ? 'technical_ok'
        : currentStep.stepKind === 'review'
          ? 'review_ok'
          : 'approve';

    req.actions.push({
      stepOrder: currentStep.stepOrder,
      action: actionCode,
      actorUserId: actor.id,
      actorPositionId: actingPosId,
      comment: params.comment,
      createdAt: new Date().toISOString(),
    });

    if (nextStep) {
      req.currentStepOrder = nextStep.stepOrder;
      req.currentPositionId = nextStep.positionId;
      req.stepStartedAt = new Date().toISOString();
    } else {
      req.status = 'approved';
      syncApprovedSourceRecord(state, req);
    }
  }

  appendAudit(
    state,
    actor.id,
    'approval_requests',
    req.id,
    'UPDATE',
    `${params.decision.toUpperCase()} on ${req.requestNumber}`,
  );
  return req;
}

function syncApprovedSourceRecord(state: ErpDatabaseState, req: ApprovalRequest) {
  if (req.requestType === 'material_request') {
    const mr = state.materialRequests.find((m) => m.id === req.sourceId);
    if (mr) mr.status = 'approved';
  } else if (req.requestType === 'purchase_order') {
    const po = state.purchaseOrders.find((p) => p.id === req.sourceId);
    if (po) po.status = 'approved';
  } else if (req.requestType === 'client_bill') {
    const cb = state.clientBills.find((b) => b.id === req.sourceId);
    if (cb) cb.status = 'approved';
  }
}

export function escalateStaleApprovals(state: ErpDatabaseState, nowMs: number = Date.now()): number {
  let escalated = 0;
  for (const req of state.approvalRequests) {
    if (req.status !== 'pending') continue;
    const chain = state.approvalChains.find((c) => c.requestType === req.requestType);
    const hours = chain?.escalationHours ?? state.company.escalationHours;
    const elapsedMs = nowMs - new Date(req.stepStartedAt).getTime();
    if (elapsedMs > hours * 3600 * 1000) {
      const curPos = state.positions.find((p) => p.id === req.currentPositionId);
      if (curPos?.reportsToPositionId) {
        req.currentPositionId = curPos.reportsToPositionId;
        req.escalationLevel += 1;
        req.stepStartedAt = new Date(nowMs).toISOString();
        req.actions.push({
          stepOrder: req.currentStepOrder,
          action: 'escalate',
          actorUserId: 'SYSTEM_CRON',
          actorPositionId: curPos.reportsToPositionId,
          comment: `Auto-escalated after exceeding ${hours}h SLA`,
          createdAt: new Date(nowMs).toISOString(),
        });
        escalated += 1;
      }
    }
  }
  return escalated;
}

// -----------------------------------------------------------------------------
// Daily Site Check-In & DPR Validation (SPEC Section 4.4)
// -----------------------------------------------------------------------------
export function submitSiteCheckin(
  state: ErpDatabaseState,
  params: {
    actorUserId: string;
    siteId: string;
    reportDate: string;
    slot: 'morning' | 'afternoon' | 'evening';
    lat: number;
    lng: number;
    accuracyM: number;
    photos: DailyPhoto[];
    ownWorkerAttendances?: Array<{ workerId: string; status: 'present' | 'half_day' | 'absent' }>;
    subcontractorCounts?: Array<{ trade: string; headcount: number }>;
    activities?: Array<{ planActivityId?: string; title: string; completedQty: number; unit: string; completedPct: number }>;
    materialsUsed?: Array<{ itemId: string; qtyUsed: number }>;
    issues?: Array<{ category: string; description: string; isUrgent: boolean }>;
    tomorrowPlan?: string;
  },
) {
  if (!hasPermission(state, params.actorUserId, 'dpr.create') || !canAccessSite(state, params.actorUserId, params.siteId)) {
    throw new Error('Permission denied for site daily reporting');
  }

  const site = state.sites.find((s) => s.id === params.siteId);
  if (!site) throw new Error('Site not found');

  const geo = evaluateGeofence(
    { lat: params.lat, lng: params.lng, accuracyM: params.accuracyM },
    site.lat,
    site.lng,
    site.geofenceRadiusM,
  );
  if (!geo.allowed) {
    throw new Error(
      geo.isMockSuspect
        ? 'Mock GPS rejected'
        : `Outside site radius (${geo.distanceMeters}m > ${site.geofenceRadiusM}m)`,
    );
  }

  if ((params.slot === 'afternoon' || params.slot === 'evening') && params.photos.length < 3) {
    throw new Error(`${params.slot} check-in requires at least 3 live stamped photos`);
  }

  if (params.slot === 'evening' && (!params.tomorrowPlan || !params.tomorrowPlan.trim())) {
    throw new Error("Tomorrow's plan is mandatory to close the evening report");
  }

  let report = state.dailyReports.find(
    (r) => r.siteId === params.siteId && r.reportDate === params.reportDate,
  );
  if (!report) {
    report = {
      id: `dpr-${params.siteId}-${params.reportDate}`,
      siteId: params.siteId,
      reportDate: params.reportDate,
      status: 'open',
      checkins: {},
      ownWorkerAttendances: [],
      subcontractorCounts: [],
      activities: [],
      materialsUsed: [],
      issues: [],
      tomorrowPlan: '',
    };
    state.dailyReports.unshift(report);
  }

  report.checkins[params.slot] = {
    slot: params.slot,
    checkedInBy: params.actorUserId,
    capturedAt: new Date().toISOString(),
    lat: params.lat,
    lng: params.lng,
    accuracyM: params.accuracyM,
    distanceFromSiteM: geo.distanceMeters,
    isLowAccuracy: geo.isLowAccuracy,
    photos: params.photos,
  };

  if (params.slot === 'morning') {
    report.status = report.status === 'closed' ? 'closed' : 'morning_done';
    if (params.ownWorkerAttendances) report.ownWorkerAttendances = params.ownWorkerAttendances;
    if (params.subcontractorCounts) report.subcontractorCounts = params.subcontractorCounts;
    if (params.activities) report.activities = params.activities;
  } else if (params.slot === 'afternoon') {
    report.status = report.status === 'closed' ? 'closed' : 'afternoon_done';
  } else if (params.slot === 'evening') {
    report.status = 'closed';
    report.tomorrowPlan = params.tomorrowPlan!.trim();
    if (params.activities) {
      report.activities = params.activities;
      for (const act of params.activities) {
        if (act.planActivityId) {
          const pa = state.planActivities.find((p) => p.id === act.planActivityId);
          if (pa) {
            pa.completedQty += act.completedQty;
            pa.progressPct = Math.min(100, Math.round((pa.completedQty / Math.max(1, pa.quantity)) * 100));
          }
        }
      }
    }
    if (params.materialsUsed) {
      report.materialsUsed = params.materialsUsed;
    }
    if (params.issues) {
      for (const iss of params.issues) {
        const issueId = `iss-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`;
        report.issues.push({ id: issueId, ...iss, resolved: false });
        if (iss.isUrgent) {
          const mgmtPosIds = state.positions
            .filter((p) => p.loginType === 'management' && p.isActive)
            .map((p) => p.id);
          state.notifications.unshift({
            id: `ntf-${Date.now()}`,
            targetPositionIds: mgmtPosIds,
            siteId: site.id,
            title: `URGENT Problem at ${site.name}`,
            body: iss.description,
            priority: 'urgent',
            createdAt: new Date().toISOString(),
            readByUserIds: [],
          });
        }
      }
    }
  }

  appendAudit(
    state,
    params.actorUserId,
    'daily_checkins',
    `${report.id}:${params.slot}`,
    'INSERT',
    `Submitted ${params.slot} GPS check-in at ${site.name} (${geo.distanceMeters}m)`,
  );
  return { report, geo };
}

// -----------------------------------------------------------------------------
// Site Stock Calculation (received - used - transferredOut + transferredIn)
// -----------------------------------------------------------------------------
export function calculateSiteItemStock(state: ErpDatabaseState, siteId: string, itemId: string): {
  opening: number;
  received: number;
  used: number;
  transferredOut: number;
  transferredIn: number;
  onHand: number;
} {
  const opening = state.siteOpeningStock[siteId]?.[itemId] ?? 0;
  const received = state.goodsReceipts
    .filter((g) => g.siteId === siteId && g.itemId === itemId)
    .reduce((s, g) => s + g.qtyReceived, 0);
  const used = state.dailyReports
    .filter((r) => r.siteId === siteId)
    .flatMap((r) => r.materialsUsed)
    .filter((m) => m.itemId === itemId)
    .reduce((s, m) => s + m.qtyUsed, 0);
  const transferredOut = state.stockTransfers
    .filter((t) => t.fromSiteId === siteId && t.itemId === itemId && (t.status === 'in_transit' || t.status === 'received'))
    .reduce((s, t) => s + t.qty, 0);
  const transferredIn = state.stockTransfers
    .filter((t) => t.toSiteId === siteId && t.itemId === itemId && t.status === 'received')
    .reduce((s, t) => s + t.qty, 0);

  const onHand = Math.round((opening + received - used - transferredOut + transferredIn) * 1000) / 1000;
  return { opening, received, used, transferredOut, transferredIn, onHand };
}

export function getLast3PurchaseRates(state: ErpDatabaseState, itemId: string) {
  return state.purchaseOrders
    .filter((p) => p.itemId === itemId && p.status !== 'cancelled' && p.status !== 'pending_approval')
    .sort((a, b) => b.poDate.localeCompare(a.poDate))
    .slice(0, 3)
    .map((p) => ({
      poNumber: p.poNumber,
      poDate: p.poDate,
      ratePaise: p.ratePaise,
      vendorName: state.vendors.find((v) => v.id === p.vendorId)?.name ?? 'Vendor',
      siteName: state.sites.find((s) => s.id === p.siteId)?.name ?? 'Site',
    }));
}

// -----------------------------------------------------------------------------
// Double-Entry Accounting & Client Billing Rules (SPEC Sections 4.9 & 4.10)
// -----------------------------------------------------------------------------
export function validateVoucherBalanced(lines: VoucherLine[]): {
  valid: boolean;
  totalDrPaise: number;
  totalCrPaise: number;
} {
  let totalDrPaise = 0;
  let totalCrPaise = 0;
  for (const l of lines) {
    if (!Number.isInteger(l.amountPaise) || l.amountPaise <= 0) {
      return { valid: false, totalDrPaise: 0, totalCrPaise: 0 };
    }
    if (l.drCr === 'DR') totalDrPaise += l.amountPaise;
    else totalCrPaise += l.amountPaise;
  }
  return {
    valid: lines.length >= 2 && totalDrPaise > 0 && totalDrPaise === totalCrPaise,
    totalDrPaise,
    totalCrPaise,
  };
}

export function createDraftVoucher(
  state: ErpDatabaseState,
  params: {
    actorUserId: string;
    voucherType: VoucherType;
    voucherDate: string;
    narration: string;
    lines: VoucherLine[];
    sourceLabel?: string;
    status?: 'draft' | 'pending_posting';
  },
): Voucher {
  if (!hasPermission(state, params.actorUserId, 'voucher.draft')) {
    throw new Error('Permission denied: voucher.draft required');
  }
  if (
    state.company.lockedPeriodBefore &&
    params.voucherDate <= state.company.lockedPeriodBefore &&
    !hasPermission(state, params.actorUserId, 'period.unlock_override')
  ) {
    throw new Error(`Period up to ${state.company.lockedPeriodBefore} is locked`);
  }

  const check = validateVoucherBalanced(params.lines);
  if (!check.valid) {
    throw new Error(
      `Voucher does not balance: DR ${check.totalDrPaise} paise !== CR ${check.totalCrPaise} paise`,
    );
  }

  const fy = getFinancialYear(params.voucherDate);
  const codeMap: Record<VoucherType, string> = {
    payment: 'PMT',
    receipt: 'RCT',
    contra: 'CNT',
    journal: 'JRN',
    purchase: 'PUR',
    sales: 'SLS',
    debit_note: 'DBN',
    credit_note: 'CRN',
  };
  const seq = state.vouchers.filter((v) => v.financialYear === fy && v.voucherType === params.voucherType).length + 1;
  const voucherNo = `FY${fy.slice(2)}/${codeMap[params.voucherType]}/${String(seq).padStart(4, '0')}`;

  const vch: Voucher = {
    id: `vch-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
    voucherNo,
    financialYear: fy,
    voucherType: params.voucherType,
    voucherDate: params.voucherDate,
    status: params.status ?? 'draft',
    sourceLabel: params.sourceLabel,
    narration: params.narration,
    lines: params.lines,
    totalDrPaise: check.totalDrPaise,
    totalCrPaise: check.totalCrPaise,
    preparedBy: params.actorUserId,
  };

  state.vouchers.unshift(vch);
  appendAudit(state, params.actorUserId, 'vouchers', vch.id, 'INSERT', `Created draft voucher ${vch.voucherNo}`);
  return vch;
}

export function postVoucher(state: ErpDatabaseState, actorUserId: string, voucherId: string): Voucher {
  if (!hasPermission(state, actorUserId, 'voucher.post')) {
    throw new Error('Permission denied: voucher.post required to post vouchers');
  }
  const vch = state.vouchers.find((v) => v.id === voucherId);
  if (!vch) throw new Error('Voucher not found');
  if (vch.status === 'posted') throw new Error('Voucher is already posted');

  if (
    state.company.lockedPeriodBefore &&
    vch.voucherDate <= state.company.lockedPeriodBefore &&
    !hasPermission(state, actorUserId, 'period.unlock_override')
  ) {
    throw new Error('Cannot post voucher in a locked financial period');
  }

  const check = validateVoucherBalanced(vch.lines);
  if (!check.valid) {
    throw new Error('Double-entry balance check failed: DR must equal CR');
  }

  vch.status = 'posted';
  vch.postedBy = actorUserId;
  appendAudit(state, actorUserId, 'vouchers', vch.id, 'UPDATE', `Posted voucher ${vch.voucherNo} to general ledger`);
  return vch;
}

export function reversePostedVoucher(
  state: ErpDatabaseState,
  actorUserId: string,
  voucherId: string,
  reason: string,
): Voucher {
  if (!hasPermission(state, actorUserId, 'voucher.post')) {
    throw new Error('Permission denied: voucher.post required to reverse posted vouchers');
  }
  const orig = state.vouchers.find((v) => v.id === voucherId);
  if (!orig || orig.status !== 'posted') {
    throw new Error('Only posted vouchers can be reversed');
  }
  orig.status = 'reversed';

  const reversedLines: VoucherLine[] = orig.lines.map((l) => ({
    ...l,
    drCr: l.drCr === 'DR' ? 'CR' : 'DR',
    note: `Reversal of ${orig.voucherNo}`,
  }));

  const rev = createDraftVoucher(state, {
    actorUserId,
    voucherType: 'journal',
    voucherDate: todayISOInIST(),
    narration: `REVERSAL of ${orig.voucherNo}: ${reason}`,
    lines: reversedLines,
    sourceLabel: `Reversal:${orig.voucherNo}`,
  });
  rev.status = 'posted';
  rev.postedBy = actorUserId;
  return rev;
}

export function calculateRaBillAmounts(params: {
  cumulativeWorkPaise: number;
  prevCertifiedPaise: number;
  retentionPct: number;
  advanceRecoveryPaise: number;
  gstRatePct: number;
  interState?: boolean;
}) {
  if (params.cumulativeWorkPaise < params.prevCertifiedPaise) {
    throw new Error('Cumulative completed value cannot be less than previous certified value');
  }
  const thisBillGrossPaise = params.cumulativeWorkPaise - params.prevCertifiedPaise;
  const retentionHeldPaise = applyPercentagePaise(thisBillGrossPaise, params.retentionPct);
  const taxablePaise = Math.max(0, thisBillGrossPaise - retentionHeldPaise - params.advanceRecoveryPaise);
  const gst = splitGST(taxablePaise, params.gstRatePct, params.interState ?? false);
  return {
    cumulativeWorkPaise: params.cumulativeWorkPaise,
    prevCertifiedPaise: params.prevCertifiedPaise,
    thisBillGrossPaise,
    retentionHeldPaise,
    advanceRecoveryPaise: params.advanceRecoveryPaise,
    taxablePaise,
    cgstPaise: gst.cgstPaise,
    sgstPaise: gst.sgstPaise,
    igstPaise: gst.igstPaise,
    totalInvoicePaise: gst.grossPaise,
  };
}

export function calculateSitePnL(state: ErpDatabaseState, siteId: string) {
  let revenuePaise = 0;
  let materialExpensePaise = 0;
  let labourExpensePaise = 0;
  let subconExpensePaise = 0;
  let otherExpensePaise = 0;

  for (const v of state.vouchers) {
    if (v.status !== 'posted') continue;
    for (const l of v.lines) {
      if (l.costCentreSiteId !== siteId) continue;
      const ledger = state.ledgers.find((acc) => acc.id === l.ledgerId);
      if (!ledger) continue;
      if (ledger.nature === 'income') {
        revenuePaise += l.drCr === 'CR' ? l.amountPaise : -l.amountPaise;
      } else if (ledger.nature === 'expenses') {
        const signed = l.drCr === 'DR' ? l.amountPaise : -l.amountPaise;
        if (ledger.id === 'ldg-mat-exp') materialExpensePaise += signed;
        else if (ledger.id === 'ldg-lab-exp') labourExpensePaise += signed;
        else if (ledger.id === 'ldg-sub-exp') subconExpensePaise += signed;
        else otherExpensePaise += signed;
      }
    }
  }

  const totalCostPaise = materialExpensePaise + labourExpensePaise + subconExpensePaise + otherExpensePaise;
  const netProfitPaise = revenuePaise - totalCostPaise;
  const terms = state.siteFinancials[siteId];
  const partnerSplits = (terms?.profitShareSplit ?? []).map((rule) => ({
    partnerLabel: rule.partnerLabel,
    role: rule.role,
    sharePct: rule.sharePct,
    shareAmountPaise: applyPercentagePaise(netProfitPaise, rule.sharePct),
  }));

  return {
    siteId,
    revenuePaise,
    materialExpensePaise,
    labourExpensePaise,
    subconExpensePaise,
    otherExpensePaise,
    totalCostPaise,
    netProfitPaise,
    partnerSplits,
  };
}

