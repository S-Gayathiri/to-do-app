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
  const [recurrenceType, setRecurrenceType] = useState('none');
  const [customDays, setCustomDays] = useState([]);
  const [editScope, setEditScope] = useState('all'); // 'this' | 'all'

  const isEditingRecurring = Boolean(
    editingTask && (
      Boolean(editingTask.is_recurring) && editingTask.is_recurring !== 'false' ||
      (typeof editingTask.id === 'string' && editingTask.id.startsWith('recurring_')) ||
      Boolean(editingTask.series_id)
    )
  );

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
        setEditScope('all');
        
        const pattern = (editingTask.recurrence_pattern || '').trim().toLowerCase();
        const hasRecurrence = Boolean(editingTask.is_recurring) && editingTask.is_recurring !== 'false' && pattern !== '';
        
        if (!hasRecurrence) {
          setRecurrenceType('none');
          setCustomDays([]);
        } else if (pattern === 'daily') {
          setRecurrenceType('daily');
          setCustomDays([]);
        } else if (pattern === 'weekly') {
          setRecurrenceType('weekly');
          setCustomDays([]);
        } else if (pattern === 'monthly') {
          setRecurrenceType('monthly');
          setCustomDays([]);
        } else {
          setRecurrenceType('custom');
          setCustomDays((editingTask.recurrence_pattern || '').split(',').map(s => s.trim()).filter(Boolean));
        }
      } else {
        setTitle('');
        setProfile(activeProfile);
        setTimeBlock(defaultBlock);
        setIsUrgent(false);
        setIsImportant(false);
        setEditScope('all');
        
        let rTime = '';
        if (defaultBlock === 'morning') rTime = '09:00';
        else if (defaultBlock === 'afternoon') rTime = '14:00';
        else if (defaultBlock === 'evening') rTime = '19:00';
        else if (defaultBlock === 'night') rTime = '21:00';
        setReminderTime(rTime);
        
        setTaskDate(format(selectedDate, 'yyyy-MM-dd'));
        setRecurrenceType('none');
        setCustomDays([]);
      }
    }
  }, [isOpen, activeProfile, defaultBlock, selectedDate, editingTask]);

  const DAYS_OF_WEEK = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

  const toggleDay = (day) => {
    let days = [...customDays];
    if (days.includes(day)) {
      days = days.filter(d => d !== day);
    } else {
      days.push(day);
    }
    days.sort((a, b) => DAYS_OF_WEEK.indexOf(a) - DAYS_OF_WEEK.indexOf(b));
    setCustomDays(days);
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

  const getRecurrenceHelperText = () => {
    if (recurrenceType === 'none') return null;
    if (recurrenceType === 'daily') return '🔁 Repeats every day';
    
    const [y, m, d] = (taskDate || '').split('-').map(Number);
    const dateObj = y && m && d ? new Date(y, m - 1, d) : selectedDate;
    
    if (recurrenceType === 'weekly') {
      const dayName = format(dateObj, 'EEEE');
      return `📅 Repeats every week on ${dayName}`;
    }
    if (recurrenceType === 'monthly') {
      const dayOfMonth = format(dateObj, 'do');
      return `🗓️ Repeats on the ${dayOfMonth} of every month`;
    }
    if (recurrenceType === 'custom') {
      if (customDays.length === 0) return '⚙️ Select the days below to repeat';
      return `🔁 Repeats on ${customDays.join(', ')}`;
    }
    return null;
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!title.trim()) return;

    let finalIsRecurring = false;
    let finalPattern = '';

    if (recurrenceType === 'daily') {
      finalIsRecurring = true;
      finalPattern = 'daily';
    } else if (recurrenceType === 'weekly') {
      finalIsRecurring = true;
      finalPattern = 'weekly';
    } else if (recurrenceType === 'monthly') {
      finalIsRecurring = true;
      finalPattern = 'monthly';
    } else if (recurrenceType === 'custom') {
      finalIsRecurring = customDays.length > 0;
      finalPattern = customDays.join(',');
    }

    // If editing a recurring task for this day only
    if (editingTask && isEditingRecurring && editScope === 'this') {
      // Save as single-day standalone task
      addTask({
        title: title.trim(),
        profile,
        task_date: taskDate,
        time_block: timeBlock,
        is_urgent: isUrgent,
        is_important: isImportant,
        reminder_time: reminderTime,
        is_recurring: false,
        recurrence_pattern: ''
      });

      // If original task title is different, skip original for this day
      if ((editingTask.title || '').trim().toLowerCase() !== title.trim().toLowerCase()) {
        addTask({
          title: editingTask.title,
          profile: editingTask.profile,
          time_block: editingTask.time_block,
          task_date: taskDate,
          is_completed: false,
          is_skipped: true,
          is_recurring: false,
          recurrence_pattern: ''
        });
      }
    } else if (editingTask) {
      updateTask(editingTask.id, {
        title: title.trim(),
        profile,
        task_date: taskDate,
        time_block: timeBlock,
        is_urgent: isUrgent,
        is_important: isImportant,
        reminder_time: reminderTime,
        is_recurring: finalIsRecurring,
        recurrence_pattern: finalPattern
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
        is_recurring: finalIsRecurring,
        recurrence_pattern: finalPattern
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

  const [y, m, d] = (taskDate || '').split('-').map(Number);
  const dateObj = y && m && d ? new Date(y, m - 1, d) : selectedDate;
  const currentWeekday = format(dateObj, 'EEEE');
  const currentDayOfMonth = format(dateObj, 'do');
  const helperText = getRecurrenceHelperText();

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

          <div className="p-5 space-y-4">
            {/* Edit Scope for Recurring Tasks */}
            {isEditingRecurring && (
              <div className="bg-purple-50 p-2.5 rounded-2xl border border-purple-100 space-y-2">
                <label className="text-xs font-bold text-purple-900 uppercase tracking-wider flex items-center gap-1">
                  <Repeat size={13} /> Edit Repeating Task
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setEditScope('this')}
                    className={`py-2 px-3 rounded-xl text-xs font-bold transition-all ${
                      editScope === 'this'
                        ? 'bg-purple-600 text-white shadow-sm'
                        : 'bg-white text-purple-700 hover:bg-purple-100/50'
                    }`}
                  >
                    This day only
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditScope('all')}
                    className={`py-2 px-3 rounded-xl text-xs font-bold transition-all ${
                      editScope === 'all'
                        ? 'bg-purple-600 text-white shadow-sm'
                        : 'bg-white text-purple-700 hover:bg-purple-100/50'
                    }`}
                  >
                    All occurrences
                  </button>
                </div>
              </div>
            )}

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

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-500 uppercase tracking-wider ml-1 flex items-center gap-1"><Clock size={12}/> Reminder Time</label>
              <div className="relative flex items-center gap-3 bg-slate-50 p-2.5 rounded-xl border border-slate-200 focus-within:border-brand-500 focus-within:ring-1 focus-within:ring-brand-500 transition-all">
                <input
                  type="time"
                  value={reminderTime}
                  onChange={e => handleReminderChange(e.target.value)}
                  className="flex-1 bg-transparent border-none text-slate-700 text-sm font-medium focus:ring-0 p-0 ml-2"
                />
              </div>
            </div>

            {/* Recurrence Section */}
            <div className="space-y-2 pt-1">
              <label className="text-xs font-bold text-slate-500 uppercase tracking-wider ml-1 flex items-center gap-1.5">
                <Repeat size={13} className="text-brand-600" /> Recurrence
              </label>
              
              <select
                value={recurrenceType}
                onChange={e => setRecurrenceType(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 text-sm rounded-xl px-3 py-2.5 outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500 font-medium text-slate-700"
              >
                <option value="none">Does not repeat</option>
                <option value="daily">Daily (Every day)</option>
                <option value="weekly">Weekly (Every {currentWeekday})</option>
                <option value="monthly">Monthly (On the {currentDayOfMonth})</option>
                <option value="custom">Specific days of week...</option>
              </select>

              {helperText && (
                <p className="text-xs text-brand-700 bg-brand-50/70 border border-brand-100 rounded-lg px-2.5 py-1.5 font-medium">
                  {helperText}
                </p>
              )}

              {recurrenceType === 'custom' && (
                <div className="pt-1">
                  <div className="flex justify-between gap-1">
                    {DAYS_OF_WEEK.map(day => {
                      const isSelected = customDays.includes(day);
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
              )}
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
