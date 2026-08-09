import type { SourceLanguage } from '../../types/word';

/**
 * App language codes → Tesseract model names.
 *
 * Every entry here has a corresponding `<name>.traineddata` in the standard
 * tessdata set, so any source language the app supports can also be OCR'd.
 */
const TESSERACT_LANG: Record<SourceLanguage, string> = {
  de: 'deu',
  en: 'eng',
  fr: 'fra',
  it: 'ita',
  pt: 'por',
  es: 'spa',
  nl: 'nld',
  sv: 'swe',
  da: 'dan',
  no: 'nor',
  pl: 'pol',
  cs: 'ces',
  ro: 'ron',
  hu: 'hun',
  fi: 'fin',
  tr: 'tur',
  ru: 'rus',
  el: 'ell',
  ja: 'jpn',
  ko: 'kor',
  zh: 'chi_sim',
  ar: 'ara',
  hi: 'hin',
};

/**
 * Models used for the very first page of a scanned document.
 *
 * Language detection reads the text layer, which a scan doesn't have — so the
 * first page is recognised with a pair of models and the resulting text is what
 * detection actually runs on. German and English cover the realistic cases for
 * this app and keep the download to roughly 11 MB.
 */
export const DETECTION_LANGS = 'deu+eng';

export function toTesseractLang(lang: SourceLanguage): string {
  return TESSERACT_LANG[lang] ?? 'eng';
}
