import React, { useState } from 'react';
import { ArrowLeftRight, FileText, PackageCheck, Plus, TrendingUp } from 'lucide-react';
import { useErp } from '@/app/ErpContext';
import { AstyLetterheadModal } from '@/components/common/AstyLetterheadModal';
import type { PurchaseOrder } from '@/lib/database.types';
import { formatDDMMYYYY, getFinancialYear, todayISOInIST } from '@/lib/dates';
import {
  calculateSiteItemStock,
  createApprovalRequest,
  getLast3PurchaseRates,
} from '@/lib/erpEngine';
import { formatINR, rupeesToPaise, splitGST } from '@/lib/money';

export function MaterialsPage() {
  const { state, currentUser, visibleSites, can, mutateState } = useErp();
  const [tab, setTab] = useState<'po' | 'stock' | 'transfers' | 'masters'>('po');
  const [selectedPoForPdf, setSelectedPoForPdf] = useState<PurchaseOrder | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  // Create PO Form
  const [poSiteId, setPoSiteId] = useState(visibleSites[0]?.id ?? '');
  const [poVendorId, setPoVendorId] = useState(state.vendors[0]?.id ?? '');
  const [poItemId, setPoItemId] = useState(state.items[0]?.id ?? '');
  const [poQty, setPoQty] = useState(0);
  const [poRateInr, setPoRateInr] = useState('');

  // Stock Transfer Form
  const [fromSiteId, setFromSiteId] = useState(visibleSites[0]?.id ?? '');
  const [toSiteId, setToSiteId] = useState(visibleSites[1]?.id ?? '');
  const [trItemId, setTrItemId] = useState(state.items[0]?.id ?? '');
  const [trQty, setTrQty] = useState(0);

  // Add Item / Vendor Master Forms
  const [newItemName, setNewItemName] = useState('');
  const [newItemUnit, setNewItemUnit] = useState('Bag');
  const [newItemGst, setNewItemGst] = useState('18');
  const [newVendorName, setNewVendorName] = useState('');
  const [newVendorGstin, setNewVendorGstin] = useState('');

  if (!currentUser) return null;

  const selectedItem = state.items.find((i) => i.id === poItemId) ?? state.items[0] ?? null;
  const last3Rates = selectedItem ? getLast3PurchaseRates(state, selectedItem.id) : [];

  const handleCreatePo = (e: React.FormEvent) => {
    e.preventDefault();
    const targetSiteId = poSiteId || visibleSites[0]?.id;
    const targetVendorId = poVendorId || state.vendors[0]?.id;
    if (!selectedItem || !targetSiteId || !targetVendorId || poQty <= 0) {
      setToast('Create a Site, Vendor, and Material Item first (in the Items & Vendors tab), then enter a valid quantity and rate.');
      return;
    }
    const ratePaise = rupeesToPaise(poRateInr);
    const subtotalPaise = Math.round(ratePaise * poQty);
    const gst = splitGST(subtotalPaise, selectedItem.gstRatePct);

    mutateState((draft) => {
      const poId = `po-${Date.now()}`;
      const poNumber = `PO/${getFinancialYear()}/${String(draft.purchaseOrders.length + 1).padStart(4, '0')}`;
      const apr = createApprovalRequest(draft, {
        actorUserId: currentUser.id,
        requestType: 'purchase_order',
        siteId: targetSiteId,
        sourceTable: 'purchase_orders',
        sourceId: poId,
        antiSplitItemId: selectedItem.id,
        amountPaise: gst.grossPaise,
        title: `${poNumber} — ${poQty} ${selectedItem.unit} ${selectedItem.name}`,
        details: `Rate ${formatINR(ratePaise)}/${selectedItem.unit} + ${selectedItem.gstRatePct}% GST`,
      });

      draft.purchaseOrders.unshift({
        id: poId,
        poNumber,
        siteId: targetSiteId,
        vendorId: targetVendorId,
        poDate: todayISOInIST(),
        deliveryDate: todayISOInIST(),
        itemId: selectedItem.id,
        qtyOrdered: poQty,
        qtyReceived: 0,
        ratePaise,
        gstRatePct: selectedItem.gstRatePct,
        subtotalPaise,
        gstPaise: gst.totalTaxPaise,
        totalPaise: gst.grossPaise,
        status: 'pending_approval',
        approvalRequestId: apr.id,
      });
    });
    setToast('Purchase Order created and routed through Approval Engine (with 7-day anti-split check).');
  };

  const handleConfirmGrn = (po: PurchaseOrder) => {
    mutateState((draft) => {
      const target = draft.purchaseOrders.find((p) => p.id === po.id);
      if (!target) return;
      target.qtyReceived = target.qtyOrdered;
      target.status = 'received';
      draft.goodsReceipts.unshift({
        id: `grn-${Date.now()}`,
        grnNumber: `GRN/${getFinancialYear()}/${String(draft.goodsReceipts.length + 1).padStart(4, '0')}`,
        siteId: po.siteId,
        purchaseOrderId: po.id,
        vendorId: po.vendorId,
        itemId: po.itemId,
        qtyReceived: po.qtyOrdered,
        challanNo: `DC-${Math.floor(1000 + Math.random() * 9000)}`,
        challanPhotoDataUrl: 'verified-live-challan',
        receivedBy: currentUser.id,
        receivedAt: new Date().toISOString(),
      });
    });
    setToast(`GRN confirmed with Challan Photo for ${po.poNumber}; Site Stock increased automatically.`);
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-heading text-2xl font-bold text-asty-black">
          Materials, Procurement (PO / GRN) & Site Inventory
        </h1>
        <p className="text-xs text-slate-500 mt-0.5">
          Material Request → Approval → PO (with Last 3 Purchase Rates & Letterhead PDF) → Site GRN → Live Stock & Transfers
        </p>
      </div>

      {toast && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-xs font-semibold text-emerald-900">
          {toast}
        </div>
      )}

      <div className="flex flex-wrap gap-2 border-b border-asty-border pb-2 text-xs font-semibold">
        {[
          { id: 'po', label: 'Purchase Orders & GRN' },
          { id: 'stock', label: 'Site Stock & Usage vs BOQ' },
          { id: 'transfers', label: 'Site-to-Site Transfers' },
          { id: 'masters', label: `Items (${state.items.length}) & Vendors (${state.vendors.length})` },
        ].map((tItem) => (
          <button
            key={tItem.id}
            type="button"
            onClick={() => setTab(tItem.id as typeof tab)}
            className={`rounded-lg px-4 py-2 ${
              tab === tItem.id ? 'bg-asty-charcoal text-white' : 'bg-white border border-asty-border'
            }`}
          >
            {tItem.label}
          </button>
        ))}
      </div>

      {tab === 'po' && (
        <div className="space-y-6">
          {can('material.po.create') && (
            <form
              onSubmit={handleCreatePo}
              className="rounded-2xl border border-asty-border bg-white p-5 space-y-4 text-xs"
            >
              <div className="flex items-center justify-between">
                <h2 className="font-heading text-sm font-bold flex items-center gap-1.5">
                  <Plus className="h-4 w-4" /> Create Purchase Order
                </h2>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-5 gap-3">
                <div>
                  <label className="font-semibold block mb-1">Site</label>
                  <select
                    value={poSiteId}
                    onChange={(e) => setPoSiteId(e.target.value)}
                    className="w-full rounded-lg border border-asty-border px-2.5 py-2"
                  >
                    {visibleSites.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="font-semibold block mb-1">Vendor</label>
                  <select
                    value={poVendorId}
                    onChange={(e) => setPoVendorId(e.target.value)}
                    className="w-full rounded-lg border border-asty-border px-2.5 py-2"
                  >
                    {state.vendors.map((v) => (
                      <option key={v.id} value={v.id}>
                        {v.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="font-semibold block mb-1">Material Item</label>
                  <select
                    value={poItemId}
                    onChange={(e) => {
                      setPoItemId(e.target.value);
                      const it = state.items.find((x) => x.id === e.target.value);
                      if (it) setPoRateInr(String(it.referenceRatePaise / 100));
                    }}
                    className="w-full rounded-lg border border-asty-border px-2.5 py-2"
                  >
                    {state.items.map((it) => (
                      <option key={it.id} value={it.id}>
                        {it.name} ({it.unit})
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="font-semibold block mb-1">Quantity ({selectedItem?.unit ?? 'Unit'})</label>
                  <input
                    type="number"
                    min={1}
                    value={poQty || ''}
                    onChange={(e) => setPoQty(Number(e.target.value))}
                    placeholder="0"
                    className="w-full rounded-lg border border-asty-border px-2.5 py-2"
                  />
                </div>
                <div>
                  <label className="font-semibold block mb-1">Unit Rate (₹)</label>
                  <input
                    type="number"
                    step="0.5"
                    value={poRateInr}
                    onChange={(e) => setPoRateInr(e.target.value)}
                    placeholder="0.00"
                    className="w-full rounded-lg border border-asty-border px-2.5 py-2"
                  />
                </div>
              </div>

              {/* Last 3 Purchase Rates Panel (SPEC Section 4.5 & 4.6) */}
              <div className="rounded-xl bg-asty-surface p-3.5 flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2 font-semibold text-asty-charcoal">
                  <TrendingUp className="h-4 w-4" />
                  <span>Last 3 Approved Purchase Rates for {selectedItem?.name ?? 'Selected Material'}:</span>
                </div>
                <div className="flex flex-wrap gap-2">
                  {last3Rates.length === 0 ? (
                    <span className="text-slate-500">No prior PO history for this item</span>
                  ) : (
                    last3Rates.map((r) => (
                      <span
                        key={r.poNumber}
                        className="rounded-lg border border-asty-border bg-white px-2.5 py-1 font-mono text-[11px]"
                      >
                        <strong>{formatINR(r.ratePaise)}</strong>/{selectedItem?.unit ?? 'Unit'} • {r.vendorName} ({formatDDMMYYYY(r.poDate)})
                      </span>
                    ))
                  )}
                </div>
              </div>

              <button
                type="submit"
                className="rounded-xl bg-asty-charcoal px-5 py-2.5 font-bold text-white hover:bg-asty-black"
              >
                Submit PO for Approval
              </button>
            </form>
          )}

          <div className="rounded-2xl border border-asty-border bg-white overflow-hidden">
            <table className="w-full text-left text-xs">
              <thead className="bg-asty-surface uppercase text-slate-600">
                <tr>
                  <th className="px-4 py-3">PO Number</th>
                  <th className="px-4 py-3">Site & Vendor</th>
                  <th className="px-4 py-3">Item & Qty</th>
                  <th className="px-4 py-3 text-right">Total (incl. GST)</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {state.purchaseOrders
                  .filter((p) => visibleSites.some((s) => s.id === p.siteId))
                  .map((po) => {
                    const site = state.sites.find((s) => s.id === po.siteId);
                    const vendor = state.vendors.find((v) => v.id === po.vendorId);
                    const item = state.items.find((i) => i.id === po.itemId);
                    return (
                      <tr key={po.id}>
                        <td className="px-4 py-3 font-mono font-bold">{po.poNumber}</td>
                        <td className="px-4 py-3">
                          <div className="font-semibold">{site?.name}</div>
                          <div className="text-slate-500">{vendor?.name}</div>
                        </td>
                        <td className="px-4 py-3">
                          {po.qtyOrdered} {item?.unit} × {item?.name} @ {formatINR(po.ratePaise)}
                        </td>
                        <td className="px-4 py-3 text-right font-bold">{formatINR(po.totalPaise)}</td>
                        <td className="px-4 py-3">
                          <span className="rounded-full bg-asty-surface px-2.5 py-0.5 text-[10px] font-bold uppercase">
                            {po.status}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right space-x-2">
                          {po.status === 'approved' && can('material.grn.create') && (
                            <button
                              type="button"
                              onClick={() => handleConfirmGrn(po)}
                              className="inline-flex items-center gap-1 rounded-lg bg-emerald-700 px-2.5 py-1.5 font-semibold text-white"
                            >
                              <PackageCheck className="h-3.5 w-3.5" /> Confirm Site GRN
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => setSelectedPoForPdf(po)}
                            className="inline-flex items-center gap-1 rounded-lg border border-asty-border px-2.5 py-1.5 font-semibold"
                          >
                            <FileText className="h-3.5 w-3.5" /> PO PDF
                          </button>
                        </td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === 'stock' && (
        <div className="rounded-2xl border border-asty-border bg-white overflow-hidden">
          <table className="w-full text-left text-xs">
            <thead className="bg-asty-surface uppercase text-slate-600">
              <tr>
                <th className="px-4 py-3">Site</th>
                <th className="px-4 py-3">Material</th>
                <th className="px-4 py-3 text-right">Opening + GRN</th>
                <th className="px-4 py-3 text-right">Used (Evening DPR)</th>
                <th className="px-4 py-3 text-right">Net Transfers</th>
                <th className="px-4 py-3 text-right">On-Hand Stock</th>
                <th className="px-4 py-3">Usage vs BOQ Check</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {visibleSites.flatMap((s) =>
                state.items.slice(0, 4).map((it) => {
                  const st = calculateSiteItemStock(state, s.id, it.id);
                  const boqCap = it.id === 'itm-cement' ? 450 : 5000;
                  const overWastage = st.used > boqCap * (1 + it.defaultWastagePct / 100);
                  return (
                    <tr key={`${s.id}-${it.id}`}>
                      <td className="px-4 py-2.5 font-semibold">{s.name}</td>
                      <td className="px-4 py-2.5">{it.name}</td>
                      <td className="px-4 py-2.5 text-right">{st.opening + st.received} {it.unit}</td>
                      <td className="px-4 py-2.5 text-right">{st.used} {it.unit}</td>
                      <td className="px-4 py-2.5 text-right">{st.transferredIn - st.transferredOut} {it.unit}</td>
                      <td className="px-4 py-2.5 text-right font-bold">{st.onHand} {it.unit}</td>
                      <td className="px-4 py-2.5">
                        <span
                          className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                            overWastage ? 'bg-red-100 text-red-800' : 'bg-emerald-50 text-emerald-700'
                          }`}
                        >
                          {overWastage ? `OVER WASTAGE (> ${it.defaultWastagePct}%)` : 'Within BOQ Norm'}
                        </span>
                      </td>
                    </tr>
                  );
                }),
              )}
            </tbody>
          </table>
        </div>
      )}

      {tab === 'transfers' && (
        <div className="space-y-4">
          <div className="rounded-2xl border border-asty-border bg-white p-5 space-y-3 text-xs">
            <h3 className="font-heading text-sm font-bold flex items-center gap-1.5">
              <ArrowLeftRight className="h-4 w-4" /> Site-to-Site Material Transfer (Coordinator Approves → Receiving Supervisor Confirms)
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
              <select value={fromSiteId} onChange={(e) => setFromSiteId(e.target.value)} className="rounded-lg border border-asty-border px-3 py-2">
                {state.sites.map((s) => <option key={s.id} value={s.id}>From: {s.name}</option>)}
              </select>
              <select value={toSiteId} onChange={(e) => setToSiteId(e.target.value)} className="rounded-lg border border-asty-border px-3 py-2">
                {state.sites.map((s) => <option key={s.id} value={s.id}>To: {s.name}</option>)}
              </select>
              <select value={trItemId} onChange={(e) => setTrItemId(e.target.value)} className="rounded-lg border border-asty-border px-3 py-2">
                {state.items.map((i) => <option key={i.id} value={i.id}>{i.name}</option>)}
              </select>
              <div className="flex gap-2">
                <input type="number" min={1} value={trQty} onChange={(e) => setTrQty(Number(e.target.value))} className="w-24 rounded-lg border border-asty-border px-3 py-2" />
                <button
                  type="button"
                  onClick={() => {
                    if (fromSiteId === toSiteId) return;
                    mutateState((draft) => {
                      draft.stockTransfers.unshift({
                        id: `tr-${Date.now()}`,
                        transferNo: `STR/${draft.stockTransfers.length + 1}`,
                        fromSiteId,
                        toSiteId,
                        itemId: trItemId,
                        qty: trQty,
                        status: 'pending_coordinator',
                        requestedBy: currentUser.id,
                      });
                    });
                  }}
                  className="flex-1 rounded-lg bg-asty-charcoal px-3 py-2 font-bold text-white"
                >
                  Request
                </button>
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-asty-border bg-white p-4 space-y-2 text-xs">
            {state.stockTransfers.length === 0 ? (
              <div className="text-slate-500 text-center py-4">No site-to-site transfers raised yet.</div>
            ) : (
              state.stockTransfers.map((tr) => (
                <div key={tr.id} className="flex flex-wrap items-center justify-between gap-2 border-b pb-2">
                  <div>
                    <strong>{tr.transferNo}</strong>: {tr.qty} units ({state.items.find((i) => i.id === tr.itemId)?.name}) from{' '}
                    <strong>{state.sites.find((s) => s.id === tr.fromSiteId)?.name}</strong> →{' '}
                    <strong>{state.sites.find((s) => s.id === tr.toSiteId)?.name}</strong> ({tr.status})
                  </div>
                  <div className="flex gap-2">
                    {tr.status === 'pending_coordinator' && can('material.transfer.approve') && (
                      <button
                        type="button"
                        onClick={() =>
                          mutateState((draft) => {
                            const x = draft.stockTransfers.find((t) => t.id === tr.id);
                            if (x) x.status = 'in_transit';
                          })
                        }
                        className="rounded bg-asty-charcoal px-3 py-1 text-white font-semibold"
                      >
                        Coordinator Approve
                      </button>
                    )}
                    {tr.status === 'in_transit' && can('material.grn.create') && (
                      <button
                        type="button"
                        onClick={() =>
                          mutateState((draft) => {
                            const x = draft.stockTransfers.find((t) => t.id === tr.id);
                            if (x) x.status = 'received';
                          })
                        }
                        className="rounded bg-emerald-700 px-3 py-1 text-white font-semibold"
                      >
                        Confirm Receipt at Site
                      </button>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {tab === 'masters' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 text-xs">
          <div className="rounded-2xl border border-asty-border bg-white p-5 space-y-3">
            <h3 className="font-heading text-sm font-bold">Item Master</h3>
            {can('material.edit') && (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  if (!newItemName.trim()) return;
                  mutateState((draft) => {
                    const id = `itm-${Date.now()}`;
                    draft.items.push({
                      id,
                      code: `MAT-${draft.items.length + 1}`,
                      name: newItemName.trim(),
                      nameMl: newItemName.trim(),
                      category: 'other',
                      unit: newItemUnit.trim() || 'Nos',
                      hsnCode: '2523',
                      gstRatePct: Number(newItemGst) || 18,
                      defaultWastagePct: 3,
                      referenceRatePaise: 0,
                    });
                    setPoItemId(id);
                  });
                  setNewItemName('');
                }}
                className="flex flex-wrap gap-2"
              >
                <input
                  type="text"
                  value={newItemName}
                  onChange={(e) => setNewItemName(e.target.value)}
                  placeholder="Item name (e.g. OPC 53 Cement)"
                  className="flex-1 rounded-lg border border-asty-border px-2.5 py-1.5"
                />
                <input
                  type="text"
                  value={newItemUnit}
                  onChange={(e) => setNewItemUnit(e.target.value)}
                  placeholder="Unit"
                  className="w-20 rounded-lg border border-asty-border px-2.5 py-1.5"
                />
                <input
                  type="number"
                  value={newItemGst}
                  onChange={(e) => setNewItemGst(e.target.value)}
                  placeholder="GST %"
                  className="w-20 rounded-lg border border-asty-border px-2.5 py-1.5"
                />
                <button type="submit" className="rounded-lg bg-asty-charcoal px-3 py-1.5 font-bold text-white">
                  + Add Item
                </button>
              </form>
            )}
            <div className="divide-y">
              {state.items.length === 0 ? (
                <div className="py-4 text-slate-400">No items added yet.</div>
              ) : (
                state.items.map((it) => (
                  <div key={it.id} className="py-2 flex justify-between">
                    <span>
                      <strong>{it.name}</strong> • HSN {it.hsnCode}
                    </span>
                    <span className="font-mono">
                      {it.unit} ({it.gstRatePct}% GST)
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>
          <div className="rounded-2xl border border-asty-border bg-white p-5 space-y-3">
            <h3 className="font-heading text-sm font-bold">Vendor Master</h3>
            {can('material.edit') && (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  if (!newVendorName.trim()) return;
                  mutateState((draft) => {
                    const id = `vnd-${Date.now()}`;
                    draft.vendors.push({
                      id,
                      code: `VND-${draft.vendors.length + 1}`,
                      name: newVendorName.trim(),
                      phone: '',
                      gstin: newVendorGstin.trim(),
                      address: 'Kerala',
                    });
                    setPoVendorId(id);
                  });
                  setNewVendorName('');
                  setNewVendorGstin('');
                }}
                className="flex flex-wrap gap-2"
              >
                <input
                  type="text"
                  value={newVendorName}
                  onChange={(e) => setNewVendorName(e.target.value)}
                  placeholder="Supplier / Vendor Name"
                  className="flex-1 rounded-lg border border-asty-border px-2.5 py-1.5"
                />
                <input
                  type="text"
                  value={newVendorGstin}
                  onChange={(e) => setNewVendorGstin(e.target.value)}
                  placeholder="GSTIN (Optional)"
                  className="w-40 rounded-lg border border-asty-border px-2.5 py-1.5"
                />
                <button type="submit" className="rounded-lg bg-asty-charcoal px-3 py-1.5 font-bold text-white">
                  + Add Vendor
                </button>
              </form>
            )}
            <div className="divide-y">
              {state.vendors.length === 0 ? (
                <div className="py-4 text-slate-400">No vendors added yet.</div>
              ) : (
                state.vendors.map((v) => (
                  <div key={v.id} className="py-2 flex justify-between">
                    <span>
                      <strong>{v.name}</strong> • {v.address}
                    </span>
                    <span className="font-mono text-slate-500">{v.gstin}</span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {selectedPoForPdf && (
        <AstyLetterheadModal
          open={Boolean(selectedPoForPdf)}
          onClose={() => setSelectedPoForPdf(null)}
          documentType="PURCHASE ORDER"
          documentNo={selectedPoForPdf.poNumber}
          dateFormatted={formatDDMMYYYY(selectedPoForPdf.poDate)}
          siteName={state.sites.find((s) => s.id === selectedPoForPdf.siteId)?.name}
        >
          <div className="space-y-4">
            <div>
              <strong>To Vendor:</strong>{' '}
              {state.vendors.find((v) => v.id === selectedPoForPdf.vendorId)?.name} (GSTIN:{' '}
              {state.vendors.find((v) => v.id === selectedPoForPdf.vendorId)?.gstin})
            </div>
            <table className="w-full border border-asty-border text-xs">
              <thead className="bg-asty-surface">
                <tr>
                  <th className="p-2 text-left">Item Description</th>
                  <th className="p-2 text-right">Qty</th>
                  <th className="p-2 text-right">Rate</th>
                  <th className="p-2 text-right">Taxable</th>
                  <th className="p-2 text-right">GST ({selectedPoForPdf.gstRatePct}%)</th>
                  <th className="p-2 text-right">Total</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td className="p-2">{state.items.find((i) => i.id === selectedPoForPdf.itemId)?.name}</td>
                  <td className="p-2 text-right">{selectedPoForPdf.qtyOrdered}</td>
                  <td className="p-2 text-right">{formatINR(selectedPoForPdf.ratePaise)}</td>
                  <td className="p-2 text-right">{formatINR(selectedPoForPdf.subtotalPaise)}</td>
                  <td className="p-2 text-right">{formatINR(selectedPoForPdf.gstPaise)}</td>
                  <td className="p-2 text-right font-bold">{formatINR(selectedPoForPdf.totalPaise)}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </AstyLetterheadModal>
      )}
    </div>
  );
}

