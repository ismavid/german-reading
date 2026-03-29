import { create } from 'zustand';
import type * as pdfjsLib from 'pdfjs-dist';

interface PdfState {
  document: pdfjsLib.PDFDocumentProxy | null;
  fileName: string;
  numPages: number;
  scale: number;
  setDocument: (doc: pdfjsLib.PDFDocumentProxy, name: string) => void;
  setScale: (scale: number) => void;
  reset: () => void;
}

export const usePdfStore = create<PdfState>()((set) => ({
  document: null,
  fileName: '',
  numPages: 0,
  scale: 1.5,

  setDocument: (doc, name) =>
    set({ document: doc, fileName: name, numPages: doc.numPages }),

  setScale: (scale) => set({ scale }),

  reset: () => set({ document: null, fileName: '', numPages: 0 }),
}));
