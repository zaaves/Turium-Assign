import React from 'react';
import { FileText, Globe, ExternalLink, ChevronRight, Layers } from 'lucide-react';
import ProcessingBadge from './ProcessingBadge';

export default function ItemCard({ item, onClick, isSelected }) {
  const isUrl = item.sourceType === 'URL';
  const formattedDate = new Date(item.createdAt).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

  return (
    <div
      onClick={onClick}
      className={`group relative p-3.5 rounded-xl border transition-all cursor-pointer ${
        isSelected
          ? 'bg-indigo-50/60 border-indigo-300 ring-2 ring-indigo-500/10 shadow-sm'
          : 'bg-white border-slate-200/80 hover:border-slate-300 hover:shadow-sm'
      }`}
    >
      <div className="flex items-start justify-between gap-3 mb-2">
        <div className="flex items-center gap-2 min-w-0">
          <div
            className={`w-6 h-6 rounded-md flex items-center justify-center shrink-0 ${
              isUrl ? 'bg-sky-50 text-sky-600' : 'bg-indigo-50 text-indigo-600'
            }`}
          >
            {isUrl ? <Globe className="w-3.5 h-3.5" /> : <FileText className="w-3.5 h-3.5" />}
          </div>
          <h3 className="font-semibold text-xs text-slate-900 truncate group-hover:text-indigo-600 transition-colors">
            {item.title || (isUrl ? item.sourceUrl : 'Untitled Note')}
          </h3>
        </div>

        <ProcessingBadge status={item.status} />
      </div>

      {isUrl && item.sourceUrl && (
        <div className="flex items-center gap-1 text-[11px] text-slate-500 mb-2 truncate">
          <span className="truncate">{item.sourceUrl}</span>
          <a
            href={item.sourceUrl}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            className="text-slate-400 hover:text-indigo-600 shrink-0 p-0.5"
            title="Open original URL in new tab"
          >
            <ExternalLink className="w-3 h-3" />
          </a>
        </div>
      )}

      <div className="flex items-center justify-between text-[11px] text-slate-400 pt-2 border-t border-slate-100">
        <div className="flex items-center gap-3">
          <span>{formattedDate}</span>
          <span className="inline-flex items-center gap-1 font-mono text-[10px] bg-slate-100 px-1.5 py-0.5 rounded text-slate-600">
            <Layers className="w-2.5 h-2.5" />
            {item.chunkCount || 0} {item.chunkCount === 1 ? 'chunk' : 'chunks'}
          </span>
        </div>

        <ChevronRight className="w-3.5 h-3.5 text-slate-300 group-hover:text-indigo-500 group-hover:translate-x-0.5 transition-all" />
      </div>
    </div>
  );
}
