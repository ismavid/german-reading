import { create } from 'zustand';
import type * as pdfjsLib from 'pdfjs-dist';
import type { SourceLanguage, TargetLanguage } from '../types/word';

interface PdfState {
  document: pdfjsLib.PDFDocumentProxy | null;
  fileName: string;
  numPages: number;
  scale: number;
  sourceLanguage: SourceLanguage;
  targetLanguage: TargetLanguage;
  setDocument: (doc: pdfjsLib.PDFDocumentProxy, name: string) => void;
  setScale: (scale: number) => void;
  setSourceLanguage: (lang: SourceLanguage) => void;
  setTargetLanguage: (lang: TargetLanguage) => void;
  reset: () => void;
}

function loadTargetLanguage(): TargetLanguage {
  try {
    const saved = localStorage.getItem('lesehelfer-target-lang');
    if (saved === 'en' || saved === 'es') return saved;
  } catch { /* ignore */ }
  return 'en';
}

export const usePdfStore = create<PdfState>()((set) => ({
  document: null,
  fileName: '',
  numPages: 0,
  scale: 1.5,
  sourceLanguage: 'en',
  targetLanguage: loadTargetLanguage(),

  setDocument: (doc, name) =>
    set({ document: doc, fileName: name, numPages: doc.numPages }),

  setScale: (scale) => set({ scale }),

  setSourceLanguage: (sourceLanguage) => set({ sourceLanguage }),

  setTargetLanguage: (targetLanguage) => {
    try { localStorage.setItem('lesehelfer-target-lang', targetLanguage); } catch { /* ignore */ }
    set({ targetLanguage });
  },

  reset: () => set({ document: null, fileName: '', numPages: 0, sourceLanguage: 'en' }),
}));
