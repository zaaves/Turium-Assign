import React, { useState } from 'react';
import { Sparkles, ArrowRight, Loader2, SlidersHorizontal } from 'lucide-react';

const SUGGESTIONS = [
  'What are the key components of the system?',
  'How does asynchronous URL ingestion work?',
  'What chunking strategy is used for plain text?',
  'Explain the cosine similarity retrieval approach',
];

export default function QuestionForm({ onSubmit, querying, disabled }) {
  const [question, setQuestion] = useState('');
  const [topK, setTopK] = useState(5);
  const [showSettings, setShowSettings] = useState(false);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (question.trim() && !querying && !disabled) {
      onSubmit(question.trim(), topK);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  const handleSuggestionClick = (text) => {
    setQuestion(text);
    if (!querying && !disabled) {
      onSubmit(text, topK);
    }
  };

  return (
    <div className="bg-white rounded-xl border border-slate-200/90 shadow-sm p-4 sm:p-5">
      <form onSubmit={handleSubmit} className="space-y-3">
        <div className="relative">
          <textarea
            rows={3}
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask a natural-language question grounded in your saved notes and URLs..."
            disabled={querying || disabled}
            className="w-full text-xs sm:text-sm p-3.5 pr-12 rounded-xl border border-slate-300 bg-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 transition-colors leading-relaxed disabled:opacity-60 resize-none"
          />

          <div className="absolute right-3 bottom-3 flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => setShowSettings(!showSettings)}
              className={`p-1.5 rounded-lg border text-xs transition-colors ${
                showSettings
                  ? 'bg-indigo-50 border-indigo-200 text-indigo-700'
                  : 'bg-white border-slate-200 text-slate-400 hover:text-slate-700'
              }`}
              title="Toggle retrieval parameters"
            >
              <SlidersHorizontal className="w-3.5 h-3.5" />
            </button>

            <button
              type="submit"
              disabled={querying || !question.trim() || disabled}
              className="flex items-center justify-center w-8 h-8 rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 active:bg-indigo-800 disabled:opacity-40 disabled:cursor-not-allowed transition-all shadow-sm shadow-indigo-200"
              title="Ask Question"
            >
              {querying ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <ArrowRight className="w-4 h-4" />
              )}
            </button>
          </div>
        </div>

        {/* Collapsible Retrieval Settings */}
        {showSettings && (
          <div className="p-3 rounded-lg bg-slate-50 border border-slate-200 flex items-center justify-between text-xs animate-in fade-in">
            <div className="flex items-center gap-2">
              <span className="font-medium text-slate-700">Top-K Context Chunks:</span>
              <span className="text-slate-400 font-mono text-[11px]">(maximum chunks retrieved)</span>
            </div>

            <div className="flex items-center gap-2">
              <input
                type="range"
                min="1"
                max="10"
                value={topK}
                onChange={(e) => setTopK(parseInt(e.target.value, 10))}
                className="w-24 accent-indigo-600 cursor-pointer"
              />
              <span className="font-mono font-semibold text-indigo-600 text-xs w-5 text-right">{topK}</span>
            </div>
          </div>
        )}

        {/* Prompt Suggestions */}
        <div className="pt-1">
          <span className="block text-[10px] font-medium text-slate-400 uppercase tracking-wider mb-1.5">
            Suggested Questions
          </span>
          <div className="flex flex-wrap gap-1.5">
            {SUGGESTIONS.map((suggestion, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => handleSuggestionClick(suggestion)}
                disabled={querying || disabled}
                className="text-left text-[11px] text-slate-600 bg-slate-100 hover:bg-indigo-50 hover:text-indigo-700 px-2.5 py-1 rounded-full transition-colors disabled:opacity-40 border border-transparent hover:border-indigo-200"
              >
                {suggestion}
              </button>
            ))}
          </div>
        </div>
      </form>
    </div>
  );
}
