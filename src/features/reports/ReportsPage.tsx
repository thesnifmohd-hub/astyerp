import React, { useState } from 'react';
import { Calendar, Download, Lock } from 'lucide-react';
import { useErp } from '@/app/ErpContext';
import { AstyLetterheadModal, exportRowsToExcel } from '@/components/common/AstyLetterheadModal';
import { formatDDMMYYYY, todayISOInIST } from '@/lib/dates';
import { calculateSitePnL } from '@/lib/erpEngine';
import { formatINR } from '@/lib/money';

export function ReportsPage() {
  const { state, visibleSites, can } = useErp();
  const [showTuesdayModal, setShowTuesdayModal] = useState(false);

  const canSeeProfit = can('report.profit.view');

  const sitePnlRows = visibleSites.map((s) => ({
    site: s,
    pnl: calculateSitePnL(state, s.id),
  }));

  const supervisors = state.users.filter((u) => u.positionIds.includes('pos-sup'));

  const tuesdayExcelRows = visibleSites.map((s) => ({
    SiteCode: s.code,
    SiteName: s.name,
    Health: s.scheduleHealth.toUpperCase(),
    DaysBehind: s.daysBehind,
    OpenUrgentIssues: state.dailyReports
      .filter((r) => r.siteId === s.id)
      .flatMap((r) => r.issues)
      .filter((i) => i.isUrgent && !i.resolved).length,
    PendingApprovals: state.approvalRequests.filter(
      (r) => r.siteId === s.id && r.status === 'pending',
    ).length,
  }));

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-heading text-2xl font-bold text-asty-black">
            Executive Reports, Partner Profit-Share & Tuesday Meeting Pack
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            SPEC Section 4.11 • Weekly Tuesday 7:00 AM Coordination Pack • Excel & PDF Export
          </p>
        </div>

        <div className="flex gap-2 text-xs font-semibold">
          <button
            type="button"
            onClick={() => exportRowsToExcel('Asty_Tuesday_Meeting_Pack.xlsx', 'TuesdayPack', tuesdayExcelRows)}
            className="inline-flex items-center gap-1.5 rounded-xl border border-asty-border bg-white px-3.5 py-2"
          >
            <Download className="h-3.5 w-3.5" /> Export Excel
          </button>
          <button
            type="button"
            onClick={() => setShowTuesdayModal(true)}
            className="inline-flex items-center gap-1.5 rounded-xl bg-asty-charcoal px-4 py-2 text-white"
          >
            <Calendar className="h-3.5 w-3.5" /> Open Tuesday 7 AM Meeting Pack
          </button>
        </div>
      </div>

      {/* Site-wise P&L + Partner Profit-Share (Management Only via report.profit.view) */}
      {canSeeProfit ? (
        <div className="rounded-2xl border border-asty-border bg-white overflow-hidden">
          <div className="border-b border-asty-border bg-asty-surface px-5 py-3.5 font-heading text-sm font-bold">
            Site-Wise Profit & Loss + Configurable Partner / Referral Profit-Share Statement (Management Only)
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 uppercase text-slate-600">
                <tr>
                  <th className="px-4 py-3">Site</th>
                  <th className="px-4 py-3 text-right">Billed Revenue</th>
                  <th className="px-4 py-3 text-right">Material Cost</th>
                  <th className="px-4 py-3 text-right">Own Crew Wages</th>
                  <th className="px-4 py-3 text-right">Net Site Profit</th>
                  <th className="px-4 py-3">Partner / Referral Split</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {sitePnlRows.map(({ site, pnl }) => (
                  <tr key={site.id}>
                    <td className="px-4 py-3 font-bold">{site.name}</td>
                    <td className="px-4 py-3 text-right font-mono">{formatINR(pnl.revenuePaise)}</td>
                    <td className="px-4 py-3 text-right font-mono">{formatINR(pnl.materialExpensePaise)}</td>
                    <td className="px-4 py-3 text-right font-mono">{formatINR(pnl.labourExpensePaise)}</td>
                    <td className="px-4 py-3 text-right font-mono font-bold text-emerald-800">
                      {formatINR(pnl.netProfitPaise)}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-1.5">
                        {pnl.partnerSplits.map((sp, idx) => (
                          <span key={idx} className="rounded bg-emerald-50 border border-emerald-200 px-2 py-0.5 text-[11px] font-semibold">
                            {sp.partnerLabel} ({sp.sharePct}%): {formatINR(sp.shareAmountPaise)}
                          </span>
                        ))}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="rounded-2xl border border-slate-200 bg-white p-5 flex items-center gap-3 text-xs text-slate-600">
          <Lock className="h-5 w-5 text-slate-500" />
          <span>
            Site-wise Profit & Loss and Partner Profit-Share Statements are restricted to positions with `report.profit.view`.
          </span>
        </div>
      )}

      {/* Monthly Supervisor Performance Report */}
      <div className="rounded-2xl border border-asty-border bg-white p-5 space-y-3 text-xs">
        <h3 className="font-heading text-sm font-bold">
          Supervisor Monthly Discipline & On-Time Check-In Scorecard
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {supervisors.map((sup) => {
            const supDprs = state.dailyReports.filter((r) =>
              Object.values(r.checkins).some((c) => c?.checkedInBy === sup.id),
            );
            const closedCount = supDprs.filter((r) => r.status === 'closed').length;
            return (
              <div key={sup.id} className="rounded-xl border border-asty-border p-4 flex justify-between items-center">
                <div>
                  <div className="font-bold text-sm">{sup.fullName}</div>
                  <div className="text-slate-500">
                    Assigned: {sup.assignedSiteIds.map((id) => state.sites.find((s) => s.id === id)?.name).join(', ')}
                  </div>
                </div>
                <div className="text-right">
                  <div className="font-heading text-lg font-bold text-emerald-700">
                    {closedCount} / {supDprs.length} Days Closed
                  </div>
                  <div className="text-slate-500">30-Day Window</div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <AstyLetterheadModal
        open={showTuesdayModal}
        onClose={() => setShowTuesdayModal(false)}
        documentType="WEEKLY TUESDAY 7:00 AM COORDINATION PACK"
        documentNo={`TUE-PACK/${todayISOInIST()}`}
        dateFormatted={formatDDMMYYYY(todayISOInIST())}
        excelRows={tuesdayExcelRows}
      >
        <div className="space-y-4 text-xs">
          <p className="text-slate-600">
            Generated automatically every Tuesday 07:00 AM IST for Asty Constructions&apos; 2-hour cross-department coordination meeting.
          </p>
          <table className="w-full border border-asty-border">
            <thead className="bg-asty-surface">
              <tr>
                <th className="p-2 text-left">Site</th>
                <th className="p-2 text-left">Schedule Health</th>
                <th className="p-2 text-left">Key Bottlenecks / Decisions Needed</th>
              </tr>
            </thead>
            <tbody>
              {tuesdayExcelRows.map((r) => (
                <tr key={r.SiteCode} className="border-t">
                  <td className="p-2 font-bold">{r.SiteName}</td>
                  <td className="p-2">
                    {r.Health} ({r.DaysBehind}d behind)
                  </td>
                  <td className="p-2">
                    {r.OpenUrgentIssues} urgent DPR hold-up(s) • {r.PendingApprovals} pending approval(s)
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </AstyLetterheadModal>
    </div>
  );
}
