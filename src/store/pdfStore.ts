import { create } from 'zustand';
import type * as pdfjsLib from 'pdfjs-dist';
import type { Language } from '../types/word';

interface PdfState {
  document: pdfjsLib.PDFDocumentProxy | null;
  fileName: string;
  numPages: number;
  scale: number;
  language: Language;
  setDocument: (doc: pdfjsLib.PDFDocumentProxy, name: string) => void;
  setScale: (scale: number) => void;
  setLanguage: (lang: Language) => void;
  reset: () => void;
}

export const usePdfStore = create<PdfState>()((set) => ({
  document: null,
  fileName: '',
  numPages: 0,
  scale: 1.5,
  language: 'de',

  setDocument: (doc, name) =>
    set({ document: doc, fileName: name, numPages: doc.numPages }),

  setScale: (scale) => set({ scale }),

  setLanguage: (language) => set({ language }),

  reset: () => set({ document: null, fileName: '', numPages: 0, language: 'de' }),
}));
