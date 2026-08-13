import { db, collection, onSnapshot, doc, setDoc, deleteDoc } from './firebase';

const getStorageKey = (colName: string) => {
  if (colName === 'ctoRequests') return 'fbc_cto_requests';
  if (colName === 'ctoAdjustments') return 'fbc_cto_adjustments';
  return `fbc_${colName}`;
};

const getDeletedKey = (colName: string) => `fbc_deleted_${colName}`;

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
        const isSeeded = localStorage.getItem(seededKey);
        if (isSeeded) {
          // Collection was already initialized; empty means intentionally empty!
          localStorage.setItem(storageKey, JSON.stringify([]));
          onUpdate([]);
          return;
        }

        // If not seeded yet, check if we have cached local data
        const cached = localStorage.getItem(storageKey);
        if (cached) {
          try {
            const parsed = JSON.parse(cached);
            if (Array.isArray(parsed) && parsed.length > 0) {
              const filtered = parsed.filter((item) => !deletedSet.has(item.id));
              localStorage.setItem(seededKey, 'true');
              onUpdate(filtered);
              // Seed cached items to firestore so cloud is populated
              for (const item of filtered) {
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
        if (validInitial.length > 0) {
          localStorage.setItem(seededKey, 'true');
          for (const item of validInitial) {
            try {
              await setDoc(doc(db, collectionName, item.id), cleanUndefined(item), { merge: true });
            } catch (e) {
              console.error(`Error seeding ${collectionName}:`, e);
            }
          }
          try {
            localStorage.setItem(storageKey, JSON.stringify(validInitial));
          } catch (e) {
            console.error(e);
          }
          onUpdate(validInitial);
        } else {
          localStorage.setItem(seededKey, 'true');
          localStorage.setItem(storageKey, JSON.stringify([]));
          onUpdate([]);
        }
      } else {
        localStorage.setItem(seededKey, 'true');
        const items: T[] = snapshot.docs
          .map((docSnap) => docSnap.data() as T)
          .filter((item) => !deletedSet.has(item.id));

        try {
          localStorage.setItem(storageKey, JSON.stringify(items));
        } catch (err) {
          console.error(`Failed caching ${storageKey}`, err);
        }
        onUpdate(items);
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
            onUpdate(filtered);
            return;
          }
        } catch (e) {
          console.error(`Failed loading fallback cache for ${storageKey}`, e);
        }
      }
      const validInitial = initialData.filter((item) => !deletedSet.has(item.id));
      onUpdate(validInitial);
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
