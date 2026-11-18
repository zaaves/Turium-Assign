import React, { useState, useMemo } from 'react';
import { Search, RefreshCw, BookOpen, Inbox, Filter } from 'lucide-react';
import ItemCard from './ItemCard';

export default function ItemList({
  items,
  loading,
  error,
  isPolling,
  onRefresh,
  onSelectItem,
  selectedItemId,
}) {
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState('ALL'); // 'ALL' | 'NOTE' | 'URL'

  const filteredItems = useMemo(() => {
    return items.filter((item) => {
      const matchesType =
        typeFilter === 'ALL' || item.sourceType === typeFilter;
      const matchesSearch =
        !searchQuery.trim() ||
        (item.title && item.title.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (item.sourceUrl && item.sourceUrl.toLowerCase().includes(searchQuery.toLowerCase()));

      return matchesType && matchesSearch;
    });
  }, [items, searchQuery, typeFilter]);

  return (
    <div className="bg-white rounded-xl border border-slate-200/90 shadow-sm flex flex-col flex-1 overflow-hidden min-h-[400px]">
      {/* Header */}
      <div className="p-4 sm:p-5 border-b border-slate-200/80">
        <div className="flex items-center justify-between gap-3 mb-3">
          <div className="flex items-center gap-2">
            <h2 className="font-semibold text-sm text-slate-900 flex items-center gap-2">
              <BookOpen className="w-4 h-4 text-indigo-600" />
              Saved Knowledge
            </h2>
            <span className="text-xs bg-slate-100 text-slate-600 font-medium px-2 py-0.5 rounded-full">
              {items.length}
            </span>
          </div>

          <div className="flex items-center gap-2">
            {isPolling && (
              <span className="inline-flex items-center gap-1.5 text-[11px] font-medium text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-full border border-indigo-100">
                <span className="w-1.5 h-1.5 rounded-full bg-indigo-600 animate-pulse" />
                Live Sync
              </span>
            )}

            <button
              onClick={onRefresh}
              className="p-1.5 rounded-lg text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition-colors"
              title="Refresh items list"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-indigo-600' : ''}`} />
            </button>
          </div>
        </div>

        {/* Search & Filters */}
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Filter by title or URL..."
              className="w-full text-xs pl-8 pr-3 py-1.5 rounded-lg border border-slate-200 bg-slate-50/50 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 transition-colors"
            />
          </div>

          <div className="flex items-center rounded-lg border border-slate-200 bg-slate-50/50 p-0.5 text-[11px]">
            <button
              onClick={() => setTypeFilter('ALL')}
              className={`px-2 py-1 rounded-md transition-all font-medium ${
                typeFilter === 'ALL' ? 'bg-white text-indigo-700 shadow-sm' : 'text-slate-500 hover:text-slate-900'
              }`}
            >
              All
            </button>
            <button
              onClick={() => setTypeFilter('NOTE')}
              className={`px-2 py-1 rounded-md transition-all font-medium ${
                typeFilter === 'NOTE' ? 'bg-white text-indigo-700 shadow-sm' : 'text-slate-500 hover:text-slate-900'
              }`}
            >
              Notes
            </button>
            <button
              onClick={() => setTypeFilter('URL')}
              className={`px-2 py-1 rounded-md transition-all font-medium ${
                typeFilter === 'URL' ? 'bg-white text-indigo-700 shadow-sm' : 'text-slate-500 hover:text-slate-900'
              }`}
            >
              URLs
            </button>
          </div>
        </div>
      </div>

      {/* List Area */}
      <div className="flex-1 overflow-y-auto p-3 sm:p-4 space-y-2.5 max-h-[580px]">
        {error && (
          <div className="p-4 text-center text-xs text-rose-600 bg-rose-50 rounded-lg border border-rose-100">
            {error}
          </div>
        )}

        {loading && items.length === 0 ? (
          <div className="py-12 flex flex-col items-center justify-center text-slate-400 gap-2 text-xs">
            <RefreshCw className="w-5 h-5 animate-spin text-indigo-600" />
            <span>Loading knowledge items...</span>
          </div>
        ) : filteredItems.length === 0 ? (
          <div className="py-16 flex flex-col items-center justify-center text-center px-4">
            <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center text-slate-400 mb-3">
              <Inbox className="w-5 h-5" />
            </div>
            <h4 className="text-xs font-semibold text-slate-700 mb-1">
              {searchQuery ? 'No matching items found' : 'No knowledge items in inbox'}
            </h4>
            <p className="text-[11px] text-slate-400 max-w-xs leading-relaxed">
              {searchQuery
                ? 'Try adjusting your search query or switching filters.'
                : 'Add a plain-text note or web URL above to start building your searchable knowledge base.'}
            </p>
          </div>
        ) : (
          filteredItems.map((item) => (
            <ItemCard
              key={item.id}
              item={item}
              isSelected={item.id === selectedItemId}
              onClick={() => onSelectItem(item.id)}
            />
          ))
        )}
      </div>
    </div>
  );
}
