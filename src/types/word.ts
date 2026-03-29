export type Language = 'de' | 'en';

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
  language?: Language;
}

export interface SavedWord {
  id: string;
  word: string;
  translation: string;
  grammar: GrammarInfo;
  savedAt: number;
  language?: Language;
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

export const WORD_TYPE_LABELS: Record<Language, Record<WordType, string>> = {
  de: {
    Substantiv: 'Substantiv',
    Verb: 'Verb',
    Adjektiv: 'Adjektiv',
    Adverb: 'Adverb',
    Präposition: 'Präposition',
    Konjunktion: 'Konjunktion',
    Pronomen: 'Pronomen',
    Artikel: 'Artikel',
    Andere: 'Andere',
  },
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
};

export const LANGUAGE_LABELS: Record<Language, { name: string; flag: string; target: string }> = {
  de: { name: 'German', flag: 'DE', target: 'English' },
  en: { name: 'English', flag: 'EN', target: 'Spanish' },
};
