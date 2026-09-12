import React, { useState, useEffect } from 'react';
import { X, Calendar as CalendarIcon, Clock, AlertCircle, Star } from 'lucide-react';
import { useTasks } from '../contexts/TaskContext';
import { format } from 'date-fns';

export default function TaskEntryModal({ isOpen, onClose, defaultBlock = 'morning' }) {
  const { selectedDate, allowedProfiles, activeProfile, addTask } = useTasks();
  
  const [title, setTitle] = useState('');
  const [profile, setProfile] = useState(activeProfile);
  const [timeBlock, setTimeBlock] = useState(defaultBlock);
  const [isUrgent, setIsUrgent] = useState(false);
  const [isImportant, setIsImportant] = useState(false);
  const [reminderTime, setReminderTime] = useState('');

  useEffect(() => {
    if (isOpen) {
      setTitle('');
      setProfile(activeProfile);
      setTimeBlock(defaultBlock);
      setIsUrgent(false);
      setIsImportant(false);
      setReminderTime('');
    }
  }, [isOpen, activeProfile, defaultBlock]);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!title.trim()) return;

    addTask({
      title: title.trim(),
      profile,
      task_date: format(selectedDate, 'yyyy-MM-dd'),
      time_block: timeBlock,
      is_urgent: isUrgent,
      is_important: isImportant,
      reminder_time: reminderTime
    });
    
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4 sm:p-0">
      <div className="bg-white w-full max-w-md rounded-3xl shadow-2xl overflow-hidden animate-slide-up sm:animate-fade-in pb-safe">
        <form onSubmit={handleSubmit}>
          <div className="flex items-center justify-between p-4 border-b border-slate-100">
            <h2 className="text-lg font-bold text-slate-800">New Task</h2>
            <button type="button" onClick={onClose} className="p-2 rounded-full hover:bg-slate-100 text-slate-500">
              <X size={20} />
            </button>
          </div>

          <div className="p-5 space-y-5">
            <div>
              <input
                type="text"
                autoFocus
                placeholder="What needs to be done?"
                className="w-full text-lg font-medium text-slate-800 placeholder-slate-400 bg-transparent border-none focus:ring-0 p-0"
                value={title}
                onChange={e => setTitle(e.target.value)}
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Profile</label>
                <select 
                  className="w-full bg-slate-50 border border-slate-200 text-sm rounded-xl px-3 py-2.5 outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500"
                  value={profile}
                  onChange={e => setProfile(e.target.value)}
                >
                  {allowedProfiles.map(p => <option key={p} value={p}>{p === 'PattuThangam' ? 'Shared' : p}</option>)}
                </select>
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Time Block</label>
                <select 
                  className="w-full bg-slate-50 border border-slate-200 text-sm rounded-xl px-3 py-2.5 outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500"
                  value={timeBlock}
                  onChange={e => setTimeBlock(e.target.value)}
                >
                  <option value="morning">🌅 Morning</option>
                  <option value="afternoon">☀️ Afternoon</option>
                  <option value="evening">🌇 Evening</option>
                  <option value="night">🌙 Night</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setIsUrgent(!isUrgent)}
                className={`py-2.5 px-3 rounded-xl border flex items-center justify-center gap-2 text-sm font-semibold transition-colors ${
                  isUrgent ? 'bg-red-50 text-red-700 border-red-200' : 'bg-white text-slate-500 border-slate-200'
                }`}
              >
                <AlertCircle size={16} /> Urgent
              </button>
              <button
                type="button"
                onClick={() => setIsImportant(!isImportant)}
                className={`py-2.5 px-3 rounded-xl border flex items-center justify-center gap-2 text-sm font-semibold transition-colors ${
                  isImportant ? 'bg-amber-50 text-amber-700 border-amber-200' : 'bg-white text-slate-500 border-slate-200'
                }`}
              >
                <Star size={16} /> Important
              </button>
            </div>

            <div className="flex items-center gap-3">
              <Clock size={18} className="text-slate-400" />
              <input
                type="time"
                value={reminderTime}
                onChange={e => setReminderTime(e.target.value)}
                className="flex-1 bg-transparent border-none text-slate-700 focus:ring-0 p-0"
                placeholder="Add reminder time"
              />
            </div>
          </div>

          <div className="p-4 border-t border-slate-100 bg-slate-50 rounded-b-3xl">
            <button
              type="submit"
              disabled={!title.trim()}
              className="w-full bg-brand-600 hover:bg-brand-700 disabled:bg-slate-300 disabled:cursor-not-allowed text-white font-bold py-3.5 rounded-xl shadow-lg shadow-brand-500/20 transition-all active:scale-[0.98]"
            >
              Save Task
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
