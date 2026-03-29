import type { WordLookupResult, WordType, GrammarInfo, SourceLanguage, TargetLanguage } from '../types/word';
import { SUPPORTED_LANGUAGES } from '../types/word';

const cache = new Map<string, WordLookupResult>();

const STORAGE_KEY = 'german-reading-dict-cache';

function loadCache(): void {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const entries: [string, WordLookupResult][] = JSON.parse(raw);
      for (const [k, v] of entries) cache.set(k, v);
    }
  } catch { /* ignore */ }
}

function saveCache(): void {
  try {
    const entries = [...cache.entries()].slice(-3000);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
  } catch { /* ignore */ }
}

loadCache();

// ── POS mapping ─────────────────────────────────────────────────────────

function mapPOS(pos: string): WordType {
  const p = pos.toLowerCase();
  if (p.includes('noun') || p.includes('substantiv') || p.includes('sustantivo') || p.includes('nom')) return 'Substantiv';
  if (p.includes('verb') || p.includes('verbo') || p.includes('verbe')) return 'Verb';
  if (p.includes('adjective') || p.includes('adjektiv') || p.includes('adjetivo') || p.includes('adjectif')) return 'Adjektiv';
  if (p.includes('adverb') || p.includes('adverbio') || p.includes('adverbe')) return 'Adverb';
  if (p.includes('preposition') || p.includes('präposition') || p.includes('preposición')) return 'Präposition';
  if (p.includes('conjunction') || p.includes('konjunktion') || p.includes('conjunción')) return 'Konjunktion';
  if (p.includes('pronoun') || p.includes('pronomen') || p.includes('pronombre') || p.includes('pronom')) return 'Pronomen';
  if (p.includes('article') || p.includes('artikel') || p.includes('determiner') || p.includes('artículo')) return 'Artikel';
  return 'Andere';
}

// ── Morphology guessers ─────────────────────────────────────────────────

function guessTypeDE(word: string): WordType {
  const w = word.toLowerCase();
  if (/^(der|die|das|ein|eine|einem|einen|eines|einer)$/.test(w)) return 'Artikel';
  if (/^(ich|du|er|sie|es|wir|ihr|mich|mir|dich|dir|sich|uns|euch|ihnen)$/.test(w)) return 'Pronomen';
  if (/^(und|oder|aber|denn|weil|dass|ob|wenn|als|sondern|doch|jedoch)$/.test(w)) return 'Konjunktion';
  if (/^(in|an|auf|für|mit|von|zu|nach|über|unter|vor|zwischen|aus|bei|durch|gegen|ohne|um)$/.test(w)) return 'Präposition';
  if (/^(sehr|auch|schon|noch|immer|nie|oft|fast|gern|hier|dort|da|jetzt|heute|gestern|morgen)$/.test(w)) return 'Adverb';
  if (word[0] === word[0].toUpperCase() && /[a-zäöüß]/.test(word[0].toLowerCase())) {
    if (/(ung|heit|keit|schaft|nis|tum|chen|lein)$/.test(w)) return 'Substantiv';
    if (word.length > 1) return 'Substantiv';
  }
  if (/(lich|ig|bar|sam|haft|los|isch|ell|iv)$/.test(w)) return 'Adjektiv';
  if (/en$/.test(w) && w.length > 3) return 'Verb';
  return 'Andere';
}

