import React, { useState } from 'react';
import { Calculator, FileSpreadsheet, Lock, Printer, Upload } from 'lucide-react';
import * as XLSX from 'xlsx';
import { useErp } from '@/app/ErpContext';
import { AstyLetterheadModal, exportRowsToExcel } from '@/components/common/AstyLetterheadModal';
import { formatDDMMYYYY, todayISOInIST } from '@/lib/dates';
import { formatINR } from '@/lib/money';

export function BoqPage() {
  const { state, visibleSites, can, mutateState } = useErp();
  const [siteId, setSiteId] = useState(visibleSites[0]?.id ?? 'site-hadi');
  const [quoteStyle, setQuoteStyle] = useState<'commercial_11_col' | 'residential_boq' | 'residential_sqft'>('commercial_11_col');
  const [showQuoteModal, setShowQuoteModal] = useState(false);

  const activeSite = visibleSites.find((s) => s.id === siteId) ?? visibleSites[0];
  const boq = state.boqVersions.find((b) => b.siteId === activeSite?.id);
  const site = activeSite;
  const canSeeProfit = can('report.profit.view');

  if (!site) {
    return (
      <div className="rounded-2xl border border-asty-border bg-white p-8 text-center space-y-2">
        <div className="font-heading text-lg font-bold text-asty-black">No Sites Available for BOQ</div>
        <p className="text-xs text-slate-500">Create a construction site in Site Master first to build its BOQ and Quotation.</p>
      </div>
    );
  }

  if (!boq) {
    return (
      <div className="rounded-2xl border border-asty-border bg-white p-8 text-center space-y-4">
        <div className="font-heading text-lg font-bold text-asty-black">No BOQ Created for {site.name}</div>
        <p className="text-xs text-slate-500">Initialize a clean Version 1 BOQ & Rate Sheet for {site.name} to start estimating.</p>
        {can('boq.edit') && (
          <button
            type="button"
            onClick={() =>
              mutateState((draft) => {
                draft.boqVersions.push({
                  id: `boqv-${site.id}-v1`,
                  siteId: site.id,
                  versionNo: 1,
                  projectType: site.projectType,
                  builtUpAreaSqft: 0,
                  status: 'draft',
                  isLocked: false,
                  rateSheet: {
                    cementBagPaise: 0,
                    mSandCftPaise: 0,
                    agg20mmCftPaise: 0,
                    steelKgPaise: 0,
                    rmcM25M3Paise: 0,
                    rmcM30M3Paise: 0,
                    masonDayPaise: 0,
                    helperDayPaise: 0,
                    carpenterDayPaise: 0,
                    barBenderDayPaise: 0,
                    shutteringSqmPaise: 0,
                    stagingSqmPaise: 0,
                    mixerDayPaise: 0,
                    lateriteStonePaise: 0,
                    floorHeightM: 3,
                    wastagePct: 0,
                    profitPct: 0,
                  },
                  items: [],
                  totalCostPaise: 0,
                  quotedTotalPaise: 0,
                  roundedTotalPaise: 0,
                });
              })
            }
            className="rounded-xl bg-asty-charcoal px-4 py-2.5 text-xs font-bold text-white"
          >
            Initialize Clean BOQ (v1)
          </button>
        )}
      </div>
    );
  }

  const totalConcreteM3 = boq.items.reduce((s, r) => s + r.concreteM3, 0);
  const totalSteelKg = boq.items.reduce((s, r) => s + r.steelKg, 0);
  const totalFormworkM2 = boq.items.reduce((s, r) => s + r.formworkM2, 0);
  const totalMasonryNos = boq.items.reduce((s, r) => s + r.masonryQty, 0);
  const estCementBags = Math.ceil(totalConcreteM3 * 8 + totalMasonryNos * 0.08);
  const estMSandCft = Math.ceil(totalConcreteM3 * 15.5 + totalMasonryNos * 0.35);
  const estAgg20Cft = Math.ceil(totalConcreteM3 * 31);

  const handleImportExcel = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const buf = await file.arrayBuffer();
    const wb = XLSX.read(buf);
    const sheet = wb.Sheets[wb.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet);
    if (rows.length === 0) return;

    mutateState((draft) => {
      const nextVer = draft.boqVersions.filter((v) => v.siteId === site.id).length + 1;
      draft.boqVersions.unshift({
        ...structuredClone(boq),
        id: `boqv-${site.id}-v${nextVer}`,
        versionNo: nextVer,
        isLocked: false,
        status: 'draft',
      });
    });
  };

  const quotationRows = boq.items.map((it, idx) => ({
    SlNo: idx + 1,
    Stage: it.stageName,
    WorkType: it.workType,
    Grade: it.concreteGrade,
    Concrete_m3: it.concreteM3,
    Formwork_m2: it.formworkM2,
    Steel_kg: it.steelKg,
    Staging_m2: it.stagingM2,
    PourDays: it.pourDays,
    QuotedAmount_INR: formatINR(it.quotedAmountPaise),
  }));

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-heading text-2xl font-bold text-asty-black">
            BOQ, Rate Sheet, Material Purchase List & Quotation
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Residential / Commercial Defaults • Versioned & Locked on Approval • 11-Column Commercial & Residential Quotations
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 text-xs">
          <select
            value={siteId}
            onChange={(e) => setSiteId(e.target.value)}
            className="rounded-xl border border-asty-border bg-white px-3.5 py-2 font-bold"
          >
            {visibleSites.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name} ({s.projectType})
              </option>
            ))}
          </select>

          {can('boq.edit') && (
            <label className="inline-flex items-center gap-1.5 rounded-xl border border-asty-border bg-white px-3.5 py-2 font-semibold cursor-pointer hover:bg-slate-50">
              <Upload className="h-3.5 w-3.5" />
              Import BOQ Excel
              <input type="file" accept=".xlsx,.xls,.csv" onChange={handleImportExcel} className="hidden" />
            </label>
          )}

          <button
            type="button"
            onClick={() => exportRowsToExcel(`${site.code}_BOQ_v${boq.versionNo}.xlsx`, 'BOQ', quotationRows)}
            className="inline-flex items-center gap-1.5 rounded-xl border border-asty-border bg-white px-3.5 py-2 font-semibold hover:bg-slate-50"
          >
            <FileSpreadsheet className="h-3.5 w-3.5" />
            Export Excel
          </button>

          <button
            type="button"
            onClick={() => setShowQuoteModal(true)}
            className="inline-flex items-center gap-1.5 rounded-xl bg-asty-charcoal px-4 py-2 font-semibold text-white hover:bg-asty-black"
          >
            <Printer className="h-3.5 w-3.5" />
            Generate Quotation PDF
          </button>
        </div>
      </div>

      <div className="rounded-2xl border border-asty-border bg-white p-5 space-y-4 text-xs">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Calculator className="h-4 w-4 text-asty-charcoal" />
            <span className="font-heading text-sm font-bold">
              {site.name} — BOQ v{boq.versionNo} ({boq.projectType.toUpperCase()} • Floor Height {boq.rateSheet.floorHeightM}m • {boq.builtUpAreaSqft} sq.ft)
            </span>
          </div>
          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-3 py-1 font-bold text-emerald-900">
            <Lock className="h-3.5 w-3.5" /> {boq.isLocked ? 'Approved & Locked Baseline' : 'Editable Draft'}
          </span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-6 gap-2.5">
          <div className="rounded-xl bg-asty-surface p-2.5">
            <div className="text-slate-500">Cement / Bag</div>
            <div className="font-bold">{formatINR(boq.rateSheet.cementBagPaise)}</div>
          </div>
          <div className="rounded-xl bg-asty-surface p-2.5">
            <div className="text-slate-500">M-Sand / cft</div>
            <div className="font-bold">{formatINR(boq.rateSheet.mSandCftPaise)}</div>
          </div>
          <div className="rounded-xl bg-asty-surface p-2.5">
            <div className="text-slate-500">Steel / kg</div>
            <div className="font-bold">{formatINR(boq.rateSheet.steelKgPaise)}</div>
          </div>
          <div className="rounded-xl bg-asty-surface p-2.5">
            <div className="text-slate-500">Mason / Day</div>
            <div className="font-bold">{formatINR(boq.rateSheet.masonDayPaise)}</div>
          </div>
          <div className="rounded-xl bg-asty-surface p-2.5">
            <div className="text-slate-500">Helper / Day</div>
            <div className="font-bold">{formatINR(boq.rateSheet.helperDayPaise)}</div>
          </div>
          <div className="rounded-xl bg-asty-surface p-2.5">
            <div className="text-slate-500">Wastage Norm</div>
            <div className="font-bold">{boq.rateSheet.wastagePct}%</div>
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-asty-border bg-white overflow-x-auto">
        <table className="w-full text-left text-xs">
          <thead className="bg-asty-surface uppercase text-slate-600">
            <tr>
              <th className="px-3 py-3">#</th>
              <th className="px-3 py-3">Stage / Work Type</th>
              <th className="px-3 py-3">Grade</th>
              <th className="px-3 py-3 text-right">Concrete (m³)</th>
              <th className="px-3 py-3 text-right">Formwork (m²)</th>
              <th className="px-3 py-3 text-right">Steel (kg)</th>
              <th className="px-3 py-3 text-right">Staging (m²)</th>
              <th className="px-3 py-3 text-right">Pour Days</th>
              {canSeeProfit && <th className="px-3 py-3 text-right">Direct Cost</th>}
              <th className="px-3 py-3 text-right">Quoted Value</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {boq.items.map((row, idx) => (
              <tr key={row.id}>
                <td className="px-3 py-3 font-mono">{idx + 1}</td>
                <td className="px-3 py-3 font-semibold">{row.stageName}</td>
                <td className="px-3 py-3">{row.concreteGrade}</td>
                <td className="px-3 py-3 text-right">{row.concreteM3}</td>
                <td className="px-3 py-3 text-right">{row.formworkM2}</td>
                <td className="px-3 py-3 text-right">{row.steelKg}</td>
                <td className="px-3 py-3 text-right">{row.stagingM2}</td>
                <td className="px-3 py-3 text-right">{row.pourDays}</td>
                {canSeeProfit && (
                  <td className="px-3 py-3 text-right text-slate-600">{formatINR(row.totalCostPaise)}</td>
                )}
                <td className="px-3 py-3 text-right font-bold">{formatINR(row.quotedAmountPaise)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot className="bg-asty-surface font-bold">
            <tr>
              <td colSpan={3} className="px-3 py-3">
                ROUNDED QUOTATION TOTAL ({formatINR(Math.round(boq.roundedTotalPaise / boq.builtUpAreaSqft))}/sq.ft)
              </td>
              <td className="px-3 py-3 text-right">{totalConcreteM3} m³</td>
              <td className="px-3 py-3 text-right">{totalFormworkM2} m²</td>
              <td className="px-3 py-3 text-right">{totalSteelKg} kg</td>
              <td colSpan={2} />
              {canSeeProfit && <td className="px-3 py-3 text-right">{formatINR(boq.totalCostPaise)}</td>}
              <td className="px-3 py-3 text-right text-sm">{formatINR(boq.roundedTotalPaise)}</td>
            </tr>
          </tfoot>
        </table>
      </div>

      <div className="rounded-2xl border border-asty-border bg-white p-5">
        <h3 className="font-heading text-sm font-bold mb-3">
          Automatic Material Purchase List (Derived from Approved BOQ)
        </h3>
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 text-xs">
          <div className="rounded-xl border border-asty-border p-3">
            <div className="text-slate-500">Total Cement</div>
            <div className="font-heading text-lg font-bold">{estCementBags} bags</div>
          </div>
          <div className="rounded-xl border border-asty-border p-3">
            <div className="text-slate-500">Washed M-Sand</div>
            <div className="font-heading text-lg font-bold">{estMSandCft} cft</div>
          </div>
          <div className="rounded-xl border border-asty-border p-3">
            <div className="text-slate-500">20mm Aggregate</div>
            <div className="font-heading text-lg font-bold">{estAgg20Cft} cft</div>
          </div>
          <div className="rounded-xl border border-asty-border p-3">
            <div className="text-slate-500">Fe550D TMT Steel</div>
            <div className="font-heading text-lg font-bold">{totalSteelKg} kg</div>
          </div>
          <div className="rounded-xl border border-asty-border p-3">
            <div className="text-slate-500">RMC Concrete</div>
            <div className="font-heading text-lg font-bold">{totalConcreteM3} m³</div>
          </div>
        </div>
      </div>

      <AstyLetterheadModal
        open={showQuoteModal}
        onClose={() => setShowQuoteModal(false)}
        documentType="CLIENT QUOTATION"
        documentNo={`QTN/${site.code}/V${boq.versionNo}`}
        dateFormatted={formatDDMMYYYY(todayISOInIST())}
        siteName={site.name}
        excelRows={quotationRows}
      >
        <div className="space-y-4">
          <div className="no-print flex gap-2">
            {(
              [
                { id: 'commercial_11_col', label: 'Commercial 11-Column Style' },
                { id: 'residential_boq', label: 'Residential Full-House BOQ' },
                { id: 'residential_sqft', label: 'Residential Per Sq.Ft Style' },
              ] as const
            ).map((s) => (
              <button
                key={s.id}
                type="button"
                onClick={() => setQuoteStyle(s.id)}
                className={`rounded-lg px-3 py-1.5 text-xs font-semibold ${
                  quoteStyle === s.id ? 'bg-asty-charcoal text-white' : 'border border-asty-border'
                }`}
              >
                {s.label}
              </button>
            ))}
          </div>

          {quoteStyle === 'residential_sqft' ? (
            <div className="rounded-xl border border-asty-border p-5 space-y-2">
              <div className="text-base font-bold">
                Turnkey Residential Construction Package — {boq.builtUpAreaSqft} sq.ft
              </div>
              <div>
                Quoted Rate per Sq.Ft:{' '}
                <strong>{formatINR(Math.round(boq.roundedTotalPaise / boq.builtUpAreaSqft))} / sq.ft</strong>
              </div>
              <div className="text-lg font-bold">
                Rounded Lump-Sum Total: {formatINR(boq.roundedTotalPaise)} (GST Extra)
              </div>
            </div>
          ) : (
            <table className="w-full border border-asty-border text-xs">
              <thead className="bg-asty-surface">
                <tr>
                  <th className="p-2 text-left">Sl</th>
                  <th className="p-2 text-left">Stage</th>
                  <th className="p-2 text-right">Conc m³</th>
                  <th className="p-2 text-right">Form m²</th>
                  <th className="p-2 text-right">Steel kg</th>
                  <th className="p-2 text-right">Amount</th>
                </tr>
              </thead>
              <tbody>
                {boq.items.map((r, i) => (
                  <tr key={r.id} className="border-t">
                    <td className="p-2">{i + 1}</td>
                    <td className="p-2">{r.stageName}</td>
                    <td className="p-2 text-right">{r.concreteM3}</td>
                    <td className="p-2 text-right">{r.formworkM2}</td>
                    <td className="p-2 text-right">{r.steelKg}</td>
                    <td className="p-2 text-right font-semibold">{formatINR(r.quotedAmountPaise)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </AstyLetterheadModal>
    </div>
  );
}

