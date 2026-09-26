import React, { useState, useEffect } from 'react';
import { X, Trash2, CheckCircle2, AlertTriangle, Sparkles, Filter, Calendar, User, Clock } from 'lucide-react';
import { fetchSheetData } from '../services/googleSheets';
import { useTasks } from '../contexts/TaskContext';

export default function PurgePreviewModal({ isOpen, onClose, mode = 'duplicates' }) {
  // mode: 'duplicates' (Clean duplicates & compact) or 'completed' (Purge completed tasks)
  const { cleanupSheet } = useTasks();
  const [loading, setLoading] = useState(true);
  const [purging, setPurging] = useState(false);
  const [stats, setStats] = useState({
    totalRows: 0,
    keptCount: 0,
    duplicatesCount: 0,
    completedCount: 0,
    toDeleteTasks: [],
    toKeepTasks: [],
    cleanTasksToSave: []
  });

  useEffect(() => {
    if (!isOpen) return;

    const analyze = async () => {
      setLoading(true);
      try {
        const data = await fetchSheetData('A:L');
        if (!data || data.length === 0) {
          setStats({
            totalRows: 0,
            keptCount: 0,
            duplicatesCount: 0,
            completedCount: 0,
            toDeleteTasks: [],
            toKeepTasks: [],
            cleanTasksToSave: []
          });
          setLoading(false);
          return;
        }

        const removeCompleted = mode === 'completed';
        const seen = new Set();
        const cleanTasks = [];
        const toDelete = [];
        let dupCount = 0;
        let compCount = 0;

        for (const t of data) {
          if (!t || !t.title || !t.task_date) {
            toDelete.push({ ...t, reason: 'Empty or invalid row' });
            continue;
          }

          if (t.is_skipped || t.is_deleted || t.id === 'DELETED') {
            toDelete.push({ ...t, reason: 'Temporary skip marker' });
            continue;
          }

          const isCompleted = Boolean(t.is_completed) && t.is_completed !== 'false';
          if (removeCompleted && isCompleted) {
            compCount++;
            toDelete.push({ ...t, reason: 'Completed task' });
            continue;
          }

          const isRecurring = Boolean(t.is_recurring) && t.is_recurring !== 'false';
          const key = isRecurring 
            ? `rec_${(t.title || '').trim().toLowerCase()}_${t.time_block}_${t.profile}`
            : `single_${(t.title || '').trim().toLowerCase()}_${t.task_date}_${t.time_block}_${t.profile}`;

          if (seen.has(key)) {
            dupCount++;
            toDelete.push({ ...t, reason: 'Duplicate task entry' });
          } else {
            seen.add(key);
            cleanTasks.push(t);
          }
        }

        setStats({
          totalRows: data.length,
          keptCount: cleanTasks.length,
          duplicatesCount: dupCount,
          completedCount: compCount,
          toDeleteTasks: toDelete,
          toKeepTasks: cleanTasks,
          cleanTasksToSave: cleanTasks
        });
      } catch (err) {
        console.error('Failed to analyze sheet:', err);
      } finally {
        setLoading(false);
      }
    };

    analyze();
  }, [isOpen, mode]);

  if (!isOpen) return null;

  const handleConfirmPurge = async () => {
    setPurging(true);
    try {
      await cleanupSheet({
        removeDuplicates: true,
        removeCompleted: mode === 'completed'
      });
      onClose();
    } catch (err) {
      console.error(err);
    } finally {
      setPurging(false);
    }
  };

  const isCompletedMode = mode === 'completed';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in">
      <div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden flex flex-col max-h-[85vh] animate-scale-up">
        {/* Header */}
        <div className={`p-4 sm:p-5 flex items-center justify-between border-b ${
          isCompletedMode ? 'bg-rose-50/70 border-rose-100' : 'bg-brand-50/70 border-brand-100'
        }`}>
          <div className="flex items-center gap-3">
            <div className={`p-2.5 rounded-xl ${
              isCompletedMode ? 'bg-rose-500 text-white' : 'bg-brand-500 text-white'
            }`}>
              {isCompletedMode ? <Trash2 size={22} /> : <Sparkles size={22} />}
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-800">
                {isCompletedMode ? 'Purge Completed Tasks Overview' : 'Sheet Compact & Cleanup Overview'}
              </h2>
              <p className="text-xs text-slate-500">
                {isCompletedMode
                  ? 'Review completed tasks that will be deleted from Google Sheets.'
                  : 'Review duplicate and redundant rows that will be removed.'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-full hover:bg-black/5 text-slate-400 hover:text-slate-600 transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Content Area */}
        <div className="p-5 flex-1 overflow-y-auto space-y-4">
          {loading ? (
            <div className="py-12 flex flex-col items-center justify-center gap-3 text-slate-400">
              <div className="w-8 h-8 border-3 border-brand-500 border-t-transparent rounded-full animate-spin"></div>
              <p className="text-sm font-medium">Analyzing Google Sheets rows...</p>
            </div>
          ) : stats.totalRows === 0 ? (
            <div className="py-8 text-center text-slate-500">
              <CheckCircle2 size={36} className="mx-auto text-emerald-500 mb-2" />
              <p className="font-semibold text-slate-700">Your Google Sheet is already clean!</p>
              <p className="text-xs text-slate-400 mt-1">No duplicate or invalid rows found.</p>
            </div>
          ) : (
            <>
              {/* Stat Cards */}
              <div className="grid grid-cols-3 gap-2.5">
                <div className="bg-slate-50 border border-slate-200/80 rounded-xl p-3 text-center">
                  <span className="text-xs text-slate-500 font-medium block">Total In Sheet</span>
                  <span className="text-xl font-extrabold text-slate-800">{stats.totalRows}</span>
                </div>
                <div className="bg-emerald-50 border border-emerald-200/80 rounded-xl p-3 text-center">
                  <span className="text-xs text-emerald-600 font-medium block">Will Keep</span>
                  <span className="text-xl font-extrabold text-emerald-700">{stats.keptCount}</span>
                </div>
                <div className={`${
                  isCompletedMode ? 'bg-rose-50 border-rose-200/80' : 'bg-amber-50 border-amber-200/80'
                } rounded-xl p-3 text-center border`}>
                  <span className={`text-xs font-medium block ${
                    isCompletedMode ? 'text-rose-600' : 'text-amber-600'
                  }`}>
                    Will Delete
                  </span>
                  <span className={`text-xl font-extrabold ${
                    isCompletedMode ? 'text-rose-700' : 'text-amber-700'
                  }`}>
                    {stats.toDeleteTasks.length}
                  </span>
                </div>
              </div>

              {/* Notice Banner */}
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs text-slate-600 space-y-1">
                <div className="flex items-center gap-1.5 font-semibold text-slate-700">
                  <CheckCircle2 size={15} className="text-emerald-500" />
                  <span>Your active tasks and recurring schedules are safe</span>
                </div>
                <p className="text-[11px] text-slate-500 pl-5">
                  {isCompletedMode 
                    ? `This will remove ${stats.completedCount} finished tasks and ${stats.duplicatesCount} duplicate rows.`
                    : `This will remove ${stats.duplicatesCount} duplicate / orphan rows and compact row gaps.`}
                </p>
              </div>

              {/* Breakdown List Preview */}
              {stats.toDeleteTasks.length > 0 && (
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                      Items to be removed ({stats.toDeleteTasks.length})
                    </span>
                  </div>
                  <div className="border border-slate-200 rounded-xl overflow-hidden divide-y divide-slate-100 max-h-48 overflow-y-auto bg-slate-50/50">
                    {stats.toDeleteTasks.map((item, idx) => (
                      <div key={idx} className="p-2.5 flex items-center justify-between text-xs hover:bg-white transition-colors">
                        <div className="min-w-0 pr-2">
                          <p className="font-semibold text-slate-800 truncate">{item.title || '(Blank / Row)'}</p>
                          <div className="flex items-center gap-2 text-[10px] text-slate-400 mt-0.5">
                            {item.task_date && <span>📅 {item.task_date}</span>}
                            {item.profile && <span>👤 {item.profile}</span>}
                            {item.time_block && <span>⏰ {item.time_block}</span>}
                          </div>
                        </div>
                        <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full whitespace-nowrap ${
                          item.reason === 'Completed task'
                            ? 'bg-rose-100 text-rose-700'
                            : 'bg-amber-100 text-amber-700'
                        }`}>
                          {item.reason}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer Actions */}
        <div className="p-4 border-t border-slate-100 bg-slate-50/60 flex items-center justify-end gap-2.5">
          <button
            onClick={onClose}
            disabled={purging}
            className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-200/70 rounded-xl transition-colors"
          >
            Cancel
          </button>
          
          <button
            onClick={handleConfirmPurge}
            disabled={loading || purging || stats.toDeleteTasks.length === 0}
            className={`px-4 py-2 text-xs font-semibold text-white rounded-xl shadow-md transition-all flex items-center gap-1.5 ${
              isCompletedMode 
                ? 'bg-rose-600 hover:bg-rose-700 shadow-rose-600/20' 
                : 'bg-brand-600 hover:bg-brand-700 shadow-brand-600/20'
            } disabled:opacity-50 disabled:cursor-not-allowed`}
          >
            {purging ? (
              <>
                <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                <span>Purging Sheet...</span>
              </>
            ) : (
              <>
                {isCompletedMode ? <Trash2 size={14} /> : <Sparkles size={14} />}
                <span>Confirm & Purge ({stats.toDeleteTasks.length} items)</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