function guessTypeEN(word: string): WordType {
  const w = word.toLowerCase();
  if (/^(a|an|the)$/.test(w)) return 'Artikel';
  if (/^(i|you|he|she|it|we|they|me|him|her|us|them|myself|yourself|himself|herself|itself|ourselves|themselves)$/.test(w)) return 'Pronomen';
  if (/^(and|or|but|nor|for|yet|so|because|although|though|while|unless|until|since|if|when|after|before|that)$/.test(w)) return 'Konjunktion';
  if (/^(in|on|at|to|for|with|from|by|about|into|through|during|before|after|above|below|between|under|over|against|without|of|off|out|up|down)$/.test(w)) return 'Präposition';
  if (/(ly)$/.test(w) && w.length > 3) return 'Adverb';
  if (/^(very|also|already|always|never|often|sometimes|here|there|now|then|quite|rather|almost|just|still|even|too)$/.test(w)) return 'Adverb';
  if (/(tion|sion|ment|ness|ity|ance|ence|er|or|ist|ism|ship|dom|hood)$/.test(w) && w.length > 4) return 'Substantiv';
  if (/(ful|less|ous|ive|able|ible|al|ial|ish|ant|ent|ary|ory)$/.test(w) && w.length > 4) return 'Adjektiv';
  if (/(ing|ed|ize|ise|ify|ate)$/.test(w) && w.length > 3) return 'Verb';
  return 'Andere';
}

function guessTypeFR(word: string): WordType {
  const w = word.toLowerCase();
  if (/^(le|la|les|un|une|des|du|au|aux)$/.test(w)) return 'Artikel';
  if (/^(je|tu|il|elle|nous|vous|ils|elles|me|te|se|moi|toi|lui|eux)$/.test(w)) return 'Pronomen';
  if (/^(et|ou|mais|donc|car|ni|que|si|quand|comme|parce)$/.test(w)) return 'Konjunktion';
  if (/^(dans|sur|sous|avec|pour|par|entre|vers|chez|sans|après|avant|pendant|depuis|contre)$/.test(w)) return 'Präposition';
  if (/(ment)$/.test(w) && w.length > 5) return 'Adverb';
  if (/(tion|sion|ment|eur|euse|isme|ité|ance|ence|age)$/.test(w) && w.length > 4) return 'Substantiv';
  if (/(eux|euse|ique|ible|able|el|elle|if|ive)$/.test(w) && w.length > 3) return 'Adjektiv';
  if (/(er|ir|re|oir)$/.test(w) && w.length > 3) return 'Verb';
  return 'Andere';
}

function guessTypeGeneric(word: string): WordType {
  // Very simple fallback — use word length and common patterns
  const w = word.toLowerCase();
  if (w.length <= 3) return 'Andere';
  if (/(tion|sion|ment|ness|ity|ism|dad|tud|ção|zione)$/i.test(w)) return 'Substantiv';
  if (/(able|ible|oso|osa|ico|ica|eux|euse)$/i.test(w)) return 'Adjektiv';
  if (/(mente|ment|ly)$/i.test(w) && w.length > 5) return 'Adverb';
  return 'Andere';
}

function guessType(word: string, lang: SourceLanguage): WordType {
  switch (lang) {
    case 'de': return guessTypeDE(word);
    case 'en': return guessTypeEN(word);
    case 'fr': return guessTypeFR(word);
    default: return guessTypeGeneric(word);
  }
}

// ── Humanize Wiktionary definitions ─────────────────────────────────────

const INFLECTION_PATTERNS = [
  // "dative of X" → "dative form of X"
  /^(dative|genitive|accusative|nominative|vocative|locative|instrumental|ablative)\s+(?:singular\s+|plural\s+)?(?:of\s+)?(.+)/i,
  // "plural of X"
  /^(plural|singular)\s+(?:of\s+)?(.+)/i,
  // "past tense of X", "past participle of X"
  /^(past\s+tense|past\s+participle|present\s+participle|present\s+tense|future\s+tense|imperative|subjunctive|conditional|infinitive)\s+(?:of\s+)?(.+)/i,
  // "feminine of X", "masculine of X"
  /^(feminine|masculine|neuter)\s+(?:form\s+)?(?:of\s+)?(.+)/i,
  // "comparative of X", "superlative of X"
  /^(comparative|superlative)\s+(?:form\s+)?(?:of\s+)?(.+)/i,
  // "diminutive of X", "augmentative of X"
  /^(diminutive|augmentative)\s+(?:of\s+)?(.+)/i,
  // "first/second/third-person singular/plural ... of X"
  /^(first|second|third)[\s-]person\s+(singular|plural)\s+.*?(?:of\s+)?(\S+.*)$/i,
  // "inflection of X"
  /^(?:inflected?\s+form|inflection|form)\s+(?:of\s+)?(.+)/i,
];

