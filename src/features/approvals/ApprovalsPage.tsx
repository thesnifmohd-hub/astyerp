import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Check, Clock, CornerUpLeft, Plus, ShieldAlert, X } from 'lucide-react';
import { useErp } from '@/app/ErpContext';
import type { ApprovalRequestType } from '@/lib/database.types';
import { formatDateTimeIST } from '@/lib/dates';
import {
  createApprovalRequest,
  escalateStaleApprovals,
  processApprovalAction,
} from '@/lib/erpEngine';
import { formatINR, rupeesToPaise } from '@/lib/money';

export function ApprovalsPage() {
  const { t } = useTranslation();
  const { state, currentUser, visibleSites, can, mutateState } = useErp();
  const [tab, setTab] = useState<'inbox' | 'all' | 'raise'>('inbox');
  const [commentMap, setCommentMap] = useState<Record<string, string>>({});
  const [msg, setMsg] = useState<string | null>(null);

  // Raise Request Form
  const [reqType, setReqType] = useState<ApprovalRequestType>('petty_cash');
  const [reqSiteId, setReqSiteId] = useState<string>(visibleSites[0]?.id ?? '');
  const [reqItemId, setReqItemId] = useState<string>(state.items[0]?.id ?? '');
  const [reqAmountInr, setReqAmountInr] = useState('');
  const [reqTitle, setReqTitle] = useState('');
  const [reqDetails, setReqDetails] = useState('');

  if (!currentUser) return null;

  const inboxItems = state.approvalRequests.filter(
    (r) => r.status === 'pending' && currentUser.positionIds.includes(r.currentPositionId),
  );
  const visibleAll = state.approvalRequests.filter(
    (r) => !r.siteId || visibleSites.some((s) => s.id === r.siteId),
  );

  const act = (requestId: string, decision: 'approve' | 'reject' | 'send_back') => {
    setMsg(null);
    try {
      mutateState((draft) => {
        processApprovalAction(draft, {
          actorUserId: currentUser.id,
          requestId,
          decision,
          comment: commentMap[requestId] || `${decision.toUpperCase()} via mobile inbox`,
        });
      });
      setMsg(`Action recorded: ${decision.toUpperCase()}`);
    } catch (err) {
      setMsg((err as Error).message);
    }
  };

  const handleRaise = (e: React.FormEvent) => {
    e.preventDefault();
    setMsg(null);
    try {
      mutateState((draft) => {
        createApprovalRequest(draft, {
          actorUserId: currentUser.id,
          requestType: reqType,
          siteId: reqSiteId,
          sourceTable: reqType,
          sourceId: `src-${Date.now()}`,
          antiSplitItemId: reqItemId,
          amountPaise: rupeesToPaise(reqAmountInr),
          title: reqTitle.trim() || `${reqType.replace('_', ' ').toUpperCase()} Request`,
          details: reqDetails.trim() || 'Submitted with required site attachment',
          attachmentLabel: 'site_supporting_photo.jpg',
        });
      });
      setReqTitle('');
      setReqDetails('');
      setTab('all');
      setMsg('Request submitted into configurable approval chain (7-day anti-split checked)!');
    } catch (err) {
      setMsg((err as Error).message);
    }
  };

  const listToRender = tab === 'inbox' ? inboxItems : visibleAll;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-heading text-2xl font-bold text-asty-black">
            Configurable Approvals & Anti-Splitting Inbox
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Coordinator Technical Check → ≤ ₹3,000 Ops Executive Approves → &gt; ₹3,000 Management Approves • 7-Day Anti-Split Active
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => {
              let count = 0;
              mutateState((draft) => {
                count = escalateStaleApprovals(draft);
              });
              setMsg(`24h SLA Escalation Job checked pending queue (${count} escalated).`);
            }}
            className="inline-flex items-center gap-1.5 rounded-xl border border-asty-border bg-white px-3.5 py-2 text-xs font-semibold hover:bg-slate-50"
          >
            <Clock className="h-3.5 w-3.5" />
            Run 24h Escalation Check
          </button>

          {can('approval.create') && (
            <button
              type="button"
              onClick={() => setTab('raise')}
              className="inline-flex items-center gap-1.5 rounded-xl bg-asty-charcoal px-4 py-2 text-xs font-semibold text-white hover:bg-asty-black"
            >
              <Plus className="h-4 w-4" />
              Raise Request
            </button>
          )}
        </div>
      </div>

      {msg && (
        <div className="rounded-xl border border-asty-border bg-white px-4 py-3 text-xs font-semibold text-asty-charcoal">
          {msg}
        </div>
      )}

      <div className="flex gap-2 border-b border-asty-border pb-2 text-xs font-semibold">
        <button
          type="button"
          onClick={() => setTab('inbox')}
          className={`rounded-lg px-4 py-2 ${tab === 'inbox' ? 'bg-asty-charcoal text-white' : 'bg-white border border-asty-border'}`}
        >
          {t('approvals.inbox')} ({inboxItems.length})
        </button>
        <button
          type="button"
          onClick={() => setTab('all')}
          className={`rounded-lg px-4 py-2 ${tab === 'all' ? 'bg-asty-charcoal text-white' : 'bg-white border border-asty-border'}`}
        >
          {t('approvals.all_requests')} ({visibleAll.length})
        </button>
      </div>

      {tab === 'raise' ? (
        <form onSubmit={handleRaise} className="rounded-2xl border border-asty-border bg-white p-6 space-y-4 text-xs">
          <h2 className="font-heading text-base font-bold">
            Raise Approval Request (Test 7-Day Anti-Splitting!)
          </h2>
          <p className="text-slate-500">
            Tip: Raise two Petty Cash requests of ₹1,800 each on the same site + item within 7 days — the second request&apos;s rolling 7-day sum becomes ₹3,600 (&gt; ₹3,000) and automatically routes to Management!
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
            <div>
              <label className="font-semibold block mb-1">Request Type</label>
              <select
                value={reqType}
                onChange={(e) => setReqType(e.target.value as ApprovalRequestType)}
                className="w-full rounded-lg border border-asty-border px-3 py-2.5"
              >
                <option value="petty_cash">Petty Cash</option>
                <option value="material_request">Material Request</option>
                <option value="task_completion">Task Completion (Quality Check)</option>
                <option value="extra_work">Extra Work</option>
                <option value="plan_change">Site Plan Change</option>
              </select>
            </div>
            <div>
              <label className="font-semibold block mb-1">Site</label>
              <select
                value={reqSiteId}
                onChange={(e) => setReqSiteId(e.target.value)}
                className="w-full rounded-lg border border-asty-border px-3 py-2.5"
              >
                {visibleSites.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="font-semibold block mb-1">Linked Item (Anti-Split Key)</label>
              <select
                value={reqItemId}
                onChange={(e) => setReqItemId(e.target.value)}
                className="w-full rounded-lg border border-asty-border px-3 py-2.5"
              >
                {state.items.map((it) => (
                  <option key={it.id} value={it.id}>
                    {it.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="font-semibold block mb-1">Amount (₹ INR)</label>
              <input
                type="number"
                required
                value={reqAmountInr}
                onChange={(e) => setReqAmountInr(e.target.value)}
                className="w-full rounded-lg border border-asty-border px-3 py-2.5"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <input
              required
              value={reqTitle}
              onChange={(e) => setReqTitle(e.target.value)}
              placeholder="Short request title..."
              className="rounded-lg border border-asty-border px-3 py-2.5"
            />
            <input
              value={reqDetails}
              onChange={(e) => setReqDetails(e.target.value)}
              placeholder="Purpose, activity linkage, quantity details..."
              className="rounded-lg border border-asty-border px-3 py-2.5"
            />
          </div>

          <button
            type="submit"
            className="rounded-xl bg-asty-charcoal px-6 py-3 font-bold text-white hover:bg-asty-black"
          >
            Submit into Approval Engine
          </button>
        </form>
      ) : (
        <div className="space-y-3">
          {listToRender.length === 0 ? (
            <div className="rounded-2xl border border-asty-border bg-white p-8 text-center text-sm text-slate-500">
              No pending requests waiting on your current position. Switch positions in the top header to test another step!
            </div>
          ) : (
            listToRender.map((req) => {
              const siteName = state.sites.find((s) => s.id === req.siteId)?.name ?? 'Company';
              const stepPos = state.positions.find((p) => p.id === req.currentPositionId);
              const isMyTurn =
                req.status === 'pending' && currentUser.positionIds.includes(req.currentPositionId);
              const antiSplitTriggered = req.rolling7dAmountPaise > req.amountPaise;

              return (
                <div
                  key={req.id}
                  className="rounded-2xl border border-asty-border bg-white p-5 space-y-3 shadow-sm"
                >
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-mono text-xs font-bold text-asty-charcoal">
                          {req.requestNumber}
                        </span>
                        <span className="rounded bg-asty-surface px-2 py-0.5 text-[11px] font-semibold uppercase">
                          {req.requestType.replace('_', ' ')}
                        </span>
                        <span className="text-xs text-slate-500">• {siteName}</span>
                        <span
                          className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase ${
                            req.status === 'approved'
                              ? 'bg-emerald-100 text-emerald-800'
                              : req.status === 'pending'
                                ? 'bg-amber-100 text-amber-900'
                                : 'bg-red-100 text-red-800'
                          }`}
                        >
                          {req.status} {req.status === 'pending' ? `→ ${stepPos?.name}` : ''}
                        </span>
                      </div>
                      <h3 className="font-heading text-base font-bold text-asty-black mt-1">
                        {req.title}
                      </h3>
                      <p className="text-xs text-slate-600">{req.details}</p>
                    </div>

                    <div className="text-right">
                      <div className="font-heading text-lg font-bold text-asty-black">
                        {formatINR(req.amountPaise)}
                      </div>
                      {antiSplitTriggered && (
                        <div className="inline-flex items-center gap-1 rounded bg-amber-100 px-2 py-0.5 text-[11px] font-bold text-amber-900 mt-1">
                          <ShieldAlert className="h-3.5 w-3.5" />
                          {t('approvals.anti_split_badge')}: {formatINR(req.rolling7dAmountPaise)}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Step Audit Trail */}
                  {req.actions.length > 0 && (
                    <div className="rounded-xl bg-asty-surface p-3 space-y-1 text-xs">
                      {req.actions.map((a, idx) => {
                        const posName = state.positions.find((p) => p.id === a.actorPositionId)?.name ?? a.actorPositionId;
                        return (
                          <div key={idx} className="flex flex-wrap justify-between gap-2">
                            <span>
                              <strong>{posName}</strong> → <span className="uppercase font-mono">{a.action}</span>: {a.comment}
                            </span>
                            <span className="text-slate-400">{formatDateTimeIST(a.createdAt)}</span>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {/* One-Tap Mobile Approval Controls */}
                  {isMyTurn && (
                    <div className="flex flex-col sm:flex-row gap-2 pt-2 border-t border-asty-border">
                      <input
                        value={commentMap[req.id] ?? ''}
                        onChange={(e) => setCommentMap((m) => ({ ...m, [req.id]: e.target.value }))}
                        placeholder="Optional approval / technical check note..."
                        className="flex-1 rounded-xl border border-asty-border px-3 py-2.5 text-xs"
                      />
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => act(req.id, 'approve')}
                          className="min-h-11 inline-flex items-center gap-1.5 rounded-xl bg-emerald-700 px-4 py-2 text-xs font-bold text-white hover:bg-emerald-800"
                        >
                          <Check className="h-4 w-4" />
                          {t('approvals.approve')}
                        </button>
                        <button
                          type="button"
                          onClick={() => act(req.id, 'send_back')}
                          className="min-h-11 inline-flex items-center gap-1.5 rounded-xl border border-amber-300 bg-amber-50 px-3.5 py-2 text-xs font-bold text-amber-900"
                        >
                          <CornerUpLeft className="h-4 w-4" />
                          {t('approvals.send_back')}
                        </button>
                        <button
                          type="button"
                          onClick={() => act(req.id, 'reject')}
                          className="min-h-11 inline-flex items-center gap-1.5 rounded-xl border border-red-200 bg-red-50 px-3.5 py-2 text-xs font-bold text-red-700"
                        >
                          <X className="h-4 w-4" />
                          {t('approvals.reject')}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}

