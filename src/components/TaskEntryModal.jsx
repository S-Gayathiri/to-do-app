import React, { useState, useEffect } from 'react';
import { X, Calendar as CalendarIcon, Clock, AlertCircle, Star, Repeat, Circle } from 'lucide-react';
import { useTasks } from '../contexts/TaskContext';
import { format } from 'date-fns';

export default function TaskEntryModal({ isOpen, onClose, defaultBlock = 'morning', editingTask = null }) {
  const { selectedDate, allowedProfiles, activeProfile, addTask, updateTask } = useTasks();
  
  const [title, setTitle] = useState('');
  const [profile, setProfile] = useState(activeProfile);
  const [timeBlock, setTimeBlock] = useState(defaultBlock);
  const [isUrgent, setIsUrgent] = useState(false);
  const [isImportant, setIsImportant] = useState(false);
  const [reminderTime, setReminderTime] = useState('');
  const [taskDate, setTaskDate] = useState(format(selectedDate, 'yyyy-MM-dd'));
  const [isRecurring, setIsRecurring] = useState(false);
  const [recurrencePattern, setRecurrencePattern] = useState('');

  useEffect(() => {
    if (isOpen) {
      if (editingTask) {
        setTitle(editingTask.title);
        setProfile(editingTask.profile);
        setTimeBlock(editingTask.time_block);
        setIsUrgent(editingTask.is_urgent);
        setIsImportant(editingTask.is_important);
        setReminderTime(editingTask.reminder_time || '');
        setTaskDate(editingTask.task_date);
        setIsRecurring(editingTask.is_recurring || false);
        setRecurrencePattern(editingTask.recurrence_pattern || '');
      } else {
        setTitle('');
        setProfile(activeProfile);
        setTimeBlock(defaultBlock);
        setIsUrgent(false);
        setIsImportant(false);
        
        let rTime = '';
        if (defaultBlock === 'morning') rTime = '09:00';
        else if (defaultBlock === 'afternoon') rTime = '14:00';
        else if (defaultBlock === 'evening') rTime = '19:00';
        else if (defaultBlock === 'night') rTime = '21:00';
        setReminderTime(rTime);
        
        setTaskDate(format(selectedDate, 'yyyy-MM-dd'));
        setIsRecurring(false);
        setRecurrencePattern('');
      }
    }
  }, [isOpen, activeProfile, defaultBlock, selectedDate, editingTask]);

  const DAYS_OF_WEEK = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

  const toggleDay = (day) => {
    let days = recurrencePattern ? recurrencePattern.split(',') : [];
    if (days.includes(day)) {
      days = days.filter(d => d !== day);
    } else {
      days.push(day);
    }
    days.sort((a, b) => DAYS_OF_WEEK.indexOf(a) - DAYS_OF_WEEK.indexOf(b));
    const newPattern = days.join(',');
    setRecurrencePattern(newPattern);
    setIsRecurring(newPattern.length > 0);
  };

  const handleTimeBlockChange = (e) => {
    const block = e.target.value;
    setTimeBlock(block);
    let rTime = '';
    if (block === 'morning') rTime = '09:00';
    else if (block === 'afternoon') rTime = '14:00';
    else if (block === 'evening') rTime = '19:00';
    else if (block === 'night') rTime = '21:00';
    setReminderTime(rTime);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!title.trim()) return;

    if (editingTask) {
      updateTask(editingTask.id, {
        title: title.trim(),
        profile,
        task_date: taskDate,
        time_block: timeBlock,
        is_urgent: isUrgent,
        is_important: isImportant,
        reminder_time: reminderTime,
        is_recurring: isRecurring,
        recurrence_pattern: isRecurring ? recurrencePattern : ''
      });
    } else {
      addTask({
        title: title.trim(),
        profile,
        task_date: taskDate,
        time_block: timeBlock,
        is_urgent: isUrgent,
        is_important: isImportant,
        reminder_time: reminderTime,
        is_recurring: isRecurring,
        recurrence_pattern: isRecurring ? recurrencePattern : ''
      });
    }
    
    onClose();
  };

  const handleReminderChange = (val) => {
    setReminderTime(val);
    if (val) {
      const hour = parseInt(val.split(':')[0], 10);
      if (hour >= 5 && hour < 12) setTimeBlock('morning');
      else if (hour >= 12 && hour < 17) setTimeBlock('afternoon');
      else if (hour >= 17 && hour < 21) setTimeBlock('evening');
      else setTimeBlock('night');
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4 sm:p-0">
      <div className="bg-white w-full max-w-md rounded-3xl shadow-2xl overflow-hidden animate-slide-up sm:animate-fade-in pb-safe">
        <form onSubmit={handleSubmit}>
          <div className="flex items-center justify-between p-4 border-b border-slate-100">
            <h2 className="text-lg font-bold text-slate-800">{editingTask ? 'Edit Task' : 'New Task'}</h2>
            <button type="button" onClick={onClose} className="p-2 rounded-full hover:bg-slate-100 text-slate-500">
              <X size={20} />
            </button>
          </div>

          <div className="p-5 space-y-5">
            <div>
              <textarea
                autoFocus
                placeholder="What needs to be done?"
                rows={3}
                className="w-full text-lg font-medium text-slate-800 placeholder-slate-400 bg-transparent border-none focus:ring-0 p-0 resize-none"
                value={title}
                onChange={e => setTitle(e.target.value)}
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Date</label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-3 flex items-center pointer-events-none">
                    <CalendarIcon size={14} className="text-slate-400" />
                  </div>
                  <input 
                    type="date"
                    className="w-full bg-slate-50 border border-slate-200 text-sm rounded-xl pl-9 pr-3 py-2.5 outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500"
                    value={taskDate}
                    onChange={e => setTaskDate(e.target.value)}
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Time Block</label>
                <select 
                  className="w-full bg-slate-50 border border-slate-200 text-sm rounded-xl px-3 py-2.5 outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500"
                  value={timeBlock}
                  onChange={handleTimeBlockChange}
                >
                  <option value="morning">🌅 Morning</option>
                  <option value="afternoon">☀️ Afternoon</option>
                  <option value="evening">🌇 Evening</option>
                  <option value="night">🌙 Night</option>
                </select>
              </div>
            </div>

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

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider ml-1 flex items-center gap-1"><Clock size={12}/> Reminder Time</label>
                <div className="relative flex items-center gap-3 bg-slate-50 p-2 rounded-xl border border-slate-200 focus-within:border-brand-500 focus-within:ring-1 focus-within:ring-brand-500 transition-all">
                  <input
                    type="time"
                    value={reminderTime}
                    onChange={e => handleReminderChange(e.target.value)}
                    className="flex-1 bg-transparent border-none text-slate-700 text-sm font-medium focus:ring-0 p-0 ml-2"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider ml-1 flex items-center gap-1"><Repeat size={12}/> Repeat Days</label>
                <div className="flex justify-between gap-1">
                  {DAYS_OF_WEEK.map(day => {
                    const isSelected = recurrencePattern.includes(day);
                    return (
                      <button
                        type="button"
                        key={day}
                        onClick={() => toggleDay(day)}
                        className={`w-9 h-9 rounded-full text-xs font-bold transition-all ${
                          isSelected 
                            ? 'bg-brand-500 text-white shadow-md shadow-brand-500/30' 
                            : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                        }`}
                      >
                        {day[0]}
                      </button>
                    );
                  })}
                </div>
              </div>
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
