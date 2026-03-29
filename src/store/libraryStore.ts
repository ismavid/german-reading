import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { SavedWord, WordLookupResult } from '../types/word';

interface LibraryState {
  words: SavedWord[];
  addWord: (result: WordLookupResult) => void;
  removeWord: (id: string) => void;
  hasWord: (word: string) => boolean;
  clear: () => void;
}

export const useLibraryStore = create<LibraryState>()(
  persist(
    (set, get) => ({
      words: [],

      addWord: (result) => {
        const normalized = result.word.toLowerCase();
        if (get().words.some((w) => w.word.toLowerCase() === normalized)) return;

        const saved: SavedWord = {
          id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          word: result.word,
          translation: result.translation,
          grammar: result.grammar,
          savedAt: Date.now(),
        };
        set((s) => ({ words: [...s.words, saved] }));
      },

      removeWord: (id) => {
        set((s) => ({ words: s.words.filter((w) => w.id !== id) }));
      },

      hasWord: (word) => {
        const normalized = word.toLowerCase();
        return get().words.some((w) => w.word.toLowerCase() === normalized);
      },

      clear: () => set({ words: [] }),
    }),
    { name: 'german-reading-library' }
  )
);
