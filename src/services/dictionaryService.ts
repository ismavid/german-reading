import type { WordLookupResult, WordType, GrammarInfo } from '../types/word';

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

function guessTypeByMorphology(word: string): WordType {
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

interface WiktionaryDefinition {
  partOfSpeech: string;
  language: string;
  definitions: Array<{ definition: string; parsedExamples?: Array<{ example: string }> }>;
}

async function lookupWiktionary(word: string): Promise<WordLookupResult | null> {
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

    // Parse definitions for grammar clues
    const allDefs = german.flatMap((e) => e.definitions.map((d) => d.definition));
    const defsText = allDefs.join(' ');

    // Extract gender for nouns
    if (wordType === 'Substantiv') {
      const genderMatch = defsText.match(/\b(masculine|feminine|neuter)\b/i) ||
                          defsText.match(/\b(der|die|das)\b/);
      if (genderMatch) {
        const g = genderMatch[1].toLowerCase();
        if (g === 'masculine' || g === 'der') grammar.gender = 'der';
        else if (g === 'feminine' || g === 'die') grammar.gender = 'die';
        else if (g === 'neuter' || g === 'das') grammar.gender = 'das';
      }
      // Extract plural
      const pluralMatch = defsText.match(/plural[:\s]+(?:of\s+)?(\S+)/i) ||
                          defsText.match(/plural\s*(?:<[^>]*>)*\s*(\w+)/i);
      if (pluralMatch) grammar.plural = pluralMatch[1];
    }

    // Extract Partizip II for verbs
    if (wordType === 'Verb') {
      const partizipMatch = defsText.match(/past participle[:\s]+(?:of\s+)?(\S+)/i) ||
                            defsText.match(/partizip\s*II[:\s]+(\S+)/i);
      if (partizipMatch) grammar.partizipII = partizipMatch[1];

      const auxMatch = defsText.match(/auxiliary[:\s]+(haben|sein)/i);
      if (auxMatch) grammar.auxiliary = auxMatch[1].toLowerCase() as 'haben' | 'sein';
    }

    // Strip HTML from first definition for translation
    const stripHtml = (html: string) => html.replace(/<[^>]*>/g, '').trim();
    const translation = allDefs.length > 0 ? stripHtml(allDefs[0]) : word;

    return { word, translation, grammar, definitions: allDefs.map(stripHtml) };
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

async function lookupFreeDict(word: string): Promise<WordLookupResult | null> {
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

    return { word, translation, grammar };
  } catch {
    return null;
  }
}

async function lookupMyMemory(word: string): Promise<string | null> {
  try {
    const res = await fetch(
      `https://api.mymemory.translated.net/get?q=${encodeURIComponent(word)}&langpair=de|en`,
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

export async function lookupWord(word: string): Promise<WordLookupResult | null> {
  const normalized = word.trim();
  if (!normalized || normalized.length < 1) return null;

  // Check cache
  const cacheKey = normalized.toLowerCase();
  if (cache.has(cacheKey)) return cache.get(cacheKey)!;

  // Try Wiktionary first
  let result = await lookupWiktionary(normalized);

  // Try free dictionary as fallback
  if (!result) {
    result = await lookupFreeDict(normalized);
  }

  // If still nothing, use MyMemory for translation + heuristics for type
  if (!result) {
    const translation = await lookupMyMemory(normalized);
    if (translation) {
      result = {
        word: normalized,
        translation,
        grammar: { type: guessTypeByMorphology(normalized) },
      };
    }
  }

  // Last resort: heuristic only
  if (!result) {
    result = {
      word: normalized,
      translation: '(translation unavailable)',
      grammar: { type: guessTypeByMorphology(normalized) },
    };
  }

  cache.set(cacheKey, result);
  saveCache();
  return result;
}
