import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  AlertTriangle,
  CheckCircle2,
  CloudOff,
  FileText,
  MapPin,
  Navigation,
  ShieldAlert,
} from 'lucide-react';
import { useErp } from '@/app/ErpContext';
import { LiveStampedCamera } from '@/components/camera/LiveStampedCamera';
import { AstyLetterheadModal } from '@/components/common/AstyLetterheadModal';
import type { DailyPhoto } from '@/lib/database.types';
import { formatDDMMYYYY, todayISOInIST } from '@/lib/dates';
import { submitSiteCheckin } from '@/lib/erpEngine';
import { evaluateGeofence } from '@/lib/geo';
import { enqueueOfflineCheckin } from '@/lib/offlineQueue';

export function DailyReportingPage() {
  const { t } = useTranslation();
  const { state, currentUser, visibleSites, can, mutateState } = useErp();
  const today = todayISOInIST();

  const [mode, setMode] = useState<'supervisor_pwa' | 'office_dpr'>(
    can('dpr.create') ? 'supervisor_pwa' : 'office_dpr',
  );
  const [siteId, setSiteId] = useState<string>(visibleSites[0]?.id ?? '');
  const [slot, setSlot] = useState<'morning' | 'afternoon' | 'evening'>('morning');
  const [selectedReportId, setSelectedReportId] = useState<string | null>(null);

  const activeSite = visibleSites.find((s) => s.id === siteId) ?? visibleSites[0];

  // GPS State
  const [gps, setGps] = useState<{ lat: number; lng: number; accuracyM: number }>({
    lat: activeSite?.lat ?? 10.5354,
    lng: activeSite?.lng ?? 76.2041,
    accuracyM: 10.5,
  });
  const [photos, setPhotos] = useState<DailyPhoto[]>([]);
  const [attendance, setAttendance] = useState<Record<string, 'present' | 'half_day' | 'absent'>>({
    'wrk-1': 'present',
    'wrk-2': 'present',
    'wrk-3': 'present',
  });
  const [subconTrade, setSubconTrade] = useState('Electrical & Conduit');
  const [subconCount, setSubconCount] = useState(4);
  const [completedQty, setCompletedQty] = useState(8);
  const [usedItemId, setUsedItemId] = useState('itm-cement');
  const [usedQty, setUsedQty] = useState(12);
  const [issueText, setIssueText] = useState('');
  const [isUrgent, setIsUrgent] = useState(false);
  const [tomorrowPlan, setTomorrowPlan] = useState('');
  const [feedback, setFeedback] = useState<{ type: 'ok' | 'err'; msg: string } | null>(null);

  if (!currentUser || !activeSite) return null;

  const geoEval = evaluateGeofence(gps, activeSite.lat, activeSite.lng, activeSite.geofenceRadiusM);
  const siteActivities = state.planActivities.filter((a) => a.siteId === activeSite.id);

  const requestHardwareGps = () => {
    if (!navigator.geolocation) {
      setFeedback({ type: 'err', msg: 'Browser Geolocation API not available' });
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setGps({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          accuracyM: pos.coords.accuracy,
        });
      },
      () => {
        setFeedback({
          type: 'err',
          msg: 'Device location permission declined; use Simulate Inside/Outside buttons on desktop.',
        });
      },
      { enableHighAccuracy: true, timeout: 6000 },
    );
  };

  const handleSubmitCheckin = async (queueOffline = false) => {
    setFeedback(null);
    const workerAttendances = Object.entries(attendance).map(([workerId, status]) => ({
      workerId,
      status,
    }));
    const activitiesPayload = siteActivities.slice(0, 1).map((a) => ({
      planActivityId: a.id,
      title: a.name,
      completedQty: slot === 'evening' ? completedQty : 0,
      unit: a.unit,
      completedPct: a.progressPct,
    }));

    if (queueOffline) {
      await enqueueOfflineCheckin({
        offlineSubmissionId: `off-${Date.now()}`,
        queuedAt: new Date().toISOString(),
        siteId: activeSite.id,
        reportDate: today,
        slot,
        userId: currentUser.id,
        lat: gps.lat,
        lng: gps.lng,
        accuracyM: gps.accuracyM,
        photos: photos.map((p) => ({ dataUrl: p.dataUrl, caption: p.caption, capturedAt: p.capturedAt })),
        workerAttendances,
        subcontractorCounts: [{ trade: subconTrade, headcount: subconCount }],
        activities: activitiesPayload,
        materialsUsed: slot === 'evening' && usedQty > 0 ? [{ itemId: usedItemId, qtyUsed: usedQty }] : [],
        issues: issueText.trim() ? [{ category: 'other', description: issueText.trim(), isUrgent }] : [],
        tomorrowPlan,
      });
      setFeedback({
        type: 'ok',
        msg: 'Saved to IndexedDB offline queue! Will auto-sync when network reconnects.',
      });
      return;
    }

    try {
      mutateState((draft) => {
        submitSiteCheckin(draft, {
          actorUserId: currentUser.id,
          siteId: activeSite.id,
          reportDate: today,
          slot,
          lat: gps.lat,
          lng: gps.lng,
          accuracyM: gps.accuracyM,
          photos,
          ownWorkerAttendances: slot === 'morning' ? workerAttendances : undefined,
          subcontractorCounts: slot === 'morning' ? [{ trade: subconTrade, headcount: subconCount }] : undefined,
          activities: activitiesPayload,
          materialsUsed: slot === 'evening' && usedQty > 0 ? [{ itemId: usedItemId, qtyUsed: usedQty }] : undefined,
          issues: slot === 'evening' && issueText.trim() ? [{ category: 'other', description: issueText.trim(), isUrgent }] : undefined,
          tomorrowPlan: slot === 'evening' ? tomorrowPlan : undefined,
        });
      });
      setPhotos([]);
      setIssueText('');
      setFeedback({
        type: 'ok',
        msg: `${slot.toUpperCase()} GPS check-in verified & recorded (${geoEval.distanceMeters}m from pin)!`,
      });
    } catch (err) {
      setFeedback({ type: 'err', msg: (err as Error).message });
    }
  };

  const siteReports = state.dailyReports
    .filter((r) => r.siteId === activeSite.id)
    .slice(0, 14);
  const modalReport = state.dailyReports.find((r) => r.id === selectedReportId) ?? null;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-heading text-2xl font-bold text-asty-black">{t('dpr.title')}</h1>
          <p className="text-xs text-slate-500 mt-0.5">
            3 Mandatory GPS Check-Ins • Live Stamped Camera Only • IndexedDB Offline Queue
          </p>
        </div>

        <div className="flex gap-2">
          {can('dpr.create') && (
            <button
              type="button"
              onClick={() => setMode('supervisor_pwa')}
              className={`rounded-xl px-4 py-2 text-xs font-semibold ${
                mode === 'supervisor_pwa' ? 'bg-asty-charcoal text-white' : 'bg-white border border-asty-border'
              }`}
            >
              Supervisor Check-In PWA
            </button>
          )}
          <button
            type="button"
            onClick={() => setMode('office_dpr')}
            className={`rounded-xl px-4 py-2 text-xs font-semibold ${
              mode === 'office_dpr' ? 'bg-asty-charcoal text-white' : 'bg-white border border-asty-border'
            }`}
          >
            Office DPR Archive & PDF
          </button>
        </div>
      </div>

      {/* Site Selector */}
      <div className="rounded-2xl border border-asty-border bg-white p-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <MapPin className="h-5 w-5 text-asty-charcoal" />
          <div>
            <div className="text-xs text-slate-500">{t('dpr.select_site')}</div>
            <select
              value={activeSite.id}
              onChange={(e) => {
                const next = visibleSites.find((s) => s.id === e.target.value);
                setSiteId(e.target.value);
                if (next) setGps({ lat: next.lat, lng: next.lng, accuracyM: 10.2 });
              }}
              className="mt-0.5 font-heading text-base font-bold text-asty-black bg-transparent focus:outline-none"
            >
              {visibleSites.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name} ({s.code} • Radius {s.geofenceRadiusM}m)
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="flex flex-wrap gap-2 text-xs">
          <button
            type="button"
            onClick={requestHardwareGps}
            className="inline-flex items-center gap-1 rounded-lg border border-asty-border px-3 py-1.5 font-semibold hover:bg-asty-surface"
          >
            <Navigation className="h-3.5 w-3.5" /> {t('dpr.verify_gps')}
          </button>
          <button
            type="button"
            onClick={() => setGps({ lat: activeSite.lat + 0.00015, lng: activeSite.lng + 0.0001, accuracyM: 9.8 })}
            className="rounded-lg bg-emerald-50 px-3 py-1.5 font-semibold text-emerald-800 hover:bg-emerald-100"
          >
            {t('dpr.simulate_at_site')}
          </button>
          <button
            type="button"
            onClick={() => setGps({ lat: activeSite.lat + 0.008, lng: activeSite.lng + 0.008, accuracyM: 14.0 })}
            className="rounded-lg bg-red-50 px-3 py-1.5 font-semibold text-red-700 hover:bg-red-100"
          >
            {t('dpr.simulate_outside')}
          </button>
        </div>
      </div>

      {mode === 'supervisor_pwa' ? (
        <div className="space-y-5">
          {/* Geofence Live Status Banner */}
          <div
            className={`rounded-2xl border p-4 flex items-center justify-between gap-3 ${
              geoEval.allowed
                ? 'border-emerald-200 bg-emerald-50 text-emerald-900'
                : 'border-red-300 bg-red-50 text-red-900'
            }`}
          >
            <div className="flex items-center gap-2.5 text-sm font-semibold">
              {geoEval.allowed ? (
                <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0" />
              ) : (
                <ShieldAlert className="h-5 w-5 text-red-600 shrink-0" />
              )}
              <span>
                {geoEval.allowed
                  ? `Inside Site Geofence (${geoEval.distanceMeters}m from center • Allowed ≤ ${activeSite.geofenceRadiusM}m)`
                  : `${t('dpr.error_outside_radius')} (${geoEval.distanceMeters}m > ${activeSite.geofenceRadiusM}m)`}
              </span>
            </div>
            {geoEval.isLowAccuracy && (
              <span className="rounded bg-amber-200 px-2 py-0.5 text-xs font-bold text-amber-900">
                Low Accuracy ({gps.accuracyM}m)
              </span>
            )}
          </div>

          {/* Large Touch-Friendly Slot Buttons */}
          <div className="grid grid-cols-3 gap-2.5">
            {(['morning', 'afternoon', 'evening'] as const).map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setSlot(s)}
                className={`min-h-14 rounded-2xl border px-3 py-3 text-center font-bold text-xs sm:text-sm transition ${
                  slot === s
                    ? 'border-asty-charcoal bg-asty-charcoal text-white shadow'
                    : 'border-asty-border bg-white text-asty-black'
                }`}
              >
                <div>{t(`dpr.${s}`)}</div>
                <div className="text-[10px] opacity-75 font-normal mt-0.5">
                  {s === 'morning'
                    ? `${activeSite.morningStart}–${activeSite.morningEnd}`
                    : s === 'afternoon'
                      ? `${activeSite.afternoonStart}–${activeSite.afternoonEnd}`
                      : `${activeSite.eveningStart}–${activeSite.eveningEnd}`}
                </div>
              </button>
            ))}
          </div>

          {/* Live Stamped Camera */}
          <LiveStampedCamera
            siteName={activeSite.name}
            slotLabel={slot}
            lat={gps.lat}
            lng={gps.lng}
            accuracyM={gps.accuracyM}
            onCapture={(ph) =>
              setPhotos((prev) => [
                ...prev,
                {
                  id: `ph-live-${Date.now()}`,
                  slot,
                  dataUrl: ph.dataUrl,
                  caption: ph.caption,
                  capturedAt: ph.capturedAt,
                  lat: gps.lat,
                  lng: gps.lng,
                  accuracyM: gps.accuracyM,
                },
              ])
            }
          />

          {(slot === 'afternoon' || slot === 'evening') && (
            <p className="text-xs font-semibold text-amber-800">
              * {t('dpr.min_3_photos')} — Captured: {photos.length} / 3
            </p>
          )}

          {photos.length > 0 && (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {photos.map((p) => (
                <div key={p.id} className="rounded-xl overflow-hidden border border-asty-border bg-white">
                  <img src={p.dataUrl} alt={p.caption} className="h-28 w-full object-cover" />
                  <div className="p-2 text-[11px] font-medium truncate">{p.caption}</div>
                </div>
              ))}
            </div>
          )}

          {/* Morning Specific Inputs */}
          {slot === 'morning' && (
            <div className="rounded-2xl border border-asty-border bg-white p-5 space-y-4">
              <h3 className="font-heading text-sm font-bold">{t('dpr.own_attendance')}</h3>
              <div className="space-y-2">
                {state.workers.slice(0, 4).map((w) => {
                  const cur = attendance[w.id] ?? 'present';
                  return (
                    <div
                      key={w.id}
                      className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-asty-surface p-3 text-xs"
                    >
                      <div>
                        <div className="font-bold text-asty-black">{w.fullName}</div>
                        <div className="text-slate-500">{w.crewName}</div>
                      </div>
                      <div className="flex gap-1.5">
                        {(['present', 'half_day', 'absent'] as const).map((st) => (
                          <button
                            key={st}
                            type="button"
                            onClick={() => setAttendance((a) => ({ ...a, [w.id]: st }))}
                            className={`min-h-10 rounded-lg px-3 py-1.5 font-semibold ${
                              cur === st
                                ? 'bg-asty-charcoal text-white'
                                : 'bg-white border border-asty-border text-slate-600'
                            }`}
                          >
                            {t(`dpr.${st}`)}
                          </button>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 text-xs">
                <div>
                  <label className="font-semibold block mb-1">{t('dpr.subcon_headcount')}</label>
                  <input
                    value={subconTrade}
                    onChange={(e) => setSubconTrade(e.target.value)}
                    className="w-full rounded-lg border border-asty-border px-3 py-2.5"
                  />
                </div>
                <div>
                  <label className="font-semibold block mb-1">Workers Count</label>
                  <input
                    type="number"
                    min={0}
                    value={subconCount}
                    onChange={(e) => setSubconCount(Number(e.target.value))}
                    className="w-full rounded-lg border border-asty-border px-3 py-2.5"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Evening Specific Inputs */}
          {slot === 'evening' && (
            <div className="rounded-2xl border border-asty-border bg-white p-5 space-y-4 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="font-semibold block mb-1">{t('dpr.qty_completed')}</label>
                  <input
                    type="number"
                    min={0}
                    step="0.5"
                    value={completedQty}
                    onChange={(e) => setCompletedQty(Number(e.target.value))}
                    className="w-full rounded-lg border border-asty-border px-3 py-2.5"
                  />
                </div>
                <div>
                  <label className="font-semibold block mb-1">{t('dpr.materials_used')}</label>
                  <select
                    value={usedItemId}
                    onChange={(e) => setUsedItemId(e.target.value)}
                    className="w-full rounded-lg border border-asty-border px-3 py-2.5"
                  >
                    {state.items.map((it) => (
                      <option key={it.id} value={it.id}>
                        {it.name} ({it.unit})
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="font-semibold block mb-1">Quantity Used</label>
                  <input
                    type="number"
                    min={0}
                    value={usedQty}
                    onChange={(e) => setUsedQty(Number(e.target.value))}
                    className="w-full rounded-lg border border-asty-border px-3 py-2.5"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="font-semibold block">{t('dpr.problems_holdups')}</label>
                <input
                  value={issueText}
                  onChange={(e) => setIssueText(e.target.value)}
                  placeholder="Any delay, missing drawing, material shortage or equipment issue..."
                  className="w-full rounded-lg border border-asty-border px-3 py-2.5"
                />
                <label className="inline-flex items-center gap-2 font-bold text-red-700 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={isUrgent}
                    onChange={(e) => setIsUrgent(e.target.checked)}
                    className="h-4 w-4"
                  />
                  <AlertTriangle className="h-4 w-4" />
                  {t('dpr.urgent_flag')}
                </label>
              </div>

              <div>
                <label className="font-semibold block mb-1">{t('dpr.tomorrows_plan')} *</label>
                <textarea
                  rows={2}
                  value={tomorrowPlan}
                  onChange={(e) => setTomorrowPlan(e.target.value)}
                  placeholder="Tomorrow's crew deployment, shuttering/concrete targets, and material unloading..."
                  className="w-full rounded-lg border border-asty-border px-3 py-2.5"
                />
              </div>
            </div>
          )}

          {feedback && (
            <div
              className={`rounded-xl p-3.5 text-xs font-semibold ${
                feedback.type === 'ok' ? 'bg-emerald-100 text-emerald-900' : 'bg-red-100 text-red-900'
              }`}
            >
              {feedback.msg}
            </div>
          )}

          <div className="flex flex-col sm:flex-row gap-3">
            <button
              type="button"
              disabled={!geoEval.allowed}
              onClick={() => handleSubmitCheckin(false)}
              className="flex-1 min-h-14 rounded-2xl bg-asty-charcoal px-6 py-3.5 text-sm font-bold text-white hover:bg-asty-black disabled:opacity-40"
            >
              {slot === 'morning'
                ? t('dpr.submit_morning')
                : slot === 'afternoon'
                  ? t('dpr.submit_afternoon')
                  : t('dpr.submit_evening')}
            </button>
            <button
              type="button"
              onClick={() => handleSubmitCheckin(true)}
              className="inline-flex min-h-14 items-center justify-center gap-2 rounded-2xl border border-asty-border bg-white px-5 py-3.5 text-xs font-bold text-asty-charcoal hover:bg-slate-50"
            >
              <CloudOff className="h-4 w-4" />
              Queue Offline (IndexedDB)
            </button>
          </div>
        </div>
      ) : (
        /* Office DPR Archive & Printable PDF View */
        <div className="rounded-2xl border border-asty-border bg-white overflow-hidden">
          <table className="w-full text-left text-xs">
            <thead className="bg-asty-surface uppercase text-slate-600">
              <tr>
                <th className="px-4 py-3">Date</th>
                <th className="px-4 py-3">Day Status</th>
                <th className="px-4 py-3">Check-Ins (M / A / E)</th>
                <th className="px-4 py-3">Activities & Output</th>
                <th className="px-4 py-3">Tomorrow&apos;s Plan</th>
                <th className="px-4 py-3 text-right">PDF</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {siteReports.map((rep) => (
                <tr key={rep.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3 font-bold">{formatDDMMYYYY(rep.reportDate)}</td>
                  <td className="px-4 py-3">
                    <span
                      className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase ${
                        rep.status === 'closed'
                          ? 'bg-emerald-100 text-emerald-800'
                          : 'bg-amber-100 text-amber-800'
                      }`}
                    >
                      {rep.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 font-mono">
                    {rep.checkins.morning ? '✓M ' : '— '}
                    {rep.checkins.afternoon ? '✓A ' : '— '}
                    {rep.checkins.evening ? '✓E' : '—'}
                  </td>
                  <td className="px-4 py-3">
                    {rep.activities.map((a) => `${a.title}: ${a.completedQty} ${a.unit}`).join('; ') || '—'}
                  </td>
                  <td className="px-4 py-3 max-w-xs truncate">{rep.tomorrowPlan || '—'}</td>
                  <td className="px-4 py-3 text-right">
                    <button
                      type="button"
                      onClick={() => setSelectedReportId(rep.id)}
                      className="inline-flex items-center gap-1 rounded-lg bg-asty-charcoal px-3 py-1.5 text-white font-semibold"
                    >
                      <FileText className="h-3.5 w-3.5" /> Printable DPR
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {modalReport && (
        <AstyLetterheadModal
          open={Boolean(modalReport)}
          onClose={() => setSelectedReportId(null)}
          documentType="DAILY PROGRESS REPORT (DPR)"
          documentNo={modalReport.id.toUpperCase()}
          dateFormatted={formatDDMMYYYY(modalReport.reportDate)}
          siteName={activeSite.name}
        >
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-3 text-xs">
              {(['morning', 'afternoon', 'evening'] as const).map((sl) => {
                const ck = modalReport.checkins[sl];
                return (
                  <div key={sl} className="rounded-lg border border-asty-border p-3">
                    <div className="font-bold uppercase">{sl} Check-In</div>
                    {ck ? (
                      <>
                        <div className="text-slate-600 mt-1">
                          Distance: {ck.distanceFromSiteM}m (±{ck.accuracyM}m)
                        </div>
                        <div className="text-slate-600">Photos: {ck.photos.length}</div>
                      </>
                    ) : (
                      <div className="text-amber-700 mt-1">Not submitted</div>
                    )}
                  </div>
                );
              })}
            </div>
            <div>
              <strong>Completed Activities:</strong>{' '}
              {modalReport.activities.map((a) => `${a.title} (${a.completedQty} ${a.unit})`).join(', ')}
            </div>
            <div>
              <strong>Tomorrow&apos;s Plan:</strong> {modalReport.tomorrowPlan || '—'}
            </div>
            <div className="grid grid-cols-3 gap-3">
              {Object.values(modalReport.checkins)
                .flatMap((c) => c?.photos ?? [])
                .slice(0, 6)
                .map((p) => (
                  <img key={p.id} src={p.dataUrl} alt={p.caption} className="rounded-lg border h-32 w-full object-cover" />
                ))}
            </div>
          </div>
        </AstyLetterheadModal>
      )}
    </div>
  );
}

