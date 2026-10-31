import React, { useState } from 'react';
import { History, Plus, RotateCcw, Shield, UserPlus } from 'lucide-react';
import { useErp } from '@/app/ErpContext';
import type { LoginType } from '@/lib/database.types';
import { formatDateTimeIST } from '@/lib/dates';
import { appendAudit } from '@/lib/erpEngine';
import { formatINR, rupeesToPaise } from '@/lib/money';

export function AdminPage() {
  const { state, currentUser, mutateState, resetDemoData } = useErp();
  const [tab, setTab] = useState<'positions' | 'matrix' | 'users' | 'chains' | 'audit'>('positions');
  const [selectedPositionId, setSelectedPositionId] = useState(state.positions[2]?.id ?? 'pos-ops');

  // Dynamic Position Creation (SPEC Section 3.2 — e.g. Site Engineer, Store Keeper, QS)
  const [posName, setPosName] = useState('');
  const [posType, setPosType] = useState<LoginType>('field');
  const [posReportsTo, setPosReportsTo] = useState('pos-coord');
  const [posDesc, setPosDesc] = useState('');

  // New User Form
  const [uName, setUName] = useState('');
  const [uEmail, setUEmail] = useState('');
  const [uPosId, setUPosId] = useState('pos-sup');
  const [uSiteId, setUSiteId] = useState('site-hadi');

  // Ops Threshold Editor
  const [opsLimitInr, setOpsLimitInr] = useState('3000');

  if (!currentUser) return null;

  const handleAddPosition = (e: React.FormEvent) => {
    e.preventDefault();
    if (!posName.trim()) return;
    mutateState((draft) => {
      const id = `pos-custom-${Date.now()}`;
      draft.positions.push({
        id,
        name: posName.trim(),
        loginType: posType,
        deviceHint: posType === 'field' ? 'Mobile' : 'Computer',
        description: posDesc.trim() || 'Dynamically added company position (zero code change)',
        reportsToPositionId: posReportsTo || null,
        isSystemProtected: false,
        isActive: true,
      });
      draft.positionPermissions[id] = ['site.view', 'dpr.view', 'dpr.create', 'approval.view', 'approval.create', 'material.view'];
      appendAudit(draft, currentUser.id, 'positions', id, 'INSERT', `Created new position "${posName.trim()}"`);
      setSelectedPositionId(id);
    });
    setPosName('');
    setPosDesc('');
    setTab('matrix');
  };

  const handleCreateUser = (e: React.FormEvent) => {
    e.preventDefault();
    if (!uName.trim()) return;
    mutateState((draft) => {
      const id = `usr-${Date.now()}`;
      draft.users.push({
        id,
        employeeCode: `ASTY-0${draft.users.length + 10}`,
        fullName: uName.trim(),
        email: uEmail.trim() || `user${draft.users.length + 1}@asty.demo`,
        phone: '+91 98470 99999',
        preferredLanguage: 'en',
        isActive: true,
        positionIds: [uPosId],
        allSites: uSiteId === 'ALL',
        assignedSiteIds: uSiteId === 'ALL' ? [] : [uSiteId],
      });
      appendAudit(draft, currentUser.id, 'profiles', id, 'INSERT', `Created user ${uName.trim()}`);
    });
    setUName('');
    setUEmail('');
  };

  const togglePermission = (posId: string, permCode: string) => {
    mutateState((draft) => {
      const list = draft.positionPermissions[posId] ?? [];
      if (list.includes(permCode)) {
        draft.positionPermissions[posId] = list.filter((c) => c !== permCode);
      } else {
        draft.positionPermissions[posId] = [...list, permCode];
      }
      appendAudit(draft, currentUser.id, 'position_permissions', `${posId}:${permCode}`, 'UPDATE', `Updated permission ${permCode} on ${posId}`);
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-heading text-2xl font-bold text-asty-black">
            System Admin — Dynamic Positions, Permissions & Audit Log
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Positions & permissions are pure data (SPEC Section 3.2) • Add Site Engineer, Store Keeper or QS anytime with zero code changes
          </p>
        </div>

        <button
          type="button"
          onClick={resetDemoData}
          className="inline-flex items-center gap-1.5 rounded-xl border border-asty-border bg-white px-3.5 py-2 text-xs font-semibold hover:bg-slate-50"
        >
          <RotateCcw className="h-3.5 w-3.5" />
          Reset Seeded Demo State
        </button>
      </div>

      <div className="flex flex-wrap gap-2 border-b border-asty-border pb-2 text-xs font-semibold">
        {[
          { id: 'positions', label: `Positions & Hierarchy (${state.positions.length})` },
          { id: 'matrix', label: 'Permission Matrix' },
          { id: 'users', label: `Users & Site Access (${state.users.length})` },
          { id: 'chains', label: 'Approval Limits & Chains' },
          { id: 'audit', label: `Audit Log (${state.auditLog.length})` },
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

      {tab === 'positions' && (
        <div className="space-y-6">
          <form
            onSubmit={handleAddPosition}
            className="rounded-2xl border border-asty-border bg-white p-5 space-y-3 text-xs"
          >
            <h2 className="font-heading text-sm font-bold flex items-center gap-1.5">
              <Plus className="h-4 w-4" /> Add New Company Position (No Code Change Needed)
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
              <input
                required
                value={posName}
                onChange={(e) => setPosName(e.target.value)}
                placeholder="e.g. Site Engineer or Store Keeper"
                className="rounded-lg border border-asty-border px-3 py-2"
              />
              <select
                value={posType}
                onChange={(e) => setPosType(e.target.value as LoginType)}
                className="rounded-lg border border-asty-border px-3 py-2"
              >
                <option value="field">Field (Mobile PWA)</option>
                <option value="office">Office (Desktop)</option>
                <option value="management">Management</option>
                <option value="external">External</option>
              </select>
              <select
                value={posReportsTo}
                onChange={(e) => setPosReportsTo(e.target.value)}
                className="rounded-lg border border-asty-border px-3 py-2"
              >
                <option value="">Reports To: (Top Level)</option>
                {state.positions.map((p) => (
                  <option key={p.id} value={p.id}>
                    Reports To: {p.name}
                  </option>
                ))}
              </select>
              <button
                type="submit"
                className="rounded-lg bg-asty-charcoal px-4 py-2 font-bold text-white"
              >
                Create Position → Edit Matrix
              </button>
            </div>
            <input
              value={posDesc}
              onChange={(e) => setPosDesc(e.target.value)}
              placeholder="Responsibilities description..."
              className="w-full rounded-lg border border-asty-border px-3 py-2"
            />
          </form>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
            {state.positions.map((p) => {
              const reportsTo = state.positions.find((x) => x.id === p.reportsToPositionId)?.name ?? 'Board / Top';
              const permCount = (state.positionPermissions[p.id] ?? []).length;
              return (
                <div key={p.id} className="rounded-2xl border border-asty-border bg-white p-4 flex justify-between gap-3">
                  <div>
                    <div className="font-heading text-sm font-bold text-asty-black flex items-center gap-2">
                      <span>{p.name}</span>
                      {p.isSystemProtected && (
                        <span className="rounded bg-slate-200 px-1.5 py-0.5 text-[10px]">Protected</span>
                      )}
                    </div>
                    <div className="text-slate-500 mt-1">{p.description}</div>
                    <div className="mt-2 font-semibold text-asty-charcoal">
                      Reports To: {reportsTo} • {permCount} Permissions
                    </div>
                  </div>
                  {!p.isSystemProtected && (
                    <button
                      type="button"
                      onClick={() =>
                        mutateState((draft) => {
                          const target = draft.positions.find((x) => x.id === p.id);
                          if (target) target.isActive = !target.isActive;
                        })
                      }
                      className="self-start rounded-lg border border-asty-border px-2.5 py-1 font-semibold"
                    >
                      {p.isActive ? 'Active' : 'Inactive'}
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {tab === 'matrix' && (
        <div className="rounded-2xl border border-asty-border bg-white p-5 space-y-4 text-xs">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Shield className="h-4 w-4 text-asty-charcoal" />
              <span className="font-bold">Select Position to Configure Permissions:</span>
            </div>
            <select
              value={selectedPositionId}
              onChange={(e) => setSelectedPositionId(e.target.value)}
              className="rounded-xl border border-asty-border px-3 py-2 font-bold"
            >
              {state.positions.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
            {state.permissions.map((perm) => {
              const checked = (state.positionPermissions[selectedPositionId] ?? []).includes(perm.code);
              return (
                <label
                  key={perm.id}
                  className={`flex items-start gap-2.5 rounded-xl border p-3 cursor-pointer ${
                    checked ? 'border-asty-charcoal bg-asty-surface' : 'border-asty-border'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => togglePermission(selectedPositionId, perm.code)}
                    className="mt-0.5 h-4 w-4"
                  />
                  <div>
                    <div className="font-mono font-bold text-asty-black">{perm.code}</div>
                    <div className="text-slate-500">{perm.description}</div>
                  </div>
                </label>
              );
            })}
          </div>
        </div>
      )}

      {tab === 'users' && (
        <div className="space-y-5 text-xs">
          <form onSubmit={handleCreateUser} className="rounded-2xl border border-asty-border bg-white p-5 space-y-3">
            <h3 className="font-heading text-sm font-bold flex items-center gap-1.5">
              <UserPlus className="h-4 w-4" /> Create User & Assign Position + Site Access
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-5 gap-3">
              <input
                required
                value={uName}
                onChange={(e) => setUName(e.target.value)}
                placeholder="Display Name (e.g. Demo Site Engineer 1)"
                className="rounded-lg border border-asty-border px-3 py-2"
              />
              <input
                value={uEmail}
                onChange={(e) => setUEmail(e.target.value)}
                placeholder="Email for OTP"
                className="rounded-lg border border-asty-border px-3 py-2"
              />
              <select value={uPosId} onChange={(e) => setUPosId(e.target.value)} className="rounded-lg border border-asty-border px-3 py-2">
                {state.positions.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
              <select value={uSiteId} onChange={(e) => setUSiteId(e.target.value)} className="rounded-lg border border-asty-border px-3 py-2">
                <option value="ALL">All Sites Access</option>
                {state.sites.map((s) => (
                  <option key={s.id} value={s.id}>
                    Site: {s.name}
                  </option>
                ))}
              </select>
              <button type="submit" className="rounded-lg bg-asty-charcoal px-4 py-2 font-bold text-white">
                Create User
              </button>
            </div>
          </form>

          <div className="rounded-2xl border border-asty-border bg-white overflow-hidden">
            <table className="w-full text-left">
              <thead className="bg-asty-surface uppercase text-slate-600">
                <tr>
                  <th className="px-4 py-3">Code & User</th>
                  <th className="px-4 py-3">Assigned Position(s)</th>
                  <th className="px-4 py-3">Site Access Scope</th>
                  <th className="px-4 py-3 text-right">Status (Never Deleted)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {state.users.map((u) => (
                  <tr key={u.id}>
                    <td className="px-4 py-3">
                      <div className="font-bold">{u.fullName}</div>
                      <div className="text-slate-500">{u.email}</div>
                    </td>
                    <td className="px-4 py-3">
                      {u.positionIds.map((pid) => state.positions.find((p) => p.id === pid)?.name).join(', ')}
                    </td>
                    <td className="px-4 py-3">
                      {u.allSites
                        ? 'All Sites'
                        : u.assignedSiteIds.map((sid) => state.sites.find((s) => s.id === sid)?.name).join(', ')}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        type="button"
                        onClick={() =>
                          mutateState((draft) => {
                            const target = draft.users.find((x) => x.id === u.id);
                            if (target && target.id !== currentUser.id) target.isActive = !target.isActive;
                          })
                        }
                        className={`rounded-lg px-3 py-1 font-bold ${
                          u.isActive ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-200 text-slate-600'
                        }`}
                      >
                        {u.isActive ? 'Active' : 'Deactivated'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === 'chains' && (
        <div className="rounded-2xl border border-asty-border bg-white p-5 space-y-4 text-xs">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b pb-4">
            <div>
              <h3 className="font-heading text-sm font-bold">
                Configurable Operations Executive Spending Approval Limit (Default ₹3,000)
              </h3>
              <p className="text-slate-500">
                Updates `max_amount_paise` across Material, PO, Petty Cash & Subcontractor Bill chains dynamically.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <input
                type="number"
                value={opsLimitInr}
                onChange={(e) => setOpsLimitInr(e.target.value)}
                className="w-32 rounded-lg border border-asty-border px-3 py-2 font-bold"
              />
              <button
                type="button"
                onClick={() => {
                  const limitPaise = rupeesToPaise(opsLimitInr);
                  mutateState((draft) => {
                    draft.approvalChains.forEach((ch) => {
                      ch.steps.forEach((st) => {
                        if (st.stepOrder === 2 && st.maxAmountPaise !== null) st.maxAmountPaise = limitPaise;
                        if ((st.stepOrder === 3 || st.stepOrder === 4) && st.minAmountPaise !== null) {
                          st.minAmountPaise = limitPaise + 1;
                        }
                      });
                    });
                    appendAudit(draft, currentUser.id, 'approval_chain_steps', 'spend_limit', 'UPDATE', `Updated approval threshold to ${formatINR(limitPaise)}`);
                  });
                }}
                className="rounded-lg bg-asty-charcoal px-4 py-2 font-bold text-white"
              >
                Update Limit (₹)
              </button>
            </div>
          </div>

          <div className="space-y-3">
            {state.approvalChains.map((ch) => (
              <div key={ch.id} className="rounded-xl border border-asty-border p-3.5">
                <div className="font-bold text-asty-black">
                  {ch.name} {ch.antiSplitEnabled ? `• 7-Day Anti-Split (${ch.antiSplitWindowDays}d)` : ''} • Escalates &gt; {ch.escalationHours}h
                </div>
                <div className="mt-2 flex flex-wrap gap-2">
                  {ch.steps.map((st) => {
                    const pName = state.positions.find((p) => p.id === st.positionId)?.name ?? st.positionId;
                    return (
                      <span key={st.stepOrder} className="rounded-lg bg-asty-surface px-2.5 py-1 font-mono">
                        Step {st.stepOrder}: {pName} ({st.stepKind}
                        {st.maxAmountPaise ? ` ≤ ${formatINR(st.maxAmountPaise)}` : ''}
                        {st.minAmountPaise ? ` ≥ ${formatINR(st.minAmountPaise)}` : ''})
                      </span>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {tab === 'audit' && (
        <div className="rounded-2xl border border-asty-border bg-white overflow-hidden text-xs">
          <div className="border-b border-asty-border bg-asty-surface px-4 py-3 font-bold flex items-center gap-2">
            <History className="h-4 w-4" /> Immutable Database Trigger Audit Log
          </div>
          <div className="divide-y divide-slate-100 max-h-[480px] overflow-y-auto">
            {state.auditLog.map((log) => {
              const actorName = state.users.find((u) => u.id === log.actorUserId)?.fullName ?? log.actorUserId;
              return (
                <div key={log.id} className="px-4 py-3 flex flex-wrap justify-between gap-2">
                  <div>
                    <span className="rounded bg-slate-100 px-1.5 py-0.5 font-mono font-bold mr-2">
                      {log.operation} {log.tableName}
                    </span>
                    <span className="font-semibold">{log.summary}</span>
                    <span className="text-slate-500 ml-2">by {actorName}</span>
                  </div>
                  <span className="text-slate-400 font-mono">{formatDateTimeIST(log.createdAt)}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

