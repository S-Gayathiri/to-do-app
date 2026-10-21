import React, { useState, useEffect, useRef } from 'react';
import { X, Calendar as CalendarIcon, Clock, Check } from 'lucide-react';
import { useTasks } from '../contexts/TaskContext';
import { format, addDays } from 'date-fns';

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

export default function TaskEntryModal({ isOpen, onClose, defaultBlock = 'morning', editingTask = null }) {
  const { selectedDate, allowedProfiles, activeProfile, addTask, updateTask } = useTasks();
  
  const [title, setTitle] = useState('');
  const [profile, setProfile] = useState(activeProfile);
  const [timeBlock, setTimeBlock] = useState(defaultBlock);
  const [reminderTime, setReminderTime] = useState('');
  const [taskDate, setTaskDate] = useState(format(selectedDate, 'yyyy-MM-dd'));
  const inputRef = useRef(null);
  const customDateInputRef = useRef(null);
  const customTimeInputRef = useRef(null);

  // Generate 5 upcoming dates
  const today = new Date();
  const upcomingDates = [0, 1, 2, 3, 4].map(daysAhead => {
    const d = addDays(today, daysAhead);
    const dateStr = format(d, 'yyyy-MM-dd');
    let label = format(d, 'EEE');
    if (daysAhead === 0) label = 'Today';
    else if (daysAhead === 1) label = 'Tomorrow';
    
    return {
      dateStr,
      label,
      subLabel: format(d, 'MMM d')
    };
  });

  const isCustomDate = !upcomingDates.some(ud => ud.dateStr === taskDate);

  useEffect(() => {
    if (isOpen) {
      if (editingTask) {
        setTitle(editingTask.title || '');
        setProfile(editingTask.profile || activeProfile);
        setTimeBlock(editingTask.time_block || defaultBlock);
        setReminderTime(editingTask.reminder_time || '');
        setTaskDate(editingTask.task_date || format(selectedDate, 'yyyy-MM-dd'));
      } else {
        setTitle('');
        setProfile(activeProfile);
        setTimeBlock(defaultBlock);
        
        // Auto default reminder time for the block
        const blockDef = TIME_BLOCKS.find(b => b.id === defaultBlock);
        setReminderTime(blockDef ? blockDef.defaultTime : '09:00');
        setTaskDate(format(selectedDate, 'yyyy-MM-dd'));
      }
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [isOpen, activeProfile, defaultBlock, selectedDate, editingTask]);

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

    if (editingTask) {
      updateTask(editingTask.id, {
        title: title.trim(),
        profile,
        task_date: taskDate,
        time_block: timeBlock,
        reminder_time: reminderTime,
        is_recurring: false,
        recurrence_pattern: '',
        completed_dates: ''
      });
    } else {
      addTask({
        title: title.trim(),
        profile,
        task_date: taskDate,
        time_block: timeBlock,
        reminder_time: reminderTime,
        is_recurring: false,
        recurrence_pattern: '',
        completed_dates: ''
      });
    }
    
    onClose();
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  if (!isOpen) return null;

  const currentHourlyTimes = HOURLY_TIMES[timeBlock] || [];
  const isCustomTime = Boolean(reminderTime && !currentHourlyTimes.some(ht => ht.value === reminderTime));

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-900/40 backdrop-blur-sm p-3 sm:p-0">
      <div className="bg-white w-full max-w-md rounded-3xl shadow-2xl overflow-hidden animate-slide-up sm:animate-fade-in pb-safe">
        <form onSubmit={handleSubmit}>
          {/* Header */}
          <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
            <h2 className="text-base font-bold text-slate-800">
              {editingTask ? 'Edit Task' : 'Quick Add Task'}
            </h2>
            <button 
              type="button" 
              onClick={onClose} 
              className="p-1.5 rounded-full hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors"
            >
              <X size={18} />
            </button>
          </div>

          <div className="p-5 space-y-4 max-h-[75vh] overflow-y-auto">
            {/* Task Description Input */}
            <div>
              <input
                ref={inputRef}
                type="text"
                placeholder="What needs to be done?"
                className="w-full text-base font-medium text-slate-800 placeholder-slate-400 bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3 outline-none focus:border-brand-500 focus:bg-white focus:ring-2 focus:ring-brand-500/20 transition-all"
                value={title}
                onChange={e => setTitle(e.target.value)}
                onKeyDown={handleKeyDown}
              />
            </div>

            {/* 3x2 Matrix: 5 Upcoming Dates + 1 Date Picker */}
            <div className="space-y-1.5">
              <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider ml-1">
                Select Date
              </label>
              <div className="grid grid-cols-3 gap-2">
                {upcomingDates.map(ud => {
                  const isSelected = taskDate === ud.dateStr;
                  return (
                    <button
                      key={ud.dateStr}
                      type="button"
                      onClick={() => setTaskDate(ud.dateStr)}
                      className={`flex flex-col items-center justify-center py-2 px-1 rounded-xl text-xs transition-all ${
                        isSelected
                          ? 'bg-brand-600 text-white font-bold shadow-md shadow-brand-500/30 scale-[1.02]'
                          : 'bg-slate-50 text-slate-600 hover:bg-slate-100 border border-slate-200/60 font-medium'
                      }`}
                    >
                      <span className="font-semibold">{ud.label}</span>
                      <span className={`text-[10px] ${isSelected ? 'text-brand-100' : 'text-slate-400'}`}>
                        {ud.subLabel}
                      </span>
                    </button>
                  );
                })}

                {/* 6th Pill: Custom Date Picker */}
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => customDateInputRef.current?.showPicker ? customDateInputRef.current.showPicker() : customDateInputRef.current?.focus()}
                    className={`w-full h-full flex flex-col items-center justify-center py-2 px-1 rounded-xl text-xs transition-all ${
                      isCustomDate
                        ? 'bg-brand-600 text-white font-bold shadow-md shadow-brand-500/30 scale-[1.02]'
                        : 'bg-slate-50 text-slate-600 hover:bg-slate-100 border border-slate-200/60 font-medium'
                    }`}
                  >
                    <span className="flex items-center gap-1 font-semibold">
                      <CalendarIcon size={12} />
                      {isCustomDate ? format(new Date(taskDate.split('-')[0], taskDate.split('-')[1] - 1, taskDate.split('-')[2]), 'MMM d') : 'Custom'}
                    </span>
                    <span className={`text-[10px] ${isCustomDate ? 'text-brand-100' : 'text-slate-400'}`}>
                      {isCustomDate ? 'Selected' : 'Pick date'}
                    </span>
                  </button>
                  <input
                    ref={customDateInputRef}
                    type="date"
                    value={taskDate}
                    onChange={e => e.target.value && setTaskDate(e.target.value)}
                    className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                  />
                </div>
              </div>
            </div>

            {/* 4x1 Matrix: Time Blocks */}
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

            {/* Hourly Times Matrix for the chosen Block */}
            <div className="space-y-1.5">
              <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider ml-1 flex items-center justify-between">
                <span>Reminder Time</span>
                <span className="text-brand-600 font-semibold normal-case">
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
                          ? 'bg-brand-500 text-white shadow-sm'
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
                        ? 'bg-brand-500 text-white shadow-sm'
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

            {/* Profile Selection */}
            <div className="flex items-center justify-between pt-1">
              <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider ml-1">
                Assignee
              </label>
              <div className="flex gap-1.5">
                {allowedProfiles.map(p => {
                  const isSelected = profile === p;
                  return (
                    <button
                      key={p}
                      type="button"
                      onClick={() => setProfile(p)}
                      className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${
                        isSelected 
                          ? 'bg-slate-800 text-white shadow-sm' 
                          : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                      }`}
                    >
                      {p === 'PattuThangam' ? 'Shared' : p}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Footer Submit */}
          <div className="p-4 border-t border-slate-100 bg-slate-50">
            <button
              type="submit"
              disabled={!title.trim()}
              className="w-full bg-brand-600 hover:bg-brand-700 disabled:bg-slate-300 disabled:cursor-not-allowed text-white font-bold py-3.5 rounded-2xl shadow-lg shadow-brand-500/20 transition-all active:scale-[0.98] flex items-center justify-center gap-2"
            >
              <Check size={18} />
              {editingTask ? 'Update Task' : 'Add Task'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
