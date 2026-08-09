import { describe, expect, it } from 'vitest';
import { isScannedFromSamples, samplePageNumbers } from './scanDetector';

describe('samplePageNumbers', () => {
  it('takes every page when the document is short', () => {
    expect(samplePageNumbers(3)).toEqual([1, 2, 3]);
  });

  it('spreads samples through the body rather than clustering at the front', () => {
    const pages = samplePageNumbers(234);

    expect(pages).toHaveLength(5);
    expect(pages[0]).toBeGreaterThan(1);
    expect(pages[pages.length - 1]).toBeLessThan(234);
    expect([...pages].sort((a, b) => a - b)).toEqual(pages);
  });

  it('stays within bounds for awkward page counts', () => {
    for (const count of [6, 7, 11, 100, 1961]) {
      for (const page of samplePageNumbers(count)) {
        expect(page).toBeGreaterThanOrEqual(1);
        expect(page).toBeLessThanOrEqual(count);
      }
    }
  });
});

describe('isScannedFromSamples', () => {
  it('treats an empty text layer as scanned', () => {
    expect(isScannedFromSamples(0)).toBe(true);
  });

  it('tolerates a stray watermark without calling a real text layer scanned', () => {
    expect(isScannedFromSamples(5)).toBe(true);
    expect(isScannedFromSamples(2000)).toBe(false);
  });
});
