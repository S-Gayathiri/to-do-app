import React from 'react';
import { Repeat, Calendar, Trash2, X } from 'lucide-react';
import { format } from 'date-fns';

export default function RecurringActionModal({ isOpen, onClose, onConfirmThis, onConfirmAll, task, selectedDate }) {
  if (!isOpen || !task) return null;

  const dateStr = format(selectedDate || new Date(), 'EEE, MMM d');

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4 animate-fade-in">
      <div className="bg-white w-full max-w-sm rounded-3xl shadow-2xl overflow-hidden border border-slate-100">
        <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-purple-100 text-purple-700 rounded-xl">
              <Repeat size={18} />
            </div>
            <div>
              <h3 className="font-bold text-slate-800">Recurring Task</h3>
              <p className="text-xs text-slate-500 truncate max-w-[200px]">{task.title}</p>
            </div>
          </div>
          <button 
            type="button" 
            onClick={onClose} 
            className="p-1.5 rounded-full hover:bg-slate-200 text-slate-400 hover:text-slate-600 transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        <div className="p-5 space-y-3">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
            Choose how to delete this repeating task:
          </p>

          <button
            type="button"
            onClick={() => {
              onConfirmThis();
              onClose();
            }}
            className="w-full p-3.5 rounded-2xl border-2 border-slate-200 hover:border-brand-500 hover:bg-brand-50/50 flex items-start gap-3 transition-all text-left group"
          >
            <div className="p-2 bg-slate-100 group-hover:bg-brand-100 text-slate-600 group-hover:text-brand-600 rounded-xl transition-colors mt-0.5">
              <Calendar size={18} />
            </div>
            <div className="flex-1">
              <h4 className="font-bold text-sm text-slate-800 group-hover:text-brand-700">Delete this occurrence only</h4>
              <p className="text-xs text-slate-500 mt-0.5">
                Remove for {dateStr}. Other days will remain scheduled.
              </p>
            </div>
          </button>

          <button
            type="button"
            onClick={() => {
              onConfirmAll();
              onClose();
            }}
            className="w-full p-3.5 rounded-2xl border-2 border-red-100 hover:border-red-500 hover:bg-red-50/50 flex items-start gap-3 transition-all text-left group"
          >
            <div className="p-2 bg-red-100 text-red-600 rounded-xl mt-0.5">
              <Trash2 size={18} />
            </div>
            <div className="flex-1">
              <h4 className="font-bold text-sm text-red-700">Delete all occurrences</h4>
              <p className="text-xs text-red-500/80 mt-0.5">
                Stop recurrence and delete this task series completely.
              </p>
            </div>
          </button>
        </div>

        <div className="p-4 border-t border-slate-100 bg-slate-50 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-200 rounded-xl transition-colors"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
