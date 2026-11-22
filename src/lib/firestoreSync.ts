import { db, collection, onSnapshot, doc, getDoc, setDoc, deleteDoc, writeBatch } from './firebase';

const getStorageKey = (colName: string) => {
  if (colName === 'ctoRequests') return 'fbc_cto_requests';
  if (colName === 'ctoAdjustments') return 'fbc_cto_adjustments';
  return `fbc_${colName}`;
};

const getDeletedKey = (colName: string) => `fbc_deleted_${colName}`;

// Keep browser localStorage well below the ~5MB origin quota so critical session keys never fail.
const MAX_COLLECTION_CACHE_CHARS = 350_000;
const EVICTABLE_CACHE_KEYS = [
  'fbc_summaries',
  'fbc_punches',
  'fbc_stockMovements',
  'fbc_activityLogs',
  'fbc_activity_logs',
  'fbc_warehouseItems',
  'fbc_storeTickets',
  'fbc_stockTransfers',
  'fbc_emailedAlerts',
];

function evictBulkyCaches(preserveKey?: string) {
  for (const key of EVICTABLE_CACHE_KEYS) {
    if (key === preserveKey) continue;
    try {
      localStorage.removeItem(key);
    } catch {
      // Ignore storage access errors
    }
  }
}

export function safeLocalStorageSet(
  key: string,
  value: string,
  options?: { essential?: boolean }
): boolean {
  try {
    localStorage.setItem(key, value);
    return true;
  } catch {
    // Quota exceeded or storage unavailable: free bulky caches and retry if essential or small enough
    evictBulkyCaches(key);
    if (options?.essential || value.length <= MAX_COLLECTION_CACHE_CHARS) {
      try {
        localStorage.setItem(key, value);
        return true;
      } catch {
        return false;
      }
    }
    return false;
  }
}

function sanitizeItemsForCache<T>(collectionName: string, items: T[]): unknown[] {
  if (collectionName !== 'storeTickets') return items;
  // Strip base64 photo blobs from localStorage cache; live images come directly from Firestore.
  return (items as Array<Record<string, any>>).map((ticket) => {
    if (!Array.isArray(ticket?.attachments) || ticket.attachments.length === 0) {
      return ticket;
    }
    return {
      ...ticket,
      attachments: ticket.attachments.map((att: Record<string, any>) => ({
        ...att,
        dataUrl: '',
      })),
    };
  });
}

export function safeCacheCollectionItems<T>(collectionName: string, items: T[]): void {
  const storageKey = getStorageKey(collectionName);
  try {
    const payload = sanitizeItemsForCache(collectionName, items);
    const serialized = JSON.stringify(payload);
    if (serialized.length > MAX_COLLECTION_CACHE_CHARS) {
      // Too large for localStorage quota; clear any stale oversized cache entry silently.
      try {
        localStorage.removeItem(storageKey);
      } catch {
        // Ignore
      }
      return;
    }
    safeLocalStorageSet(storageKey, serialized);
  } catch {
    // Never treat optional localStorage caching failure as a fatal error
  }
}

// Prune any legacy oversized collection caches on startup to free browser quota
try {
  if (typeof window !== 'undefined' && window.localStorage) {
    for (const key of EVICTABLE_CACHE_KEYS) {
      const existingVal = window.localStorage.getItem(key);
      if (existingVal && existingVal.length > MAX_COLLECTION_CACHE_CHARS) {
        window.localStorage.removeItem(key);
      }
    }
  }
} catch {
  // Ignore storage access errors
}

let cloudInitializedCache: boolean | null = null;

async function isCloudInitialized(): Promise<boolean> {
  if (cloudInitializedCache !== null) return cloudInitializedCache;
  try {
    const metaSnap = await getDoc(doc(db, '_metadata', 'initialized'));
    if (metaSnap.exists()) {
      cloudInitializedCache = true;
      return true;
    }
  } catch (e) {
    console.error('Error checking cloud initialized status:', e);
  }
  return false;
}

