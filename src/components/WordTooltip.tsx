import {
  useFloating,
  offset,
  flip,
  shift,
  autoUpdate,
} from '@floating-ui/react';
import { useEffect, useRef, useState, useCallback } from 'react';
import type { WordLookupResult, SourceLanguage, TargetLanguage } from '../types/word';
import { WORD_TYPE_COLORS } from '../types/word';
import { lookupWord } from '../services/dictionaryService';
import { useLibraryStore } from '../store/libraryStore';

interface Props {
  word: string | null;
  anchorEl: HTMLElement | null;
  onClose: () => void;
  sourceLanguage: SourceLanguage;
  targetLanguage: TargetLanguage;
}

function formatSourceSide(r: WordLookupResult): string {
  const { word, grammar, sourceLanguage } = r;
  // German-specific formatting
  if (sourceLanguage === 'de') {
    if (grammar.type === 'Substantiv' && grammar.gender) {
      const plural = grammar.plural ? ` (${grammar.plural})` : '';
      return `${grammar.gender} ${word}${plural}`;
    }
    if (grammar.type === 'Verb' && grammar.partizipII) {
      const aux = grammar.auxiliary === 'sein' ? 'sein ' : '';
      return `${word} (${aux}${grammar.partizipII})`;
    }
  }
  return word;
}

export function WordTooltip({ word, anchorEl, onClose, sourceLanguage, targetLanguage }: Props) {
  const [result, setResult] = useState<WordLookupResult | null>(null);
  const [loading, setLoading] = useState(false);
  const isOverTooltip = useRef(false);
  const isOverAnchor = useRef(true);
  const closeTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const addWord = useLibraryStore((s) => s.addWord);
  const hasWord = useLibraryStore((s) => s.hasWord);

  const { refs, floatingStyles } = useFloating({
    open: !!word,
    placement: 'top',
    middleware: [offset(10), flip(), shift({ padding: 12 })],
    whileElementsMounted: autoUpdate,
    elements: {
      reference: anchorEl,
    },
  });

  useEffect(() => {
    if (!word) {
      setResult(null);
      return;
    }
    setLoading(true);
    let cancelled = false;
    lookupWord(word, sourceLanguage, targetLanguage).then((r) => {
      if (!cancelled) {
        setResult(r);
        setLoading(false);
      }
    });
    return () => { cancelled = true; };
  }, [word, sourceLanguage, targetLanguage]);

  const scheduleClose = useCallback(() => {
    if (closeTimer.current) clearTimeout(closeTimer.current);
    closeTimer.current = setTimeout(() => {
      if (!isOverTooltip.current && !isOverAnchor.current) {
        onClose();
      }
    }, 400);
  }, [onClose]);

  useEffect(() => {
    if (!anchorEl) return;
    isOverAnchor.current = true;

    const handleLeave = () => {
      isOverAnchor.current = false;
      scheduleClose();
    };
    const handleEnter = () => {
      isOverAnchor.current = true;
      if (closeTimer.current) clearTimeout(closeTimer.current);
    };

    anchorEl.addEventListener('mouseleave', handleLeave);
    anchorEl.addEventListener('mouseenter', handleEnter);
    return () => {
      anchorEl.removeEventListener('mouseleave', handleLeave);
      anchorEl.removeEventListener('mouseenter', handleEnter);
    };
  }, [anchorEl, scheduleClose]);

  useEffect(() => {
    return () => { if (closeTimer.current) clearTimeout(closeTimer.current); };
  }, []);

  if (!word) return null;

  const saved = result ? hasWord(result.word) : false;
  const typeColor = result ? WORD_TYPE_COLORS[result.grammar.type] : '#94a3b8';

  return (
    <div
      ref={refs.setFloating}
      style={{ ...floatingStyles, pointerEvents: 'auto' }}
      className="tooltip-enter z-50"
      onMouseEnter={() => {
        isOverTooltip.current = true;
        if (closeTimer.current) clearTimeout(closeTimer.current);
      }}
      onMouseLeave={() => {
        isOverTooltip.current = false;
        scheduleClose();
      }}
    >
      <div className="absolute left-0 right-0 -bottom-3 h-3" />

      <div className="bg-white rounded-lg shadow-lg shadow-black/8 border border-slate-100 px-3 py-2 max-w-[280px]">
        {loading ? (
          <div className="flex items-center gap-2 text-slate-400 text-xs">
            <div className="w-3 h-3 border-2 border-slate-200 border-t-primary-500 rounded-full animate-spin" />
            ...
          </div>
        ) : result ? (
          <div className="flex items-start gap-2">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5">
                <span className="font-semibold text-slate-900 text-sm leading-tight">
                  {formatSourceSide(result)}
                </span>
                <span
                  className="text-[9px] font-semibold px-1 py-px rounded text-white shrink-0 uppercase tracking-wide"
                  style={{ backgroundColor: typeColor }}
                >
                  {result.grammar.type.slice(0, 3)}
                </span>
              </div>
              <p className="text-xs text-slate-600 mt-0.5 leading-snug">
                {result.translation}
              </p>
            </div>

            <button
              onClick={() => { if (!saved) addWord(result); }}
              className={`shrink-0 mt-0.5 p-1 rounded-md transition-all duration-150 ${
                saved
                  ? 'text-primary-400 cursor-default'
                  : 'text-slate-300 hover:text-primary-500 hover:bg-primary-50 active:scale-90'
              }`}
              title={saved ? 'Saved' : 'Save to library'}
            >
              {saved ? (
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
                </svg>
              ) : (
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
                </svg>
              )}
            </button>
          </div>
        ) : (
          <span className="text-xs text-slate-400">No result</span>
        )}
      </div>
    </div>
  );
}
