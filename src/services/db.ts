/**
 * Single owner of the `lesehelfer` IndexedDB database.
 *
 * Both the PDF history and the OCR cache live here. They must agree on the
 * version and the upgrade path — if two modules opened the same database at
 * different versions, whichever opened second would block indefinitely.
 */

const DB_NAME = 'lesehelfer';
const DB_VERSION = 2;

export const PDF_STORE = 'pdfs';
export const OCR_STORE = 'ocr';

let dbPromise: Promise<IDBDatabase> | null = null;

function upgrade(db: IDBDatabase): void {
  if (!db.objectStoreNames.contains(PDF_STORE)) {
    const store = db.createObjectStore(PDF_STORE, { keyPath: 'id' });
    store.createIndex('lastOpened', 'lastOpened');
  }
  if (!db.objectStoreNames.contains(OCR_STORE)) {
    const store = db.createObjectStore(OCR_STORE, { keyPath: 'key' });
    // Lets us drop every cached page for one document in a single sweep.
    store.createIndex('docId', 'docId');
  }
}

export function openDB(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;

  dbPromise = new Promise<IDBDatabase>((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => upgrade(req.result);
    req.onsuccess = () => {
      const db = req.result;
      // Another tab wants to upgrade: let go so it isn't blocked forever.
      db.onversionchange = () => {
        db.close();
        dbPromise = null;
      };
      resolve(db);
    };
    req.onerror = () => reject(req.error);
  }).catch((err) => {
    dbPromise = null;
    throw err;
  });

  return dbPromise;
}

export function toPromise<T>(req: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export function txDone(tx: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error ?? new Error('Transaction aborted'));
  });
}

export async function withStore<T>(
  storeName: string,
  mode: IDBTransactionMode,
  fn: (store: IDBObjectStore) => Promise<T> | T,
): Promise<T> {
  const db = await openDB();
  const tx = db.transaction(storeName, mode);
  const result = await fn(tx.objectStore(storeName));
  if (mode !== 'readonly') await txDone(tx);
  return result;
}

/** True when a failed write was caused by the origin running out of storage. */
export function isQuotaError(err: unknown): boolean {
  return err instanceof DOMException &&
    (err.name === 'QuotaExceededError' || err.name === 'NS_ERROR_DOM_QUOTA_REACHED');
}
