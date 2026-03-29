import { useState, useMemo } from 'react';
import { useLibraryStore } from '../store/libraryStore';
import { usePdfStore } from '../store/pdfStore';
import { exportToAnki } from '../services/ankiExporter';
import type { WordType } from '../types/word';
import { WORD_TYPE_COLORS, WORD_TYPE_LABELS } from '../types/word';

const ALL_TYPES: WordType[] = [
  'Substantiv', 'Verb', 'Adjektiv', 'Adverb',
  'Präposition', 'Konjunktion', 'Pronomen', 'Artikel', 'Andere',
];

export function WordLibrary() {
  const words = useLibraryStore((s) => s.words);
  const removeWord = useLibraryStore((s) => s.removeWord);
  const clearAll = useLibraryStore((s) => s.clear);
  const targetLanguage = usePdfStore((s) => s.targetLanguage);
  const labels = WORD_TYPE_LABELS[targetLanguage];
  const [activeFilter, setActiveFilter] = useState<WordType | 'all'>('all');

  const grouped = useMemo(() => {
    const map = new Map<WordType, typeof words>();
    for (const w of words) {
      const list = map.get(w.grammar.type) || [];
      list.push(w);
      map.set(w.grammar.type, list);
    }
    return map;
  }, [words]);

  const filtered = activeFilter === 'all' ? words : (grouped.get(activeFilter) || []);

  const typeCounts = useMemo(() => {
    const counts = new Map<WordType, number>();
    for (const w of words) {
      counts.set(w.grammar.type, (counts.get(w.grammar.type) || 0) + 1);
    }
    return counts;
  }, [words]);

  return (
    <div className="flex flex-col h-full bg-white border-l border-slate-100">
      {/* Header */}
      <div className="px-4 pt-4 pb-3 border-b border-slate-50">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-slate-800">Library</h2>
          <span className="text-xs text-slate-400 font-medium">{words.length} words</span>
        </div>

        {/* Filter chips */}
        <div className="flex flex-wrap gap-1">
          <button
            onClick={() => setActiveFilter('all')}
            className={`text-[11px] px-2 py-1 rounded-full font-medium transition-colors ${
              activeFilter === 'all'
                ? 'bg-slate-800 text-white'
                : 'bg-slate-50 text-slate-500 hover:bg-slate-100'
            }`}
          >
            All
          </button>
          {ALL_TYPES.map((type) => {
            const count = typeCounts.get(type) || 0;
            if (count === 0) return null;
            return (
              <button
                key={type}
                onClick={() => setActiveFilter(type)}
                className={`text-[11px] px-2 py-1 rounded-full font-medium transition-colors ${
                  activeFilter === type
                    ? 'text-white'
                    : 'bg-slate-50 text-slate-500 hover:bg-slate-100'
                }`}
                style={
                  activeFilter === type
                    ? { backgroundColor: WORD_TYPE_COLORS[type] }
                    : undefined
                }
              >
                {labels[type]} ({count})
              </button>
            );
          })}
        </div>
      </div>

      {/* Word list */}
      <div className="flex-1 overflow-auto custom-scroll px-3 py-2">
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-32 text-center">
            <p className="text-xs text-slate-400">
              {words.length === 0
                ? 'Hover over words in the PDF and click "Save" to build your library'
                : 'No words in this category'}
            </p>
          </div>
        ) : (
          <div className="space-y-1">
            {filtered.map((w) => (
              <div
                key={w.id}
                className="group flex items-start gap-2 px-2.5 py-2 rounded-lg hover:bg-slate-50 transition-colors"
              >
                <span
                  className="w-1.5 h-1.5 rounded-full mt-1.5 shrink-0"
                  style={{ backgroundColor: WORD_TYPE_COLORS[w.grammar.type] }}
                />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="text-sm font-medium text-slate-800 truncate">
                      {w.grammar.gender ? `${w.grammar.gender} ` : ''}
                      {w.word}
                    </span>
                    {w.grammar.plural && (
                      <span className="text-[10px] text-slate-400">
                        ({w.grammar.plural})
                      </span>
                    )}
                    {w.grammar.partizipII && (
                      <span className="text-[10px] text-slate-400">
                        ({w.grammar.auxiliary === 'sein' ? 'sein ' : ''}{w.grammar.partizipII})
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-500 truncate">{w.translation}</p>
                </div>
                <button
                  onClick={() => removeWord(w.id)}
                  className="opacity-0 group-hover:opacity-100 text-slate-300 hover:text-red-400 transition-all p-0.5"
                  title="Remove"
                >
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Actions */}
      {words.length > 0 && (
        <div className="px-4 py-3 border-t border-slate-50 space-y-2">
          <button
            onClick={() => exportToAnki(filtered.length > 0 ? filtered : words)}
            className="w-full text-sm font-medium px-3 py-2 rounded-lg bg-primary-500 text-white hover:bg-primary-600 active:scale-[0.98] transition-all"
          >
            Export for Anki ({filtered.length} words)
          </button>
          <button
            onClick={clearAll}
            className="w-full text-xs text-slate-400 hover:text-red-500 transition-colors py-1"
          >
            Clear all words
          </button>
        </div>
      )}
    </div>
  );
}
