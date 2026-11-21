import { db, collection, onSnapshot, doc, getDoc, setDoc, deleteDoc, writeBatch } from './firebase';

const getStorageKey = (colName: string) => {
  if (colName === 'ctoRequests') return 'fbc_cto_requests';
  if (colName === 'ctoAdjustments') return 'fbc_cto_adjustments';
  return `fbc_${colName}`;
};

const getDeletedKey = (colName: string) => `fbc_deleted_${colName}`;

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
      localStorage.setItem('fbc_warehouse_catalog_seeded_v1', 'true');
      return true;
    }
  } catch (e) {
    console.error('Error checking warehouse catalog seeded status:', e);
  }
  return false;
}

export async function markWarehouseCatalogSeeded(): Promise<void> {
  try {
    localStorage.setItem('fbc_warehouse_catalog_seeded_v1', 'true');
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
  } catch (e) {
    console.error(`Failed loading deleted IDs for ${colName}`, e);
  }
  return new Set();
}

export function recordDeletedId(colName: string, id: string) {
  try {
    const deletedSet = getDeletedIds(colName);
    deletedSet.add(id);
    localStorage.setItem(getDeletedKey(colName), JSON.stringify(Array.from(deletedSet)));
  } catch (e) {
    console.error(`Failed recording deleted ID for ${colName}`, e);
  }
}

export function unmarkDeletedId(colName: string, id: string) {
  try {
    const deletedSet = getDeletedIds(colName);
    if (deletedSet.has(id)) {
      deletedSet.delete(id);
      localStorage.setItem(getDeletedKey(colName), JSON.stringify(Array.from(deletedSet)));
    }
  } catch (e) {
    console.error(`Failed unmarking deleted ID for ${colName}`, e);
  }
}

export function unmarkDeletedIds(colName: string, ids: string[]) {
  try {
    const deletedSet = getDeletedIds(colName);
    let changed = false;
    for (const id of ids) {
      if (deletedSet.has(id)) {
        deletedSet.delete(id);
        changed = true;
      }
    }
    if (changed) {
      localStorage.setItem(getDeletedKey(colName), JSON.stringify(Array.from(deletedSet)));
    }
  } catch (e) {
    console.error(`Failed unmarking deleted IDs for ${colName}`, e);
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
          try {
            localStorage.setItem(storageKey, JSON.stringify([]));
          } catch (e) {
            console.error(`Failed clearing cache ${storageKey}`, e);
          }
          onUpdate([]);
          return;
        }

        // If not seeded yet anywhere, check if we have cached local data
        let cached: string | null = null;
        try {
          cached = localStorage.getItem(storageKey);
        } catch (e) {
          console.error(`Failed reading cache ${storageKey}`, e);
        }
        if (cached) {
          try {
            const parsed = JSON.parse(cached);
            if (Array.isArray(parsed) && parsed.length > 0) {
              const filtered = parsed.filter((item) => !deletedSet.has(item.id));
              const sorted = sortItemsByCollection(collectionName, filtered);
              try {
                localStorage.setItem(seededKey, 'true');
              } catch (e) {
                console.error(`Failed marking ${seededKey}`, e);
              }
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
          try {
            localStorage.setItem(seededKey, 'true');
          } catch (e) {
            console.error(`Failed marking ${seededKey}`, e);
          }
          await markCloudInitialized();
          await saveDocuments(collectionName, sortedInitial);
          try {
            localStorage.setItem(storageKey, JSON.stringify(sortedInitial));
          } catch (e) {
            console.error(e);
          }
          onUpdate(sortedInitial);
        } else {
          try {
            localStorage.setItem(seededKey, 'true');
            localStorage.setItem(storageKey, JSON.stringify([]));
          } catch (e) {
            console.error(`Failed initializing empty cache ${storageKey}`, e);
          }
          await markCloudInitialized();
          onUpdate([]);
        }
      } else {
        try {
          localStorage.setItem(seededKey, 'true');
        } catch (e) {
          console.error(`Failed marking ${seededKey}`, e);
        }
        await markCloudInitialized();

        const items: T[] = snapshot.docs
          .map((docSnap) => ({ ...(docSnap.data() as Record<string, any>), id: docSnap.id } as T))
          .filter((item) => !deletedSet.has(item.id));

        const sortedItems = sortItemsByCollection(collectionName, items);

        try {
          localStorage.setItem(storageKey, JSON.stringify(sortedItems));
        } catch (err) {
          console.error(`Failed caching ${storageKey}`, err);
        }
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
        localStorage.setItem(storageKey, JSON.stringify(filtered));
      }
    }
  } catch (e) {
    console.error(`Error deleting from cache for ${collectionName}:`, e);
  }

  try {
    await deleteDoc(doc(db, collectionName, id));
  } catch (error) {
    console.error(`Error deleting from ${collectionName}:`, error);
  }
}

