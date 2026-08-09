import { createWorker, type Worker } from 'tesseract.js';
import type * as pdfjsLib from 'pdfjs-dist';
import type { ExtractedWord } from '../../types/word';
import type { OcrBlock } from './ocrTypes';
import { wordsFromBlocks } from './wordsFromBlocks';
import { readCachedPage, writeCachedPage } from './ocrCache';
import { DETECTION_LANGS } from './tesseractLang';

/**
 * Tesseract is trained on roughly 300 DPI input. Recognising the page at the
 * display scale (~110 DPI) drops accuracy sharply, so OCR always gets its own
 * high-resolution render, independent of the zoom level on screen.
 */
const OCR_DPI = 300;

/** Ceiling on the OCR canvas, so an unusually large page can't exhaust memory. */
const MAX_OCR_PIXELS = 12_000_000;

const PAGE_TIMEOUT_MS = 120_000;

/**
 * Rasterising a page must not be able to hang the page forever.
 *
 * pdf.js drives rendering off requestAnimationFrame, which a browser freezes in
 * a backgrounded or non-compositing tab — the render promise then simply never
 * settles. Cancelling turns that into an error the reader can retry.
 */
const RENDER_TIMEOUT_MS = 45_000;

/** How many read-ahead pages may sit in the queue before the furthest are dropped. */
const MAX_QUEUED_PREFETCH = 6;

export const PRIORITY_VISIBLE = 0;
export const PRIORITY_PREFETCH = 1;

// ── Engine status (drives the "downloading model" message) ──────────────

export type EngineStatus =
  | { phase: 'idle' }
  | { phase: 'loading'; progress: number }
  | { phase: 'ready' }
  | { phase: 'error'; message: string };

let engineStatus: EngineStatus = { phase: 'idle' };
const statusListeners = new Set<(s: EngineStatus) => void>();

function setStatus(next: EngineStatus): void {
  engineStatus = next;
  for (const listener of statusListeners) listener(next);
}

export function getEngineStatus(): EngineStatus {
  return engineStatus;
}

export function subscribeEngineStatus(listener: (s: EngineStatus) => void): () => void {
  statusListeners.add(listener);
  return () => statusListeners.delete(listener);
}

// ── Worker lifecycle ────────────────────────────────────────────────────

let workerPromise: Promise<Worker> | null = null;
let workerLang = '';

async function createOcrWorker(lang: string): Promise<Worker> {
  setStatus({ phase: 'loading', progress: 0 });

  const worker = await createWorker(lang, 1, {
    logger: (m) => {
      // Everything before recognition is model download and engine startup —
      // that's the wait worth showing, since it only happens once.
      if (m.status !== 'recognizing text') {
        setStatus({ phase: 'loading', progress: m.progress ?? 0 });
      }
    },
  });

  // Tesseract's own DPI heuristics misfire on rendered pages; we know the
  // exact resolution we rendered at, so tell it.
  await worker.setParameters({ user_defined_dpi: String(OCR_DPI) });

  workerLang = lang;
  setStatus({ phase: 'ready' });
  return worker;
}

async function getWorker(lang: string): Promise<Worker> {
  if (!workerPromise) {
    workerPromise = createOcrWorker(lang).catch((err) => {
      workerPromise = null;
      const message = err instanceof Error ? err.message : 'Could not start text recognition';
      setStatus({ phase: 'error', message });
      throw err;
    });
    return workerPromise;
  }

  const worker = await workerPromise;
  if (workerLang !== lang) {
    setStatus({ phase: 'loading', progress: 0 });
    await worker.reinitialize(lang);
    workerLang = lang;
    setStatus({ phase: 'ready' });
  }
  return worker;
}

/** Tear the worker down after a hang, so the next page starts from a clean engine. */
async function resetWorker(): Promise<void> {
  const current = workerPromise;
  workerPromise = null;
  workerLang = '';
  setStatus({ phase: 'idle' });
  try {
    const worker = await current;
    await worker?.terminate();
  } catch { /* already broken — nothing to salvage */ }
}

