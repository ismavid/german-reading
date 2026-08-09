import { useEffect, useRef, useState, useCallback } from 'react';
import type * as pdfjsLib from 'pdfjs-dist';
import { extractWordsFromPage } from '../services/pdfLoader';
import type { ExtractedWord } from '../types/word';
import { useLibraryStore } from '../store/libraryStore';
import { usePdfStore } from '../store/pdfStore';
import { toTesseractLang } from '../services/ocr/tesseractLang';
import {
  PRIORITY_VISIBLE,
  prefetchPages,
  recognizePage,
  subscribeEngineStatus,
  getEngineStatus,
  type EngineStatus,
} from '../services/ocr/ocrService';
import { WordTooltip } from './WordTooltip';

interface Props {
  document: pdfjsLib.PDFDocumentProxy;
  pageNumber: number;
  scale: number;
  /** Page size in PDF units, used to reserve space before the page renders. */
  defaultSize: { width: number; height: number };
}

/** How far outside the viewport a page starts rendering, as a fraction of viewport height. */
const RENDER_MARGIN = '150%';

/** Pages to recognise ahead of the one being read. */
const READ_AHEAD = 3;

/** Below this many text-layer words, a page is treated as needing OCR. */
const TEXT_LAYER_MIN_WORDS = 3;

type WordsState =
  | { status: 'pending' }
  | { status: 'recognizing' }
  | { status: 'ready'; words: ExtractedWord[]; fromOcr: boolean }
  | { status: 'failed'; message: string };

