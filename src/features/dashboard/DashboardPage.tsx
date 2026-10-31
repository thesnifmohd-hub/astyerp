import React from 'react';
import { Link, Navigate } from 'react-router-dom';
import {
  AlertTriangle,
  ArrowRight,
  Building2,
  Camera,
  CheckCircle2,
  Clock,
  IndianRupee,
  Send,
} from 'lucide-react';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { useErp } from '@/app/ErpContext';
import { formatDDMMYYYY, todayISOInIST } from '@/lib/dates';
import { calculateSitePnL } from '@/lib/erpEngine';
import { formatINR } from '@/lib/money';

export function DashboardPage() {
  const { state, currentUser, visibleSites, can, mutateState } = useErp();
  const today = todayISOInIST();

  if (!currentUser) return null;
  if (can('client_portal.view') && !can('dpr.create') && !can('approval.approve')) {
    return <Navigate to="/portal" replace />;
  }

  const canSeeProfit = can('report.profit.view');
  const canSeeAccounts = can('voucher.view');

  const pendingApprovals = state.approvalRequests.filter((r) => r.status === 'pending');
  const myInboxApprovals = pendingApprovals.filter((r) =>
    currentUser.positionIds.includes(r.currentPositionId),
  );

  const urgentIssues = state.dailyReports
    .filter((r) => visibleSites.some((s) => s.id === r.siteId))
    .flatMap((r) =>
      r.issues
        .filter((i) => i.isUrgent && !i.resolved)
        .map((i) => ({ ...i, siteId: r.siteId, reportDate: r.reportDate })),
    );

  // Cash, Receivables & Payables Summary (Opening + Posted Vouchers)
  const computeLedgerClosingSigned = (ledgerId: string): number => {
    const ldg = state.ledgers.find((l) => l.id === ledgerId);
    if (!ldg) return 0;
    let signed = ldg.openingDrCr === 'DR' ? ldg.openingBalancePaise : -ldg.openingBalancePaise;
    for (const v of state.vouchers) {
      if (v.status !== 'posted') continue;
      for (const line of v.lines) {
        if (line.ledgerId === ledgerId) {
          signed += line.drCr === 'DR' ? line.amountPaise : -line.amountPaise;
        }
      }
    }
    return signed;
  };
  const bankCashPaise =
    computeLedgerClosingSigned('ldg-hdfc') +
    computeLedgerClosingSigned('ldg-fed') +
    computeLedgerClosingSigned('ldg-cash');
  const totalReceivablePaise = state.clientBills.reduce(
    (s, b) => s + Math.max(0, b.totalInvoicePaise - b.receivedPaise),
    0,
  );
  const totalPayablePaise = Math.max(0, -computeLedgerClosingSigned('ldg-ap'));

  const chartData = visibleSites.map((s) => {
    const pnl = calculateSitePnL(state, s.id);
    return {
      name: s.name,
      BilledLakhs: Math.round(pnl.revenuePaise / 100000) / 100,
      CostLakhs: Math.round(pnl.totalCostPaise / 100000) / 100,
    };
  });

  const latestPhotos = state.dailyReports
    .filter((r) => visibleSites.some((s) => s.id === r.siteId))
    .slice(0, 6)
    .flatMap((r) => {
      const site = state.sites.find((s) => s.id === r.siteId);
      return Object.values(r.checkins).flatMap((c) =>
        (c?.photos ?? []).slice(0, 1).map((p) => ({
          ...p,
          siteName: site?.name ?? '',
          reportDate: r.reportDate,
        })),
      );
    })
    .slice(0, 4);

  const trigger8pmSummary = () => {
    mutateState((draft) => {
      const targetPosIds = draft.positions
        .filter((p) => p.loginType === 'management' || p.name === 'Operations Executive')
        .map((p) => p.id);
      const closedToday = draft.dailyReports.filter(
        (r) => r.reportDate === today && r.status === 'closed',
      ).length;
      draft.notifications.unshift({
        id: `ntf-8pm-${Date.now()}`,
        targetPositionIds: targetPosIds,
        title: `8:00 PM All-Sites Summary (${formatDDMMYYYY(today)})`,
        body: `${closedToday}/${draft.sites.length} sites closed evening DPR • ${urgentIssues.length} urgent hold-up(s) • ${pendingApprovals.length} pending approvals.`,
        priority: 'high',
        createdAt: new Date().toISOString(),
        readByUserIds: [],
      });
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-heading text-2xl font-bold text-asty-black">
            Operations & Site Control Dashboard
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Live Status for {formatDDMMYYYY(today)} (Asia/Kolkata) • Scoped to {visibleSites.length} accessible site(s)
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          {can('dpr.create') && (
            <Link
              to="/dpr"
              className="inline-flex items-center gap-2 rounded-xl bg-asty-charcoal px-4 py-2.5 text-xs font-semibold text-white hover:bg-asty-black"
            >
              <Camera className="h-4 w-4" />
              Open Daily Check-In PWA
            </Link>
          )}
          {(can('report.operations.view') || canSeeProfit) && (
            <button
              type="button"
              onClick={trigger8pmSummary}
              className="inline-flex items-center gap-1.5 rounded-xl border border-asty-border bg-white px-3.5 py-2.5 text-xs font-semibold text-asty-charcoal hover:bg-slate-50"
            >
              <Send className="h-3.5 w-3.5" />
              Run 8:00 PM Daily Summary Job
            </button>
          )}
        </div>
      </div>

      {/* Urgent Hold-Ups Banner */}
      {urgentIssues.length > 0 && (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-start gap-3">
            <AlertTriangle className="h-5 w-5 text-red-600 shrink-0 mt-0.5" />
            <div>
              <div className="text-sm font-bold text-red-900">
                {urgentIssues.length} Urgent Site Hold-Up Requires Immediate Attention
              </div>
              {urgentIssues.map((iss) => {
                const siteName = state.sites.find((s) => s.id === iss.siteId)?.name;
                return (
                  <div key={iss.id} className="text-xs text-red-800 mt-0.5">
                    <strong>{siteName}:</strong> {iss.description}
                  </div>
                );
              })}
            </div>
          </div>
          <Link
            to="/dpr"
            className="inline-flex items-center gap-1 rounded-lg bg-red-600 px-3 py-2 text-xs font-semibold text-white hover:bg-red-700 shrink-0"
          >
            Inspect DPR <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>
      )}

      {/* Executive KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <div className="rounded-2xl border border-asty-border bg-white p-4">
          <div className="text-xs font-medium text-slate-500">Sites Behind / At Risk Today</div>
          <div className="mt-2 flex items-baseline justify-between">
            <span className="font-heading text-2xl font-bold text-asty-black">
              {visibleSites.filter((s) => s.scheduleHealth !== 'on_track').length} / {visibleSites.length}
            </span>
            <span className="text-xs font-semibold text-amber-700">Stop-Delay Priority</span>
          </div>
        </div>

        <div className="rounded-2xl border border-asty-border bg-white p-4">
          <div className="text-xs font-medium text-slate-500">My Pending Approvals</div>
          <div className="mt-2 flex items-baseline justify-between">
            <span className="font-heading text-2xl font-bold text-asty-black">
              {myInboxApprovals.length}
            </span>
            <Link to="/approvals" className="text-xs font-semibold text-asty-charcoal underline">
              {pendingApprovals.length} total open
            </Link>
          </div>
        </div>

        {canSeeAccounts && (
          <>
            <div className="rounded-2xl border border-asty-border bg-white p-4">
              <div className="text-xs font-medium text-slate-500">Bank & Cash Position</div>
              <div className="mt-2 flex items-center gap-1 font-heading text-2xl font-bold text-emerald-700">
                {formatINR(bankCashPaise)}
              </div>
            </div>
            <div className="rounded-2xl border border-asty-border bg-white p-4">
              <div className="text-xs font-medium text-slate-500">Receivables vs Payables</div>
              <div className="mt-2 text-sm font-bold text-asty-black">
                AR: {formatINR(totalReceivablePaise)}
              </div>
              <div className="text-xs text-slate-500 mt-0.5">
                AP: {formatINR(totalPayablePaise)}
              </div>
            </div>
          </>
        )}
      </div>

      {/* Live All-Sites Status Table (SPEC Section 4.11 First Screen) */}
      <div className="rounded-2xl border border-asty-border bg-white overflow-hidden">
        <div className="border-b border-asty-border px-5 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Building2 className="h-4 w-4 text-asty-charcoal" />
            <h2 className="font-heading text-base font-bold text-asty-black">
              Today&apos;s All-Sites Schedule & Check-In Matrix ({formatDDMMYYYY(today)})
            </h2>
          </div>
          <Link to="/planning" className="text-xs font-semibold text-asty-charcoal hover:underline">
            View Gantt & 14-Day Look-Ahead →
          </Link>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-asty-surface text-slate-600 uppercase">
              <tr>
                <th className="px-4 py-3">Site</th>
                <th className="px-4 py-3">Schedule Status</th>
                <th className="px-4 py-3">Morning (8–10)</th>
                <th className="px-4 py-3">Afternoon (12:30–2:30)</th>
                <th className="px-4 py-3">Evening (4:30–7)</th>
                {canSeeProfit && <th className="px-4 py-3 text-right">Contract / PMC</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {visibleSites.map((site) => {
                const todayDpr = state.dailyReports.find(
                  (r) => r.siteId === site.id && r.reportDate === today,
                );
                const fin = state.siteFinancials[site.id];
                const renderSlot = (slot: 'morning' | 'afternoon' | 'evening') => {
                  const ck = todayDpr?.checkins[slot];
                  if (ck) {
                    return (
                      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-0.5 font-semibold text-emerald-700">
                        <CheckCircle2 className="h-3.5 w-3.5" /> Done ({ck.photos.length} ph)
                      </span>
                    );
                  }
                  return (
                    <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2.5 py-0.5 font-medium text-amber-800">
                      <Clock className="h-3.5 w-3.5" /> Pending
                    </span>
                  );
                };

                return (
                  <tr key={site.id} className="hover:bg-slate-50/80">
                    <td className="px-4 py-3">
                      <div className="font-semibold text-sm text-asty-black">{site.name}</div>
                      <div className="text-[11px] text-slate-500">
                        {site.code} • {site.siteAddress}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex items-center rounded-full px-2.5 py-0.5 font-bold uppercase text-[10px] ${
                          site.scheduleHealth === 'on_track'
                            ? 'bg-emerald-100 text-emerald-800'
                            : site.scheduleHealth === 'at_risk'
                              ? 'bg-amber-100 text-amber-800'
                              : 'bg-red-100 text-red-800'
                        }`}
                      >
                        {site.scheduleHealth.replace('_', ' ')}
                        {site.daysBehind > 0 ? ` (${site.daysBehind}d behind)` : ''}
                      </span>
                    </td>
                    <td className="px-4 py-3">{renderSlot('morning')}</td>
                    <td className="px-4 py-3">{renderSlot('afternoon')}</td>
                    <td className="px-4 py-3">{renderSlot('evening')}</td>
                    {canSeeProfit && (
                      <td className="px-4 py-3 text-right font-semibold text-asty-charcoal">
                        {site.contractType === 'pmc_percent'
                          ? `PMC ${fin?.pmcFeePct}% (${formatINR(fin?.contractValuePaise ?? 0)})`
                          : formatINR(fin?.contractValuePaise ?? 0)}
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Bottom Grid: Profit Chart (Management Only) + Pending Approvals + Latest Stamped Photos */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {canSeeProfit && (
          <div className="lg:col-span-6 rounded-2xl border border-asty-border bg-white p-5">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="font-heading text-sm font-bold text-asty-black flex items-center gap-1.5">
                  <IndianRupee className="h-4 w-4" />
                  Site Revenue vs Direct Cost (₹ Lakhs)
                </h3>
                <p className="text-[11px] text-slate-500">Visible only with report.profit.view permission</p>
              </div>
            </div>
            <div className="h-56">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
                  <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Bar dataKey="BilledLakhs" name="Billed (₹L)" fill="#1D2527" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="CostLakhs" name="Direct Cost (₹L)" fill="#8DA1B1" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        <div className={`${canSeeProfit ? 'lg:col-span-6' : 'lg:col-span-12'} rounded-2xl border border-asty-border bg-white p-5`}>
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-heading text-sm font-bold text-asty-black">
              Latest Stamped Live Site Photos
            </h3>
            <Link to="/dpr" className="text-xs font-semibold text-asty-charcoal underline">
              All DPRs →
            </Link>
          </div>
          <div className="grid grid-cols-2 gap-3">
            {latestPhotos.map((ph) => (
              <div key={ph.id} className="rounded-xl overflow-hidden border border-asty-border bg-slate-900">
                <img src={ph.dataUrl} alt={ph.caption} className="h-28 w-full object-cover" />
                <div className="bg-white p-2 text-[11px]">
                  <div className="font-bold text-asty-black truncate">{ph.siteName}</div>
                  <div className="text-slate-500 truncate">{ph.caption}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

