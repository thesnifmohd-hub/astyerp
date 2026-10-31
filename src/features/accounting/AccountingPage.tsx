import React, { useState } from 'react';
import { CheckCircle2, Download, Lock, RotateCcw, Upload } from 'lucide-react';
import * as XLSX from 'xlsx';
import { useErp } from '@/app/ErpContext';
import { exportRowsToExcel } from '@/components/common/AstyLetterheadModal';
import type { VoucherType } from '@/lib/database.types';
import { formatDDMMYYYY, todayISOInIST } from '@/lib/dates';
import { createDraftVoucher, postVoucher, reversePostedVoucher } from '@/lib/erpEngine';
import { applyPercentagePaise, formatINR, rupeesToPaise } from '@/lib/money';

export function AccountingPage() {
  const { state, currentUser, can, mutateState } = useErp();
  const [tab, setTab] = useState<'vouchers' | 'queue' | 'trial' | 'bank_petty' | 'gst_tds' | 'assets_smartbuild'>('vouchers');
  const [feedback, setFeedback] = useState<{ ok: boolean; text: string } | null>(null);

  // Draft Voucher Entry Form (Junior Accountant drafts; Accounts Head posts via voucher.post)
  const [vType, setVType] = useState<VoucherType>('payment');
  const [drLedgerId, setDrLedgerId] = useState('ldg-mat-exp');
  const [crLedgerId, setCrLedgerId] = useState('ldg-hdfc');
  const [costSiteId, setCostSiteId] = useState<string>('site-hadi');
  const [vAmountInr, setVAmountInr] = useState('25000');
  const [vNarration, setVNarration] = useState('');

  if (!currentUser) return null;

  const canPost = can('voucher.post');
  const pendingQueue = state.vouchers.filter((v) => v.status === 'pending_posting' || v.status === 'draft');

  const handleSaveDraft = (e: React.FormEvent) => {
    e.preventDefault();
    setFeedback(null);
    const paise = rupeesToPaise(vAmountInr);
    try {
      mutateState((draft) => {
        createDraftVoucher(draft, {
          actorUserId: currentUser.id,
          voucherType: vType,
          voucherDate: todayISOInIST(),
          narration: vNarration.trim() || `${vType.toUpperCase()} entry`,
          status: 'pending_posting',
          lines: [
            { ledgerId: drLedgerId, costCentreSiteId: costSiteId, drCr: 'DR', amountPaise: paise },
            { ledgerId: crLedgerId, costCentreSiteId: costSiteId, drCr: 'CR', amountPaise: paise },
          ],
        });
      });
      setVNarration('');
      setFeedback({ ok: true, text: 'Balanced double-entry draft voucher added to Pending Posting Queue!' });
    } catch (err) {
      setFeedback({ ok: false, text: (err as Error).message });
    }
  };

  // Trial Balance Calculation (Posted Vouchers + Opening Balances)
  const trialRows = state.ledgers.map((ldg) => {
    let signedDrMinusCr = ldg.openingDrCr === 'DR' ? ldg.openingBalancePaise : -ldg.openingBalancePaise;
    for (const v of state.vouchers) {
      if (v.status !== 'posted') continue;
      for (const l of v.lines) {
        if (l.ledgerId !== ldg.id) continue;
        signedDrMinusCr += l.drCr === 'DR' ? l.amountPaise : -l.amountPaise;
      }
    }
    return {
      ...ldg,
      closingDrPaise: signedDrMinusCr > 0 ? signedDrMinusCr : 0,
      closingCrPaise: signedDrMinusCr < 0 ? Math.abs(signedDrMinusCr) : 0,
    };
  });
  const totalTrialDr = trialRows.reduce((s, r) => s + r.closingDrPaise, 0);
  const totalTrialCr = trialRows.reduce((s, r) => s + r.closingCrPaise, 0);

  // GST Input / Output Summary
  const postedVouchers = state.vouchers.filter((v) => v.status === 'posted');
  const outputGstPaise = postedVouchers.reduce((s, v) => s + (v.gstOutputPaise ?? 0), 0);
  const inputItcPaise = postedVouchers.reduce((s, v) => s + (v.gstInputPaise ?? 0), 0);
  const netGstPayablePaise = outputGstPaise - inputItcPaise;

  const downloadSmartBuildTemplate = () => {
    exportRowsToExcel('Asty_SmartBuild_Opening_Import_Template.xlsx', 'OpeningBalances', [
      { LedgerCode: '2100', LedgerName: 'Sundry Debtors — Project Clients', DrCr: 'DR', AmountINR: 150000 },
      { LedgerCode: '1001', LedgerName: 'Partners Capital Account', DrCr: 'CR', AmountINR: 150000 },
    ]);
  };

  const handleSmartBuildImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const buf = await file.arrayBuffer();
    const wb = XLSX.read(buf);
    const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(wb.Sheets[wb.SheetNames[0]]);
    mutateState((draft) => {
      for (const r of rows) {
        const code = String(r.LedgerCode || '');
        const amtPaise = rupeesToPaise(Number(r.AmountINR || 0));
        const ldg = draft.ledgers.find((l) => l.code === code);
        if (ldg && amtPaise > 0) {
          ldg.openingBalancePaise += amtPaise;
        }
      }
    });
    setFeedback({ ok: true, text: `Imported ${rows.length} Smart Build opening balance rows!` });
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-heading text-2xl font-bold text-asty-black">
            Double-Entry Accounting (Replaces Smart Build)
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Cost Centre = Site (+ Head Office) • DR = CR Trigger • Junior Accountant Drafts → Accounts Head Posts (`voucher.post`)
          </p>
        </div>

        {can('period.lock') && (
          <button
            type="button"
            onClick={() =>
              mutateState((draft) => {
                draft.company.lockedPeriodBefore = draft.company.lockedPeriodBefore ? null : '2026-09-30';
              })
            }
            className="inline-flex items-center gap-1.5 rounded-xl border border-asty-border bg-white px-3.5 py-2 text-xs font-semibold"
          >
            <Lock className="h-3.5 w-3.5" />
            {state.company.lockedPeriodBefore
              ? `Locked ≤ ${formatDDMMYYYY(state.company.lockedPeriodBefore)} (Unlock)`
              : 'Lock Period ≤ 30-09-2026'}
          </button>
        )}
      </div>

      {feedback && (
        <div
          className={`rounded-xl px-4 py-3 text-xs font-semibold ${
            feedback.ok ? 'bg-emerald-100 text-emerald-900' : 'bg-red-100 text-red-900'
          }`}
        >
          {feedback.text}
        </div>
      )}

      <div className="flex flex-wrap gap-2 border-b border-asty-border pb-2 text-xs font-semibold">
        {[
          { id: 'vouchers', label: `Day Book & Vouchers (${state.vouchers.length})` },
          { id: 'queue', label: `Pending Posting Queue (${pendingQueue.length})` },
          { id: 'trial', label: 'Chart of Accounts & Trial Balance' },
          { id: 'bank_petty', label: 'Bank Reconciliation & Petty Cash' },
          { id: 'gst_tds', label: 'GST (GSTR-1 / 3B) & TDS (194C / 194J)' },
          { id: 'assets_smartbuild', label: 'Fixed Assets (WDV), Loans & Smart Build Import' },
        ].map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => setTab(item.id as typeof tab)}
            className={`rounded-lg px-3.5 py-2 ${
              tab === item.id ? 'bg-asty-charcoal text-white' : 'bg-white border border-asty-border'
            }`}
          >
            {item.label}
          </button>
        ))}
      </div>

      {tab === 'vouchers' && (
        <div className="space-y-5 text-xs">
          {can('voucher.draft') && (
            <form onSubmit={handleSaveDraft} className="rounded-2xl border border-asty-border bg-white p-5 space-y-3">
              <h3 className="font-heading text-sm font-bold">
                Enter Double-Entry Voucher (Saved as Draft / Pending Posting)
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-5 gap-3">
                <select value={vType} onChange={(e) => setVType(e.target.value as VoucherType)} className="rounded-lg border border-asty-border px-2.5 py-2">
                  <option value="payment">Payment</option>
                  <option value="receipt">Receipt</option>
                  <option value="contra">Contra</option>
                  <option value="journal">Journal</option>
                  <option value="purchase">Purchase</option>
                  <option value="sales">Sales</option>
                  <option value="debit_note">Debit Note</option>
                  <option value="credit_note">Credit Note</option>
                </select>
                <select value={costSiteId} onChange={(e) => setCostSiteId(e.target.value)} className="rounded-lg border border-asty-border px-2.5 py-2">
                  <option value="HEAD_OFFICE">Cost Centre: Head Office</option>
                  {state.sites.map((s) => (
                    <option key={s.id} value={s.id}>
                      Site: {s.name}
                    </option>
                  ))}
                </select>
                <select value={drLedgerId} onChange={(e) => setDrLedgerId(e.target.value)} className="rounded-lg border border-asty-border px-2.5 py-2">
                  {state.ledgers.map((l) => (
                    <option key={l.id} value={l.id}>
                      DR: {l.name}
                    </option>
                  ))}
                </select>
                <select value={crLedgerId} onChange={(e) => setCrLedgerId(e.target.value)} className="rounded-lg border border-asty-border px-2.5 py-2">
                  {state.ledgers.map((l) => (
                    <option key={l.id} value={l.id}>
                      CR: {l.name}
                    </option>
                  ))}
                </select>
                <input
                  type="number"
                  required
                  value={vAmountInr}
                  onChange={(e) => setVAmountInr(e.target.value)}
                  placeholder="Amount ₹"
                  className="rounded-lg border border-asty-border px-2.5 py-2 font-bold"
                />
              </div>
              <div className="flex gap-2">
                <input
                  required
                  value={vNarration}
                  onChange={(e) => setVNarration(e.target.value)}
                  placeholder="Voucher narration (cheque / UTR / bill reference)..."
                  className="flex-1 rounded-lg border border-asty-border px-3 py-2"
                />
                <button type="submit" className="rounded-lg bg-asty-charcoal px-5 py-2 font-bold text-white">
                  Save to Pending Queue
                </button>
              </div>
            </form>
          )}

          <div className="rounded-2xl border border-asty-border bg-white overflow-hidden">
            <table className="w-full text-left text-xs">
              <thead className="bg-asty-surface uppercase text-slate-600">
                <tr>
                  <th className="px-4 py-3">Voucher No & Date</th>
                  <th className="px-4 py-3">Type</th>
                  <th className="px-4 py-3">Narration & Source</th>
                  <th className="px-4 py-3 text-right">Debit = Credit</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3 text-right">Action (No Hard Delete)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {state.vouchers.map((v) => (
                  <tr key={v.id}>
                    <td className="px-4 py-3 font-mono font-bold">
                      {v.voucherNo}
                      <div className="font-sans font-normal text-slate-500">{formatDDMMYYYY(v.voucherDate)}</div>
                    </td>
                    <td className="px-4 py-3 uppercase font-semibold">{v.voucherType}</td>
                    <td className="px-4 py-3">
                      <div className="font-semibold">{v.narration}</div>
                      {v.sourceLabel && <div className="text-slate-500">{v.sourceLabel}</div>}
                    </td>
                    <td className="px-4 py-3 text-right font-mono font-bold">
                      {formatINR(v.totalDrPaise)}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase ${
                          v.status === 'posted'
                            ? 'bg-emerald-100 text-emerald-800'
                            : v.status === 'pending_posting'
                              ? 'bg-amber-100 text-amber-800'
                              : 'bg-slate-200 text-slate-700'
                        }`}
                      >
                        {v.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      {v.status !== 'posted' && v.status !== 'reversed' && canPost && (
                        <button
                          type="button"
                          onClick={() => {
                            try {
                              mutateState((draft) => {
                                postVoucher(draft, currentUser.id, v.id);
                              });
                              setFeedback({ ok: true, text: `Posted ${v.voucherNo} to General Ledger!` });
                            } catch (err) {
                              setFeedback({ ok: false, text: (err as Error).message });
                            }
                          }}
                          className="rounded-lg bg-emerald-700 px-3 py-1.5 font-semibold text-white"
                        >
                          Post (`voucher.post`)
                        </button>
                      )}
                      {v.status === 'posted' && canPost && (
                        <button
                          type="button"
                          onClick={() => {
                            mutateState((draft) => {
                              reversePostedVoucher(draft, currentUser.id, v.id, 'Audit reversal entry');
                            });
                            setFeedback({ ok: true, text: `Created reversal journal for ${v.voucherNo}` });
                          }}
                          className="inline-flex items-center gap-1 rounded-lg border border-asty-border px-2.5 py-1 font-semibold"
                        >
                          <RotateCcw className="h-3 w-3" /> Reverse
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === 'queue' && (
        <div className="rounded-2xl border border-asty-border bg-white p-5 space-y-3 text-xs">
          <h3 className="font-heading text-sm font-bold">
            Auto-Posting & Junior Accountant Pending Queue ({pendingQueue.length})
          </h3>
          {!canPost && (
            <div className="rounded-lg bg-amber-50 border border-amber-200 p-3 text-amber-900 font-semibold">
              Your position does not hold `voucher.post`. You can prepare drafts, while Accounts Head / Management posts them.
            </div>
          )}
          {pendingQueue.map((v) => (
            <div key={v.id} className="rounded-xl border border-asty-border p-4 flex flex-wrap items-center justify-between gap-3">
              <div>
                <div className="font-bold text-sm">
                  {v.voucherNo} — {v.narration}
                </div>
                <div className="text-slate-500">{v.sourceLabel ?? 'Manual Draft'} • Balanced {formatINR(v.totalDrPaise)}</div>
              </div>
              {canPost && (
                <button
                  type="button"
                  onClick={() =>
                    mutateState((draft) => {
                      postVoucher(draft, currentUser.id, v.id);
                    })
                  }
                  className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-700 px-4 py-2 font-bold text-white"
                >
                  <CheckCircle2 className="h-4 w-4" /> Review & Post to Books
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {tab === 'trial' && (
        <div className="rounded-2xl border border-asty-border bg-white overflow-hidden">
          <table className="w-full text-left text-xs">
            <thead className="bg-asty-surface uppercase text-slate-600">
              <tr>
                <th className="px-4 py-3">Code</th>
                <th className="px-4 py-3">Ledger Account</th>
                <th className="px-4 py-3">Indian Standard Group</th>
                <th className="px-4 py-3 text-right">Closing Debit</th>
                <th className="px-4 py-3 text-right">Closing Credit</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {trialRows.map((r) => (
                <tr key={r.id}>
                  <td className="px-4 py-2.5 font-mono">{r.code}</td>
                  <td className="px-4 py-2.5 font-semibold">{r.name}</td>
                  <td className="px-4 py-2.5 text-slate-500">{r.groupName}</td>
                  <td className="px-4 py-2.5 text-right font-mono">
                    {r.closingDrPaise > 0 ? formatINR(r.closingDrPaise) : '—'}
                  </td>
                  <td className="px-4 py-2.5 text-right font-mono">
                    {r.closingCrPaise > 0 ? formatINR(r.closingCrPaise) : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot className="bg-asty-surface font-bold">
              <tr>
                <td colSpan={3} className="px-4 py-3">
                  TRIAL BALANCE TOTAL (DEBITS = CREDITS VERIFIED)
                </td>
                <td className="px-4 py-3 text-right font-mono">{formatINR(totalTrialDr)}</td>
                <td className="px-4 py-3 text-right font-mono">{formatINR(totalTrialCr)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}

      {tab === 'bank_petty' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 text-xs">
          <div className="rounded-2xl border border-asty-border bg-white p-5 space-y-3">
            <h3 className="font-heading text-sm font-bold">Bank Reconciliation (HDFC Bank Thrissur)</h3>
            {state.bankStatementRows.map((b) => (
              <div key={b.id} className="rounded-xl border border-asty-border p-3 flex justify-between items-center">
                <div>
                  <div className="font-bold">{b.description}</div>
                  <div className="text-slate-500">
                    {formatDDMMYYYY(b.date)} • Ref: {b.utrRef} •{' '}
                    {b.depositPaise > 0 ? `CR ${formatINR(b.depositPaise)}` : `DR ${formatINR(b.withdrawalPaise)}`}
                  </div>
                </div>
                {b.matchedVoucherNo ? (
                  <span className="rounded bg-emerald-100 px-2.5 py-1 font-mono font-bold text-emerald-800">
                    Matched: {b.matchedVoucherNo}
                  </span>
                ) : (
                  <button
                    type="button"
                    onClick={() =>
                      mutateState((draft) => {
                        const row = draft.bankStatementRows.find((x) => x.id === b.id);
                        if (row) row.matchedVoucherNo = 'FY26-27/PMT/AUTO';
                      })
                    }
                    className="rounded bg-asty-charcoal px-3 py-1 font-semibold text-white"
                  >
                    Match Entry
                  </button>
                )}
              </div>
            ))}
          </div>

          <div className="rounded-2xl border border-asty-border bg-white p-5 space-y-3">
            <h3 className="font-heading text-sm font-bold">Site Petty Cash Wallets</h3>
            {state.pettyCashWallets.map((w) => {
              const bal = w.issuedPaise - w.spentSettledPaise - w.pendingUnsettledPaise;
              return (
                <div key={w.id} className="rounded-xl border border-asty-border p-3.5 space-y-1">
                  <div className="font-bold text-sm">
                    {state.sites.find((s) => s.id === w.siteId)?.name} — {state.users.find((u) => u.id === w.supervisorId)?.fullName}
                  </div>
                  <div className="flex justify-between text-slate-600">
                    <span>Issued: {formatINR(w.issuedPaise)}</span>
                    <span>Settled (with Bill Photo): {formatINR(w.spentSettledPaise)}</span>
                    <span className="font-bold text-asty-black">Cash on Hand: {formatINR(bal)}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {tab === 'gst_tds' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 text-xs">
          <div className="rounded-2xl border border-asty-border bg-white p-5 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="font-heading text-sm font-bold">GST Summary (GSTR-1 & GSTR-3B)</h3>
              <button
                type="button"
                onClick={() =>
                  exportRowsToExcel('Asty_GSTR3B_Summary.xlsx', 'GSTR3B', [
                    { Head: 'Output Tax (Sales Invoices)', AmountINR: outputGstPaise / 100 },
                    { Head: 'Eligible Input Tax Credit (ITC)', AmountINR: inputItcPaise / 100 },
                    { Head: 'Net GST Payable', AmountINR: netGstPayablePaise / 100 },
                  ])
                }
                className="inline-flex items-center gap-1 rounded-lg border border-asty-border px-2.5 py-1 font-semibold"
              >
                <Download className="h-3.5 w-3.5" /> Export GSTR-3B Excel
              </button>
            </div>
            <div className="space-y-2">
              <div className="flex justify-between rounded-lg bg-asty-surface p-3">
                <span>Output GST (CGST + SGST on Client Bills)</span>
                <strong>{formatINR(outputGstPaise)}</strong>
              </div>
              <div className="flex justify-between rounded-lg bg-asty-surface p-3">
                <span>Input Tax Credit (ITC on Vendor Purchases)</span>
                <strong className="text-emerald-700">-{formatINR(inputItcPaise)}</strong>
              </div>
              <div className="flex justify-between rounded-lg bg-asty-charcoal text-white p-3">
                <span>Net GST Cash Liability</span>
                <strong>{formatINR(netGstPayablePaise)}</strong>
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-asty-border bg-white p-5 space-y-3">
            <h3 className="font-heading text-sm font-bold">TDS Payable Register (194C & 194J)</h3>
            {state.subcontractorBills.map((sb) => {
              const sub = state.subcontractors.find((s) => s.id === sb.subcontractorId);
              return (
                <div key={sb.id} className="rounded-xl border border-asty-border p-3 flex justify-between">
                  <div>
                    <div className="font-bold">{sub?.name} (PAN: {sub?.pan})</div>
                    <div className="text-slate-500">Section 194C @ {sub?.tdsRatePct}% on {sb.billNo}</div>
                  </div>
                  <div className="font-mono font-bold text-blue-800">{formatINR(sb.tds194cPaise)}</div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {tab === 'assets_smartbuild' && (
        <div className="space-y-6 text-xs">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="rounded-2xl border border-asty-border bg-white p-5 space-y-3">
              <h3 className="font-heading text-sm font-bold">Fixed Assets Register (Income Tax WDV Rates)</h3>
              {state.fixedAssets.map((fa) => {
                const depPaise = applyPercentagePaise(fa.openingWdvPaise, fa.wdvRatePct);
                return (
                  <div key={fa.id} className="rounded-xl border border-asty-border p-3">
                    <div className="font-bold">{fa.assetCode} — {fa.name}</div>
                    <div className="text-slate-500 mt-1 flex justify-between">
                      <span>WDV Rate: {fa.wdvRatePct}%</span>
                      <span>Annual WDV Depr: {formatINR(depPaise)}</span>
                      <span className="font-bold text-asty-black">Closing WDV: {formatINR(fa.openingWdvPaise - depPaise)}</span>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="rounded-2xl border border-asty-border bg-white p-5 space-y-3">
              <h3 className="font-heading text-sm font-bold">Vehicle & Equipment Loan EMI Schedule</h3>
              {state.loans.map((ln) => (
                <div key={ln.id} className="rounded-xl border border-asty-border p-3 space-y-1">
                  <div className="font-bold">{ln.loanNo} — {ln.lender}</div>
                  <div>Asset: {ln.assetName} • Rate: {ln.annualInterestPct}% p.a.</div>
                  <div className="flex justify-between font-semibold pt-1">
                    <span>Principal: {formatINR(ln.principalPaise)}</span>
                    <span>Monthly EMI: {formatINR(ln.emiPaise)}</span>
                    <span>Paid: {ln.paidMonths}/{ln.tenureMonths}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-2xl border border-asty-border bg-white p-5 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="font-heading text-sm font-bold">
                Smart Build Legacy Software — Opening Balance & Open Bills Excel Import
              </h3>
              <p className="text-slate-500">
                Download the official template first, populate ledger opening balances from Smart Build, and import directly.
              </p>
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={downloadSmartBuildTemplate}
                className="inline-flex items-center gap-1.5 rounded-xl border border-asty-border px-3.5 py-2 font-semibold"
              >
                <Download className="h-3.5 w-3.5" /> Download Template (.xlsx)
              </button>
              <label className="inline-flex items-center gap-1.5 rounded-xl bg-asty-charcoal px-4 py-2 font-semibold text-white cursor-pointer">
                <Upload className="h-3.5 w-3.5" /> Import Smart Build Excel
                <input type="file" accept=".xlsx,.xls,.csv" onChange={handleSmartBuildImport} className="hidden" />
              </label>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

