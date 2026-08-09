import type { ExtractedWord } from '../../types/word';
import type { OcrBlock, OcrLine, OcrWord } from './ocrTypes';

/** Words below this Tesseract confidence are dropped rather than shown as hover targets. */
export const MIN_CONFIDENCE = 60;

/**
 * Confidence at or above which we trust Tesseract's reading of a word's case.
 *
 * A capital letter normally means a new word rather than the continuation of a
 * hyphenated one ("Kino-" / "Events"). But in regions overlapping photos the
 * engine mis-cases confident-looking words, so below this threshold the casing
 * is not evidence of anything.
 */
const CASE_TRUST_CONFIDENCE = 75;

/** Hyphen-like characters that can end a line in justified print. */
const TRAILING_HYPHEN = /[-‐‑­]$/;

/** Strip leading/trailing punctuation, matching the text-layer path in pdfLoader. */
export function cleanToken(token: string): string {
  return token.replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, '');
}

/**
 * True when `text` ends in a hyphen preceded by a letter — i.e. it looks like
 * the first half of a word broken across a line break, not a dash or a bullet.
 */
export function endsWithSoftHyphen(text: string): boolean {
  const trimmed = text.trim();
  if (!TRAILING_HYPHEN.test(trimmed)) return false;
  const beforeHyphen = trimmed.slice(0, -1);
  return /\p{L}$/u.test(beforeHyphen);
}

/**
 * Join a word broken across a line break.
 *
 * Coursebooks are set densely and hyphenate constantly ("Fernseh-" / "macher").
 * Looking up either half returns nonsense, so both halves resolve to the whole
 * word instead. Returns null when the pair doesn't look like a real break.
 */
export function joinHyphenated(
  left: string,
  right: string,
  rightConfidence = 100,
): string | null {
  if (!endsWithSoftHyphen(left)) return null;
  const head = cleanToken(left.trim().slice(0, -1));
  const tail = cleanToken(right);
  if (!head || !tail) return null;

  if (/^\p{Ll}/u.test(tail)) return head + tail;

  // An uppercase continuation normally means the hyphen was a real one, as in
  // "Kino-" / "Events" — but only if we can believe the case. When confidence
  // is low the capital is usually the engine's error, not the page's.
  if (rightConfidence >= CASE_TRUST_CONFIDENCE) return null;
  return head + tail.charAt(0).toLowerCase() + tail.slice(1);
}

/**
 * Junk that sits between real words on a line.
 *
 * Tesseract merges a text column with whatever shares its horizontal band, so a
 * line can begin with margin line-numbers or fragments of an adjacent photo.
 * Those tokens must be stepped over when looking for a hyphen continuation.
 */
function isNoise(word: OcrWord, minConfidence: number): boolean {
  const cleaned = cleanToken(word.text);
  if (!cleaned) return true;
  if (word.confidence < minConfidence) return true;
  // Line numbers down the margin of an exercise box.
  if (/^\d+$/.test(cleaned)) return true;
  return false;
}

function firstMeaningful(words: OcrWord[], minConfidence: number): OcrWord | null {
  return words.find((w) => !isNoise(w, minConfidence)) ?? null;
}

function lastMeaningful(words: OcrWord[], minConfidence: number): OcrWord | null {
  for (let i = words.length - 1; i >= 0; i--) {
    if (!isNoise(words[i], minConfidence)) return words[i];
  }
  return null;
}

function flattenLines(blocks: OcrBlock[]): OcrLine[] {
  const lines: OcrLine[] = [];
  for (const block of blocks ?? []) {
    for (const para of block.paragraphs ?? []) {
      for (const line of para.lines ?? []) {
        if (line.words?.length) lines.push(line);
      }
    }
  }
  return lines;
}

/**
 * Resolve the lookup term for every OCR word, applying hyphen joins across
 * consecutive lines. Returns a map keyed by word identity.
 */
function resolveLookups(lines: OcrLine[], minConfidence: number): Map<OcrWord, string> {
  const lookups = new Map<OcrWord, string>();

  for (const line of lines) {
    for (const word of line.words) {
      lookups.set(word, cleanToken(word.text));
    }
  }

  for (let i = 0; i < lines.length - 1; i++) {
    const last = lastMeaningful(lines[i].words, minConfidence);
    const first = firstMeaningful(lines[i + 1].words, minConfidence);
    if (!last || !first) continue;

    const joined = joinHyphenated(last.text, first.text, first.confidence);
    if (joined) {
      // Both halves stay individually hoverable, but both resolve to the whole word.
      lookups.set(last, joined);
      lookups.set(first, joined);
    }
  }

  return lookups;
}

export interface WordsFromBlocksOptions {
  /** Pixels-per-PDF-unit the page was rendered at for OCR. */
  ocrScale: number;
  minConfidence?: number;
}

/**
 * Convert a Tesseract block tree into hoverable words in unscaled PDF units.
 *
 * Tesseract reports boxes in pixels of the image it was given, which we render
 * at a much higher scale than the display uses. Dividing by that scale puts the
 * result in the same coordinate space as the text-layer path, so the renderer
 * treats both identically.
 */
export function wordsFromBlocks(
  blocks: OcrBlock[] | null | undefined,
  { ocrScale, minConfidence = MIN_CONFIDENCE }: WordsFromBlocksOptions,
): ExtractedWord[] {
  if (!blocks?.length || ocrScale <= 0) return [];

  const lines = flattenLines(blocks);
  const lookups = resolveLookups(lines, minConfidence);
  const words: ExtractedWord[] = [];

  for (const line of lines) {
    for (const word of line.words) {
      if (word.confidence < minConfidence) continue;

      const lookup = lookups.get(word);
      if (!lookup) continue;

      const { x0, y0, x1, y1 } = word.bbox;
      const width = (x1 - x0) / ocrScale;
      const height = (y1 - y0) / ocrScale;
      if (width <= 0 || height <= 0) continue;

      words.push({
        word: lookup,
        x: x0 / ocrScale,
        y: y0 / ocrScale,
        width,
        height,
        confidence: word.confidence,
      });
    }
  }

  return words;
}
