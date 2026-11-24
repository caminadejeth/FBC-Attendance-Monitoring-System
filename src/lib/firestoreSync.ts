import {
  auth,
  db,
  collection,
  onSnapshot,
  doc,
  getDoc,
  getDocFromServer,
  setDoc,
  deleteDoc,
  writeBatch,
} from './firebase';

const getStorageKey = (colName: string) => {
  if (colName === 'ctoRequests') return 'fbc_cto_requests';
  if (colName === 'ctoAdjustments') return 'fbc_cto_adjustments';
  return `fbc_${colName}`;
};

const getDeletedKey = (colName: string) => `fbc_deleted_${colName}`;

const HEAVY_COLLECTION_STORAGE_KEYS = [
  'fbc_users',
  'fbc_summaries',
  'fbc_punches',
  'fbc_disputes',
  'fbc_schedules',
  'fbc_cto_requests',
  'fbc_cto_adjustments',
  'fbc_activityLogs',
  'fbc_activity_logs',
  'fbc_warehouseCategories',
  'fbc_warehouseItems',
  'fbc_stockMovements',
  'fbc_stockTransfers',
  'fbc_adminEmailSettings',
];

const IDB_NAME = 'fbc_firestore_cache';
const IDB_VERSION = 1;
const IDB_STORE = 'collections';
const MAX_DELETED_IDS_CACHE = 500;

export enum FirestoreOperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: FirestoreOperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

function isPermissionDeniedError(error: unknown): boolean {
  const code = (error as { code?: string })?.code;
  const msg = error instanceof Error ? error.message : String(error || '');
  return (
    code === 'permission-denied' ||
    msg.includes('Missing or insufficient permissions')
  );
}

function logFirestorePermissionError(
  error: unknown,
  operationType: FirestoreOperationType,
  path: string | null
) {
  const currentAuthUser = auth?.currentUser;
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: currentAuthUser?.uid ?? null,
      email: currentAuthUser?.email ?? null,
      emailVerified: currentAuthUser?.emailVerified ?? null,
      isAnonymous: currentAuthUser?.isAnonymous ?? null,
      tenantId: currentAuthUser?.tenantId ?? null,
      providerInfo:
        currentAuthUser?.providerData?.map((provider) => ({
          providerId: provider.providerId,
          email: provider.email,
        })) || [],
    },
    operationType,
    path,
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
}

let connectionTested = false;
export async function testFirestoreConnection(): Promise<void> {
  if (connectionTested || typeof window === 'undefined') return;
  connectionTested = true;
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.error('Please check your Firebase configuration.');
    }
  }
}

