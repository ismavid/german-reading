import { describe, expect, it } from 'vitest';
import { makeCacheKey, makeDocId } from './ocrCache';

describe('makeDocId', () => {
  it('distinguishes documents that differ in size or length', () => {
    const a = makeDocId('studio d B2.pdf', 200782413, 234);
    const b = makeDocId('studio d B2.pdf', 200782413, 234);
    const differentSize = makeDocId('studio d B2.pdf', 12855103, 234);
    const differentPages = makeDocId('studio d B2.pdf', 200782413, 120);

    expect(a).toBe(b);
    expect(a).not.toBe(differentSize);
    expect(a).not.toBe(differentPages);
  });
});

describe('makeCacheKey', () => {
  const docId = makeDocId('book.pdf', 100, 10);

  it('separates pages and languages', () => {
    expect(makeCacheKey(docId, 1, 'deu')).not.toBe(makeCacheKey(docId, 2, 'deu'));
    expect(makeCacheKey(docId, 1, 'deu')).not.toBe(makeCacheKey(docId, 1, 'eng'));
  });

  it('is stable for the same inputs', () => {
    expect(makeCacheKey(docId, 7, 'deu')).toBe(makeCacheKey(docId, 7, 'deu'));
  });

  it('carries a schema version so old results can be invalidated', () => {
    expect(makeCacheKey(docId, 1, 'deu')).toMatch(/\|v\d+$/);
  });
});
