import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { UserProfile } from '@/lib/database.types';
import { canAccessSite, getVisibleSites, hasPermission, submitSiteCheckin } from '@/lib/erpEngine';
import { listOfflineCheckins, removeOfflineCheckin } from '@/lib/offlineQueue';
import { createInitialErpState, type ErpDatabaseState } from '@/lib/seedData';

const STORAGE_KEY = 'asty_erp_state_v1';
const USER_KEY = 'asty_erp_active_user_v1';

interface ErpContextValue {
  state: ErpDatabaseState;
  currentUser: UserProfile | null;
  isOnline: boolean;
  offlineQueueCount: number;
  loginAsUser: (userId: string) => void;
  logout: () => void;
  mutateState: (recipe: (draft: ErpDatabaseState) => void) => void;
  resetDemoData: () => void;
  can: (permCode: string) => boolean;
  canSite: (siteId: string) => boolean;
  visibleSites: ReturnType<typeof getVisibleSites>;
  syncOfflineQueueNow: () => Promise<number>;
}

const ErpContext = createContext<ErpContextValue | null>(null);

export function ErpProvider({ children }: { children: React.ReactNode }) {
  const { i18n } = useTranslation();

  const [state, setState] = useState<ErpDatabaseState>(() => {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (raw) {
        return JSON.parse(raw) as ErpDatabaseState;
      }
    } catch {
      // ignore corrupt storage
    }
    return createInitialErpState();
  });

  const [currentUserId, setCurrentUserId] = useState<string | null>(() => {
    return window.localStorage.getItem(USER_KEY) || 'usr-mgmt-1';
  });

  const [isOnline, setIsOnline] = useState<boolean>(() =>
    typeof navigator !== 'undefined' ? navigator.onLine : true,
  );
  const [offlineQueueCount, setOfflineQueueCount] = useState(0);

  useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      // quota safeguard
    }
  }, [state]);

  const refreshQueueCount = async () => {
    const items = await listOfflineCheckins();
    setOfflineQueueCount(items.length);
  };

  useEffect(() => {
    refreshQueueCount();
    const onOnline = () => setIsOnline(true);
    const onOffline = () => setIsOnline(false);
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);
    return () => {
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
    };
  }, []);

  const currentUser = useMemo(
    () => state.users.find((u) => u.id === currentUserId && u.isActive) ?? null,
    [state.users, currentUserId],
  );

  const loginAsUser = (userId: string) => {
    const user = state.users.find((u) => u.id === userId && u.isActive);
    if (!user) return;
    setCurrentUserId(user.id);
    window.localStorage.setItem(USER_KEY, user.id);
    i18n.changeLanguage(user.preferredLanguage);
    window.localStorage.setItem('asty_lang', user.preferredLanguage);
  };

  const logout = () => {
    setCurrentUserId(null);
    window.localStorage.removeItem(USER_KEY);
  };

  const mutateState = (recipe: (draft: ErpDatabaseState) => void) => {
    setState((prev) => {
      const next: ErpDatabaseState = structuredClone(prev);
      recipe(next);
      return next;
    });
  };

  const resetDemoData = () => {
    const fresh = createInitialErpState();
    setState(fresh);
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(fresh));
  };

  const syncOfflineQueueNow = async (): Promise<number> => {
    const items = await listOfflineCheckins();
    if (items.length === 0) return 0;
    let synced = 0;
    mutateState((draft) => {
      for (const item of items) {
        try {
          submitSiteCheckin(draft, {
            actorUserId: item.userId,
            siteId: item.siteId,
            reportDate: item.reportDate,
            slot: item.slot,
            lat: item.lat,
            lng: item.lng,
            accuracyM: item.accuracyM,
            photos: item.photos.map((p, i) => ({
              id: `ph-sync-${Date.now()}-${i}`,
              slot: item.slot,
              dataUrl: p.dataUrl,
              caption: p.caption,
              capturedAt: p.capturedAt,
              lat: item.lat,
              lng: item.lng,
              accuracyM: item.accuracyM,
            })),
            ownWorkerAttendances: item.workerAttendances,
            subcontractorCounts: item.subcontractorCounts,
            activities: item.activities,
            materialsUsed: item.materialsUsed,
            issues: item.issues,
            tomorrowPlan: item.tomorrowPlan,
          });
          synced += 1;
        } catch {
          // keep invalid or failed item in log
        }
      }
    });
    for (const item of items) {
      await removeOfflineCheckin(item.offlineSubmissionId);
    }
    await refreshQueueCount();
    return synced;
  };

  useEffect(() => {
    if (isOnline && offlineQueueCount > 0) {
      syncOfflineQueueNow();
    }
  }, [isOnline]);

  const value: ErpContextValue = {
    state,
    currentUser,
    isOnline,
    offlineQueueCount,
    loginAsUser,
    logout,
    mutateState,
    resetDemoData,
    can: (permCode: string) => (currentUser ? hasPermission(state, currentUser.id, permCode) : false),
    canSite: (siteId: string) => (currentUser ? canAccessSite(state, currentUser.id, siteId) : false),
    visibleSites: currentUser ? getVisibleSites(state, currentUser.id) : [],
    syncOfflineQueueNow,
  };

  return <ErpContext.Provider value={value}>{children}</ErpContext.Provider>;
}

export function useErp() {
  const ctx = useContext(ErpContext);
  if (!ctx) throw new Error('useErp must be used inside ErpProvider');
  return ctx;
}

