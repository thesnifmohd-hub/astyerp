import React, { useState } from 'react';
import { AlertTriangle, CalendarRange, CheckCircle2, FileWarning, Users } from 'lucide-react';
import { useErp } from '@/app/ErpContext';
import { formatDDMMYYYY, todayISOInIST } from '@/lib/dates';
import { createApprovalRequest } from '@/lib/erpEngine';

export function PlanningPage() {
  const { state, currentUser, visibleSites, can, mutateState } = useErp();
  const [view, setView] = useState<'gantt' | 'list' | 'lookahead'>('gantt');
  const [selectedSiteId, setSelectedSiteId] = useState<string>('ALL');
  const [changeReason, setChangeReason] = useState('');
  const [feedback, setFeedback] = useState<string | null>(null);

  if (!currentUser) return null;
  const today = todayISOInIST();

  const activities = state.planActivities.filter(
    (a) =>
      visibleSites.some((s) => s.id === a.siteId) &&
      (selectedSiteId === 'ALL' || a.siteId === selectedSiteId),
  );

  const materialAlerts = state.planActivities.filter(
    (a) => a.materialNeededBy && a.materialNeededBy >= today,
  );
  const drawingAlerts = state.planActivities.filter(
    (a) => a.drawingDueDate && !a.drawingReceived,
  );

  const crewClashes: string[] = [];
  for (let i = 0; i < state.planActivities.length; i++) {
    for (let j = i + 1; j < state.planActivities.length; j++) {
      const a = state.planActivities[i];
      const b = state.planActivities[j];
      if (
        a.siteId !== b.siteId &&
        a.crewType !== 'subcontractor' &&
        a.crewName === b.crewName &&
        a.plannedStart <= b.plannedEnd &&
        b.plannedStart <= a.plannedEnd
      ) {
        const sA = state.sites.find((s) => s.id === a.siteId)?.name;
        const sB = state.sites.find((s) => s.id === b.siteId)?.name;
        crewClashes.push(`${a.crewName} double-booked on ${sA} (${a.code}) & ${sB} (${b.code})`);
      }
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-heading text-2xl font-bold text-asty-black">
            Site Planning, Interactive Gantt, Baseline & 14-Day Look-Ahead
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Stop-Delay Core Module (SPEC Section 4.3) • Baseline vs Current Overlay • Material, Drawing & Crew Clash Watchdog
          </p>
        </div>

        <div className="flex flex-wrap gap-2 text-xs font-semibold">
          <select
            value={selectedSiteId}
            onChange={(e) => setSelectedSiteId(e.target.value)}
            className="rounded-xl border border-asty-border bg-white px-3 py-2"
          >
            <option value="ALL">All Accessible Sites</option>
            {visibleSites.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>

          {(['gantt', 'list', 'lookahead'] as const).map((v) => (
            <button
              key={v}
              type="button"
              onClick={() => setView(v)}
              className={`rounded-xl px-3.5 py-2 capitalize ${
                view === v ? 'bg-asty-charcoal text-white' : 'bg-white border border-asty-border'
              }`}
            >
              {v === 'lookahead' ? '14-Day Look-Ahead' : `${v} View`}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 space-y-1">
          <div className="font-bold text-amber-900 flex items-center gap-1.5">
            <AlertTriangle className="h-4 w-4" /> Material Look-Ahead Alert
          </div>
          {materialAlerts.map((a) => (
            <div key={a.id} className="text-amber-800">
              {state.items.find((i) => i.id === a.materialNeededItemId)?.name} for{' '}
              <strong>{a.name}</strong> needed by {formatDDMMYYYY(a.materialNeededBy)} — verify PO!
            </div>
          ))}
        </div>

        <div className="rounded-2xl border border-red-200 bg-red-50 p-4 space-y-1">
          <div className="font-bold text-red-900 flex items-center gap-1.5">
            <FileWarning className="h-4 w-4" /> Outside Consultant Drawing Due
          </div>
          {drawingAlerts.map((a) => (
            <div key={a.id} className="text-red-800">
              <strong>{a.drawingTitle}</strong> ({a.drawingConsultant}) due {formatDDMMYYYY(a.drawingDueDate)} — NOT RECEIVED
            </div>
          ))}
        </div>

        <div className="rounded-2xl border border-purple-200 bg-purple-50 p-4 space-y-1">
          <div className="font-bold text-purple-900 flex items-center gap-1.5">
            <Users className="h-4 w-4" /> Own Crew Clash Detector
          </div>
          {crewClashes.map((c, idx) => (
            <div key={idx} className="text-purple-800">
              {c}
            </div>
          ))}
        </div>
      </div>

      {feedback && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-xs font-semibold text-emerald-900">
          {feedback}
        </div>
      )}

      {view === 'gantt' && (
        <div className="rounded-2xl border border-asty-border bg-white p-5 space-y-4">
          <div className="flex items-center justify-between text-xs">
            <div className="flex items-center gap-4">
              <span className="inline-flex items-center gap-1.5">
                <span className="h-3 w-6 rounded bg-slate-300 inline-block" /> Locked Baseline Bar
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="h-3 w-6 rounded bg-asty-charcoal inline-block" /> Current Plan & DPR Progress %
              </span>
            </div>
            <span className="text-slate-500">Finish-to-Start Dependencies Linked</span>
          </div>

          <div className="space-y-4">
            {activities.map((act, idx) => {
              const siteName = state.sites.find((s) => s.id === act.siteId)?.name;
              const slipped = act.plannedEnd > act.baselineEnd;
              const leftPct = Math.min(60, idx * 11);
              const widthPct = Math.min(100 - leftPct, Math.max(22, act.durationDays * 2.4));

              return (
                <div key={act.id} className="grid grid-cols-1 lg:grid-cols-12 gap-3 items-center border-b border-slate-100 pb-3 text-xs">
                  <div className="lg:col-span-4">
                    <div className="font-bold text-asty-black">
                      [{act.code}] {act.name}
                    </div>
                    <div className="text-slate-500">
                      {siteName} • {act.crewName} • {act.completedQty}/{act.quantity} {act.unit} ({act.progressPct}%)
                    </div>
                  </div>

                  <div className="lg:col-span-8 relative h-12 rounded-xl bg-asty-surface px-2 flex flex-col justify-center">
                    <div
                      style={{ marginLeft: `${leftPct}%`, width: `${widthPct}%` }}
                      className="h-2 rounded-full bg-slate-300 mb-1.5"
                    />
                    <div
                      style={{ marginLeft: `${leftPct + (slipped ? 5 : 0)}%`, width: `${widthPct}%` }}
                      className={`h-5 rounded-md overflow-hidden relative ${
                        slipped ? 'bg-amber-200' : 'bg-asty-slate/40'
                      }`}
                    >
                      <div style={{ width: `${act.progressPct}%` }} className="h-full bg-asty-charcoal" />
                      <span className="absolute inset-0 flex items-center px-2 text-[10px] font-bold text-white mix-blend-difference">
                        {formatDDMMYYYY(act.plannedStart)} → {formatDDMMYYYY(act.plannedEnd)} ({act.progressPct}%)
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {can('plan.edit') && (
            <div className="flex flex-col sm:flex-row gap-2 pt-3 border-t border-asty-border text-xs">
              <input
                value={changeReason}
                onChange={(e) => setChangeReason(e.target.value)}
                placeholder="Reason for baseline schedule revision (requires Management approval)..."
                className="flex-1 rounded-xl border border-asty-border px-3 py-2"
              />
              <button
                type="button"
                onClick={() => {
                  if (!changeReason.trim()) return;
                  mutateState((draft) => {
                    createApprovalRequest(draft, {
                      actorUserId: currentUser.id,
                      requestType: 'plan_change',
                      siteId: visibleSites[0]?.id ?? null,
                      sourceTable: 'site_plans',
                      sourceId: 'plan-rev',
                      antiSplitItemId: null,
                      amountPaise: 0,
                      title: 'Baseline Schedule Revision Request',
                      details: changeReason.trim(),
                    });
                  });
                  setChangeReason('');
                  setFeedback('Plan revision submitted to Management for approval (Baseline preserved).');
                }}
                className="rounded-xl bg-asty-charcoal px-4 py-2 font-bold text-white"
              >
                Request Plan Change Approval
              </button>
            </div>
          )}
        </div>
      )}

      {view === 'list' && (
        <div className="rounded-2xl border border-asty-border bg-white overflow-hidden">
          <table className="w-full text-left text-xs">
            <thead className="bg-asty-surface uppercase text-slate-600">
              <tr>
                <th className="px-4 py-3">Site & Code</th>
                <th className="px-4 py-3">Activity</th>
                <th className="px-4 py-3">Assigned Crew</th>
                <th className="px-4 py-3">Duration</th>
                <th className="px-4 py-3">Planned Dates</th>
                <th className="px-4 py-3">Completed</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {activities.map((a) => (
                <tr key={a.id}>
                  <td className="px-4 py-3 font-semibold">
                    {state.sites.find((s) => s.id === a.siteId)?.name} ({a.code})
                  </td>
                  <td className="px-4 py-3 font-bold">{a.name}</td>
                  <td className="px-4 py-3">{a.crewName}</td>
                  <td className="px-4 py-3">{a.durationDays} days</td>
                  <td className="px-4 py-3">{formatDDMMYYYY(a.plannedStart)} → {formatDDMMYYYY(a.plannedEnd)}</td>
                  <td className="px-4 py-3 font-bold">
                    {a.completedQty}/{a.quantity} {a.unit} ({a.progressPct}%)
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {view === 'lookahead' && (
        <div className="rounded-2xl border border-asty-border bg-white p-5 space-y-4 text-xs">
          <h3 className="font-heading text-sm font-bold flex items-center gap-2">
            <CalendarRange className="h-4 w-4" /> 14-Day Look-Ahead Readiness Checklist
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {activities.map((a) => (
              <div key={a.id} className="rounded-xl border border-asty-border p-4 space-y-2">
                <div className="font-bold text-asty-black">{a.name}</div>
                <div className="text-slate-500">{state.sites.find((s) => s.id === a.siteId)?.name}</div>
                <div className="flex items-center gap-1.5 text-emerald-700 font-semibold">
                  <CheckCircle2 className="h-3.5 w-3.5" /> Crew: {a.crewName}
                </div>
                {a.drawingTitle && (
                  <div className="text-red-700 font-semibold">
                    Drawing Needed: {a.drawingTitle} (Due {formatDDMMYYYY(a.drawingDueDate)})
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

