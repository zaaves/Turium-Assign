import React, { useState } from 'react';
import { FileText, Globe, Plus, AlertCircle, CheckCircle2, Loader2 } from 'lucide-react';
import { useIngestion } from '../hooks/useIngestion';

export default function AddContentForm({ onIngestSuccess }) {
  const [activeTab, setActiveTab] = useState('NOTE'); // 'NOTE' | 'URL'
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [url, setUrl] = useState('');

  const { submitting, ingestionError, ingestionSuccess, clearMessages, submitNote, submitUrl } =
    useIngestion({
      onIngestSuccess: (item) => {
        // Clear fields on success
        setTitle('');
        setContent('');
        setUrl('');
        if (onIngestSuccess) onIngestSuccess(item);
      },
    });

  const handleTabChange = (tab) => {
    setActiveTab(tab);
    clearMessages();
  };

  const handleNoteSubmit = async (e) => {
    e.preventDefault();
    await submitNote({ title, content });
  };

  const handleUrlSubmit = async (e) => {
    e.preventDefault();
    await submitUrl({ url });
  };

  const approxTokens = Math.ceil((content || '').length / 4);

  return (
    <div className="bg-white rounded-xl border border-slate-200/90 shadow-sm overflow-hidden">
      {/* Tab Switcher */}
      <div className="flex border-b border-slate-200 bg-slate-50/70 p-1">
        <button
          type="button"
          onClick={() => handleTabChange('NOTE')}
          className={`flex-1 flex items-center justify-center gap-2 py-2 px-3 text-xs font-medium rounded-lg transition-all ${
            activeTab === 'NOTE'
              ? 'bg-white text-indigo-700 shadow-sm border border-slate-200/60 font-semibold'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <FileText className="w-3.5 h-3.5 text-indigo-600" />
          Add Note
        </button>

        <button
          type="button"
          onClick={() => handleTabChange('URL')}
          className={`flex-1 flex items-center justify-center gap-2 py-2 px-3 text-xs font-medium rounded-lg transition-all ${
            activeTab === 'URL'
              ? 'bg-white text-indigo-700 shadow-sm border border-slate-200/60 font-semibold'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <Globe className="w-3.5 h-3.5 text-indigo-600" />
          Add Web URL
        </button>
      </div>

      <div className="p-4 sm:p-5">
        {/* Alerts */}
        {ingestionError && (
          <div className="mb-4 flex items-start gap-2.5 p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-800 text-xs leading-relaxed animate-in fade-in">
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
            <div className="flex-1">{ingestionError}</div>
          </div>
        )}

        {ingestionSuccess && (
          <div className="mb-4 flex items-start gap-2.5 p-3 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs leading-relaxed animate-in fade-in">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
            <div className="flex-1">{ingestionSuccess}</div>
          </div>
        )}

        {activeTab === 'NOTE' ? (
          <form onSubmit={handleNoteSubmit} className="space-y-3.5">
            <div>
              <label htmlFor="note-title" className="block text-xs font-medium text-slate-700 mb-1">
                Title <span className="text-slate-400 font-normal">(optional — auto-derived if blank)</span>
              </label>
              <input
                id="note-title"
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g., React Component Patterns"
                disabled={submitting}
                className="w-full text-xs px-3 py-2 rounded-lg border border-slate-300 bg-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 transition-colors disabled:opacity-60"
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label htmlFor="note-content" className="block text-xs font-medium text-slate-700">
                  Note Content <span className="text-rose-500">*</span>
                </label>
                <span className="text-[10px] text-slate-400 font-mono">
                  {content.length} chars &bull; ~{approxTokens} tokens
                </span>
              </div>
              <textarea
                id="note-content"
                rows={4}
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder="Paste or type knowledge notes here. The background worker will chunk and generate embeddings automatically..."
                required
                disabled={submitting}
                className="w-full text-xs px-3 py-2 rounded-lg border border-slate-300 bg-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 transition-colors leading-relaxed disabled:opacity-60"
              />
            </div>

            <button
              type="submit"
              disabled={submitting || !content.trim()}
              className="w-full flex items-center justify-center gap-2 py-2 px-4 rounded-lg bg-indigo-600 text-white text-xs font-semibold hover:bg-indigo-700 active:bg-indigo-800 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-sm shadow-indigo-200"
            >
              {submitting ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  Queueing Ingestion...
                </>
              ) : (
                <>
                  <Plus className="w-3.5 h-3.5" />
                  Save Note to Inbox
                </>
              )}
            </button>
          </form>
        ) : (
          <form onSubmit={handleUrlSubmit} className="space-y-3.5">
            <div>
              <label htmlFor="url-input" className="block text-xs font-medium text-slate-700 mb-1">
                Web Page URL <span className="text-rose-500">*</span>
              </label>
              <input
                id="url-input"
                type="url"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://react.dev/learn"
                required
                disabled={submitting}
                className="w-full text-xs px-3 py-2 rounded-lg border border-slate-300 bg-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 transition-colors disabled:opacity-60"
              />
              <p className="mt-1 text-[11px] text-slate-500">
                The server will fetch readable HTML text, sanitize content, chunk, and embed it asynchronously.
              </p>
            </div>

            <button
              type="submit"
              disabled={submitting || !url.trim()}
              className="w-full flex items-center justify-center gap-2 py-2 px-4 rounded-lg bg-indigo-600 text-white text-xs font-semibold hover:bg-indigo-700 active:bg-indigo-800 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-sm shadow-indigo-200"
            >
              {submitting ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  Queueing URL Extraction...
                </>
              ) : (
                <>
                  <Globe className="w-3.5 h-3.5" />
                  Extract & Ingest URL
                </>
              )}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
