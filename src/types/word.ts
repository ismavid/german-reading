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
}

export interface SavedWord {
  id: string;
  word: string;
  translation: string;
  grammar: GrammarInfo;
  savedAt: number;
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

export const WORD_TYPE_LABELS: Record<WordType, string> = {
  Substantiv: 'Substantiv',
  Verb: 'Verb',
  Adjektiv: 'Adjektiv',
  Adverb: 'Adverb',
  Präposition: 'Präposition',
  Konjunktion: 'Konjunktion',
  Pronomen: 'Pronomen',
  Artikel: 'Artikel',
  Andere: 'Andere',
};