async function markCloudInitialized() {
  cloudInitializedCache = true;
  try {
    await setDoc(
      doc(db, '_metadata', 'initialized'),
      { initialized: true, timestamp: new Date().toISOString() },
      { merge: true }
    );
  } catch (e) {
    console.error('Error marking cloud initialized:', e);
  }
}

export function sortItemsByCollection<T extends { id: string }>(
  colName: string,
  items: T[]
): T[] {
  return [...items].sort((a: any, b: any) => {
    if (colName === 'activityLogs' || colName === 'ctoAdjustments') {
      const timeA = new Date(a.timestamp || 0).getTime();
      const timeB = new Date(b.timestamp || 0).getTime();
      return timeB - timeA;
    }
    if (colName === 'disputes' || colName === 'ctoRequests') {
      const timeA = new Date(a.submittedAt || a.date || 0).getTime();
      const timeB = new Date(b.submittedAt || b.date || 0).getTime();
      return timeB - timeA;
    }
    if (colName === 'summaries') {
      return (b.date || '').localeCompare(a.date || '');
    }
    if (colName === 'schedules') {
      return (b.effectiveDate || '').localeCompare(a.effectiveDate || '');
    }
    if (colName === 'users') {
      return (a.name || '').localeCompare(b.name || '');
    }
    if (colName === 'stockMovements') {
      const timeA = new Date(a.timestamp || a.date || 0).getTime();
      const timeB = new Date(b.timestamp || b.date || 0).getTime();
      return timeB - timeA;
    }
    if (colName === 'stockTransfers' || colName === 'storeTickets') {
      const timeA = new Date(a.createdAt || a.date || 0).getTime();
      const timeB = new Date(b.createdAt || b.date || 0).getTime();
      return timeB - timeA;
    }
    if (colName === 'warehouseCategories') {
      const orderA = typeof a.sortOrder === 'number' ? a.sortOrder : 9999;
      const orderB = typeof b.sortOrder === 'number' ? b.sortOrder : 9999;
      if (orderA !== orderB) return orderA - orderB;
      return (a.name || '').localeCompare(b.name || '');
    }
    if (colName === 'warehouseItems') {
      const branchCmp = (a.branchName || '').localeCompare(b.branchName || '');
      if (branchCmp !== 0) return branchCmp;
      const catCmp = (a.category || '').localeCompare(b.category || '');
      if (catCmp !== 0) return catCmp;
      return (a.description || '').localeCompare(b.description || '');
    }
    return 0;
  });
}

export async function isWarehouseCatalogSeeded(): Promise<boolean> {
  try {
    if (localStorage.getItem('fbc_warehouse_catalog_seeded_v1') === 'true') {
      return true;
    }
    const metaSnap = await getDoc(doc(db, '_metadata', 'warehouseCatalogSeededV1'));
    if (metaSnap.exists()) {
      safeLocalStorageSet('fbc_warehouse_catalog_seeded_v1', 'true', { essential: true });
      return true;
    }
  } catch (e) {
    console.error('Error checking warehouse catalog seeded status:', e);
  }
  return false;
}

export async function markWarehouseCatalogSeeded(): Promise<void> {
  try {
    safeLocalStorageSet('fbc_warehouse_catalog_seeded_v1', 'true', { essential: true });
    await setDoc(
      doc(db, '_metadata', 'warehouseCatalogSeededV1'),
      { seeded: true, timestamp: new Date().toISOString() },
      { merge: true }
    );
  } catch (e) {
    console.error('Error marking warehouse catalog seeded:', e);
  }
}

export function getDeletedIds(colName: string): Set<string> {
  try {
    const raw = localStorage.getItem(getDeletedKey(colName));
    if (raw) {
      const arr = JSON.parse(raw);
      if (Array.isArray(arr)) return new Set(arr);
    }
  } catch {
    // Ignore storage read error
  }
  return new Set();
}

