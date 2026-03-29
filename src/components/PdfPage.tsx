import { useEffect, useRef, useState, useCallback } from 'react';
import type * as pdfjsLib from 'pdfjs-dist';
import { extractWordsFromPage, type ExtractedWord } from '../services/pdfLoader';
import { useLibraryStore } from '../store/libraryStore';
import { usePdfStore } from '../store/pdfStore';
import { WordTooltip } from './WordTooltip';

interface Props {
  document: pdfjsLib.PDFDocumentProxy;
  pageNumber: number;
  scale: number;
}

export function PdfPage({ document, pageNumber, scale }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [words, setWords] = useState<ExtractedWord[]>([]);
  const [size, setSize] = useState({ width: 0, height: 0 });
  const [hoveredWord, setHoveredWord] = useState<string | null>(null);
  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);
  const hasWord = useLibraryStore((s) => s.hasWord);
  const sourceLanguage = usePdfStore((s) => s.sourceLanguage);
  const targetLanguage = usePdfStore((s) => s.targetLanguage);
  const renderTaskRef = useRef<ReturnType<pdfjsLib.PDFPageProxy['render']> | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function renderPage() {
      const page = await document.getPage(pageNumber);
      if (cancelled) return;

      const viewport = page.getViewport({ scale });
      setSize({ width: viewport.width, height: viewport.height });

      const canvas = canvasRef.current;
      if (!canvas) return;

      canvas.width = viewport.width;
      canvas.height = viewport.height;

      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      if (renderTaskRef.current) {
        renderTaskRef.current.cancel();
      }

      const renderTask = page.render({ canvasContext: ctx, viewport });
      renderTaskRef.current = renderTask;

      try {
        await renderTask.promise;
      } catch (e: unknown) {
        if (e instanceof Error && e.message?.includes('Rendering cancelled')) return;
      }

      if (cancelled) return;

      const extracted = await extractWordsFromPage(page, scale);
      if (!cancelled) setWords(extracted);
    }

    renderPage();
    return () => { cancelled = true; };
  }, [document, pageNumber, scale]);

  const onWordEnter = useCallback((word: string, el: HTMLElement) => {
    setHoveredWord(word);
    setAnchorEl(el);
  }, []);

  const onCloseTooltip = useCallback(() => {
    setHoveredWord(null);
    setAnchorEl(null);
  }, []);

  return (
    <div
      className="pdf-page-container relative bg-white mb-6 mx-auto"
      style={{ width: size.width, height: size.height }}
    >
      <canvas ref={canvasRef} className="block" />

      <div className="absolute inset-0" style={{ pointerEvents: 'none' }}>
        {words.map((w, i) => (
          <span
            key={`${w.word}-${i}`}
            className={`word-span ${hasWord(w.word) ? 'saved' : ''}`}
            style={{
              left: w.x,
              top: w.y,
              width: w.width,
              height: w.height,
              pointerEvents: 'auto',
            }}
            onMouseEnter={(e) => onWordEnter(w.word, e.currentTarget)}
          />
        ))}
      </div>

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
