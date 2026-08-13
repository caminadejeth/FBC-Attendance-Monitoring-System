import { db, collection, onSnapshot, doc, getDoc, setDoc, deleteDoc } from './firebase';

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
    return 0;
  });
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
        const isSeededLocally = localStorage.getItem(seededKey);
        const isSeededInCloud = await isCloudInitialized();

        if (isSeededLocally || isSeededInCloud) {
          // Collection was already initialized; empty means intentionally empty!
          localStorage.setItem(storageKey, JSON.stringify([]));
          onUpdate([]);
          return;
        }

        // If not seeded yet anywhere, check if we have cached local data
        const cached = localStorage.getItem(storageKey);
        if (cached) {
          try {
            const parsed = JSON.parse(cached);
            if (Array.isArray(parsed) && parsed.length > 0) {
              const filtered = parsed.filter((item) => !deletedSet.has(item.id));
              const sorted = sortItemsByCollection(collectionName, filtered);
              localStorage.setItem(seededKey, 'true');
              await markCloudInitialized();
              onUpdate(sorted);
              // Seed cached items to firestore so cloud is populated
              for (const item of sorted) {
                try {
                  await setDoc(doc(db, collectionName, item.id), cleanUndefined(item), { merge: true });
                } catch (e) {
                  console.error(`Error syncing cached item to ${collectionName}:`, e);
                }
              }
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
          localStorage.setItem(seededKey, 'true');
          await markCloudInitialized();
          for (const item of sortedInitial) {
            try {
              await setDoc(doc(db, collectionName, item.id), cleanUndefined(item), { merge: true });
            } catch (e) {
              console.error(`Error seeding ${collectionName}:`, e);
            }
          }
          try {
            localStorage.setItem(storageKey, JSON.stringify(sortedInitial));
          } catch (e) {
            console.error(e);
          }
          onUpdate(sortedInitial);
        } else {
          localStorage.setItem(seededKey, 'true');
          await markCloudInitialized();
          localStorage.setItem(storageKey, JSON.stringify([]));
          onUpdate([]);
        }
      } else {
        localStorage.setItem(seededKey, 'true');
        await markCloudInitialized();

        const items: T[] = snapshot.docs
          .map((docSnap) => docSnap.data() as T)
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
      const cached = localStorage.getItem(storageKey);
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
) {
  try {
    const cleanedItem = cleanUndefined(item);
    await setDoc(doc(db, collectionName, item.id), cleanedItem, { merge: true });
  } catch (error) {
    console.error(`Error saving to ${collectionName}:`, error);
  }
}

export async function saveDocuments<T extends { id: string }>(
  collectionName: string,
  items: T[]
) {
  for (const item of items) {
    await saveDocument(collectionName, item);
  }
}

export async function removeDocument(collectionName: string, id: string) {
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