export function recordDeletedId(colName: string, id: string) {
  const deletedSet = getDeletedIds(colName);
  deletedSet.add(id);
  safeLocalStorageSet(getDeletedKey(colName), JSON.stringify(Array.from(deletedSet)), {
    essential: true,
  });
}

export function unmarkDeletedId(colName: string, id: string) {
  const deletedSet = getDeletedIds(colName);
  if (deletedSet.has(id)) {
    deletedSet.delete(id);
    safeLocalStorageSet(getDeletedKey(colName), JSON.stringify(Array.from(deletedSet)), {
      essential: true,
    });
  }
}

export function unmarkDeletedIds(colName: string, ids: string[]) {
  const deletedSet = getDeletedIds(colName);
  let changed = false;
  for (const id of ids) {
    if (deletedSet.has(id)) {
      deletedSet.delete(id);
      changed = true;
    }
  }
  if (changed) {
    safeLocalStorageSet(getDeletedKey(colName), JSON.stringify(Array.from(deletedSet)), {
      essential: true,
    });
  }
}

export function subscribeCollection<T extends { id: string }>(
  collectionName: string,
  initialData: T[],
  onUpdate: (data: T[]) => void
) {
  const colRef = collection(db, collectionName);
  const storageKey = getStorageKey(collectionName);
  const seededKey = `fbc_seeded_${collectionName}`;

  return onSnapshot(
    colRef,
    async (snapshot) => {
      const deletedSet = getDeletedIds(collectionName);

      if (snapshot.empty) {
        let isSeededLocally: string | null = null;
        try {
          isSeededLocally = localStorage.getItem(seededKey);
        } catch (e) {
          console.error(`Failed reading ${seededKey}`, e);
        }
        const isSeededInCloud = await isCloudInitialized();

        if (isSeededLocally || isSeededInCloud) {
          // Collection was already initialized; empty means intentionally empty!
          safeLocalStorageSet(storageKey, JSON.stringify([]));
          onUpdate([]);
          return;
        }

        // If not seeded yet anywhere, check if we have cached local data
        let cached: string | null = null;
        try {
          cached = localStorage.getItem(storageKey);
        } catch {
          // Ignore
        }
        if (cached) {
          try {
            const parsed = JSON.parse(cached);
            if (Array.isArray(parsed) && parsed.length > 0) {
              const filtered = parsed.filter((item) => !deletedSet.has(item.id));
              const sorted = sortItemsByCollection(collectionName, filtered);
              safeLocalStorageSet(seededKey, 'true', { essential: true });
              await markCloudInitialized();
              onUpdate(sorted);
              // Seed cached items to firestore so cloud is populated
              await saveDocuments(collectionName, sorted);
              return;
            }
          } catch (e) {
            console.error(`Failed parsing cache for ${storageKey}`, e);
          }
        }

        // If no cache and initial default data exists, seed once
        const validInitial = initialData.filter((item) => !deletedSet.has(item.id));
        const sortedInitial = sortItemsByCollection(collectionName, validInitial);

        if (sortedInitial.length > 0) {
          safeLocalStorageSet(seededKey, 'true', { essential: true });
          await markCloudInitialized();
          await saveDocuments(collectionName, sortedInitial);
          safeCacheCollectionItems(collectionName, sortedInitial);
          onUpdate(sortedInitial);
        } else {
          safeLocalStorageSet(seededKey, 'true', { essential: true });
          safeLocalStorageSet(storageKey, JSON.stringify([]));
          await markCloudInitialized();
          onUpdate([]);
        }
      } else {
        safeLocalStorageSet(seededKey, 'true', { essential: true });
        await markCloudInitialized();

        const items: T[] = snapshot.docs
          .map((docSnap) => ({ ...(docSnap.data() as Record<string, any>), id: docSnap.id } as T))
          .filter((item) => !deletedSet.has(item.id));

        const sortedItems = sortItemsByCollection(collectionName, items);

        safeCacheCollectionItems(collectionName, sortedItems);
        onUpdate(sortedItems);
      }
    },
    (error) => {
      console.error(`Firestore error on ${collectionName}:`, error);
      const deletedSet = getDeletedIds(collectionName);
      let cached: string | null = null;
      try {
        cached = localStorage.getItem(storageKey);
      } catch (storageErr) {
        console.error(`Failed reading fallback cache for ${storageKey}`, storageErr);
      }
      if (cached) {
        try {
          const parsed = JSON.parse(cached);
          if (Array.isArray(parsed)) {
            const filtered = parsed.filter((item) => !deletedSet.has(item.id));
            const sorted = sortItemsByCollection(collectionName, filtered);
            onUpdate(sorted);
            return;
          }
        } catch (e) {
          console.error(`Failed loading fallback cache for ${storageKey}`, e);
        }
      }
      const validInitial = initialData.filter((item) => !deletedSet.has(item.id));
      const sortedInitial = sortItemsByCollection(collectionName, validInitial);
      onUpdate(sortedInitial);
    }
  );
}

