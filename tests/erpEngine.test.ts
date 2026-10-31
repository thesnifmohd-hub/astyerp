import { describe, expect, it } from 'vitest';
import {
  calculateRaBillAmounts,
  calculateSiteItemStock,
  calculateSitePnL,
  canAccessSite,
  createApprovalRequest,
  createDraftVoucher,
  escalateStaleApprovals,
  getVisibleSiteFinancials,
  hasPermission,
  postVoucher,
  processApprovalAction,
  submitSiteCheckin,
  validateVoucherBalanced,
} from '../src/lib/erpEngine';
import { formatINR, rupeesToPaise, splitGST } from '../src/lib/money';
import { createInitialErpState } from '../src/lib/seedData';

describe('Asty ERP — Core Business Rules & Security Verification', () => {
  it('1. Enforces ₹3,000 approval limit (<= ₹3,000 approved by Ops Exec; > ₹3,000 requires Management)', () => {
    const state = createInitialErpState();

    // Case A: ₹2,500 (250,000 paise <= 300,000 paise)
    const smallReq = createApprovalRequest(state, {
      actorUserId: 'usr-sup-1',
      requestType: 'petty_cash',
      siteId: 'site-tkm',
      sourceTable: 'petty_cash',
      sourceId: 'pc-small',
      antiSplitItemId: 'itm-ply',
      amountPaise: rupeesToPaise(2500),
      title: 'Small site petty cash',
      details: 'Nails & chalk line',
    });

    // Step 1: Project Coordinator technical check (cannot final approve)
    expect(smallReq.currentPositionId).toBe('pos-coord');
    processApprovalAction(state, {
      actorUserId: 'usr-coord-1',
      requestId: smallReq.id,
      decision: 'approve',
      comment: 'Technical check OK',
    });
    expect(smallReq.status).toBe('pending');
    expect(smallReq.currentPositionId).toBe('pos-ops');

    // Step 2: Operations Executive approves <= ₹3,000 directly!
    processApprovalAction(state, {
      actorUserId: 'usr-ops-1',
      requestId: smallReq.id,
      decision: 'approve',
      comment: 'Approved within ₹3,000 limit',
    });
    expect(smallReq.status).toBe('approved');
  });

  it('2. Enforces 7-day anti-splitting rule (same site + same item within 7 days summed against ₹3,000)', () => {
    const state = createInitialErpState();
    const nowIso = '2026-10-31T08:00:00Z';

    // First request: ₹1,800 on site-tkm + itm-agg40
    const req1 = createApprovalRequest(state, {
      actorUserId: 'usr-sup-2',
      requestType: 'petty_cash',
      siteId: 'site-tkm',
      sourceTable: 'petty_cash',
      sourceId: 'pc-split-1',
      antiSplitItemId: 'itm-agg40',
      amountPaise: rupeesToPaise(1800),
      title: 'Split attempt part 1',
      details: 'Part 1',
      submittedAtIso: nowIso,
    });
    expect(req1.rolling7dAmountPaise).toBe(180000);

    // Second request 2 days later: ₹1,700 on SAME site + SAME item -> Rolling 7d sum = ₹3,500 (> ₹3,000!)
    const req2 = createApprovalRequest(state, {
      actorUserId: 'usr-sup-2',
      requestType: 'petty_cash',
      siteId: 'site-tkm',
      sourceTable: 'petty_cash',
      sourceId: 'pc-split-2',
      antiSplitItemId: 'itm-agg40',
      amountPaise: rupeesToPaise(1700),
      title: 'Split attempt part 2',
      details: 'Part 2',
      submittedAtIso: '2026-11-02T08:00:00Z',
    });
    expect(req2.rolling7dAmountPaise).toBe(350000); // ₹3,500!

    // Coordinator technical check -> moves to Ops Executive review (NOT final approval!)
    processApprovalAction(state, {
      actorUserId: 'usr-coord-1',
      requestId: req2.id,
      decision: 'approve',
      comment: 'Checked',
    });
    processApprovalAction(state, {
      actorUserId: 'usr-ops-1',
      requestId: req2.id,
      decision: 'approve',
      comment: 'Reviewed > ₹3,000 anti-split total',
    });
    // Still pending Management final approval!
    expect(req2.status).toBe('pending');
    expect(req2.currentPositionId).toBe('pos-mgmt');

    // Management grants final approval
    processApprovalAction(state, {
      actorUserId: 'usr-mgmt-1',
      requestId: req2.id,
      decision: 'approve',
      comment: 'Management final approval',
    });
    expect(req2.status).toBe('approved');
  });

  it('3. Escalates pending approvals exceeding 24-hour SLA up the reporting line', () => {
    const state = createInitialErpState();
    const staleReq = createApprovalRequest(state, {
      actorUserId: 'usr-sup-1',
      requestType: 'material_request',
      siteId: 'site-hadi',
      sourceTable: 'material_requests',
      sourceId: 'mr-stale',
      antiSplitItemId: 'itm-cement',
      amountPaise: 200000,
      title: 'Stale material request',
      details: 'Waiting > 24h',
      submittedAtIso: '2026-10-28T06:00:00Z',
    });
    expect(staleReq.currentPositionId).toBe('pos-coord');

    const count = escalateStaleApprovals(state, new Date('2026-10-30T10:00:00Z').getTime());
    expect(count).toBeGreaterThanOrEqual(1);
    expect(staleReq.currentPositionId).toBe('pos-ops'); // Project Coordinator reports to Operations Executive
    expect(staleReq.escalationLevel).toBe(1);
  });

  it('4. Calculates site stock (opening + received - used - transferredOut + transferredIn) & blocks outside-geofence check-in', () => {
    const state = createInitialErpState();
    const before = calculateSiteItemStock(state, 'site-hadi', 'itm-cement');

    // Attempt check-in 900m outside site radius -> blocked!
    expect(() =>
      submitSiteCheckin(state, {
        actorUserId: 'usr-sup-1',
        siteId: 'site-hadi',
        reportDate: '2027-01-15',
        slot: 'evening',
        lat: 10.5500,
        lng: 76.2200,
        accuracyM: 10,
        photos: [],
        tomorrowPlan: 'Test',
      }),
    ).toThrow(/Outside site radius/);

    // Valid inside-radius evening report with 3 live photos deducts 15 bags of cement
    const threePhotos = [1, 2, 3].map((i) => ({
      id: `p-${i}`,
      slot: 'evening' as const,
      dataUrl: 'data:image/jpeg;base64,stub',
      caption: `Photo ${i}`,
      capturedAt: '2027-01-15T17:30:00Z',
      lat: 10.5354,
      lng: 76.2041,
      accuracyM: 9,
    }));

    submitSiteCheckin(state, {
      actorUserId: 'usr-sup-1',
      siteId: 'site-hadi',
      reportDate: '2027-01-15',
      slot: 'evening',
      lat: 10.5354,
      lng: 76.2041,
      accuracyM: 9,
      photos: threePhotos,
      materialsUsed: [{ itemId: 'itm-cement', qtyUsed: 15 }],
      tomorrowPlan: 'Pour lintel concrete',
    });

    const after = calculateSiteItemStock(state, 'site-hadi', 'itm-cement');
    expect(after.onHand).toBe(before.onHand - 15);
  });

  it('5. Enforces double-entry voucher balancing (DR = CR) and blocks Junior Accountant from posting', () => {
    const state = createInitialErpState();

    // Unbalanced lines fail validation
    const unbalanced = validateVoucherBalanced([
      { ledgerId: 'ldg-mat-exp', costCentreSiteId: 'site-hadi', drCr: 'DR', amountPaise: 500000 },
      { ledgerId: 'ldg-hdfc', costCentreSiteId: 'HEAD_OFFICE', drCr: 'CR', amountPaise: 499900 },
    ]);
    expect(unbalanced.valid).toBe(false);

    // Junior Accountant creates balanced draft
    const draft = createDraftVoucher(state, {
      actorUserId: 'usr-jr-acc',
      voucherType: 'payment',
      voucherDate: '2026-10-31',
      narration: 'Site water tanker payment',
      lines: [
        { ledgerId: 'ldg-mat-exp', costCentreSiteId: 'site-hadi', drCr: 'DR', amountPaise: 450000 },
        { ledgerId: 'ldg-cash', costCentreSiteId: 'site-hadi', drCr: 'CR', amountPaise: 450000 },
      ],
    });
    expect(draft.status).toBe('draft');

    // Junior Accountant CANNOT post!
    expect(() => postVoucher(state, 'usr-jr-acc', draft.id)).toThrow(/voucher\.post/);

    // Accounts Head posts cleanly
    const posted = postVoucher(state, 'usr-acc-head', draft.id);
    expect(posted.status).toBe('posted');
  });

  it('6. Computes GST (CGST+SGST vs IGST), INR formatting, RA Bill cumulative maths & Site P&L + Partner Split', () => {
    expect(formatINR(10000000)).toBe('₹1,00,000');

    const intra = splitGST(10000000, 18, false);
    expect(intra.cgstPaise).toBe(900000);
    expect(intra.sgstPaise).toBe(900000);
    expect(intra.igstPaise).toBe(0);
    expect(intra.grossPaise).toBe(11800000);

    const ra = calculateRaBillAmounts({
      cumulativeWorkPaise: 300000000, // ₹30,00,000
      prevCertifiedPaise: 100000000,  // ₹10,00,000 -> This bill gross = ₹20,00,000
      retentionPct: 5,                // ₹1,00,000 retention
      advanceRecoveryPaise: 20000000, // ₹2,00,000 recovery -> Taxable = ₹17,00,000
      gstRatePct: 18,
    });
    expect(ra.thisBillGrossPaise).toBe(200000000);
    expect(ra.retentionHeldPaise).toBe(10000000);
    expect(ra.taxablePaise).toBe(170000000);
    expect(ra.totalInvoicePaise).toBe(200600000);

    // Talikulam Resort has 45 / 45 / 10 referral split
    const taliPnl = calculateSitePnL(stateWithPosted(), 'site-talikulam');
    expect(taliPnl.revenuePaise).toBe(350000000);
    expect(taliPnl.partnerSplits).toHaveLength(3);
    const splitPctSum = taliPnl.partnerSplits.reduce((s, p) => s + p.sharePct, 0);
    expect(splitPctSum).toBe(100);
  });

  it('7. Enforces RLS site scoping, profit hiding, and dynamic new position ("Site Engineer") with zero code change', () => {
    const state = createInitialErpState();

    // Supervisor 1 is assigned to Hadi & Talikulam only -> CANNOT access Wayanad or TKM, and CANNOT see contract values!
    expect(canAccessSite(state, 'usr-sup-1', 'site-hadi')).toBe(true);
    expect(canAccessSite(state, 'usr-sup-1', 'site-wayanad')).toBe(false);
    expect(getVisibleSiteFinancials(state, 'usr-sup-1', 'site-hadi')).toBeNull();
    expect(getVisibleSiteFinancials(state, 'usr-jr-acc', 'site-hadi')).toBeNull();
    expect(getVisibleSiteFinancials(state, 'usr-mgmt-1', 'site-hadi')?.contractValuePaise).toBe(285000000);

    // Dynamically add "Site Engineer" position + user at runtime without code changes
    state.positions.push({
      id: 'pos-site-eng',
      name: 'Site Engineer',
      loginType: 'field',
      deviceHint: 'Mobile',
      description: 'Added dynamically from Admin',
      reportsToPositionId: 'pos-coord',
      isSystemProtected: false,
      isActive: true,
    });
    state.positionPermissions['pos-site-eng'] = ['site.view', 'dpr.view', 'boq.view'];
    state.users.push({
      id: 'usr-site-eng-1',
      employeeCode: 'ASTY-099',
      fullName: 'Demo Site Engineer 1',
      email: 'engineer@asty.demo',
      phone: '+91 90000 00099',
      preferredLanguage: 'en',
      isActive: true,
      positionIds: ['pos-site-eng'],
      allSites: false,
      assignedSiteIds: ['site-tkm'],
    });

    expect(hasPermission(state, 'usr-site-eng-1', 'boq.view')).toBe(true);
    expect(hasPermission(state, 'usr-site-eng-1', 'report.profit.view')).toBe(false);
    expect(canAccessSite(state, 'usr-site-eng-1', 'site-tkm')).toBe(true);
    expect(canAccessSite(state, 'usr-site-eng-1', 'site-hadi')).toBe(false);
  });
});

function stateWithPosted() {
  return createInitialErpState();
}

