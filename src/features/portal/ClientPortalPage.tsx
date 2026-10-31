import React from 'react';
import { CheckCircle2, Shield } from 'lucide-react';
import { useErp } from '@/app/ErpContext';
import { formatDDMMYYYY } from '@/lib/dates';
import { formatINR } from '@/lib/money';

export function ClientPortalPage() {
  const { state, visibleSites, can, mutateState } = useErp();
  const site = visibleSites[0];

  if (!site) {
    return (
      <div className="rounded-2xl border border-asty-border bg-white p-8 text-center text-sm text-slate-500">
        No client site linked to this profile.
      </div>
    );
  }

  const photos = state.dailyReports
    .filter((r) => r.siteId === site.id)
    .slice(0, 6)
    .flatMap((r) => Object.values(r.checkins).flatMap((c) => c?.photos ?? []))
    .slice(0, 6);

  const bills = state.clientBills.filter((b) => b.siteId === site.id);
  const extraWorks = state.extraWorkItems.filter((e) => e.siteId === site.id);

  return (
    <div className="space-y-6">
      <div className="rounded-2xl bg-asty-charcoal p-6 text-white flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="inline-flex items-center gap-1.5 text-xs text-asty-slate font-semibold">
            <Shield className="h-4 w-4" /> Asty Constructions — Client Transparency Portal
          </div>
          <h1 className="font-heading text-2xl font-bold mt-1">{site.name}</h1>
          <p className="text-xs text-asty-slate">{site.siteAddress}</p>
        </div>
      </div>

      {/* Extra Work Client Approval (SPEC Section 4.5 — Required Before Work Starts) */}
      {extraWorks.length > 0 && (
        <div className="rounded-2xl border border-asty-border bg-white p-5 space-y-3 text-xs">
          <h2 className="font-heading text-sm font-bold">
            Extra Work Written / OTP Approval Required Before Execution
          </h2>
          {extraWorks.map((ew) => (
            <div key={ew.id} className="rounded-xl border border-asty-border p-4 flex flex-wrap items-center justify-between gap-3">
              <div>
                <div className="font-bold text-sm">{ew.ewoNo} — {ew.description}</div>
                <div className="text-slate-600 mt-0.5">Estimated Value: {formatINR(ew.estimatePaise)}</div>
              </div>
              {ew.clientApproved ? (
                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-3 py-1 font-bold text-emerald-800">
                  <CheckCircle2 className="h-4 w-4" /> Client Approved
                </span>
              ) : (
                can('client_portal.approve_extra') && (
                  <button
                    type="button"
                    onClick={() =>
                      mutateState((draft) => {
                        const item = draft.extraWorkItems.find((x) => x.id === ew.id);
                        if (item) {
                          item.clientApproved = true;
                          item.status = 'approved';
                        }
                      })
                    }
                    className="rounded-xl bg-asty-charcoal px-4 py-2.5 font-bold text-white"
                  >
                    Approve Extra Work via OTP
                  </button>
                )
              )}
            </div>
          ))}
        </div>
      )}

      {/* Approved Client Invoices */}
      <div className="rounded-2xl border border-asty-border bg-white p-5 space-y-3 text-xs">
        <h2 className="font-heading text-sm font-bold">Approved Project Invoices</h2>
        {bills.map((b) => (
          <div key={b.id} className="flex justify-between rounded-xl bg-asty-surface p-3.5">
            <div>
              <div className="font-bold">{b.invoiceNo} ({b.billType.replace(/_/g, ' ').toUpperCase()})</div>
              <div className="text-slate-500">Dated {formatDDMMYYYY(b.invoiceDate)}</div>
            </div>
            <div className="text-right">
              <div className="font-mono font-bold text-sm">{formatINR(b.totalInvoicePaise)}</div>
              <div className="uppercase text-[10px] font-bold text-emerald-700">{b.status}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Stamped Site Progress Photos */}
      <div className="rounded-2xl border border-asty-border bg-white p-5 space-y-3">
        <h2 className="font-heading text-sm font-bold">Verified GPS-Stamped Site Progress Photos</h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {photos.map((p) => (
            <div key={p.id} className="rounded-xl overflow-hidden border border-asty-border">
              <img src={p.dataUrl} alt={p.caption} className="h-40 w-full object-cover" />
              <div className="p-2.5 text-xs font-medium">{p.caption}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

