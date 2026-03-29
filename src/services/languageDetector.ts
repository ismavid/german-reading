import type * as pdfjsLib from 'pdfjs-dist';
import type { Language } from '../types/word';

// High-frequency words unique to each language
const GERMAN_MARKERS = new Set([
  'der', 'die', 'das', 'und', 'ist', 'ein', 'eine', 'nicht', 'ich', 'sie',
  'es', 'mit', 'auf', 'für', 'sich', 'auch', 'aber', 'noch', 'nach', 'wie',
  'nur', 'oder', 'sehr', 'kann', 'wird', 'über', 'hat', 'schon', 'wenn',
  'den', 'dem', 'dann', 'haben', 'werden', 'zum', 'zur', 'waren', 'hatte',
  'sind', 'diese', 'von', 'des', 'dass', 'wir', 'aus', 'bei', 'sein',
  'wurde', 'seinem', 'seiner', 'einem', 'einer', 'eines', 'diesem',
  'dieser', 'können', 'müssen', 'doch', 'mehr', 'immer', 'zwischen',
]);

const ENGLISH_MARKERS = new Set([
  'the', 'and', 'is', 'was', 'are', 'for', 'that', 'with', 'this', 'not',
  'but', 'from', 'they', 'have', 'had', 'has', 'been', 'would', 'could',
  'their', 'which', 'will', 'when', 'were', 'there', 'what', 'about',
  'into', 'than', 'them', 'these', 'other', 'some', 'its', 'also', 'after',
  'should', 'where', 'just', 'being', 'those', 'because', 'does', 'each',
  'between', 'through', 'while', 'before', 'here', 'must', 'during',
]);

export async function detectLanguage(doc: pdfjsLib.PDFDocumentProxy): Promise<Language> {
  // Sample up to first 3 pages
  const pagesToSample = Math.min(doc.numPages, 3);
  let deScore = 0;
  let enScore = 0;

  for (let i = 1; i <= pagesToSample; i++) {
    const page = await doc.getPage(i);
    const textContent = await page.getTextContent();

    for (const item of textContent.items) {
      if (!('str' in item) || !item.str.trim()) continue;
      const words = item.str.toLowerCase().split(/\s+/);
      for (const w of words) {
        const clean = w.replace(/[^\p{L}]/gu, '');
        if (!clean) continue;
        if (GERMAN_MARKERS.has(clean)) deScore++;
        if (ENGLISH_MARKERS.has(clean)) enScore++;
      }
    }
  }

  return enScore > deScore ? 'en' : 'de';
}
