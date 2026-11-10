import React, { useState, useEffect, useRef } from 'react';
import { X, Calendar as CalendarIcon, Repeat, Clock, Check } from 'lucide-react';
import { useTasks } from '../contexts/TaskContext';
import { format } from 'date-fns';

const TIME_BLOCKS = [
  { id: 'morning', label: 'Morning', icon: '🌅', defaultTime: '09:00' },
  { id: 'afternoon', label: 'Afternoon', icon: '☀️', defaultTime: '14:00' },
  { id: 'evening', label: 'Evening', icon: '🌇', defaultTime: '19:00' },
  { id: 'night', label: 'Night', icon: '🌙', defaultTime: '21:00' },
];

const HOURLY_TIMES = {
  morning: [
    { label: '6 AM', value: '06:00' },
    { label: '7 AM', value: '07:00' },
    { label: '8 AM', value: '08:00' },
    { label: '9 AM', value: '09:00' },
    { label: '10 AM', value: '10:00' },
    { label: '11 AM', value: '11:00' },
  ],
  afternoon: [
    { label: '12 PM', value: '12:00' },
    { label: '1 PM', value: '13:00' },
    { label: '2 PM', value: '14:00' },
    { label: '3 PM', value: '15:00' },
    { label: '4 PM', value: '16:00' },
  ],
  evening: [
    { label: '5 PM', value: '17:00' },
    { label: '6 PM', value: '18:00' },
    { label: '7 PM', value: '19:00' },
    { label: '8 PM', value: '20:00' },
  ],
  night: [
    { label: '9 PM', value: '21:00' },
    { label: '10 PM', value: '22:00' },
    { label: '11 PM', value: '23:00' },
    { label: '12 AM', value: '00:00' },
  ]
};

const DAYS_OF_WEEK = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

