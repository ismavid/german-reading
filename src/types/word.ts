export type SourceLanguage =
  | 'de' | 'en' | 'fr' | 'it' | 'pt' | 'es'
  | 'nl' | 'sv' | 'da' | 'no'
  | 'pl' | 'cs' | 'ro' | 'hu' | 'fi' | 'tr'
  | 'ru' | 'el'
  | 'ja' | 'ko' | 'zh'
  | 'ar' | 'hi';

export type TargetLanguage = 'en' | 'es';

export type WordType =
  | 'Substantiv'
  | 'Verb'
  | 'Adjektiv'
  | 'Adverb'
  | 'Präposition'
  | 'Konjunktion'
  | 'Pronomen'
  | 'Artikel'
  | 'Andere';

export interface GrammarInfo {
  type: WordType;
  gender?: 'der' | 'die' | 'das';
  plural?: string;
  partizipII?: string;
  auxiliary?: 'haben' | 'sein';
}

export interface WordLookupResult {
  word: string;
  translation: string;
  grammar: GrammarInfo;
  definitions?: string[];
  sourceLanguage?: SourceLanguage;
}

export interface SavedWord {
  id: string;
  word: string;
  translation: string;
  grammar: GrammarInfo;
  savedAt: number;
  sourceLanguage?: SourceLanguage;
}

export interface WordPosition {
  word: string;
  x: number;
  y: number;
  width: number;
  height: number;
  pageIndex: number;
}

export const WORD_TYPE_COLORS: Record<WordType, string> = {
  Substantiv: 'var(--color-noun)',
  Verb: 'var(--color-verb)',
  Adjektiv: 'var(--color-adjective)',
  Adverb: 'var(--color-adverb)',
  Präposition: 'var(--color-preposition)',
  Konjunktion: 'var(--color-conjunction)',
  Pronomen: 'var(--color-pronoun)',
  Artikel: 'var(--color-article)',
  Andere: 'var(--color-other)',
};

export const WORD_TYPE_LABELS: Record<TargetLanguage, Record<WordType, string>> = {
  en: {
    Substantiv: 'Noun',
    Verb: 'Verb',
    Adjektiv: 'Adjective',
    Adverb: 'Adverb',
    Präposition: 'Preposition',
    Konjunktion: 'Conjunction',
    Pronomen: 'Pronoun',
    Artikel: 'Article',
    Andere: 'Other',
  },
  es: {
    Substantiv: 'Sustantivo',
    Verb: 'Verbo',
    Adjektiv: 'Adjetivo',
    Adverb: 'Adverbio',
    Präposition: 'Preposición',
    Konjunktion: 'Conjunción',
    Pronomen: 'Pronombre',
    Artikel: 'Artículo',
    Andere: 'Otro',
  },
};

export interface LanguageInfo {
  name: string;
  flag: string;
  wiktionaryCode: string;
  myMemoryCode: string;
}

export const SUPPORTED_LANGUAGES: Record<SourceLanguage, LanguageInfo> = {
  de: { name: 'German',     flag: '🇩🇪', wiktionaryCode: 'de', myMemoryCode: 'de' },
  en: { name: 'English',    flag: '🇬🇧', wiktionaryCode: 'en', myMemoryCode: 'en' },
  fr: { name: 'French',     flag: '🇫🇷', wiktionaryCode: 'fr', myMemoryCode: 'fr' },
  it: { name: 'Italian',    flag: '🇮🇹', wiktionaryCode: 'it', myMemoryCode: 'it' },
  pt: { name: 'Portuguese', flag: '🇵🇹', wiktionaryCode: 'pt', myMemoryCode: 'pt' },
  es: { name: 'Spanish',    flag: '🇪🇸', wiktionaryCode: 'es', myMemoryCode: 'es' },
  nl: { name: 'Dutch',      flag: '🇳🇱', wiktionaryCode: 'nl', myMemoryCode: 'nl' },
  sv: { name: 'Swedish',    flag: '🇸🇪', wiktionaryCode: 'sv', myMemoryCode: 'sv' },
  da: { name: 'Danish',     flag: '🇩🇰', wiktionaryCode: 'da', myMemoryCode: 'da' },
  no: { name: 'Norwegian',  flag: '🇳🇴', wiktionaryCode: 'no', myMemoryCode: 'no' },
  pl: { name: 'Polish',     flag: '🇵🇱', wiktionaryCode: 'pl', myMemoryCode: 'pl' },
  cs: { name: 'Czech',      flag: '🇨🇿', wiktionaryCode: 'cs', myMemoryCode: 'cs' },
  ro: { name: 'Romanian',   flag: '🇷🇴', wiktionaryCode: 'ro', myMemoryCode: 'ro' },
  hu: { name: 'Hungarian',  flag: '🇭🇺', wiktionaryCode: 'hu', myMemoryCode: 'hu' },
  fi: { name: 'Finnish',    flag: '🇫🇮', wiktionaryCode: 'fi', myMemoryCode: 'fi' },
  tr: { name: 'Turkish',    flag: '🇹🇷', wiktionaryCode: 'tr', myMemoryCode: 'tr' },
  ru: { name: 'Russian',    flag: '🇷🇺', wiktionaryCode: 'ru', myMemoryCode: 'ru' },
  el: { name: 'Greek',      flag: '🇬🇷', wiktionaryCode: 'el', myMemoryCode: 'el' },
  ja: { name: 'Japanese',   flag: '🇯🇵', wiktionaryCode: 'ja', myMemoryCode: 'ja' },
  ko: { name: 'Korean',     flag: '🇰🇷', wiktionaryCode: 'ko', myMemoryCode: 'ko' },
  zh: { name: 'Chinese',    flag: '🇨🇳', wiktionaryCode: 'zh', myMemoryCode: 'zh-CN' },
  ar: { name: 'Arabic',     flag: '🇸🇦', wiktionaryCode: 'ar', myMemoryCode: 'ar' },
  hi: { name: 'Hindi',      flag: '🇮🇳', wiktionaryCode: 'hi', myMemoryCode: 'hi' },
};

export const TARGET_LABELS: Record<TargetLanguage, { name: string; flag: string }> = {
  en: { name: 'English', flag: '🇬🇧' },
  es: { name: 'Español', flag: '🇪🇸' },
};
