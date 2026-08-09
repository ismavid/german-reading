import { PDF_STORE, isQuotaError, toPromise, withStore } from './db';

/**
 * Largest PDF whose bytes we keep in IndexedDB.
 *
 * A scanned coursebook can run to hundreds of megabytes. Storing one costs a
 * long freeze while the buffer is cloned and risks blowing the origin's quota,
 * so past this size we remember the document but not its contents: it stays in
 * the recent list and its OCR cache survives, and reopening asks for the file
 * again. That is a far better trade than a browser that can't store anything.
 */
export const MAX_STORED_BYTES = 75 * 1024 * 1024;

const MAX_ENTRIES = 10;

export interface PdfHistoryEntry {
  id: string;
  fileName: string;
  /** Absent when the file was too large to keep — see MAX_STORED_BYTES. */
  data?: ArrayBuffer;
  fileSize: number;
  lastOpened: number;
  pageCount: number;
}

export interface PdfHistoryMeta {
  id: string;
  fileName: string;
  fileSize: number;
  lastOpened: number;
  pageCount: number;
  /** False when only metadata was stored and the file must be re-picked from disk. */
  hasData: boolean;
}

export async function savePdf(
  fileName: string,
  data: ArrayBuffer,
  pageCount: number,
): Promise<void> {
  const fileSize = data.byteLength;
  const base: PdfHistoryEntry = {
    id: fileName,
    fileName,
    fileSize,
    lastOpened: Date.now(),
    pageCount,
  };

  const entry: PdfHistoryEntry =
    fileSize <= MAX_STORED_BYTES ? { ...base, data } : base;

  try {
    await put(entry);
  } catch (err) {
    if (!isQuotaError(err)) return;
    // Make room and try once more; if the bytes still don't fit, keep the
    // metadata so the document at least stays in the recent list.
    await pruneTo(Math.floor(MAX_ENTRIES / 2));
    try {
      await put(entry);
    } catch {
      try { await put(base); } catch { /* history is a convenience, not a requirement */ }
    }
  }

  await pruneTo(MAX_ENTRIES);
}

function put(entry: PdfHistoryEntry): Promise<IDBValidKey> {
  return withStore(PDF_STORE, 'readwrite', (store) => toPromise(store.put(entry)));
}

export async function getRecentPdfs(): Promise<PdfHistoryMeta[]> {
  try {
    const entries = await withStore(PDF_STORE, 'readonly', (store) =>
      toPromise<PdfHistoryEntry[]>(store.getAll()),
    );

    return entries
      .sort((a, b) => b.lastOpened - a.lastOpened)
      .slice(0, MAX_ENTRIES)
      .map((entry) => ({
        id: entry.id,
        fileName: entry.fileName,
        fileSize: entry.fileSize ?? 0,
        lastOpened: entry.lastOpened,
        pageCount: entry.pageCount,
        hasData: !!entry.data,
      }));
  } catch {
    return [];
  }
}

export async function loadPdfData(id: string): Promise<ArrayBuffer | null> {
  try {
    const entry = await withStore(PDF_STORE, 'readonly', (store) =>
      toPromise<PdfHistoryEntry | undefined>(store.get(id)),
    );
    return entry?.data ?? null;
  } catch {
    return null;
  }
}

export async function removePdf(id: string): Promise<void> {
  try {
    await withStore(PDF_STORE, 'readwrite', (store) => toPromise(store.delete(id)));
  } catch { /* ignore */ }
}

/** Drop the least recently opened entries beyond `keep`. */
async function pruneTo(keep: number): Promise<void> {
  try {
    await withStore(PDF_STORE, 'readwrite', async (store) => {
      const entries = await toPromise<PdfHistoryEntry[]>(store.getAll());
      entries.sort((a, b) => b.lastOpened - a.lastOpened);
      for (const entry of entries.slice(keep)) store.delete(entry.id);
    });
  } catch { /* ignore */ }
}