function humanizeDefinition(def: string): { text: string; isInflection: boolean; baseWord?: string } {
  const cleaned = def.replace(/<[^>]*>/g, '').trim();

  for (const pattern of INFLECTION_PATTERNS) {
    const match = cleaned.match(pattern);
    if (match) {
      // Extract the grammatical note and the base word
      const groups = match.slice(1);
      const baseWord = groups[groups.length - 1]?.trim();
      const gramNote = groups.slice(0, -1).join(' ').trim();

      if (baseWord) {
        return {
          text: `${gramNote} form of "${baseWord}"`,
          isInflection: true,
          baseWord,
        };
      }
    }
  }

  return { text: cleaned, isInflection: false };
}

// ── API lookups ─────────────────────────────────────────────────────────

interface WiktionaryDefinition {
  partOfSpeech: string;
  language: string;
  definitions: Array<{ definition: string; parsedExamples?: Array<{ example: string }> }>;
}

async function lookupWiktionary(
  word: string,
  srcLang: SourceLanguage,
): Promise<{ wordType: WordType; grammar: GrammarInfo; definitions: string[]; rawDefs: string[] } | null> {
  try {
    const res = await fetch(
      `https://en.wiktionary.org/api/rest_v1/page/definition/${encodeURIComponent(word)}`,
      { signal: AbortSignal.timeout(4000) }
    );
    if (!res.ok) return null;

    const data: Record<string, WiktionaryDefinition[]> = await res.json();
    const wiktCode = SUPPORTED_LANGUAGES[srcLang].wiktionaryCode;
    const entries = data[wiktCode];
    if (!entries || entries.length === 0) return null;

    const entry = entries[0];
    const wordType = mapPOS(entry.partOfSpeech);
    const grammar: GrammarInfo = { type: wordType };

    const stripHtml = (html: string) => html.replace(/<[^>]*>/g, '').trim();
    const rawDefs = entries.flatMap((e) => e.definitions.map((d) => stripHtml(d.definition)));
    const defsText = rawDefs.join(' ');

    // German-specific grammar extraction
    if (srcLang === 'de') {
      if (wordType === 'Substantiv') {
        const genderMatch = defsText.match(/\b(masculine|feminine|neuter)\b/i) ||
                            defsText.match(/\b(der|die|das)\b/);
        if (genderMatch) {
          const g = genderMatch[1].toLowerCase();
          if (g === 'masculine' || g === 'der') grammar.gender = 'der';
          else if (g === 'feminine' || g === 'die') grammar.gender = 'die';
          else if (g === 'neuter' || g === 'das') grammar.gender = 'das';
        }
        const pluralMatch = defsText.match(/plural[:\s]+(?:of\s+)?(\S+)/i);
        if (pluralMatch) grammar.plural = pluralMatch[1];
      }
      if (wordType === 'Verb') {
        const partizipMatch = defsText.match(/past participle[:\s]+(?:of\s+)?(\S+)/i);
        if (partizipMatch) grammar.partizipII = partizipMatch[1];
        const auxMatch = defsText.match(/auxiliary[:\s]+(haben|sein)/i);
        if (auxMatch) grammar.auxiliary = auxMatch[1].toLowerCase() as 'haben' | 'sein';
      }
    }

    // Humanize definitions
    const definitions = rawDefs.map((d) => humanizeDefinition(d).text);

    return { wordType, grammar, definitions, rawDefs };
  } catch {
    return null;
  }
}

interface FreeDictEntry {
  meanings: Array<{
    partOfSpeech: string;
    definitions: Array<{ definition: string }>;
  }>;
}

const FREE_DICT_LANGUAGES = new Set(['en', 'de', 'fr', 'it', 'pt', 'es', 'nl', 'sv', 'tr', 'ru', 'ar', 'hi', 'ko', 'ja', 'zh']);

