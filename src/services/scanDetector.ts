import type * as pdfjsLib from 'pdfjs-dist';

/** How many pages to sample before deciding a document is scanned. */
const SAMPLE_PAGES = 5;

/**
 * Total characters across all sampled pages below which we treat a document as
 * scanned. A real text layer yields hundreds of characters per page; a scan
 * yields exactly zero. The margin is only there to tolerate a stray watermark.
 */
const TEXT_LAYER_THRESHOLD = 20;

/** Page numbers to sample, spread across the document rather than clustered at the front. */
export function samplePageNumbers(numPages: number, count = SAMPLE_PAGES): number[] {
  if (numPages <= count) {
    return Array.from({ length: numPages }, (_, i) => i + 1);
  }
  // Front matter is often a plain cover even in a scan, so reach into the body.
  const step = numPages / (count + 1);
  const pages = new Set<number>();
  for (let i = 1; i <= count; i++) {
    pages.add(Math.max(1, Math.min(numPages, Math.round(step * i))));
  }
  return [...pages].sort((a, b) => a - b);
}

export function isScannedFromSamples(totalChars: number): boolean {
  return totalChars < TEXT_LAYER_THRESHOLD;
}

/**
 * Decide whether a document needs OCR.
 *
 * Sampling rather than checking every page keeps this cheap on a 234-page book,
 * and individual pages still fall back to OCR on their own if they turn out to
 * have no extractable words.
 */
export async function detectScannedDocument(
  doc: pdfjsLib.PDFDocumentProxy,
): Promise<boolean> {
  let totalChars = 0;

  for (const pageNumber of samplePageNumbers(doc.numPages)) {
    try {
      const page = await doc.getPage(pageNumber);
      const textContent = await page.getTextContent();
      for (const item of textContent.items) {
        if ('str' in item) totalChars += item.str.trim().length;
      }
      if (totalChars >= TEXT_LAYER_THRESHOLD) return false;
    } catch {
      // An unreadable page tells us nothing either way; keep sampling.
    }
  }

  return isScannedFromSamples(totalChars);
}
