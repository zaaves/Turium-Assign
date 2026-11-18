import React from 'react';
import { ExternalLink, FileText, Globe, Eye } from 'lucide-react';

export default function SourceCitation({ source, isHighlighted, onInspect }) {
  const isUrl = source.sourceType === 'URL';

  return (
    <div
      id={`source-card-${source.label}`}
      className={`p-3.5 rounded-xl border text-xs transition-all ${
        isHighlighted
          ? 'bg-indigo-50/80 border-indigo-400 ring-2 ring-indigo-500/20 shadow-sm'
          : 'bg-white border-slate-200/90 hover:border-slate-300'
      }`}
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="flex items-center gap-2 min-w-0">
          <span className="font-mono font-bold text-xs bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded shrink-0">
            [{source.label}]
          </span>

          <span
            className="font-semibold text-slate-900 truncate hover:text-indigo-600 cursor-pointer"
            onClick={() => onInspect(source.itemId)}
            title="Inspect document"
          >
            {source.title}
          </span>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          {isUrl && source.sourceUrl && (
            <a
              href={source.sourceUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-slate-400 hover:text-indigo-600 p-0.5"
              title="Open source URL"
            >
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
          )}

          <button
            onClick={() => onInspect(source.itemId)}
            className="text-slate-400 hover:text-indigo-600 p-0.5"
            title="View full source"
          >
            <Eye className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Snippet */}
      <p className="text-slate-600 text-[11px] leading-relaxed bg-slate-50/80 p-2.5 rounded-lg border border-slate-100 italic">
        "{source.snippet}"
      </p>

      {/* Footer Info */}
      <div className="flex items-center justify-between mt-2 pt-1 text-[10px] text-slate-400 font-mono">
        <span className="flex items-center gap-1">
          {isUrl ? <Globe className="w-2.5 h-2.5" /> : <FileText className="w-2.5 h-2.5" />}
          {source.sourceType}
        </span>
        <span>Chunk: {source.chunkId.slice(0, 8)}...</span>
      </div>
    </div>
  );
}