export function cleanUndefined<T>(obj: T): T {
  if (typeof obj === 'number') {
    return (Number.isFinite(obj) ? obj : 0) as unknown as T;
  }
  if (obj === null || obj === undefined || typeof obj !== 'object') {
    return obj;
  }
  if (Array.isArray(obj)) {
    return obj.map(cleanUndefined) as unknown as T;
  }
  const cleaned: Record<string, any> = {};
  for (const [key, value] of Object.entries(obj)) {
    if (value !== undefined) {
      cleaned[key] = cleanUndefined(value);
    }
  }
  return cleaned as T;
}

export async function saveDocument<T extends { id: string }>(
  collectionName: string,
  item: T
): Promise<boolean> {
  if (!item?.id) {
    console.error(`Cannot save to ${collectionName}: missing document id`, item);
    return false;
  }
  unmarkDeletedId(collectionName, item.id);
  try {
    const cleanedItem = cleanUndefined(item);
    await setDoc(doc(db, collectionName, item.id), cleanedItem, { merge: true });
    return true;
  } catch (error) {
    console.error(`Error saving to ${collectionName}:`, error);
    return false;
  }
}

export async function saveDocuments<T extends { id: string }>(
  collectionName: string,
  items: T[]
) {
  const validItems = (items || []).filter((item) => Boolean(item?.id));
  if (validItems.length === 0) return;

  const ids = validItems.map((i) => i.id);
  unmarkDeletedIds(collectionName, ids);

  const BATCH_SIZE = 400; // Firestore limit is 500
  for (let i = 0; i < validItems.length; i += BATCH_SIZE) {
    const chunk = validItems.slice(i, i + BATCH_SIZE);
    try {
      const batch = writeBatch(db);
      for (const item of chunk) {
        const cleanedItem = cleanUndefined(item);
        const ref = doc(db, collectionName, item.id);
        batch.set(ref, cleanedItem, { merge: true });
      }
      await batch.commit();
    } catch (e) {
      console.error(`Error in batch saving to ${collectionName}:`, e);
      // Fallback to individual setDoc calls if batch fails
      for (const item of chunk) {
        await saveDocument(collectionName, item);
      }
    }
  }
}

export async function removeDocument(collectionName: string, id: string) {
  if (!id) return;
  recordDeletedId(collectionName, id);
  const storageKey = getStorageKey(collectionName);
  try {
    const cached = localStorage.getItem(storageKey);
    if (cached) {
      const parsed = JSON.parse(cached);
      if (Array.isArray(parsed)) {
        const filtered = parsed.filter((item: any) => item.id !== id);
        safeCacheCollectionItems(collectionName, filtered);
      }
    }
  } catch {
    // Ignore cache cleanup error
  }

  try {
    await deleteDoc(doc(db, collectionName, id));
  } catch (error) {
    console.error(`Error deleting from ${collectionName}:`, error);
  }
}

