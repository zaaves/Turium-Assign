import React, { useState } from 'react';
import { X, Globe, FileText, ExternalLink, Copy, Check, AlertTriangle, Layers, Calendar } from 'lucide-react';
import ProcessingBadge from './ProcessingBadge';

export default function ItemDetailDrawer({ item, loading, error, onClose }) {
  const [copied, setCopied] = useState(false);

  if (!item && !loading && !error) return null;

  const handleCopy = () => {
    if (item?.rawContent) {
      navigator.clipboard.writeText(item.rawContent);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const isUrl = item?.sourceType === 'URL';

  return (
    <div className="fixed inset-0 z-50 overflow-hidden bg-slate-900/40 backdrop-blur-sm flex justify-end animate-in fade-in duration-200">
      <div
        className="w-full max-w-xl bg-white h-full shadow-2xl flex flex-col border-l border-slate-200 animate-in slide-in-from-right duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Drawer Header */}
        <div className="p-4 sm:p-5 border-b border-slate-200 flex items-start justify-between gap-4 bg-slate-50/70">
          <div className="flex items-start gap-3 min-w-0">
            <div
              className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 mt-0.5 ${
                isUrl ? 'bg-sky-50 text-sky-600' : 'bg-indigo-50 text-indigo-600'
              }`}
            >
              {isUrl ? <Globe className="w-4 h-4" /> : <FileText className="w-4 h-4" />}
            </div>
            <div className="min-w-0">
              <h2 className="font-semibold text-sm text-slate-900 truncate">
                {item?.title || (loading ? 'Loading Item...' : 'Item Details')}
              </h2>
              {isUrl && item?.sourceUrl && (
                <a
                  href={item.sourceUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-xs text-indigo-600 hover:text-indigo-800 hover:underline mt-0.5"
                >
                  <span className="truncate max-w-md">{item.sourceUrl}</span>
                  <ExternalLink className="w-3 h-3 shrink-0" />
                </a>
              )}
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 transition-colors"
            title="Close drawer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Drawer Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-5">
          {error && (
            <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs">
              {error}
            </div>
          )}

          {loading ? (
            <div className="py-20 flex flex-col items-center justify-center text-slate-400 gap-2 text-xs">
              <div className="w-6 h-6 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin" />
              <span>Fetching item details...</span>
            </div>
          ) : item ? (
            <>
              {/* Metadata Badges Bar */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 p-3 rounded-xl bg-slate-50 border border-slate-200/80 text-xs">
                <div>
                  <span className="block text-[10px] text-slate-400 uppercase tracking-wider mb-0.5">Status</span>
                  <ProcessingBadge status={item.status} size="sm" />
                </div>

                <div>
                  <span className="block text-[10px] text-slate-400 uppercase tracking-wider mb-0.5">Vector Chunks</span>
                  <span className="font-semibold text-slate-800 flex items-center gap-1">
                    <Layers className="w-3 h-3 text-slate-400" />
                    {item.chunkCount} {item.chunkCount === 1 ? 'chunk' : 'chunks'}
                  </span>
                </div>

                <div>
                  <span className="block text-[10px] text-slate-400 uppercase tracking-wider mb-0.5">Created</span>
                  <span className="font-medium text-slate-600 flex items-center gap-1 text-[11px]">
                    <Calendar className="w-3 h-3 text-slate-400" />
                    {new Date(item.createdAt).toLocaleDateString()}
                  </span>
                </div>
              </div>

              {/* Error Callout if FAILED */}
              {item.status === 'FAILED' && item.errorMessage && (
                <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 flex items-start gap-3 text-xs text-rose-800">
                  <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                  <div>
                    <strong className="block font-semibold mb-0.5">Ingestion Error:</strong>
                    <span>{item.errorMessage}</span>
                  </div>
                </div>
              )}

              {/* Raw / Extracted Content Container */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-xs font-semibold text-slate-900 uppercase tracking-wider">
                    {isUrl ? 'Extracted Page Content' : 'Raw Note Content'}
                  </h3>

                  <button
                    onClick={handleCopy}
                    className="inline-flex items-center gap-1.5 text-xs text-slate-500 hover:text-indigo-600 font-medium transition-colors"
                  >
                    {copied ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-emerald-600" />
                        <span className="text-emerald-600">Copied</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5" />
                        <span>Copy Text</span>
                      </>
                    )}
                  </button>
                </div>

                <div className="p-4 rounded-xl border border-slate-200 bg-slate-900 text-slate-100 font-mono text-xs leading-relaxed max-h-[420px] overflow-y-auto whitespace-pre-wrap selection:bg-indigo-600 selection:text-white">
                  {item.rawContent || (
                    <span className="text-slate-500 italic">No extracted content stored yet.</span>
                  )}
                </div>
              </div>

              {/* System UUID */}
              <div className="pt-4 border-t border-slate-100 text-[10px] text-slate-400 flex items-center justify-between font-mono">
                <span>Item ID: {item.id}</span>
                <span>Type: {item.sourceType}</span>
              </div>
            </>
          ) : null}
        </div>
      </div>
    </div>
  );
}