export function PdfPage({ document: doc, pageNumber, scale, defaultSize }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const renderTaskRef = useRef<ReturnType<pdfjsLib.PDFPageProxy['render']> | null>(null);

  const [pageSize, setPageSize] = useState(defaultSize);
  const [isNear, setIsNear] = useState(false);
  const [isVisible, setIsVisible] = useState(false);
  const [wordsState, setWordsState] = useState<WordsState>({ status: 'pending' });
  const [engineStatus, setEngineStatus] = useState<EngineStatus>(getEngineStatus);
  const [retryToken, setRetryToken] = useState(0);

  const [hoveredWord, setHoveredWord] = useState<string | null>(null);
  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);

  const hasWord = useLibraryStore((s) => s.hasWord);
  const sourceLanguage = usePdfStore((s) => s.sourceLanguage);
  const targetLanguage = usePdfStore((s) => s.targetLanguage);
  const isScanned = usePdfStore((s) => s.isScanned);
  const docId = usePdfStore((s) => s.docId);

  const ocrLang = toTesseractLang(sourceLanguage);

  // ── Only do work for pages at or near the viewport ────────────────────
  // A 234-page book mounts 234 of these. Rendering them all would cost close
  // to a gigabyte of canvas and queue every page for OCR at once.
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const nearObserver = new IntersectionObserver(
      ([entry]) => setIsNear(entry.isIntersecting),
      { rootMargin: RENDER_MARGIN },
    );
    const visibleObserver = new IntersectionObserver(
      ([entry]) => setIsVisible(entry.isIntersecting),
      { rootMargin: '0px' },
    );

    nearObserver.observe(el);
    visibleObserver.observe(el);
    return () => {
      nearObserver.disconnect();
      visibleObserver.disconnect();
    };
  }, []);

  useEffect(() => subscribeEngineStatus(setEngineStatus), []);

  // ── Render the page bitmap (re-runs on zoom) ──────────────────────────
  useEffect(() => {
    let cancelled = false;

    if (!isNear) {
      // Release the backing store of an off-screen page.
      const canvas = canvasRef.current;
      if (canvas) { canvas.width = 0; canvas.height = 0; }
      return;
    }

    (async () => {
      const page = await doc.getPage(pageNumber);
      if (cancelled) return;

      const viewport = page.getViewport({ scale });
      setPageSize({ width: viewport.width / scale, height: viewport.height / scale });

      const canvas = canvasRef.current;
      if (!canvas) return;
      canvas.width = viewport.width;
      canvas.height = viewport.height;

      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      renderTaskRef.current?.cancel();
      const renderTask = page.render({ canvasContext: ctx, viewport });
      renderTaskRef.current = renderTask;

      try {
        await renderTask.promise;
      } catch (e: unknown) {
        if (e instanceof Error && e.message?.includes('Rendering cancelled')) return;
      }
    })();

    return () => { cancelled = true; };
  }, [doc, pageNumber, scale, isNear]);

  // ── Resolve the hoverable words (independent of zoom) ─────────────────
  // Coordinates are in PDF units, so zooming never invalidates this — which
  // matters most for OCR, where redoing the work costs seconds.
  useEffect(() => {
    if (!isNear) return;
    let cancelled = false;

    (async () => {
      try {
        const page = await doc.getPage(pageNumber);
        if (cancelled) return;

        const textWords = await extractWordsFromPage(page);
        if (cancelled) return;

        if (textWords.length >= TEXT_LAYER_MIN_WORDS || !isScanned) {
          setWordsState({ status: 'ready', words: textWords, fromOcr: false });
          return;
        }

        setWordsState({ status: 'recognizing' });
        const ocrWords = await recognizePage({
          page,
          docId,
          pageNumber,
          lang: ocrLang,
          priority: PRIORITY_VISIBLE,
        });
        if (cancelled) return;
        setWordsState({ status: 'ready', words: ocrWords, fromOcr: true });
      } catch (err) {
        if (cancelled) return;
        setWordsState({
          status: 'failed',
          message: err instanceof Error ? err.message : 'Could not read this page',
        });
      }
    })();

    return () => { cancelled = true; };
  }, [doc, pageNumber, isNear, isScanned, docId, ocrLang, retryToken]);

  // ── Read ahead from whichever page is on screen ───────────────────────
  useEffect(() => {
    if (!isVisible || !isScanned || wordsState.status !== 'ready') return;
    const next = Array.from({ length: READ_AHEAD }, (_, i) => pageNumber + i + 1);
    prefetchPages(doc, docId, next, ocrLang);
  }, [isVisible, isScanned, wordsState.status, doc, docId, pageNumber, ocrLang]);

  const onWordEnter = useCallback((word: string, el: HTMLElement) => {
    setHoveredWord(word);
    setAnchorEl(el);
  }, []);

  const onCloseTooltip = useCallback(() => {
    setHoveredWord(null);
    setAnchorEl(null);
  }, []);

  const words = wordsState.status === 'ready' ? wordsState.words : [];
  const displayWidth = pageSize.width * scale;
  const displayHeight = pageSize.height * scale;

  return (
    <div
      ref={containerRef}
      className="pdf-page-container relative bg-white mb-6 mx-auto"
      style={{ width: displayWidth, height: displayHeight }}
    >
      <canvas ref={canvasRef} className="block" />

      <div className="absolute inset-0" style={{ pointerEvents: 'none' }}>
        {words.map((w, i) => (
          <span
            key={`${w.word}-${i}`}
            className={`word-span ${hasWord(w.word) ? 'saved' : ''}`}
            style={{
              left: w.x * scale,
              top: w.y * scale,
              width: Math.max(w.width * scale, 6),
              height: w.height * scale,
              pointerEvents: 'auto',
            }}
            onMouseEnter={(e) => onWordEnter(w.word, e.currentTarget)}
          />
        ))}
      </div>

      {wordsState.status === 'recognizing' && (
        <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex items-center gap-2 px-3 py-1.5 rounded-full bg-slate-900/80 text-white text-[11px] font-medium backdrop-blur-sm">
          <div className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
          {engineStatus.phase === 'loading'
            ? `Preparing text recognition… ${Math.round(engineStatus.progress * 100)}%`
            : 'Reading text on this page…'}
        </div>
      )}

      {wordsState.status === 'failed' && (
        <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex items-center gap-2 px-3 py-1.5 rounded-full bg-red-50 border border-red-100 text-red-600 text-[11px] font-medium">
          <span>{wordsState.message}</span>
          <button
            onClick={() => setRetryToken((t) => t + 1)}
            className="underline underline-offset-2 hover:text-red-700"
          >
            Retry
          </button>
        </div>
      )}

      <WordTooltip
        word={hoveredWord}
        anchorEl={anchorEl}
        onClose={onCloseTooltip}
        sourceLanguage={sourceLanguage}
        targetLanguage={targetLanguage}
      />
    </div>
  );
}
