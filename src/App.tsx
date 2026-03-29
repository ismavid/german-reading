import { useState } from 'react';
import { usePdfStore } from './store/pdfStore';
import { useLibraryStore } from './store/libraryStore';
import { LANGUAGE_LABELS } from './types/word';
import { PdfUploader } from './components/PdfUploader';
import { PdfViewer } from './components/PdfViewer';
import { WordLibrary } from './components/WordLibrary';

export default function App() {
  const hasDocument = usePdfStore((s) => !!s.document);
  const language = usePdfStore((s) => s.language);
  const wordCount = useLibraryStore((s) => s.words.length);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const langInfo = LANGUAGE_LABELS[language];

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
              <span className="text-[11px] font-medium px-2 py-1 rounded-full bg-slate-100 text-slate-500">
                {langInfo.flag} → {langInfo.target}
              </span>
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
