import React, { useState } from 'react';
import { HardHat, Plus, Users } from 'lucide-react';
import { useErp } from '@/app/ErpContext';
import { formatDDMMYYYY, todayISOInIST } from '@/lib/dates';
import { createApprovalRequest, createDraftVoucher } from '@/lib/erpEngine';
import { applyPercentagePaise, formatINR } from '@/lib/money';

export function LabourSubconPage() {
  const { state, currentUser, visibleSites, can, mutateState } = useErp();
  const [tab, setTab] = useState<'workers' | 'wages' | 'subcon'>('workers');
  const [siteId, setSiteId] = useState(visibleSites[0]?.id ?? '');
  const [measuredWoId, setMeasuredWoId] = useState(state.workOrders[0]?.id ?? '');
  const [measuredQty, setMeasuredQty] = useState(0);
  const [msg, setMsg] = useState<string | null>(null);

  if (!currentUser) return null;

  const generateWeeklyWageSheet = () => {
    const targetSiteId = siteId || visibleSites[0]?.id;
    if (!targetSiteId || state.workers.length === 0) {
      setMsg('Create a Site and add Workers first before generating a Wage Sheet.');
      return;
    }
    mutateState((draft) => {
      const grossPaise = draft.workers.slice(0, 4).reduce((s, w) => s + w.dailyWagePaise * 6, 0);
      const recoveryPaise = 0;
      const netPaise = grossPaise - recoveryPaise;
      const sheetNo = `WS/26-27/W${draft.wageSheets.length + 1}`;
      draft.wageSheets.unshift({
        id: `ws-${Date.now()}`,
        sheetNo,
        siteId: targetSiteId,
        weekStart: todayISOInIST(),
        weekEnd: todayISOInIST(),
        grossPaise,
        advanceRecoveryPaise: recoveryPaise,
        netPayablePaise: netPaise,
        status: 'pending_posting',
      });
      if (can('voucher.draft')) {
        createDraftVoucher(draft, {
          actorUserId: currentUser.id,
          voucherType: 'payment',
          voucherDate: todayISOInIST(),
          narration: `Auto-Posted Weekly Wage Sheet ${sheetNo}`,
          sourceLabel: `Wage Sheet ${sheetNo}`,
          status: 'pending_posting',
          lines: [
            { ledgerId: 'ldg-lab-exp', costCentreSiteId: targetSiteId, drCr: 'DR', amountPaise: netPaise },
            { ledgerId: 'ldg-hdfc', costCentreSiteId: 'HEAD_OFFICE', drCr: 'CR', amountPaise: netPaise },
          ],
        });
      }
    });
    setMsg('Weekly Wage Sheet generated and pushed to Accounting Pending-Posting Queue!');
  };

  const raiseSubconBill = (e: React.FormEvent) => {
    e.preventDefault();
    const wo = state.workOrders.find((w) => w.id === measuredWoId);
    if (!wo) return;
    const sub = state.subcontractors.find((s) => s.id === wo.subcontractorId);
    if (!sub) return;

    const grossPaise = Math.round(measuredQty * wo.ratePaise);
    const retentionPaise = applyPercentagePaise(grossPaise, wo.retentionPct);
    const tds194cPaise = applyPercentagePaise(grossPaise, sub.tdsRatePct);
    const netPayablePaise = grossPaise - retentionPaise - tds194cPaise;

    mutateState((draft) => {
      const billId = `sb-${Date.now()}`;
      const billNo = `SUB-B0${draft.subcontractorBills.length + 1}`;
      const apr = createApprovalRequest(draft, {
        actorUserId: currentUser.id,
        requestType: 'subcontractor_bill',
        siteId: wo.siteId,
        sourceTable: 'subcontractor_bills',
        sourceId: billId,
        antiSplitItemId: null,
        amountPaise: grossPaise,
        title: `${billNo} — ${sub.name} (${measuredQty} ${wo.unit})`,
        details: `Gross ${formatINR(grossPaise)} | Retention ${wo.retentionPct}% (${formatINR(retentionPaise)}) | TDS 194C ${sub.tdsRatePct}% (${formatINR(tds194cPaise)})`,
      });
      draft.subcontractorBills.unshift({
        id: billId,
        billNo,
        workOrderId: wo.id,
        siteId: wo.siteId,
        subcontractorId: sub.id,
        billDate: todayISOInIST(),
        measuredQty,
        grossPaise,
        retentionPaise,
        tds194cPaise,
        netPayablePaise,
        status: 'pending_approval',
        approvalRequestId: apr.id,
      });
    });
    setMsg('Measured Subcontractor Bill created (5% Retention + Section 194C TDS calculated) & sent for approval!');
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-heading text-2xl font-bold text-asty-black">
          Own Labour (Concrete & Brick Crews) & Subcontractors (194C)
        </h1>
        <p className="text-xs text-slate-500 mt-0.5">
          SPEC Sections 4.7 & 4.8 • Morning Attendance → Weekly Wage Sheet → Accounts Auto-Posting • Subcontractor Retention & TDS 194C
        </p>
      </div>

      {msg && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-xs font-semibold text-emerald-900">
          {msg}
        </div>
      )}

      <div className="flex gap-2 border-b border-asty-border pb-2 text-xs font-semibold">
        {[
          { id: 'workers', label: `Own Crew Workers (${state.workers.length})` },
          { id: 'wages', label: 'Weekly Wage Sheets' },
          { id: 'subcon', label: `Subcontractors (${state.subcontractors.length}), Work Orders & 194C Ledger` },
        ].map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => setTab(item.id as typeof tab)}
            className={`rounded-lg px-4 py-2 ${
              tab === item.id ? 'bg-asty-charcoal text-white' : 'bg-white border border-asty-border'
            }`}
          >
            {item.label}
          </button>
        ))}
      </div>

      {tab === 'workers' && (
        <div className="rounded-2xl border border-asty-border bg-white overflow-hidden">
          <table className="w-full text-left text-xs">
            <thead className="bg-asty-surface uppercase text-slate-600">
              <tr>
                <th className="px-4 py-3">Code & Worker</th>
                <th className="px-4 py-3">Own Crew</th>
                <th className="px-4 py-3">Trade</th>
                <th className="px-4 py-3 text-right">Daily Wage</th>
                <th className="px-4 py-3 text-right">Advance Balance</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {state.workers.map((w) => (
                <tr key={w.id}>
                  <td className="px-4 py-3 font-bold">
                    {w.code} — {w.fullName}
                  </td>
                  <td className="px-4 py-3">{w.crewName}</td>
                  <td className="px-4 py-3 capitalize">{w.trade.replace('_', ' ')}</td>
                  <td className="px-4 py-3 text-right font-mono">{formatINR(w.dailyWagePaise)}/day</td>
                  <td className="px-4 py-3 text-right font-bold text-amber-800">
                    {formatINR(w.advanceBalancePaise)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {tab === 'wages' && (
        <div className="space-y-4 text-xs">
          <div className="rounded-2xl border border-asty-border bg-white p-4 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Users className="h-4 w-4" />
              <span className="font-bold">Generate Weekly Wage Sheet from Morning Check-In Attendance:</span>
            </div>
            <div className="flex gap-2">
              <select
                value={siteId}
                onChange={(e) => setSiteId(e.target.value)}
                className="rounded-lg border border-asty-border px-3 py-2 font-semibold"
              >
                {visibleSites.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
              {can('labour.edit') && (
                <button
                  type="button"
                  onClick={generateWeeklyWageSheet}
                  className="inline-flex items-center gap-1 rounded-lg bg-asty-charcoal px-4 py-2 font-bold text-white"
                >
                  <Plus className="h-3.5 w-3.5" /> Generate Wage Sheet
                </button>
              )}
            </div>
          </div>

          <div className="rounded-2xl border border-asty-border bg-white overflow-hidden">
            <table className="w-full text-left text-xs">
              <thead className="bg-asty-surface uppercase text-slate-600">
                <tr>
                  <th className="px-4 py-3">Sheet No</th>
                  <th className="px-4 py-3">Site</th>
                  <th className="px-4 py-3 text-right">Gross Wages</th>
                  <th className="px-4 py-3 text-right">Advance Deducted</th>
                  <th className="px-4 py-3 text-right">Net Payable</th>
                  <th className="px-4 py-3">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {state.wageSheets.map((ws) => (
                  <tr key={ws.id}>
                    <td className="px-4 py-3 font-mono font-bold">{ws.sheetNo}</td>
                    <td className="px-4 py-3">{state.sites.find((s) => s.id === ws.siteId)?.name}</td>
                    <td className="px-4 py-3 text-right">{formatINR(ws.grossPaise)}</td>
                    <td className="px-4 py-3 text-right text-amber-800">-{formatINR(ws.advanceRecoveryPaise)}</td>
                    <td className="px-4 py-3 text-right font-bold">{formatINR(ws.netPayablePaise)}</td>
                    <td className="px-4 py-3 uppercase font-bold text-[10px]">{ws.status}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === 'subcon' && (
        <div className="space-y-5 text-xs">
          {can('subcon.edit') && (
            <form onSubmit={raiseSubconBill} className="rounded-2xl border border-asty-border bg-white p-5 space-y-3">
              <h3 className="font-heading text-sm font-bold flex items-center gap-1.5">
                <HardHat className="h-4 w-4" /> Record Measured Subcontractor Bill (Auto-Calculates Retention & TDS 194C)
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <select
                  value={measuredWoId}
                  onChange={(e) => setMeasuredWoId(e.target.value)}
                  className="rounded-lg border border-asty-border px-3 py-2"
                >
                  {state.workOrders.map((wo) => (
                    <option key={wo.id} value={wo.id}>
                      {wo.woNo} — {wo.scope} ({formatINR(wo.ratePaise)}/{wo.unit})
                    </option>
                  ))}
                </select>
                <input
                  type="number"
                  min={1}
                  value={measuredQty}
                  onChange={(e) => setMeasuredQty(Number(e.target.value))}
                  placeholder="Measured Quantity"
                  className="rounded-lg border border-asty-border px-3 py-2"
                />
                <button type="submit" className="rounded-lg bg-asty-charcoal px-4 py-2 font-bold text-white">
                  Submit Measured Bill
                </button>
              </div>
            </form>
          )}

          <div className="rounded-2xl border border-asty-border bg-white overflow-hidden">
            <table className="w-full text-left text-xs">
              <thead className="bg-asty-surface uppercase text-slate-600">
                <tr>
                  <th className="px-4 py-3">Bill & Date</th>
                  <th className="px-4 py-3">Subcontractor & PAN</th>
                  <th className="px-4 py-3 text-right">Gross Measured</th>
                  <th className="px-4 py-3 text-right">Retention Held</th>
                  <th className="px-4 py-3 text-right">TDS 194C</th>
                  <th className="px-4 py-3 text-right">Net Payable</th>
                  <th className="px-4 py-3">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {state.subcontractorBills.map((b) => {
                  const sub = state.subcontractors.find((s) => s.id === b.subcontractorId);
                  return (
                    <tr key={b.id}>
                      <td className="px-4 py-3 font-mono font-bold">
                        {b.billNo} ({formatDDMMYYYY(b.billDate)})
                      </td>
                      <td className="px-4 py-3">
                        <div className="font-semibold">{sub?.name}</div>
                        <div className="text-slate-500">PAN: {sub?.pan} • 194C @ {sub?.tdsRatePct}%</div>
                      </td>
                      <td className="px-4 py-3 text-right">{formatINR(b.grossPaise)}</td>
                      <td className="px-4 py-3 text-right text-amber-800">{formatINR(b.retentionPaise)}</td>
                      <td className="px-4 py-3 text-right text-blue-800">{formatINR(b.tds194cPaise)}</td>
                      <td className="px-4 py-3 text-right font-bold">{formatINR(b.netPayablePaise)}</td>
                      <td className="px-4 py-3 uppercase font-bold text-[10px]">{b.status}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

