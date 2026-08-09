import { useState } from 'react';
import { usePdfStore } from './store/pdfStore';
import { useLibraryStore } from './store/libraryStore';
import { SUPPORTED_LANGUAGES, TARGET_LABELS } from './types/word';
import type { SourceLanguage, TargetLanguage } from './types/word';
import { PdfUploader } from './components/PdfUploader';
import { PdfViewer } from './components/PdfViewer';
import { WordLibrary } from './components/WordLibrary';

export default function App() {
  const hasDocument = usePdfStore((s) => !!s.document);
  const sourceLanguage = usePdfStore((s) => s.sourceLanguage);
  const targetLanguage = usePdfStore((s) => s.targetLanguage);
  const setTargetLanguage = usePdfStore((s) => s.setTargetLanguage);
  const setSourceLanguage = usePdfStore((s) => s.setSourceLanguage);
  const isScanned = usePdfStore((s) => s.isScanned);
  const wordCount = useLibraryStore((s) => s.words.length);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const tgtInfo = TARGET_LABELS[targetLanguage];
  const sourceOptions = Object.entries(SUPPORTED_LANGUAGES) as [SourceLanguage, { name: string; flag: string }][];

  const toggleTarget = () => {
    const next: TargetLanguage = targetLanguage === 'en' ? 'es' : 'en';
    setTargetLanguage(next);
  };

  return (
    <div className="h-full flex">
      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top bar */}
        <header className="flex items-center justify-between px-5 py-3 bg-white border-b border-slate-100 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-primary-500 flex items-center justify-center">
              <span className="text-white text-xs font-bold">L</span>
            </div>
            <span className="text-sm font-semibold text-slate-800 tracking-tight">
              Lesehelfer
            </span>
          </div>

          {hasDocument && (
            <div className="flex items-center gap-3">
              {isScanned && (
                <span
                  className="flex items-center gap-1 text-[11px] font-medium px-2 py-1 rounded-full bg-amber-50 text-amber-600"
                  title="This book has no text layer — words are recognised from the page image as you read"
                >
                  <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 4.5h4.5m-4.5 0v4.5m0-4.5L9 9.75M20.25 4.5h-4.5m4.5 0v4.5m0-4.5L15 9.75M3.75 19.5h4.5m-4.5 0V15m0 4.5L9 14.25m11.25 5.25h-4.5m4.5 0V15m0 4.5L15 14.25" />
                  </svg>
                  Scanned
                </span>
              )}

              {/* Language pair — source is a picker, target toggles */}
              <div className="flex items-center gap-1.5 text-[11px] font-medium px-2.5 py-1 rounded-full bg-slate-100 text-slate-600">
                <select
                  value={sourceLanguage}
                  onChange={(e) => setSourceLanguage(e.target.value as SourceLanguage)}
                  className="bg-transparent outline-none cursor-pointer hover:text-slate-900 transition-colors"
                  title="Language of the book — change it if this was detected wrongly"
                >
                  {sourceOptions.map(([code, info]) => (
                    <option key={code} value={code}>{info.flag} {info.name}</option>
                  ))}
                </select>
                <span className="text-slate-400">→</span>
                <button
                  onClick={toggleTarget}
                  className="hover:text-slate-900 transition-colors"
                  title="Click to toggle target language"
                >
                  {tgtInfo.flag} {tgtInfo.name}
                </button>
              </div>

              <button
                onClick={() => setSidebarOpen(!sidebarOpen)}
                className={`flex items-center gap-2 text-sm px-3 py-1.5 rounded-lg transition-colors ${
                  sidebarOpen
                    ? 'bg-primary-50 text-primary-600'
                    : 'text-slate-500 hover:bg-slate-50 hover:text-slate-700'
                }`}
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25" />
                </svg>
                Library
                {wordCount > 0 && (
                  <span className="bg-primary-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full min-w-[18px] text-center">
                    {wordCount}
                  </span>
                )}
              </button>
            </div>
          )}
        </header>

        {/* Content area */}
        <main className="flex-1 min-h-0">
          {hasDocument ? <PdfViewer /> : <PdfUploader />}
        </main>
      </div>

      {/* Sidebar */}
      {sidebarOpen && hasDocument && (
        <aside className="w-72 shrink-0">
          <WordLibrary />
        </aside>
      )}
    </div>
  );
}