export function safeLocalStorageGet(key: string): string | null {
  try {
    if (typeof localStorage === 'undefined') return null;
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

export function safeLocalStorageRemove(key: string): void {
  try {
    if (typeof localStorage === 'undefined') return;
    localStorage.removeItem(key);
  } catch {
    // ignore storage errors
  }
}

export function evictHeavyLocalStorageCaches(): void {
  if (typeof localStorage === 'undefined') return;
  for (const key of HEAVY_COLLECTION_STORAGE_KEYS) {
    try {
      localStorage.removeItem(key);
    } catch {
      // ignore storage errors
    }
  }
}

export function safeLocalStorageSet(key: string, value: string): boolean {
  if (typeof localStorage === 'undefined') return false;
  try {
    localStorage.setItem(key, value);
    return true;
  } catch {
    // Evict heavy legacy collection caches to reclaim ~5MB localStorage quota
    evictHeavyLocalStorageCaches();
    try {
      localStorage.setItem(key, value);
      return true;
    } catch {
      return false;
    }
  }
}

let idbPromise: Promise<IDBDatabase | null> | null = null;

function getCacheDb(): Promise<IDBDatabase | null> {
  if (typeof indexedDB === 'undefined') {
    return Promise.resolve(null);
  }
  if (idbPromise) return idbPromise;

  idbPromise = new Promise((resolve) => {
    try {
      const request = indexedDB.open(IDB_NAME, IDB_VERSION);
      request.onupgradeneeded = () => {
        const database = request.result;
        if (!database.objectStoreNames.contains(IDB_STORE)) {
          database.createObjectStore(IDB_STORE);
        }
      };
      request.onsuccess = () => {
        const database = request.result;
        database.onversionchange = () => {
          database.close();
          idbPromise = null;
        };
        resolve(database);
      };
      request.onerror = () => {
        resolve(null);
      };
      request.onblocked = () => {
        resolve(null);
      };
    } catch {
      resolve(null);
    }
  });

  return idbPromise;
}

async function idbGetCollection<T>(storageKey: string): Promise<T[] | null> {
  const database = await getCacheDb();
  if (!database) return null;
  return new Promise((resolve) => {
    try {
      const tx = database.transaction(IDB_STORE, 'readonly');
      const store = tx.objectStore(IDB_STORE);
      const req = store.get(storageKey);
      req.onsuccess = () => {
        resolve(Array.isArray(req.result) ? (req.result as T[]) : null);
      };
      req.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

async function idbSetCollection<T>(storageKey: string, items: T[]): Promise<void> {
  const database = await getCacheDb();
  if (!database) return;
  return new Promise((resolve) => {
    try {
      const tx = database.transaction(IDB_STORE, 'readwrite');
      const store = tx.objectStore(IDB_STORE);
      store.put(items, storageKey);
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
      tx.onabort = () => resolve();
    } catch {
      resolve();
    }
  });
}

async function idbDeleteCollection(storageKey: string): Promise<void> {
  const database = await getCacheDb();
  if (!database) return;
  return new Promise((resolve) => {
    try {
      const tx = database.transaction(IDB_STORE, 'readwrite');
      const store = tx.objectStore(IDB_STORE);
      store.delete(storageKey);
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
      tx.onabort = () => resolve();
    } catch {
      resolve();
    }
  });
}

export async function readCollectionCache<T>(storageKey: string): Promise<T[] | null> {
  const idbItems = await idbGetCollection<T>(storageKey);
  if (idbItems) return idbItems;

  const legacyRaw = safeLocalStorageGet(storageKey);
  if (legacyRaw) {
    try {
      const parsed = JSON.parse(legacyRaw);
      if (Array.isArray(parsed)) {
        await idbSetCollection(storageKey, parsed as T[]);
        safeLocalStorageRemove(storageKey);
        return parsed as T[];
      }
    } catch {
      safeLocalStorageRemove(storageKey);
    }
  }
  return null;
}

export async function writeCollectionCache<T>(
  storageKey: string,
  items: T[]
): Promise<void> {
  // Store large collection snapshots in IndexedDB rather than ~5MB localStorage
  await idbSetCollection(storageKey, items);
  // Evict any legacy localStorage copy so origin localStorage quota stays free
  safeLocalStorageRemove(storageKey);
  if (storageKey === 'fbc_activityLogs') {
    safeLocalStorageRemove('fbc_activity_logs');
  }
}

export async function clearCollectionCache(collectionName: string): Promise<void> {
  const storageKey = getStorageKey(collectionName);
  await idbDeleteCollection(storageKey);
  safeLocalStorageRemove(storageKey);
  safeLocalStorageRemove(getDeletedKey(collectionName));
  if (collectionName === 'activityLogs') {
    safeLocalStorageRemove('fbc_activity_logs');
  }
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
    if (isPermissionDeniedError(e)) {
      logFirestorePermissionError(e, FirestoreOperationType.GET, '_metadata/initialized');
    } else {
      console.error('Error checking cloud initialized status:', e);
    }
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
    if (isPermissionDeniedError(e)) {
      logFirestorePermissionError(e, FirestoreOperationType.WRITE, '_metadata/initialized');
    } else {
      console.error('Error marking cloud initialized:', e);
    }
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
    if (colName === 'stockTransfers') {
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
    if (safeLocalStorageGet('fbc_warehouse_catalog_seeded_v1') === 'true') {
      return true;
    }
    const metaSnap = await getDoc(doc(db, '_metadata', 'warehouseCatalogSeededV1'));
    if (metaSnap.exists()) {
      safeLocalStorageSet('fbc_warehouse_catalog_seeded_v1', 'true');
      return true;
    }
  } catch (e) {
    if (isPermissionDeniedError(e)) {
      logFirestorePermissionError(
        e,
        FirestoreOperationType.GET,
        '_metadata/warehouseCatalogSeededV1'
      );
    } else {
      console.error('Error checking warehouse catalog seeded status:', e);
    }
  }
  return false;
}

export async function markWarehouseCatalogSeeded(): Promise<void> {
  safeLocalStorageSet('fbc_warehouse_catalog_seeded_v1', 'true');
  try {
    await setDoc(
      doc(db, '_metadata', 'warehouseCatalogSeededV1'),
      { seeded: true, timestamp: new Date().toISOString() },
      { merge: true }
    );
  } catch (e) {
    if (isPermissionDeniedError(e)) {
      logFirestorePermissionError(
        e,
        FirestoreOperationType.WRITE,
        '_metadata/warehouseCatalogSeededV1'
      );
    } else {
      console.error('Error marking warehouse catalog seeded:', e);
    }
  }
}

export function getDeletedIds(colName: string): Set<string> {
  try {
    const raw = safeLocalStorageGet(getDeletedKey(colName));
    if (raw) {
      const arr = JSON.parse(raw);
      if (Array.isArray(arr)) return new Set(arr);
    }
  } catch {
    // ignore corrupt deleted IDs cache
  }
  return new Set();
}

export function recordDeletedId(colName: string, id: string) {
  const deletedSet = getDeletedIds(colName);
  deletedSet.add(id);
  const bounded = Array.from(deletedSet).slice(-MAX_DELETED_IDS_CACHE);
  safeLocalStorageSet(getDeletedKey(colName), JSON.stringify(bounded));
}

export function unmarkDeletedId(colName: string, id: string) {
  const deletedSet = getDeletedIds(colName);
  if (deletedSet.has(id)) {
    deletedSet.delete(id);
    safeLocalStorageSet(
      getDeletedKey(colName),
      JSON.stringify(Array.from(deletedSet))
    );
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
    safeLocalStorageSet(
      getDeletedKey(colName),
      JSON.stringify(Array.from(deletedSet))
    );
  }
}

export function subscribeCollection<T extends { id: string }>(
  collectionName: string,
  initialData: T[],
  onUpdate: (data: T[]) => void
) {
  void testFirestoreConnection();

  const colRef = collection(db, collectionName);
  const storageKey = getStorageKey(collectionName);
  const seededKey = `fbc_seeded_${collectionName}`;

  let hasReceivedSnapshot = false;
  let isUnsubscribed = false;

  // Hydrate immediately from IndexedDB cache before live snapshot resolves (if available)
  void readCollectionCache<T>(storageKey).then((cachedItems) => {
    if (isUnsubscribed || hasReceivedSnapshot || !cachedItems) return;
    const deletedSet = getDeletedIds(collectionName);
    const filtered = cachedItems.filter((item) => !deletedSet.has(item.id));
    onUpdate(sortItemsByCollection(collectionName, filtered));
  });

  const unsubscribeSnapshot = onSnapshot(
    colRef,
    async (snapshot) => {
      hasReceivedSnapshot = true;
      if (isUnsubscribed) return;

      const deletedSet = getDeletedIds(collectionName);

      if (snapshot.empty) {
        const isSeededLocally = safeLocalStorageGet(seededKey);
        const isSeededInCloud = await isCloudInitialized();

        if (isSeededLocally || isSeededInCloud) {
          // Collection was already initialized; empty means intentionally empty!
          await writeCollectionCache(storageKey, []);
          onUpdate([]);
          return;
        }

        // If not seeded yet anywhere, check if we have cached local data
        const cachedItems = await readCollectionCache<T>(storageKey);
        if (cachedItems && cachedItems.length > 0) {
          const filtered = cachedItems.filter((item) => !deletedSet.has(item.id));
          const sorted = sortItemsByCollection(collectionName, filtered);
          safeLocalStorageSet(seededKey, 'true');
          await markCloudInitialized();
          await writeCollectionCache(storageKey, sorted);
          onUpdate(sorted);
          // Seed cached items to firestore so cloud is populated
          await saveDocuments(collectionName, sorted);
          return;
        }

        // If no cache and initial default data exists, seed once
        const validInitial = initialData.filter((item) => !deletedSet.has(item.id));
        const sortedInitial = sortItemsByCollection(collectionName, validInitial);

        safeLocalStorageSet(seededKey, 'true');
        await markCloudInitialized();

        if (sortedInitial.length > 0) {
          await saveDocuments(collectionName, sortedInitial);
          await writeCollectionCache(storageKey, sortedInitial);
          onUpdate(sortedInitial);
        } else {
          await writeCollectionCache(storageKey, []);
          onUpdate([]);
        }
      } else {
        safeLocalStorageSet(seededKey, 'true');
        await markCloudInitialized();

        const items: T[] = snapshot.docs
          .map((docSnap) => docSnap.data() as T)
          .filter((item) => !deletedSet.has(item.id));

        const sortedItems = sortItemsByCollection(collectionName, items);

        // Cache snapshot safely in IndexedDB & clear any bloated localStorage key
        void writeCollectionCache(storageKey, sortedItems);
        onUpdate(sortedItems);
      }
    },
    (error) => {
      if (isPermissionDeniedError(error)) {
        logFirestorePermissionError(error, FirestoreOperationType.LIST, collectionName);
      } else {
        console.error(`Firestore error on ${collectionName}:`, error);
      }
      const deletedSet = getDeletedIds(collectionName);
      void readCollectionCache<T>(storageKey).then((cachedItems) => {
        if (isUnsubscribed) return;
        if (cachedItems) {
          const filtered = cachedItems.filter((item) => !deletedSet.has(item.id));
          onUpdate(sortItemsByCollection(collectionName, filtered));
          return;
        }
        const validInitial = initialData.filter((item) => !deletedSet.has(item.id));
        onUpdate(sortItemsByCollection(collectionName, validInitial));
      });
    }
  );

  return () => {
    isUnsubscribed = true;
    unsubscribeSnapshot();
  };
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
) {
  if (!item?.id) return;
  unmarkDeletedId(collectionName, item.id);
  try {
    const cleanedItem = cleanUndefined(item);
    await setDoc(doc(db, collectionName, item.id), cleanedItem, { merge: true });
  } catch (error) {
    if (isPermissionDeniedError(error)) {
      logFirestorePermissionError(
        error,
        FirestoreOperationType.WRITE,
        `${collectionName}/${item.id}`
      );
    } else {
      console.error(`Error saving to ${collectionName}:`, error);
    }
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
      if (isPermissionDeniedError(e)) {
        logFirestorePermissionError(e, FirestoreOperationType.WRITE, collectionName);
      } else {
        console.error(`Error in batch saving to ${collectionName}:`, e);
      }
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
    const cachedItems = await readCollectionCache<{ id: string }>(storageKey);
    if (cachedItems) {
      const filtered = cachedItems.filter((item) => item.id !== id);
      await writeCollectionCache(storageKey, filtered);
    }
  } catch {
    // ignore local cache update errors
  }

  try {
    await deleteDoc(doc(db, collectionName, id));
  } catch (error) {
    if (isPermissionDeniedError(error)) {
      logFirestorePermissionError(
        error,
        FirestoreOperationType.DELETE,
        `${collectionName}/${id}`
      );
    } else {
      console.error(`Error deleting from ${collectionName}:`, error);
    }
  }
}
