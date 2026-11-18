import React, { useState } from 'react';
import Header from './components/Header';
import AddContentForm from './components/AddContentForm';
import ItemList from './components/ItemList';
import QuestionForm from './components/QuestionForm';
import AnswerPanel from './components/AnswerPanel';
import ItemDetailDrawer from './components/ItemDetailDrawer';
import { useItems } from './hooks/useItems';
import { useQuery } from './hooks/useQuery';
import { BookOpen, Sparkles } from 'lucide-react';

export default function App() {
  const [mobileTab, setMobileTab] = useState('library'); // 'library' | 'assistant'

  const {
    items,
    loading: itemsLoading,
    error: itemsError,
    isPolling,
    hasActiveItems,
    refreshItems,
    selectedItem,
    loadingDetails,
    detailsError,
    openItemDetails,
    closeItemDetails,
  } = useItems();

  const {
    querying,
    queryResult,
    queryError,
    lastQuestion,
    highlightedSourceLabel,
    askQuestion,
    highlightCitation,
  } = useQuery();

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col text-slate-800 selection:bg-indigo-100 selection:text-indigo-800">
      {/* Top Navigation */}
      <Header isPolling={isPolling} activeJobsCount={items.filter((i) => i.status === 'PROCESSING').length} />

      {/* Mobile Tab Switcher */}
      <div className="lg:hidden bg-white border-b border-slate-200 px-4 py-2 flex items-center justify-around text-xs font-semibold">
        <button
          onClick={() => setMobileTab('library')}
          className={`flex-1 flex items-center justify-center gap-2 py-2 border-b-2 transition-colors ${
            mobileTab === 'library'
              ? 'border-indigo-600 text-indigo-600'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <BookOpen className="w-4 h-4" />
          Knowledge Library ({items.length})
        </button>

        <button
          onClick={() => setMobileTab('assistant')}
          className={`flex-1 flex items-center justify-center gap-2 py-2 border-b-2 transition-colors ${
            mobileTab === 'assistant'
              ? 'border-indigo-600 text-indigo-600'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <Sparkles className="w-4 h-4" />
          AI Assistant
        </button>
      </div>

      {/* Main Dashboard Grid */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 flex-1 w-full grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8 items-start">
        {/* Left Column: Knowledge Management */}
        <section
          className={`lg:col-span-5 flex flex-col gap-6 w-full ${
            mobileTab === 'library' ? 'flex' : 'hidden lg:flex'
          }`}
        >
          <AddContentForm onIngestSuccess={refreshItems} />

          <ItemList
            items={items}
            loading={itemsLoading}
            error={itemsError}
            isPolling={isPolling}
            onRefresh={refreshItems}
            onSelectItem={openItemDetails}
            selectedItemId={selectedItem?.id}
          />
        </section>

        {/* Right Column: AI Assistant & Grounded Q&A */}
        <section
          className={`lg:col-span-7 flex flex-col gap-6 w-full ${
            mobileTab === 'assistant' ? 'flex' : 'hidden lg:flex'
          }`}
        >
          <QuestionForm
            onSubmit={(q, topK) => askQuestion(q, topK)}
            querying={querying}
            disabled={items.filter((i) => i.status === 'COMPLETED').length === 0}
          />

          <AnswerPanel
            queryResult={queryResult}
            querying={querying}
            queryError={queryError}
            lastQuestion={lastQuestion}
            highlightedSourceLabel={highlightedSourceLabel}
            onHighlightCitation={highlightCitation}
            onInspectSource={openItemDetails}
          />
        </section>
      </main>

      {/* Slide-over Item Inspection Drawer */}
      <ItemDetailDrawer
        item={selectedItem}
        loading={loadingDetails}
        error={detailsError}
        onClose={closeItemDetails}
      />

      {/* Global Footer */}
      <footer className="border-t border-slate-200/80 bg-white py-4 text-center text-xs text-slate-400">
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-2">
          <span>Turium AI Knowledge Inbox &bull; Full Stack Developer Assessment</span>
          <span className="font-mono text-[11px] text-slate-400">
            ES Modules &bull; SQLite (Prisma) &bull; Express &bull; React + Vite &bull; Tailwind CSS
          </span>
        </div>
      </footer>
    </div>
  );
}