export default function RecurringTaskModal({ isOpen, onClose, editingTask = null }) {
  const { selectedDate, allowedProfiles, activeProfile, addTask, updateTask } = useTasks();
  
  const [title, setTitle] = useState('');
  const [profile, setProfile] = useState(activeProfile);
  const [timeBlock, setTimeBlock] = useState('morning');
  const [reminderTime, setReminderTime] = useState('09:00');
  const [taskDate, setTaskDate] = useState(format(selectedDate, 'yyyy-MM-dd'));
  const [recurrencePattern, setRecurrencePattern] = useState('Mon,Tue,Wed,Thu,Fri');
  const inputRef = useRef(null);
  const customTimeInputRef = useRef(null);

  useEffect(() => {
    if (isOpen) {
      if (editingTask) {
        setTitle(editingTask.title || '');
        setProfile(editingTask.profile || activeProfile);
        setTimeBlock(editingTask.time_block || 'morning');
        setReminderTime(editingTask.reminder_time || '09:00');
        setTaskDate(editingTask.task_date || format(selectedDate, 'yyyy-MM-dd'));
        setRecurrencePattern(editingTask.recurrence_pattern || 'Mon,Tue,Wed,Thu,Fri');
      } else {
        setTitle('');
        setProfile(activeProfile);
        setTimeBlock('morning');
        setReminderTime('09:00');
        setTaskDate(format(selectedDate, 'yyyy-MM-dd'));
        setRecurrencePattern('Mon,Tue,Wed,Thu,Fri');
      }
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [isOpen, activeProfile, selectedDate, editingTask]);

  const toggleDay = (day) => {
    let days = recurrencePattern === 'daily' 
      ? [...DAYS_OF_WEEK] 
      : (recurrencePattern ? recurrencePattern.split(',').map(s => s.trim()) : []);

    if (days.includes(day)) {
      days = days.filter(d => d !== day);
    } else {
      days.push(day);
    }
    days.sort((a, b) => DAYS_OF_WEEK.indexOf(a) - DAYS_OF_WEEK.indexOf(b));
    setRecurrencePattern(days.join(','));
  };

  const handleQuickRecurrence = (type) => {
    if (type === 'daily') setRecurrencePattern('daily');
    else if (type === 'weekdays') setRecurrencePattern('Mon,Tue,Wed,Thu,Fri');
    else if (type === 'weekends') setRecurrencePattern('Sat,Sun');
    else if (type === 'yearly') setRecurrencePattern('yearly');
  };

  const handleTimeBlockSelect = (blockId) => {
    setTimeBlock(blockId);
    const blockDef = TIME_BLOCKS.find(b => b.id === blockId);
    if (blockDef) {
      setReminderTime(blockDef.defaultTime);
    }
  };

  const handleSubmit = (e) => {
    if (e) e.preventDefault();
    if (!title.trim()) return;

    const pattern = recurrencePattern.trim() || 'daily';

    if (editingTask) {
      updateTask(editingTask.id, {
        title: title.trim(),
        profile,
        task_date: taskDate,
        time_block: timeBlock,
        reminder_time: reminderTime,
        is_recurring: true,
        recurrence_pattern: pattern,
        completed_dates: editingTask.completed_dates || ''
      });
    } else {
      addTask({
        title: title.trim(),
        profile,
        task_date: taskDate,
        time_block: timeBlock,
        reminder_time: reminderTime,
        is_recurring: true,
        recurrence_pattern: pattern,
        completed_dates: ''
      });
    }
    
    onClose();
  };

  if (!isOpen) return null;

  const currentHourlyTimes = HOURLY_TIMES[timeBlock] || [];
  const isCustomTime = Boolean(reminderTime && !currentHourlyTimes.some(ht => ht.value === reminderTime));
  const selectedDaysList = recurrencePattern === 'daily' 
    ? DAYS_OF_WEEK 
    : recurrencePattern.split(',').map(s => s.trim());

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-900/40 backdrop-blur-sm p-3 sm:p-0">
      <div className="bg-white w-full max-w-md rounded-3xl shadow-2xl overflow-hidden animate-slide-up sm:animate-fade-in pb-safe border border-purple-100">
        <form onSubmit={handleSubmit}>
          {/* Header */}
          <div className={`flex items-center justify-between px-5 py-4 border-b ${recurrencePattern === 'yearly' ? 'border-pink-100 bg-pink-50/60' : 'border-purple-50 bg-purple-50/50'}`}>
            <div className="flex items-center gap-2">
              <span className={`p-1.5 rounded-xl ${recurrencePattern === 'yearly' ? 'bg-pink-100 text-pink-700' : 'bg-purple-100 text-purple-700'}`}>
                {recurrencePattern === 'yearly' ? <span className="text-sm">🎂</span> : <Repeat size={16} />}
              </span>
              <h2 className="text-base font-bold text-slate-800">
                {editingTask 
                  ? (recurrencePattern === 'yearly' ? 'Edit Birthday / Anniversary' : 'Edit Recurring Task')
                  : (recurrencePattern === 'yearly' ? 'New Birthday / Anniversary Reminder' : 'New Recurring Task')}
              </h2>
            </div>
            <button 
              type="button" 
              onClick={onClose} 
              className="p-1.5 rounded-full hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors"
            >
              <X size={18} />
            </button>
          </div>

          <div className="p-5 space-y-4 max-h-[75vh] overflow-y-auto">
            {/* Title */}
            <div>
              <input
                ref={inputRef}
                type="text"
                placeholder={recurrencePattern === 'yearly' ? "e.g. Mom's Birthday 🎂 or Wedding Anniversary 💍" : "What recurring routine / task?"}
                className="w-full text-base font-medium text-slate-800 placeholder-slate-400 bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3 outline-none focus:border-purple-500 focus:bg-white focus:ring-2 focus:ring-purple-500/20 transition-all"
                value={title}
                onChange={e => setTitle(e.target.value)}
              />
              {recurrencePattern === 'yearly' && (
                <div className="flex items-center gap-1.5 mt-2 flex-wrap">
                  <span className="text-[10px] font-semibold text-slate-400">Quick templates:</span>
                  {[
                    { label: '🎂 Birthday', text: 'Birthday 🎂' },
                    { label: '💍 Anniversary', text: 'Anniversary 💍' },
                    { label: '🎉 Milestone', text: 'Milestone 🎉' }
                  ].map(sug => (
                    <button
                      key={sug.label}
                      type="button"
                      onClick={() => setTitle(prev => prev ? `${prev} - ${sug.text}` : sug.text)}
                      className="text-[10px] px-2 py-0.5 rounded-lg bg-pink-50 hover:bg-pink-100 text-pink-700 border border-pink-200/60 font-semibold transition-colors"
                    >
                      {sug.label}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Repeat Presets + Days Picker */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider ml-1">
                  Repeat Schedule
                </label>
                <div className="flex gap-1 flex-wrap">
                  <button
                    type="button"
                    onClick={() => handleQuickRecurrence('daily')}
                    className={`px-2 py-0.5 rounded-md text-[10px] font-bold transition-all ${
                      recurrencePattern === 'daily'
                        ? 'bg-purple-600 text-white'
                        : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                    }`}
                  >
                    Everyday
                  </button>
                  <button
                    type="button"
                    onClick={() => handleQuickRecurrence('weekdays')}
                    className={`px-2 py-0.5 rounded-md text-[10px] font-bold transition-all ${
                      recurrencePattern === 'Mon,Tue,Wed,Thu,Fri'
                        ? 'bg-purple-600 text-white'
                        : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                    }`}
                  >
                    Weekdays
                  </button>
                  <button
                    type="button"
                    onClick={() => handleQuickRecurrence('weekends')}
                    className={`px-2 py-0.5 rounded-md text-[10px] font-bold transition-all ${
                      recurrencePattern === 'Sat,Sun'
                        ? 'bg-purple-600 text-white'
                        : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                    }`}
                  >
                    Weekends
                  </button>
                  <button
                    type="button"
                    onClick={() => handleQuickRecurrence('yearly')}
                    className={`px-2 py-0.5 rounded-md text-[10px] font-bold transition-all flex items-center gap-1 ${
                      recurrencePattern === 'yearly'
                        ? 'bg-pink-600 text-white shadow-sm'
                        : 'bg-pink-50 text-pink-700 hover:bg-pink-100 border border-pink-200/50'
                    }`}
                  >
                    🎂 Yearly
                  </button>
                </div>
              </div>

              {recurrencePattern === 'yearly' ? (
                <div className="bg-gradient-to-r from-pink-50 via-purple-50 to-pink-50 p-3 rounded-2xl border border-pink-200/70 flex items-center gap-3">
                  <span className="text-2xl p-1 bg-white rounded-xl shadow-xs">🎂</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                      Yearly Celebration Reminder
                      <span className="text-[10px] px-1.5 py-0.2 bg-pink-100 text-pink-700 rounded-full font-semibold">Annual</span>
                    </p>
                    <p className="text-[11px] text-slate-600 mt-0.5">
                      Repeats every year on <span className="font-bold text-pink-600">{(() => {
                        const parts = taskDate.split('-').map(Number);
                        if (parts.length >= 3) {
                          return format(new Date(parts[0], parts[1] - 1, parts[2]), 'MMMM d');
                        }
                        return taskDate;
                      })()}</span>. Perfect for birthdays, anniversaries, and milestones!
                    </p>
                  </div>
                </div>
              ) : (
                /* Day Circle Buttons */
                <div className="flex justify-between gap-1 bg-slate-50 p-2 rounded-2xl border border-slate-100">
                  {DAYS_OF_WEEK.map(day => {
                    const isSelected = selectedDaysList.includes(day);
                    return (
                      <button
                        type="button"
                        key={day}
                        onClick={() => toggleDay(day)}
                        className={`w-9 h-9 rounded-xl text-xs font-bold transition-all ${
                          isSelected 
                            ? 'bg-purple-600 text-white shadow-md shadow-purple-500/30 scale-105' 
                            : 'bg-white text-slate-500 hover:bg-slate-100 border border-slate-200/50'
                        }`}
                      >
                        {day[0]}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Time Blocks */}
            <div className="space-y-1.5">
              <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider ml-1">
                Time Block
              </label>
              <div className="grid grid-cols-4 gap-1.5">
                {TIME_BLOCKS.map(block => {
                  const isSelected = timeBlock === block.id;
                  return (
                    <button
                      key={block.id}
                      type="button"
                      onClick={() => handleTimeBlockSelect(block.id)}
                      className={`flex flex-col items-center py-2 px-1 rounded-xl text-xs transition-all ${
                        isSelected
                          ? 'bg-slate-800 text-white font-bold shadow-md shadow-slate-900/20 scale-[1.02]'
                          : 'bg-slate-50 text-slate-600 hover:bg-slate-100 border border-slate-200/60 font-medium'
                      }`}
                    >
                      <span className="text-sm">{block.icon}</span>
                      <span className="text-[11px] mt-0.5">{block.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Hourly Times */}
            <div className="space-y-1.5">
              <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider ml-1 flex items-center justify-between">
                <span>Reminder Time</span>
                <span className="text-purple-600 font-semibold normal-case">
                  🔔 {reminderTime}
                </span>
              </label>
              <div className="grid grid-cols-4 gap-1.5">
                {currentHourlyTimes.map(ht => {
                  const isSelected = reminderTime === ht.value;
                  return (
                    <button
                      key={ht.value}
                      type="button"
                      onClick={() => setReminderTime(ht.value)}
                      className={`py-2 px-1.5 rounded-xl text-xs font-semibold transition-all text-center ${
                        isSelected
                          ? 'bg-purple-600 text-white shadow-sm'
                          : 'bg-slate-50 text-slate-600 hover:bg-slate-100 border border-slate-200/60'
                      }`}
                    >
                      {ht.label}
                    </button>
                  );
                })}

                {/* Custom Time Picker */}
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => {
                      if (customTimeInputRef.current?.showPicker) {
                        customTimeInputRef.current.showPicker();
                      } else {
                        customTimeInputRef.current?.focus();
                      }
                    }}
                    className={`w-full py-2 px-1.5 rounded-xl text-xs font-semibold transition-all flex items-center justify-center gap-1 ${
                      isCustomTime
                        ? 'bg-purple-600 text-white shadow-sm'
                        : 'bg-slate-50 text-slate-600 hover:bg-slate-100 border border-slate-200/60'
                    }`}
                  >
                    <Clock size={12} />
                    <span>{isCustomTime ? reminderTime : 'Custom'}</span>
                  </button>
                  <input
                    ref={customTimeInputRef}
                    type="time"
                    value={reminderTime || '09:00'}
                    onChange={(e) => {
                      if (e.target.value) {
                        setReminderTime(e.target.value);
                      }
                    }}
                    className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                  />
                </div>
              </div>
            </div>

            {/* Start Date & Assignee */}
            <div className="grid grid-cols-2 gap-3 pt-1">
              <div className="space-y-1">
                <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider ml-1">
                  {recurrencePattern === 'yearly' ? 'Event Date (Day & Month)' : 'Starts From'}
                </label>
                <div className="relative">
                  <input
                    type="date"
                    value={taskDate}
                    onChange={e => e.target.value && setTaskDate(e.target.value)}
                    className={`w-full bg-slate-50 border text-xs font-medium rounded-xl px-2.5 py-2 outline-none ${recurrencePattern === 'yearly' ? 'border-pink-200 focus:border-pink-500' : 'border-slate-200 focus:border-purple-500'}`}
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider ml-1">
                  Assignee
                </label>
                <select
                  value={profile}
                  onChange={e => setProfile(e.target.value)}
                  className={`w-full bg-slate-50 border text-xs font-semibold rounded-xl px-2.5 py-2 outline-none ${recurrencePattern === 'yearly' ? 'border-pink-200 focus:border-pink-500' : 'border-slate-200 focus:border-purple-500'}`}
                >
                  {allowedProfiles.map(p => (
                    <option key={p} value={p}>{p === 'PattuThangam' ? 'Shared' : p}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* Footer Submit */}
          <div className="p-4 border-t border-slate-100 bg-slate-50">
            <button
              type="submit"
              disabled={!title.trim() || (!recurrencePattern && selectedDaysList.length === 0)}
              className={`w-full ${recurrencePattern === 'yearly' ? 'bg-pink-600 hover:bg-pink-700 shadow-pink-500/20' : 'bg-purple-600 hover:bg-purple-700 shadow-purple-500/20'} disabled:bg-slate-300 disabled:cursor-not-allowed text-white font-bold py-3.5 rounded-2xl shadow-lg transition-all active:scale-[0.98] flex items-center justify-center gap-2`}
            >
              {recurrencePattern === 'yearly' ? <span className="text-base">🎂</span> : <Repeat size={18} />}
              {editingTask 
                ? (recurrencePattern === 'yearly' ? 'Update Birthday / Anniversary' : 'Update Recurring Routine')
                : (recurrencePattern === 'yearly' ? 'Save Birthday / Anniversary' : 'Save Recurring Routine')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
