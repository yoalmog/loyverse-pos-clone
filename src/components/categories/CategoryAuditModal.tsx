import React, { useState, useEffect } from 'react';
import { CategoryAuditLog } from '../../types/pos.ts';
import { StorageService } from '../../services/storageService.ts';
import { X, History, Clock, User, ShieldCheck } from 'lucide-react';

interface CategoryAuditModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const CategoryAuditModal: React.FC<CategoryAuditModalProps> = ({ isOpen, onClose }) => {
  const [logs, setLogs] = useState<CategoryAuditLog[]>([]);

  useEffect(() => {
    if (isOpen) {
      setLogs(StorageService.getCategoryAuditLogs());
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const getActionBadge = (action: string) => {
    switch (action) {
      case 'created':
        return 'bg-emerald-100 text-emerald-800 border-emerald-200';
      case 'updated':
        return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'deleted':
        return 'bg-red-100 text-red-800 border-red-200';
      case 'activated':
        return 'bg-green-100 text-green-800 border-green-200';
      case 'deactivated':
        return 'bg-slate-100 text-slate-800 border-slate-200';
      case 'reordered':
        return 'bg-purple-100 text-purple-800 border-purple-200';
      default:
        return 'bg-slate-100 text-slate-700 border-slate-200';
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs">
      <div className="relative w-full max-w-2xl bg-white rounded-3xl shadow-2xl border border-slate-200 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50/70">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-blue-100 text-blue-600 flex items-center justify-center">
              <History className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900">Category Audit Trail</h3>
              <p className="text-[11px] text-slate-500">Record of category creation, updates, reordering and deletions</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 flex items-center justify-center"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 max-h-[60vh] overflow-y-auto">
          {logs.length === 0 ? (
            <div className="py-12 text-center text-slate-400 text-xs">
              No category audit records logged yet.
            </div>
          ) : (
            <div className="space-y-3">
              {logs.map(log => (
                <div
                  key={log.id}
                  className="p-3.5 bg-slate-50 border border-slate-200 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 text-xs"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold uppercase border ${getActionBadge(log.action)}`}>
                        {log.action}
                      </span>
                      <span className="font-bold text-slate-800">
                        {log.categoryName || log.categoryId}
                      </span>
                    </div>
                    {log.details && (
                      <p className="text-[11px] text-slate-600">{log.details}</p>
                    )}
                  </div>

                  <div className="flex items-center gap-3 text-[11px] text-slate-400 shrink-0">
                    <span className="flex items-center gap-1 font-medium text-slate-500">
                      <User className="w-3.5 h-3.5" />
                      {log.userName || log.userId}
                    </span>
                    <span className="flex items-center gap-1">
                      <Clock className="w-3.5 h-3.5" />
                      {new Date(log.timestamp).toLocaleString()}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end px-6 py-3 border-t border-slate-100 bg-slate-50/70">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
