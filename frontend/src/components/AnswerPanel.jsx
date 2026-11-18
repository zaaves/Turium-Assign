import React, { useState } from 'react';
import { Sparkles, Copy, Check, BookOpen, AlertCircle, Layers, ArrowUpRight } from 'lucide-react';
import SourceCitation from './SourceCitation';

export default function AnswerPanel({
  queryResult,
  querying,
  queryError,
  lastQuestion,
  highlightedSourceLabel,
  onHighlightCitation,
  onInspectSource,
}) {
  const [copied, setCopied] = useState(false);

  const handleCopyAnswer = () => {
    if (queryResult?.answer) {
      navigator.clipboard.writeText(queryResult.answer);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  /**
   * Parses answer text to replace [S1], [S2] tags with clickable citation buttons.
   */
  const renderFormattedAnswer = (text) => {
    if (!text) return null;

    const parts = [];
    const citationRegex = /\[(S\d+)\]/g;
    let lastIndex = 0;
    let match;

    while ((match = citationRegex.exec(text)) !== null) {
      const matchIndex = match.index;
      const label = match[1];

      // Add preceding plain text
      if (matchIndex > lastIndex) {
        parts.push(text.slice(lastIndex, matchIndex));
      }

      // Add clickable citation badge
      parts.push(
        <button
          key={`cite-${matchIndex}`}
          type="button"
          onClick={() => onHighlightCitation(label)}
          className="inline-flex items-center px-1.5 py-0.2 mx-0.5 rounded font-mono text-[11px] font-bold bg-indigo-100 text-indigo-700 hover:bg-indigo-200 transition-colors border border-indigo-200 align-baseline cursor-pointer"
          title={`Jump to source [${label}]`}
        >
          [{label}]
        </button>
      );

      lastIndex = matchIndex + match[0].length;
    }

    // Add remaining plain text
    if (lastIndex < text.length) {
      parts.push(text.slice(lastIndex));
    }

    return parts;
  };

  return (
    <div className="bg-white rounded-xl border border-slate-200/90 shadow-sm flex flex-col flex-1 overflow-hidden min-h-[460px]">
      {/* Header */}
      <div className="p-4 sm:p-5 border-b border-slate-200/80 flex items-center justify-between gap-3 bg-slate-50/70">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-md bg-indigo-600 flex items-center justify-center text-white">
            <Sparkles className="w-3.5 h-3.5" />
          </div>
          <div>
            <h2 className="font-semibold text-xs sm:text-sm text-slate-900 leading-tight">
              AI Grounded Response
            </h2>
            <p className="text-[10px] text-slate-400">Grounded strictly in retrieved database chunks</p>
          </div>
        </div>

        {queryResult?.answer && (
          <button
            onClick={handleCopyAnswer}
            className="inline-flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-800 transition-colors py-1 px-2 rounded-lg hover:bg-slate-200/50"
            title="Copy answer to clipboard"
          >
            {copied ? (
              <>
                <Check className="w-3.5 h-3.5 text-emerald-600" />
                <span className="text-emerald-600 font-medium">Copied</span>
              </>
            ) : (
              <>
                <Copy className="w-3.5 h-3.5" />
                <span>Copy</span>
              </>
            )}
          </button>
        )}
      </div>

      {/* Content Area */}
      <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6">
        {queryError && (
          <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 flex items-start gap-3 text-xs text-rose-800 animate-in fade-in">
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
            <div>
              <strong className="block font-semibold mb-0.5">Query Error:</strong>
              <span>{queryError}</span>
            </div>
          </div>
        )}

        {querying ? (
          <div className="py-20 flex flex-col items-center justify-center text-center gap-3">
            <div className="w-8 h-8 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin" />
            <div className="space-y-1">
              <p className="text-xs font-semibold text-slate-800">Embedding question & retrieving context...</p>
              <p className="text-[11px] text-slate-400">Comparing cosine similarity across indexed vectors</p>
            </div>
          </div>
        ) : queryResult ? (
          <div className="space-y-6 animate-in fade-in duration-200">
            {/* User Question Echo */}
            {lastQuestion && (
              <div className="p-3 rounded-lg bg-slate-50 border border-slate-200/80 text-xs">
                <span className="text-[10px] uppercase tracking-wider font-semibold text-slate-400 block mb-1">
                  Question
                </span>
                <p className="text-slate-800 font-medium">{lastQuestion}</p>
              </div>
            )}

            {/* Answer Display */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-[10px] uppercase tracking-wider font-semibold text-slate-400">
                  Grounded Synthesis
                </span>

                {queryResult.retrieval && (
                  <span className="inline-flex items-center gap-1.5 text-[10px] font-mono text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full">
                    <Layers className="w-3 h-3 text-slate-400" />
                    {queryResult.retrieval.chunksRetrieved} chunks retrieved &bull; top sim:{' '}
                    {queryResult.retrieval.topSimilarity}
                  </span>
                )}
              </div>

              <div className="p-4 rounded-xl bg-indigo-50/30 border border-indigo-100/80 text-slate-800 text-xs sm:text-sm leading-relaxed whitespace-pre-line selection:bg-indigo-100">
                {renderFormattedAnswer(queryResult.answer)}
              </div>
            </div>

            {/* Sources & Citations Grid */}
            {queryResult.sources && queryResult.sources.length > 0 && (
              <div>
                <div className="flex items-center justify-between mb-2.5">
                  <span className="text-[10px] uppercase tracking-wider font-semibold text-slate-400 flex items-center gap-1.5">
                    <BookOpen className="w-3.5 h-3.5 text-indigo-600" />
                    Verified Citations & Sources ({queryResult.sources.length})
                  </span>
                  <span className="text-[11px] text-slate-400">Click citation badge or inspect document</span>
                </div>

                <div className="grid grid-cols-1 gap-2.5">
                  {queryResult.sources.map((source) => (
                    <SourceCitation
                      key={source.label}
                      source={source}
                      isHighlighted={highlightedSourceLabel === source.label}
                      onInspect={onInspectSource}
                    />
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : (
          /* Empty Assistant State */
          <div className="py-24 flex flex-col items-center justify-center text-center px-4">
            <div className="w-12 h-12 rounded-2xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 mb-3 shadow-sm">
              <Sparkles className="w-6 h-6" />
            </div>
            <h3 className="text-xs sm:text-sm font-semibold text-slate-800 mb-1">
              Ask your Knowledge Inbox
            </h3>
            <p className="text-xs text-slate-400 max-w-sm leading-relaxed">
              Submit a natural language question above. The engine will retrieve the most similar passages from your
              saved notes and web pages, synthesizing a grounded answer with verifiable citations.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
