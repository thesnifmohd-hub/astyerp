import React, { useState } from 'react';
import { FileText, Plus } from 'lucide-react';
import { useErp } from '@/app/ErpContext';
import { AstyLetterheadModal } from '@/components/common/AstyLetterheadModal';
import type { ClientBill } from '@/lib/database.types';
import { formatDDMMYYYY, todayISOInIST } from '@/lib/dates';
import { calculateRaBillAmounts, createApprovalRequest } from '@/lib/erpEngine';
import { formatINR, rupeesToPaise } from '@/lib/money';

export function BillingPage() {
  const { state, currentUser, visibleSites, can, mutateState } = useErp();
  const [billType, setBillType] = useState<ClientBill['billType']>('ra_bill');
  const [siteId, setSiteId] = useState(visibleSites[0]?.id ?? 'site-hadi');
  const [cumInr, setCumInr] = useState('2200000');
  const [selectedBillPdf, setSelectedBillPdf] = useState<ClientBill | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  if (!currentUser) return null;

  const site = state.sites.find((s) => s.id === siteId) ?? visibleSites[0];
  const prevCertifiedPaise = state.clientBills
    .filter((b) => b.siteId === site?.id)
    .reduce((s, b) => s + b.thisBillGrossPaise, 0);

  const handlePrepareBill = (e: React.FormEvent) => {
    e.preventDefault();
    if (!site) return;

    const cumulativePaise = rupeesToPaise(cumInr);
    try {
      const calc = calculateRaBillAmounts({
        cumulativeWorkPaise: cumulativePaise,
        prevCertifiedPaise,
        retentionPct: billType === 'pmc_fee_bill' ? 0 : 5,
        advanceRecoveryPaise: 0,
        gstRatePct: 18,
      });

      mutateState((draft) => {
        const id = `cb-${Date.now()}`;
        const invoiceNo = `ASTY/26-27/INV-00${draft.clientBills.length + 1}`;
        const apr = createApprovalRequest(draft, {
          actorUserId: currentUser.id,
          requestType: 'client_bill',
          siteId: site.id,
          sourceTable: 'client_bills',
          sourceId: id,
          antiSplitItemId: null,
          amountPaise: calc.totalInvoicePaise,
          title: `${invoiceNo} (${billType.replace(/_/g, ' ').toUpperCase()}) — ${site.name}`,
          details: `Taxable ${formatINR(calc.taxablePaise)} + CGST/SGST = ${formatINR(calc.totalInvoicePaise)}`,
        });

        draft.clientBills.unshift({
          id,
          invoiceNo,
          siteId: site.id,
          clientId: site.clientId,
          billType,
          invoiceDate: todayISOInIST(),
          dueDate: todayISOInIST(),
          prevCertifiedPaise: calc.prevCertifiedPaise,
          thisBillGrossPaise: calc.thisBillGrossPaise,
          retentionHeldPaise: calc.retentionHeldPaise,
          advanceRecoveryPaise: calc.advanceRecoveryPaise,
          taxablePaise: calc.taxablePaise,
          cgstPaise: calc.cgstPaise,
          sgstPaise: calc.sgstPaise,
          totalInvoicePaise: calc.totalInvoicePaise,
          receivedPaise: 0,
          status: 'pending_mgmt_approval',
          approvalRequestId: apr.id,
        });
      });
      setMsg('Client GST Invoice prepared and routed (Ops Executive Check → Management Approval → Sales Voucher)!');
    } catch (err) {
      setMsg((err as Error).message);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-heading text-2xl font-bold text-asty-black">
          Client Billing (RA, Final, Labour, Extra Work & PMC %) & Ageing
        </h1>
        <p className="text-xs text-slate-500 mt-0.5">
          SPEC Section 4.9 • Previous / This / Cumulative RA Maths • GST Tax Invoice PDF on Asty Letterhead
        </p>
      </div>

      {msg && (
        <div className="rounded-xl border border-asty-border bg-white px-4 py-3 text-xs font-semibold">
          {msg}
        </div>
      )}

      {can('client_bill.create') && (
        <form onSubmit={handlePrepareBill} className="rounded-2xl border border-asty-border bg-white p-5 space-y-3 text-xs">
          <h3 className="font-heading text-sm font-bold flex items-center gap-1.5">
            <Plus className="h-4 w-4" /> Prepare Client GST Tax Invoice
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
            <select value={siteId} onChange={(e) => setSiteId(e.target.value)} className="rounded-lg border border-asty-border px-3 py-2 font-semibold">
              {visibleSites.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name} ({s.contractType})
                </option>
              ))}
            </select>
            <select
              value={billType}
              onChange={(e) => setBillType(e.target.value as ClientBill['billType'])}
              className="rounded-lg border border-asty-border px-3 py-2"
            >
              <option value="ra_bill">Running Account (RA) Bill</option>
              <option value="pmc_fee_bill">PMC % Fee Bill (e.g. Wayanad 12%)</option>
              <option value="extra_work_bill">Extra Work Bill (Client Approved)</option>
              <option value="labour_bill">Labour Contract Bill</option>
              <option value="final_bill">Final Settlement Bill</option>
            </select>
            <div>
              <input
                type="number"
                required
                value={cumInr}
                onChange={(e) => setCumInr(e.target.value)}
                placeholder="Cumulative Work Certified (₹)"
                className="w-full rounded-lg border border-asty-border px-3 py-2"
              />
              <div className="text-[10px] text-slate-500 mt-0.5">
                Prev Certified: {formatINR(prevCertifiedPaise)}
              </div>
            </div>
            <button type="submit" className="rounded-lg bg-asty-charcoal px-4 py-2 font-bold text-white self-start">
              Submit Bill for Approval
            </button>
          </div>
        </form>
      )}

      <div className="rounded-2xl border border-asty-border bg-white overflow-hidden">
        <table className="w-full text-left text-xs">
          <thead className="bg-asty-surface uppercase text-slate-600">
            <tr>
              <th className="px-4 py-3">Invoice No & Date</th>
              <th className="px-4 py-3">Site & Bill Type</th>
              <th className="px-4 py-3 text-right">Taxable</th>
              <th className="px-4 py-3 text-right">CGST + SGST (18%)</th>
              <th className="px-4 py-3 text-right">Total Invoice</th>
              <th className="px-4 py-3 text-right">Outstanding</th>
              <th className="px-4 py-3 text-right">PDF</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {state.clientBills
              .filter((b) => visibleSites.some((s) => s.id === b.siteId))
              .map((b) => {
                const sName = state.sites.find((s) => s.id === b.siteId)?.name;
                const duePaise = Math.max(0, b.totalInvoicePaise - b.receivedPaise);
                return (
                  <tr key={b.id}>
                    <td className="px-4 py-3 font-mono font-bold">
                      {b.invoiceNo}
                      <div className="font-sans font-normal text-slate-500">{formatDDMMYYYY(b.invoiceDate)}</div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-semibold">{sName}</div>
                      <div className="uppercase text-[10px] text-slate-500">{b.billType.replace(/_/g, ' ')} • {b.status}</div>
                    </td>
                    <td className="px-4 py-3 text-right font-mono">{formatINR(b.taxablePaise)}</td>
                    <td className="px-4 py-3 text-right font-mono">{formatINR(b.cgstPaise + b.sgstPaise)}</td>
                    <td className="px-4 py-3 text-right font-mono font-bold">{formatINR(b.totalInvoicePaise)}</td>
                    <td className="px-4 py-3 text-right font-mono font-bold text-amber-800">
                      {duePaise > 0 ? formatINR(duePaise) : 'PAID'}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        type="button"
                        onClick={() => setSelectedBillPdf(b)}
                        className="inline-flex items-center gap-1 rounded-lg bg-asty-charcoal px-3 py-1.5 font-semibold text-white"
                      >
                        <FileText className="h-3.5 w-3.5" /> Tax Invoice
                      </button>
                    </td>
                  </tr>
                );
              })}
          </tbody>
        </table>
      </div>

      {selectedBillPdf && (
        <AstyLetterheadModal
          open={Boolean(selectedBillPdf)}
          onClose={() => setSelectedBillPdf(null)}
          documentType="GST TAX INVOICE"
          documentNo={selectedBillPdf.invoiceNo}
          dateFormatted={formatDDMMYYYY(selectedBillPdf.invoiceDate)}
          siteName={state.sites.find((s) => s.id === selectedBillPdf.siteId)?.name}
        >
          <div className="space-y-3 text-xs">
            <div>
              <strong>SAC Code:</strong> 9954 (Construction Services) •{' '}
              <strong>Client:</strong>{' '}
              {state.clients.find((c) => c.id === selectedBillPdf.clientId)?.name} (GSTIN:{' '}
              {state.clients.find((c) => c.id === selectedBillPdf.clientId)?.gstin || 'Unregistered'})
            </div>
            <table className="w-full border border-asty-border">
              <tbody>
                <tr className="border-b">
                  <td className="p-2">Previous Certified Gross</td>
                  <td className="p-2 text-right font-mono">{formatINR(selectedBillPdf.prevCertifiedPaise)}</td>
                </tr>
                <tr className="border-b">
                  <td className="p-2">This Bill Certified Work Value</td>
                  <td className="p-2 text-right font-mono">{formatINR(selectedBillPdf.thisBillGrossPaise)}</td>
                </tr>
                <tr className="border-b">
                  <td className="p-2">Less: Retention Deducted</td>
                  <td className="p-2 text-right font-mono">-{formatINR(selectedBillPdf.retentionHeldPaise)}</td>
                </tr>
                <tr className="border-b">
                  <td className="p-2">Less: Mobilisation Advance Recovery</td>
                  <td className="p-2 text-right font-mono">-{formatINR(selectedBillPdf.advanceRecoveryPaise)}</td>
                </tr>
                <tr className="border-b font-semibold">
                  <td className="p-2">Taxable Value</td>
                  <td className="p-2 text-right font-mono">{formatINR(selectedBillPdf.taxablePaise)}</td>
                </tr>
                <tr className="border-b">
                  <td className="p-2">CGST (9%) + SGST (9%)</td>
                  <td className="p-2 text-right font-mono">
                    {formatINR(selectedBillPdf.cgstPaise)} + {formatINR(selectedBillPdf.sgstPaise)}
                  </td>
                </tr>
                <tr className="bg-asty-surface font-bold text-sm">
                  <td className="p-2.5">TOTAL GST TAX INVOICE PAYABLE</td>
                  <td className="p-2.5 text-right font-mono">{formatINR(selectedBillPdf.totalInvoicePaise)}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </AstyLetterheadModal>
      )}
    </div>
  );
}