export async function terminateOcr(): Promise<void> {
  await resetWorker();
}

// ── Rendering a page for OCR ────────────────────────────────────────────

async function renderForOcr(
  page: pdfjsLib.PDFPageProxy,
): Promise<{ blob: Blob; ocrScale: number }> {
  const base = page.getViewport({ scale: 1 });

  let ocrScale = OCR_DPI / 72;
  const pixels = base.width * base.height * ocrScale * ocrScale;
  if (pixels > MAX_OCR_PIXELS) {
    ocrScale *= Math.sqrt(MAX_OCR_PIXELS / pixels);
  }

  const viewport = page.getViewport({ scale: ocrScale });
  const canvas = document.createElement('canvas');
  canvas.width = Math.floor(viewport.width);
  canvas.height = Math.floor(viewport.height);

  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Could not create a canvas for text recognition');

  const renderTask = page.render({ canvasContext: ctx, viewport });
  const stall = setTimeout(() => renderTask.cancel(), RENDER_TIMEOUT_MS);

  try {
    await renderTask.promise;
    const blob = await new Promise<Blob | null>((resolve) =>
      // The source pages are already JPEG scans, so re-encoding at high quality
      // costs no meaningful accuracy and is far faster than PNG.
      canvas.toBlob(resolve, 'image/jpeg', 0.95),
    );
    if (!blob) throw new Error('Could not encode the page for text recognition');
    return { blob, ocrScale };
  } finally {
    clearTimeout(stall);
    // A 2300x3400 canvas is ~31 MB; release it immediately rather than waiting
    // for the collector to notice.
    canvas.width = 0;
    canvas.height = 0;
  }
}

function withTimeout<T>(promise: Promise<T>, ms: number, message: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(message)), ms);
    promise.then(
      (value) => { clearTimeout(timer); resolve(value); },
      (err) => { clearTimeout(timer); reject(err); },
    );
  });
}

// ── Priority queue (one page at a time) ─────────────────────────────────

interface Waiter {
  resolve: (words: ExtractedWord[]) => void;
  reject: (err: unknown) => void;
}

interface Job {
  key: string;
  pageNumber: number;
  priority: number;
  run: () => Promise<ExtractedWord[]>;
  waiters: Waiter[];
}

const queue = new Map<string, Job>();
let activeJob = false;

class PrefetchCancelled extends Error {
  constructor() {
    super('Read-ahead cancelled');
    this.name = 'PrefetchCancelled';
  }
}

function pickNext(): Job | null {
  let best: Job | null = null;
  for (const job of queue.values()) {
    if (!best) { best = job; continue; }
    if (job.priority < best.priority) { best = job; continue; }
    if (job.priority === best.priority && job.pageNumber < best.pageNumber) best = job;
  }
  return best;
}

/**
 * Keep the read-ahead backlog bounded.
 *
 * Scrolling through a long book can queue read-ahead faster than it drains;
 * without this, pages the reader has long since passed would still be holding
 * up the page actually on screen.
 */
function trimPrefetch(): void {
  const prefetches = [...queue.values()].filter((j) => j.priority > PRIORITY_VISIBLE);
  if (prefetches.length <= MAX_QUEUED_PREFETCH) return;

  prefetches.sort((a, b) => a.pageNumber - b.pageNumber);
  for (const job of prefetches.slice(0, prefetches.length - MAX_QUEUED_PREFETCH)) {
    queue.delete(job.key);
    for (const waiter of job.waiters) waiter.reject(new PrefetchCancelled());
  }
}

async function pump(): Promise<void> {
  if (activeJob) return;
  const job = pickNext();
  if (!job) return;

  activeJob = true;
  queue.delete(job.key);

  try {
    const words = await job.run();
    for (const waiter of job.waiters) waiter.resolve(words);
  } catch (err) {
    for (const waiter of job.waiters) waiter.reject(err);
  } finally {
    activeJob = false;
    void pump();
  }
}

