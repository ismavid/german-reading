import { usePdfStore } from '../store/pdfStore';
import { PdfPage } from './PdfPage';

export function PdfViewer() {
  const document = usePdfStore((s) => s.document);
  const numPages = usePdfStore((s) => s.numPages);
  const scale = usePdfStore((s) => s.scale);
  const setScale = usePdfStore((s) => s.setScale);
  const fileName = usePdfStore((s) => s.fileName);
  const reset = usePdfStore((s) => s.reset);

  if (!document) return null;

  const pages = Array.from({ length: numPages }, (_, i) => i + 1);

  return (
    <div className="flex flex-col h-full">
      {/* Toolbar */}
      <div className="flex items-center justify-between px-5 py-2.5 bg-white border-b border-slate-100 shrink-0">
        <div className="flex items-center gap-3">
          <button
            onClick={reset}
            className="text-slate-400 hover:text-slate-600 transition-colors p-1"
            title="Close PDF"
          >
            <svg className="w-4.5 h-4.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
          <span className="text-sm text-slate-600 font-medium truncate max-w-[200px]">
            {fileName}
          </span>
          <span className="text-xs text-slate-400">
            {numPages} page{numPages !== 1 ? 's' : ''}
          </span>
        </div>

        <div className="flex items-center gap-1.5">
          <button
            onClick={() => setScale(Math.max(0.5, scale - 0.25))}
            className="px-2.5 py-1 text-sm text-slate-500 hover:text-slate-800 hover:bg-slate-50 rounded-lg transition-colors"
          >
            −
          </button>
          <span className="text-xs text-slate-500 w-12 text-center font-medium">
            {Math.round(scale * 100)}%
          </span>
          <button
            onClick={() => setScale(Math.min(3, scale + 0.25))}
            className="px-2.5 py-1 text-sm text-slate-500 hover:text-slate-800 hover:bg-slate-50 rounded-lg transition-colors"
          >
            +
          </button>
        </div>
      </div>

      {/* Pages */}
      <div className="flex-1 overflow-auto custom-scroll bg-slate-50 p-8">
        {pages.map((pageNum) => (
          <PdfPage
            key={pageNum}
            document={document}
            pageNumber={pageNum}
            scale={scale}
          />
        ))}
      </div>
    </div>
  );
}
