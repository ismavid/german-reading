import type * as pdfjsLib from 'pdfjs-dist';
import type { SourceLanguage } from '../types/word';

// ── Script-based detection (non-Latin) ──────────────────────────────────

function detectByScript(text: string): SourceLanguage | null {
  let cyrillic = 0, cjk = 0, hiraganaKatakana = 0, hangul = 0, arabic = 0, devanagari = 0, greek = 0, latin = 0;

  for (const ch of text) {
    const cp = ch.codePointAt(0)!;
    if (cp >= 0x0400 && cp <= 0x04FF) cyrillic++;
    else if (cp >= 0x4E00 && cp <= 0x9FFF) cjk++;
    else if ((cp >= 0x3040 && cp <= 0x309F) || (cp >= 0x30A0 && cp <= 0x30FF)) hiraganaKatakana++;
    else if (cp >= 0xAC00 && cp <= 0xD7AF) hangul++;
    else if (cp >= 0x0600 && cp <= 0x06FF) arabic++;
    else if (cp >= 0x0900 && cp <= 0x097F) devanagari++;
    else if (cp >= 0x0370 && cp <= 0x03FF) greek++;
    else if ((cp >= 0x0041 && cp <= 0x005A) || (cp >= 0x0061 && cp <= 0x007A) || (cp >= 0x00C0 && cp <= 0x024F)) latin++;
  }

  const total = cyrillic + cjk + hiraganaKatakana + hangul + arabic + devanagari + greek + latin;
  if (total < 20) return null;

  // If non-Latin script dominates (>30% of script chars), identify it
  if (hiraganaKatakana > total * 0.1 || (cjk > total * 0.2 && hiraganaKatakana > 0)) return 'ja';
  if (hangul > total * 0.2) return 'ko';
  if (cjk > total * 0.2) return 'zh';
  if (cyrillic > total * 0.3) return 'ru';
  if (arabic > total * 0.3) return 'ar';
  if (devanagari > total * 0.3) return 'hi';
  if (greek > total * 0.3) return 'el';

  return null; // Latin script — use word frequency
}

// ── Word frequency markers for Latin-script languages ───────────────────

