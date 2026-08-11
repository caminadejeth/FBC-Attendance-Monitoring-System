import { db, collection, onSnapshot, doc, setDoc, deleteDoc } from './firebase';

const getStorageKey = (colName: string) => {
  if (colName === 'ctoRequests') return 'fbc_cto_requests';
  if (colName === 'ctoAdjustments') return 'fbc_cto_adjustments';
  return `fbc_${colName}`;
};

export function subscribeCollection<T extends { id: string }>(
  collectionName: string,
  initialData: T[],
  onUpdate: (data: T[]) => void
) {
  const colRef = collection(db, collectionName);
  const storageKey = getStorageKey(collectionName);

  return onSnapshot(
    colRef,
    async (snapshot) => {
      if (snapshot.empty) {
        // If Firestore collection is empty, check if we have cached local data
        const cached = localStorage.getItem(storageKey);
        if (cached) {
          try {
            const parsed = JSON.parse(cached);
            if (Array.isArray(parsed) && parsed.length > 0) {
              onUpdate(parsed);
              // Seed cached items to firestore so cloud is populated
              for (const item of parsed) {
                try {
                  await setDoc(doc(db, collectionName, item.id), item, { merge: true });
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
        if (initialData.length > 0) {
          for (const item of initialData) {
            try {
              await setDoc(doc(db, collectionName, item.id), item, { merge: true });
            } catch (e) {
              console.error(`Error seeding ${collectionName}:`, e);
            }
          }
          try {
            localStorage.setItem(storageKey, JSON.stringify(initialData));
          } catch (e) {
            console.error(e);
          }
          onUpdate(initialData);
        } else {
          onUpdate([]);
        }
      } else {
        const items: T[] = snapshot.docs.map((docSnap) => docSnap.data() as T);
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
      // Fallback to localStorage instead of resetting to initial default mock data
      const cached = localStorage.getItem(storageKey);
      if (cached) {
        try {
          const parsed = JSON.parse(cached);
          if (Array.isArray(parsed)) {
            onUpdate(parsed);
            return;
          }
        } catch (e) {
          console.error(`Failed loading fallback cache for ${storageKey}`, e);
        }
      }
      onUpdate(initialData);
    }
  );
}

export async function saveDocument<T extends { id: string }>(
  collectionName: string,
  item: T
) {
  try {
    await setDoc(doc(db, collectionName, item.id), item, { merge: true });
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
  try {
    await deleteDoc(doc(db, collectionName, id));
  } catch (error) {
    console.error(`Error deleting from ${collectionName}:`, error);
  }
}
