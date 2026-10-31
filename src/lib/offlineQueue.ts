import { openDB } from 'idb';

export interface QueuedOfflineCheckin {
  offlineSubmissionId: string;
  queuedAt: string;
  siteId: string;
  reportDate: string;
  slot: 'morning' | 'afternoon' | 'evening';
  userId: string;
  lat: number;
  lng: number;
  accuracyM: number;
  photos: Array<{ dataUrl: string; caption: string; capturedAt: string }>;
  workerAttendances?: Array<{ workerId: string; status: 'present' | 'half_day' | 'absent' }>;
  subcontractorCounts?: Array<{ trade: string; headcount: number }>;
  activities?: Array<{ planActivityId?: string; title: string; completedQty: number; unit: string; completedPct: number }>;
  materialsReceived?: Array<{ itemId: string; qty: number; challanNo: string; photoDataUrl?: string }>;
  materialsUsed?: Array<{ itemId: string; qtyUsed: number }>;
  issues?: Array<{ category: string; description: string; isUrgent: boolean }>;
  tomorrowPlan?: string;
}

const DB_NAME = 'asty_erp_offline_v1';
const STORE_NAME = 'dpr_queue';

async function getDb() {
  return openDB(DB_NAME, 1, {
    upgrade(db) {
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'offlineSubmissionId' });
      }
    },
  });
}

export async function enqueueOfflineCheckin(item: QueuedOfflineCheckin): Promise<void> {
  const db = await getDb();
  await db.put(STORE_NAME, item);
}

export async function listOfflineCheckins(): Promise<QueuedOfflineCheckin[]> {
  try {
    const db = await getDb();
    return await db.getAll(STORE_NAME);
  } catch {
    return [];
  }
}

export async function removeOfflineCheckin(offlineSubmissionId: string): Promise<void> {
  const db = await getDb();
  await db.delete(STORE_NAME, offlineSubmissionId);
}