const MARKERS: Record<string, Set<string>> = {
  de: new Set([
    'der', 'die', 'das', 'und', 'ist', 'ein', 'eine', 'nicht', 'ich', 'sie',
    'es', 'mit', 'auf', 'für', 'sich', 'auch', 'aber', 'noch', 'nach', 'wie',
    'nur', 'oder', 'sehr', 'kann', 'wird', 'über', 'hat', 'schon', 'wenn',
    'den', 'dem', 'dann', 'haben', 'werden', 'zum', 'zur', 'sind', 'diese',
    'dass', 'wir', 'aus', 'bei', 'sein', 'wurde', 'können', 'müssen', 'doch',
  ]),
  en: new Set([
    'the', 'and', 'is', 'was', 'are', 'for', 'that', 'with', 'this', 'not',
    'but', 'from', 'they', 'have', 'had', 'has', 'been', 'would', 'could',
    'their', 'which', 'will', 'when', 'were', 'there', 'what', 'about',
    'into', 'than', 'them', 'these', 'other', 'some', 'its', 'also', 'after',
    'should', 'where', 'just', 'being', 'those', 'because', 'does', 'each',
  ]),
  fr: new Set([
    'les', 'des', 'une', 'est', 'dans', 'que', 'qui', 'pour', 'pas', 'sur',
    'sont', 'avec', 'plus', 'tout', 'fait', 'mais', 'nous', 'comme', 'ont',
    'aussi', 'cette', 'bien', 'peut', 'ses', 'entre', 'deux', 'ces', 'leur',
    'sous', 'donc', 'puis', 'très', 'elle', 'même', 'encore', 'tous', 'être',
    'avoir', 'après', 'avant', 'chez', 'notre', 'votre', 'sans', 'autre',
  ]),
  it: new Set([
    'che', 'non', 'una', 'sono', 'della', 'con', 'per', 'gli', 'dei', 'nel',
    'anche', 'come', 'più', 'suo', 'sua', 'questo', 'questa', 'stato', 'alla',
    'dal', 'delle', 'nella', 'tra', 'dove', 'loro', 'dopo', 'tutto', 'ogni',
    'perché', 'quando', 'molto', 'così', 'già', 'essere', 'fare', 'altri',
    'quella', 'quello', 'ancora', 'sempre', 'solo', 'aveva', 'hanno', 'parte',
  ]),
  pt: new Set([
    'que', 'não', 'uma', 'com', 'para', 'dos', 'mais', 'como', 'mas', 'por',
    'foi', 'são', 'seu', 'sua', 'ele', 'ela', 'tem', 'nos', 'nas', 'entre',
    'esta', 'esse', 'essa', 'seus', 'suas', 'pelo', 'pela', 'isso', 'quando',
    'muito', 'também', 'sobre', 'até', 'depois', 'onde', 'ainda', 'outro',
    'pode', 'ter', 'ser', 'já', 'está', 'fazer', 'todos', 'desde', 'havia',
  ]),
  es: new Set([
    'que', 'los', 'las', 'del', 'una', 'con', 'por', 'para', 'más', 'pero',
    'como', 'sus', 'fue', 'han', 'son', 'está', 'ser', 'hay', 'sin', 'también',
    'este', 'esta', 'ese', 'esa', 'todo', 'cada', 'desde', 'donde', 'entre',
    'sobre', 'después', 'otro', 'otra', 'cuando', 'muy', 'todos', 'puede',
    'hacer', 'tiene', 'había', 'estos', 'ella', 'ellos', 'nosotros', 'hacia',
  ]),
  nl: new Set([
    'het', 'een', 'van', 'dat', 'niet', 'zijn', 'ook', 'met', 'voor', 'maar',
    'nog', 'wel', 'zij', 'als', 'dan', 'kan', 'wordt', 'naar', 'uit', 'bij',
    'deze', 'meer', 'veel', 'door', 'toe', 'hier', 'daar', 'mijn', 'haar',
    'heeft', 'werd', 'waren', 'alle', 'twee', 'hebben', 'over', 'moet', 'wat',
    'geen', 'onder', 'tussen', 'ons', 'hun', 'zou', 'alleen', 'hele', 'zonder',
  ]),
  sv: new Set([
    'och', 'att', 'det', 'som', 'för', 'med', 'den', 'har', 'inte', 'till',
    'var', 'kan', 'men', 'ett', 'från', 'vid', 'han', 'hon', 'ska', 'hade',
    'alla', 'mycket', 'efter', 'utan', 'bara', 'under', 'sedan', 'sina', 'där',
    'hur', 'redan', 'blev', 'över', 'även', 'detta', 'andra', 'också', 'mot',
  ]),
  da: new Set([
    'og', 'det', 'til', 'har', 'som', 'med', 'den', 'kan', 'ikke', 'fra',
    'var', 'han', 'hun', 'vil', 'efter', 'skal', 'ved', 'alle', 'meget',
    'havde', 'blev', 'her', 'andre', 'flere', 'hvor', 'denne', 'disse',
    'også', 'uden', 'mellem', 'under', 'over', 'kun', 'igen', 'noget', 'sig',
  ]),
  no: new Set([
    'og', 'det', 'som', 'til', 'har', 'med', 'den', 'kan', 'ikke', 'fra',
    'var', 'han', 'hun', 'vil', 'etter', 'skal', 'ved', 'alle', 'hadde',
    'ble', 'her', 'andre', 'flere', 'hvor', 'denne', 'disse', 'også', 'uten',
    'mellom', 'under', 'over', 'bare', 'noe', 'seg', 'blitt', 'mange', 'siden',
  ]),
  pl: new Set([
    'nie', 'jest', 'jak', 'się', 'ale', 'tak', 'już', 'był', 'tego',
    'tylko', 'jest', 'przez', 'jeszcze', 'jego', 'jej', 'ich', 'tym',
    'bardzo', 'może', 'są', 'był', 'wszystko', 'kiedy', 'więc', 'gdzie',
    'także', 'przed', 'między', 'pod', 'nad', 'bez', 'został', 'które',
  ]),
  cs: new Set([
    'není', 'jako', 'ale', 'tak', 'jeho', 'její', 'byl', 'jsou', 'také',
    'nebo', 'než', 'jen', 'velmi', 'může', 'ještě', 'kde', 'když', 'tedy',
    'mezi', 'pod', 'nad', 'bez', 'před', 'které', 'jejich', 'proto', 'bylo',
  ]),
  ro: new Set([
    'este', 'care', 'lui', 'sau', 'mai', 'iar', 'fost', 'sunt', 'dar',
    'acest', 'această', 'prin', 'din', 'despre', 'într', 'după', 'fiind',
    'doar', 'avea', 'cele', 'foarte', 'astfel', 'fără', 'între', 'poate',
  ]),
  hu: new Set([
    'egy', 'hogy', 'nem', 'meg', 'már', 'volt', 'csak', 'van', 'még',
    'itt', 'ezt', 'azt', 'ami', 'aki', 'mint', 'sok', 'igen', 'igen',
    'nagy', 'mert', 'után', 'alatt', 'között', 'minden', 'lenne', 'nincs',
  ]),
  fi: new Set([
    'oli', 'hän', 'että', 'kun', 'niin', 'mutta', 'olla', 'myös', 'joka',
    'kuin', 'vain', 'ovat', 'tämä', 'siitä', 'tässä', 'mitä', 'hänen',
    'sitten', 'kanssa', 'ennen', 'välillä', 'ilman', 'hyvin', 'paljon',
  ]),
  tr: new Set([
    'bir', 'olan', 'için', 'ile', 'olan', 'ama', 'daha', 'kadar', 'gibi',
    'çok', 'sonra', 'nasıl', 'var', 'yok', 'olarak', 'ancak', 'sadece',
    'başka', 'arasında', 'üzerinde', 'altında', 'önce', 'bunu', 'şey',
  ]),
};

export async function detectLanguage(doc: pdfjsLib.PDFDocumentProxy): Promise<SourceLanguage> {
  const pagesToSample = Math.min(doc.numPages, 3);
  let allText = '';
  const scores = new Map<string, number>();

  for (let i = 1; i <= pagesToSample; i++) {
    const page = await doc.getPage(i);
    const textContent = await page.getTextContent();

    for (const item of textContent.items) {
      if (!('str' in item) || !item.str.trim()) continue;
      allText += item.str + ' ';
    }
  }

  // 1. Try script-based detection first (for non-Latin scripts)
  const scriptResult = detectByScript(allText);
  if (scriptResult) return scriptResult;

  // 2. Word frequency analysis for Latin-script languages
  const words = allText.toLowerCase().split(/\s+/);
  for (const w of words) {
    const clean = w.replace(/[^\p{L}]/gu, '');
    if (!clean || clean.length < 2) continue;

    for (const [lang, markers] of Object.entries(MARKERS)) {
      if (markers.has(clean)) {
        scores.set(lang, (scores.get(lang) || 0) + 1);
      }
    }
  }

  // Find the language with the highest score
  let bestLang: SourceLanguage = 'en';
  let bestScore = 0;
  for (const [lang, score] of scores) {
    if (score > bestScore) {
      bestScore = score;
      bestLang = lang as SourceLanguage;
    }
  }

  return bestLang;
}
