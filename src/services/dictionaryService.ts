import type { WordLookupResult, WordType, GrammarInfo, Language } from '../types/word';

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

function mapPOS(pos: string): WordType {
  const p = pos.toLowerCase();
  if (p.includes('noun') || p.includes('substantiv')) return 'Substantiv';
  if (p.includes('verb')) return 'Verb';
  if (p.includes('adjective') || p.includes('adjektiv')) return 'Adjektiv';
  if (p.includes('adverb')) return 'Adverb';
  if (p.includes('preposition') || p.includes('präposition')) return 'Präposition';
  if (p.includes('conjunction') || p.includes('konjunktion')) return 'Konjunktion';
  if (p.includes('pronoun') || p.includes('pronomen')) return 'Pronomen';
  if (p.includes('article') || p.includes('artikel') || p.includes('determiner')) return 'Artikel';
  return 'Andere';
}

// --- German morphology guesser ---

function guessTypeByMorphologyDE(word: string): WordType {
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

// --- English morphology guesser ---

function guessTypeByMorphologyEN(word: string): WordType {
  const w = word.toLowerCase();
  if (/^(a|an|the)$/.test(w)) return 'Artikel';
  if (/^(i|you|he|she|it|we|they|me|him|her|us|them|my|your|his|its|our|their|mine|yours|ours|theirs|myself|yourself|himself|herself|itself|ourselves|themselves)$/.test(w)) return 'Pronomen';
  if (/^(and|or|but|nor|for|yet|so|because|although|though|while|whereas|unless|until|since|if|when|after|before|that|which|who|whom)$/.test(w)) return 'Konjunktion';
  if (/^(in|on|at|to|for|with|from|by|about|into|through|during|before|after|above|below|between|under|over|against|without|among|within|along|across|behind|beyond|toward|towards|upon|onto|beside|besides|except|until|since|of|off|out|up|down)$/.test(w)) return 'Präposition';
  if (/(ly)$/.test(w) && w.length > 3) return 'Adverb';
  if (/^(very|also|already|always|never|often|sometimes|here|there|now|then|today|yesterday|tomorrow|quite|rather|almost|just|still|even|too|enough)$/.test(w)) return 'Adverb';
  if (/(tion|sion|ment|ness|ity|ance|ence|er|or|ist|ism|ship|dom|hood)$/.test(w) && w.length > 4) return 'Substantiv';
  if (/(ful|less|ous|ive|able|ible|al|ial|ical|ish|like|ly|ant|ent|ary|ory)$/.test(w) && w.length > 4) return 'Adjektiv';
  if (/(ing|ed|ize|ise|ify|ate|en)$/.test(w) && w.length > 3) return 'Verb';
  return 'Andere';
}

// --- German lookups ---

interface WiktionaryDefinition {
  partOfSpeech: string;
  language: string;
  definitions: Array<{ definition: string; parsedExamples?: Array<{ example: string }> }>;
}

async function lookupWiktionaryDE(word: string): Promise<WordLookupResult | null> {
  try {
    const res = await fetch(
      `https://en.wiktionary.org/api/rest_v1/page/definition/${encodeURIComponent(word)}`,
      { signal: AbortSignal.timeout(4000) }
    );
    if (!res.ok) return null;

    const data: Record<string, WiktionaryDefinition[]> = await res.json();
    const german = data['de'];
    if (!german || german.length === 0) return null;

    const entry = german[0];
    const wordType = mapPOS(entry.partOfSpeech);

    const grammar: GrammarInfo = { type: wordType };

    const allDefs = german.flatMap((e) => e.definitions.map((d) => d.definition));
    const defsText = allDefs.join(' ');

    if (wordType === 'Substantiv') {
      const genderMatch = defsText.match(/\b(masculine|feminine|neuter)\b/i) ||
                          defsText.match(/\b(der|die|das)\b/);
      if (genderMatch) {
        const g = genderMatch[1].toLowerCase();
        if (g === 'masculine' || g === 'der') grammar.gender = 'der';
        else if (g === 'feminine' || g === 'die') grammar.gender = 'die';
        else if (g === 'neuter' || g === 'das') grammar.gender = 'das';
      }
      const pluralMatch = defsText.match(/plural[:\s]+(?:of\s+)?(\S+)/i) ||
                          defsText.match(/plural\s*(?:<[^>]*>)*\s*(\w+)/i);
      if (pluralMatch) grammar.plural = pluralMatch[1];
    }

    if (wordType === 'Verb') {
      const partizipMatch = defsText.match(/past participle[:\s]+(?:of\s+)?(\S+)/i) ||
                            defsText.match(/partizip\s*II[:\s]+(\S+)/i);
      if (partizipMatch) grammar.partizipII = partizipMatch[1];

      const auxMatch = defsText.match(/auxiliary[:\s]+(haben|sein)/i);
      if (auxMatch) grammar.auxiliary = auxMatch[1].toLowerCase() as 'haben' | 'sein';
    }

    const stripHtml = (html: string) => html.replace(/<[^>]*>/g, '').trim();
    const translation = allDefs.length > 0 ? stripHtml(allDefs[0]) : word;

    return { word, translation, grammar, definitions: allDefs.map(stripHtml), language: 'de' };
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

async function lookupFreeDictDE(word: string): Promise<WordLookupResult | null> {
  try {
    const res = await fetch(
      `https://api.dictionaryapi.dev/api/v2/entries/de/${encodeURIComponent(word)}`,
      { signal: AbortSignal.timeout(4000) }
    );
    if (!res.ok) return null;

    const data: FreeDictEntry[] = await res.json();
    if (!data.length || !data[0].meanings.length) return null;

    const meaning = data[0].meanings[0];
    const wordType = mapPOS(meaning.partOfSpeech);
    const grammar: GrammarInfo = { type: wordType };
    const translation = meaning.definitions[0]?.definition || word;

    return { word, translation, grammar, language: 'de' };
  } catch {
    return null;
  }
}

async function lookupMyMemory(word: string, langPair: string): Promise<string | null> {
  try {
    const res = await fetch(
      `https://api.mymemory.translated.net/get?q=${encodeURIComponent(word)}&langpair=${langPair}`,
      { signal: AbortSignal.timeout(4000) }
    );
    if (!res.ok) return null;
    const data = await res.json();
    const translated: string = data?.responseData?.translatedText;
    if (!translated || translated.toLowerCase() === word.toLowerCase()) return null;
    return translated;
  } catch {
    return null;
  }
}

// --- English lookups (English → Spanish) ---

async function lookupWiktionaryEN(word: string): Promise<WordLookupResult | null> {
  try {
    const res = await fetch(
      `https://en.wiktionary.org/api/rest_v1/page/definition/${encodeURIComponent(word)}`,
      { signal: AbortSignal.timeout(4000) }
    );
    if (!res.ok) return null;

    const data: Record<string, WiktionaryDefinition[]> = await res.json();
    const english = data['en'];
    if (!english || english.length === 0) return null;

    const entry = english[0];
    const wordType = mapPOS(entry.partOfSpeech);
    const grammar: GrammarInfo = { type: wordType };

    const stripHtml = (html: string) => html.replace(/<[^>]*>/g, '').trim();
    const allDefs = english.flatMap((e) => e.definitions.map((d) => stripHtml(d.definition)));

    // Get Spanish translation via MyMemory
    const spanishTranslation = await lookupMyMemory(word, 'en|es');
    const translation = spanishTranslation || (allDefs.length > 0 ? allDefs[0] : word);

    return { word, translation, grammar, definitions: allDefs, language: 'en' };
  } catch {
    return null;
  }
}

async function lookupFreeDictEN(word: string): Promise<WordLookupResult | null> {
  try {
    const res = await fetch(
      `https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(word)}`,
      { signal: AbortSignal.timeout(4000) }
    );
    if (!res.ok) return null;

    const data: FreeDictEntry[] = await res.json();
    if (!data.length || !data[0].meanings.length) return null;

    const meaning = data[0].meanings[0];
    const wordType = mapPOS(meaning.partOfSpeech);
    const grammar: GrammarInfo = { type: wordType };

    // Get Spanish translation
    const spanishTranslation = await lookupMyMemory(word, 'en|es');
    const translation = spanishTranslation || meaning.definitions[0]?.definition || word;

    return { word, translation, grammar, language: 'en' };
  } catch {
    return null;
  }
}

// --- Main lookup function ---

async function lookupGerman(word: string): Promise<WordLookupResult | null> {
  const normalized = word.trim();

  let result = await lookupWiktionaryDE(normalized);
  if (!result) result = await lookupFreeDictDE(normalized);

  if (!result) {
    const translation = await lookupMyMemory(normalized, 'de|en');
    if (translation) {
      result = {
        word: normalized,
        translation,
        grammar: { type: guessTypeByMorphologyDE(normalized) },
        language: 'de',
      };
    }
  }

  if (!result) {
    result = {
      word: normalized,
      translation: '(translation unavailable)',
      grammar: { type: guessTypeByMorphologyDE(normalized) },
      language: 'de',
    };
  }

  return result;
}

async function lookupEnglish(word: string): Promise<WordLookupResult | null> {
  const normalized = word.trim();

  let result = await lookupWiktionaryEN(normalized);
  if (!result) result = await lookupFreeDictEN(normalized);

  if (!result) {
    const translation = await lookupMyMemory(normalized, 'en|es');
    if (translation) {
      result = {
        word: normalized,
        translation,
        grammar: { type: guessTypeByMorphologyEN(normalized) },
        language: 'en',
      };
    }
  }

  if (!result) {
    result = {
      word: normalized,
      translation: '(traducción no disponible)',
      grammar: { type: guessTypeByMorphologyEN(normalized) },
      language: 'en',
    };
  }

  return result;
}

export async function lookupWord(word: string, language: Language = 'de'): Promise<WordLookupResult | null> {
  const normalized = word.trim();
  if (!normalized || normalized.length < 1) return null;

  const cacheKey = `${language}:${normalized.toLowerCase()}`;
  if (cache.has(cacheKey)) return cache.get(cacheKey)!;

  const result = language === 'en'
    ? await lookupEnglish(normalized)
    : await lookupGerman(normalized);

  if (result) {
    cache.set(cacheKey, result);
    saveCache();
  }

  return result;
}
