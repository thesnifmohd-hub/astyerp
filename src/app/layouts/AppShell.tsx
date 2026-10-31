import React, { useState } from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  BarChart3,
  Bell,
  Building2,
  Calculator,
  CalendarRange,
  Camera,
  CheckSquare,
  FileSpreadsheet,
  HardHat,
  LayoutDashboard,
  LogOut,
  Package,
  ReceiptIndianRupee,
  Settings,
  Shield,
  Wifi,
  WifiOff,
} from 'lucide-react';
import { useErp } from '@/app/ErpContext';
import { getFinancialYear, todayISOInIST } from '@/lib/dates';
import { isSupabaseConfigured } from '@/lib/supabase';

export function AppShell() {
  const { t, i18n } = useTranslation();
  const {
    state,
    currentUser,
    isOnline,
    offlineQueueCount,
    cloudSyncStatus,
    loginAsUser,
    logout,
    can,
    mutateState,
    syncOfflineQueueNow,
  } = useErp();
  const [bellOpen, setBellOpen] = useState(false);

  if (!currentUser) return null;

  const userPositions = currentUser.positionIds
    .map((pid) => state.positions.find((p) => p.id === pid))
    .filter(Boolean);
  const isFieldOnly =
    userPositions.length > 0 && userPositions.every((p) => p?.loginType === 'field');

  const navItems = [
    { to: '/', label: t('nav.dashboard'), icon: LayoutDashboard, show: !userPositions.every((p) => p?.loginType === 'external') },
    { to: '/sites', label: t('nav.sites'), icon: Building2, show: can('site.view') && !can('client_portal.view') },
    { to: '/dpr', label: t('nav.dpr'), icon: Camera, show: can('dpr.view') || can('dpr.create') },
    { to: '/approvals', label: t('nav.approvals'), icon: CheckSquare, show: can('approval.view') },
    { to: '/materials', label: t('nav.materials'), icon: Package, show: can('material.view') },
    { to: '/boq', label: t('nav.boq'), icon: Calculator, show: can('boq.view') },
    { to: '/planning', label: t('nav.planning'), icon: CalendarRange, show: can('plan.view') },
    { to: '/labour', label: t('nav.labour'), icon: HardHat, show: can('labour.view') || can('subcon.view') },
    { to: '/accounting', label: t('nav.accounting'), icon: FileSpreadsheet, show: can('voucher.view') },
    { to: '/billing', label: t('nav.billing'), icon: ReceiptIndianRupee, show: can('client_bill.view') },
    { to: '/reports', label: t('nav.reports'), icon: BarChart3, show: can('report.operations.view') || can('report.accounts.view') || can('report.profit.view') },
    { to: '/portal', label: t('nav.portal'), icon: Shield, show: can('client_portal.view') },
    { to: '/admin', label: t('nav.admin'), icon: Settings, show: can('admin.users.view') || can('admin.positions.view') || can('admin.approvals.edit') },
  ].filter((item) => item.show);

  const myNotifications = state.notifications.filter((n) =>
    n.targetPositionIds.some((pid) => currentUser.positionIds.includes(pid)),
  );
  const unreadCount = myNotifications.filter((n) => !n.readByUserIds.includes(currentUser.id)).length;

  const pendingMyApprovals = state.approvalRequests.filter(
    (r) => r.status === 'pending' && currentUser.positionIds.includes(r.currentPositionId),
  ).length;

  const toggleLanguage = () => {
    const next = i18n.language === 'en' ? 'ml' : 'en';
    i18n.changeLanguage(next);
    window.localStorage.setItem('asty_lang', next);
  };

  return (
    <div className="min-h-screen flex flex-col md:flex-row bg-asty-surface">
      {/* Desktop Charcoal Sidebar */}
      <aside className="no-print hidden md:flex md:w-64 lg:w-68 shrink-0 flex-col bg-asty-charcoal text-white">
        <div className="p-5 border-b border-white/10 flex items-center gap-3">
          <div className="h-9 w-9 rounded-lg bg-white text-asty-charcoal font-bold flex items-center justify-center text-lg">
            A
          </div>
          <div className="min-w-0">
            <div className="font-heading font-bold text-sm truncate">{t('app.brand')}</div>
            <div className="text-[11px] text-asty-slate">
              {t('app.fy')} {getFinancialYear(todayISOInIST())} • IST
            </div>
          </div>
        </div>

        <nav className="flex-1 overflow-y-auto p-3 space-y-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.to === '/'}
                className={({ isActive }) =>
                  `flex items-center justify-between rounded-xl px-3.5 py-2.5 text-sm font-medium transition ${
                    isActive
                      ? 'bg-white text-asty-charcoal font-semibold shadow-sm'
                      : 'text-white/80 hover:bg-white/10 hover:text-white'
                  }`
                }
              >
                <span className="flex items-center gap-2.5 truncate">
                  <Icon className="h-4 w-4 shrink-0" />
                  <span className="truncate">{item.label}</span>
                </span>
                {item.to === '/approvals' && pendingMyApprovals > 0 && (
                  <span className="rounded-full bg-amber-500 px-2 py-0.5 text-[11px] font-bold text-black">
                    {pendingMyApprovals}
                  </span>
                )}
              </NavLink>
            );
          })}
        </nav>

        <div className="p-4 border-t border-white/10 space-y-2 text-xs">
          <div className="font-semibold text-white truncate">{currentUser.fullName}</div>
          <div className="text-asty-slate truncate">
            {userPositions.map((p) => p?.name).join(', ')}
          </div>
          <button
            type="button"
            onClick={logout}
            className="mt-1 inline-flex w-full items-center justify-center gap-1.5 rounded-lg border border-white/15 py-2 text-xs font-medium text-white/90 hover:bg-white/10"
          >
            <LogOut className="h-3.5 w-3.5" />
            {t('nav.logout')}
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 pb-20 md:pb-0">
        {/* Top Command Header */}
        <header className="no-print sticky top-0 z-30 border-b border-asty-border bg-white/95 backdrop-blur px-4 sm:px-6 py-3 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="md:hidden h-8 w-8 rounded-lg bg-asty-charcoal text-white font-bold flex items-center justify-center">
              A
            </div>
            <div>
              <div className="text-xs font-semibold text-asty-charcoal flex items-center gap-2">
                <span>{userPositions.map((p) => p?.name).join(' + ')}</span>
                <span className="hidden sm:inline text-slate-300">|</span>
                <span
                  className={`hidden sm:inline rounded-full px-2 py-0.5 text-[11px] font-medium ${
                    isSupabaseConfigured
                      ? cloudSyncStatus === 'synced'
                        ? 'bg-emerald-50 text-emerald-700'
                        : cloudSyncStatus === 'error'
                          ? 'bg-red-50 text-red-700'
                          : 'bg-sky-50 text-sky-700'
                      : 'text-slate-500'
                  }`}
                >
                  {isSupabaseConfigured
                    ? cloudSyncStatus === 'synced'
                      ? 'Supabase Cloud Synced'
                      : cloudSyncStatus === 'syncing'
                        ? 'Syncing to Supabase…'
                        : cloudSyncStatus === 'connecting'
                          ? 'Connecting to Supabase…'
                          : 'Cloud Sync Retry'
                    : t('app.demo_mode')}
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Quick Role Switcher for Testing */}
            <select
              aria-label="Switch Active User Position"
              value={currentUser.id}
              onChange={(e) => loginAsUser(e.target.value)}
              className="rounded-lg border border-asty-border bg-asty-surface px-2.5 py-1.5 text-xs font-medium text-asty-charcoal focus:outline-none"
            >
              {state.users
                .filter((u) => u.isActive)
                .map((u) => {
                  const pLabel = u.positionIds
                    .map((pid) => state.positions.find((p) => p.id === pid)?.name)
                    .filter(Boolean)
                    .join('/');
                  return (
                    <option key={u.id} value={u.id}>
                      {u.fullName} ({pLabel})
                    </option>
                  );
                })}
            </select>

            {/* Offline Queue Sync Status */}
            <span
              className={`inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-semibold ${
                isOnline ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-100 text-amber-800'
              }`}
            >
              {isOnline ? <Wifi className="h-3.5 w-3.5" /> : <WifiOff className="h-3.5 w-3.5" />}
              <span className="hidden sm:inline">{isOnline ? t('app.online') : t('app.offline')}</span>
            </span>

            {offlineQueueCount > 0 && (
              <button
                type="button"
                onClick={() => syncOfflineQueueNow()}
                className="rounded-lg bg-amber-500 px-2.5 py-1.5 text-xs font-bold text-black hover:bg-amber-400"
              >
                {t('app.sync_now', { count: offlineQueueCount })}
              </button>
            )}

            {/* EN / Malayalam Toggle */}
            <button
              type="button"
              onClick={toggleLanguage}
              className="rounded-lg border border-asty-border px-2.5 py-1.5 text-xs font-bold text-asty-charcoal hover:bg-asty-surface"
            >
              {i18n.language === 'en' ? 'മലയാളം' : 'EN'}
            </button>

            {/* Position-Addressed Notifications Bell */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setBellOpen((o) => !o)}
                className="relative rounded-lg border border-asty-border p-2 text-asty-charcoal hover:bg-asty-surface"
              >
                <Bell className="h-4 w-4" />
                {unreadCount > 0 && (
                  <span className="absolute -top-1 -right-1 h-4 min-w-4 rounded-full bg-red-600 px-1 text-[10px] font-bold text-white flex items-center justify-center">
                    {unreadCount}
                  </span>
                )}
              </button>

              {bellOpen && (
                <div className="absolute right-0 mt-2 w-80 sm:w-96 rounded-xl border border-asty-border bg-white shadow-xl z-50 overflow-hidden">
                  <div className="flex items-center justify-between border-b border-asty-border bg-asty-surface px-4 py-2.5">
                    <span className="text-xs font-bold text-asty-charcoal">
                      Position Alerts ({myNotifications.length})
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        mutateState((draft) => {
                          draft.notifications.forEach((n) => {
                            if (!n.readByUserIds.includes(currentUser.id)) {
                              n.readByUserIds.push(currentUser.id);
                            }
                          });
                        });
                      }}
                      className="text-[11px] font-semibold text-asty-charcoal underline"
                    >
                      Mark all read
                    </button>
                  </div>
                  <div className="max-h-80 overflow-y-auto divide-y divide-slate-100">
                    {myNotifications.length === 0 ? (
                      <div className="p-4 text-xs text-slate-500 text-center">No notifications for your position</div>
                    ) : (
                      myNotifications.map((n) => (
                        <div key={n.id} className="p-3.5 text-xs space-y-1">
                          <div className="flex items-center justify-between gap-2">
                            <span
                              className={`rounded px-1.5 py-0.5 text-[10px] font-bold uppercase ${
                                n.priority === 'urgent'
                                  ? 'bg-red-100 text-red-700'
                                  : n.priority === 'high'
                                    ? 'bg-amber-100 text-amber-800'
                                    : 'bg-slate-100 text-slate-600'
                              }`}
                            >
                              {n.priority}
                            </span>
                          </div>
                          <div className="font-semibold text-asty-black">{n.title}</div>
                          <div className="text-slate-600">{n.body}</div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </header>

        <main className={`flex-1 p-4 sm:p-6 ${isFieldOnly ? 'max-w-2xl mx-auto w-full' : ''}`}>
          <Outlet />
        </main>
      </div>

      {/* Mobile Bottom Tab Bar for Supervisors & Mobile Viewports */}
      <nav className="no-print md:hidden fixed bottom-0 inset-x-0 z-40 border-t border-asty-border bg-white grid grid-cols-5 px-1 py-1 shadow-lg">
        {navItems.slice(0, 5).map((item) => {
          const Icon = item.icon;
          return (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === '/'}
              className={({ isActive }) =>
                `flex flex-col items-center justify-center min-h-14 rounded-lg px-1 text-[11px] font-semibold ${
                  isActive ? 'text-asty-charcoal bg-asty-surface' : 'text-slate-500'
                }`
              }
            >
              <Icon className="h-5 w-5 mb-0.5" />
              <span className="truncate max-w-full">{item.label.split(' ')[0]}</span>
            </NavLink>
          );
        })}
      </nav>
    </div>
  );
}

