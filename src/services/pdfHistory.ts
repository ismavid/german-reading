export interface PdfHistoryEntry {
  id: string;
  fileName: string;
  data: ArrayBuffer;
  lastOpened: number;
  pageCount: number;
}

const DB_NAME = 'lesehelfer';
const STORE_NAME = 'pdfs';
const MAX_ENTRIES = 10;

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' });
        store.createIndex('lastOpened', 'lastOpened');
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function tx(db: IDBDatabase, mode: IDBTransactionMode): IDBObjectStore {
  return db.transaction(STORE_NAME, mode).objectStore(STORE_NAME);
}

export async function savePdf(fileName: string, data: ArrayBuffer, pageCount: number): Promise<void> {
  const db = await openDB();
  const id = fileName; // use filename as unique key (overwrite if same name)
  const entry: PdfHistoryEntry = { id, fileName, data, lastOpened: Date.now(), pageCount };

  await new Promise<void>((resolve, reject) => {
    const req = tx(db, 'readwrite').put(entry);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });

  // Prune old entries beyond MAX_ENTRIES
  const all = await getRecentPdfs();
  if (all.length > MAX_ENTRIES) {
    const toRemove = all.slice(MAX_ENTRIES);
    const store = tx(db, 'readwrite');
    for (const e of toRemove) {
      store.delete(e.id);
    }
  }

  db.close();
}

export interface PdfHistoryMeta {
  id: string;
  fileName: string;
  lastOpened: number;
  pageCount: number;
}

export async function getRecentPdfs(): Promise<PdfHistoryMeta[]> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const store = tx(db, 'readonly');
    const req = store.index('lastOpened').openCursor(null, 'prev');
    const results: PdfHistoryMeta[] = [];

    req.onsuccess = () => {
      const cursor = req.result;
      if (cursor && results.length < MAX_ENTRIES) {
        const val = cursor.value as PdfHistoryEntry;
        results.push({
          id: val.id,
          fileName: val.fileName,
          lastOpened: val.lastOpened,
          pageCount: val.pageCount,
        });
        cursor.continue();
      } else {
        db.close();
        resolve(results);
      }
    };
    req.onerror = () => { db.close(); reject(req.error); };
  });
}

export async function loadPdfData(id: string): Promise<ArrayBuffer | null> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const req = tx(db, 'readonly').get(id);
    req.onsuccess = () => {
      db.close();
      const entry = req.result as PdfHistoryEntry | undefined;
      resolve(entry?.data ?? null);
    };
    req.onerror = () => { db.close(); reject(req.error); };
  });
}

export async function removePdf(id: string): Promise<void> {
  const db = await openDB();
  await new Promise<void>((resolve, reject) => {
    const req = tx(db, 'readwrite').delete(id);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
  db.close();
}
