import React, { useState, useEffect } from 'react';
import { X, Calendar, ArrowRight, CheckSquare } from 'lucide-react';
import { useTasks } from '../contexts/TaskContext';
import { format } from 'date-fns';

export default function EveningReviewModal({ isOpen, onClose }) {
  const { tasks, selectedDate, carryForwardTasks } = useTasks();
  const [selectedTasks, setSelectedTasks] = useState([]);

  const todayStr = format(selectedDate, 'yyyy-MM-dd');
  
  // Get incomplete tasks for the current selected date
  const incompleteTasks = tasks.filter(t => !t.is_completed && t.task_date === todayStr && t.id !== 'DELETED');

  useEffect(() => {
    if (isOpen) {
      // Auto-select all by default
      setSelectedTasks(incompleteTasks.map(t => t.id));
    }
  }, [isOpen, tasks]);

  const toggleTask = (id) => {
    setSelectedTasks(prev => 
      prev.includes(id) ? prev.filter(tId => tId !== id) : [...prev, id]
    );
  };

  const handleCarryForward = async () => {
    if (selectedTasks.length > 0) {
      await carryForwardTasks(selectedTasks);
    }
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
      <div className="bg-white w-full max-w-md rounded-3xl shadow-2xl overflow-hidden animate-fade-in pb-safe">
        <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-brand-50">
          <div>
            <h2 className="text-xl font-bold text-brand-900">Evening Review</h2>
            <p className="text-sm text-brand-600">Review today's unfinished tasks</p>
          </div>
          <button onClick={onClose} className="p-2 rounded-full hover:bg-brand-100 text-brand-700">
            <X size={20} />
          </button>
        </div>

        <div className="p-5 max-h-[60vh] overflow-y-auto">
          {incompleteTasks.length === 0 ? (
            <div className="text-center py-8">
              <CheckSquare size={48} className="mx-auto text-green-400 mb-3" />
              <h3 className="text-lg font-bold text-slate-800">All Done!</h3>
              <p className="text-slate-500 text-sm mt-1">You finished everything for today.</p>
            </div>
          ) : (
            <div className="space-y-3">
              <p className="text-sm font-medium text-slate-600 mb-4">
                Select tasks to carry forward to tomorrow:
              </p>
              {incompleteTasks.map(task => (
                <div 
                  key={task.id}
                  onClick={() => toggleTask(task.id)}
                  className={`p-4 rounded-xl border-2 transition-all cursor-pointer flex items-center gap-3 ${
                    selectedTasks.includes(task.id) 
                    ? 'border-brand-500 bg-brand-50' 
                    : 'border-slate-100 bg-white hover:border-slate-200'
                  }`}
                >
                  <div className={`w-5 h-5 rounded-md flex items-center justify-center ${
                    selectedTasks.includes(task.id) ? 'bg-brand-500 text-white' : 'bg-slate-200'
                  }`}>
                    {selectedTasks.includes(task.id) && <CheckSquare size={14} />}
                  </div>
                  <span className={`font-medium ${selectedTasks.includes(task.id) ? 'text-brand-900' : 'text-slate-700'}`}>
                    {task.title}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {incompleteTasks.length > 0 && (
          <div className="p-4 border-t border-slate-100 bg-slate-50 rounded-b-3xl flex gap-3">
            <button
              onClick={onClose}
              className="flex-1 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 font-bold py-3.5 rounded-xl transition-all"
            >
              Cancel
            </button>
            <button
              onClick={handleCarryForward}
              disabled={selectedTasks.length === 0}
              className="flex-1 bg-brand-600 hover:bg-brand-700 disabled:bg-slate-300 text-white font-bold py-3.5 rounded-xl shadow-lg transition-all flex items-center justify-center gap-2"
            >
              Carry Forward <ArrowRight size={18} />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
