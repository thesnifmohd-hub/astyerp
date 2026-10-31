import React, { useState } from 'react';
import { Building2, FileText, Lock, MapPin, Plus, Users } from 'lucide-react';
import { useErp } from '@/app/ErpContext';
import { SiteGeofencePicker } from '@/components/maps/SiteGeofencePicker';
import type { ContractType, ProjectType, SiteStatus } from '@/lib/database.types';
import { formatDDMMYYYY, todayISOInIST } from '@/lib/dates';
import { appendAudit, getVisibleSiteFinancials } from '@/lib/erpEngine';
import { formatINR, rupeesToPaise } from '@/lib/money';

export function SitesPage() {
  const { state, currentUser, visibleSites, can, mutateState } = useErp();
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [selectedSiteId, setSelectedSiteId] = useState<string>(visibleSites[0]?.id ?? '');
  const [activeTab, setActiveTab] = useState<'overview' | 'team' | 'documents'>('overview');
  const [showCreate, setShowCreate] = useState(false);

  // Create Site Form State
  const [newName, setNewName] = useState('');
  const [newAddress, setNewAddress] = useState('');
  const [newClientName, setNewClientName] = useState('');
  const [newClientPhone, setNewClientPhone] = useState('');
  const [newProjectType, setNewProjectType] = useState<ProjectType>('residential');
  const [newContractType, setNewContractType] = useState<ContractType>('lump_sum');
  const [newContractRupees, setNewContractRupees] = useState('');
  const [newPmcPct, setNewPmcPct] = useState('0');
  const [newLat, setNewLat] = useState(10.5276);
  const [newLng, setNewLng] = useState(76.2144);
  const [newRadius, setNewRadius] = useState(150);
  const [docTitle, setDocTitle] = useState('');

  if (!currentUser) return null;

  const filteredSites = visibleSites.filter((s) =>
    statusFilter === 'all' ? true : s.status === statusFilter,
  );
  const selectedSite =
    visibleSites.find((s) => s.id === selectedSiteId) ?? filteredSites[0] ?? null;

  const siteFin = selectedSite
    ? getVisibleSiteFinancials(state, currentUser.id, selectedSite.id)
    : null;

  const handleCreateSite = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim()) return;
    mutateState((draft) => {
      const clientId = `cl-${Date.now()}`;
      draft.clients.push({
        id: clientId,
        code: `CL-${draft.clients.length + 10}`,
        name: newClientName.trim() || `${newName} Client`,
        phone: newClientPhone.trim() || '+91 94470 00000',
        email: '',
        gstin: '',
        address: newAddress.trim(),
      });
      const siteId = `site-${Date.now()}`;
      const code = `ASTY-S0${draft.sites.length + 1}`;
      draft.sites.push({
        id: siteId,
        code,
        name: newName.trim(),
        clientId,
        siteAddress: newAddress.trim() || 'Kerala, India',
        lat: newLat,
        lng: newLng,
        geofenceRadiusM: newRadius,
        projectType: newProjectType,
        contractType: newContractType,
        status: 'active',
        startDate: todayISOInIST(),
        targetEndDate: '2027-03-31',
        morningStart: '08:00',
        morningEnd: '10:00',
        afternoonStart: '12:30',
        afternoonEnd: '14:30',
        eveningStart: '16:30',
        eveningEnd: '19:00',
        scheduleHealth: 'on_track',
        daysBehind: 0,
        supervisorIds: [],
        coordinatorId: currentUser.id,
        documents: [],
      });
      draft.siteFinancials[siteId] = {
        siteId,
        contractValuePaise: rupeesToPaise(newContractRupees),
        pmcFeePct: Number(newPmcPct) || 0,
        retentionPct: 5,
        mobilisationAdvancePaise: 0,
        profitShareSplit: [
          { partnerLabel: 'Managing Partner 1', sharePct: 50, role: 'partner' },
          { partnerLabel: 'Managing Partner 2', sharePct: 50, role: 'partner' },
        ],
      };
      appendAudit(draft, currentUser.id, 'sites', siteId, 'INSERT', `Created site ${code} — ${newName}`);
      setSelectedSiteId(siteId);
    });
    setShowCreate(false);
    setNewName('');
    setNewAddress('');
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-heading text-2xl font-bold text-asty-black">Site Master & Geofencing</h1>
          <p className="text-xs text-slate-500 mt-0.5">
            RLS enforced via can_access_site() • Contract & partner profit split gated by report.profit.view
          </p>
        </div>

        <div className="flex items-center gap-2">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="rounded-xl border border-asty-border bg-white px-3 py-2 text-xs font-semibold"
          >
            <option value="all">All Statuses</option>
            <option value="active">Active</option>
            <option value="planning">Planning</option>
            <option value="on_hold">On Hold</option>
            <option value="completed">Completed</option>
          </select>

          {can('site.create') && (
            <button
              type="button"
              onClick={() => setShowCreate((v) => !v)}
              className="inline-flex items-center gap-1.5 rounded-xl bg-asty-charcoal px-4 py-2 text-xs font-semibold text-white hover:bg-asty-black"
            >
              <Plus className="h-4 w-4" />
              New Site
            </button>
          )}
        </div>
      </div>

      {/* Create Site Drawer */}
      {showCreate && can('site.create') && (
        <form
          onSubmit={handleCreateSite}
          className="rounded-2xl border border-asty-border bg-white p-6 shadow-sm space-y-4"
        >
          <h2 className="font-heading text-base font-bold">Create New Construction Site</h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
            <div>
              <label className="font-semibold block mb-1">Site Name *</label>
              <input
                required
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="e.g. Guruvayur Villa Annex"
                className="w-full rounded-lg border border-asty-border px-3 py-2"
              />
            </div>
            <div>
              <label className="font-semibold block mb-1">Site Address *</label>
              <input
                required
                value={newAddress}
                onChange={(e) => setNewAddress(e.target.value)}
                placeholder="Town, District, Kerala"
                className="w-full rounded-lg border border-asty-border px-3 py-2"
              />
            </div>
            <div>
              <label className="font-semibold block mb-1">Client Name</label>
              <input
                value={newClientName}
                onChange={(e) => setNewClientName(e.target.value)}
                placeholder="Client Full Name / LLP"
                className="w-full rounded-lg border border-asty-border px-3 py-2"
              />
            </div>
            <div>
              <label className="font-semibold block mb-1">Project Type</label>
              <select
                value={newProjectType}
                onChange={(e) => setNewProjectType(e.target.value as ProjectType)}
                className="w-full rounded-lg border border-asty-border px-3 py-2"
              >
                <option value="residential">Residential</option>
                <option value="commercial">Commercial / Resort</option>
              </select>
            </div>
            <div>
              <label className="font-semibold block mb-1">Contract Type</label>
              <select
                value={newContractType}
                onChange={(e) => setNewContractType(e.target.value as ContractType)}
                className="w-full rounded-lg border border-asty-border px-3 py-2"
              >
                <option value="lump_sum">Lump Sum</option>
                <option value="item_rate">Item Rate</option>
                <option value="labour_only">Labour Only</option>
                <option value="pmc_percent">PMC % of Actual Cost</option>
                <option value="cost_plus">Cost Plus</option>
              </select>
            </div>
            <div>
              <label className="font-semibold block mb-1">Allowed GPS Radius (m)</label>
              <input
                type="number"
                min={50}
                max={1000}
                value={newRadius}
                onChange={(e) => setNewRadius(Number(e.target.value))}
                className="w-full rounded-lg border border-asty-border px-3 py-2"
              />
            </div>
            {can('report.profit.view') && (
              <>
                <div>
                  <label className="font-semibold block mb-1">Contract Value (₹ INR)</label>
                  <input
                    type="number"
                    value={newContractRupees}
                    onChange={(e) => setNewContractRupees(e.target.value)}
                    className="w-full rounded-lg border border-asty-border px-3 py-2"
                  />
                </div>
                <div>
                  <label className="font-semibold block mb-1">PMC Fee % (if PMC)</label>
                  <input
                    type="number"
                    step="0.5"
                    value={newPmcPct}
                    onChange={(e) => setNewPmcPct(e.target.value)}
                    className="w-full rounded-lg border border-asty-border px-3 py-2"
                  />
                </div>
              </>
            )}
          </div>

          <SiteGeofencePicker
            lat={newLat}
            lng={newLng}
            radiusM={newRadius}
            onChange={(la, ln) => {
              setNewLat(la);
              setNewLng(ln);
            }}
          />

          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setShowCreate(false)}
              className="rounded-lg border border-asty-border px-4 py-2 text-xs font-semibold"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="rounded-lg bg-asty-charcoal px-5 py-2 text-xs font-semibold text-white"
            >
              Save Site & Geofence
            </button>
          </div>
        </form>
      )}

      {/* Split View: Site Cards + Selected Site Detail Tabs */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-4 space-y-2.5">
          {filteredSites.map((s) => (
            <button
              key={s.id}
              type="button"
              onClick={() => setSelectedSiteId(s.id)}
              className={`w-full text-left rounded-2xl border p-4 transition ${
                selectedSite?.id === s.id
                  ? 'border-asty-charcoal bg-asty-charcoal text-white shadow-md'
                  : 'border-asty-border bg-white hover:border-asty-slate'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-mono opacity-75">{s.code}</span>
                <span className="rounded-full bg-white/15 px-2 py-0.5 text-[10px] font-bold uppercase">
                  {s.projectType} • {s.contractType.replace('_', ' ')}
                </span>
              </div>
              <div className="mt-1 font-heading text-base font-bold">{s.name}</div>
              <div className="mt-0.5 text-xs opacity-80 flex items-center gap-1">
                <MapPin className="h-3.5 w-3.5 shrink-0" />
                <span className="truncate">{s.siteAddress}</span>
              </div>
            </button>
          ))}
        </div>

        {selectedSite && (
          <div className="lg:col-span-8 rounded-2xl border border-asty-border bg-white p-6 space-y-5">
            <div className="flex flex-wrap items-start justify-between gap-3 border-b border-asty-border pb-4">
              <div>
                <div className="flex items-center gap-2">
                  <Building2 className="h-5 w-5 text-asty-charcoal" />
                  <h2 className="font-heading text-xl font-bold text-asty-black">
                    {selectedSite.name}
                  </h2>
                  <span className="rounded bg-asty-surface px-2 py-0.5 text-xs font-mono">
                    {selectedSite.code}
                  </span>
                </div>
                <p className="text-xs text-slate-500 mt-1">{selectedSite.siteAddress}</p>
              </div>

              {can('site.edit') && (
                <select
                  value={selectedSite.status}
                  onChange={(e) => {
                    const nextStatus = e.target.value as SiteStatus;
                    mutateState((draft) => {
                      const target = draft.sites.find((x) => x.id === selectedSite.id);
                      if (target) target.status = nextStatus;
                    });
                  }}
                  className="rounded-lg border border-asty-border px-3 py-1.5 text-xs font-semibold"
                >
                  <option value="planning">Planning</option>
                  <option value="active">Active</option>
                  <option value="on_hold">On Hold</option>
                  <option value="completed">Completed</option>
                </select>
              )}
            </div>

            {/* Detail Tabs */}
            <div className="flex gap-2 border-b border-asty-border pb-2 text-xs font-semibold">
              {(['overview', 'team', 'documents'] as const).map((tab) => (
                <button
                  key={tab}
                  type="button"
                  onClick={() => setActiveTab(tab)}
                  className={`rounded-lg px-3.5 py-1.5 capitalize ${
                    activeTab === tab
                      ? 'bg-asty-charcoal text-white'
                      : 'text-slate-600 hover:bg-asty-surface'
                  }`}
                >
                  {tab}
                </button>
              ))}
            </div>

            {activeTab === 'overview' && (
              <div className="space-y-5">
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                  <div className="rounded-xl bg-asty-surface p-3">
                    <div className="text-slate-500">Start Date</div>
                    <div className="font-bold mt-0.5">{formatDDMMYYYY(selectedSite.startDate)}</div>
                  </div>
                  <div className="rounded-xl bg-asty-surface p-3">
                    <div className="text-slate-500">Target Completion</div>
                    <div className="font-bold mt-0.5">{formatDDMMYYYY(selectedSite.targetEndDate)}</div>
                  </div>
                  <div className="rounded-xl bg-asty-surface p-3">
                    <div className="text-slate-500">Geofence Radius</div>
                    <div className="font-bold mt-0.5">{selectedSite.geofenceRadiusM} meters</div>
                  </div>
                  <div className="rounded-xl bg-asty-surface p-3">
                    <div className="text-slate-500">Check-In Windows</div>
                    <div className="font-bold mt-0.5">
                      {selectedSite.morningStart} / {selectedSite.afternoonStart} / {selectedSite.eveningStart}
                    </div>
                  </div>
                </div>

                {/* Strict RLS Commercial & Profit-Share Section */}
                {siteFin ? (
                  <div className="rounded-xl border border-emerald-200 bg-emerald-50/50 p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold uppercase tracking-wider text-emerald-900">
                        Commercials & Partner Profit-Share (Management Only — report.profit.view)
                      </span>
                      <span className="font-heading text-base font-bold text-emerald-900">
                        {selectedSite.contractType === 'pmc_percent'
                          ? `PMC @ ${siteFin.pmcFeePct}% (Outlay ${formatINR(siteFin.contractValuePaise)})`
                          : formatINR(siteFin.contractValuePaise)}
                      </span>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {siteFin.profitShareSplit.map((sp, i) => (
                        <span
                          key={i}
                          className="rounded-lg bg-white border border-emerald-200 px-3 py-1 text-xs font-semibold text-emerald-950"
                        >
                          {sp.partnerLabel}: {sp.sharePct}% ({sp.role})
                        </span>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="rounded-xl border border-slate-200 bg-slate-50 p-3.5 flex items-center gap-2 text-xs text-slate-600">
                    <Lock className="h-4 w-4 text-slate-500 shrink-0" />
                    <span>
                      Contract value, margins, and partner profit-share rules are hidden by RLS (`report.profit.view` required).
                    </span>
                  </div>
                )}

                <SiteGeofencePicker
                  lat={selectedSite.lat}
                  lng={selectedSite.lng}
                  radiusM={selectedSite.geofenceRadiusM}
                  interactive={can('site.edit')}
                  onChange={(la, ln) => {
                    mutateState((draft) => {
                      const s = draft.sites.find((x) => x.id === selectedSite.id);
                      if (s) {
                        s.lat = la;
                        s.lng = ln;
                      }
                    });
                  }}
                />
              </div>
            )}

            {activeTab === 'team' && (
              <div className="space-y-3 text-xs">
                <div className="flex items-center gap-2 font-bold text-asty-black">
                  <Users className="h-4 w-4" /> Assigned Site Team
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="rounded-xl border border-asty-border p-3.5">
                    <div className="text-slate-500">Project Coordinator</div>
                    <div className="font-bold text-sm mt-1">
                      {state.users.find((u) => u.id === selectedSite.coordinatorId)?.fullName ?? '—'}
                    </div>
                  </div>
                  <div className="rounded-xl border border-asty-border p-3.5">
                    <div className="text-slate-500">Assigned Site Supervisor(s)</div>
                    <div className="font-bold text-sm mt-1">
                      {selectedSite.supervisorIds
                        .map((id) => state.users.find((u) => u.id === id)?.fullName)
                        .filter(Boolean)
                        .join(', ')}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'documents' && (
              <div className="space-y-3 text-xs">
                {selectedSite.documents.map((d) => (
                  <div
                    key={d.id}
                    className="flex items-center justify-between rounded-xl border border-asty-border p-3"
                  >
                    <div className="flex items-center gap-2.5">
                      <FileText className="h-4 w-4 text-asty-charcoal" />
                      <div>
                        <div className="font-semibold text-asty-black">{d.title}</div>
                        <div className="text-slate-500">
                          {d.category.toUpperCase()} • {d.version} • Uploaded {formatDDMMYYYY(d.uploadedAt)}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}

                {can('site.edit') && (
                  <div className="flex gap-2 pt-2">
                    <input
                      value={docTitle}
                      onChange={(e) => setDocTitle(e.target.value)}
                      placeholder="Upload drawing / agreement title (e.g. First-Floor Beam Rev 2)..."
                      className="flex-1 rounded-lg border border-asty-border px-3 py-2"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        if (!docTitle.trim()) return;
                        mutateState((draft) => {
                          const s = draft.sites.find((x) => x.id === selectedSite.id);
                          s?.documents.push({
                            id: `doc-${Date.now()}`,
                            category: 'drawing',
                            title: docTitle.trim(),
                            version: 'v1',
                            uploadedAt: todayISOInIST(),
                          });
                        });
                        setDocTitle('');
                      }}
                      className="rounded-lg bg-asty-charcoal px-4 py-2 font-semibold text-white"
                    >
                      Add Document
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
