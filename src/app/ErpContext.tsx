import React, { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { UserProfile } from '@/lib/database.types';
import { canAccessSite, getVisibleSites, hasPermission, submitSiteCheckin } from '@/lib/erpEngine';
import { listOfflineCheckins, removeOfflineCheckin } from '@/lib/offlineQueue';
import { createCleanErpState, type ErpDatabaseState } from '@/lib/seedData';
import { isSupabaseConfigured, supabase } from '@/lib/supabase';

const STORAGE_KEY = 'asty_erp_state_clean_v2';
const LEGACY_STORAGE_KEY = 'asty_erp_state_v1';
const USER_KEY = 'asty_erp_active_user_v1';
const WORKSPACE_KEY = 'asty-main';
export const DEMO_SUPABASE_AUTH_PASSWORD = 'AstyDemo#2026!';

export type CloudSyncStatus = 'local' | 'connecting' | 'synced' | 'syncing' | 'error';

interface ErpContextValue {
  state: ErpDatabaseState;
  currentUser: UserProfile | null;
  isOnline: boolean;
  offlineQueueCount: number;
  cloudSyncStatus: CloudSyncStatus;
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
      window.localStorage.removeItem(LEGACY_STORAGE_KEY);
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (raw) {
        return JSON.parse(raw) as ErpDatabaseState;
      }
    } catch {
      // ignore corrupt storage
    }
    return createCleanErpState();
  });

  const [currentUserId, setCurrentUserId] = useState<string | null>(() => {
    return window.localStorage.getItem(USER_KEY) || 'usr-mgmt-1';
  });

  const [isOnline, setIsOnline] = useState<boolean>(() =>
    typeof navigator !== 'undefined' ? navigator.onLine : true,
  );
  const [offlineQueueCount, setOfflineQueueCount] = useState(0);
  const [cloudSyncStatus, setCloudSyncStatus] = useState<CloudSyncStatus>(() =>
    isSupabaseConfigured ? 'connecting' : 'local',
  );

  const cloudVersionRef = useRef<number>(0);
  const applyingRemoteRef = useRef<boolean>(false);
  const saveTimerRef = useRef<number | null>(null);

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

  const ensureSupabaseSession = async (targetEmail?: string) => {
    if (!isSupabaseConfigured || !supabase) return false;
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const activeEmail = sessionData.session?.user?.email?.toLowerCase();
      const desiredEmail = (targetEmail || 'director1@asty.demo').toLowerCase();

      if (sessionData.session && (!desiredEmail.endsWith('@asty.demo') || activeEmail === desiredEmail)) {
        return true;
      }

      if (desiredEmail.endsWith('@asty.demo')) {
        const { error } = await supabase.auth.signInWithPassword({
          email: desiredEmail,
          password: DEMO_SUPABASE_AUTH_PASSWORD,
        });
        if (!error) return true;
      }

      if (sessionData.session) return true;

      const fallback = await supabase.auth.signInWithPassword({
        email: 'director1@asty.demo',
        password: DEMO_SUPABASE_AUTH_PASSWORD,
      });
      return !fallback.error;
    } catch {
      return false;
    }
  };

  const pushStateToCloud = async (nextState: ErpDatabaseState, actorLabel?: string) => {
    if (!isSupabaseConfigured || !supabase || !navigator.onLine) return;
    setCloudSyncStatus('syncing');
    try {
      const ok = await ensureSupabaseSession(currentUser?.email);
      if (!ok) {
        setCloudSyncStatus('error');
        return;
      }
      const { data: sessionData } = await supabase.auth.getSession();
      const nextVersion = cloudVersionRef.current + 1;
      cloudVersionRef.current = nextVersion;

      const { error } = await supabase.from('erp_workspace_sync').upsert(
        {
          workspace_key: WORKSPACE_KEY,
          payload: nextState,
          version: nextVersion,
          updated_by: sessionData.session?.user?.id ?? null,
          updated_by_label: actorLabel ?? currentUser?.fullName ?? 'System',
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'workspace_key' },
      );
      setCloudSyncStatus(error ? 'error' : 'synced');
    } catch {
      setCloudSyncStatus('error');
    }
  };

  // Initial load + Realtime subscription against live Supabase Postgres
  useEffect(() => {
    const sb = supabase;
    if (!isSupabaseConfigured || !sb) return;
    let cancelled = false;

    (async () => {
      setCloudSyncStatus('connecting');
      const ok = await ensureSupabaseSession(currentUser?.email);
      if (!ok || cancelled) {
        if (!cancelled) setCloudSyncStatus('error');
        return;
      }

      const { data, error } = await sb
        .from('erp_workspace_sync')
        .select('payload, version')
        .eq('workspace_key', WORKSPACE_KEY)
        .maybeSingle();

      if (cancelled) return;

      if (error) {
        setCloudSyncStatus('error');
        return;
      }

      if (data?.payload) {
        cloudVersionRef.current = Number(data.version || 1);
        applyingRemoteRef.current = true;
        setState(data.payload as ErpDatabaseState);
        applyingRemoteRef.current = false;
        setCloudSyncStatus('synced');
      } else {
        await pushStateToCloud(state, 'Initial Seed Upload');
      }
    })();

    const channel = sb
      .channel('asty-erp-workspace-sync')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'erp_workspace_sync',
          filter: `workspace_key=eq.${WORKSPACE_KEY}`,
        },
        (payload) => {
          const row = payload.new as { payload?: ErpDatabaseState; version?: number } | undefined;
          if (!row?.payload) return;
          const incomingVersion = Number(row.version || 0);
          if (incomingVersion <= cloudVersionRef.current) return;
          cloudVersionRef.current = incomingVersion;
          applyingRemoteRef.current = true;
          setState(row.payload);
          applyingRemoteRef.current = false;
          setCloudSyncStatus('synced');
        },
      )
      .subscribe();

    return () => {
      cancelled = true;
      void sb.removeChannel(channel);
    };
  }, []);

  const scheduleCloudPush = (nextState: ErpDatabaseState) => {
    if (!isSupabaseConfigured || !supabase || applyingRemoteRef.current) return;
    if (saveTimerRef.current) {
      window.clearTimeout(saveTimerRef.current);
    }
    saveTimerRef.current = window.setTimeout(() => {
      void pushStateToCloud(nextState);
    }, 250);
  };

  const loginAsUser = (userId: string) => {
    const user = state.users.find((u) => u.id === userId && u.isActive);
    if (!user) return;
    setCurrentUserId(user.id);
    window.localStorage.setItem(USER_KEY, user.id);
    i18n.changeLanguage(user.preferredLanguage);
    window.localStorage.setItem('asty_lang', user.preferredLanguage);
    if (isSupabaseConfigured && supabase) {
      void ensureSupabaseSession(user.email);
    }
  };

  const logout = () => {
    setCurrentUserId(null);
    window.localStorage.removeItem(USER_KEY);
    if (isSupabaseConfigured && supabase) {
      void supabase.auth.signOut();
    }
  };

  const mutateState = (recipe: (draft: ErpDatabaseState) => void) => {
    setState((prev) => {
      const next: ErpDatabaseState = structuredClone(prev);
      recipe(next);
      scheduleCloudPush(next);
      return next;
    });
  };

  const resetDemoData = () => {
    const fresh = createCleanErpState();
    setState(fresh);
    window.localStorage.removeItem(LEGACY_STORAGE_KEY);
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(fresh));
    void pushStateToCloud(fresh, 'Cleared All ERP Data');
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
      void syncOfflineQueueNow();
    }
  }, [isOnline]);

  const value: ErpContextValue = {
    state,
    currentUser,
    isOnline,
    offlineQueueCount,
    cloudSyncStatus,
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
