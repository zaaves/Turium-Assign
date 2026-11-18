import React from 'react';
import { CheckCircle2, RefreshCw, Clock, AlertCircle } from 'lucide-react';

export default function ProcessingBadge({ status, size = 'sm' }) {
  const isSm = size === 'sm';
  const iconClass = isSm ? 'w-3 h-3' : 'w-3.5 h-3.5';
  const textClass = isSm ? 'text-xs px-2 py-0.5' : 'text-xs px-2.5 py-1';

  switch (status) {
    case 'COMPLETED':
      return (
        <span
          className={`inline-flex items-center gap-1.5 font-medium rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200/80 ${textClass}`}
        >
          <CheckCircle2 className={`${iconClass} text-emerald-600`} />
          Completed
        </span>
      );

    case 'PROCESSING':
      return (
        <span
          className={`inline-flex items-center gap-1.5 font-medium rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200/80 ${textClass}`}
        >
          <RefreshCw className={`${iconClass} text-indigo-600 animate-spin`} />
          Processing
        </span>
      );

    case 'PENDING':
      return (
        <span
          className={`inline-flex items-center gap-1.5 font-medium rounded-full bg-amber-50 text-amber-700 border border-amber-200/80 ${textClass}`}
        >
          <Clock className={`${iconClass} text-amber-600`} />
          Pending
        </span>
      );

    case 'FAILED':
      return (
        <span
          className={`inline-flex items-center gap-1.5 font-medium rounded-full bg-rose-50 text-rose-700 border border-rose-200/80 ${textClass}`}
        >
          <AlertCircle className={`${iconClass} text-rose-600`} />
          Failed
        </span>
      );

    default:
      return (
        <span
          className={`inline-flex items-center gap-1.5 font-medium rounded-full bg-slate-100 text-slate-600 border border-slate-200 ${textClass}`}
        >
          {status}
        </span>
      );
  }
}
