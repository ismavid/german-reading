import type { SavedWord } from '../types/word';

function formatFront(w: SavedWord): string {
  const { word, grammar } = w;

  // German-specific formatting
  if (!w.language || w.language === 'de') {
    if (grammar.type === 'Substantiv') {
      const article = grammar.gender || '';
      const plural = grammar.plural ? ` (${grammar.plural})` : '';
      return article ? `${article} ${word}${plural}` : `${word}${plural}`;
    }

    if (grammar.type === 'Verb') {
      if (grammar.partizipII) {
        const aux = grammar.auxiliary === 'sein' ? 'sein ' : '';
        return `${word} (${aux}${grammar.partizipII})`;
      }
      return word;
    }
  }

  return word;
}

export function exportToAnki(words: SavedWord[]): void {
  if (words.length === 0) return;

  const lines = ['#separator:tab', '#html:false', '#columns:Front\tBack\tTags', ''];

  for (const w of words) {
    const front = formatFront(w);
    const back = w.translation;
    const langTag = w.language === 'en' ? 'english-reading' : 'german-reading';
    const tag = w.grammar.type.toLowerCase().replace(/ä/g, 'ae').replace(/ü/g, 'ue').replace(/ö/g, 'oe');
    lines.push(`${front}\t${back}\t${tag} ${langTag}`);
  }

  const content = lines.join('\n');
  const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  const date = new Date().toISOString().slice(0, 10);
  a.download = `vocabulary-${date}.txt`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
