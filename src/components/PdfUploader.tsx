import { useCallback, useEffect, useRef, useState } from 'react';
import { loadPdfDocument } from '../services/pdfLoader';
import { detectLanguage } from '../services/languageDetector';
import { savePdf, getRecentPdfs, loadPdfData, removePdf, type PdfHistoryMeta } from '../services/pdfHistory';
import { usePdfStore } from '../store/pdfStore';

export function PdfUploader() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [loading, setLoading] = useState(false);
  const [recentPdfs, setRecentPdfs] = useState<PdfHistoryMeta[]>([]);
  const setDocument = usePdfStore((s) => s.setDocument);
  const setSourceLanguage = usePdfStore((s) => s.setSourceLanguage);

  useEffect(() => {
    getRecentPdfs().then(setRecentPdfs).catch(() => {});
  }, []);

  const openPdfBuffer = useCallback(
    async (buffer: ArrayBuffer, fileName: string) => {
      setLoading(true);
      try {
        // Clone the buffer before pdf.js consumes it (transfers/detaches the original)
        const bufferCopy = buffer.slice(0);
        const doc = await loadPdfDocument(buffer);
        const lang = await detectLanguage(doc);
        await savePdf(fileName, bufferCopy, doc.numPages);
        setDocument(doc, fileName);
        setSourceLanguage(lang);
      } catch (e) {
        console.error('Failed to load PDF:', e);
      } finally {
        setLoading(false);
      }
    },
    [setDocument, setSourceLanguage]
  );

  const handleFile = useCallback(
    async (file: File) => {
      if (file.type !== 'application/pdf') return;
      const buffer = await file.arrayBuffer();
      await openPdfBuffer(buffer, file.name);
    },
    [openPdfBuffer]
  );

  const handleOpenRecent = useCallback(
    async (meta: PdfHistoryMeta) => {
      setLoading(true);
      try {
        const data = await loadPdfData(meta.id);
        if (data) {
          await openPdfBuffer(data, meta.fileName);
        }
      } catch (e) {
        console.error('Failed to load recent PDF:', e);
      } finally {
        setLoading(false);
      }
    },
    [openPdfBuffer]
  );

  const handleRemoveRecent = useCallback(
    async (e: React.MouseEvent, id: string) => {
      e.stopPropagation();
      await removePdf(id);
      setRecentPdfs((prev) => prev.filter((p) => p.id !== id));
    },
    []
  );

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragging(false);
      const file = e.dataTransfer.files[0];
      if (file) handleFile(file);
    },
    [handleFile]
  );

  const timeAgo = (ts: number) => {
    const mins = Math.floor((Date.now() - ts) / 60000);
    if (mins < 1) return 'just now';
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    const days = Math.floor(hrs / 24);
    return `${days}d ago`;
  };

  return (
    <div
      className={`flex flex-col items-center justify-center h-full transition-colors duration-200 ${
        dragging ? 'bg-primary-50' : ''
      }`}
      onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
      onDragLeave={() => setDragging(false)}
      onDrop={onDrop}
    >
      <div className="flex flex-col items-center gap-8 max-w-lg w-full px-6">
        {/* Upload area */}
        <div
          className={`flex flex-col items-center gap-5 p-12 w-full border-2 border-dashed rounded-2xl transition-all duration-200 cursor-pointer ${
            dragging
              ? 'border-primary-400 bg-primary-50 scale-[1.02]'
              : 'border-slate-200 hover:border-primary-300 hover:bg-slate-50'
          }`}
          onClick={() => inputRef.current?.click()}
        >
          <div className="w-14 h-14 rounded-2xl bg-primary-50 flex items-center justify-center">
            <svg className="w-7 h-7 text-primary-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m6.75 12l-3-3m0 0l-3 3m3-3v6m-1.5-15H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
            </svg>
          </div>

          {loading ? (
            <div className="flex items-center gap-3 text-primary-600">
              <div className="w-5 h-5 border-2 border-primary-300 border-t-primary-600 rounded-full animate-spin" />
              <span className="text-sm font-medium">Loading PDF...</span>
            </div>
          ) : (
            <div className="text-center">
              <p className="text-lg font-semibold text-slate-800">Drop a PDF here</p>
              <p className="text-sm text-slate-500 mt-1">or click to browse files</p>
            </div>
          )}

          <input
            ref={inputRef}
            type="file"
            accept=".pdf"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) handleFile(file);
            }}
          />
        </div>

        {/* Recent PDFs */}
        {recentPdfs.length > 0 && (
          <div className="w-full">
            <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2 px-1">
              Recent
            </h3>
            <div className="space-y-1">
              {recentPdfs.map((pdf) => (
                <button
                  key={pdf.id}
                  onClick={() => handleOpenRecent(pdf)}
                  className="group w-full flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-white hover:shadow-sm border border-transparent hover:border-slate-100 transition-all text-left"
                >
                  <div className="w-8 h-8 rounded-lg bg-red-50 flex items-center justify-center shrink-0">
                    <svg className="w-4 h-4 text-red-400" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M7 2a2 2 0 00-2 2v16a2 2 0 002 2h10a2 2 0 002-2V8l-6-6H7zm5 1.5L17.5 9H13a1 1 0 01-1-1V3.5z" />
                    </svg>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-slate-700 truncate">
                      {pdf.fileName}
                    </p>
                    <p className="text-[11px] text-slate-400">
                      {pdf.pageCount} pages · {timeAgo(pdf.lastOpened)}
                    </p>
                  </div>
                  <span
                    onClick={(e) => handleRemoveRecent(e, pdf.id)}
                    className="opacity-0 group-hover:opacity-100 text-slate-300 hover:text-red-400 p-1 transition-all"
                    title="Remove from history"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
