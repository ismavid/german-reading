import type { ExtractedWord } from '../../types/word';
import { OCR_STORE, isQuotaError, toPromise, withStore } from '../db';

/**
 * Bumping this invalidates every cached page. Change it whenever the shape of
 * a stored record or the geometry/hyphenation logic changes, so stale results
 * from an older algorithm are never mixed with new ones.
 */
const SCHEMA_VERSION = 1;

export interface OcrCacheRecord {
  key: string;
  docId: string;
  page: number;
  words: ExtractedWord[];
  createdAt: number;
}

/**
 * Identify a document without hashing 191 MB of bytes.
 *
 * Name, size and page count together are specific enough in practice — two
 * different books colliding on all three is not a realistic failure, and the
 * cost of being wrong is one page of stale boxes.
 */
export function makeDocId(fileName: string, fileSize: number, pageCount: number): string {
  return `${fileName}|${fileSize}|${pageCount}`;
}

export function makeCacheKey(docId: string, page: number, lang: string): string {
  return `${docId}|p${page}|${lang}|v${SCHEMA_VERSION}`;
}

export async function readCachedPage(
  docId: string,
  page: number,
  lang: string,
): Promise<ExtractedWord[] | null> {
  try {
    const key = makeCacheKey(docId, page, lang);
    const record = await withStore(OCR_STORE, 'readonly', (store) =>
      toPromise<OcrCacheRecord | undefined>(store.get(key)),
    );
    return record?.words ?? null;
  } catch {
    // A cache miss and a broken cache should behave the same: just re-run OCR.
    return null;
  }
}

export async function writeCachedPage(
  docId: string,
  page: number,
  lang: string,
  words: ExtractedWord[],
): Promise<void> {
  const record: OcrCacheRecord = {
    key: makeCacheKey(docId, page, lang),
    docId,
    page,
    words,
    createdAt: Date.now(),
  };

  try {
    await withStore(OCR_STORE, 'readwrite', (store) => toPromise(store.put(record)));
  } catch (err) {
    if (isQuotaError(err)) {
      // Recognised text is worth keeping, but never at the cost of breaking the
      // app. Drop the oldest documents' pages and try once more.
      await evictOldest();
      try {
        await withStore(OCR_STORE, 'readwrite', (store) => toPromise(store.put(record)));
      } catch { /* give up — the page still works, it just re-OCRs next time */ }
    }
  }
}

/** Remove every cached page belonging to one document. */
export async function clearDocument(docId: string): Promise<void> {
  try {
    await withStore(OCR_STORE, 'readwrite', async (store) => {
      const keys = await toPromise<IDBValidKey[]>(store.index('docId').getAllKeys(docId));
      for (const key of keys) store.delete(key);
    });
  } catch { /* ignore */ }
}

/** Drop the oldest quarter of cached pages to make room. */
async function evictOldest(): Promise<void> {
  try {
    await withStore(OCR_STORE, 'readwrite', async (store) => {
      const all = await toPromise<OcrCacheRecord[]>(store.getAll());
      all.sort((a, b) => a.createdAt - b.createdAt);
      for (const record of all.slice(0, Math.ceil(all.length / 4))) {
        store.delete(record.key);
      }
    });
  } catch { /* ignore */ }
}
