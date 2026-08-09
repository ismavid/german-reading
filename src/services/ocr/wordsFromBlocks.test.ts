import { describe, expect, it } from 'vitest';
import {
  cleanToken,
  endsWithSoftHyphen,
  joinHyphenated,
  wordsFromBlocks,
} from './wordsFromBlocks';
import type { OcrBlock, OcrWord } from './ocrTypes';

function word(text: string, confidence = 90, bbox = { x0: 0, y0: 0, x1: 40, y1: 20 }): OcrWord {
  return { text, confidence, bbox };
}

function blockOf(lines: OcrWord[][]): OcrBlock {
  return { paragraphs: [{ lines: lines.map((words) => ({ words })) }] };
}

describe('cleanToken', () => {
  it('strips punctuation from the edges but keeps letters inside', () => {
    expect(cleanToken('„Free')).toBe('Free');
    expect(cleanToken('Rainer“,')).toBe('Rainer');
    expect(cleanToken('(135')).toBe('135');
  });

  it('keeps umlauts and eszett intact', () => {
    expect(cleanToken('Wörter.')).toBe('Wörter');
    expect(cleanToken('»Straße«')).toBe('Straße');
  });

  it('returns empty for pure punctuation', () => {
    expect(cleanToken('—')).toBe('');
    expect(cleanToken('...')).toBe('');
  });
});

describe('endsWithSoftHyphen', () => {
  it('accepts a letter followed by a hyphen', () => {
    expect(endsWithSoftHyphen('Fernseh-')).toBe(true);
    expect(endsWithSoftHyphen('quoten-')).toBe(true);
  });

  it('rejects hyphens that are not word breaks', () => {
    expect(endsWithSoftHyphen('—')).toBe(false);
    expect(endsWithSoftHyphen('- ')).toBe(false);
    expect(endsWithSoftHyphen('Fernseher')).toBe(false);
  });
});

describe('joinHyphenated', () => {
  it('rejoins a word split across a line break', () => {
    expect(joinHyphenated('Fernseh-', 'macher')).toBe('Fernsehmacher');
    expect(joinHyphenated('quoten-', 'besessene')).toBe('quotenbesessene');
    expect(joinHyphenated('Spiel-', 'film.')).toBe('Spielfilm');
  });

  it('leaves a genuine hyphenated compound alone', () => {
    // A confidently-read uppercase continuation means the hyphen was real.
    expect(joinHyphenated('Kino-', 'Events', 95)).toBeNull();
  });

  it('still joins when the capital is an OCR error rather than the page', () => {
    // Observed on a page where the text column overlaps a photo: "macher" comes
    // back as "Macher" at confidence 61, so the case carries no information.
    expect(joinHyphenated('Fernseh-', 'Macher', 61)).toBe('Fernsehmacher');
  });

  it('returns null when the first half is not hyphenated', () => {
    expect(joinHyphenated('Fernseher', 'macher')).toBeNull();
  });
});

describe('wordsFromBlocks', () => {
  it('converts OCR pixels to PDF units using the render scale', () => {
    const blocks = [blockOf([[word('Programm', 90, { x0: 400, y0: 800, x1: 600, y1: 850 })]])];

    const [result] = wordsFromBlocks(blocks, { ocrScale: 4 });

    expect(result).toMatchObject({ word: 'Programm', x: 100, y: 200, width: 50, height: 12.5 });
  });

  it('drops words Tesseract is not confident about', () => {
    const blocks = [blockOf([[word('Programm', 90), word('|||', 12), word('rnaclier', 31)]])];

    const words = wordsFromBlocks(blocks, { ocrScale: 1 });

    expect(words.map((w) => w.word)).toEqual(['Programm']);
  });

  it('points both halves of a hyphenated break at the whole word', () => {
    const blocks = [
      blockOf([
        [word('Der'), word('Fernseh-')],
        [word('macher'), word('begreift')],
      ]),
    ];

    const words = wordsFromBlocks(blocks, { ocrScale: 1 });

    expect(words.map((w) => w.word)).toEqual([
      'Der',
      'Fernsehmacher',
      'Fernsehmacher',
      'begreift',
    ]);
  });

  it('steps over margin noise to find the continuation', () => {
    // Real shape of a studio d exercise box: the text column shares its line
    // with line-numbers and fragments of the photo beside it.
    const blocks = [
      blockOf([
        [word('gegen'), word('das'), word('quoten-')],
        [
          word('£', 0, { x0: 83, y0: 40, x1: 100, y1: 60 }),
          word('|', 76, { x0: 656, y0: 40, x1: 660, y1: 60 }),
          word('EEE', 33, { x0: 684, y0: 40, x1: 740, y1: 60 }),
          word('besessene', 90, { x0: 1399, y0: 40, x1: 1500, y1: 60 }),
        ],
      ]),
    ];

    const words = wordsFromBlocks(blocks, { ocrScale: 1 }).map((w) => w.word);

    expect(words).toContain('quotenbesessene');
    // The noise itself never becomes a hover target.
    expect(words).not.toContain('EEE');
    expect(words).not.toContain('£');
  });

  it('does not treat a margin line number as the continuation', () => {
    const blocks = [
      blockOf([
        [word('Fernseh-')],
        [word('10', 96), word('macher', 92)],
      ]),
    ];

    expect(wordsFromBlocks(blocks, { ocrScale: 1 }).map((w) => w.word)).toContain(
      'Fernsehmacher',
    );
  });

  it('joins across a paragraph boundary only within the same reading order', () => {
    const blocks = [
      {
        paragraphs: [
          { lines: [{ words: [word('Mittel-')] }] },
          { lines: [{ words: [word('europäer')] }] },
        ],
      },
    ];

    expect(wordsFromBlocks(blocks, { ocrScale: 1 }).map((w) => w.word)).toEqual([
      'Mitteleuropäer',
      'Mitteleuropäer',
    ]);
  });

  it('skips words that clean away to nothing', () => {
    const blocks = [blockOf([[word('—'), word('Absicht')]])];

    expect(wordsFromBlocks(blocks, { ocrScale: 1 }).map((w) => w.word)).toEqual(['Absicht']);
  });

  it('returns nothing for an empty or invalid result', () => {
    expect(wordsFromBlocks(null, { ocrScale: 4 })).toEqual([]);
    expect(wordsFromBlocks([], { ocrScale: 4 })).toEqual([]);
    expect(wordsFromBlocks([blockOf([[word('x')]])], { ocrScale: 0 })).toEqual([]);
  });

  it('discards degenerate boxes', () => {
    const blocks = [blockOf([[word('flat', 90, { x0: 10, y0: 10, x1: 10, y1: 30 })]])];

    expect(wordsFromBlocks(blocks, { ocrScale: 1 })).toEqual([]);
  });
});
