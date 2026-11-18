import React, { useState, useEffect } from 'react';
import { Sparkles, CheckCircle2, AlertCircle, RefreshCw, Cpu } from 'lucide-react';
import { checkBackendHealth } from '../services/apiClient';

export default function Header({ isPolling, activeJobsCount }) {
  const [health, setHealth] = useState({
    status: 'checking',
    message: 'Connecting to API...',
    uptime: null,
  });

  const fetchHealth = async () => {
    try {
      setHealth((prev) => ({ ...prev, status: 'checking', message: 'Checking API...' }));
      const res = await checkBackendHealth();
      if (res.success && res.data?.status === 'healthy') {
        setHealth({
          status: 'healthy',
          message: 'API Connected',
          uptime: Math.round(res.data.uptime),
        });
      } else {
        setHealth({ status: 'error', message: 'API Abnormal', uptime: null });
      }
    } catch (err) {
      setHealth({ status: 'error', message: 'API Disconnected', uptime: null });
    }
  };

  useEffect(() => {
    fetchHealth();
    // Periodically re-check health every 30s
    const timer = setInterval(fetchHealth, 30000);
    return () => clearInterval(timer);
  }, []);

  return (
    <header className="bg-white border-b border-slate-200/90 sticky top-0 z-30 shadow-xs">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        {/* Brand */}
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-indigo-600 to-indigo-500 flex items-center justify-center text-white shadow-sm shadow-indigo-200">
            <Sparkles className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="font-bold text-sm sm:text-base text-slate-900 leading-tight">
                Turium AI Knowledge Inbox
              </h1>
              <span className="hidden sm:inline-block text-[10px] font-semibold bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded-full border border-indigo-100">
                RAG Engine
              </span>
            </div>
            <p className="text-[11px] text-slate-400">
              Plain-text & Web URL Ingestion &bull; SQLite Vector Store &bull; Grounded Gemini AI
            </p>
          </div>
        </div>

        {/* Status Indicators */}
        <div className="flex items-center gap-3">
          {/* Worker Sync Indicator */}
          {isPolling && (
            <div className="hidden md:flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-indigo-50 text-indigo-700 border border-indigo-200 animate-in fade-in">
              <Cpu className="w-3.5 h-3.5 animate-pulse text-indigo-600" />
              <span>Worker active</span>
            </div>
          )}

          {/* Health Badge */}
          <div
            className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium transition-colors ${
              health.status === 'healthy'
                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200/80'
                : health.status === 'error'
                ? 'bg-rose-50 text-rose-700 border border-rose-200/80'
                : 'bg-amber-50 text-amber-700 border border-amber-200/80'
            }`}
          >
            {health.status === 'healthy' && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />}
            {health.status === 'error' && <AlertCircle className="w-3.5 h-3.5 text-rose-600" />}
            {health.status === 'checking' && <RefreshCw className="w-3.5 h-3.5 text-amber-600 animate-spin" />}
            <span>
              {health.message}
              {health.uptime !== null && <span className="opacity-60 text-[10px] ml-1">({health.uptime}s)</span>}
            </span>
          </div>

          <button
            onClick={fetchHealth}
            className="text-slate-400 hover:text-slate-700 p-1.5 rounded-lg hover:bg-slate-100 transition-colors"
            title="Refresh connection status"
          >
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </header>
  );
}
