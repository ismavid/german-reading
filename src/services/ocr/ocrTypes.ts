/**
 * Minimal structural mirrors of the Tesseract result hierarchy.
 *
 * Declared locally rather than imported from tesseract.js so the pure geometry
 * and hyphenation logic can be unit tested without pulling in the WASM engine.
 * These are structurally compatible with Tesseract's own types.
 */

export interface OcrBbox {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

export interface OcrWord {
  text: string;
  confidence: number;
  bbox: OcrBbox;
}

export interface OcrLine {
  words: OcrWord[];
}

export interface OcrParagraph {
  lines: OcrLine[];
}

export interface OcrBlock {
  paragraphs: OcrParagraph[];
}

/** Status of OCR for a single page, as far as the UI is concerned. */
export type OcrPageStatus = 'idle' | 'queued' | 'running' | 'done' | 'failed';
