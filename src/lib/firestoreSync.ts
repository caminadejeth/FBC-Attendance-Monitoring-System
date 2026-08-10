import { db, collection, onSnapshot, doc, setDoc, deleteDoc } from './firebase';

export function subscribeCollection<T extends { id: string }>(
  collectionName: string,
  initialData: T[],
  onUpdate: (data: T[]) => void
) {
  const colRef = collection(db, collectionName);
  return onSnapshot(
    colRef,
    async (snapshot) => {
      if (snapshot.empty && initialData.length > 0) {
        // Seed initial default data to cloud database if empty
        for (const item of initialData) {
          try {
            await setDoc(doc(db, collectionName, item.id), item);
          } catch (e) {
            console.error(`Error seeding ${collectionName}:`, e);
          }
        }
      } else {
        const items: T[] = snapshot.docs.map((docSnap) => docSnap.data() as T);
        onUpdate(items);
      }
    },
    (error) => {
      console.error(`Firestore error on ${collectionName}:`, error);
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