async function lookupFreeDict(word: string, srcLang: SourceLanguage): Promise<{ wordType: WordType; definition: string } | null> {
  if (!FREE_DICT_LANGUAGES.has(srcLang)) return null;
  try {
    const res = await fetch(
      `https://api.dictionaryapi.dev/api/v2/entries/${srcLang}/${encodeURIComponent(word)}`,
      { signal: AbortSignal.timeout(4000) }
    );
    if (!res.ok) return null;
    const data: FreeDictEntry[] = await res.json();
    if (!data.length || !data[0].meanings.length) return null;
    const meaning = data[0].meanings[0];
    return {
      wordType: mapPOS(meaning.partOfSpeech),
      definition: meaning.definitions[0]?.definition || word,
    };
  } catch {
    return null;
  }
}

async function translateMyMemory(word: string, srcCode: string, tgtCode: string): Promise<string | null> {
  try {
    const res = await fetch(
      `https://api.mymemory.translated.net/get?q=${encodeURIComponent(word)}&langpair=${srcCode}|${tgtCode}`,
      { signal: AbortSignal.timeout(4000) }
    );
    if (!res.ok) return null;
    const data = await res.json();
    const translated: string = data?.responseData?.translatedText;
    if (!translated || translated.toLowerCase() === word.toLowerCase()) return null;
    // MyMemory sometimes returns ALL CAPS for short words — normalize
    if (translated === translated.toUpperCase() && translated.length > 1) {
      return translated.charAt(0).toUpperCase() + translated.slice(1).toLowerCase();
    }
    return translated;
  } catch {
    return null;
  }
}

// ── Main lookup ─────────────────────────────────────────────────────────

export async function lookupWord(
  word: string,
  srcLang: SourceLanguage = 'de',
  tgtLang: TargetLanguage = 'en',
): Promise<WordLookupResult | null> {
  const normalized = word.trim();
  if (!normalized || normalized.length < 1) return null;

  const cacheKey = `${srcLang}:${tgtLang}:${normalized.toLowerCase()}`;
  if (cache.has(cacheKey)) return cache.get(cacheKey)!;

  const srcInfo = SUPPORTED_LANGUAGES[srcLang];
  let translation: string | null = null;
  let grammar: GrammarInfo = { type: guessType(normalized, srcLang) };
  let definitions: string[] | undefined;

  // 1. Get translation from MyMemory (source → target)
  translation = await translateMyMemory(normalized, srcInfo.myMemoryCode, tgtLang);

  // 2. Get grammar info + definitions from Wiktionary
  const wiktResult = await lookupWiktionary(normalized, srcLang);
  if (wiktResult) {
    grammar = wiktResult.grammar;
    definitions = wiktResult.definitions;

    // If a wiktionary def is an inflection, try to look up the base word for a better translation
    if (!translation && wiktResult.rawDefs.length > 0) {
      const humanized = humanizeDefinition(wiktResult.rawDefs[0]);
      if (humanized.isInflection && humanized.baseWord) {
        // Try translating the base word and annotate
        const baseTrans = await translateMyMemory(humanized.baseWord, srcInfo.myMemoryCode, tgtLang);
        if (baseTrans) {
          const note = humanized.text.replace(`form of "${humanized.baseWord}"`, '').trim();
          translation = `${baseTrans} (${note} form)`;
        }
      }
    }

    // Fallback: use first Wiktionary definition as translation
    if (!translation && definitions.length > 0) {
      translation = definitions[0];
    }
  }

  // 3. Try Free Dictionary if still no translation
  if (!translation) {
    const fdResult = await lookupFreeDict(normalized, srcLang);
    if (fdResult) {
      grammar = { type: fdResult.wordType };
      translation = fdResult.definition;
    }
  }

  // 4. Last resort
  if (!translation) {
    translation = tgtLang === 'es' ? '(traducción no disponible)' : '(translation unavailable)';
  }

  const result: WordLookupResult = {
    word: normalized,
    translation,
    grammar,
    definitions,
    sourceLanguage: srcLang,
  };

  cache.set(cacheKey, result);
  saveCache();
  return result;
}
