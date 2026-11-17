import React, { useEffect, useState } from 'react';
import { checkBackendHealth } from './services/apiClient';
import { Sparkles, Inbox, BookOpen, CheckCircle2, AlertCircle, RefreshCw } from 'lucide-react';

export default function App() {
  const [health, setHealth] = useState({ status: 'checking', message: 'Checking backend connection...' });

  const fetchHealth = async () => {
    try {
      setHealth({ status: 'checking', message: 'Checking backend...' });
      const res = await checkBackendHealth();
      if (res.success && res.data?.status === 'healthy') {
        setHealth({
          status: 'healthy',
          message: `Connected to API (Uptime: ${Math.round(res.data.uptime)}s)`,
        });
      } else {
        setHealth({ status: 'error', message: 'API returned abnormal status' });
      }
    } catch (err) {
      setHealth({ status: 'error', message: err.message || 'Cannot connect to backend' });
    }
  };

  useEffect(() => {
    fetchHealth();
  }, []);

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col text-slate-800">
      {/* Top Navbar */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-indigo-600 flex items-center justify-center text-white shadow-sm shadow-indigo-200">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h1 className="font-semibold text-slate-900 leading-tight">Turium AI Knowledge Inbox</h1>
              <p className="text-xs text-slate-500">Retrieval-Augmented Generation & Ingestion Engine</p>
            </div>
          </div>

          <div className="flex items-center gap-4">
            {/* Health Badge */}
            <div
              className={`flex items-center gap-2 px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                health.status === 'healthy'
                  ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                  : health.status === 'error'
                  ? 'bg-rose-50 text-rose-700 border border-rose-200'
                  : 'bg-amber-50 text-amber-700 border border-amber-200'
              }`}
            >
              {health.status === 'healthy' && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />}
              {health.status === 'error' && <AlertCircle className="w-3.5 h-3.5 text-rose-500" />}
              {health.status === 'checking' && <RefreshCw className="w-3.5 h-3.5 text-amber-500 animate-spin" />}
              <span>{health.message}</span>
            </div>

            <button
              onClick={fetchHealth}
              className="text-xs text-slate-500 hover:text-slate-800 transition-colors p-1"
              title="Refresh health status"
            >
              <RefreshCw className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </header>

      {/* Main Content Scaffold */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 flex-1 w-full grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Left Column: Knowledge Management */}
        <section className="lg:col-span-5 flex flex-col gap-6">
          <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold text-slate-900 flex items-center gap-2">
                <Inbox className="w-4 h-4 text-indigo-600" />
                Add Knowledge
              </h2>
              <span className="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded font-mono">Milestone 1</span>
            </div>
            <p className="text-sm text-slate-600 leading-relaxed">
              Foundation initialized. Note and URL ingestion forms with asynchronous SQLite queue will be activated in
              Milestone 2.
            </p>
          </div>

          <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm flex-1">
            <h2 className="font-semibold text-slate-900 flex items-center gap-2 mb-4">
              <BookOpen className="w-4 h-4 text-indigo-600" />
              Saved Items
            </h2>
            <div className="text-center py-12 text-slate-400 text-sm">
              <p>No items ingested yet.</p>
              <p className="text-xs text-slate-400 mt-1">Ingestion pipeline ready for activation.</p>
            </div>
          </div>
        </section>

        {/* Right Column: Q&A Interface */}
        <section className="lg:col-span-7 flex flex-col gap-6">
          <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm flex-1 flex flex-col">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold text-slate-900 flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-indigo-600" />
                Ask Your Knowledge
              </h2>
              <span className="text-xs bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded font-medium">RAG Ready</span>
            </div>
            <p className="text-sm text-slate-600 mb-6">
              Ask natural language questions over your saved documents and URLs. Grounded answers and citations will
              be powered by Gemini embeddings and LLM adapters.
            </p>

            <div className="border border-slate-200 rounded-lg p-3 bg-slate-50 flex items-center gap-2 text-slate-400 text-sm">
              <span>What do my notes say about...?</span>
            </div>

            <div className="mt-8 flex-1 flex items-center justify-center border-2 border-dashed border-slate-100 rounded-xl p-8 text-center text-slate-400 text-sm">
              <span>RAG query response panel will render here in Milestone 4.</span>
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-200 bg-white py-4 text-center text-xs text-slate-500">
        Turium AI Full Stack Assessment &bull; ES Modules &bull; SQLite + Prisma &bull; Express &bull; React + Vite
      </footer>
    </div>
  );
}