function schedule(
  key: string,
  pageNumber: number,
  priority: number,
  run: () => Promise<ExtractedWord[]>,
): Promise<ExtractedWord[]> {
  const existing = queue.get(key);
  if (existing) {
    // The reader has caught up with a page we were only reading ahead for.
    existing.priority = Math.min(existing.priority, priority);
    return new Promise((resolve, reject) => existing.waiters.push({ resolve, reject }));
  }

  const job: Job = { key, pageNumber, priority, run, waiters: [] };
  queue.set(key, job);
  const promise = new Promise<ExtractedWord[]>((resolve, reject) =>
    job.waiters.push({ resolve, reject }),
  );

  trimPrefetch();
  void pump();
  return promise;
}

// ── Public API ──────────────────────────────────────────────────────────

export interface RecognizePageOptions {
  page: pdfjsLib.PDFPageProxy;
  docId: string;
  pageNumber: number;
  /** Tesseract model name, e.g. "deu". */
  lang: string;
  priority?: number;
}

/**
 * Recognise one page, returning hoverable words in unscaled PDF units.
 *
 * Cached results short-circuit the queue entirely, so revisiting a page — or
 * reopening the book tomorrow — is instant.
 */
export async function recognizePage({
  page,
  docId,
  pageNumber,
  lang,
  priority = PRIORITY_VISIBLE,
}: RecognizePageOptions): Promise<ExtractedWord[]> {
  const cached = await readCachedPage(docId, pageNumber, lang);
  if (cached) return cached;

  const key = `${docId}|p${pageNumber}|${lang}`;

  return schedule(key, pageNumber, priority, async () => {
    // Another request may have finished this page while we sat in the queue.
    const raced = await readCachedPage(docId, pageNumber, lang);
    if (raced) return raced;

    const worker = await getWorker(lang);
    const { blob, ocrScale } = await renderForOcr(page);

    let blocks: OcrBlock[];
    try {
      const result = await withTimeout(
        worker.recognize(blob, {}, { blocks: true, text: false, hocr: false, tsv: false }),
        PAGE_TIMEOUT_MS,
        'Text recognition timed out on this page',
      );
      blocks = (result.data.blocks ?? []) as unknown as OcrBlock[];
    } catch (err) {
      // A timeout leaves the engine mid-job; only a fresh worker is trustworthy.
      await resetWorker();
      throw err;
    }

    const words = wordsFromBlocks(blocks, { ocrScale });
    await writeCachedPage(docId, pageNumber, lang, words);
    return words;
  });
}

/**
 * Warm the cache for pages the reader is about to reach.
 *
 * Failures are deliberately swallowed: this is speculative work, and the page
 * will simply recognise on demand if the read-ahead didn't get there first.
 */
export function prefetchPages(
  doc: pdfjsLib.PDFDocumentProxy,
  docId: string,
  pageNumbers: number[],
  lang: string,
): void {
  for (const pageNumber of pageNumbers) {
    if (pageNumber < 1 || pageNumber > doc.numPages) continue;
    void (async () => {
      try {
        const page = await doc.getPage(pageNumber);
        await recognizePage({ page, docId, pageNumber, lang, priority: PRIORITY_PREFETCH });
      } catch { /* speculative — never surfaced */ }
    })();
  }
}

/**
 * Recognise page text purely to work out what language the book is in.
 *
 * A scan has no text layer, so the usual detection has nothing to read. This
 * runs one page through a combined German/English model and hands the text to
 * the normal detector.
 */
export async function recognizeTextForDetection(page: pdfjsLib.PDFPageProxy): Promise<string> {
  const worker = await getWorker(DETECTION_LANGS);
  const { blob } = await renderForOcr(page);

  try {
    const result = await withTimeout(
      worker.recognize(blob, {}, { blocks: false, text: true, hocr: false, tsv: false }),
      PAGE_TIMEOUT_MS,
      'Text recognition timed out while detecting the language',
    );
    return result.data.text ?? '';
  } catch (err) {
    await resetWorker();
    throw err;
  }
}
